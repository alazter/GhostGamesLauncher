import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { inflateSync } from 'zlib'
import { app, net, safeStorage } from 'electron'
import type {
  StremioAccountStatus,
  StremioAddonManifest,
  StremioCalendarEpisode,
  StremioCalendarResult,
  StremioLibraryItem
} from 'common/types/plugins'
import { logInfo, logWarning, LogPrefix } from 'backend/logger'

const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours per series
const FETCH_TIMEOUT_MS = 12_000
const MAX_CONCURRENCY = 4
const STREMIO_API_BASE = 'https://api.strem.io/api'
const CINEMETA_BASE = 'https://v3-cinemeta.strem.io'
const KITSU_BASE = 'https://anime-kitsu.strem.fun'

interface RawStremioVideo {
  id?: string
  title?: string
  name?: string
  season?: number | string
  episode?: number | string
  number?: number | string
  released?: string
  firstAired?: string
  overview?: string
  description?: string
  thumbnail?: string
}

interface CachedSeriesVideo {
  videoId: string
  season: number
  episode: number
  episodeTitle: string
  overview?: string
  thumbnail?: string
  released: string
  dateKey: string
}

interface CachedSeriesSchedule {
  seriesId: string
  seriesType: string
  seriesName: string
  seriesPoster?: string
  seriesBackground?: string
  fetchedAt: number
  videos: CachedSeriesVideo[]
}

interface CalendarCacheFile {
  updatedAt: string
  series: Record<string, CachedSeriesSchedule>
}

interface StoredAccountFile {
  email: string
  authKeyEnc: string
  lastSyncAt?: string
  syncedItemsCount?: number
}

interface StoredLibraryItemInternal extends StremioLibraryItem {
  stremioWatchedBitfield?: string
}

export interface StremioServiceDeps {
  dataDir?: string
  fetchFn?: typeof fetch
  getAddons?: () => Promise<StremioAddonManifest[]>
  addAddon?: (manifestUrl: string) => Promise<{ success: boolean }>
  nowFn?: () => Date
}

function getDefaultDataDir(): string {
  return path.join(app.getPath('userData'), 'stremio_data')
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, filePath)
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback
    const raw = readFileSync(filePath, 'utf-8')
    if (!raw.trim()) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function encryptSecret(plain: string): string {
  try {
    if (safeStorage?.isEncryptionAvailable?.()) {
      return `enc:${safeStorage.encryptString(plain).toString('base64')}`
    }
  } catch {}
  return `b64:${Buffer.from(plain, 'utf-8').toString('base64')}`
}

function decryptSecret(stored: string): string {
  if (!stored) return ''
  try {
    if (stored.startsWith('enc:') && safeStorage?.isEncryptionAvailable?.()) {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    }
    if (stored.startsWith('b64:')) {
      return Buffer.from(stored.slice(4), 'base64').toString('utf-8')
    }
  } catch {}
  return ''
}

/**
 * Extracts a YYYY-MM-DD calendar date key from an ISO timestamp without UTC-offset shifting
 * when the release date is midnight UTC (which is how Cinemeta, TMDB, and Kitsu store air dates).
 */
