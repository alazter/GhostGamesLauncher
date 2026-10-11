import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises'
import { resolve, join, sep } from 'path'

let mockDirectory: string
const mockLoad = jest.fn()
const mockRead = jest.fn()
const mockFetch = jest.fn()
jest.mock('../drmSheets', () => ({
  getCrackWatchSheetSources: async () => ({
    sources: [],
    warning: '',
    stale: false
  })
}))
jest.mock('../drmSites', () => ({ getAdditionalDrmSources: async () => [] }))
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
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { children: [] } })
      })
      const original = await getReleaseDrm({
        id: 'persona-3-reload',
        title: 'Persona 3 Reload',
        refresh: true
      })
      expect(original.status).toBe(status)
      mockLoad.mockRejectedValueOnce(new Error('Network unavailable'))
      mockFetch.mockResolvedValue({ ok: false, status: 403 })
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
      expect(
        mockFetch.mock.calls.filter((call) =>
          String(call[0]).includes('/search.json')
        )
      ).toHaveLength(2)
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
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { children: [] } })
      })
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
