import { ExecResult, GameInfo } from 'common/types'
import { readdirSync } from 'graceful-fs'
import { dirname, join } from 'path'
import { libraryStore } from './electronStores'
import { logWarning, logInfo, logError } from 'backend/logger'
import { addShortcuts } from 'backend/shortcuts/shortcuts/shortcuts'
import { sendFrontendMessage } from 'backend/ipc'
import { isMac } from 'backend/constants/environment'
import { getApiKey, fetchCoverFromSteamGridDB } from './steamgridHelper'
import { LibraryManager } from 'common/types/game_manager'
import SideloadGame from './games'

export default class SideloadLibraryManager implements LibraryManager {
  init = () => Promise.resolve()

  getGame(id: string): SideloadGame {
    return new SideloadGame(id)
  }

  addNewApp({
    app_name,
    title,
    install: { executable, platform },
    art_cover,
    art_square,
    browserUrl,
    is_installed = true,
    description,
    customUserAgent,
    launchFullScreen
  }: GameInfo): void {
    const game: GameInfo = {
      runner: 'sideload',
      app_name,
      title,
      install: {
        executable,
        platform,
        is_dlc: false
      },
      folder_name: executable !== undefined ? dirname(executable) : undefined,
      art_cover,
      is_installed: is_installed !== undefined ? is_installed : true,
      art_square,
      canRunOffline: !browserUrl,
      browserUrl,
      description,
      customUserAgent,
      launchFullScreen
    }

    if (isMac && executable?.endsWith('.app')) {
      const macAppExecutable = readdirSync(
        join(executable, 'Contents', 'MacOS')
      )[0]
      game.install.executable = join(
        executable,
        'Contents',
        'MacOS',
        macAppExecutable
      )
    }

    const current = libraryStore.get('games', [])

    const gameIndex = current.findIndex((value) => value.app_name === app_name)

    // edit app in case it exists
    if (gameIndex !== -1) {
      current[gameIndex] = { ...current[gameIndex], ...game }
    } else {
      current.push(game)
      addShortcuts(new SideloadGame(app_name))
    }

    libraryStore.set('games', current)

    sendFrontendMessage('refreshLibrary', 'sideload')

    return
  }

  installState() {
    logWarning(`installState not implemented on Sideload Library Manager`)
  }

  async refresh() {
    logWarning(`refresh not implemented on Sideload Library Manager`)
    return null
  }

  getGameInfo(): GameInfo {
    logWarning(`getGameInfo not implemented on Sideload Library Manager`)
    return {
      app_name: '',
      runner: 'sideload',
      art_cover: '',
      art_square: '',
      install: {},
      is_installed: false,
      title: '',
      canRunOffline: false
    }
  }

  async listUpdateableGames(): Promise<string[]> {
    logWarning(
      `listUpdateableGames not implemented on Sideload Library Manager`
    )
    return []
  }

  async runRunnerCommand(): Promise<ExecResult> {
    logWarning(`runRunnerCommand not implemented on Sideload Library Manager`)
    return { stdout: '', stderr: '' }
  }

  async changeGameInstallPath(): Promise<void> {
    logWarning(
      `changeGameInstallPath not implemented on Sideload Library Manager`
    )
  }

  async getInstallInfo(): Promise<undefined> {
    logWarning(`getInstallInfo not implemented on Sideload Library Manager`)
    return undefined
  }

  getLaunchOptions = () => []

  changeVersionPinnedStatus() {
    logWarning(
      'changeVersionPinnedStatus not implemented on Sideload Library Manager'
    )
  }
}

import { sanitizeExistingSideloadLibrary } from './scanner'

export async function refresh() {
  sanitizeExistingSideloadLibrary()
  const apiKey = getApiKey()
  if (!apiKey) {
    logInfo('[Sideload Library] Skip cover auto-update: SteamGridDB API key is missing.')
    return null
  }

  const games = libraryStore.get('games', []) as GameInfo[]
  const gamesToUpdate = games.filter((game) => {
    const hasNoCover = !game.art_cover || game.art_cover.includes('heroic-icon.svg') || game.art_cover.includes('heroic_card.jpg')
    const hasNoSquare = !game.art_square || game.art_square.includes('heroic-icon.svg') || game.art_square.includes('heroic_card.jpg')
    return (hasNoCover || hasNoSquare) && game.title
  })

  if (gamesToUpdate.length === 0) {
    return null
  }

  // Execute the cover fetching in background to avoid blocking launcher startup
  const runBackgroundRefresh = async () => {
    let updatedAny = false
    const pool = new Set<Promise<void>>()
    const concurrencyLimit = 12

    for (const game of gamesToUpdate) {
      const promise: Promise<void> = (async () => {
        logInfo(`[Sideload Library] Searching SteamGridDB cover for: ${game.title}`)
        try {
          const coverData = await fetchCoverFromSteamGridDB(apiKey, game.title)
          if (coverData) {
            game.art_cover = coverData.art_cover
            game.art_square = coverData.art_square
            updatedAny = true
            logInfo(`[Sideload Library] Applied SteamGridDB cover for: ${game.title}`)
          }
        } catch (err) {
          logError([`[Sideload Library] Failed fetching SteamGridDB cover for ${game.title}:`, err])
        }
      })().then(() => {
        pool.delete(promise)
      })

      pool.add(promise)
      if (pool.size >= concurrencyLimit) {
        await Promise.race(pool)
      }
    }

    await Promise.all(pool)

    if (updatedAny) {
      libraryStore.set('games', games)
      sendFrontendMessage('refreshLibrary', 'sideload')
    }
  }

  runBackgroundRefresh().catch((err) => {
    logError([`[Sideload Library] Error in background cover refresh:`, err])
  })

  return null
}

export function getGameInfo(): GameInfo {
  logWarning(`getGameInfo not implemented on Sideload Library Manager`)
  return {
    app_name: '',
    runner: 'sideload',
    art_cover: '',
    art_square: '',
    install: {},
    is_installed: false,
    title: '',
    canRunOffline: false
  }
}

export async function listUpdateableGames(): Promise<string[]> {
  logWarning(`listUpdateableGames not implemented on Sideload Library Manager`)
  return []
}

export async function runRunnerCommand(): Promise<ExecResult> {
  logWarning(`runRunnerCommand not implemented on Sideload Library Manager`)
  return { stdout: '', stderr: '' }
}

export async function changeGameInstallPath(): Promise<void> {
  logWarning(
    `changeGameInstallPath not implemented on Sideload Library Manager`
  )
}

export async function getInstallInfo(): Promise<undefined> {
  logWarning(`getInstallInfo not implemented on Sideload Library Manager`)
  return undefined
}

export const getLaunchOptions = () => []

export function updateSideloadedApps(appsToUpdate: GameInfo[]): void {
  const current = libraryStore.get('games', [])
  for (const app of appsToUpdate) {
    const idx = current.findIndex((g) => g.app_name === app.app_name)
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...app }
    }
  }
  libraryStore.set('games', current)
  sendFrontendMessage('refreshLibrary', 'sideload')
}
