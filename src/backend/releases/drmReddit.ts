import { BrowserWindow, session } from 'electron'
import { drmTitleAliases, type ReleaseDrmSource } from 'common/releaseDrm'
import { CRACKWATCH_INDEX, parseCrackWatchIndex } from './drmCommunityParser'
import { isCrackWatchGame, parseCrackWatch } from './drmParser'
import {
  parseRedditPage,
  redditPostId,
  type RedditPage
} from './drmRedditParser'

const ttl = 15 * 60000
const pages = new Map<
  string,
  {
    expires: number
    refreshAfter: number
    pending: boolean
    value: Promise<RedditPage>
  }
>()
let ready = false
let tail: Promise<unknown> = Promise.resolve()
let lastRead = 0
let rateLimitedUntil = 0

export function crackWatchSearchUrl(title: string): string {
  const url = new URL('https://www.reddit.com/r/CrackWatch/search/')
  // Title-only search prevents daily discussions/repack bodies from burying announcements.
  url.searchParams.set(
    'q',
    '(' +
      drmTitleAliases(title)
        .map((alias) => `title:"${alias.replace(/["\\]/g, ' ')}"`)
        .join(' OR ') +
      ') AND NOT (title:update OR title:hotfix OR title:crackfix OR title:repack OR title:dlc OR flair:repack OR flair:discussion)'
  )
  url.searchParams.set('restrict_sr', 'on')
  url.searchParams.set('sort', 'new')
  url.searchParams.set('type', 'link')
  return url.href
}

async function readPage(url: string): Promise<RedditPage> {
  const target = new URL(url)
  if (
    target.origin !== 'https://www.reddit.com' ||
    (target.pathname !== '/r/CrackWatch/search/' && !redditPostId(url))
  )
    throw new Error('Endereço do CrackWatch inválido.')
  if (Date.now() < rateLimitedUntil)
    throw new Error(
      'Reddit: limite de consultas atingido. Tente novamente em alguns minutos.'
    )
  const delay = 1200 - (Date.now() - lastRead)
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  lastRead = Date.now()
  const partition = session.fromPartition('ghost-crackwatch-public-v1')
  if (!ready) {
    // Reddit translates scene names (e.g. voices38 -> vozes38) in pt-BR.
    // Keep source metadata in its original language; Ghost's UI stays in pt-BR.
    partition.setUserAgent(partition.getUserAgent(), 'en-US,en;q=0.9')
    partition.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false)
    )
    partition.on('will-download', (event) => event.preventDefault())
    partition.webRequest.onBeforeRequest((details, callback) => {
      const request = new URL(details.url)
      callback({
        cancel:
          request.protocol !== 'https:' ||
          !(
            request.hostname === 'www.reddit.com' ||
            request.hostname === 'redditstatic.com' ||
            request.hostname.endsWith('.redditstatic.com')
          ) ||
          ['image', 'media', 'font'].includes(details.resourceType)
      })
    })
    partition.webRequest.onHeadersReceived((details, callback) => {
      if (details.resourceType === 'mainFrame' && details.statusCode === 429) {
        const retry = Object.entries(details.responseHeaders || {}).find(
          ([name]) => name.toLowerCase() === 'retry-after'
        )?.[1]?.[0]
        const until =
          retry && /^\d+$/.test(retry)
            ? Date.now() + Number(retry) * 1000
            : Date.parse(retry || '')
        rateLimitedUntil = Math.max(
          rateLimitedUntil,
          Date.now() + 60000,
          Number.isFinite(until) ? until : 0
        )
      }
      callback({})
    })
    ready = true
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
  const guard = (event: Electron.Event, destination: string) => {
    const next = new URL(destination)
    if (next.origin !== target.origin || next.pathname !== target.pathname)
      event.preventDefault()
  }
  window.webContents.on('will-navigate', guard)
  window.webContents.on('will-redirect', guard)
  let responseCode = 0
  window.webContents.on('did-navigate', (_event, _url, code) => {
    responseCode = code
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        await window.loadURL(url)
        if (responseCode >= 400) {
          if (responseCode === 429)
            rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + 60000)
          throw new Error(
            `Reddit: consulta indisponível (HTTP ${responseCode}).`
          )
        }
        for (let attempt = 0; attempt < 15; attempt++) {
          const html: unknown = await window.webContents
            .executeJavaScript(`(() => {
            if (!document.querySelector('shreddit-post, [data-testid="search-results-filter-spacer"], [data-testid="search-post-unit"], search-results-page')) return undefined;
            const html = document.documentElement.outerHTML;
            return html.length <= 8 * 1024 * 1024 ? html : '';
          })()`)
          if (html !== undefined) {
            if (typeof html !== 'string')
              throw new Error('Reddit: resposta inválida.')
            return parseRedditPage(html, url)
          }
          await new Promise((resolve) => setTimeout(resolve, 400))
        }
        throw new Error(
          'Reddit: página indisponível, verificação exigida ou formato alterado. Consulte o link da fonte.'
        )
      })(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Reddit: tempo de consulta esgotado.')),
          22000
        )
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
    if (!window.isDestroyed()) window.destroy()
  }
}

