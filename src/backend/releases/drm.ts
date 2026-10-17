import { BrowserWindow, session, app } from 'electron'
import { mkdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import type {
  ReleaseDrmReport,
  ManualDrmStatus,
  ReleaseDrmOverride
} from 'common/releaseDrm'
import {
  combinedDrmStatus,
  drmGameSlug,
  drmTitleAliases,
  normalizeDrmTitle,
  safeDrmSourceUrl,
  releaseDrmLabels,
  releaseDrmSourceLabels,
  isConfirmedDrmReport
} from 'common/releaseDrm'
import { parseIsItCracked } from './drmParser'
import { getCrackWatchSheetSources } from './drmSheets'
import { CRACKWATCH_INDEX, drmSheetUrl } from './drmCommunityParser'
import {
  readCrackWatch,
  readCrackWatchIndex,
  crackWatchSearchUrl
} from './drmReddit'
import { DrmLookupQueue } from './drmQueue'
import { getAdditionalDrmSources } from './drmSites'
import { preserveDrmSources } from './drmContinuity'
import {
  readDrmOverride,
  writeDrmOverride,
  validateDrmIdentity
} from './drmOverrides'

const reports = new Map<string, ReleaseDrmReport>()
const queue = new DrmLookupQueue<ReleaseDrmReport>()
let loading: Promise<void> | null = null
let sourceReady = false
const lookupVersion = 6
let writer: Promise<unknown> = Promise.resolve()
const directory = () => join(app.getPath('userData'), 'releases')
const file = () => join(directory(), 'drm-cache.json')
const confirmedDirectory = () => join(directory(), 'drm-confirmed')
const reportKey = (report: Pick<ReleaseDrmReport, 'id' | 'title'>) =>
  createHash('sha256')
    .update(report.id + ':' + report.title)
    .digest('hex')
const withOverride = (
  report: ReleaseDrmReport,
  override?: ReleaseDrmOverride
): ReleaseDrmReport =>
  override ? { ...report, manualOverride: override } : report
const emptyReport = (game: {
  id: string
  title: string
}): ReleaseDrmReport => ({
  id: game.id,
  title: game.title,
  platform: 'PC',
  status: 'unknown',
  checkedAt: new Date().toISOString(),
  sources: []
})

export async function setReleaseDrmManual(query: {
  id: string
  title: string
  status: ManualDrmStatus | null
}) {
  validateDrmIdentity(query)
  await writeDrmOverride(query, query.status)
  loading ||= readCache()
  await loading
  const key = reportKey(query)
  const report =
    (await readConfirmed(key)) || reports.get(key) || emptyReport(query)
  return withOverride(report, await readDrmOverride(query))
}
function validReport(key: string, report: ReleaseDrmReport) {
  return (
    /^[a-f0-9]{64}$/.test(key) &&
    report?.platform === 'PC' &&
    typeof report.title === 'string' &&
    report.title.length <= 300 &&
    typeof report.id === 'string' &&
    /^[a-z0-9._~-]{1,200}$/i.test(report.id) &&
    key === reportKey(report) &&
    Number.isFinite(Date.parse(report.checkedAt)) &&
    (report.lastAttemptAt === undefined ||
      Number.isFinite(Date.parse(report.lastAttemptAt))) &&
    (report.warning === undefined || typeof report.warning === 'string') &&
    (report.stale === undefined || typeof report.stale === 'boolean') &&
    Array.isArray(report.sources) &&
    report.sources.length <= 24 &&
    report.sources.every(
      (source) =>
        source &&
        Object.hasOwn(releaseDrmSourceLabels, source.name) &&
        (!source.status || Object.hasOwn(releaseDrmLabels, source.status)) &&
        (!source.availability || source.availability === 'listed') &&
        (source.requiresVerification === undefined ||
          typeof source.requiresVerification === 'boolean') &&
        typeof source.url === 'string' &&
        [
          'title',
          'protection',
          'crackDate',
          'group',
          'reportedAt',
          'category',
          'observedAt',
          'notice'
        ].every((field) => {
          const value = source[field as keyof typeof source]
          return (
            value === undefined ||
            (typeof value === 'string' && value.length <= 1000)
          )
        }) &&
        safeDrmSourceUrl(source.url)
    ) &&
    combinedDrmStatus(report.sources) === report.status
  )
}
export async function openReleaseDrmSource(query: {
  id: string
  title: string
  url: string
  source: import('common/releaseDrm').InteractiveDrmSource
}) {
  validateDrmIdentity(query)
  if (
    !['HizSearch', 'SkidrowReloaded'].includes(query.source) ||
    !safeDrmSourceUrl(query.url) ||
    new URL(query.url).hostname !==
      (query.source === 'HizSearch'
        ? 'hizsearch.pages.dev'
        : 'www.skidrowreloaded.com')
  )
    throw new Error('Fonte inválida para liberar acesso.')
  const source = await (
    await import('./drmManual')
  ).readSourceWithUserAccess(query.title, query.url, query.source)
  loading ||= readCache()
  await loading
  const key = reportKey(query)
  const previous =
    reports.get(key) || (await readConfirmed(key)) || emptyReport(query)
  const continuity = preserveDrmSources(
    [...previous.sources.filter((item) => item.name !== query.source), source],
    previous.sources
  )
  const sources = continuity.sources
  const warning = sources
    .filter(
      (item) =>
        item.notice &&
        /indisponível|manutenção|verificação|limite temporário/i.test(
          item.notice
        )
    )
    .map((item) => `${releaseDrmSourceLabels[item.name]}: ${item.notice}`)
    .join(' ')
  const report: ReleaseDrmReport = {
    ...previous,
    sources,
    status: combinedDrmStatus(sources),
    warning: warning || undefined,
    ...(continuity.preserved ? { stale: true } : {})
  }
  reports.set(key, report)
  await persist(key, report)
  return withOverride(report, await readDrmOverride(query))
}
async function readConfirmed(key: string) {
  try {
    const text = await readFile(
      join(confirmedDirectory(), key + '.json'),
      'utf8'
    )
    if (text.length > 256 * 1024) return undefined
    const report = JSON.parse(text) as ReleaseDrmReport
    return validReport(key, report) && isConfirmedDrmReport(report)
      ? report
      : undefined
  } catch {
    return undefined
  }
}
async function saveConfirmed(key: string, report: ReleaseDrmReport) {
  const target = join(confirmedDirectory(), key + '.json')
  if (isConfirmedDrmReport(report)) {
    await mkdir(confirmedDirectory(), { recursive: true })
    await writeFile(target + '.tmp', JSON.stringify(report), 'utf8')
    await rename(target + '.tmp', target)
  } else {
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}
async function readCache() {
  try {
    const text = await readFile(file(), 'utf8')
    if (text.length > 2 * 1024 * 1024) return
    const data = JSON.parse(text)
    if (!Array.isArray(data) || data.length > 500) return
    for (const entry of data) {
      const report = entry?.report as ReleaseDrmReport
      if (validReport(entry?.key || '', report)) {
        reports.set(entry.key, report)
        // Migrate previous confirmed results before the rolling cache can evict them.
        if (isConfirmedDrmReport(report) && !(await readConfirmed(entry.key)))
          await saveConfirmed(entry.key, report).catch(() => undefined)
      }
    }
  } catch {
    /* Catalogue and saved follows remain usable if this optional cache fails. */
  }
}
async function persist(key: string, report: ReleaseDrmReport) {
  writer = writer
    .catch(() => undefined)
    .then(async () => {
      await mkdir(directory(), { recursive: true })
      await writeFile(
        join(directory(), 'drm-cache.tmp'),
        JSON.stringify(
          [...reports].slice(-500).map(([key, report]) => ({ key, report }))
        ),
        'utf8'
      )
      await rename(join(directory(), 'drm-cache.tmp'), file())
      // One file per confirmed game: confirmations survive the 500-entry rolling cache.
      await saveConfirmed(key, report)
    })
  await writer
}

async function readGame(url: string) {
  // Public metadata needs no login cookies or persistent site scripts. Our validated
  // report cache is kept separately, so an old service worker cannot poison reads.
  const partition = session.fromPartition('ghost-drm-metadata-v1')
  if (!sourceReady) {
    partition.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false)
    )
    partition.webRequest.onBeforeRequest((details, callback) => {
      const host = new URL(details.url).hostname
      callback({
        cancel:
          ![
            'isitcracked.com',
            'cdn.isitcracked.com',
            'lhvknkrfhehcclzlabsl.supabase.co',
            'bopxedkcjdpeiysqlsmn.supabase.co'
          ].includes(host) ||
          ['image', 'media', 'font'].includes(details.resourceType)
      })
    })
    sourceReady = true
  }
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      session: partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })
  window.webContents.setAudioMuted(true)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const guard = (event: Electron.Event, target: string) => {
    if (new URL(target).origin !== 'https://isitcracked.com')
      event.preventDefault()
  }
  window.webContents.on('will-navigate', guard)
  window.webContents.on('will-redirect', guard)
  const deadline = setTimeout(() => {
    if (!window.isDestroyed()) window.destroy()
  }, 25000)
  try {
    await window.loadURL(url)
    for (let attempt = 0; attempt < 60; attempt++) {
      const data = await window.webContents.executeJavaScript(`(() => {
        const heading = document.querySelector('h1');
        if (/game not found|couldn't find this game|game does not exist/i.test(document.body?.innerText || '')) return {title:'Game not found'};
        if (!heading) return undefined;
        const info = heading.parentElement?.parentElement;
        const allowed = /^(cracked|uncracked|unreleased|hypervisor|bypassed|drm free|drm removed|early access)$/i;
        const status = Array.from(info?.querySelectorAll('span') || []).map(e => e.textContent.trim()).find(text => allowed.test(text));
        const field = name => {
          const label = Array.from(document.querySelectorAll('span')).find(e=>e.textContent.trim().toLowerCase()===name.toLowerCase());
          return label?.parentElement?.parentElement?.querySelector('p')?.textContent?.trim();
        };
        return {title:heading.textContent.trim(),status,protection:field('DRM Protection'),crackDate:field('Crack Date'),group:field('Scene Group')};
      })()`)
      if (data?.status || (data?.title && /not found/i.test(data.title)))
        return data
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    throw new Error('IsItCracked não forneceu um status legível.')
  } finally {
    clearTimeout(deadline)
    if (!window.isDestroyed()) window.destroy()
  }
}

