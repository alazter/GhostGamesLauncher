import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises'
import { resolve, join, sep } from 'path'
import { parseRedditPage } from '../drmRedditParser'
import { parseCrackWatch } from '../drmParser'

let mockDirectory: string
const mockLoad = jest.fn()
const mockRead = jest.fn()
const mockFetch = jest.fn()
const mockAdditional = jest.fn()
jest.mock('../drmReddit', () => ({
  readCrackWatch: (...args: unknown[]) => mockFetch(...args),
  readCrackWatchIndex: async () => [],
  crackWatchSearchUrl: () => 'https://www.reddit.com/r/CrackWatch/search/'
}))
jest.mock('../drmSheets', () => ({
  getCrackWatchSheetSources: async () => ({
    sources: [],
    warning: '',
    stale: false
  })
}))
jest.mock('../drmSites', () => ({
  getAdditionalDrmSources: (...args: unknown[]) =>
    mockAdditional(...args) ?? Promise.resolve([])
}))
jest.mock('electron', () => ({
  app: { getPath: () => mockDirectory },
  net: { fetch: (...args: unknown[]) => mockFetch(...args) },
  session: {
    fromPartition: () => ({
      setPermissionRequestHandler: jest.fn(),
      webRequest: { onBeforeRequest: jest.fn() }
    })
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: (...args: unknown[]) => mockLoad(...args),
    isDestroyed: () => false,
    destroy: jest.fn(),
    webContents: {
      setAudioMuted: jest.fn(),
      setWindowOpenHandler: jest.fn(),
      on: jest.fn(),
      executeJavaScript: () => mockRead()
    }
  }))
}))

it.each(['cracked', 'drm-free'] as const)(
  'persists %s across failures, cache eviction and restarts; manual refresh and uncracked games still reach providers',
  async (status) => {
    const root = resolve('build/release-drm-tests')
    await mkdir(root, { recursive: true })
    mockDirectory = await mkdtemp(join(root, 'metadata-'))
    try {
      jest.resetModules()
      const { getReleaseDrm } = await import('../drm')
      jest.requireMock('electron').BrowserWindow.mockImplementation(() => ({
        loadURL: (...args: unknown[]) => mockLoad(...args),
        isDestroyed: () => false,
        destroy: jest.fn(),
        webContents: {
          setAudioMuted: jest.fn(),
          setWindowOpenHandler: jest.fn(),
          on: jest.fn(),
          executeJavaScript: () => mockRead()
        }
      }))
      mockLoad.mockResolvedValue(undefined)
      mockRead.mockResolvedValue({
        title: 'Persona 3 Reload',
        status: status === 'cracked' ? 'Cracked' : 'DRM Free',
        protection: 'Denuvo',
        group: 'voices38',
        crackDate: 'Sep 5, 2026'
      })
      mockFetch.mockResolvedValue([])
      const original = await getReleaseDrm({
        id: 'persona-3-reload',
        title: 'Persona 3 Reload',
        refresh: true
      })
      expect(original.status).toBe(status)
      mockLoad.mockRejectedValueOnce(new Error('Network unavailable'))
      mockFetch.mockRejectedValue(new Error('Reddit HTTP 403'))
      const offline = await getReleaseDrm({
        id: 'persona-3-reload',
        title: 'Persona 3 Reload',
        refresh: true
      })
      expect(offline).toMatchObject({
        status,
        stale: true,
        checkedAt: original.checkedAt
      })
      expect(
        offline.sources.find((source) => source.name === 'IsItCracked')
      ).toEqual(original.sources[0])
      mockRead.mockResolvedValue({ title: 'Game not found' })
      const changed = await getReleaseDrm({
        id: 'persona-3-reload',
        title: 'Persona 3 Reload',
        refresh: true
      })
      expect(changed).toMatchObject({
        status,
        stale: true,
        checkedAt: original.checkedAt
      })
      const stored = JSON.parse(
        await readFile(
          join(mockDirectory, 'releases', 'drm-cache.json'),
          'utf8'
        )
      )
      expect(stored[0].report.status).toBe(status)
      expect(stored[0].report.sources).toContainEqual(
        expect.objectContaining({ name: 'IsItCracked', group: 'voices38' })
      )
      expect(mockFetch).toHaveBeenCalledTimes(3)
      const calls = mockLoad.mock.calls.length
      const netCalls = mockFetch.mock.calls.length
      const confirmedPath = join(
        mockDirectory,
        'releases',
        'drm-confirmed',
        stored[0].key + '.json'
      )
      const oldVersion = JSON.parse(await readFile(confirmedPath, 'utf8'))
      oldVersion.lookupVersion = 1
      await writeFile(confirmedPath, JSON.stringify(oldVersion))
      const realNow = Date.now()
      jest.spyOn(Date, 'now').mockReturnValue(realNow + 2 * 86400000)
      expect(
        (await getReleaseDrm({ id: original.id, title: original.title })).status
      ).toBe(status)
      expect(mockLoad).toHaveBeenCalledTimes(calls)
      // Simulate eviction from the rolling cache and a new application process.
      await writeFile(join(mockDirectory, 'releases', 'drm-cache.json'), '[]')
      jest.resetModules()
      const restarted = await import('../drm')
      const restored = await restarted.getReleaseDrm({
        id: original.id,
        title: original.title
      })
      expect(restored).toMatchObject({
        status,
        checkedAt: original.checkedAt
      })
      expect(mockLoad).toHaveBeenCalledTimes(calls)
      expect(mockFetch).toHaveBeenCalledTimes(netCalls)
      // An explicit manual check still reaches the providers and can change the verdict.
      mockRead.mockResolvedValue({ title: original.title, status: 'Uncracked' })
      mockFetch.mockResolvedValue([])
      expect(
        (
          await restarted.getReleaseDrm({
            id: original.id,
            title: original.title,
            refresh: true
          })
        ).status
      ).toBe('uncracked')
      expect(mockLoad).toHaveBeenCalledTimes(calls + 1)
      await expect(
        readFile(
          join(
            mockDirectory,
            'releases',
            'drm-confirmed',
            stored[0].key + '.json'
          )
        )
      ).rejects.toMatchObject({ code: 'ENOENT' })
      jest.spyOn(Date, 'now').mockReturnValue(realNow + 3 * 86400000)
      await restarted.getReleaseDrm({ id: original.id, title: original.title })
      expect(mockLoad).toHaveBeenCalledTimes(calls + 2)
    } finally {
      jest.restoreAllMocks()
      if (resolve(mockDirectory).startsWith(root + sep))
        await rm(mockDirectory, { recursive: true, force: true })
    }
  }
)