function page(url: string, refresh = false): Promise<RedditPage> {
  const cached = pages.get(url)
  // Reuse simultaneous requests and recently fetched pages during a manual batch.
  if (
    cached &&
    (cached.pending ||
      (cached.expires > Date.now() &&
        (!refresh || cached.refreshAfter > Date.now())))
  )
    return cached.value
  const entry = {
    expires: Infinity,
    refreshAfter: Infinity,
    pending: true,
    value: Promise.resolve({ candidates: [] } as RedditPage)
  }
  entry.value = tail
    .catch(() => undefined)
    .then(() => readPage(url))
    .then(
      (value) => {
        entry.pending = false
        entry.expires = Date.now() + ttl
        entry.refreshAfter =
          Date.now() + (redditPostId(url) === 'p9ak4n' ? 60000 : 10000)
        return value
      },
      (error) => {
        entry.pending = false
        entry.expires = Date.now() + 60000
        entry.refreshAfter = entry.expires
        throw error
      }
    )
  tail = entry.value.catch(() => undefined)
  pages.delete(url)
  pages.set(url, entry)
  if (pages.size > 150) {
    const oldest = [...pages].find(([, item]) => !item.pending)
    if (oldest) pages.delete(oldest[0])
  }
  return entry.value
}

export async function readCrackWatch(
  title: string,
  refresh = false
): Promise<ReleaseDrmSource[]> {
  const search = await page(crackWatchSearchUrl(title), refresh)
  const aliases = drmTitleAliases(title)
  const candidates = search.candidates
    .filter((candidate) =>
      aliases.some((alias) => isCrackWatchGame(candidate.title, alias))
    )
    .slice(0, 3)
  const results: ReleaseDrmSource[] = []
  const failures: unknown[] = []
  for (const candidate of candidates) {
    let value: RedditPage
    try {
      value = await page(candidate.url, refresh)
    } catch (error) {
      failures.push(error)
      continue
    }
    for (const alias of aliases) {
      const sources = parseCrackWatch(
        { data: { children: [{ data: value.post }] } },
        alias
      )
      for (const source of sources)
        if (!results.some((item) => item.url === source.url))
          results.push(source)
    }
  }
  if (failures.length) {
    if (!results.length) throw failures[0]
    results[0].notice =
      'Algumas publicações não puderam ser consultadas; este anúncio foi verificado.'
  }
  return results
    .sort((a, b) => b.reportedAt!.localeCompare(a.reportedAt!))
    .slice(0, 3)
}

export async function readCrackWatchIndex(
  title: string,
  refresh = false
): Promise<ReleaseDrmSource[]> {
  const value = await page(
    CRACKWATCH_INDEX.replace('old.reddit.com', 'www.reddit.com'),
    refresh
  )
  return parseCrackWatchIndex(
    { data: { children: [{ data: value.post }] } },
    title
  )
}
