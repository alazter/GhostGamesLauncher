import { safeReleaseMedia } from 'common/releaseMedia'
import type { ReleaseProduct, ReleaseRegion } from 'common/types/releases'
import { syncLocalStorageToBackend } from 'frontend/utils/localStorageBackup'
import { releaseUpdateProblem } from 'common/releaseValidation'

export const RELEASE_TRACKING_KEY = 'ghost_release_tracking_v1'
export const RELEASE_TRACKING_RECOVERY_KEY =
  'ghost_release_tracking_recovery_v1'
export const RELEASE_TRACKING_CHANGED = 'ghostReleaseTrackingChanged'
export const LEGACY_RELEASE_TRACKING_KEYS = [
  'ghost_tracked_releases',
  'ghost_releases_tracked'
] as const

export interface TrackedRelease {
  id: string
  product: ReleaseProduct
  platform: string | null
  region: ReleaseRegion
  followedAt: string
  updatedAt: string
  productUpdatedAt?: string
  notify: boolean
  history?: { at: string; product: ReleaseProduct }[]
  metadataPaused?: boolean
  updateWarning?: string
}

export interface ReleaseTrackingState {
  version: 1
  entries: TrackedRelease[]
  /** Deletions survive merging a backup from another installation. */
  removed: Record<string, string>
}

const emptyState = (): ReleaseTrackingState => ({
  version: 1,
  entries: [],
  removed: {}
})
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown) => (typeof value === 'string' ? value : '')
const timestamp = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

/** Calendar dates are local days, not UTC instants or estimated months/quarters. */
export function isExactReleaseDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function localReleaseDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function releaseTrackingId(
  productId: string,
  platform: string | null = null,
  region: ReleaseRegion = 'us'
): string {
  return JSON.stringify([productId, platform || null, region])
}

function normalizeProduct(
  value: unknown,
  region: ReleaseRegion
): ReleaseProduct | null {
  if (!isObject(value)) return null
  let id = string(value.id) || string(value.slug)
  if (!id && typeof value.url === 'string') {
    try {
      const url = new URL(value.url)
      if (
        url.hostname === 'www.releases.com' ||
        url.hostname === 'releases.com'
      ) {
        id = url.pathname.match(/^\/p\/([^/]+)/)?.[1] || ''
      }
    } catch {
      // A legacy URL without a valid product identity cannot become a follow.
    }
  }
  const title = string(value.title) || string(value.name)
  if (!/^[a-z0-9][a-z0-9._~-]*$/i.test(id) || !title) return null
  const stringArray = (items: unknown) =>
    Array.isArray(items)
      ? items.filter((item): item is string => typeof item === 'string')
      : []
  const releases: ReleaseProduct['releases'] = []
  if (Array.isArray(value.releases)) {
    for (const row of value.releases) {
      if (!isObject(row) || typeof row.platform !== 'string') continue
      releases.push({
        platform: row.platform,
        region:
          row.region === 'uk' ? 'uk' : row.region === 'us' ? 'us' : region,
        dateLabel: string(row.dateLabel),
        date: isExactReleaseDate(row.date) ? row.date : undefined,
        estimated: row.estimated === true || !isExactReleaseDate(row.date)
      })
    }
  }
  return {
    id,
    title,
    url: `https://www.releases.com/p/${id}`,
    category:
      (
        { Game: 'games', Movie: 'movies', TVSeries: 'tv-series' } as Record<
          string,
          string
        >
      )[string(value.category)] ||
      string(value.category) ||
      'all',
    region,
    image: safeReleaseMedia(string(value.image)),
    heroImage: safeReleaseMedia(string(value.heroImage)),
    platforms: stringArray(value.platforms),
    dateLabel:
      string(value.dateLabel) || string(value.releaseDate) || 'A confirmar',
    releaseDate: isExactReleaseDate(value.releaseDate)
      ? value.releaseDate
      : undefined,
    description: string(value.description) || undefined,
    popularity: string(value.popularity) || undefined,
    releases,
    images: stringArray(value.images)
      .map(safeReleaseMedia)
      .filter((url): url is string => !!url),
    videos: stringArray(value.videos)
      .map(safeReleaseMedia)
      .filter((url): url is string => !!url),
    tags: stringArray(value.tags),
    verifiedAt: timestamp(value.verifiedAt) || undefined
  }
}

