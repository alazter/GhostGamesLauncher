import { ExecResult, GameInfo } from 'common/types'
import { readdirSync, existsSync } from 'graceful-fs'
import { dirname, join } from 'path'
import { libraryStore } from './electronStores'
import { logWarning, logInfo, logError } from 'backend/logger'
import { addShortcuts } from 'backend/shortcuts/shortcuts/shortcuts'
import { sendFrontendMessage } from 'backend/ipc'
import { isMac } from 'backend/constants/environment'
import { getApiKey, fetchCoverFromSteamGridDB } from './steamgridHelper'
import { LibraryManager } from 'common/types/game_manager'
import SideloadGame from './games'
import { findManifestForExecutable } from 'backend/plugins/ghostManifest'
import { ExternalGames } from 'backend/plugins/externalGames'

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
    is_installed,
    description,
    customUserAgent,
    launchFullScreen
  }: GameInfo): void {
    const current = libraryStore.get('games', [])
    const normTitle = (title || '').trim().toLowerCase()
    const cleanTargetTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const targetDirNorm = executable ? dirname(executable).toLowerCase() : undefined
    const normExe = executable ? executable.trim().toLowerCase().replace(/\\/g, '/') : ''

    const hasRealExecutable = Boolean(
      executable && typeof executable === 'string' && executable.trim().length > 0
    )
    const exeFileExists = Boolean(hasRealExecutable && executable && existsSync(executable))

    // Se o executável existir no disco, busca pelo manifesto físico Ghost (.ghost-manifest.json)
    let manifestData: ReturnType<typeof findManifestForExecutable> = null
    if (exeFileExists && executable) {
      manifestData = findManifestForExecutable(executable)
    }

    const gameIndex = current.findIndex((value) => {
      // 1. Vínculo explícito por ID (edição de card existente)
      if (value.app_name === app_name) {
        return true
      }

      // Se o ID for diferente (novo card sendo adicionado), só deve coincidir se for REALMENTE o mesmo jogo:
      const valExe = value.install?.executable
        ? value.install.executable.trim().toLowerCase().replace(/\\/g, '/')
        : ''

      // 2. Mesmo arquivo executável exato já cadastrado
      if (normExe && valExe && normExe === valExe) {
        return true
      }

      // 3. Manifesto oficial Ghost (.ghost-manifest.json) correspondente
      if (
        manifestData?.manifest.ghostAppId &&
        value.app_name === manifestData.manifest.ghostAppId
      ) {
        return true
      }

      // 4. Coincidência de título para itens do runner sideload
      const valTitleNorm = (value.title || '').trim().toLowerCase()
      const valTitleClean = (value.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const titleMatches =
        value.runner === 'sideload' &&
        ((Boolean(normTitle) && valTitleNorm === normTitle) ||
          (Boolean(cleanTargetTitle) &&
            cleanTargetTitle.length > 2 &&
            valTitleClean === cleanTargetTitle))

      if (titleMatches) {
        // Se o título for idêntico, só considera o mesmo se estiver na mesma pasta ou não tiver pasta definida
        const valDirNorm = value.folder_name ? value.folder_name.toLowerCase() : undefined
        if (!targetDirNorm || !valDirNorm || targetDirNorm === valDirNorm) {
          return true
        }
      }

      return false
    })
    const existing = gameIndex !== -1 ? current[gameIndex] : undefined

    const isConnectedAccount = Boolean(existing?.accountProvider)
    let computedIsInstalled: boolean

    if (isConnectedAccount) {
      // Jogos de contas conectadas (Battle.net, Xbox, EA, Ubisoft) NUNCA podem ser marcados como
      // instalados a menos que possuam executável real e existente em disco.
      computedIsInstalled = exeFileExists
        ? Boolean(is_installed !== undefined ? is_installed : (existing?.is_installed ?? true))
        : false
    } else if (is_installed !== undefined) {
      computedIsInstalled = is_installed
    } else if (existing) {
      computedIsInstalled = Boolean(existing.is_installed)
    } else {
      computedIsInstalled = Boolean(hasRealExecutable || browserUrl)
    }

    const resolvedTitle =
      (title && title !== app_name ? title : undefined) ||
      (manifestData?.manifest.title && (!title || title === app_name)
        ? manifestData.manifest.title
        : undefined) ||
      existing?.title ||
      title ||
      'Sideload Game'
    const resolvedVersion = manifestData?.manifest.version || existing?.version || '1.0'
    const resolvedCover = art_cover || existing?.art_cover || manifestData?.manifest.coverUrl || ''
    const resolvedSquare = art_square || existing?.art_square || manifestData?.manifest.coverUrl || existing?.art_cover || ''

    const game: GameInfo = {
      ...existing,
      runner: 'sideload',
      app_name: existing?.app_name || app_name,
      title: resolvedTitle,
      version: resolvedVersion,
      install: {
        executable,
        platform,
        is_dlc: false
      },
      folder_name: hasRealExecutable && executable
        ? (manifestData?.manifestDir || dirname(executable))
        : undefined,
      art_cover: resolvedCover || '',
      is_installed: computedIsInstalled,
      art_square: resolvedSquare || '',
      canRunOffline: !browserUrl,
      browserUrl,
      description,
      customUserAgent,
      launchFullScreen
    }

    if (game.overrides) {
      if (resolvedTitle && game.overrides.title) {
        game.overrides.title = resolvedTitle
      }
      if (resolvedCover && game.overrides.art_cover) {
        game.overrides.art_cover = resolvedCover
      }
      if (resolvedSquare && game.overrides.art_square) {
        game.overrides.art_square = resolvedSquare
      }
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

    // edit app in case it exists
    if (gameIndex !== -1) {
      current[gameIndex] = {
        ...current[gameIndex],
        ...game,
        is_installed: computedIsInstalled,
        folder_name: hasRealExecutable && executable
          ? (manifestData?.manifestDir || dirname(executable))
          : (existing?.folder_name && existing.folder_name !== '.' ? existing.folder_name : undefined)
      }
    } else {
      current.push(game)
      addShortcuts(new SideloadGame(app_name))
    }

    const seenApps = new Set<string>()
    const deduplicated = current.filter((item) => {
      const key = item.app_name
      if (!key || seenApps.has(key)) return false
      seenApps.add(key)
      return true
    })

    libraryStore.set('games', deduplicated)

    // Registra a instalação no ExternalGames e vincula à loja do manifesto
    if (computedIsInstalled && executable && exeFileExists) {
      try {
        void ExternalGames.getInstance().getOrCreateInstallation(app_name, game).then(() => {
          if (manifestData) {
            const piratasSources = ['anker', 'steamrip', 'online-fix', 'ankergames']
            const isPiratasEligible = piratasSources.some((s) =>
              (manifestData?.manifest.storeId || '').toLowerCase().includes(s) ||
              (manifestData?.manifest.storeName || '').toLowerCase().includes(s)
            )
            if (isPiratasEligible) {
              sendFrontendMessage('external-games-assign-piratas', { appName: game.app_name })
            }
          }
        })
      } catch (err) {
        logWarning(`Erro ao registrar instalação Ghost para ${app_name}: ${err}`)
      }
    }

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
