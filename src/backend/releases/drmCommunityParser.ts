import type { ReleaseDrmSource, ReleaseDrmStatus } from 'common/releaseDrm'
import { normalizeDrmTitle } from 'common/releaseDrm'
import { exactDate } from './parser'

export const CRACKWATCH_DOCUMENT =
  '1f8wm0424N4QsZUYwY41kalaax0K2Lb_GZgfjxY07jkg'
export const CRACKWATCH_INDEX =
  'https://old.reddit.com/r/CrackWatch/comments/p9ak4n/crack_watch_games/'
type SheetKind =
  | 'uncracked'
  | 'cracked'
  | 'bypassed'
  | 'removed'
  | 'upcoming'
  | 'online'
  | 'added'
  | 'mixed'
  | 'uwp'
  | 'battlenet'
export interface DrmSheetDefinition {
  gid: string
  label: string
  kind: SheetKind
}
export const DRM_SHEETS: DrmSheetDefinition[] = [
  { gid: '464952770', label: 'Denuvo sem quebra ou bypass', kind: 'uncracked' },
  { gid: '0', label: 'Denuvo com quebra · 2021 em diante', kind: 'cracked' },
  { gid: '2121137636', label: 'Denuvo com bypass', kind: 'bypassed' },
  {
    gid: '1553236641',
    label: 'Denuvo com quebra · 2014–2020',
    kind: 'cracked'
  },
  {
    gid: '1664037808',
    label: 'Denuvo removido em pelo menos uma versão',
    kind: 'removed'
  },
  {
    gid: '587965008',
    label: 'Próximos jogos · inclui estimativas de Denuvo',
    kind: 'upcoming'
  },
  { gid: '887017062', label: 'Denuvo · conexão obrigatória', kind: 'online' },
  {
    gid: '534853160',
    label: 'Denuvo adicionado depois do lançamento',
    kind: 'added'
  },
  { gid: '1547171063', label: 'Denuvo · jogos gratuitos', kind: 'mixed' },
  { gid: '2072675210', label: 'Denuvo · VR e acessórios', kind: 'mixed' },
  { gid: '31030764', label: 'UWP / Microsoft Store', kind: 'uwp' },
  { gid: '1889606516', label: 'Battle.net', kind: 'battlenet' }
]
export const drmSheetUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${CRACKWATCH_DOCUMENT}/edit?gid=${gid}#gid=${gid}`

