import SideloadLibraryManager from '../library'
import { libraryStore } from '../electronStores'
import { sanitizeExistingSideloadLibrary } from '../scanner'
import { GameInfo } from 'common/types'

jest.mock('backend/storeManagers', () => ({
  libraryManagerMap: {
    sideload: {
      addNewApp: jest.fn()
    }
  }
}))

let mockStore: Record<string, any> = { games: [] }

jest.mock('../electronStores', () => ({
  libraryStore: {
    get: (key: string, def: any) => mockStore[key] ?? def,
    set: (key: string, val: any) => {
      mockStore[key] = val
    }
  },
  sideloadConfigStore: {
    get: jest.fn(),
    set: jest.fn()
  }
}))

jest.mock('backend/logger', () => ({
  logWarning: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  LogPrefix: { DownloadManager: 'DownloadManager' }
}))

jest.mock('backend/shortcuts/shortcuts/shortcuts', () => ({
  addShortcuts: jest.fn()
}))

jest.mock('backend/ipc', () => ({
  sendFrontendMessage: jest.fn(),
  addTestOnlyListener: jest.fn(),
  addListener: jest.fn(),
  addHandler: jest.fn(),
  addOneTimeListener: jest.fn()
}))

import gracefulFs from 'graceful-fs'

describe('SideloadLibraryManager - Connected Accounts & is_installed integrity', () => {
  let manager: SideloadLibraryManager

  beforeEach(() => {
    mockStore = { games: [] }
    manager = new SideloadLibraryManager()
    jest.spyOn(gracefulFs, 'existsSync').mockImplementation((p: any) => Boolean(p && String(p).includes('installed_game.exe')))
    jest.spyOn(gracefulFs, 'readdirSync').mockImplementation(() => [] as any)
  })

  test('Connected account game without executable must remain is_installed: false even if customized', () => {
    // 1. Initial connected account game imported from Battle.net (uninstalled)
    const initialGame: GameInfo = {
      runner: 'sideload',
      app_name: 'account-battlenet-5272175',
      title: 'Overwatch®',
      accountProvider: 'battlenet',
      accountGameId: '5272175',
      art_cover: '',
      art_square: '',
      canRunOffline: false,
      install: {
        executable: '',
        platform: 'windows',
        is_dlc: false
      },
      is_installed: false
    }
    libraryStore.set('games', [initialGame])

    // 2. User customizes the cover via SteamGridDB / inline settings
    // previously this passed is_installed: true (or omitted it, defaulting to true)
    manager.addNewApp({
      runner: 'sideload',
      app_name: 'account-battlenet-5272175',
      title: 'Overwatch®',
      install: {
        executable: '',
        platform: 'windows'
      },
      art_cover: 'https://cdn2.steamgriddb.com/grid/custom_cover.jpg',
      art_square: 'https://cdn2.steamgriddb.com/grid/custom_square.jpg',
      is_installed: true // Should be defensively rejected because it has no real executable!
    } as any)

    const updated = libraryStore.get('games', [])[0]
    expect(updated.is_installed).toBe(false)
    expect(updated.art_cover).toBe('https://cdn2.steamgriddb.com/grid/custom_cover.jpg')
    expect(updated.folder_name).toBeUndefined()
  })

  test('Connected account game with a real existing executable can be marked as is_installed: true', () => {
    const initialGame: GameInfo = {
      runner: 'sideload',
      app_name: 'account-battlenet-12345',
      title: 'Diablo IV',
      accountProvider: 'battlenet',
      art_cover: '',
      art_square: '',
      canRunOffline: false,
      install: {},
      is_installed: false
    }
    libraryStore.set('games', [initialGame])

    manager.addNewApp({
      runner: 'sideload',
      app_name: 'account-battlenet-12345',
      title: 'Diablo IV',
      install: {
        executable: 'C:\\Games\\Diablo IV\\installed_game.exe',
        platform: 'windows'
      },
      art_cover: 'https://cdn.example.com/diablo.jpg',
      is_installed: true
    } as any)

    const updated = libraryStore.get('games', [])[0]
    expect(updated.is_installed).toBe(true)
    expect(updated.install.executable).toBe('C:\\Games\\Diablo IV\\installed_game.exe')
  })

  test('sanitizeExistingSideloadLibrary resets false installed connected accounts', () => {
    const corruptedGame: GameInfo = {
      runner: 'sideload',
      app_name: 'account-battlenet-999',
      title: 'Call of Duty: Cold War',
      accountProvider: 'battlenet',
      art_cover: 'https://cdn.example.com/coldwar.jpg',
      art_square: '',
      canRunOffline: false,
      install: {
        executable: ''
      },
      folder_name: '.',
      is_installed: true
    }
    libraryStore.set('games', [corruptedGame])

    sanitizeExistingSideloadLibrary()

    const sanitized = libraryStore.get('games', [])[0]
    expect(sanitized.is_installed).toBe(false)
    expect(sanitized.folder_name).toBeUndefined()
    expect(sanitized.art_cover).toBe('https://cdn.example.com/coldwar.jpg')
  })
})
