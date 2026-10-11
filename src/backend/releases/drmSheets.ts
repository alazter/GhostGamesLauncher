import { app, net } from 'electron'
import { mkdir, readFile, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import type { ReleaseDrmSource } from 'common/releaseDrm'
import { normalizeDrmTitle, releaseDrmLabels } from 'common/releaseDrm'
import {
  CRACKWATCH_DOCUMENT,
  DRM_SHEETS,
  drmSheetUrl,
  parseCrackWatchSheet
} from './drmCommunityParser'

interface SavedSheet {
  gid: string
  fetchedAt: string
  sources: ReleaseDrmSource[]
}
const sheets = new Map<string, SavedSheet>()
let loading: Promise<void> | undefined
let inFlight: Promise<void> | undefined
let attemptedAt = 0
let warning = ''
let failedSheets = new Set<string>()
const ttl = 15 * 60000
const directory = () => join(app.getPath('userData'), 'releases')
const file = () => join(directory(), 'drm-community.json')

async function restore() {
  try {
    const text = await readFile(file(), 'utf8')
    if (text.length > 4 * 1024 * 1024) return
    const data = JSON.parse(text)
    if (!Array.isArray(data) || data.length > DRM_SHEETS.length) return
    for (const saved of data) {
      if (
        !DRM_SHEETS.some((sheet) => sheet.gid === saved?.gid) ||
        !Number.isFinite(Date.parse(saved?.fetchedAt)) ||
        !Array.isArray(saved.sources) ||
        saved.sources.length > 5000
      )
        continue
      const valid = saved.sources.every(
        (source: ReleaseDrmSource) =>
          source?.name === 'CrackWatchSheet' &&
          source.url === drmSheetUrl(saved.gid) &&
          typeof source.title === 'string' &&
          source.title.length <= 300 &&
          normalizeDrmTitle(source.title) &&
          (!source.status || Object.hasOwn(releaseDrmLabels, source.status)) &&
          ['protection', 'crackDate', 'group', 'category', 'observedAt'].every(
            (key) =>
              source[key as keyof ReleaseDrmSource] === undefined ||
              (typeof source[key as keyof ReleaseDrmSource] === 'string' &&
                String(source[key as keyof ReleaseDrmSource]).length <= 150)
          )
      )
      if (valid) sheets.set(saved.gid, saved)
    }
  } catch {
    /* Optional metadata cache: the catalogue and follows stay usable. */
  }
}
async function update() {
  attemptedAt = Date.now()
  const failures: string[] = []
  failedSheets = new Set()
  let next = 0
  // One shared index refresh, three downloads at a time, regardless of card count.
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < DRM_SHEETS.length) {
        const sheet = DRM_SHEETS[next++]
        try {
          const response = await net.fetch(
            `https://docs.google.com/spreadsheets/d/${CRACKWATCH_DOCUMENT}/export?format=csv&gid=${sheet.gid}`,
            {
              signal: AbortSignal.timeout(15000),
              credentials: 'omit'
            }
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const csv = await response.text()
          const fetchedAt = new Date().toISOString()
          const sources = parseCrackWatchSheet(csv, sheet, fetchedAt)
          sheets.set(sheet.gid, { gid: sheet.gid, fetchedAt, sources })
        } catch {
          failures.push(sheet.label)
          failedSheets.add(sheet.gid)
          // Keep this tab's last validated rows when access or the schema changes.
        }
      }
    })
  )
  warning = failures.length
    ? `Planilha: ${failures.length} aba(s) não puderam ser atualizadas; dados anteriores preservados quando disponíveis.`
    : ''
  try {
    await mkdir(directory(), { recursive: true })
    const temporary = join(directory(), 'drm-community.tmp')
    await writeFile(temporary, JSON.stringify([...sheets.values()]), 'utf8')
    await rename(temporary, file())
  } catch {
    warning = [warning, 'Falha ao guardar a base da planilha.']
      .filter(Boolean)
      .join(' ')
  }
}
export async function getCrackWatchSheetSources(
  title: string,
  refresh = false
) {
  loading ||= restore()
  await loading
  if (inFlight) await inFlight
  else if (refresh || Date.now() - attemptedAt >= ttl) {
    inFlight = update()
    try {
      await inFlight
    } finally {
      inFlight = undefined
    }
  }
  const key = normalizeDrmTitle(title)
  const sources = [...sheets.values()]
    .flatMap((sheet) =>
      sheet.sources.filter((source) => normalizeDrmTitle(source.title!) === key)
    )
    .sort(
      (a, b) =>
        (b.crackDate || '').localeCompare(a.crackDate || '') ||
        a.url.localeCompare(b.url)
    )
    .slice(0, 4)
  return {
    sources,
    warning,
    stale: sources.some(
      (source) =>
        failedSheets.has(new URL(source.url).searchParams.get('gid')!) ||
        Date.now() - Date.parse(source.observedAt!) >= ttl
    )
  }
}
