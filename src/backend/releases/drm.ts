import { BrowserWindow, session, net, app } from 'electron'
import { mkdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import type { ReleaseDrmReport } from 'common/releaseDrm'
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
import { parseIsItCracked, parseCrackWatch } from './drmParser'
import { getCrackWatchSheetSources } from './drmSheets'
import {
  CRACKWATCH_INDEX,
  drmSheetUrl,
  parseCrackWatchIndex
} from './drmCommunityParser'
import { DrmLookupQueue } from './drmQueue'
import { getAdditionalDrmSources } from './drmSites'

const reports = new Map<string, ReleaseDrmReport>()
const queue = new DrmLookupQueue<ReleaseDrmReport>()
let loading: Promise<void> | null = null
let sourceReady = false
let redditUnavailableUntil = 0
const lookupVersion = 3
let indexRead: Promise<unknown> | undefined
let indexCheckedAt = 0
let indexValue: unknown
let writer: Promise<unknown> = Promise.resolve()
const directory = () => join(app.getPath('userData'), 'releases')
const file = () => join(directory(), 'drm-cache.json')
const confirmedDirectory = () => join(directory(), 'drm-confirmed')
const reportKey = (report: Pick<ReleaseDrmReport, 'id' | 'title'>) =>
  createHash('sha256')
    .update(report.id + ':' + report.title)
    .digest('hex')
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

async function redditJson(url: string) {
  if (Date.now() < redditUnavailableUntil)
    throw new Error(
      'Reddit · CrackWatch indisponível nesta conexão; consulte o link da fonte.'
    )
  const response = await net.fetch(url, {
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
    credentials: 'omit',
    headers: { 'User-Agent': 'Ghost-Launcher/0.3 (public DRM metadata)' }
  })
  if (!response.ok) {
    if ([401, 403, 429].includes(response.status))
      redditUnavailableUntil = Date.now() + 60 * 60 * 1000
    throw new Error(
      `Reddit · CrackWatch não permitiu a consulta (HTTP ${response.status}).`
    )
  }
  const text = await response.text()
  if (text.length > 2 * 1024 * 1024)
    throw new Error('Resposta do CrackWatch muito grande.')
  return JSON.parse(text)
}

async function readIndex(title: string, refresh = false) {
  if (!indexRead && (refresh || Date.now() - indexCheckedAt >= 15 * 60000)) {
    indexRead = redditJson(
      CRACKWATCH_INDEX.replace(/\/$/, '.json?raw_json=1&limit=1')
    )
    try {
      indexValue = await indexRead
      indexCheckedAt = Date.now()
    } finally {
      indexRead = undefined
    }
  } else if (indexRead) await indexRead
  return parseCrackWatchIndex(indexValue, title)
}

async function readReddit(title: string) {
  const url = new URL('https://www.reddit.com/r/CrackWatch/search.json')
  url.searchParams.set(
    'q',
    drmTitleAliases(title)
      .map((alias) => '"' + alias + '"')
      .join(' OR ')
  )
  url.searchParams.set('restrict_sr', 'on')
  url.searchParams.set('sort', 'new')
  url.searchParams.set('limit', '25')
  url.searchParams.set('type', 'link')
  return parseCrackWatch(await redditJson(url.href), title)
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
  if (
    saved &&
    !query.refresh &&
    (isConfirmedDrmReport(saved) ||
      (saved.lookupVersion === lookupVersion &&
        Date.now() - Date.parse(saved.checkedAt) < 15 * 60000))
  )
    return saved
  return queue.run(
    query.manual ? `${key}:manual:${query.manual}` : key,
    async () => {
      if (query.manual === 'hiz') {
        const current = reports.get(key) || saved
        if (!current)
          throw new Error('Faça primeiro a verificação geral de DRM.')
        const source = await (
          await import('./drmManual')
        ).readHizManualSource(query.title)
        const sources = [
          ...current.sources.filter((item) => item.name !== 'HizSearch'),
          source
        ]
        // A failed verification cannot erase older evidence from this source.
        const previous = current.sources.find(
          (item) => item.name === 'HizSearch' && item.status
        )
        if (source.notice && !source.status && previous)
          Object.assign(source, previous, {
            notice: source.notice,
            requiresVerification: source.requiresVerification
          })
        const report = {
          ...current,
          sources,
          status: combinedDrmStatus(sources)
        }
        reports.set(key, report)
        await persist(key, report)
        return report
      }
      const search = new URL('https://www.reddit.com/r/CrackWatch/search/')
      search.searchParams.set('q', query.title)
      search.searchParams.set('restrict_sr', 'on')
      search.searchParams.set('sort', 'new')
      const results = await Promise.allSettled([
        readMatchingGame(query.title),
        readReddit(query.title),
        getCrackWatchSheetSources(query.title, query.refresh),
        readIndex(query.title, query.refresh),
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
          ? [{ name: 'CrackWatch' as const, url: search.href }]
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
        status: combinedDrmStatus(sources),
        sources,
        lookupVersion,
        ...(sheet?.stale ? { stale: true } : {}),
        ...(warning ? { warning } : {})
      }
      // A blocked or changed page cannot replace previously confirmed source evidence.
      if (saved && warning) {
        const preserved = saved.sources.filter(
          (source) =>
            (source.status || source.protection) &&
            !sources.some(
              (current) =>
                current.name === source.name &&
                (current.status || current.protection)
            )
        )
        if (preserved.length) {
          report = {
            ...report,
            sources: [
              ...sources.filter(
                (source) => !preserved.some((old) => old.name === source.name)
              ),
              ...preserved
            ].slice(0, 24),
            stale: true,
            checkedAt: saved.checkedAt
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
        report.warning = [report.warning, 'Falha ao guardar a consulta de DRM.']
          .filter(Boolean)
          .join(' ')
      }
      return report
    },
    query.priority
  )
}
