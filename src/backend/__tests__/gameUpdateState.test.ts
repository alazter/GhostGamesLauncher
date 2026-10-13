import { GlobalState } from 'frontend/state/GlobalState'
import type {
  ExternalGamesState,
  ExternalInstallation
} from 'common/types/plugins'

jest.mock('frontend/helpers/electronStores', () => {
  const store = {
    get: (_key: string, fallback: unknown) => fallback,
    get_nodefault: () => undefined,
    has: () => false,
    set: jest.fn()
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      platform: 'win32',
      localStorage: { getItem: () => null, setItem: jest.fn() },
      api: {
        checkGameUpdates: jest.fn(),
        refreshLibrary: jest.fn(),
        logError: jest.fn(),
        logInfo: jest.fn(),
        lock: jest.fn(),
        unlock: jest.fn()
      }
    }
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: {}, body: { classList: { toggle: jest.fn() } } }
  })
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value: () => ({ getPropertyValue: () => '' })
  })
  return Object.fromEntries(
    [
      'configStore',
      'gogConfigStore',
      'gogInstalledGamesStore',
      'gogLibraryStore',
      'libraryStore',
      'nileConfigStore',
      'nileLibraryStore',
      'wineDownloaderInfoStore',
      'sideloadLibrary',
      'zoomConfigStore',
      'zoomInstalledGamesStore',
      'zoomLibraryStore',
      'steamConfigStore',
      'steamInstalledGamesStore',
      'steamLibraryStore',
      'gameOverridesStore'
    ].map((name) => [name, store])
  )
})
jest.mock('frontend/helpers', () => ({
  getGameInfo: jest.fn(),
  getLegendaryConfig: jest.fn()
}))
jest.mock('frontend/hooks/constants', () => ({
  clearAvailabilityCache: jest.fn()
}))
jest.mock('frontend/utils/localStorageBackup', () => ({
  syncLocalStorageToBackend: jest.fn()
}))
jest.mock('frontend/helpers/autoStoreAssignments', () => ({
  syncAutoStoreAssignments: jest.fn()
}))
jest.mock('frontend/helpers/gameOverrides', () => ({
  attachGameOverrides: (games: unknown[]) => games
}))
jest.mock('frontend/state/GlobalStateV2', () => ({
  __esModule: true,
  default: { getState: () => ({ gameOverrides: {} }) }
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function externalSnapshot(
  available: boolean,
  appName = 'external-game'
): ExternalGamesState {
  return {
    jobs: [],
    backups: [],
    installations: [
      {
        appName,
        availableUpdate: available ? { id: 'v2' } : undefined
      } as ExternalInstallation
    ]
  }
}

let state: GlobalState
let persistUpdates: jest.SpyInstance<void, [string, string]>
beforeEach(() => {
  const i18n = jest
    .requireActual<typeof import('i18next')>('i18next')
    .createInstance()
  i18n.language = 'pt-BR'
  state = new GlobalState({
    children: null,
    i18n,
    t: jest.fn()
  } as ConstructorParameters<typeof GlobalState>[0])
  // Exercise the real handlers with synchronous React state commits, without
  // mounting the full application or touching the user's stores.
  type State = GlobalState['state']
  type Update =
    | Partial<State>
    | ((previous: State, props: GlobalState['props']) => Partial<State> | null)
    | null
  jest.spyOn(state, 'setState').mockImplementation((update: Update) => {
    const next =
      typeof update === 'function' ? update(state.state, state.props) : update
    if (next) {
      state.state = { ...state.state, ...next }
      state.componentDidUpdate()
    }
  })
  jest.spyOn(state, 'forceUpdate').mockImplementation(() => {})
  persistUpdates = jest.spyOn(window.localStorage, 'setItem')
  jest.mocked(window.api.checkGameUpdates).mockResolvedValue([])
  jest.mocked(window.api.refreshLibrary).mockResolvedValue(undefined)
})

it('clears completed external updates from the filter and persisted count, preserving native updates', () => {
  state.state.gameUpdates = ['steam-game', 'external-game']
  state.handleExternalGamesUpdated(externalSnapshot(true))
  state.handleExternalGamesUpdated(externalSnapshot(false))
  expect(state.state.gameUpdates).toEqual(['steam-game'])
  expect(persistUpdates.mock.calls).toContainEqual([
    'updates',
    '["steam-game"]'
  ])
})

it('receives newly detected external updates without reloading the library', () => {
  state.state.gameUpdates = ['steam-game']
  state.handleExternalGamesUpdated(
    externalSnapshot(true, 'manually-added-game')
  )
  expect(state.state.gameUpdates).toEqual(['steam-game', 'manually-added-game'])
})

it('does not re-render the library for unchanged external download progress', () => {
  state.handleExternalGamesUpdated(externalSnapshot(true))
  const before = state.state
  state.handleExternalGamesUpdated(externalSnapshot(true))
  expect(state.state).toBe(before)
})

it('keeps failed or cancelled external updates available until the backend clears them', () => {
  state.handleExternalGamesUpdated(externalSnapshot(true))
  const snapshot = externalSnapshot(true)
  snapshot.jobs = [{ status: 'error' } as ExternalGamesState['jobs'][number]]
  state.handleExternalGamesUpdated(snapshot)
  expect(state.state.gameUpdates).toEqual(['external-game'])
})

it('does not resurrect a completed external update from an older in-flight check', async () => {
  const check = deferred<string[]>()
  jest.mocked(window.api.checkGameUpdates).mockReturnValue(check.promise)
  state.handleExternalGamesUpdated(externalSnapshot(true))
  const pending = state.refreshGameUpdates()
  state.handleExternalGamesUpdated(externalSnapshot(false))
  check.resolve(['steam-game', 'external-game'])
  await pending
  expect(state.state.gameUpdates).toEqual(['steam-game'])
})

it('removes unregistered external games even when a stale check returns their IDs', async () => {
  state.handleExternalGamesUpdated(externalSnapshot(true))
  state.handleExternalGamesUpdated({ jobs: [], installations: [], backups: [] })
  jest.mocked(window.api.checkGameUpdates).mockResolvedValue(['external-game'])
  await state.refreshGameUpdates()
  expect(state.state.gameUpdates).toEqual([])
})

it('ignores update checks that finish after a newer check', async () => {
  const old = deferred<string[]>()
  jest
    .mocked(window.api.checkGameUpdates)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce([])
  const pending = state.refreshGameUpdates()
  await state.refreshGameUpdates()
  old.resolve(['steam-game'])
  await pending
  expect(state.state.gameUpdates).toEqual([])
})

it('rechecks completion even if the last status was queued and a library refresh is busy', async () => {
  state.state.gameUpdates = ['steam-game']
  state.state.libraryStatus = [
    { appName: 'steam-game', status: 'queued', runner: 'steam' }
  ]
  state.state.refreshing = true
  await state.handleGameStatus({
    appName: 'steam-game',
    status: 'done',
    runner: 'steam'
  })
  expect(window.api.checkGameUpdates).toHaveBeenCalledTimes(1)
  expect(state.state.gameUpdates).toEqual([])
  expect(state.state.libraryStatus).toEqual([])
})

it('handles completion received without a previous status', async () => {
  state.state.gameUpdates = ['steam-game']
  await state.handleGameStatus({
    appName: 'steam-game',
    status: 'done',
    runner: 'steam'
  })
  expect(state.state.gameUpdates).toEqual([])
  expect(state.state.libraryStatus).toEqual([])
})

it.each(['done', 'error'] as const)(
  'preserves pending updates after cancellation/failure reported as %s',
  async (status) => {
    state.state.gameUpdates = ['steam-game']
    state.state.libraryStatus = [
      { appName: 'steam-game', status: 'updating', runner: 'steam' }
    ]
    jest.mocked(window.api.checkGameUpdates).mockResolvedValue(['steam-game'])
    await state.handleGameStatus({
      appName: 'steam-game',
      status,
      runner: 'steam'
    })
    expect(state.state.gameUpdates).toEqual(['steam-game'])
  }
)

it('does not restore captured update IDs when a metadata refresh finishes', async () => {
  const library = deferred<void>()
  jest.mocked(window.api.refreshLibrary).mockReturnValue(library.promise)
  state.state.gog.username = 'user'
  state.state.gameUpdates = ['steam-game', 'external-game']
  const pending = state.refresh()
  state.handleExternalGamesUpdated(externalSnapshot(false))
  library.resolve()
  await pending
  expect(state.state.gameUpdates).toEqual(['steam-game'])
})

it('keeps updates when the backend check fails and records the error', async () => {
  state.state.gameUpdates = ['steam-game']
  jest
    .mocked(window.api.checkGameUpdates)
    .mockRejectedValue(new Error('offline'))
  await state.refreshGameUpdates()
  expect(state.state.gameUpdates).toEqual(['steam-game'])
  expect(window.api.logError).toHaveBeenCalledWith(
    'Game update check failed: Error: offline'
  )
})
