import { GlobalConfig } from 'backend/config'
import { addHandler } from 'backend/ipc'
import { logError, logInfo, LogPrefix } from 'backend/logger'
import * as SteamGridDB from './utils'
import { encryptApiKey, decryptApiKey, isEncryptedValue } from './secureKey'
import { join, dirname } from 'path'
import {
  existsSync,
  mkdirSync,
  createWriteStream,
  readdirSync,
  unlinkSync,
  openSync,
  readSync,
  closeSync,
  writeFileSync,
  readFileSync
} from 'graceful-fs'
import axios from 'axios'
import { appFolder, userDataPath } from '../constants/paths'

interface CoversBackupData {
  timestamp: number
  dateString: string
  totalOverrides: number
  overrides: Record<string, any>
}

const getBackupFilePath = () => join(userDataPath, 'store', 'covers-backup.json')

export const createCoversBackupSnapshot = async () => {
  try {
    const { gameOverridesStore } = await import(
      'backend/game_overrides/electronStores'
    )
    const currentOverrides =
      (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}

    const now = new Date()
    const backupData: CoversBackupData = {
      timestamp: now.getTime(),
      dateString: now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      totalOverrides: Object.keys(currentOverrides).length,
      overrides: { ...currentOverrides }
    }

    const backupPath = getBackupFilePath()
    const storeDir = dirname(backupPath)
    if (!existsSync(storeDir)) {
      mkdirSync(storeDir, { recursive: true })
    }
    writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8')
    logInfo(
      `[CoversBackup] Snapshot created successfully with ${backupData.totalOverrides} overrides at ${backupData.dateString}`,
      LogPrefix.Backend
    )
    return backupData
  } catch (err) {
    logError(['[CoversBackup] Failed to create snapshot:', err], LogPrefix.Backend)
    return null
  }
}

function readStoredApiKey(): string {
  const stored: string = GlobalConfig.get().getSettings().steamGridDbApiKey
  return stored ?? ''
}

function getDecryptedApiKey(): string {
  const stored = readStoredApiKey()
  if (!stored) return ''

  // Migrate legacy plaintext values on first read.
  if (!isEncryptedValue(stored)) {
    const reEncrypted = encryptApiKey(stored)
    if (isEncryptedValue(reEncrypted)) {
      GlobalConfig.get().setSetting('steamGridDbApiKey', reEncrypted)
    }
    return stored
  }

  return decryptApiKey(stored)
}

addHandler('steamgriddb.hasApiKey', () => !!readStoredApiKey())

addHandler('steamgriddb.setApiKey', (event, key) => {
  const trimmed = key.trim()
  const stored = trimmed ? encryptApiKey(trimmed) : ''
  GlobalConfig.get().setSetting('steamGridDbApiKey', stored)
})

