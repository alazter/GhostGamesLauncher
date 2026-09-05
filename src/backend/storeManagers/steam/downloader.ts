import { existsSync, readFileSync } from 'graceful-fs'
import { join } from 'path'
import { InstallResult } from 'common/types/game_manager'
import { STEAM_PROTOCOL } from './constants'
import { SteamUser } from './user'
import { SteamQueueWatcher } from './queueWatcher'
import { logInfo, logError, LogPrefix } from 'backend/logger'

interface SteamAcfState {
  appId: string
  name: string
  installDir: string
  fullInstallPath: string
  acfPath: string
  stateFlags: number
  bytesDownloaded: number
  bytesToDownload: number
  sizeOnDisk: number
  buildId: string
}

export class SteamDownloader {
  private static cachedLibraryFolders: { paths: string[]; time: number } | null = null

  /**
   * Retrieves all configured Steam library folder paths.
   */
  public static async getSteamLibraryFolders(): Promise<string[]> {
    const now = Date.now()
    if (this.cachedLibraryFolders && now - this.cachedLibraryFolders.time < 10000) {
      return this.cachedLibraryFolders.paths
    }

    const steamPath =
      (await SteamUser.getSteamPath()) ||
      (await SteamUser.getDetectedAccount())?.steamPath
    if (!steamPath) return []

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
        logError(['Error reading libraryfolders.vdf in downloader', err], LogPrefix.Steam)
      }
    }

    this.cachedLibraryFolders = { paths: libraryPaths, time: now }
    return libraryPaths
  }

  /**
   * Locates the appmanifest_<appId>.acf file across all known Steam libraries.
   */
  public static async findAcfState(appId: string): Promise<SteamAcfState | null> {
    const libraryFolders = await this.getSteamLibraryFolders()

    for (const libPath of libraryFolders) {
      const steamappsDir = join(libPath, 'steamapps')
      const acfPath = join(steamappsDir, `appmanifest_${appId}.acf`)

      if (existsSync(acfPath)) {
        try {
          const content = readFileSync(acfPath, 'utf8')
          const nameMatch = content.match(/"name"\s+"([^"]+)"/i)
          const dirMatch = content.match(/"installdir"\s+"([^"]+)"/i)
          const sizeMatch = content.match(/"SizeOnDisk"\s+"([^"]+)"/i)
          const stateMatch = content.match(/"StateFlags"\s+"([^"]+)"/i)
          const downloadedMatch = content.match(/"BytesDownloaded"\s+"([^"]+)"/i)
          const toDownloadMatch = content.match(/"BytesToDownload"\s+"([^"]+)"/i)
          const buildMatch = content.match(/"buildid"\s+"([^"]+)"/i)

          const name = nameMatch ? nameMatch[1].trim() : `Steam App ${appId}`
          const installDir = dirMatch ? dirMatch[1].trim() : appId
          const fullInstallPath = join(steamappsDir, 'common', installDir)
          const stateFlags = stateMatch ? parseInt(stateMatch[1], 10) : 0
          const bytesDownloaded = downloadedMatch ? parseInt(downloadedMatch[1], 10) : 0
          const bytesToDownload = toDownloadMatch ? parseInt(toDownloadMatch[1], 10) : 0
          const sizeOnDisk = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
          const buildId = buildMatch ? buildMatch[1].trim() : ''

          return {
            appId,
            name,
            installDir,
            fullInstallPath,
            acfPath,
            stateFlags,
            bytesDownloaded,
            bytesToDownload,
            sizeOnDisk,
            buildId
          }
        } catch (err) {
          logError([`Error parsing ${acfPath}:`, err], LogPrefix.Steam)
        }
      }
    }

    return null
  }

  /**
   * Starts downloading a Steam game and streams live progress to Ghost Download Manager.
   */
  public static async installGame(appId: string): Promise<InstallResult> {
    logInfo(`Starting Steam native download orchestrator for AppID ${appId}`, LogPrefix.Steam)

    SteamQueueWatcher.trackPendingInstall(appId)
    const url = STEAM_PROTOCOL.installGame(appId)
    await SteamQueueWatcher.triggerSteamUrl(url)

    return this.watchDownload(appId)
  }

  /**
   * Watches an active Steam download until completion or cancellation.
   * Delegates unified telemetry and lifecycle to SteamQueueWatcher.
   */
  public static async watchDownload(appId: string): Promise<InstallResult> {
    void SteamQueueWatcher.startWatcherIfNeeded()
    return SteamQueueWatcher.waitForCompletion(appId)
  }

  /**
   * Checks if an app is currently being monitored.
   */
  public static isWatching(appId: string): boolean {
    return SteamQueueWatcher.isAppActiveOrQueued(appId)
  }

  /**
   * Cancels a currently monitored download for a Steam game.
   */
  public static cancelDownload(appId: string) {
    SteamQueueWatcher.dismissApp(appId)
  }
}
