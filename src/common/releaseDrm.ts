export type ReleaseDrmStatus =
  | 'unknown'
  | 'cracked'
  | 'uncracked'
  | 'unreleased'
  | 'bypassed'
  | 'drm-free'
  | 'early-access'
  | 'conflicting'
export type ManualDrmStatus = Exclude<ReleaseDrmStatus, 'conflicting'>
export type InteractiveDrmSource = 'HizSearch' | 'SkidrowReloaded'
export const manualDrmStatuses: ManualDrmStatus[] = [
  'cracked',
  'drm-free',
  'uncracked',
  'bypassed',
  'unreleased',
  'early-access',
  'unknown'
]
export interface ReleaseDrmOverride {
  status: ManualDrmStatus
  updatedAt: string
}
export interface ReleaseDrmSource {
  name:
    | 'IsItCracked'
    | 'CrackWatch'
    | 'CrackWatchSheet'
    | 'CrackWatchIndex'
    | 'SkidrowReloaded'
    | 'AnkerGames'
    | 'HizSearch'
  url: string
  status?: ReleaseDrmStatus
  title?: string
  protection?: string
  crackDate?: string
  group?: string
  reportedAt?: string
  category?: string
  observedAt?: string
  availability?: 'listed'
  notice?: string
  requiresVerification?: boolean
}
export interface ReleaseDrmReport {
  id: string
  title: string
  platform: 'PC'
  status: ReleaseDrmStatus
  checkedAt: string
  lastAttemptAt?: string
  sources: ReleaseDrmSource[]
  stale?: boolean
  warning?: string
  lookupVersion?: number
  manualOverride?: ReleaseDrmOverride
}
export const releaseDrmSourceLabels: Record<ReleaseDrmSource['name'], string> =
  {
    IsItCracked: 'IsItCracked',
    CrackWatch: 'Reddit · r/CrackWatch',
    CrackWatchSheet: 'Planilha · r/CrackWatch',
    CrackWatchIndex: 'Lista · r/CrackWatch',
    SkidrowReloaded: 'SkidrowReloaded',
    AnkerGames: 'AnkerGames',
    HizSearch: 'HizSearch'
  }
export const releaseDrmLabels: Record<ReleaseDrmStatus, string> = {
  unknown: 'Não confirmado',
  cracked: 'Quebra relatada',
  uncracked: 'Sem quebra relatada',
  unreleased: 'Ainda não lançado',
  bypassed: 'Bypass relatado',
  'drm-free': 'Sem DRM / DRM removido',
  'early-access': 'Acesso antecipado',
  conflicting: 'Fontes divergem'
}
const numerals = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX'
]
function sequelNumber(token: string, prefix: string) {
  const number = /^\d+$/.test(token)
    ? Number(token) - 1
    : numerals.indexOf(token.toUpperCase())
  // A standalone X/V/I can be part of a name (Mega Man X, The X Files),
  // rather than a sequel number. Convert these only with an explicit qualifier.
  if (
    [0, 4, 9].includes(number) &&
    !/\b(?:episode|part|chapter|act)\s*$/i.test(prefix)
  )
    return -1
  return number
}
export function drmTitleAliases(title: string): string[] {
  const alternate = title.replace(
    /\b(?:[IVX]+|[1-9]|1[0-9]|20)\b/gi,
    (token, offset: number) => {
      if (!offset) return token
      const number = sequelNumber(token, title.slice(0, offset))
      if (number < 0) return token
      return /^\d+$/.test(token)
        ? numerals[number] || token
        : String(number + 1)
    }
  )
  return [...new Set([title, alternate])]
}
export function normalizeDrmTitle(title: string) {
  return title
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b[IVX]+\b/gi, (token, offset: number) => {
      const number = sequelNumber(token, title.slice(0, offset))
      return offset > 0 && number >= 0 ? String(number + 1) : token
    })
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
export function drmGameSlug(title: string) {
  return title
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
export function combinedDrmStatus(
  sources: ReleaseDrmSource[]
): ReleaseDrmStatus {
  const latest = new Map<string, ReleaseDrmStatus>()
  for (const source of sources)
    if (
      source.status &&
      source.status !== 'unknown' &&
      !latest.has(source.name)
    )
      latest.set(source.name, source.status)
  const states = [...new Set(latest.values())]
  return states.length > 1 ? 'conflicting' : states[0] || 'unknown'
}
/** Only a matching, explicit source status can end automatic checks. */
export function isConfirmedDrmReport(report: ReleaseDrmReport) {
  if (report.manualOverride)
    return ['cracked', 'drm-free'].includes(report.manualOverride.status)
  return (
    ['cracked', 'drm-free'].includes(report.status) &&
    combinedDrmStatus(report.sources) === report.status
  )
}
export const displayedDrmStatus = (
  report?: ReleaseDrmReport | null
): ReleaseDrmStatus =>
  report?.manualOverride?.status || report?.status || 'unknown'
export function safeDrmSourceUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return undefined
    if (
      url.hostname === 'www.skidrowreloaded.com' &&
      /^\/(?:[a-z0-9-]+\/?)?$/.test(url.pathname) &&
      !/^\/(?:download|go|out|redirect|wp-)/i.test(url.pathname) &&
      [...url.searchParams.keys()].every((key) => key === 's') &&
      (!url.search || url.pathname === '/')
    )
      return url.href
    if (
      url.hostname === 'ankergames.net' &&
      (/^\/game\/[a-z0-9-]+\/?$/.test(url.pathname) ||
        /^\/search\/[^/]+\/?$/.test(url.pathname) ||
        /^\/games-list\/?$/.test(url.pathname)) &&
      [...url.searchParams.keys()].every((key) => key === 'q') &&
      (!url.search || /^\/games-list\/?$/.test(url.pathname))
    )
      return url.href
    if (
      url.hostname === 'hizsearch.pages.dev' &&
      url.pathname === '/' &&
      [...url.searchParams.keys()].every((key) => key === 'q') &&
      url.searchParams.getAll('q').length <= 1 &&
      (url.searchParams.get('q') || '').length <= 300 &&
      !url.hash
    )
      return url.href
    if (
      url.hostname === 'isitcracked.com' &&
      /^\/(?:game\/[a-z0-9-]+|games)\/?$/.test(url.pathname)
    )
      return url.href
    if (
      url.hostname === 'www.reddit.com' &&
      /^\/r\/CrackWatch\/(?:search\/?|comments\/[a-z0-9]+\/[^/]+\/?|)$/.test(
        url.pathname
      )
    )
      return url.href
    if (
      url.hostname === 'old.reddit.com' &&
      /^\/r\/CrackWatch\/comments\/p9ak4n\/crack_watch_games\/?$/.test(
        url.pathname
      )
    )
      return url.href
    if (
      url.hostname === 'docs.google.com' &&
      url.pathname ===
        '/spreadsheets/d/1f8wm0424N4QsZUYwY41kalaax0K2Lb_GZgfjxY07jkg/edit' &&
      /^\d+$/.test(url.searchParams.get('gid') || '') &&
      [...url.searchParams.keys()].every((key) => key === 'gid')
    )
      return url.href
  } catch {
    /* Untrusted source links are never opened. */
  }
  return undefined
}
