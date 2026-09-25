import { EventEmitter } from 'events'
import {
  connectAccount,
  disconnectAccount,
  getAccountStatuses,
  getAccountStatusesWithProfiles,
  openAccountGame,
  setXboxClientId,
  syncAccount
} from '../service'
import { libraryStore } from '../../sideload/electronStores'
import { session, shell } from 'electron'
import type { GameInfo } from 'common/types'

let mockCurrentUrl = 'https://account.battle.net/overview'
const mockExecuteJavaScript = jest.fn()
const mockPopupHandler = jest.fn()
const mockLoadUrl = jest.fn()
const mockData: Record<string, unknown> = {}
const mockSession = {
  fetch: jest.fn(),
  clearStorageData: jest.fn(),
  closeAllConnections: jest.fn(),
  setPermissionRequestHandler: jest.fn(),
  setPermissionCheckHandler: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  webRequest: { onBeforeSendHeaders: jest.fn() }
}
const mockWindows: Array<EventEmitter & { destroyed: boolean }> = []
jest.mock('electron-store', () => ({
  __esModule: true,
  default: class {
    get(key: string) {
      return mockData[key] ?? (key === 'accounts' ? {} : '')
    }
    set(key: string, value: unknown) {
      mockData[key] = value
    }
  }
}))
jest.mock('electron', () => {
  const { EventEmitter: Emitter } =
    jest.requireActual<typeof import('events')>('events')
  return {
    session: { fromPartition: jest.fn() },
    shell: { openExternal: jest.fn() },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(value),
      decryptString: (value: Buffer) => value.toString()
    },
    BrowserWindow: class extends Emitter {
      destroyed = false
      webContents = Object.assign(new Emitter(), {
        setWindowOpenHandler: mockPopupHandler,
        executeJavaScript: mockExecuteJavaScript,
        mainFrame: {
          framesInSubtree: [{ executeJavaScript: mockExecuteJavaScript }]
        },
        getURL: () => mockCurrentUrl
      })
      constructor() {
        super()
        mockWindows.push(this)
      }
      loadURL(url: string) {
        return mockLoadUrl(url) ?? Promise.resolve()
      }
      isDestroyed() {
        return this.destroyed
      }
      destroy() {
        this.destroyed = true
        this.emit('closed')
      }
    }
  }
})
jest.mock('../../sideload/electronStores', () => ({
  libraryStore: { get: jest.fn(), set: jest.fn() }
}))
jest.mock('../../sideload/steamgridHelper', () => ({
  getApiKey: () => '',
  fetchCoverFromSteamGridDB: jest.fn()
}))
jest.mock('backend/ipc', () => ({ sendFrontendMessage: jest.fn() }))
jest.mock('backend/logger', () => ({
  logWarning: jest.fn(),
  logInfo: jest.fn()
}))

const game = (appName: string, provider?: 'battlenet' | 'ea'): GameInfo => ({
  app_name: appName,
  accountProvider: provider,
  runner: 'sideload',
  title: appName,
  art_cover: '',
  art_square: '',
  install: {},
  is_installed: false,
  canRunOffline: false
})

beforeEach(() => {
  mockCurrentUrl = 'https://account.battle.net/overview'
  for (const key of Object.keys(mockData)) delete mockData[key]
  mockData.accounts = {
    battlenet: {
      status: { provider: 'battlenet', connected: true, gameCount: 1 }
    }
  }
  jest
    .mocked(session.fromPartition)
    .mockReturnValue(mockSession as unknown as Electron.Session)
  jest
    .mocked(libraryStore.get)
    .mockReturnValue([
      game('local'),
      game('old', 'battlenet'),
      game('ea', 'ea')
    ])
  mockSession.clearStorageData.mockResolvedValue(undefined)
  mockSession.closeAllConnections.mockResolvedValue(undefined)
})

