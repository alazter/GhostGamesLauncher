import type { ReleaseProduct } from 'common/types/releases'
import {
  getTrackedReleases,
  getReleasesDueOn,
  toggleReleaseTracking,
  removeTrackedRelease,
  refreshTrackedProducts,
  mergeReleaseTrackingStates,
  RELEASE_TRACKING_KEY,
  RELEASE_TRACKING_RECOVERY_KEY
} from 'frontend/helpers/releaseTracking'
import {
  restoreTrackedReleaseVersion,
  resumeTrackedReleaseUpdates
} from 'frontend/helpers/releaseTracking'
import {
  collectLocalStorageBackup,
  restoreLocalStorageBackup,
  syncLocalStorageToBackend
} from 'frontend/utils/localStorageBackup'

const product: ReleaseProduct = {
  id: 'example',
  title: 'Example',
  category: 'games',
  url: 'https://www.releases.com/p/example',
  region: 'us',
  platforms: ['PC', 'PlayStation 5'],
  dateLabel: 'Oct 3, 2026',
  releaseDate: '2026-10-03',
  releases: [
    {
      platform: 'PC',
      region: 'us',
      dateLabel: 'Oct 3, 2026',
      date: '2026-10-03',
      estimated: false
    },
    {
      platform: 'PlayStation 5',
      region: 'us',
      dateLabel: 'Q4 2026',
      estimated: true
    },
    {
      platform: 'PC',
      region: 'uk',
      dateLabel: 'Oct 4, 2026',
      date: '2026-10-04',
      estimated: false
    }
  ],
  images: [],
  videos: [],
  tags: []
}

beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      }
    }
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      api: {
        storeSet: jest.fn(),
        syncLocalStorageBackup: jest.fn().mockResolvedValue(undefined)
      }
    })
  })
})
afterEach(async () => {
  await syncLocalStorageToBackend()
})

it('monitors by platform and region and excludes estimates from due-day alerts', () => {
  toggleReleaseTracking(product, 'PC', 'us')
  toggleReleaseTracking(product, 'PlayStation 5', 'us')
  toggleReleaseTracking(product, 'PC', 'uk')
  const due = getReleasesDueOn(getTrackedReleases(), '2026-10-03')
  expect(due).toHaveLength(1)
  expect(due[0]).toMatchObject({ platform: 'PC', region: 'us' })
  expect(getReleasesDueOn(getTrackedReleases(), '2026-10-04')[0].region).toBe(
    'uk'
  )
})

it('round-trips backups and keeps newer local removals when restoring an older cloud copy', async () => {
  toggleReleaseTracking(product, 'PC')
  const backup = collectLocalStorageBackup()
  localStorage.clear()
  await restoreLocalStorageBackup(backup)
  expect(getTrackedReleases()).toHaveLength(1)
  removeTrackedRelease(getTrackedReleases()[0].id)
  await restoreLocalStorageBackup(backup)
  expect(getTrackedReleases()).toEqual([])
  const written = (
    window.api.syncLocalStorageBackup as jest.Mock
  ).mock.calls.at(-1)?.[0]
  expect(JSON.parse(written[RELEASE_TRACKING_KEY]).entries).toEqual([])
  expect(
    Object.keys(JSON.parse(written[RELEASE_TRACKING_KEY]).removed)
  ).toHaveLength(1)
})

it('merges different follows without restoring authentication or transient badge data', async () => {
  toggleReleaseTracking(product, 'PC')
  const backup = collectLocalStorageBackup()
  localStorage.clear()
  toggleReleaseTracking({ ...product, id: 'another', title: 'Another' })
  await restoreLocalStorageBackup({
    ...backup,
    auth_token: 'not-a-preference',
    ghost_releases_badge_count: '99'
  })
  expect(getTrackedReleases()).toHaveLength(2)
  expect(localStorage.getItem('auth_token')).toBeNull()
  expect(localStorage.getItem('ghost_releases_badge_count')).toBeNull()
})

it('retains damaged backup data for recovery instead of silently replacing it', async () => {
  localStorage.setItem(RELEASE_TRACKING_KEY, '{damaged-local')
  await restoreLocalStorageBackup({
    [RELEASE_TRACKING_KEY]: '{damaged-cloud',
    [RELEASE_TRACKING_RECOVERY_KEY]: 'previous-recovery'
  })
  const recovery = localStorage.getItem(RELEASE_TRACKING_RECOVERY_KEY)
  expect(recovery).toContain('{damaged-local')
  expect(recovery).toContain('{damaged-cloud')
  expect(recovery).toContain('previous-recovery')
})