export function toCalendarDateKey(rawDate?: string): string | null {
  if (!rawDate || typeof rawDate !== 'string') return null
  const trimmed = rawDate.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  const y = parsed.getUTCFullYear()
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const d = String(parsed.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isEpisodicStremioItem(item: { id: string; type: string }): boolean {
  const t = (item.type || '').toLowerCase()
  if (t === 'series' || t === 'anime' || t === 'tv' || t === 'show') return true
  const id = (item.id || '').toLowerCase()
  return id.startsWith('kitsu:') || id.startsWith('mal:') || id.startsWith('anilist:')
}

/**
 * Decodes Stremio's compact `watched` bitfield (`<anchorVideoId>:<anchorLength>:<base64ZlibBits>`).
 * Returns the set of watched video IDs from `orderedVideoIds`.
 */
export function decodeStremioWatchedBitfield(
  watchedStr: string | undefined,
  orderedVideoIds: string[]
): Set<string> {
  const watched = new Set<string>()
  if (!watchedStr || typeof watchedStr !== 'string' || orderedVideoIds.length === 0) {
    return watched
  }
  const lastColon = watchedStr.lastIndexOf(':')
  if (lastColon <= 0) return watched
  const secondLastColon = watchedStr.lastIndexOf(':', lastColon - 1)
  if (secondLastColon <= 0) return watched

  const anchorVideoId = watchedStr.slice(0, secondLastColon)
  const anchorLength = Number(watchedStr.slice(secondLastColon + 1, lastColon))
  const bitfieldB64 = watchedStr.slice(lastColon + 1)
  if (!bitfieldB64 || !Number.isFinite(anchorLength) || anchorLength <= 0) {
    if (anchorVideoId) watched.add(anchorVideoId)
    return watched
  }

  try {
    const rawBuf = Buffer.from(bitfieldB64, 'base64')
    const bytes = inflateSync(rawBuf, { maxOutputLength: 1024 * 1024 })
    const anchorIndex = orderedVideoIds.indexOf(anchorVideoId)
    const offset = anchorIndex >= 0 ? anchorIndex - (anchorLength - 1) : 0

    for (let i = 0; i < orderedVideoIds.length; i++) {
      const bitIndex = i - offset
      if (bitIndex < 0) continue
      const byteIdx = Math.floor(bitIndex / 8)
      if (byteIdx >= bytes.length) break
      const bitMask = 1 << (bitIndex % 8)
      if ((bytes[byteIdx] & bitMask) !== 0) {
        watched.add(orderedVideoIds[i])
      }
    }
    if (anchorVideoId) watched.add(anchorVideoId)
  } catch {
    if (anchorVideoId) watched.add(anchorVideoId)
  }

  return watched
}

function normalizeLibraryItem(
  input: Partial<StoredLibraryItemInternal> & { id: string; type: string; name: string },
  existing?: StoredLibraryItemInternal
): StoredLibraryItemInternal {
  const nowIso = new Date().toISOString()
  const watchedVideos = Array.isArray(input.watchedVideos)
    ? Array.from(new Set(input.watchedVideos.filter((v) => typeof v === 'string' && v.trim())))
    : existing?.watchedVideos || []

  return {
    id: input.id.trim(),
    type: (input.type || existing?.type || 'movie').trim(),
    name: (input.name || existing?.name || input.id).trim(),
    poster: input.poster ?? existing?.poster,
    background: input.background ?? existing?.background,
    logo: input.logo ?? existing?.logo,
    year: input.year !== undefined ? String(input.year) : existing?.year,
    imdbRating: input.imdbRating ?? existing?.imdbRating,
    releaseInfo: input.releaseInfo ?? existing?.releaseInfo,
    description: input.description ?? existing?.description,
    genres: input.genres ?? existing?.genres,
    addedAt: input.addedAt ?? existing?.addedAt ?? nowIso,
    lastWatchedAt: input.lastWatchedAt ?? existing?.lastWatchedAt,
    timesWatched:
      typeof input.timesWatched === 'number'
        ? Math.max(0, input.timesWatched)
        : existing?.timesWatched ?? 0,
    progressSeconds:
      typeof input.progressSeconds === 'number'
        ? Math.max(0, input.progressSeconds)
        : existing?.progressSeconds ?? 0,
    durationSeconds:
      typeof input.durationSeconds === 'number'
        ? Math.max(0, input.durationSeconds)
        : existing?.durationSeconds ?? 0,
    isWatched:
      typeof input.isWatched === 'boolean'
        ? input.isWatched
        : existing?.isWatched ?? false,
    lastVideoId: input.lastVideoId ?? existing?.lastVideoId,
    watchedVideos,
    newEpisodesCount: input.newEpisodesCount ?? existing?.newEpisodesCount ?? 0,
    source: input.source ?? existing?.source ?? 'local',
    stremioWatchedBitfield:
      input.stremioWatchedBitfield ?? existing?.stremioWatchedBitfield
  }
}

function toPublicLibraryItem(item: StoredLibraryItemInternal): StremioLibraryItem {
  const { stremioWatchedBitfield: _omit, ...rest } = item
  return rest
}

function extractVideosFromMeta(meta: any, seriesId: string): CachedSeriesVideo[] {
  const rawVideos: RawStremioVideo[] = Array.isArray(meta?.videos) ? meta.videos : []
  const result: CachedSeriesVideo[] = []
  const seen = new Set<string>()

  for (const v of rawVideos) {
    const rawReleased = v.released || v.firstAired
    const dateKey = toCalendarDateKey(rawReleased)
    if (!dateKey || !rawReleased) continue

    const season = Number.isFinite(Number(v.season)) ? Number(v.season) : 1
    const epNum = Number.isFinite(Number(v.episode))
      ? Number(v.episode)
      : Number.isFinite(Number(v.number))
        ? Number(v.number)
        : 0
    const videoId =
      (typeof v.id === 'string' && v.id.trim()) || `${seriesId}:${season}:${epNum}`
    if (seen.has(videoId)) continue
    seen.add(videoId)

    result.push({
      videoId,
      season,
      episode: epNum,
      episodeTitle: (v.name || v.title || `Episódio ${epNum || 1}`).trim(),
      overview: (v.overview || v.description || '').trim() || undefined,
      thumbnail: v.thumbnail || undefined,
      released: rawReleased,
      dateKey
    })
  }

  result.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })

  return result
}