export function parseReleaseTrackingState(
  raw: string | null
): ReleaseTrackingState {
  if (!raw) return emptyState()
  try {
    const data: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''))
    if (!isObject(data) || data.version !== 1 || !Array.isArray(data.entries))
      return emptyState()
    const state = emptyState()
    for (const value of data.entries) {
      if (!isObject(value)) continue
      const region = value.region === 'uk' ? 'uk' : 'us'
      const product = normalizeProduct(value.product, region)
      if (!product) continue
      const platform =
        typeof value.platform === 'string' && value.platform
          ? value.platform
          : null
      const followedAt =
        timestamp(value.followedAt) || new Date(0).toISOString()
      state.entries.push({
        id: releaseTrackingId(product.id, platform, region),
        product,
        platform,
        region,
        followedAt,
        updatedAt: timestamp(value.updatedAt) || followedAt,
        productUpdatedAt: timestamp(value.productUpdatedAt) || undefined,
        history: Array.isArray(value.history)
          ? value.history.slice(0, 3).flatMap((revision) => {
              if (!isObject(revision)) return []
              const snapshot = normalizeProduct(revision.product, region)
              const at = timestamp(revision.at)
              return snapshot && snapshot.id === product.id && at
                ? [{ at, product: snapshot }]
                : []
            })
          : [],
        metadataPaused: value.metadataPaused === true,
        updateWarning: string(value.updateWarning) || undefined,
        notify: value.notify !== false
      })
    }
    if (isObject(data.removed)) {
      for (const [id, date] of Object.entries(data.removed)) {
        const validDate = timestamp(date)
        if (validDate) state.removed[id] = validDate
      }
    }
    return mergeReleaseTrackingStates(emptyState(), state)
  } catch {
    return emptyState()
  }
}

export function mergeReleaseTrackingStates(
  current: ReleaseTrackingState,
  incoming: ReleaseTrackingState
): ReleaseTrackingState {
  const removed = { ...current.removed }
  for (const [id, at] of Object.entries(incoming.removed)) {
    if (!removed[id] || at > removed[id]) removed[id] = at
  }
  const entries = new Map<string, TrackedRelease>()
  for (const entry of [...current.entries, ...incoming.entries]) {
    const previous = entries.get(entry.id)
    if (!previous) {
      entries.set(entry.id, entry)
    } else {
      const preferences =
        entry.updatedAt > previous.updatedAt ? entry : previous
      const metadata = preferences.metadataPaused
        ? preferences
        : (entry.productUpdatedAt || '') > (previous.productUpdatedAt || '')
          ? entry
          : previous
      entries.set(entry.id, {
        ...preferences,
        product: metadata.product,
        productUpdatedAt: metadata.productUpdatedAt,
        history: metadata.history,
        updateWarning: metadata.updateWarning
      })
    }
  }
  return {
    version: 1,
    entries: [...entries.values()].filter(
      (entry) => !removed[entry.id] || entry.updatedAt > removed[entry.id]
    ),
    removed
  }
}

function legacyState(raw: string | null): ReleaseTrackingState {
  if (!raw) return emptyState()
  try {
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''))
    const values = Array.isArray(parsed)
      ? parsed
      : isObject(parsed)
        ? Object.values(parsed)
        : []
    const state = emptyState()
    for (const value of values) {
      if (!isObject(value)) continue
      const region = value.region === 'uk' ? 'uk' : 'us'
      const product = normalizeProduct(value.product || value, region)
      if (!product) continue
      const platform = string(value.platform) || null
      const followedAt =
        timestamp(value.followedAt) ||
        timestamp(value.trackedAt) ||
        new Date(0).toISOString()
      state.entries.push({
        id: releaseTrackingId(product.id, platform, region),
        product,
        platform,
        region,
        followedAt,
        updatedAt: timestamp(value.updatedAt) || followedAt,
        notify: value.notify !== false
      })
    }
    return state
  } catch {
    return emptyState()
  }
}

function readState(): ReleaseTrackingState {
  let state = parseReleaseTrackingState(
    localStorage.getItem(RELEASE_TRACKING_KEY)
  )
  for (const key of LEGACY_RELEASE_TRACKING_KEYS) {
    state = mergeReleaseTrackingStates(
      state,
      legacyState(localStorage.getItem(key))
    )
  }
  return state
}