it('imports a verified catalog and preserves other stores and manual games', async () => {
  mockSession.fetch.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/api/')
        ? { authenticated: true }
        : url.endsWith('classic-games')
          ? { classicGames: [] }
          : { gameAccounts: [{ titleId: 42, localizedGameName: 'Game' }] }
  }))
  const result = await syncAccount('battlenet')
  expect(result.success).toBe(true)
  const games = jest.mocked(libraryStore.set).mock.calls[0][1] as GameInfo[]
  expect(games.map((entry) => entry.app_name)).toEqual([
    'local',
    'ea',
    'account-battlenet-42'
  ])
  expect(games[2].is_installed).toBe(false)
})

it('preserves the cache on network failure and never exposes response secrets', async () => {
  mockSession.fetch.mockRejectedValue(new Error('PRIVATE_TOKEN_IN_URL'))
  const result = await syncAccount('battlenet')
  expect(result.success).toBe(false)
  expect(JSON.stringify(result)).not.toContain('PRIVATE_TOKEN')
  expect(libraryStore.set).not.toHaveBeenCalled()
  expect(
    getAccountStatuses().find((entry) => entry.provider === 'battlenet')
      ?.gameCount
  ).toBe(1)
})

it('disconnects only the requested provider', async () => {
  expect((await disconnectAccount('battlenet')).success).toBe(true)
  expect(libraryStore.set).toHaveBeenCalledWith('games', [
    game('local'),
    game('ea', 'ea')
  ])
  expect(mockSession.clearStorageData).toHaveBeenCalledTimes(1)
  expect(
    getAccountStatuses().find((entry) => entry.provider === 'battlenet')
      ?.connected
  ).toBe(false)
})

it('does not pretend Xbox can connect without an app registration', async () => {
  const result = await connectAccount('xbox')
  expect(result.success).toBe(false)
  expect(JSON.stringify(result)).toContain('ID do aplicativo')
  expect(libraryStore.set).not.toHaveBeenCalled()
  expect(() => setXboxClientId('not-an-id')).toThrow()
})

it('cancels a closed authentication window without importing anything', async () => {
  const result = connectAccount('battlenet')
  await Promise.resolve()
  await Promise.resolve()
  mockWindows[mockWindows.length - 1]?.emit('closed')
  expect(await result).toEqual(
    expect.objectContaining({ success: false, cancelled: true })
  )
  expect(libraryStore.set).not.toHaveBeenCalled()
})

it('rejects arbitrary store URLs including deceptive suffixes', async () => {
  jest.mocked(libraryStore.get).mockReturnValue([
    {
      ...game('attack', 'battlenet'),
      store_url: 'https://account.battle.net.attacker.example/'
    }
  ])
  await expect(openAccountGame('attack')).rejects.toThrow('Invalid store URL')
  expect(shell.openExternal).not.toHaveBeenCalled()
})

it('aborts pending authentication requests and ignores a late response after closing', async () => {
  jest.useFakeTimers()
  try {
    let finishRequest: ((response: unknown) => void) | undefined
    mockSession.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve
        })
    )
    const result = connectAccount('battlenet')
    await jest.advanceTimersByTimeAsync(2500)
    expect(mockSession.fetch).toHaveBeenCalledTimes(1)
    const options = mockSession.fetch.mock.calls[0][1] as RequestInit
    mockWindows[mockWindows.length - 1]?.emit('closed')
    expect(await result).toEqual(
      expect.objectContaining({ success: false, cancelled: true })
    )
    expect(options.signal?.aborted).toBe(true)
    finishRequest?.({
      ok: true,
      json: () => Promise.resolve({ authenticated: true })
    })
    await jest.advanceTimersByTimeAsync(0)
    expect(mockSession.fetch).toHaveBeenCalledTimes(1)
    expect(libraryStore.set).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

