import { mkdtemp, mkdir, rm } from 'fs/promises'
import { resolve, join } from 'path'
let mockDirectory = ''
const mockAdditional = jest.fn()
const mockHiz = jest.fn()
const mockFetch = jest.fn()
jest.mock('../drmReddit', () => ({
  readCrackWatch: (...args: unknown[]) => mockFetch(...args),
  readCrackWatchIndex: async () => [],
  crackWatchSearchUrl: () => 'https://www.reddit.com/r/CrackWatch/search/'
}))
jest.mock('../drmSites', () => ({
  getAdditionalDrmSources: (...args: unknown[]) => mockAdditional(...args)
}))
jest.mock('../drmManual', () => ({
  readHizManualSource: (...args: unknown[]) => mockHiz(...args)
}))
jest.mock('../drmSheets', () => ({
  getCrackWatchSheetSources: async () => ({
    sources: [],
    warning: '',
    stale: false
  })
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
    loadURL: async () => undefined,
    isDestroyed: () => false,
    destroy: jest.fn(),
    webContents: {
      setAudioMuted: jest.fn(),
      setWindowOpenHandler: jest.fn(),
      on: jest.fn(),
      executeJavaScript: async () => ({
        title: 'Test',
        status: 'Uncracked',
        protection: 'Steam'
      })
    }
  }))
}))

it('rejects implicit browser requests and retries only HizSearch after manual verification', async () => {
  const root = resolve('build/release-drm-tests')
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'manual-scope-'))
  try {
    const { getReleaseDrm } = await import('../drm')
    mockFetch.mockResolvedValue([])
    mockAdditional.mockResolvedValue([
      {
        name: 'AnkerGames',
        url: 'https://ankergames.net/game/test',
        title: 'Test',
        availability: 'listed'
      },
      {
        name: 'HizSearch',
        url: 'https://hizsearch.pages.dev/',
        requiresVerification: true
      }
    ])
    mockHiz.mockResolvedValue({
      name: 'HizSearch',
      url: 'https://hizsearch.pages.dev/',
      title: 'Test',
      availability: 'listed'
    })
    await expect(
      getReleaseDrm({ id: 'test', title: 'Test', manual: 'general' })
    ).rejects.toThrow(/inválido/)
    await getReleaseDrm({ id: 'test', title: 'Test', refresh: true })
    expect(mockAdditional).toHaveBeenLastCalledWith('Test', true, false)
    const full = await getReleaseDrm({
      id: 'test',
      title: 'Test',
      refresh: true,
      manual: 'general'
    })
    expect(mockAdditional).toHaveBeenLastCalledWith('Test', true, true)
    const fetches = mockFetch.mock.calls.length,
      reads = mockAdditional.mock.calls.length
    const supplemental = await getReleaseDrm({
      id: 'test',
      title: 'Test',
      refresh: true,
      manual: 'hiz'
    })
    expect(mockFetch).toHaveBeenCalledTimes(fetches)
    expect(mockAdditional).toHaveBeenCalledTimes(reads)
    expect(mockHiz).toHaveBeenCalledWith('Test')
    expect(
      supplemental.sources.filter((source) => source.name !== 'HizSearch')
    ).toEqual(full.sources.filter((source) => source.name !== 'HizSearch'))
    expect(
      supplemental.sources.find((source) => source.name === 'HizSearch')
        ?.requiresVerification
    ).toBeUndefined()
    expect(supplemental.checkedAt).toBe(full.checkedAt)
  } finally {
    await rm(mockDirectory, { recursive: true, force: true })
  }
})