/** Bounded RFC 4180 reader: Google exports contain quoted, multiline cells. */
export function readDrmCsv(input: string): string[][] {
  if (input.length > 1024 * 1024) throw new Error('Planilha muito grande.')
  const text = input.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false
  const endCell = () => {
    row.push(cell)
    if (row.length > 50) throw new Error('Colunas demais na planilha.')
    cell = ''
    closed = false
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
    if (rows.length > 5000) throw new Error('Linhas demais na planilha.')
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
        closed = true
      } else cell += char
    } else if (char === ',') endCell()
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else if (char === '"' && !cell && !closed) quoted = true
    else {
      if (closed || char === '"') throw new Error('Formato CSV inválido.')
      cell += char
    }
    if (cell.length > 10000) throw new Error('Célula muito grande na planilha.')
  }
  if (quoted) throw new Error('Formato CSV incompleto.')
  if (cell || row.length || closed) endRow()
  return rows
}
const header = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')
const field = (value: string | undefined) => {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text &&
    text.length <= 150 &&
    !/^(?:-|TBD|TBA|N\/A|Unknown)$/i.test(text)
    ? text
    : undefined
}
export function parseCrackWatchSheet(
  csv: string,
  sheet: DrmSheetDefinition,
  observedAt: string
): ReleaseDrmSource[] {
  let columns: string[] | undefined
  const sources: ReleaseDrmSource[] = []
  for (const row of readDrmCsv(csv)) {
    if (header(row[0] || '') === 'name') {
      columns = row.map(header)
      if (!columns.includes('released') && !columns.includes('releasing'))
        throw new Error('Cabeçalho da planilha mudou.')
      const required =
        sheet.kind === 'added'
          ? 'denuvo cracked on'
          : ['cracked', 'removed', 'mixed', 'uwp', 'battlenet'].includes(
                sheet.kind
              )
            ? 'cracked'
            : sheet.kind === 'bypassed'
              ? 'bypassed by'
              : undefined
      if (required && !columns.includes(required))
        throw new Error('Coluna de DRM ausente.')
      continue
    }
    if (!columns) continue
    const get = (name: string) => (row[columns!.indexOf(name)] || '').trim()
    const title = get('name'),
      released = get('released') || get('releasing')
    if (!title || title.length > 300 || !normalizeDrmTitle(title) || !released)
      continue
    const crackDate = exactDate(
      get(sheet.kind === 'added' ? 'denuvo cracked on' : 'cracked')
    )
    let status: ReleaseDrmStatus | undefined = crackDate ? 'cracked' : undefined
    if (sheet.kind === 'uncracked') status = 'uncracked'
    if (sheet.kind === 'bypassed') status = 'bypassed'
    if (!status && /^exists$/i.test(get('hypervisor'))) status = 'bypassed'
    const releaseDate = exactDate(released)
    if (
      sheet.kind === 'upcoming' &&
      releaseDate &&
      releaseDate > observedAt.slice(0, 10)
    )
      status = 'unreleased'
    // CSV does not preserve the source's colours (store exceptions/assumptions).
    // Removal of Denuvo never implies absence of every DRM in all PC versions.
    const protection =
      sheet.kind === 'removed'
        ? 'Denuvo removido em pelo menos uma versão; outras proteções podem permanecer'
        : sheet.kind === 'upcoming'
          ? 'Denuvo listado; a aba também inclui estimativas'
          : sheet.kind === 'uwp'
            ? 'UWP / Microsoft Store'
            : sheet.kind === 'battlenet'
              ? 'Battle.net'
              : 'Denuvo'
    sources.push({
      name: 'CrackWatchSheet',
      title,
      url: drmSheetUrl(sheet.gid),
      status,
      protection,
      crackDate,
      group: field(get(sheet.kind === 'bypassed' ? 'bypassed by' : 'by')),
      category: sheet.label,
      observedAt
    })
  }
  if (!columns) throw new Error('Tabela de jogos não encontrada na planilha.')
  return sources
}

/** Only explicit game/status table cells constitute evidence in the curated post. */
export function parseCrackWatchIndex(
  value: unknown,
  title: string
): ReleaseDrmSource[] {
  const listing = (Array.isArray(value) ? value[0] : value) as
    | {
        data?: {
          children?: {
            data?: { id?: unknown; subreddit?: unknown; selftext?: unknown }
          }[]
        }
      }
    | undefined
  const post = listing?.data?.children?.[0]?.data
  if (
    post?.id !== 'p9ak4n' ||
    String(post?.subreddit).toLowerCase() !== 'crackwatch' ||
    typeof post.selftext !== 'string' ||
    post.selftext.length > 1024 * 1024 ||
    !normalizeDrmTitle(title)
  )
    return []
  const clean = (cell: string) =>
    cell
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim()
  let columns: string[] = []
  const states: Record<string, ReleaseDrmStatus> = {
    cracked: 'cracked',
    uncracked: 'uncracked',
    unreleased: 'unreleased',
    bypassed: 'bypassed',
    hypervisor: 'bypassed',
    'drm removed': 'drm-free',
    'drm free': 'drm-free'
  }
  const sources: ReleaseDrmSource[] = []
  const selftext: string = post.selftext
  for (const line of selftext.split(/\r?\n/).slice(0, 10000)) {
    if (!line.includes('|')) {
      columns = []
      continue
    }
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(clean)
    if (
      /^(name|game|title)$/i.test(cells[0]) &&
      cells.some((cell) => /^(status|crack status)$/i.test(cell))
    ) {
      columns = cells.map(header)
      continue
    }
    if (
      !columns.length ||
      normalizeDrmTitle(cells[0]) !== normalizeDrmTitle(title)
    )
      continue
    const get = (name: string) => cells[columns.indexOf(name)] || ''
    const status = states[header(get('status') || get('crack status'))]
    if (!status) continue
    sources.push({
      name: 'CrackWatchIndex',
      url: CRACKWATCH_INDEX,
      title: cells[0],
      status,
      crackDate: exactDate(get('crack date')),
      group: field(get('group')),
      protection: field(get('drm'))
    })
  }
  return sources.slice(0, 3)
}