it('completes Battle.net login on a localized account route', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://account.battle.net/pt-br/overview'
    mockSession.fetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith('/api/')
          ? { authenticated: true }
          : url.endsWith('classic-games')
            ? { classicGames: [] }
            : { gameAccounts: [] }
    }))
    const result = connectAccount('battlenet')
    await jest.advanceTimersByTimeAsync(2500)
    expect((await result).success).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

it('preserves the OAuth popup opener and rejects unrelated destinations', async () => {
  const result = connectAccount('ea')
  await Promise.resolve()
  await Promise.resolve()
  const handler = mockPopupHandler.mock.calls.at(-1)![0] as (details: {
    url: string
  }) => {
    action: string
    overrideBrowserWindowOptions?: { webPreferences: { sandbox: boolean } }
  }
  expect(handler({ url: 'https://accounts.ea.com/connect/auth' })).toEqual(
    expect.objectContaining({ action: 'allow' })
  )
  expect(
    handler({ url: 'https://accounts.ea.com/connect/auth' })
      .overrideBrowserWindowOptions?.webPreferences.sandbox
  ).toBe(true)
  expect(handler({ url: 'https://ea.com.attacker.example/' }).action).toBe(
    'deny'
  )
  mockWindows.at(-1)?.emit('closed')
  await result
})

it('opens the EA catalog once after a localized return instead of waiting forever', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/pt-br/games'
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(7500)
    expect(
      mockLoadUrl.mock.calls.filter(
        ([url]) => url === 'https://www.ea.com/sales/deals'
      )
    ).toHaveLength(1)
    mockWindows.at(-1)?.emit('closed')
    await result
  } finally {
    jest.useRealTimers()
  }
})

it('reports Ubisoft browser restriction promptly without importing a library', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://connect.ubisoft.com/login'
    mockExecuteJavaScript.mockResolvedValue(true)
    const result = connectAccount('ubisoft')
    await jest.advanceTimersByTimeAsync(2500)
    expect(await result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Ubisoft restringiu')
      })
    )
    expect(libraryStore.set).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

it('waits for Battle.net authentication while the OAuth opener remains on its original URL', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl =
      'https://account.battle.net/oauth2/authorization/account-settings'
    let authenticated = false
    mockSession.fetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith('/api/')
          ? { authenticated }
          : url.endsWith('classic-games')
            ? { classicGames: [] }
            : { gameAccounts: [] }
    }))
    const result = connectAccount('battlenet')
    await jest.advanceTimersByTimeAsync(2500)
    expect(mockWindows.at(-1)?.destroyed).toBe(false)
    expect(libraryStore.set).not.toHaveBeenCalled()
    authenticated = true
    await jest.advanceTimersByTimeAsync(2500)
    expect((await result).success).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

function captureEaToken(token = 'Bearer account-token') {
  const listener = mockSession.webRequest.onBeforeSendHeaders.mock.calls.at(
    -1
  )![1] as (details: unknown, callback: (value: unknown) => void) => void
  listener({ requestHeaders: { Authorization: token } }, () => undefined)
}

it('keeps a verified EA login connected when importing fails without deleting cached games', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/'
    mockSession.fetch.mockImplementation(async () => {
      if (mockSession.fetch.mock.calls.length === 1)
        return {
          ok: true,
          json: async () => ({ data: { me: { id: 'ea-user' } } })
        }
      throw new Error('HTTP_503')
    })
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(0)
    captureEaToken()
    await jest.advanceTimersByTimeAsync(2500)
    expect((await result).success).toBe(false)
    expect(getAccountStatuses().find((a) => a.provider === 'ea')).toEqual(
      expect.objectContaining({
        connected: true,
        error: expect.stringContaining('importação falhou')
      })
    )
    expect(libraryStore.set).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

it('does not treat an anonymous EA service token as a logged-in account', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/'
    mockSession.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { me: null } })
    })
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(0)
    captureEaToken('Bearer anonymous-token')
    await jest.advanceTimersByTimeAsync(2500)
    expect(mockWindows.at(-1)?.destroyed).toBe(false)
    expect(
      getAccountStatuses().find((a) => a.provider === 'ea')?.connected
    ).toBe(false)
    mockWindows.at(-1)?.emit('closed')
    await result
  } finally {
    jest.useRealTimers()
  }
})