function computeNewEpisodesCount(
  item: StoredLibraryItemInternal,
  videos: CachedSeriesVideo[],
  todayKey: string
): { watchedSet: Set<string>; newCount: number } {
  const orderedIds = videos.map((v) => v.videoId)
  const decoded = decodeStremioWatchedBitfield(item.stremioWatchedBitfield, orderedIds)
  const watchedSet = new Set<string>([...(item.watchedVideos || []), ...decoded])
  if (item.lastVideoId) watchedSet.add(item.lastVideoId)

  const aired = videos.filter((v) => v.dateKey <= todayKey)
  if (aired.length === 0) {
    return { watchedSet, newCount: 0 }
  }

  if (item.isWatched && watchedSet.size === 0) {
    return { watchedSet, newCount: 0 }
  }

  // If the user has watched at least one episode, count aired episodes strictly AFTER the latest watched episode
  // or unwatched episodes since the last watched date (same behavior as Stremio's "+4" notification badge).
  if (watchedSet.size > 0) {
    let latestWatchedIdx = -1
    for (let i = 0; i < aired.length; i++) {
      if (watchedSet.has(aired[i].videoId)) {
        latestWatchedIdx = i
      }
    }
    if (latestWatchedIdx >= 0) {
      let count = 0
      for (let i = latestWatchedIdx + 1; i < aired.length; i++) {
        if (!watchedSet.has(aired[i].videoId)) count++
      }
      return { watchedSet, newCount: count }
    }
  }

  // Otherwise, if the user has a lastWatchedAt date, count episodes released after lastWatchedAt
  const cutoffDateKey = toCalendarDateKey(item.lastWatchedAt || item.addedAt)
  if (cutoffDateKey) {
    const newSinceCutoff = aired.filter(
      (v) => v.dateKey > cutoffDateKey && !watchedSet.has(v.videoId)
    ).length
    return { watchedSet, newCount: newSinceCutoff }
  }

  return { watchedSet, newCount: 0 }
}

export class StremioLibraryService {
  private readonly deps: StremioServiceDeps
  private libraryCache: StoredLibraryItemInternal[] | null = null
  private calendarCache: CalendarCacheFile | null = null
  private accountCache: StoredAccountFile | null | undefined = undefined

  constructor(deps: StremioServiceDeps = {}) {
    this.deps = deps
  }

  private getDataDir(): string {
    return this.deps.dataDir || getDefaultDataDir()
  }

  private getLibraryPath(): string {
    return path.join(this.getDataDir(), 'stremio_library.json')
  }

  private getCalendarCachePath(): string {
    return path.join(this.getDataDir(), 'stremio_calendar_cache.json')
  }

  private getAccountPath(): string {
    return path.join(this.getDataDir(), 'stremio_account.json')
  }