function nextTimestamp(state: ReleaseTrackingState): string {
  let next = Date.now()
  for (const entry of state.entries)
    next = Math.max(next, Date.parse(entry.updatedAt) + 1)
  for (const date of Object.values(state.removed))
    next = Math.max(next, Date.parse(date) + 1)
  return new Date(next).toISOString()
}

function preserveUnrecognizedState(raw: string | null): void {
  if (!raw) return
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''))
    if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
      // Preserve partially invalid records as well; never silently discard a saved follow.
      if (
        parseReleaseTrackingState(raw).entries.length === parsed.entries.length
      )
        return
    } else if (typeof parsed?.version === 'number' && parsed.version > 1) {
      throw new Error(
        'Este monitoramento foi salvo por uma versão mais recente do Ghost. Atualize o aplicativo antes de alterá-lo.'
      )
    }
  } catch (error) {
    if (error instanceof Error && !(error instanceof SyntaxError)) throw error
  }
  const previous = localStorage.getItem(RELEASE_TRACKING_RECOVERY_KEY)
  if (previous === raw) return
  // Keep the original verbatim when repairing an unreadable legacy snapshot.
  localStorage.setItem(
    RELEASE_TRACKING_RECOVERY_KEY,
    previous ? `${previous}\n${raw}` : raw
  )
}

function writeState(state: ReleaseTrackingState): void {
  preserveUnrecognizedState(localStorage.getItem(RELEASE_TRACKING_KEY))
  localStorage.setItem(RELEASE_TRACKING_KEY, JSON.stringify(state))
  window.api.storeSet('configStore', 'backup.lastModified', Date.now())
  window.dispatchEvent(new Event(RELEASE_TRACKING_CHANGED))
  window.dispatchEvent(new Event('backupStateChanged'))
  void syncLocalStorageToBackend().catch((error) => {
    console.error(
      'Não foi possível preparar o monitoramento para backup:',
      error
    )
  })
}

export function initializeReleaseTracking(): void {
  const state = readState()
  if (!localStorage.getItem(RELEASE_TRACKING_KEY) && state.entries.length)
    writeState(state)
}

export function getTrackedReleases(): TrackedRelease[] {
  return readState().entries
}

export function isReleaseTracked(
  productId: string,
  platform: string | null = null,
  region: ReleaseRegion = 'us'
): boolean {
  const id = releaseTrackingId(productId, platform, region)
  return getTrackedReleases().some((entry) => entry.id === id)
}

export function toggleReleaseTracking(
  product: ReleaseProduct,
  platform: string | null = null,
  region: ReleaseRegion = product.region
): boolean {
  const state = readState()
  const id = releaseTrackingId(product.id, platform, region)
  const existing = state.entries.find((entry) => entry.id === id)
  if (existing) {
    removeTrackedRelease(id)
    return false
  }
  const snapshot = normalizeProduct(product, region)
  if (!snapshot)
    throw new Error(
      'Não foi possível identificar este lançamento para monitorá-lo.'
    )
  const now = nextTimestamp(state)
  state.entries.push({
    id,
    product: snapshot,
    platform,
    region,
    followedAt: now,
    updatedAt: now,
    productUpdatedAt: now,
    notify: true
  })
  writeState(state)
  return true
}

export function removeTrackedRelease(id: string): void {
  const state = readState()
  if (!state.entries.some((entry) => entry.id === id)) return
  state.removed[id] = nextTimestamp(state)
  state.entries = state.entries.filter((entry) => entry.id !== id)
  writeState(state)
}

export function setTrackedReleaseNotifications(
  id: string,
  notify: boolean
): void {
  const state = readState()
  const entry = state.entries.find((value) => value.id === id)
  if (!entry || entry.notify === notify) return
  entry.updatedAt = nextTimestamp(state)
  entry.notify = notify
  writeState(state)
}