it('does not let a metadata refresh resurrect a removed follow', async () => {
  toggleReleaseTracking(product, 'PC')
  const old = collectLocalStorageBackup()
  const id = getTrackedReleases()[0].id
  removeTrackedRelease(id)
  refreshTrackedProducts([{ ...product, description: 'Updated' }])
  await restoreLocalStorageBackup(old)
  expect(getTrackedReleases()).toEqual([])
})

it('confirms backend persistence before reporting a successful snapshot', async () => {
  let finish!: () => void
  ;(window.api.syncLocalStorageBackup as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  let done = false
  const pending = syncLocalStorageToBackend().then(() => {
    done = true
  })
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(done).toBe(false)
  finish()
  await pending
  expect(done).toBe(true)
})

it('preserves existing dates when a refresh returns incomplete data and records a warning', () => {
  toggleReleaseTracking(product, 'PC')
  refreshTrackedProducts([{ ...product, releases: [], releaseDate: undefined }])
  expect(getTrackedReleases()[0].product.releases).toEqual(product.releases)
  expect(getTrackedReleases()[0].updateWarning).toContain('datas')
  refreshTrackedProducts([product])
  expect(getTrackedReleases()[0].updateWarning).toBeUndefined()
})

it('backs up historical versions and keeps a recovered version paused until resumed', async () => {
  toggleReleaseTracking(product, 'PC')
  const changed = {
    ...product,
    description: 'Nova sinopse',
    verifiedAt: '2026-10-04T12:00:00Z'
  }
  refreshTrackedProducts([changed])
  expect(getTrackedReleases()[0].history).toHaveLength(1)
  const backup = collectLocalStorageBackup()
  localStorage.clear()
  await restoreLocalStorageBackup(backup)
  const follow = getTrackedReleases()[0]
  restoreTrackedReleaseVersion(follow.id, follow.history![0].at)
  expect(getTrackedReleases()[0].product.description).toBeUndefined()
  expect(getTrackedReleases()[0].metadataPaused).toBe(true)
  refreshTrackedProducts([changed])
  expect(getTrackedReleases()[0].product.description).toBeUndefined()
  resumeTrackedReleaseUpdates(product.id, 'us')
  refreshTrackedProducts([changed])
  expect(getTrackedReleases()[0].product.description).toBe('Nova sinopse')
})

it('does not treat a stale archived response as a fresh confirmation', () => {
  toggleReleaseTracking(product)
  refreshTrackedProducts([
    { ...product, stale: true, warning: 'Consulta suspensa', releases: [] }
  ])
  expect(getTrackedReleases()[0].product.releases).toEqual(product.releases)
  expect(getTrackedReleases()[0].updateWarning).toBe('Consulta suspensa')
})

it('merges newer preferences independently from newer metadata in either restore order', () => {
  toggleReleaseTracking(product)
  const base = getTrackedReleases()[0]
  const preferences = {
    ...base,
    notify: false,
    updatedAt: '2026-10-05T12:00:00Z',
    productUpdatedAt: '2026-10-01T12:00:00Z'
  }
  const metadata = {
    ...base,
    updatedAt: '2026-10-04T12:00:00Z',
    productUpdatedAt: '2026-10-06T12:00:00Z',
    product: { ...product, description: 'Recent confirmation' }
  }
  for (const pair of [
    [preferences, metadata],
    [metadata, preferences]
  ]) {
    const result = mergeReleaseTrackingStates(
      { version: 1, entries: [pair[0]], removed: {} },
      { version: 1, entries: [pair[1]], removed: {} }
    )
    expect(result.entries[0].notify).toBe(false)
    expect(result.entries[0].product.description).toBe('Recent confirmation')
  }
  const paused = mergeReleaseTrackingStates(
    {
      version: 1,
      entries: [{ ...preferences, metadataPaused: true }],
      removed: {}
    },
    { version: 1, entries: [metadata], removed: {} }
  )
  expect(paused.entries[0].product).toEqual(product)
})
