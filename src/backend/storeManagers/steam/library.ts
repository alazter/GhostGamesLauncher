import { existsSync, readdirSync, readFileSync } from 'graceful-fs'
import { join } from 'path'
import { ExecResult, GameInfo, InstallInfo, InstallPlatform, LaunchOption } from 'common/types'
import { LibraryManager } from 'common/types/game_manager'
import SteamGame from './games'
import { SteamUser } from './user'
import { libraryStore } from './electronStores'
import {
  STEAM_CDN,
  STEAM_PROTOCOL,
  IGNORED_STEAM_APP_IDS,
  KNOWN_STEAM_TITLES,
  STEAM_MISSING_600x900
} from './constants'
import { logInfo, logError, LogPrefix } from 'backend/logger'

export default class SteamLibraryManager implements LibraryManager {
  async init(): Promise<void> {
    await SteamUser.isLoggedIn()
  }

  getGame(id: string): SteamGame {
    return new SteamGame(id)
  }

  getGameInfo(appName: string): GameInfo | undefined {
    const list = libraryStore.get('games', [])
    return list.find((g) => g.app_name === appName)
  }

  async refresh(): Promise<ExecResult | null> {
    logInfo('Refreshing Steam games library...', LogPrefix.Steam)
    const isLoggedIn = await SteamUser.isLoggedIn()
    if (!isLoggedIn) {
      logInfo('Steam user is logged out. Clearing Steam library.', LogPrefix.Steam)
      libraryStore.set('games', [])
      return { stdout: '', stderr: '' }
    }

    const account = await SteamUser.getDetectedAccount()
    if (!account) {
      logInfo('No Steam installation or account detected', LogPrefix.Steam)
      libraryStore.set('games', [])
      return null
    }

    const { steamPath, steamId32 } = account

    // 1. Detect all Library folders from libraryfolders.vdf
    const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
    const libraryPaths: string[] = [steamPath]

    if (existsSync(vdfPath)) {
      try {
        const vdfContent = readFileSync(vdfPath, 'utf8')
        const pathMatches = [...vdfContent.matchAll(/"path"\s+"([^"]+)"/g)]
        for (const m of pathMatches) {
          const libPath = m[1].replace(/\\\\/g, '\\')
          if (existsSync(libPath) && !libraryPaths.includes(libPath)) {
            libraryPaths.push(libPath)
          }
        }
      } catch (err) {
        logError(['Error reading libraryfolders.vdf', err], LogPrefix.Steam)
      }
    }

    // 2. Discover all installed games via appmanifest_*.acf
    const installedMap = new Map<string, { title: string; installDir: string; size: number }>()

    for (const libPath of libraryPaths) {
      const steamappsDir = join(libPath, 'steamapps')
      if (!existsSync(steamappsDir)) continue

      try {
        const files = readdirSync(steamappsDir)
        for (const file of files) {
          const match = file.match(/^appmanifest_(\d+)\.acf$/i)
          if (!match) continue

          const appid = match[1]
          try {
            const acfContent = readFileSync(join(steamappsDir, file), 'utf8')
            const nameMatch = acfContent.match(/"name"\s+"([^"]+)"/i)
            const dirMatch = acfContent.match(/"installdir"\s+"([^"]+)"/i)
            const sizeMatch = acfContent.match(/"SizeOnDisk"\s+"([^"]+)"/i)

            const title = nameMatch ? nameMatch[1].trim() : `Steam App ${appid}`
            const installDir = dirMatch ? join(steamappsDir, 'common', dirMatch[1].trim()) : ''
            const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0

            // Filter out Steam internal tools / redistributables
            const lowerTitle = title.toLowerCase()
            if (
              lowerTitle.includes('steamworks common') ||
              lowerTitle.includes('steam linux runtime') ||
              lowerTitle.includes('proton ')
            ) {
              continue
            }

            installedMap.set(appid, { title, installDir, size })
          } catch {}
        }
      } catch {}
    }

    logInfo(
      `Found ${installedMap.size} installed Steam games across libraries`,
      LogPrefix.Steam
    )

    // 3. Discover all owned games from localconfig.vdf
    const localconfigPath = join(
      steamPath,
      'userdata',
      steamId32,
      'config',
      'localconfig.vdf'
    )
    const ownedAppIds = new Set<string>()

    // Always include installed games in owned list
    for (const appid of installedMap.keys()) {
      ownedAppIds.add(appid)
    }

    if (existsSync(localconfigPath)) {
      try {
        const content = readFileSync(localconfigPath, 'utf8')
        const lines = content.split('\n')
        let inApps = false
        let depth = 0

        for (const line of lines) {
          if (/"apps"\s*$/i.test(line)) {
            inApps = true
            depth = 0
            continue
          }
          if (inApps) {
            if (line.includes('{')) depth++
            if (line.includes('}')) {
              depth--
              if (depth <= 0) {
                inApps = false
                break
              }
            }
            if (depth === 1) {
              const m = line.match(/^\s*"(\d+)"\s*\{?/)
              if (m) {
                ownedAppIds.add(m[1])
              }
            }
          }
        }
      } catch (err) {
        logError(['Error reading localconfig.vdf', err], LogPrefix.Steam)
      }
    }

    logInfo(
      `Total owned Steam AppIDs discovered: ${ownedAppIds.size}`,
      LogPrefix.Steam
    )

    // 4. Resolve names for uninstalled games from appinfo.vdf and librarycache
    const appinfoPath = join(steamPath, 'appcache', 'appinfo.vdf')
    let appinfoRaw: Buffer | null = null
    if (existsSync(appinfoPath)) {
      try {
        appinfoRaw = readFileSync(appinfoPath)
      } catch {}
    }

    const librarycacheDir = join(
      steamPath,
      'userdata',
      steamId32,
      'config',
      'librarycache'
    )

    const finalGames: GameInfo[] = []

    for (const appid of ownedAppIds) {
      if (IGNORED_STEAM_APP_IDS.has(appid)) {
        continue
      }

      const installed = installedMap.get(appid)
      let title = installed?.title || ''
      const isInstalled = Boolean(installed)

      // Check known clean title map
      if (KNOWN_STEAM_TITLES[appid]) {
        title = KNOWN_STEAM_TITLES[appid]
      }

      // If not installed and not in known map, resolve title from appinfo.vdf or librarycache
      if (!title) {
        // Try librarycache/<appid>.json first
        const jsonPath = join(librarycacheDir, `${appid}.json`)
        if (existsSync(jsonPath)) {
          try {
            const rawJson = readFileSync(jsonPath, 'utf8')
            // Regex match for title / strName
            const nameM = rawJson.match(/"strName"\s*:\s*"([^"]+)"/)
            if (nameM && nameM[1]) {
              const candidate = nameM[1].trim()
              if (candidate.length > 3 && !/^\d+$/.test(candidate)) {
                title = candidate
              }
            }
          } catch {}
        }

        // Try appinfo.vdf binary search
        if (!title && appinfoRaw) {
          const numId = parseInt(appid, 10)
          if (!isNaN(numId)) {
            const buf = Buffer.alloc(4)
            buf.writeUInt32LE(numId, 0)
            const pos = appinfoRaw.indexOf(buf)
            if (pos !== -1) {
              const chunk = appinfoRaw.subarray(pos, pos + 1500)
              const chunkStr = chunk.toString('utf8', 0, chunk.length)
              // Look for common patterns: \x01\x04\x00\x00\x00Name\x00\x01\x05\x00\x00\x00Game\x00
              const m = chunkStr.match(/\x01(?:\x04|\x00)\x00\x00\x00([^\x00]{2,80})\x00\x01(?:\x05|\x01)\x00\x00\x00(Game|Application)\x00/i)
              if (m && m[1]) {
                const candidate = m[1].trim()
                if (candidate.length > 3 && !/^\d+$/.test(candidate)) {
                  title = candidate
                }
              }
            }
          }
        }
      }

      // Validate title: never allow empty, pure numbers, or short junk
      if (!title || title.length <= 3 || /^\d+$/.test(title)) {
        title = KNOWN_STEAM_TITLES[appid] || `Steam Game ${appid}`
      }

      const lower = title.toLowerCase()
      if (
        lower.startsWith('steamworks common') ||
        lower.startsWith('steam linux runtime') ||
        lower.startsWith('proton ') ||
        lower.includes('soundtrack') ||
        lower.includes('dedicated server')
      ) {
        continue
      }

      const localAppCache = join(steamPath, 'appcache', 'librarycache', appid)
      
      const findSteamAsset = (filenames: string[]): string | null => {
        if (existsSync(localAppCache)) {
          for (const fn of filenames) {
            const direct = join(localAppCache, fn)
            if (existsSync(direct)) return direct
          }
          try {
            const entries = readdirSync(localAppCache, { withFileTypes: true })
            for (const entry of entries) {
              if (entry.isDirectory()) {
                for (const fn of filenames) {
                  const sub = join(localAppCache, entry.name, fn)
                  if (existsSync(sub)) return sub
                }
              }
            }
          } catch {}
        }
        return null
      }

      const localSquare = findSteamAsset(['library_600x900.jpg', 'library_capsule.jpg'])
      const localCover = findSteamAsset(['library_header.jpg', 'header.jpg', 'capsule_616x353.jpg'])
      const localHero = findSteamAsset(['library_hero.jpg'])
      const localLogo = findSteamAsset(['logo.png'])

      const hasLocalSquare = !!localSquare
      const hasLocalCover = !!localCover
      const hasLocalHero = !!localHero
      const hasLocalLogo = !!localLogo

      const art_square = hasLocalSquare
        ? localSquare
        : STEAM_MISSING_600x900.has(appid)
        ? (hasLocalCover ? localCover : STEAM_CDN.horizontalBanner(appid))
        : STEAM_CDN.verticalCover(appid)

      const art_cover = hasLocalCover
        ? localCover
        : STEAM_CDN.horizontalBanner(appid)

      const art_background = hasLocalHero
        ? localHero
        : STEAM_CDN.heroBackground(appid)

      // Only set art_logo if it actually exists on the user's disk.
      // Leaving it empty when unavailable eliminates 404 network spam and broken icon artifacts.
      const art_logo = hasLocalLogo ? localLogo : ''

      const game: GameInfo = {
        runner: 'steam',
        app_name: appid,
        title,
        is_installed: isInstalled,
        canRunOffline: true,
        art_square,
        art_cover,
        art_background,
        art_logo,
        store_url: STEAM_PROTOCOL.storeUrl(appid),
        install: {
          platform: 'Windows',
          is_dlc: false,
          executable: installed?.installDir || undefined,
          install_path: installed?.installDir || undefined,
          install_size: installed?.size ? `${(installed.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : undefined
        }
      }

      finalGames.push(game)
    }

    logInfo(
      `Steam Library built successfully with ${finalGames.length} total games (${installedMap.size} installed)`,
      LogPrefix.Steam
    )

    libraryStore.set('games', finalGames)

    return { stdout: '', stderr: '' }
  }

  async getInstallInfo(
    appName: string,
    installPlatform: InstallPlatform,
    options?: {
      branch?: string
      build?: string
      lang?: string
      retries?: number
    }
  ): Promise<InstallInfo | undefined> {
    return undefined
  }

  async listUpdateableGames(): Promise<string[]> {
    return []
  }

  async changeGameInstallPath(): Promise<void> {}
  changeVersionPinnedStatus(): void {}
  installState(): void {}

  getLaunchOptions(appName: string): LaunchOption[] {
    return []
  }
}
