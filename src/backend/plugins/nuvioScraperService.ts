import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'fs'
import path from 'path'
import vm from 'vm'
import { app, net } from 'electron'
import * as cheerio from 'cheerio'
import type {
  NuvioScraperEntry,
  StremioAddonManifest,
  StremioStreamItem
} from 'common/types/plugins'
import { logInfo, logWarning, LogPrefix } from 'backend/logger'

const SCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const SCRIPT_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const SCRAPER_TIMEOUT_MS = 8_000
const SCRIPT_EVAL_TIMEOUT_MS = 3_000
const MAX_CONCURRENCY = 8
const MAX_META_CACHE = 400
const MAX_SCRIPT_MEM_CACHE = 100
const CINEMETA_BASE = 'https://v3-cinemeta.strem.io'

interface ResolvedMediaTarget {
  tmdbId: string
  mediaType: 'movie' | 'tv'
  season?: number
  episode?: number
  imdbId?: string
  title?: string
  year?: string
}

export interface NuvioScraperServiceDeps {
  cacheDir?: string
  alazterflixDataPath?: string
  fetchFn?: typeof fetch
  tmdbTokenOverride?: string
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^172\.(1[6-9]|2\d|3[0-1])\./
]

export function isAllowedScraperUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.replace(/^\[|\]$/g, '')
    if (!host || PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) return false
    return true
  } catch {
    return false
  }
}

function isAllowedFetchUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.replace(/^\[|\]$/g, '')
    if (!host || PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) return false
    return true
  } catch {
    return false
  }
}

function detectQuality(raw: any): string {
  const text = `${raw?.quality || ''} ${raw?.name || ''} ${raw?.title || ''} ${raw?.description || ''}`
  if (/4k|2160p|uhd/i.test(text)) return '4K'
  if (/1080p|fhd|full\s*hd/i.test(text)) return '1080p'
  if (/720p/i.test(text)) return '720p'
  if (/480p|sd/i.test(text)) return '480p'
  return typeof raw?.quality === 'string' && raw.quality.trim()
    ? raw.quality.trim()
    : 'HD'
}

export function normalizeNuvioStream(
  raw: any,
  scraper: NuvioScraperEntry
): StremioStreamItem | null {
  if (!raw || typeof raw !== 'object') return null

  const rawUrl = typeof raw.url === 'string' ? raw.url.trim() : ''
  let infoHash =
    typeof raw.infoHash === 'string' && raw.infoHash.trim()
      ? raw.infoHash.trim().toLowerCase()
      : undefined
  let magnetUrl =
    typeof raw.magnetUrl === 'string' && raw.magnetUrl.trim()
      ? raw.magnetUrl.trim()
      : undefined

  let directUrl: string | undefined
  if (rawUrl.startsWith('magnet:')) {
    magnetUrl = rawUrl
    if (!infoHash) {
      const m = rawUrl.match(/btih:([a-f0-9]{32,40})/i)
      if (m) infoHash = m[1].toLowerCase()
    }
  } else if (/^https?:\/\//i.test(rawUrl)) {
    directUrl = rawUrl
  }

  if (!directUrl && !infoHash && !magnetUrl) return null

  const customHeaders: Record<string, string> = {
    ...(raw.headers && typeof raw.headers === 'object' ? raw.headers : {}),
    ...(raw.behaviorHints?.headers && typeof raw.behaviorHints.headers === 'object'
      ? raw.behaviorHints.headers
      : {}),
    ...(raw.behaviorHints?.proxyHeaders?.request &&
    typeof raw.behaviorHints.proxyHeaders.request === 'object'
      ? raw.behaviorHints.proxyHeaders.request
      : {})
  }

  const hasHeaders = Object.keys(customHeaders).length > 0
  const quality = detectQuality(raw)
  const parts = [
    raw.title || raw.name || raw.description || '',
    raw.language && !String(raw.title || raw.name || '').includes(raw.language)
      ? raw.language
      : '',
    raw.size && !String(raw.title || raw.name || '').includes(raw.size)
      ? raw.size
      : ''
  ].filter(Boolean)

  const fileIdx =
    typeof raw.fileIdx === 'number' && Number.isFinite(raw.fileIdx)
      ? raw.fileIdx
      : undefined

  return {
    name: raw.name || scraper.name,
    title: raw.title || raw.name || scraper.name,
    url: directUrl,
    infoHash,
    fileIdx,
    magnetUrl,
    quality,
    details: parts.join(' · ') || `${scraper.name} (${quality})`,
    addonName: `${scraper.name} · Nuvio`,
    addonId: scraper.id,
    behaviorHints: hasHeaders
      ? {
          ...(raw.behaviorHints || {}),
          headers: customHeaders
        }
      : raw.behaviorHints
  }
}