export function refreshTrackedProducts(products: ReleaseProduct[]): void {
  const state = readState()
  let changed = false
  for (const entry of state.entries) {
    if (entry.metadataPaused) continue
    const fresh = products.find(
      (product) =>
        product.id === entry.product.id && product.region === entry.region
    )
    if (!fresh) continue
    const problem = fresh.stale
      ? fresh.warning || 'A fonte está indisponível.'
      : releaseUpdateProblem(fresh, entry.product)
    if (problem) {
      if (entry.updateWarning !== problem) {
        entry.updateWarning = problem
        changed = true
      }
      continue
    }
    const snapshot = normalizeProduct(fresh, entry.region)
    if (!snapshot) continue
    if (JSON.stringify(snapshot) === JSON.stringify(entry.product)) {
      if (entry.updateWarning) {
        entry.updateWarning = undefined
        changed = true
      }
      continue
    }
    if (
      JSON.stringify({ ...entry.product, verifiedAt: undefined }) !==
      JSON.stringify({ ...snapshot, verifiedAt: undefined })
    ) {
      entry.history = [
        {
          at:
            entry.product.verifiedAt ||
            entry.productUpdatedAt ||
            entry.followedAt,
          product: entry.product
        },
        ...(entry.history || [])
      ].slice(0, 3)
    }
    entry.product = snapshot
    entry.updateWarning = undefined
    entry.productUpdatedAt = new Date().toISOString()
    changed = true
  }
  if (changed) writeState(state)
}

/** Recovery is an explicit user edit, so older backups cannot silently undo it. */
export function restoreTrackedReleaseVersion(
  id: string,
  at: string
): ReleaseProduct {
  const state = readState()
  const entry = state.entries.find((entry) => entry.id === id)
  const version = entry?.history?.find((version) => version.at === at)
  if (!entry || !version)
    throw new Error('Esta versão não está mais disponível no histórico.')
  const now = nextTimestamp(state)
  for (const follow of state.entries.filter(
    (follow) =>
      follow.product.id === entry.product.id && follow.region === entry.region
  )) {
    follow.history = [
      {
        at: follow.product.verifiedAt || follow.productUpdatedAt || now,
        product: follow.product
      },
      ...(follow.history || []).filter((item) => item.at !== at)
    ].slice(0, 3)
    follow.product = version.product
    follow.productUpdatedAt = now
    follow.updatedAt = now
    follow.metadataPaused = true
    follow.updateWarning =
      'Versão recuperada. Atualizações e avisos pausados até você retomá-los.'
  }
  writeState(state)
  return version.product
}

export function resumeTrackedReleaseUpdates(
  productId: string,
  region: ReleaseRegion
): void {
  const state = readState()
  const now = nextTimestamp(state)
  for (const entry of state.entries.filter(
    (entry) => entry.product.id === productId && entry.region === region
  )) {
    entry.metadataPaused = false
    entry.updatedAt = now
    entry.updateWarning = undefined
  }
  writeState(state)
}

export function subscribeReleaseTracking(listener: () => void): () => void {
  const storageListener = (event: StorageEvent) => {
    if (
      !event.key ||
      event.key === RELEASE_TRACKING_KEY ||
      LEGACY_RELEASE_TRACKING_KEYS.some((key) => key === event.key)
    )
      listener()
  }
  window.addEventListener(RELEASE_TRACKING_CHANGED, listener)
  window.addEventListener('storage', storageListener)
  return () => {
    window.removeEventListener(RELEASE_TRACKING_CHANGED, listener)
    window.removeEventListener('storage', storageListener)
  }
}

/** Merge user follows and deletion timestamps before restoring the other settings. */
export function restoreReleaseTrackingBackup(
  data: Record<string, string>
): void {
  let incoming = parseReleaseTrackingState(data[RELEASE_TRACKING_KEY] || null)
  for (const key of LEGACY_RELEASE_TRACKING_KEYS)
    incoming = mergeReleaseTrackingStates(
      incoming,
      legacyState(data[key] || null)
    )
  if (
    !data[RELEASE_TRACKING_KEY] &&
    !LEGACY_RELEASE_TRACKING_KEYS.some((key) => data[key])
  )
    return
  preserveUnrecognizedState(data[RELEASE_TRACKING_KEY] || null)
  writeState(mergeReleaseTrackingStates(readState(), incoming))
}

export function getReleasesDueOn(
  entries: TrackedRelease[],
  day = localReleaseDay()
): TrackedRelease[] {
  return entries.filter((entry) => {
    const matchingDates = entry.product.releases.filter(
      (release) =>
        release.region === entry.region &&
        (!entry.platform || release.platform === entry.platform)
    )
    if (matchingDates.length) {
      return matchingDates.some(
        (release) =>
          !release.estimated &&
          isExactReleaseDate(release.date) &&
          release.date === day
      )
    }
    // A card's generic date cannot establish a release day for a different platform.
    return (
      !entry.platform &&
      entry.product.releases.length === 0 &&
      entry.product.region === entry.region &&
      isExactReleaseDate(entry.product.releaseDate) &&
      entry.product.releaseDate === day
    )
  })
}