addHandler('steamgriddb.searchGame', async (event, query) => {
  const apiKey = getDecryptedApiKey()
  if (!apiKey) {
    return []
  }

  try {
    const results = await SteamGridDB.searchGame(apiKey, query)
    return results.map((game) => ({
      id: game.id,
      name: game.name
    }))
  } catch (error) {
    logError(['SteamGridDB search failed:', error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.getGrids', async (event, args) => {
  const apiKey = getDecryptedApiKey()
  if (!apiKey) {
    return []
  }

  const nsfwSetting = GlobalConfig.get().getSettings().steamGridDbNsfw ? 'any' : 'false'

  try {
    const results = await SteamGridDB.getGrids(apiKey, {
      gameId: args.gameId,
      dimensions: args.dimensions,
      styles: args.styles,
      types: args.types,
      nsfw: args.nsfw ?? nsfwSetting,
      page: args.page
    })
    return results.map((grid) => ({
      id: grid.id,
      url: grid.url,
      thumb: grid.thumb
    }))
  } catch (error) {
    logError([`SteamGridDB getGrids failed:`, error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.getHeroes', async (event, args) => {
  const apiKey = getDecryptedApiKey()
  if (!apiKey) {
    return []
  }

  const nsfwSetting = GlobalConfig.get().getSettings().steamGridDbNsfw ? 'any' : 'false'

  try {
    const results = await SteamGridDB.getHeroes(apiKey, {
      gameId: args.gameId,
      dimensions: args.dimensions,
      styles: args.styles,
      types: args.types,
      nsfw: args.nsfw ?? nsfwSetting,
      page: args.page
    })
    return results.map((grid) => ({
      id: grid.id,
      url: grid.url,
      thumb: grid.thumb
    }))
  } catch (error) {
    logError([`SteamGridDB getHeroes failed:`, error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.downloadCover', async (event, args) => {
  const customCoversPath = join(appFolder, 'custom-covers')
  if (!existsSync(customCoversPath)) {
    mkdirSync(customCoversPath)
  }

  // Delete any existing cover files for this app and target type (e.g. diff extensions) to save disk space
  try {
    const files = readdirSync(customCoversPath)
    const prefix = `${args.appName}_${args.targetType}.`
    for (const file of files) {
      if (file.startsWith(prefix)) {
        try {
          unlinkSync(join(customCoversPath, file))
        } catch {}
      }
    }
  } catch {}

  const ext = args.url.split('?')[0].split('.').pop()?.toLowerCase() || 'webp'
  const destPath = join(customCoversPath, `${args.appName}_${args.targetType}.${ext}`)

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  try {
    const response = await axios({
      method: 'get',
      url: args.url,
      responseType: 'stream',
      headers
    })

    const writer = createWriteStream(destPath)
    response.data.pipe(writer)

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })

    return destPath
  } catch (error) {
    logError([`Failed to download SteamGridDB cover:`, error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.syncMissingCovers', async () => {
  // Fire and forget: starts background processing immediately without blocking
  setImmediate(async () => {
    try {
      logInfo(
        '[CoversSync] Starting background cover synchronization for missing/generic covers...',
        LogPrefix.Backend
      )

      // 0. Snapshot de segurança antes de qualquer alteração
      await createCoversBackupSnapshot()

      let recoveredCount = 0
      const apiKey = getDecryptedApiKey()

      // 1. Steam Library: re-scan Steam with deep hash-subfolder asset resolver
      try {
        const { default: SteamLibraryManager } = await import(
          'backend/storeManagers/steam/library'
        )
        const { SteamUser } = await import(
          'backend/storeManagers/steam/user'
        )
        const { libraryStore: steamStore } = await import(
          'backend/storeManagers/steam/electronStores'
        )

        if (await SteamUser.isLoggedIn()) {
          const oldSteamGames = steamStore.get('games', [])
          const steamMgr = new SteamLibraryManager()
          await steamMgr.refresh()
          const newSteamGames = steamStore.get('games', [])

          for (const newGame of newSteamGames) {
            const oldGame = oldSteamGames.find(
              (g) => g.app_name === newGame.app_name
            )
            const hadValidLocal =
              oldGame?.art_square &&
              !oldGame.art_square.startsWith('http') &&
              existsSync(oldGame.art_square)
            const nowHasValidLocal =
              newGame.art_square &&
              !newGame.art_square.startsWith('http') &&
              existsSync(newGame.art_square)

            if (!hadValidLocal && nowHasValidLocal) {
              recoveredCount++
            }
          }
        }
      } catch (err) {
        logError(['[CoversSync] Error during Steam library cover scan:', err], LogPrefix.Backend)
      }

      // 2. SteamGridDB fallback for games still missing or with generic covers
      if (apiKey) {
        try {
          const { fetchCoverFromSteamGridDB } = await import(
            'backend/storeManagers/sideload/steamgridHelper'
          )
          const { gameOverridesStore } = await import(
            'backend/game_overrides/electronStores'
          )
          const { libraryStore: steamStore } = await import(
            'backend/storeManagers/steam/electronStores'
          )
          const { libraryStore: sideloadStore } = await import(
            'backend/storeManagers/sideload/electronStores'
          )

          const { STEAM_MISSING_600x900 } = await import(
            'backend/storeManagers/steam/constants'
          )

          const allCandidateGames = [
            ...steamStore.get('games', []),
            ...sideloadStore.get('games', [])
          ]

          const currentOverrides =
            (gameOverridesStore.get('overrides', {}) as Record<
              string,
              any
            >) || {}

          const isGenericOrLetterbox = (candidate: any, sq: string | undefined): boolean => {
            if (!sq) return true
            if (
              sq === 'fallback' ||
              sq.includes('heroic_card.jpg') ||
              sq.includes('default_cover')
            ) {
              return true
            }
            // Horizontal banners letterboxed into cards
            if (sq.includes('header.jpg') || sq.includes('capsule_')) {
              return true
            }
            // In legacy missing 600x900 list
            if (candidate.runner === 'steam' && STEAM_MISSING_600x900.has(candidate.app_name)) {
              return true
            }
            // Local file checks
            if (!sq.startsWith('http')) {
              if (!existsSync(sq)) return true
              // Check if Steam auto-generated letterbox PNG disguised as .jpg
              try {
                const b = Buffer.alloc(4)
                const fd = openSync(sq, 'r')
                readSync(fd, b, 0, 4, 0)
                closeSync(fd)
                if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
                  return true
                }
              } catch {}
            }
            return false
          }

          for (const game of allCandidateGames) {
            const override = currentOverrides[game.app_name]
            const activeSquare = override?.art_square || game.art_square

            // Target missing, broken, horizontal letterbox, or generic covers!
            if (isGenericOrLetterbox(game, activeSquare) && game.title) {
              try {
                const coverData = await fetchCoverFromSteamGridDB(
                  apiKey,
                  game.title,
                  game.runner === 'steam' ? game.app_name : undefined
                )
                if (coverData?.art_square) {
                  currentOverrides[game.app_name] = {
                    ...currentOverrides[game.app_name],
                    title: game.title,
                    art_square: coverData.art_square,
                    art_cover: coverData.art_cover || coverData.art_square
                  }
                  recoveredCount++
                }
              } catch (err) {
                logError(
                  [
                    `[CoversSync] Failed fetching SGDB cover for ${game.title}:`,
                    err
                  ],
                  LogPrefix.Backend
                )
              }
            }
          }

          gameOverridesStore.set('overrides', currentOverrides)
        } catch (err) {
          logError(['[CoversSync] Error during SteamGridDB scan:', err], LogPrefix.Backend)
        }
      }

      logInfo(
        `[CoversSync] Background synchronization finished. Recovered ${recoveredCount} covers.`,
        LogPrefix.Backend
      )

      // Notify the frontend via IPC
      const { BrowserWindow } = await import('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('covers-sync-finished', {
          recoveredCount,
          success: true
        })
      }
    } catch (err) {
      logError(
        ['[CoversSync] Background synchronization error:', err],
        LogPrefix.Backend
      )
      const { BrowserWindow } = await import('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('covers-sync-finished', {
          recoveredCount: 0,
          success: false,
          error: String(err)
        })
      }
    }
  })

  return { started: true }
})

addHandler(
  'steamgriddb.batchReplaceAllCovers',
  async (
    event,
    args: {
      appNames?: string[]
      runner?: string
      scope?: 'all' | 'steam_only' | 'missing_only'
      dimensions?: string[]
    } = {}
  ) => {
    const apiKey = getDecryptedApiKey()
    if (!apiKey) {
      throw new Error('API_KEY_REQUIRED')
    }

    const { BrowserWindow } = await import('electron')
    const { gameOverridesStore } = await import(
      'backend/game_overrides/electronStores'
    )

    // Snapshot de segurança antes da substituição em massa
    await createCoversBackupSnapshot()

    const { fetchCoverFromSteamGridDB, clearSteamGridCache } = await import(
      'backend/storeManagers/sideload/steamgridHelper'
    )
    clearSteamGridCache()
    const { libraryStore: steamStore } = await import(
      'backend/storeManagers/steam/electronStores'
    )
    const { libraryStore: sideloadStore } = await import(
      'backend/storeManagers/sideload/electronStores'
    )
    const { libraryStore: legendaryStore } = await import(
      'backend/storeManagers/legendary/electronStores'
    )
    const { libraryStore: gogStore } = await import(
      'backend/storeManagers/gog/electronStores'
    )
    const { libraryStore: nileStore } = await import(
      'backend/storeManagers/nile/electronStores'
    )

    let allGames: any[] = []
    if (args.runner === 'steam') {
      allGames = steamStore.get('games', [])
    } else {
      allGames = [
        ...steamStore.get('games', []),
        ...sideloadStore.get('games', []),
        ...legendaryStore.get('library', []),
        ...gogStore.get('games', []),
        ...nileStore.get('library', [])
      ]
    }

    // Filter duplicates by app_name
    const uniqueMap = new Map<string, any>()
    for (const g of allGames) {
      if (g.app_name && !uniqueMap.has(g.app_name)) {
        uniqueMap.set(g.app_name, g)
      }
    }
    allGames = Array.from(uniqueMap.values())

    // Filter by specific appNames if provided
    if (args.appNames && args.appNames.length > 0) {
      const targetSet = new Set(args.appNames)
      allGames = allGames.filter((g) => targetSet.has(g.app_name))
    }

    const currentOverrides =
      (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}

    const total = allGames.length
    let processed = 0
    let updated = 0
    let failed = 0

    const sendProgress = (
      gameTitle: string,
      success: boolean,
      coverUrl?: string
    ) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('steamgriddb.batchProgress', {
          current: processed,
          total,
          title: gameTitle,
          success,
          coverUrl,
          updated
        })
      }
    }

    // Process with concurrency throttling (3 concurrent requests to be polite to SGDB API)
    const CONCURRENCY = 3
    const chunks: any[][] = []
    for (let i = 0; i < allGames.length; i += CONCURRENCY) {
      chunks.push(allGames.slice(i, i + CONCURRENCY))
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (game) => {
          if (!game.title) {
            processed++
            return
          }

          // Preserve manual custom covers chosen explicitly by user
          if (currentOverrides[game.app_name]?.is_manual) {
            processed++
            updated++
            sendProgress(
              game.title,
              true,
              currentOverrides[game.app_name].art_square
            )
            return
          }

          try {
            const steamAppId =
              game.runner === 'steam' ? game.app_name : undefined
            const coverData = await fetchCoverFromSteamGridDB(
              apiKey,
              game.title,
              steamAppId
            )

            if (coverData?.art_square) {
              currentOverrides[game.app_name] = {
                ...currentOverrides[game.app_name],
                title: game.title,
                art_square: coverData.art_square,
                art_cover: coverData.art_cover || coverData.art_square
              }
              updated++
              processed++
              sendProgress(game.title, true, coverData.art_square)
            } else {
              failed++
              processed++
              sendProgress(game.title, false)
            }
          } catch (err) {
            failed++
            processed++
            sendProgress(game.title, false)
          }
        })
      )

      // Save incremental progress after each chunk
      gameOverridesStore.set('overrides', currentOverrides)
    }

    gameOverridesStore.set('overrides', currentOverrides)

    const { sendFrontendMessage } = await import('backend/ipc')
    sendFrontendMessage('metadataChanged', currentOverrides)

    return {
      total,
      updated,
      failed
    }
  }
)

addHandler('steamgriddb.getCoversBackupInfo', () => {
  try {
    const backupPath = getBackupFilePath()
    if (!existsSync(backupPath)) {
      return { hasBackup: false }
    }
    const content = readFileSync(backupPath, 'utf8')
    const data = JSON.parse(content) as CoversBackupData
    return {
      hasBackup: true,
      timestamp: data.timestamp,
      date: data.dateString,
      totalOverrides: data.totalOverrides || 0
    }
  } catch {
    return { hasBackup: false }
  }
})

addHandler('steamgriddb.restoreCoversBackup', async () => {
  try {
    const backupPath = getBackupFilePath()
    if (!existsSync(backupPath)) {
      return { success: false, message: 'Nenhum backup encontrado.' }
    }
    const content = readFileSync(backupPath, 'utf8')
    const data = JSON.parse(content) as CoversBackupData

    const { gameOverridesStore } = await import(
      'backend/game_overrides/electronStores'
    )
    const { clearSteamGridCache } = await import(
      'backend/storeManagers/sideload/steamgridHelper'
    )

    const overridesToRestore = data.overrides || {}
    gameOverridesStore.set('overrides', overridesToRestore)
    clearSteamGridCache()

    const { sendFrontendMessage } = await import('backend/ipc')
    sendFrontendMessage('metadataChanged', overridesToRestore)

    logInfo(
      `[CoversBackup] Restored ${Object.keys(overridesToRestore).length} covers from snapshot ${data.dateString}`,
      LogPrefix.Backend
    )

    const { BrowserWindow } = await import('electron')
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('covers-sync-finished', {
          recoveredCount: 0,
          success: true,
          isRestore: true,
          date: data.dateString
        })
      }
    }

    return {
      success: true,
      date: data.dateString,
      totalOverrides: data.totalOverrides || 0
    }
  } catch (err) {
    logError(['[CoversBackup] Failed to restore backup:', err], LogPrefix.Backend)
    return { success: false, message: String(err) }
  }
})

