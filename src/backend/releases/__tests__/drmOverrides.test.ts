import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'fs/promises'
import { resolve, join, sep } from 'path'
import { displayedDrmStatus, isConfirmedDrmReport } from 'common/releaseDrm'

let mockDirectory = ''
const mockRead = jest.fn()
const mockReddit = jest.fn()
const mockSourceAccess = jest.fn()
jest.mock('../drmManual', () => ({
  readSourceWithUserAccess: (...args: unknown[]) => mockSourceAccess(...args)
}))
jest.mock('electron', () => ({
  app: { getPath: () => mockDirectory },
  session: {
    fromPartition: () => ({
      setPermissionRequestHandler: jest.fn(),
      webRequest: { onBeforeRequest: jest.fn() }
    })
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: () => Promise.resolve(),
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
jest.mock('../drmReddit', () => ({
  readCrackWatch: () => mockReddit(),
  readCrackWatchIndex: () => Promise.resolve([]),
  crackWatchSearchUrl: () => 'https://www.reddit.com/r/CrackWatch/search/'
}))
jest.mock('../drmSheets', () => ({
  getCrackWatchSheetSources: () =>
    Promise.resolve({ sources: [], warning: '', stale: false })
}))
jest.mock('../drmSites', () => ({
  getAdditionalDrmSources: () => Promise.resolve([])
}))
const root = resolve('build/release-drm-tests')
const game = {
  id: 'warhammer-40000-boltgun-2',
  title: 'Warhammer 40,000: Boltgun 2'
}
beforeEach(async () => {
  jest.resetModules()
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'overrides-'))
  mockRead.mockResolvedValue({ title: game.title, status: 'Uncracked' })
  mockReddit.mockResolvedValue([
    {
      name: 'CrackWatch',
      url: 'https://www.reddit.com/r/CrackWatch/comments/abc123/boltgun/',
      status: 'cracked'
    }
  ])
})
afterEach(async () => {
  if (resolve(mockDirectory).startsWith(root + sep))
    await rm(mockDirectory, { recursive: true, force: true })
})

it('saves a manual verdict, keeps conflicting source evidence and survives restart and rolling cache removal', async () => {
  const drm = await import('../drm')
  expect((await drm.getReleaseDrm(game)).status).toBe('conflicting')
  const updated = await drm.setReleaseDrmManual({ ...game, status: 'cracked' })
  expect(displayedDrmStatus(updated)).toBe('cracked')
  expect(updated.status).toBe('conflicting')
  expect(updated.sources).toHaveLength(4)
  expect(isConfirmedDrmReport(updated)).toBe(true)
  const reads = mockRead.mock.calls.length
  await drm.getReleaseDrm(game)
  expect(mockRead).toHaveBeenCalledTimes(reads)
  await writeFile(join(mockDirectory, 'releases', 'drm-cache.json'), '[]')
  jest.resetModules()
  const restarted = await import('../drm')
  const restored = await restarted.getReleaseDrm(game)
  expect(displayedDrmStatus(restored)).toBe('cracked')
  expect(restored.manualOverride?.updatedAt).toBe(
    updated.manualOverride?.updatedAt
  )
  expect(mockRead).toHaveBeenCalledTimes(reads)
})

it('allows a manual refresh to update evidence while preserving the user choice; clearing restores the computed verdict', async () => {
  const drm = await import('../drm')
  await drm.getReleaseDrm(game)
  await drm.setReleaseDrmManual({ ...game, status: 'cracked' })
  const refresh = await drm.getReleaseDrm({ ...game, refresh: true })
  expect(refresh.status).toBe('conflicting')
  expect(displayedDrmStatus(refresh)).toBe('cracked')
  expect(mockRead).toHaveBeenCalledTimes(2)
  const cleared = await drm.setReleaseDrmManual({ ...game, status: null })
  expect(cleared.manualOverride).toBeUndefined()
  expect(displayedDrmStatus(cleared)).toBe('conflicting')
})

it('does not create a fabricated source when the user edits before a lookup and does not confuse another edition', async () => {
  const drm = await import('../drm')
  const result = await drm.setReleaseDrmManual({ ...game, status: 'drm-free' })
  expect(result.sources).toEqual([])
  expect(displayedDrmStatus(result)).toBe('drm-free')
  expect(mockRead).not.toHaveBeenCalled()
  const { readDrmOverride } = await import('../drmOverrides')
  expect(
    await readDrmOverride({ ...game, title: game.title + ' Deluxe Edition' })
  ).toBeUndefined()
  const revised = await drm.setReleaseDrmManual({
    ...game,
    status: 'uncracked'
  })
  expect(isConfirmedDrmReport(revised)).toBe(false)
  await drm.getReleaseDrm(game)
  expect(mockRead).toHaveBeenCalledTimes(1)
})

it('rejects invalid edits and ignores corrupt files without trusting a manually supplied conflicting status', async () => {
  const { writeDrmOverride, readDrmOverride } = await import('../drmOverrides')
  await expect(
    writeDrmOverride({ ...game, id: '../bad' }, 'cracked')
  ).rejects.toThrow('inválido')
  await expect(writeDrmOverride(game, 'conflicting' as never)).rejects.toThrow(
    'inválido'
  )
  await writeDrmOverride(game, 'cracked')
  const directory = join(mockDirectory, 'releases', 'drm-overrides')
  const file = join(directory, (await readdir(directory))[0])
  const stored = JSON.parse(await readFile(file, 'utf8')) as Record<
    string,
    unknown
  >
  await writeFile(file, JSON.stringify({ ...stored, title: 'Other game' }))
  expect(await readDrmOverride(game)).toBeUndefined()
  await writeFile(file, '{')
  expect(await readDrmOverride(game)).toBeUndefined()
})

it('rechecks only the source opened by the user and keeps the manual verdict and other sources', async () => {
  const drm = await import('../drm')
  const original = await drm.getReleaseDrm(game)
  await drm.setReleaseDrmManual({ ...game, status: 'cracked' })
  const source = {
    name: 'HizSearch',
    url: 'https://hizsearch.pages.dev/?q=boltgun%202',
    availability: 'listed',
    title: game.title,
    observedAt: new Date().toISOString()
  }
  mockSourceAccess.mockResolvedValue(source)
  const updated = await drm.openReleaseDrmSource({
    ...game,
    source: 'HizSearch',
    url: source.url
  })
  expect(displayedDrmStatus(updated)).toBe('cracked')
  expect(updated.sources.filter((item) => item.name !== 'HizSearch')).toEqual(
    original.sources
  )
  expect(updated.sources).toContainEqual(source)
  expect(mockRead).toHaveBeenCalledTimes(1)
  expect(mockReddit).toHaveBeenCalledTimes(1)
  mockSourceAccess.mockResolvedValue({
    name: 'HizSearch',
    url: source.url,
    requiresVerification: true,
    notice: 'A verificação expirou.'
  })
  const expired = await drm.openReleaseDrmSource({
    ...game,
    source: 'HizSearch',
    url: source.url
  })
  expect(
    expired.sources.find((item) => item.name === 'HizSearch')
  ).toMatchObject({
    availability: 'listed',
    observedAt: source.observedAt,
    requiresVerification: true
  })
  await expect(
    drm.openReleaseDrmSource({
      ...game,
      source: 'HizSearch',
      url: 'https://evil.example/'
    })
  ).rejects.toThrow('inválida')
  await expect(
    drm.openReleaseDrmSource({
      ...game,
      source: 'AnkerGames' as never,
      url: 'https://ankergames.net/game/test'
    })
  ).rejects.toThrow('inválida')
  expect(mockSourceAccess).toHaveBeenCalledTimes(2)
})