  private async fetchJson(url: string, init?: RequestInit): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const doFetch = this.deps.fetchFn || (net.fetch.bind(net) as typeof fetch)
      const res = await doFetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init?.headers || {})
        }
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  private loadLibraryInternal(): StoredLibraryItemInternal[] {
    if (this.libraryCache === null) {
      const loaded = readJsonSafe<StoredLibraryItemInternal[]>(this.getLibraryPath(), [])
      this.libraryCache = Array.isArray(loaded) ? loaded : []
    }
    return this.libraryCache
  }

  private saveLibraryInternal(items: StoredLibraryItemInternal[]): void {
    this.libraryCache = items
    atomicWriteJson(this.getLibraryPath(), items)
  }

  private loadCalendarCache(): CalendarCacheFile {
    if (this.calendarCache === null) {
      const loaded = readJsonSafe<CalendarCacheFile>(this.getCalendarCachePath(), {
        updatedAt: '',
        series: {}
      })
      this.calendarCache = {
        updatedAt: typeof loaded?.updatedAt === 'string' ? loaded.updatedAt : '',
        series: loaded?.series && typeof loaded.series === 'object' ? loaded.series : {}
      }
    }
    return this.calendarCache
  }

  private saveCalendarCache(cache: CalendarCacheFile): void {
    this.calendarCache = cache
    atomicWriteJson(this.getCalendarCachePath(), cache)
  }

  private loadAccount(): StoredAccountFile | null {
    if (this.accountCache === undefined) {
      const loaded = readJsonSafe<StoredAccountFile | null>(this.getAccountPath(), null)
      this.accountCache =
        loaded && typeof loaded.email === 'string' && typeof loaded.authKeyEnc === 'string'
          ? loaded
          : null
    }
    return this.accountCache
  }

  private saveAccount(account: StoredAccountFile | null): void {
    this.accountCache = account
    if (!account) {
      atomicWriteJson(this.getAccountPath(), null)
      return
    }
    atomicWriteJson(this.getAccountPath(), account)
  }

  getLibrary(): StremioLibraryItem[] {
    return this.loadLibraryInternal().map(toPublicLibraryItem)
  }

  reloadFromDisk(): void {
    this.libraryCache = null
    this.calendarCache = null
    this.accountCache = undefined
  }

  upsertLibraryItem(
    input: Partial<StremioLibraryItem> & { id: string; type: string; name: string }
  ): StremioLibraryItem[] {
    const items = [...this.loadLibraryInternal()]
    const idx = items.findIndex((i) => i.id === input.id)
    const normalized = normalizeLibraryItem(input, idx >= 0 ? items[idx] : undefined)
    if (idx >= 0) {
      items[idx] = normalized
    } else {
      items.unshift(normalized)
    }
    this.saveLibraryInternal(items)
    return items.map(toPublicLibraryItem)
  }

  removeLibraryItem(id: string): StremioLibraryItem[] {
    const items = this.loadLibraryInternal().filter((i) => i.id !== id)
    this.saveLibraryInternal(items)
    return items.map(toPublicLibraryItem)
  }

  toggleWatched(id: string, isWatched: boolean, videoId?: string): StremioLibraryItem[] {
    const items = [...this.loadLibraryInternal()]
    const idx = items.findIndex((i) => i.id === id)
    if (idx < 0) return items.map(toPublicLibraryItem)

    const current = { ...items[idx] }
    const nowIso = new Date().toISOString()

    if (videoId) {
      const watchedSet = new Set(current.watchedVideos || [])
      if (isWatched) {
        watchedSet.add(videoId)
        current.lastVideoId = videoId
        current.lastWatchedAt = nowIso
        current.timesWatched = Math.max(1, (current.timesWatched || 0) + 1)
      } else {
        watchedSet.delete(videoId)
      }
      current.watchedVideos = Array.from(watchedSet)
      const cache = this.loadCalendarCache()
      const cachedSeries = cache.series[current.id]
      if (cachedSeries) {
        const todayKey = getTodayDateKey(this.deps.nowFn ? this.deps.nowFn() : new Date())
        const { newCount } = computeNewEpisodesCount(current, cachedSeries.videos, todayKey)
        current.newEpisodesCount = newCount
      }
    } else {
      current.isWatched = isWatched
      if (isWatched) {
        current.lastWatchedAt = current.lastWatchedAt || nowIso
        current.timesWatched = Math.max(1, current.timesWatched || 0)
        current.newEpisodesCount = 0
      }
    }

    items[idx] = current
    this.saveLibraryInternal(items)
    return items.map(toPublicLibraryItem)
  }

  saveProgress(payload: {
    id: string
    type?: string
    name?: string
    poster?: string
    background?: string
    progressSeconds: number
    durationSeconds: number
    videoId?: string
  }): StremioLibraryItem[] {
    const items = [...this.loadLibraryInternal()]
    const idx = items.findIndex((i) => i.id === payload.id)
    const nowIso = new Date().toISOString()
    const isCompleted =
      payload.durationSeconds > 0 && payload.progressSeconds >= payload.durationSeconds * 0.92

    if (idx >= 0) {
      const current = { ...items[idx] }
      current.progressSeconds = Math.max(0, payload.progressSeconds)
      current.durationSeconds = Math.max(0, payload.durationSeconds)
      current.lastWatchedAt = nowIso
      if (payload.videoId) {
        current.lastVideoId = payload.videoId
        if (isCompleted) {
          const watchedSet = new Set(current.watchedVideos || [])
          watchedSet.add(payload.videoId)
          current.watchedVideos = Array.from(watchedSet)
          current.timesWatched = Math.max(1, (current.timesWatched || 0) + 1)
        }
      } else if (isCompleted) {
        current.isWatched = true
        current.timesWatched = Math.max(1, (current.timesWatched || 0) + 1)
      }
      items[idx] = current
      this.saveLibraryInternal(items)
    } else if (payload.name) {
      const created = normalizeLibraryItem({
        id: payload.id,
        type: payload.type || 'movie',
        name: payload.name,
        poster: payload.poster,
        background: payload.background,
        progressSeconds: payload.progressSeconds,
        durationSeconds: payload.durationSeconds,
        lastWatchedAt: nowIso,
        lastVideoId: payload.videoId,
        isWatched: !payload.videoId && isCompleted,
        watchedVideos: payload.videoId && isCompleted ? [payload.videoId] : [],
        timesWatched: isCompleted ? 1 : 0
      })
      items.unshift(created)
      this.saveLibraryInternal(items)
    }

    return items.map(toPublicLibraryItem)
  }

  private buildMetaCandidateUrls(
    item: StoredLibraryItemInternal,
    addons: StremioAddonManifest[]
  ): string[] {
    const urls: string[] = []
    const addUrl = (url: string) => {
      if (url && !urls.includes(url)) urls.push(url)
    }

    const encodedId = encodeURIComponent(item.id)
    const itemType = (item.type || 'series').toLowerCase()
    const idLower = item.id.toLowerCase()

    // 1. Check installed enabled Stremio addons that provide `meta` and match prefix/type
    for (const addon of addons) {
      if (addon.isEnabled === false || !addon.manifestUrl) continue
      const baseUrl = addon.manifestUrl.replace(/\/manifest\.json$/i, '')
      const resources = Array.isArray(addon.resources) ? addon.resources : []
      let supportsMeta = false
      let resourcePrefixes: string[] = Array.isArray(addon.idPrefixes) ? addon.idPrefixes : []
      let resourceTypes: string[] = Array.isArray(addon.types) ? addon.types : []

      for (const r of resources) {
        if (typeof r === 'string' && r === 'meta') {
          supportsMeta = true
        } else if (r && typeof r === 'object' && r.name === 'meta') {
          supportsMeta = true
          if (Array.isArray(r.idPrefixes) && r.idPrefixes.length > 0) {
            resourcePrefixes = r.idPrefixes
          }
          if (Array.isArray(r.types) && r.types.length > 0) {
            resourceTypes = r.types
          }
        }
      }

      if (!supportsMeta) continue
      const prefixMatches =
        resourcePrefixes.length === 0 ||
        resourcePrefixes.some((p) => idLower.startsWith(p.toLowerCase()))
      if (!prefixMatches) continue

      if (resourceTypes.includes(itemType)) {
        addUrl(`${baseUrl}/meta/${encodeURIComponent(itemType)}/${encodedId}.json`)
      }
      if (itemType !== 'series' && resourceTypes.includes('series')) {
        addUrl(`${baseUrl}/meta/series/${encodedId}.json`)
      }
      if (itemType !== 'anime' && resourceTypes.includes('anime')) {
        addUrl(`${baseUrl}/meta/anime/${encodedId}.json`)
      }
    }

    // 2. Built-in reliable fallbacks (Cinemeta for IMDb IDs, Kitsu for kitsu: IDs)
    if (idLower.startsWith('tt')) {
      addUrl(`${CINEMETA_BASE}/meta/series/${encodedId}.json`)
      if (itemType !== 'series') {
        addUrl(`${CINEMETA_BASE}/meta/${encodeURIComponent(itemType)}/${encodedId}.json`)
      }
    } else if (idLower.startsWith('kitsu:')) {
      addUrl(`${KITSU_BASE}/meta/anime/${encodedId}.json`)
      addUrl(`${KITSU_BASE}/meta/series/${encodedId}.json`)
    } else {
      addUrl(`${CINEMETA_BASE}/meta/series/${encodedId}.json`)
    }

    return urls
  }

  private async fetchSeriesSchedule(
    item: StoredLibraryItemInternal,
    addons: StremioAddonManifest[]
  ): Promise<CachedSeriesSchedule | null> {
    const candidateUrls = this.buildMetaCandidateUrls(item, addons)
    for (const url of candidateUrls) {
      try {
        const data = await this.fetchJson(url)
        const meta = data?.meta
        if (!meta) continue
        const videos = extractVideosFromMeta(meta, item.id)
        // If this addon returned meta with videos (or if it's our last candidate), accept it
        if (videos.length > 0 || url === candidateUrls[candidateUrls.length - 1]) {
          return {
            seriesId: item.id,
            seriesType: meta.type || item.type || 'series',
            seriesName: meta.name || item.name,
            seriesPoster: meta.poster || item.poster,
            seriesBackground: meta.background || item.background,
            fetchedAt: Date.now(),
            videos
          }
        }
      } catch {
        // Try next candidate addon
      }
    }
    return null
  }

  async getCalendar(forceRefresh = false): Promise<StremioCalendarResult> {
    const nowDate = this.deps.nowFn ? this.deps.nowFn() : new Date()
    const nowMs = nowDate.getTime()
    const todayKey = getTodayDateKey(nowDate)
    const library = [...this.loadLibraryInternal()]
    const seriesItems = library.filter(isEpisodicStremioItem)
    const cache = this.loadCalendarCache()
    const addons = this.deps.getAddons ? await this.deps.getAddons().catch(() => []) : []

    const toFetch = seriesItems.filter((item) => {
      if (forceRefresh) return true
      const cached = cache.series[item.id]
      if (!cached) return true
      return nowMs - cached.fetchedAt > CALENDAR_TTL_MS
    })

    const errors: string[] = []
    let syncedSeries = 0
    let cacheDirty = false

    // Concurrency-limited worker pool
    let cursor = 0
    const workerCount = Math.min(MAX_CONCURRENCY, toFetch.length)
    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < toFetch.length) {
        const item = toFetch[cursor++]
        try {
          const schedule = await this.fetchSeriesSchedule(item, addons)
          if (schedule) {
            cache.series[item.id] = schedule
            syncedSeries++
            cacheDirty = true
          }
        } catch (err) {
          errors.push(`${item.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    })
    await Promise.all(workers)

    if (cacheDirty) {
      cache.updatedAt = nowDate.toISOString()
      this.saveCalendarCache(cache)
    }

    const episodes: StremioCalendarEpisode[] = []
    let libraryDirty = false

    for (let i = 0; i < library.length; i++) {
      const item = library[i]
      if (!isEpisodicStremioItem(item)) continue
      const schedule = cache.series[item.id]
      if (!schedule) continue

      const { watchedSet, newCount } = computeNewEpisodesCount(item, schedule.videos, todayKey)

      // Update library metadata/poster/newEpisodesCount if changed
      const nextPoster = item.poster || schedule.seriesPoster
      const nextBg = item.background || schedule.seriesBackground
      if (
        item.newEpisodesCount !== newCount ||
        item.poster !== nextPoster ||
        item.background !== nextBg
      ) {
        library[i] = {
          ...item,
          poster: nextPoster,
          background: nextBg,
          newEpisodesCount: newCount
        }
        libraryDirty = true
      }

      for (const v of schedule.videos) {
        episodes.push({
          id: `${item.id}:${v.videoId}`,
          seriesId: item.id,
          seriesType: item.type || schedule.seriesType || 'series',
          seriesName: item.name || schedule.seriesName,
          seriesPoster: nextPoster,
          seriesBackground: nextBg,
          videoId: v.videoId,
          season: v.season,
          episode: v.episode,
          episodeTitle: v.episodeTitle,
          overview: v.overview,
          thumbnail: v.thumbnail,
          released: v.released,
          dateKey: v.dateKey,
          isWatched: watchedSet.has(v.videoId),
          isUpcoming: v.dateKey > todayKey
        })
      }
    }

    if (libraryDirty) {
      this.saveLibraryInternal(library)
    }

    episodes.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
      if (a.seriesName !== b.seriesName) return a.seriesName.localeCompare(b.seriesName)
      if (a.season !== b.season) return a.season - b.season
      return a.episode - b.episode
    })

    return {
      episodes,
      updatedAt: cache.updatedAt || nowDate.toISOString(),
      seriesCount: seriesItems.length,
      syncedSeries,
      errors
    }
  }

  getAccountStatus(): StremioAccountStatus {
    const account = this.loadAccount()
    if (!account || !account.authKeyEnc) {
      return { connected: false }
    }
    return {
      connected: true,
      email: account.email,
      lastSyncAt: account.lastSyncAt,
      syncedItemsCount: account.syncedItemsCount
    }
  }

  logoutAccount(): { success: boolean } {
    this.saveAccount(null)
    return { success: true }
  }

  private async pullStremioLibraryWithAuthKey(
    authKey: string
  ): Promise<StoredLibraryItemInternal[]> {
    const res = await this.fetchJson(`${STREMIO_API_BASE}/datastoreGet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authKey,
        collection: 'libraryItem',
        ids: [],
        all: true
      })
    })

    if (res?.error) {
      throw new Error(res.error.message || 'Falha ao consultar biblioteca na conta Stremio.')
    }

    const rawItems: any[] = Array.isArray(res?.result) ? res.result : []
    const imported: StoredLibraryItemInternal[] = []

    for (const raw of rawItems) {
      if (!raw || typeof raw._id !== 'string' || !raw._id.trim()) continue
      // In Stremio, removed === true means deleted from library; temp === true means transient history only
      if (raw.removed === true || raw.temp === true) continue

      const state = raw.state && typeof raw.state === 'object' ? raw.state : {}
      const durationSec =
        typeof state.duration === 'number' && state.duration > 0
          ? Math.round(state.duration / 1000)
          : 0
      const progressSec =
        typeof state.timeOffset === 'number' && state.timeOffset > 0
          ? Math.round(state.timeOffset / 1000)
          : 0
      const timesWatched =
        typeof state.timesWatched === 'number' && state.timesWatched > 0
          ? state.timesWatched
          : 0
      const isWatched =
        state.flaggedWatched === 1 ||
        timesWatched > 0 ||
        (durationSec > 0 && progressSec >= durationSec * 0.92)

      imported.push(
        normalizeLibraryItem({
          id: raw._id,
          type: raw.type || 'movie',
          name: raw.name || raw._id,
          poster: raw.poster || undefined,
          background: raw.background || undefined,
          logo: raw.logo || undefined,
          year: raw.year ? String(raw.year) : undefined,
          addedAt: raw._ctime || raw._mtime || new Date().toISOString(),
          lastWatchedAt:
            state.lastWatched && state.lastWatched !== '1970-01-01T00:00:00.000Z'
              ? state.lastWatched
              : raw._mtime || undefined,
          timesWatched,
          progressSeconds: progressSec,
          durationSeconds: durationSec,
          isWatched,
          lastVideoId: typeof state.video_id === 'string' && state.video_id ? state.video_id : undefined,
          watchedVideos:
            typeof state.video_id === 'string' && state.video_id && isWatched
              ? [state.video_id]
              : [],
          source: 'stremio-account',
          stremioWatchedBitfield:
            typeof state.watched === 'string' && state.watched ? state.watched : undefined
        })
      )
    }

    // Merge with locally added items so user never loses local Ghost additions
    const existing = this.loadLibraryInternal()
    const mergedMap = new Map<string, StoredLibraryItemInternal>()

    for (const localItem of existing) {
      if (localItem.source !== 'stremio-account') {
        mergedMap.set(localItem.id, localItem)
      }
    }

    for (const remoteItem of imported) {
      const prev = existing.find((e) => e.id === remoteItem.id)
      const combinedWatched = Array.from(
        new Set([...(prev?.watchedVideos || []), ...(remoteItem.watchedVideos || [])])
      )
      mergedMap.set(remoteItem.id, {
        ...remoteItem,
        watchedVideos: combinedWatched,
        newEpisodesCount: prev?.newEpisodesCount ?? 0
      })
    }

    const merged = Array.from(mergedMap.values())
    this.saveLibraryInternal(merged)
    return merged
  }

  async loginAndSync(
    email: string,
    password: string,
    importAddons = false
  ): Promise<{
    success: boolean
    error?: string
    importedCount?: number
    importedAddons?: number
    library?: StremioLibraryItem[]
    status?: StremioAccountStatus
  }> {
    const cleanEmail = (email || '').trim()
    if (!cleanEmail || !password) {
      return { success: false, error: 'Informe o e-mail e a senha da sua conta Stremio.' }
    }

    try {
      const loginRes = await this.fetchJson(`${STREMIO_API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'Login',
          email: cleanEmail,
          password,
          facebook: false
        })
      })

      if (loginRes?.error) {
        return {
          success: false,
          error: loginRes.error.message || 'E-mail ou senha inválidos na conta Stremio.'
        }
      }

      const authKey: string | undefined = loginRes?.result?.authKey
      if (!authKey) {
        return { success: false, error: 'A API do Stremio não retornou chave de sessão válida.' }
      }

      const merged = await this.pullStremioLibraryWithAuthKey(authKey)
      let importedAddons = 0

      if (importAddons && this.deps.addAddon) {
        try {
          const addonsRes = await this.fetchJson(`${STREMIO_API_BASE}/addonCollectionGet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'AddonCollectionGet', authKey, update: true })
          })
          const addonList: any[] = Array.isArray(addonsRes?.result?.addons)
            ? addonsRes.result.addons
            : []
          for (const entry of addonList) {
            const transportUrl = entry?.transportUrl
            if (typeof transportUrl === 'string' && transportUrl.startsWith('http')) {
              const r = await this.deps.addAddon(transportUrl).catch(() => ({ success: false }))
              if (r.success) importedAddons++
            }
          }
        } catch (addonErr) {
          logWarning(
            `[StremioLibrary] Aviso ao importar addons da conta: ${String(addonErr)}`,
            LogPrefix.Backend
          )
        }
      }

      const nowIso = new Date().toISOString()
      this.saveAccount({
        email: cleanEmail,
        authKeyEnc: encryptSecret(authKey),
        lastSyncAt: nowIso,
        syncedItemsCount: merged.length
      })

      logInfo(
        `[StremioLibrary] Conta Stremio sincronizada com sucesso (${merged.length} itens).`,
        LogPrefix.Backend
      )

      return {
        success: true,
        importedCount: merged.length,
        importedAddons,
        library: merged.map(toPublicLibraryItem),
        status: this.getAccountStatus()
      }
    } catch (err) {
      return {
        success: false,
        error: `Falha ao conectar na conta Stremio: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  async syncAccount(): Promise<{
    success: boolean
    error?: string
    importedCount?: number
    library?: StremioLibraryItem[]
    status?: StremioAccountStatus
  }> {
    const account = this.loadAccount()
    if (!account || !account.authKeyEnc) {
      return { success: false, error: 'Nenhuma conta Stremio conectada.' }
    }
    const authKey = decryptSecret(account.authKeyEnc)
    if (!authKey) {
      return {
        success: false,
        error: 'Sessão da conta Stremio expirada. Conecte novamente.'
      }
    }
    try {
      const merged = await this.pullStremioLibraryWithAuthKey(authKey)
      this.saveAccount({
        ...account,
        lastSyncAt: new Date().toISOString(),
        syncedItemsCount: merged.length
      })
      return {
        success: true,
        importedCount: merged.length,
        library: merged.map(toPublicLibraryItem),
        status: this.getAccountStatus()
      }
    } catch (err) {
      return {
        success: false,
        error: `Erro ao sincronizar biblioteca Stremio: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }
}

let singletonInstance: StremioLibraryService | null = null

export function getStremioLibraryService(
  getAddons?: () => Promise<StremioAddonManifest[]>,
  addAddon?: (manifestUrl: string) => Promise<{ success: boolean }>
): StremioLibraryService {
  if (!singletonInstance) {
    singletonInstance = new StremioLibraryService({
      getAddons,
      addAddon
    })
  }
  return singletonInstance
}
