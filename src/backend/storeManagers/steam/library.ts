import { existsSync, readdirSync, readFileSync } from 'graceful-fs'
import { join } from 'path'
import * as VDF from '@node-steam/vdf'
import { ExecResult, GameInfo, InstallInfo, InstallPlatform, LaunchOption } from 'common/types'
import { LibraryManager } from 'common/types/game_manager'
import SteamGame from './games'
import { SteamUser } from './user'
import { configStore, libraryStore } from './electronStores'
import {
  STEAM_CDN,
  STEAM_PROTOCOL,
  IGNORED_STEAM_APP_IDS,
  KNOWN_STEAM_TITLES,
  STEAM_MISSING_600x900
} from './constants'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { SteamDownloader } from './downloader'
import { SteamWebApi, SteamApiGame } from './webApi'

function parseAppInfoVdf(appinfoPath: string): Map<string, { title: string; type: string }> {
  const map = new Map<string, { title: string; type: string }>()
  if (!existsSync(appinfoPath)) return map

  try {
    const buf = readFileSync(appinfoPath)
    const str = buf.toString('latin1')

    const regex = /\x01\x04\x00\x00\x00([^\x00]{2,120})\x00/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(str)) !== null) {
      const title = Buffer.from(match[1], 'latin1').toString('utf8').trim()
      const pos = match.index

      const startPos = Math.max(0, pos - 80)
      const chunk = buf.subarray(startPos, pos)
      const idIdx = chunk.lastIndexOf(Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00]))
      if (idIdx !== -1 && idIdx + 9 <= chunk.length) {
        const appId = chunk.readUInt32LE(idIdx + 5).toString()

        const forwardChunk = str.substring(pos, Math.min(str.length, pos + 250))
        let type = 'game'
        const typeM = forwardChunk.match(/\x01(?:type|\x05\x00\x00\x00)\x00([^\x00]+)\x00/i)
        if (typeM) {
          type = Buffer.from(typeM[1], 'latin1').toString('utf8').trim().toLowerCase()
        }

        if (appId && title && !map.has(appId)) {
          map.set(appId, { title, type })
        }
      }
    }
  } catch (err) {
    logError(['Failed to parse appinfo.vdf', err], LogPrefix.Steam)
  }

  return map
}

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
    logInfo('Refreshing Steam games library (Triple-Tier System)...', LogPrefix.Steam)
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

    const { steamPath, steamId32, steamId64 } = account
    const syncMode = configStore.get('syncMode', 'all')
    const apiKey = configStore.get('apiKey', '')
    const sessionCookie = configStore.get('sessionCookie', '')

    // 1. Detect all Library folders from libraryfolders.vdf via AST VDF Parser
    const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
    const libraryPaths: string[] = [steamPath]

    if (existsSync(vdfPath)) {
      try {
        const vdfContent = readFileSync(vdfPath, 'utf8')
        const parsed = VDF.parse(vdfContent) as any
        const folders = parsed.libraryfolders || parsed
        if (folders && typeof folders === 'object') {
          for (const key of Object.keys(folders)) {
            const entry = folders[key]
            if (entry && entry.path && typeof entry.path === 'string') {
              const libPath = entry.path.replace(/\\\\/g, '\\')
              if (existsSync(libPath) && !libraryPaths.includes(libPath)) {
                libraryPaths.push(libPath)
              }
            }
          }
        }
      } catch (err) {
        logError(['Error parsing libraryfolders.vdf with @node-steam/vdf', err], LogPrefix.Steam)
      }
    }

    // 2. Discover all installed games via appmanifest_*.acf using AST VDF Parser
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
            const parsedAcf = VDF.parse(acfContent) as any
            const appState = parsedAcf.AppState || parsedAcf.appstate || parsedAcf
            const title = (appState.name || appState.Name || '').trim()
            const installDirName = (appState.installdir || appState.installdir || '').trim()
            const installDir = installDirName ? join(steamappsDir, 'common', installDirName) : ''
            const size = parseInt(appState.SizeOnDisk || appState.sizeondisk || '0', 10) || 0

            const lowerTitle = title.toLowerCase()
            if (
              lowerTitle.includes('steamworks common') ||
              lowerTitle.includes('steam linux runtime') ||
              lowerTitle.includes('proton ') ||
              lowerTitle.includes('dedicated server') ||
              lowerTitle.includes('soundtrack')
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

    // Se o usuário selecionou Modo Apenas Instalados (Via C)
    if (syncMode === 'installedOnly') {
      const installedGames: GameInfo[] = []
      for (const [appid, inst] of installedMap.entries()) {
        installedGames.push({
          runner: 'steam',
          app_name: appid,
          title: inst.title || KNOWN_STEAM_TITLES[appid] || `Steam Game ${appid}`,
          is_installed: true,
          canRunOffline: true,
          art_square: STEAM_CDN.verticalCover(appid),
          art_cover: STEAM_CDN.horizontalBanner(appid),
          art_background: STEAM_CDN.heroBackground(appid),
          art_logo: '',
          store_url: STEAM_PROTOCOL.storeUrl(appid),
          install: {
            platform: 'Windows',
            is_dlc: false,
            executable: inst.installDir,
            install_path: inst.installDir,
            install_size: `${(inst.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
          }
        })
      }
      libraryStore.set('games', installedGames)
      return { stdout: '', stderr: '' }
    }

    // 3. Obter Jogos da Conta (Via B: API Key, Via A: Sessão Web e Descoberta Local)
    const ownedMap = new Map<string, { title: string }>()

    // Preencher com instalados
    for (const [appid, inst] of installedMap.entries()) {
      ownedMap.set(appid, { title: inst.title })
    }

    // Via B: Chave Steam Web API
    if (apiKey) {
      try {
        const apiGames = await SteamWebApi.fetchGamesByApiKey(apiKey, steamId64)
        for (const g of apiGames) {
          if (!ownedMap.has(g.appId)) {
            ownedMap.set(g.appId, { title: g.title })
          }
        }
      } catch (err) {
        logError(['Steam Web API fetch failed in library refresh', err], LogPrefix.Steam)
      }
    }

    // Via A: Sessão Webview Cookie
    if (sessionCookie) {
      try {
        const webGames = await SteamWebApi.fetchGamesByWebSession(sessionCookie, steamId64)
        for (const g of webGames) {
          if (!ownedMap.has(g.appId)) {
            ownedMap.set(g.appId, { title: g.title })
          }
        }
      } catch (err) {
        logError(['Steam Web Session fetch failed in library refresh', err], LogPrefix.Steam)
      }
    }

    // Descoberta Local complementar em userdata
    const userDir = join(steamPath, 'userdata', steamId32)
    const appinfoPath = join(steamPath, 'appcache', 'appinfo.vdf')
    const appinfoMap = parseAppInfoVdf(appinfoPath)

    const localAppIds = new Set<string>()
    const sharedConfigPath = join(userDir, '7', 'remote', 'sharedconfig.vdf')
    if (existsSync(sharedConfigPath)) {
      try {
        const content = readFileSync(sharedConfigPath, 'utf8')
        for (const m of content.matchAll(/"(\d{3,9})"\s*\{/g)) localAppIds.add(m[1])
      } catch {}
    }

    const localconfigPath = join(userDir, 'config', 'localconfig.vdf')
    if (existsSync(localconfigPath)) {
      try {
        const content = readFileSync(localconfigPath, 'utf8')
        for (const m of content.matchAll(/"(\d{3,9})"\s*\{/g)) localAppIds.add(m[1])
      } catch {}
    }

    const librarycacheDir = join(userDir, 'config', 'librarycache')
    if (existsSync(librarycacheDir)) {
      try {
        for (const f of readdirSync(librarycacheDir)) {
          const m = f.match(/^(\d+)\.json$/)
          if (m) localAppIds.add(m[1])
        }
      } catch {}
    }

    for (const appId of localAppIds) {
      const appinfo = appinfoMap.get(appId)
      if (appinfo) {
        const t = appinfo.type
        if (
          t === 'tool' ||
          t === 'demo' ||
          t === 'dlc' ||
          t === 'music' ||
          t === 'soundtrack' ||
          t === 'config' ||
          t === 'guide' ||
          t === 'video'
        ) {
          continue
        }
      }
      const title = KNOWN_STEAM_TITLES[appId] || appinfo?.title || ''
      if (title && title.length > 2 && !ownedMap.has(appId)) {
        ownedMap.set(appId, { title })
      }
    }

    const finalGames: GameInfo[] = []
    const gridDir = join(userDir, 'config', 'grid')

    for (const [appid, item] of ownedMap.entries()) {
      if (IGNORED_STEAM_APP_IDS.has(appid)) {
        continue
      }

      const installed = installedMap.get(appid)
      const appinfo = appinfoMap.get(appid)

      // Filter out non-games (tools, soundtracks, DLCs, guides)
      if (appinfo) {
        const t = appinfo.type
        if (
          t === 'tool' ||
          t === 'demo' ||
          t === 'dlc' ||
          t === 'music' ||
          t === 'soundtrack' ||
          t === 'config' ||
          t === 'guide' ||
          t === 'video'
        ) {
          continue
        }
      }

      const title = item.title || installed?.title || KNOWN_STEAM_TITLES[appid] || appinfo?.title || ''

      if (!title || title.length <= 2 || /^\d+$/.test(title)) {
        continue
      }

      const lower = title.toLowerCase()
      if (
        lower.includes('steamworks common') ||
        lower.includes('steam linux runtime') ||
        lower.includes('proton ') ||
        lower.includes('dedicated server') ||
        lower.includes('soundtrack') ||
        lower.includes(' depot') ||
        lower.includes('- english depot') ||
        (lower.includes('beta test') && !installed)
      ) {
        continue
      }

      const isInstalled = Boolean(installed)

      // Check local user grid covers
      const localGridVertical = join(gridDir, `${appid}p.jpg`)
      const localGridPng = join(gridDir, `${appid}p.png`)
      const hasLocalGrid = existsSync(localGridVertical) || existsSync(localGridPng)
      const localGridPath = existsSync(localGridVertical) ? localGridVertical : localGridPng

      const localAppCache = join(steamPath, 'appcache', 'librarycache', appid)
      let localSquare: string | null = null
      let localCover: string | null = null
      let localHero: string | null = null
      let localLogo: string | null = null

      if (existsSync(localAppCache)) {
        try {
          const files = readdirSync(localAppCache)
          for (const f of files) {
            const full = join(localAppCache, f)
            if (f === 'library_600x900.jpg' || f === 'library_capsule.jpg') {
              localSquare = full
            } else if (f === 'header.jpg' || f === 'library_header.jpg' || f === 'capsule_616x353.jpg') {
              localCover = full
            } else if (f === 'library_hero.jpg') {
              localHero = full
            } else if (f === 'logo.png') {
              localLogo = full
            } else if (f.endsWith('.jpg') && !localSquare && !localCover && !f.includes('hero')) {
              localSquare = full
            }
          }
        } catch {}
      }

      const art_square = hasLocalGrid
        ? localGridPath
        : localSquare || (STEAM_MISSING_600x900.has(appid)
            ? (localCover || STEAM_CDN.horizontalBanner(appid))
            : STEAM_CDN.verticalCover(appid))

      const art_cover = localCover || STEAM_CDN.horizontalBanner(appid)
      const art_background = localHero || STEAM_CDN.heroBackground(appid)
      const art_logo = localLogo || ''

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
    const game = this.getGameInfo(appName)
    const acf = await SteamDownloader.findAcfState(appName)
    const diskSize = acf?.sizeOnDisk || 1024 * 1024 * 1024
    const downloadSize = acf?.bytesToDownload || Math.round(diskSize * 0.6)

    return {
      manifest: {
        disk_size: diskSize,
        download_size: downloadSize
      },
      game: {
        app_name: appName,
        title: game?.title || `Steam App ${appName}`,
        is_dlc: false,
        owned_dlc: []
      }
    }
  }

  async listUpdateableGames(): Promise<string[]> {
    const isLoggedIn = await SteamUser.isLoggedIn()
    if (!isLoggedIn) return []

    const account = await SteamUser.getDetectedAccount()
    if (!account) return []

    const { steamPath } = account
    const libraryPaths: string[] = [steamPath]

    const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
    if (existsSync(vdfPath)) {
      try {
        const vdfContent = readFileSync(vdfPath, 'utf8')
        const pathMatches = [...vdfContent.matchAll(/"path"\s+"([^"]+)"/g)]
        for (const m of pathMatches) {
          const libPath = m[1].replace(/\\\\/g, '\\').replace(/\//g, '\\')
          if (existsSync(libPath) && !libraryPaths.includes(libPath)) {
            libraryPaths.push(libPath)
          }
        }
      } catch (err) {
        logError(['Error reading libraryfolders.vdf in listUpdateableGames', err], LogPrefix.Steam)
      }
    }

    const updateableGames: string[] = []

    for (const libPath of libraryPaths) {
      const steamappsDir = join(libPath, 'steamapps')
      if (!existsSync(steamappsDir)) continue

      try {
        const files = readdirSync(steamappsDir)
        for (const file of files) {
          const match = file.match(/^appmanifest_(\d+)\.acf$/i)
          if (!match) continue

          const appid = match[1]
          if (IGNORED_STEAM_APP_IDS.has(appid)) continue

          try {
            const acfContent = readFileSync(join(steamappsDir, file), 'utf8')
            const nameMatch = acfContent.match(/"name"\s+"([^"]+)"/i)
            const title = nameMatch ? nameMatch[1].trim().toLowerCase() : ''
            if (
              title.includes('soundtrack') ||
              title.includes('steamworks common') ||
              title.includes('steam linux runtime') ||
              title.includes('proton ')
            ) {
              continue
            }

            const stateMatch = acfContent.match(/"StateFlags"\s+"([^"]+)"/i)
            const downloadedMatch = acfContent.match(/"BytesDownloaded"\s+"([^"]+)"/i)
            const toDownloadMatch = acfContent.match(/"BytesToDownload"\s+"([^"]+)"/i)
            const sizeMatch = acfContent.match(/"SizeOnDisk"\s+"([^"]+)"/i)
            const buildMatch = acfContent.match(/"buildid"\s+"([^"]+)"/i)
            const targetBuildMatch = acfContent.match(/"TargetBuildID"\s+"([^"]+)"/i)

            const stateFlags = stateMatch ? parseInt(stateMatch[1], 10) : 0
            const bytesDownloaded = downloadedMatch ? parseInt(downloadedMatch[1], 10) : 0
            const bytesToDownload = toDownloadMatch ? parseInt(toDownloadMatch[1], 10) : 0
            const sizeOnDisk = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
            const buildId = buildMatch ? buildMatch[1].trim() : ''
            const targetBuildId = targetBuildMatch ? targetBuildMatch[1].trim() : ''

            const isInstalled = (stateFlags & 4) !== 0 || sizeOnDisk > 0
            const hasUpdateRequiredFlag = (stateFlags & 2) !== 0
            const hasTargetBuildDiff = Boolean(targetBuildId && targetBuildId !== '0' && targetBuildId !== buildId)
            const hasPendingDownload = bytesToDownload > 0 && bytesDownloaded < bytesToDownload && stateFlags !== 4

            if (isInstalled && (hasUpdateRequiredFlag || hasTargetBuildDiff || hasPendingDownload)) {
              logInfo(`Steam game update available for AppID ${appid} (${nameMatch ? nameMatch[1] : appid})`, LogPrefix.Steam)
              updateableGames.push(appid)
            }
          } catch (err) {
            logError([`Error checking update state for ${file}:`, err], LogPrefix.Steam)
          }
        }
      } catch (err) {
        logError([`Error reading library folder ${steamappsDir}:`, err], LogPrefix.Steam)
      }
    }

    logInfo(`Found ${updateableGames.length} Steam games with updates available`, LogPrefix.Steam)
    return updateableGames
  }

  async changeGameInstallPath(): Promise<void> {}
  changeVersionPinnedStatus(): void {}
  installState(): void {}

  getLaunchOptions(appName: string): LaunchOption[] {
    return []
  }
}