async function readMatchingGame(title: string) {
  for (const alias of drmTitleAliases(title)) {
    const url = 'https://isitcracked.com/game/' + drmGameSlug(alias)
    const value = await readGame(url)
    if (normalizeDrmTitle(value?.title || '') === normalizeDrmTitle(title)) {
      const source = parseIsItCracked(value, title, url)
      if (source) return source
    }
  }
  return undefined
}

export async function getReleaseDrm(query: {
  id: string
  title: string
  refresh?: boolean
  priority?: boolean
  manual?: 'general' | 'hiz'
}): Promise<ReleaseDrmReport> {
  if (
    !query ||
    typeof query.id !== 'string' ||
    !/^[a-z0-9._~-]{1,200}$/i.test(query.id) ||
    typeof query.title !== 'string' ||
    !query.title.trim() ||
    query.title.length > 300 ||
    (query.refresh !== undefined && typeof query.refresh !== 'boolean') ||
    (query.priority !== undefined && typeof query.priority !== 'boolean') ||
    (query.manual !== undefined &&
      (!['general', 'hiz'].includes(query.manual) || query.refresh !== true)) ||
    [...query.title].some((character) => character.charCodeAt(0) < 32)
  )
    throw new Error('Jogo inválido para consulta de DRM.')
  loading ||= readCache()
  await loading
  const key = reportKey(query)
  const saved = (await readConfirmed(key)) || reports.get(key)
  const override = await readDrmOverride(query)
  if (
    override &&
    !query.refresh &&
    ['cracked', 'drm-free'].includes(override.status)
  )
    return withOverride(saved || emptyReport(query), override)
  if (
    saved &&
    !query.refresh &&
    ((!override && isConfirmedDrmReport(saved)) ||
      (saved.lookupVersion === lookupVersion &&
        Date.now() - Date.parse(saved.lastAttemptAt || saved.checkedAt) <
          15 * 60000))
  )
    return withOverride(saved, override)
  return queue
    .run(
      query.manual ? `${key}:manual:${query.manual}` : key,
      async () => {
        if (query.manual === 'hiz') {
          const current = reports.get(key) || saved
          if (!current)
            throw new Error('Faça primeiro a verificação geral de DRM.')
          const source = await (
            await import('./drmManual')
          ).readHizManualSource(query.title)
          let sources = [
            ...current.sources.filter((item) => item.name !== 'HizSearch'),
            source
          ]
          const continuity = preserveDrmSources(sources, current.sources)
          sources = continuity.sources
          const report = {
            ...current,
            sources,
            status: combinedDrmStatus(sources),
            ...(continuity.preserved ? { stale: true } : {})
          }
          reports.set(key, report)
          await persist(key, report)
          return report
        }
        const search = crackWatchSearchUrl(query.title)
        const results = await Promise.allSettled([
          readMatchingGame(query.title),
          readCrackWatch(query.title, query.refresh),
          getCrackWatchSheetSources(query.title, query.refresh),
          readCrackWatchIndex(query.title, query.refresh),
          getAdditionalDrmSources(
            query.title,
            query.refresh,
            query.manual === 'general'
          )
        ])
        const primary =
          results[0].status === 'fulfilled' ? results[0].value : undefined
        const community =
          results[1].status === 'fulfilled' ? results[1].value : []
        const sheet =
          results[2].status === 'fulfilled' ? results[2].value : undefined
        const index = results[3].status === 'fulfilled' ? results[3].value : []
        const additional =
          results[4].status === 'fulfilled' ? results[4].value : []
        const sources = [
          primary || {
            name: 'IsItCracked' as const,
            url: 'https://isitcracked.com/games'
          },
          ...community,
          ...(!community.length
            ? [
                {
                  name: 'CrackWatch' as const,
                  url: search,
                  notice:
                    results[1].status === 'rejected'
                      ? String(
                          results[1].reason instanceof Error
                            ? results[1].reason.message
                            : 'Reddit indisponível.'
                        ).slice(0, 1000)
                      : undefined
                }
              ]
            : []),
          ...(sheet?.sources.length
            ? sheet.sources
            : [
                {
                  name: 'CrackWatchSheet' as const,
                  url: drmSheetUrl('737179558')
                }
              ]),
          ...(index.length
            ? index
            : [{ name: 'CrackWatchIndex' as const, url: CRACKWATCH_INDEX }]),
          ...additional
        ]
        const warning = [
          ...results
            .filter((result) => result.status === 'rejected')
            .map((result) => {
              const reason: unknown = result.reason
              return reason instanceof Error
                ? reason.message
                : 'Fonte indisponível.'
            }),
          ...(sheet?.warning ? [sheet.warning] : []),
          ...additional
            .filter(
              (source) =>
                source.name !== 'HizSearch' &&
                source.notice &&
                /indisponível|manutenção|verificação|não forneceu/i.test(
                  source.notice
                )
            )
            .map(
              (source) =>
                `${releaseDrmSourceLabels[source.name]}: ${source.notice}`
            ),
          ...(!primary
            ? ['IsItCracked: título ou status não confirmado para este jogo.']
            : [])
        ]
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(' ')
        let report: ReleaseDrmReport = {
          id: query.id,
          title: query.title,
          platform: 'PC',
          checkedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
          status: combinedDrmStatus(sources),
          sources,
          lookupVersion,
          ...(sheet?.stale ? { stale: true } : {}),
          ...(warning ? { warning } : {})
        }
        // A blocked or changed page cannot replace previously confirmed source evidence.
        const previous = reports.get(key) || saved
        if (previous) {
          const continuity = preserveDrmSources(sources, previous.sources)
          if (continuity.preserved) {
            report = {
              ...report,
              sources: continuity.sources,
              stale: true,
              checkedAt: previous.checkedAt
            }
            report.status = combinedDrmStatus(report.sources)
          }
        }
        reports.delete(key)
        reports.set(key, report)
        if (reports.size > 500) reports.delete(reports.keys().next().value!)
        try {
          await persist(key, report)
        } catch {
          report.warning = [
            report.warning,
            'Falha ao guardar a consulta de DRM.'
          ]
            .filter(Boolean)
            .join(' ')
        }
        return report
      },
      query.priority
    )
    .then(async (report) => withOverride(report, await readDrmOverride(query)))
}