it('imports the EA library after verifying the account identity', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/'
    mockSession.fetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        data: {
          me:
            mockSession.fetch.mock.calls.length === 1
              ? { id: 'ea-user' }
              : {
                  id: 'ea-user',
                  ownedGameProducts: {
                    totalCount: 1,
                    next: null,
                    items: [{ id: 'offer', product: { name: 'Test game' } }]
                  }
                }
        }
      })
    }))
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(0)
    captureEaToken()
    await jest.advanceTimersByTimeAsync(2500)
    expect(await result).toEqual(
      expect.objectContaining({
        success: true,
        status: expect.objectContaining({ connected: true, gameCount: 1 })
      })
    )
  } finally {
    jest.useRealTimers()
  }
})

it('keeps EA login open when loadURL is interrupted by navigation', async () => {
  jest.useFakeTimers()
  try {
    mockLoadUrl.mockRejectedValueOnce(
      Object.assign(new Error('ERR_ABORTED'), { code: 'ERR_ABORTED' })
    )
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(0)
    expect(mockWindows.at(-1)?.destroyed).toBe(false)
    mockWindows.at(-1)?.emit('closed')
    await result
  } finally {
    jest.useRealTimers()
  }
})

it('persists a login page error on the provider card', async () => {
  mockLoadUrl.mockRejectedValueOnce(new Error('ERR_CONNECTION_FAILED'))
  const result = await connectAccount('ea')
  expect(result.success).toBe(false)
  expect(
    getAccountStatuses().find((a) => a.provider === 'ea')?.error
  ).toContain('abrir a página')
})

it('reports EA query rejection instead of silently waiting for another token', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/'
    mockSession.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' } }]
      })
    })
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(0)
    captureEaToken()
    await jest.advanceTimersByTimeAsync(2500)
    expect(await result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('recusou a consulta')
      })
    )
    expect(
      getAccountStatuses().find((a) => a.provider === 'ea')?.connected
    ).toBe(false)
  } finally {
    jest.useRealTimers()
  }
})

it('continues EA authentication when the catalog page fails after supplying a token', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/'
    mockLoadUrl.mockImplementation(async (url: string) => {
      if (url.endsWith('/sales/deals')) {
        captureEaToken()
        throw new Error('ERR_FAILED')
      }
    })
    mockSession.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          me: {
            id: 'ea-user',
            ownedGameProducts: { totalCount: 0, next: null, items: [] }
          }
        }
      })
    })
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(5000)
    expect(await result).toEqual(expect.objectContaining({ success: true }))
  } finally {
    jest.useRealTimers()
  }
})

it('recognizes aborted navigation errors from an Electron V8 context', async () => {
  jest.useFakeTimers()
  try {
    mockLoadUrl.mockRejectedValueOnce({
      code: 'ERR_ABORTED',
      errno: -3,
      message: 'ERR_ABORTED (-3) loading a redirect'
    })
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(0)
    expect(mockWindows.at(-1)?.destroyed).toBe(false)
    mockWindows.at(-1)?.emit('closed')
    await result
  } finally {
    jest.useRealTimers()
  }
})

it('reports a cross-context network error without leaking its URL', async () => {
  jest.useFakeTimers()
  try {
    mockCurrentUrl = 'https://www.ea.com/'
    mockLoadUrl.mockResolvedValueOnce(undefined).mockRejectedValueOnce({
      code: 'ERR_CONNECTION_RESET',
      message: 'ERR_CONNECTION_RESET at https://example.com/?token=PRIVATE'
    })
    const result = connectAccount('ea')
    await jest.advanceTimersByTimeAsync(2500)
    const outcome = await result
    expect(JSON.stringify(outcome)).toContain('ERR_CONNECTION_RESET')
    expect(JSON.stringify(outcome)).not.toContain('PRIVATE')
  } finally {
    jest.useRealTimers()
  }
})

