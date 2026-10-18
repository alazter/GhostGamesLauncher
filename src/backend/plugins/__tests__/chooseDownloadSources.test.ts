import {
  closeChooseDownloadModal,
  openChooseDownloadModal,
  switchChooseDownloadStore,
  useChooseDownloadModal
} from 'frontend/state/ChooseDownloadModal'
import type {
  GhostDownloadSource,
  GhostSearchResult
} from 'common/types/plugins'

const first: GhostSearchResult = {
  id: 'game',
  title: 'Game',
  platform: 'windows',
  providerId: 'first',
  providerName: 'First',
  coverUrl: 'first.jpg',
  size: '12 GB',
  sourceDate: '2026-10-17',
  version: '1.0'
}
const second: GhostSearchResult = {
  ...first,
  providerId: 'second',
  providerName: 'Second',
  coverUrl: 'second.jpg',
  size: '9 GB',
  sourceDate: '2026-10-18',
  version: '2.0'
}
const source: GhostDownloadSource = {
  id: 'direct',
  name: 'Download direto',
  type: 'direct',
  url: 'https://example.com'
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const getSources = jest.fn()
const search = jest.fn()
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

beforeEach(() => {
  closeChooseDownloadModal()
  getSources.mockResolvedValue([source])
  search.mockResolvedValue([])
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: {
        downloadIntegrationsState: () => Promise.resolve({ torboxConfigured: true }),
        pluginsGetDownloadSources: getSources,
        pluginsSearchSources: search
      }
    }
  })
})
afterAll(() => {
  closeChooseDownloadModal()
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

it('uses source artwork and switches all metadata together, clearing missing artwork', async () => {
  await openChooseDownloadModal({
    game: first,
    cover: 'custom-library.jpg',
    availableSources: [first, second]
  })
  expect(useChooseDownloadModal.getState().cover).toBe('first.jpg')
  await switchChooseDownloadStore(second)
  expect(useChooseDownloadModal.getState()).toMatchObject({
    game: second,
    cover: 'second.jpg',
    version: '2.0',
    providerName: 'Second'
  })
  await switchChooseDownloadStore({
    ...first,
    coverUrl: undefined,
    size: undefined,
    sourceDate: undefined
  })
  expect(useChooseDownloadModal.getState().cover).toBeUndefined()
  expect(useChooseDownloadModal.getState().game?.size).toBeUndefined()
  expect(useChooseDownloadModal.getState().game?.sourceDate).toBeUndefined()
})

it('ignores a slower source response after switching stores', async () => {
  await openChooseDownloadModal({
    game: first,
    sources: [source],
    availableSources: [first, second]
  })
  const old = deferred<GhostDownloadSource[]>()
  getSources.mockReturnValueOnce(old.promise)
  const pending = switchChooseDownloadStore(first)
  await switchChooseDownloadStore(second)
  old.resolve([{ ...source, id: 'stale' }])
  await pending
  expect(useChooseDownloadModal.getState()).toMatchObject({
    game: second,
    sources: [source],
    loadingSources: false
  })
})

it('ignores source responses from a closed or replaced dialog', async () => {
  const old = deferred<GhostDownloadSource[]>()
  getSources.mockReturnValueOnce(old.promise)
  const pending = openChooseDownloadModal({
    game: first,
    availableSources: [first, second]
  })
  await Promise.resolve()
  expect(getSources).toHaveBeenCalledTimes(1)
  closeChooseDownloadModal()
  await openChooseDownloadModal({
    game: second,
    sources: [source],
    availableSources: [first, second]
  })
  old.resolve([{ ...source, id: 'stale' }])
  await pending
  expect(useChooseDownloadModal.getState()).toMatchObject({
    isOpen: true,
    game: second,
    sources: [source]
  })
})

it('does not add results from an earlier game search into a new dialog', async () => {
  const old = deferred<GhostSearchResult[]>()
  search.mockReturnValueOnce(old.promise)
  await openChooseDownloadModal({ game: first, sources: [source] })
  await openChooseDownloadModal({
    game: second,
    sources: [source],
    availableSources: [second, first]
  })
  old.resolve([{ ...first, providerId: 'stale' }])
  await Promise.resolve()
  expect(useChooseDownloadModal.getState().availableSources).toEqual([
    second,
    first
  ])
})
