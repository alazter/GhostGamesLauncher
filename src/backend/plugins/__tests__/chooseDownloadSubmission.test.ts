import {
  submitChooseDownloadSource,
  useChooseDownloadModal
} from 'frontend/state/ChooseDownloadModal'
import type {
  ExternalActionResult,
  GhostSearchResult
} from 'common/types/plugins'

const game: GhostSearchResult = {
  id: 'over-the-hill',
  title: 'over the hill',
  version: '261016',
  providerId: 'com.ghost.ankergames-source',
  providerName: 'AnkerGames',
  platform: 'windows'
}
const install = jest.fn<Promise<ExternalActionResult>, [unknown]>()
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { api: { externalGamesInstall: install } }
  })
  useChooseDownloadModal.setState({
    isOpen: true,
    game,
    title: game.title,
    loadingSources: false,
    isTorboxConfigured: true,
    replaceInstallationId: 'installed-game',
    targetDirectory: 'S:\\Games',
    sources: [
      {
        id: 'anker-browser-direct',
        name: 'Download direto',
        type: 'external',
        url: 'https://example.com/game'
      },
      {
        id: 'torrent',
        name: 'TorBox',
        type: 'torbox',
        url: 'https://example.com/game'
      }
    ]
  })
})

afterAll(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

it.each(['anker-browser-direct', 'torrent'])(
  'closes and opens Downloads before a slow %s request finishes, accepting only one click',
  async (sourceId) => {
    let resolve!: (result: ExternalActionResult) => void
    install.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const accepted = jest.fn(() => {
      expect(useChooseDownloadModal.getState().isOpen).toBe(false)
      expect(install).not.toHaveBeenCalled()
    })
    const pending = submitChooseDownloadSource(sourceId, accepted)
    expect(useChooseDownloadModal.getState().isOpen).toBe(false)
    expect(accepted).toHaveBeenCalledTimes(1)
    expect(install).toHaveBeenCalledWith({
      game,
      sourceId,
      replaceInstallationId: 'installed-game',
      targetDirectory: 'S:\\Games',
      confirmed: true
    })
    expect(await submitChooseDownloadSource(sourceId, accepted)).toBeUndefined()
    expect(install).toHaveBeenCalledTimes(1)
    resolve({ success: true, jobId: 'job' })
    expect(await pending).toEqual({ success: true, jobId: 'job' })
  }
)

it('does not close a newly opened chooser when an earlier request completes', async () => {
  let resolve!: (result: ExternalActionResult) => void
  install.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const accepted = jest.fn()
  const pending = submitChooseDownloadSource('anker-browser-direct', accepted)
  const next = { ...game, id: 'another-game', title: 'Another Game' }
  useChooseDownloadModal.setState({ isOpen: true, game: next })
  resolve({ success: true, jobId: 'first-job' })
  await pending
  expect(useChooseDownloadModal.getState()).toMatchObject({
    isOpen: true,
    game: next
  })
  expect(accepted).toHaveBeenCalledTimes(1)
})

it('returns preparation errors for presentation after closing the chooser', async () => {
  install.mockResolvedValue({
    success: false,
    error: 'A fonte está indisponível.'
  })
  expect(
    await submitChooseDownloadSource('anker-browser-direct', jest.fn())
  ).toEqual({ success: false, error: 'A fonte está indisponível.' })
  expect(useChooseDownloadModal.getState().isOpen).toBe(false)
})

it('handles an IPC rejection without leaving the chooser open or losing the error', async () => {
  install.mockRejectedValue(new Error('Falha de comunicação'))
  expect(
    await submitChooseDownloadSource('anker-browser-direct', jest.fn())
  ).toEqual({ success: false, error: 'Falha de comunicação' })
  expect(useChooseDownloadModal.getState().isOpen).toBe(false)
})

it('keeps the chooser available when TorBox is not configured', async () => {
  useChooseDownloadModal.setState({ isTorboxConfigured: false })
  const accepted = jest.fn()
  expect(await submitChooseDownloadSource('torrent', accepted)).toMatchObject({
    success: false
  })
  expect(useChooseDownloadModal.getState().isOpen).toBe(true)
  expect(accepted).not.toHaveBeenCalled()
  expect(install).not.toHaveBeenCalled()
})

it('does not submit a source while the choices are loading or if it is no longer listed', async () => {
  const accepted = jest.fn()
  useChooseDownloadModal.setState({ loadingSources: true })
  expect(
    await submitChooseDownloadSource('anker-browser-direct', accepted)
  ).toBeUndefined()
  useChooseDownloadModal.setState({ loadingSources: false })
  expect(
    await submitChooseDownloadSource('removed-source', accepted)
  ).toMatchObject({ success: false })
  expect(useChooseDownloadModal.getState().isOpen).toBe(true)
  expect(accepted).not.toHaveBeenCalled()
  expect(install).not.toHaveBeenCalled()
})

it('preserves silent cancellation from the installation preflight', async () => {
  install.mockResolvedValue({ success: false })
  expect(
    await submitChooseDownloadSource('anker-browser-direct', jest.fn())
  ).toEqual({ success: false })
})
