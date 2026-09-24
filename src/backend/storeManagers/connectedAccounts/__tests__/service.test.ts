import { EventEmitter } from 'events'
import {
  connectAccount,
  disconnectAccount,
  getAccountStatuses,
  openAccountGame,
  setXboxClientId,
  syncAccount
} from '../service'
import { libraryStore } from '../../sideload/electronStores'
import { session, shell } from 'electron'
import type { GameInfo } from 'common/types'

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
        setWindowOpenHandler: jest.fn(),
        getURL: () => 'https://account.battle.net/overview'
      })
      constructor() {
        super()
        mockWindows.push(this)
      }
      loadURL() {
        return Promise.resolve()
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
jest.mock('backend/logger', () => ({ logWarning: jest.fn() }))

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