export class NuvioScraperService {
  private readonly deps: NuvioScraperServiceDeps
  private readonly metaCache = new Map<string, ResolvedMediaTarget | null>()
  private readonly scriptMemCache = new Map<string, { code: string; fetchedAt: number }>()
  private cachedTmdbToken: { mtimeMs: number; token: string } | null = null

  constructor(deps: NuvioScraperServiceDeps = {}) {
    this.deps = deps
  }

  private getCacheDir(): string {
    return (
      this.deps.cacheDir || path.join(app.getPath('userData'), 'nuvio_scrapers_cache')
    )
  }

  private getAlazterflixDataPath(): string {
    return (
      this.deps.alazterflixDataPath ||
      path.join(app.getPath('userData'), 'plugins', 'data', 'alazterflix.json')
    )
  }

  private getFetchFn(): typeof fetch {
    return this.deps.fetchFn || (net.fetch.bind(net) as typeof fetch)
  }

  private readUserTmdbToken(): string {
    if (this.deps.tmdbTokenOverride !== undefined) {
      return this.deps.tmdbTokenOverride
    }
    try {
      const dataPath = this.getAlazterflixDataPath()
      if (!existsSync(dataPath)) return ''
      const stats = statSync(dataPath)
      if (this.cachedTmdbToken && this.cachedTmdbToken.mtimeMs === stats.mtimeMs) {
        return this.cachedTmdbToken.token
      }
      const parsed = JSON.parse(readFileSync(dataPath, 'utf-8'))
      const token =
        typeof parsed?.metadata_settings?.tmdbToken === 'string'
          ? parsed.metadata_settings.tmdbToken.trim()
          : ''
      this.cachedTmdbToken = { mtimeMs: stats.mtimeMs, token }
      return token
    } catch {
      return ''
    }
  }

  private setMetaCache(key: string, val: ResolvedMediaTarget | null): void {
    if (this.metaCache.size >= MAX_META_CACHE) {
      const oldest = this.metaCache.keys().next().value
      if (oldest !== undefined) this.metaCache.delete(oldest)
    }
    this.metaCache.set(key, val)
  }

  private setScriptMemCache(url: string, code: string): void {
    if (this.scriptMemCache.size >= MAX_SCRIPT_MEM_CACHE) {
      const oldest = this.scriptMemCache.keys().next().value
      if (oldest !== undefined) this.scriptMemCache.delete(oldest)
    }
    this.scriptMemCache.set(url, { code, fetchedAt: Date.now() })
  }

  async resolveMediaTarget(
    type: string,
    id: string
  ): Promise<ResolvedMediaTarget | null> {
    const cacheKey = `${type}:${id}`
    if (this.metaCache.has(cacheKey)) {
      return this.metaCache.get(cacheKey) || null
    }

    const mediaType: 'movie' | 'tv' =
      type === 'series' || type === 'anime' || type === 'tv' ? 'tv' : 'movie'
    const parts = String(id || '').split(':')
    let baseId = parts[0] || ''
    let season: number | undefined
    let episode: number | undefined

    if (baseId.toLowerCase() === 'tmdb' && parts.length >= 2) {
      const tmdbId = parts[1]
      if (parts.length >= 4) {
        season = Number(parts[2])
        episode = Number(parts[3])
      }
      const resolved: ResolvedMediaTarget = {
        tmdbId,
        mediaType,
        season: Number.isInteger(season) ? season : undefined,
        episode: Number.isInteger(episode) ? episode : undefined
      }
      this.setMetaCache(cacheKey, resolved)
      return resolved
    }

    if (parts.length >= 3 && /^tt\d+$/i.test(baseId)) {
      season = Number(parts[1])
      episode = Number(parts[2])
    }

    // Resolve IMDb ID -> TMDB ID via Cinemeta (free, no key needed)
    if (/^tt\d+$/i.test(baseId)) {
      try {
        const cinemetaType = mediaType === 'tv' ? 'series' : 'movie'
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        try {
          const res = await this.getFetchFn()(
            `${CINEMETA_BASE}/meta/${cinemetaType}/${encodeURIComponent(baseId)}.json`,
            { signal: controller.signal }
          )
          if (res.ok) {
            const data = await res.json()
            const meta = data?.meta
            if (meta?.moviedb_id) {
              const resolved: ResolvedMediaTarget = {
                tmdbId: String(meta.moviedb_id),
                mediaType,
                season: Number.isInteger(season) ? season : undefined,
                episode: Number.isInteger(episode) ? episode : undefined,
                imdbId: baseId,
                title: meta.name || undefined,
                year: meta.year ? String(meta.year).slice(0, 4) : undefined
              }
              this.setMetaCache(cacheKey, resolved)
              return resolved
            }
          }
        } finally {
          clearTimeout(timer)
        }
      } catch {}
    }

    this.setMetaCache(cacheKey, null)
    return null
  }