it('persists a Reddit-only public-post confirmation and keeps it across an outage and restart', async () => {
  const root = resolve('build/release-drm-tests')
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'reddit-'))
  try {
    jest.resetModules()
    const { getReleaseDrm } = await import('../drm')
    mockLoad.mockRejectedValue(new Error('IsItCracked indisponível'))
    const url =
      'https://www.reddit.com/r/CrackWatch/comments/1x6xft4/enshroudedrune/'
    const html =
      '<shreddit-post id="t3_1x6xft4" subreddit-name="CrackWatch" permalink="/r/CrackWatch/comments/1x6xft4/enshroudedrune/" post-title="Enshrouded-RUNE" created-timestamp="2026-10-15T20:59:09Z"><shreddit-post-flair>Release</shreddit-post-flair></shreddit-post>'
    mockFetch.mockResolvedValue(
      parseCrackWatch(
        { data: { children: [{ data: parseRedditPage(html, url).post }] } },
        'Enshrouded'
      )
    )
    const query = { id: 'enshrouded', title: 'Enshrouded' }
    const confirmed = await getReleaseDrm(query)
    expect(confirmed.status).toBe('cracked')
    expect(confirmed.sources).toContainEqual(
      expect.objectContaining({ name: 'CrackWatch', url, status: 'cracked' })
    )
    await getReleaseDrm(query)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    mockFetch.mockRejectedValue(new Error('Reddit HTTP 403'))
    expect(
      await getReleaseDrm({ ...query, refresh: true, manual: 'general' })
    ).toMatchObject({ status: 'cracked', stale: true })
    await writeFile(join(mockDirectory, 'releases', 'drm-cache.json'), '[]')
    jest.resetModules()
    const restarted = await import('../drm')
    expect((await restarted.getReleaseDrm(query)).status).toBe('cracked')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  } finally {
    if (resolve(mockDirectory).startsWith(root + sep))
      await rm(mockDirectory, { recursive: true, force: true })
  }
})

it('persists a source listing with its original timestamp across an access failure and restart', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-17T12:00:00Z'))
  const root = resolve('build/release-drm-tests')
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'source-listing-'))
  try {
    jest.resetModules()
    const { getReleaseDrm } = await import('../drm')
    mockLoad.mockRejectedValue(new Error('Primary offline'))
    mockFetch.mockResolvedValue([])
    const listing = {
      name: 'AnkerGames',
      url: 'https://ankergames.net/game/test',
      title: 'Test',
      availability: 'listed',
      observedAt: '2026-10-17T12:00:00Z'
    }
    mockAdditional.mockResolvedValue([listing])
    const query = { id: 'test', title: 'Test' }
    expect((await getReleaseDrm(query)).sources).toContainEqual(listing)
    jest.setSystemTime(new Date('2026-10-18T12:00:00Z'))
    mockAdditional.mockResolvedValue([
      {
        name: 'AnkerGames',
        url: listing.url,
        notice: 'Consulta indisponível (HTTP 429).'
      }
    ])
    const offline = await getReleaseDrm({ ...query, refresh: true })
    expect(offline.stale).toBe(true)
    expect(offline.checkedAt).toBe('2026-10-17T12:00:00.000Z')
    expect(offline.lastAttemptAt).toBe('2026-10-18T12:00:00.000Z')
    expect(
      offline.sources.find((source) => source.name === 'AnkerGames')
    ).toMatchObject({
      ...listing,
      notice: expect.stringContaining('Último resultado válido')
    })
    jest.resetModules()
    const restarted = await import('../drm')
    const restored = await restarted.getReleaseDrm(query)
    expect(
      restored.sources.find((source) => source.name === 'AnkerGames')
    ).toEqual(offline.sources.find((source) => source.name === 'AnkerGames'))
    expect(restored.status).toBe('unknown')
    expect(mockAdditional).toHaveBeenCalledTimes(2)
  } finally {
    jest.useRealTimers()
    if (resolve(mockDirectory).startsWith(root + sep))
      await rm(mockDirectory, { recursive: true, force: true })
  }
})