it('imports all EA cursor pages even if the advertised total differs from filtered records', async () => {
  mockData.accounts = {
    ea: {
      status: { provider: 'ea', connected: true, gameCount: 0 },
      secret: Buffer.from(
        JSON.stringify({ token: 'Bearer test', userId: 'ea-user' })
      ).toString('base64')
    }
  }
  mockSession.fetch.mockImplementation(async (url: string) => {
    const cursor = JSON.parse(new URL(url).searchParams.get('variables')!).next
    const first = cursor === '0'
    return {
      ok: true,
      json: async () => ({
        data: {
          me: {
            id: 'ea-user',
            ownedGameProducts: {
              totalCount: first ? 10 : 9,
              next: first ? 'page2' : null,
              items: [
                {
                  id: first ? 'offer1' : 'offer2',
                  product: { name: first ? 'Game 1' : 'Game 2' }
                }
              ]
            }
          }
        }
      })
    }
  })
  expect(await syncAccount('ea')).toEqual(
    expect.objectContaining({
      success: true,
      status: expect.objectContaining({ gameCount: 2 })
    })
  )
  expect(mockSession.fetch).toHaveBeenCalledTimes(2)
})

it('still rejects EA cursor loops and preserves cached games', async () => {
  mockData.accounts = {
    ea: {
      status: { provider: 'ea', connected: true, gameCount: 1 },
      secret: Buffer.from(
        JSON.stringify({ token: 'Bearer test', userId: 'ea-user' })
      ).toString('base64')
    }
  }
  mockSession.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        me: {
          id: 'ea-user',
          ownedGameProducts: {
            next: '0',
            items: [{ id: 'offer', product: { name: 'Game' } }]
          }
        }
      }
    })
  })
  // Prevent the existing reauthentication fallback from waiting for a browser token.
  mockLoadUrl.mockRejectedValueOnce(new Error('HTTP_401'))
  expect((await syncAccount('ea')).success).toBe(false)
  expect(libraryStore.set).not.toHaveBeenCalled()
})

it('loads actual EA and Battle.net nicknames for already connected accounts', async () => {
  mockData.accounts = {
    ea: {
      status: {
        provider: 'ea',
        connected: true,
        username: 'EA · 123',
        gameCount: 52
      }
    },
    battlenet: {
      status: {
        provider: 'battlenet',
        connected: true,
        username: 'Battle.net',
        gameCount: 11
      }
    }
  }
  mockSession.fetch.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes('ea.com')
        ? { authenticated: true, originName: 'EaNickname' }
        : { battleTag: { name: 'BlizzardNickname', code: 1234 } }
  }))
  const statuses = await getAccountStatusesWithProfiles()
  expect(statuses.find((a) => a.provider === 'ea')?.username).toBe('EaNickname')
  expect(statuses.find((a) => a.provider === 'battlenet')?.username).toBe(
    'BlizzardNickname'
  )
  expect(libraryStore.set).not.toHaveBeenCalled()
  await getAccountStatusesWithProfiles()
  expect(mockSession.fetch).toHaveBeenCalledTimes(2)
})

it('does not replace saved nicknames during catalog synchronization', async () => {
  mockData.accounts = {
    battlenet: {
      status: {
        provider: 'battlenet',
        connected: true,
        username: 'MyNickname',
        gameCount: 0
      }
    }
  }
  mockSession.fetch.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/api/')
        ? { authenticated: true }
        : url.endsWith('classic-games')
          ? { classicGames: [] }
          : { gameAccounts: [] }
  }))
  expect(await syncAccount('battlenet')).toEqual(
    expect.objectContaining({
      success: true,
      status: expect.objectContaining({ username: 'MyNickname' })
    })
  )
})