  private async loadScraperScript(url: string): Promise<string | null> {
    if (!isAllowedScraperUrl(url)) return null

    const mem = this.scriptMemCache.get(url)
    if (mem && Date.now() - mem.fetchedAt < SCRIPT_CACHE_TTL_MS) {
      return mem.code
    }

    const cacheDir = this.getCacheDir()
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 24)
    const diskPath = path.join(cacheDir, `${hash}.js`)

    try {
      if (existsSync(diskPath)) {
        const st = statSync(diskPath)
        if (
          Date.now() - st.mtimeMs < SCRIPT_CACHE_TTL_MS &&
          st.size > 0 &&
          st.size <= SCRIPT_MAX_BYTES
        ) {
          const cached = readFileSync(diskPath, 'utf-8')
          this.setScriptMemCache(url, cached)
          return cached
        }
      }
    } catch {}

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await this.getFetchFn()(url, { signal: controller.signal })
      if (!res.ok) return null
      const code = await res.text()
      if (!code || code.length > SCRIPT_MAX_BYTES) return null

      try {
        if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })
        const tmpPath = `${diskPath}.${process.pid}.${Date.now()}.tmp`
        writeFileSync(tmpPath, code, 'utf-8')
        renameSync(tmpPath, diskPath)
      } catch {}

      this.setScriptMemCache(url, code)
      return code
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private createSandboxedFetch(
    target: ResolvedMediaTarget,
    tmdbToken: string,
    parentSignal: AbortSignal
  ): typeof fetch {
    const rawFetch = this.getFetchFn()
    const isV4Token = tmdbToken.includes('.') || tmdbToken.length > 40

    return (async (input: any, init?: RequestInit) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input?.url || String(input)

      if (!isAllowedFetchUrl(urlStr)) {
        throw new Error('URL bloqueada pelo sandbox do Ghost.')
      }

      // Adapt TMDB v3 ?api_key= calls to TMDB v4 Bearer token or Cinemeta fallback
      if (urlStr.startsWith('https://api.themoviedb.org/3/')) {
        if (!tmdbToken) {
          const yearStr = target.year || '2020'
          const fallbackPayload = {
            id: Number(target.tmdbId) || 0,
            imdb_id: target.imdbId || '',
            title: target.title || '',
            original_title: target.title || '',
            name: target.title || '',
            original_name: target.title || '',
            release_date: `${yearStr}-01-01`,
            first_air_date: `${yearStr}-01-01`,
            external_ids: { imdb_id: target.imdbId || '' },
            alternative_titles: { titles: [], results: [] }
          }
          return new Response(JSON.stringify(fallbackPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        if (isV4Token) {
          const parsed = new URL(urlStr)
          parsed.searchParams.delete('api_key')
          const mergedHeaders = new Headers(init?.headers || {})
          mergedHeaders.set('Authorization', `Bearer ${tmdbToken}`)
          return rawFetch(parsed.toString(), {
            ...init,
            headers: mergedHeaders,
            signal: init?.signal || parentSignal
          })
        }
      }

      return rawFetch(input, {
        ...init,
        signal: init?.signal || parentSignal
      })
    }) as typeof fetch
  }

  private async runSingleScraper(
    scraper: NuvioScraperEntry,
    target: ResolvedMediaTarget,
    tmdbToken: string
  ): Promise<StremioStreamItem[]> {
    const code = await this.loadScraperScript(scraper.filename)
    if (!code) return []

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS)

    try {
      const mod: { exports: any } = { exports: {} }
      const sandboxedFetch = this.createSandboxedFetch(
        target,
        tmdbToken,
        controller.signal
      )

      const ctx = vm.createContext({
        module: mod,
        exports: mod.exports,
        require: (modName: string) => {
          if (
            modName === 'cheerio-without-node-native' ||
            modName === 'cheerio'
          ) {
            return cheerio
          }
          throw new Error(`Módulo bloqueado no sandbox Nuvio: ${modName}`)
        },
        SCRAPER_ID: scraper.id,
        TMDB_API_KEY: tmdbToken || 'ghost-cinemeta-fallback',
        fetch: sandboxedFetch,
        URL,
        URLSearchParams,
        Headers,
        Response,
        Request,
        AbortController,
        TextEncoder,
        TextDecoder,
        atob,
        btoa,
        Buffer,
        setTimeout,
        clearTimeout,
        console: {
          log: () => {},
          warn: () => {},
          error: () => {},
          info: () => {},
          debug: () => {}
        }
      })
      ctx.globalThis = ctx
      ctx.self = ctx

      vm.runInContext(code, ctx, { timeout: SCRIPT_EVAL_TIMEOUT_MS })

      const getStreamsFn =
        typeof mod.exports?.getStreams === 'function'
          ? mod.exports.getStreams
          : typeof mod.exports?.default?.getStreams === 'function'
            ? mod.exports.default.getStreams
            : null
      if (!getStreamsFn) return []

      const executionPromise = Promise.resolve(
        target.mediaType === 'tv'
          ? getStreamsFn(target.tmdbId, 'tv', target.season || 1, target.episode || 1)
          : getStreamsFn(target.tmdbId, 'movie')
      )

      const timeoutPromise = new Promise<any[]>((resolve) => {
        const onAbort = () => resolve([])
        controller.signal.addEventListener('abort', onAbort, { once: true })
      })

      const rawStreams = await Promise.race([executionPromise, timeoutPromise])
      if (!Array.isArray(rawStreams)) return []

      const normalized: StremioStreamItem[] = []
      for (const rs of rawStreams) {
        const item = normalizeNuvioStream(rs, scraper)
        if (item) normalized.push(item)
      }
      return normalized
    } catch {
      return []
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async getStreamsFromAddons(
    addons: StremioAddonManifest[],
    type: string,
    id: string
  ): Promise<StremioStreamItem[]> {
    const nuvioAddons = (addons || []).filter(
      (a) =>
        a &&
        a.isEnabled !== false &&
        a.pluginFormat === 'nuvio-scrapers' &&
        Array.isArray(a.scrapers) &&
        a.scrapers.length > 0
    )
    if (nuvioAddons.length === 0) return []

    const target = await this.resolveMediaTarget(type, id)
    if (!target) {
      logWarning(
        `[NuvioScrapers] Não foi possível resolver TMDB ID para ${type}/${id}.`,
        LogPrefix.Backend
      )
      return []
    }

    const scrapers: NuvioScraperEntry[] = []
    for (const addon of nuvioAddons) {
      for (const s of addon.scrapers || []) {
        if (s.enabled === false || !s.filename) continue
        const types = Array.isArray(s.supportedTypes) ? s.supportedTypes : ['movie', 'tv']
        const supportsTarget =
          types.includes(target.mediaType) ||
          (target.mediaType === 'tv' && (types.includes('series') || types.includes('anime')))
        if (supportsTarget) scrapers.push(s)
      }
    }

    if (scrapers.length === 0) return []

    const tmdbToken = this.readUserTmdbToken()
    logInfo(
      `[NuvioScrapers] Consultando ${scrapers.length} fonte(s) Nuvio para ${target.mediaType} TMDB ${target.tmdbId}${target.season ? ` S${target.season}E${target.episode}` : ''}...`,
      LogPrefix.Backend
    )

    const results: StremioStreamItem[] = []
    const seen = new Set<string>()
    let cursor = 0
    const workerCount = Math.min(MAX_CONCURRENCY, scrapers.length)

    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < scrapers.length) {
        const scraper = scrapers[cursor++]
        const found = await this.runSingleScraper(scraper, target, tmdbToken)
        for (const stream of found) {
          const dedupeKey = stream.infoHash || stream.url || stream.magnetUrl || ''
          if (dedupeKey && seen.has(dedupeKey)) continue
          if (dedupeKey) seen.add(dedupeKey)
          results.push(stream)
        }
      }
    })

    await Promise.all(workers)
    return results
  }
}

let singleton: NuvioScraperService | null = null

export function getNuvioScraperService(): NuvioScraperService {
  if (!singleton) {
    singleton = new NuvioScraperService()
  }
  return singleton
}
