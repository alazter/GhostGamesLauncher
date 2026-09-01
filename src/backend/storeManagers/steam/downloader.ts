import { existsSync, readFileSync } from 'graceful-fs'
import { join } from 'path'
import { shell } from 'electron'
import { InstallResult } from 'common/types/game_manager'
import { STEAM_PROTOCOL } from './constants'
import { SteamUser } from './user'
import { libraryStore } from './electronStores'
import { sendGameStatusUpdate, sendProgressUpdate } from '../../utils'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { sendFrontendMessage } from '../../ipc'
import { findGameExecutables } from './processWatcher'

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
  private static activeWatchers = new Map<string, { abort: () => void }>()

  /**
   * Retrieves all configured Steam library folder paths.
   */
  public static async getSteamLibraryFolders(): Promise<string[]> {
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
        logError(['Error reading libraryfolders.vdf in downloader', err], LogPrefix.Steam)
      }
    }

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

    // 1. Trigger Steam install protocol
    const url = STEAM_PROTOCOL.installGame(appId)
    await shell.openExternal(url)

    // 2. Watch progress
    return this.watchDownload(appId)
  }

  /**
   * Watches an active Steam download until completion or cancellation.
   */
  public static async watchDownload(appId: string): Promise<InstallResult> {
    if (this.activeWatchers.has(appId)) {
      this.activeWatchers.get(appId)?.abort()
      this.activeWatchers.delete(appId)
    }

    return new Promise((resolve) => {
      let aborted = false
      let lastDownloaded = 0
      let lastTime = Date.now()
      let consecutiveCompleteChecks = 0

      const abort = () => {
        aborted = true
        clearInterval(pollInterval)
        this.activeWatchers.delete(appId)
        sendGameStatusUpdate({
          appName: appId,
          runner: 'steam',
          status: 'done'
        })
        resolve({ status: 'abort' })
      }

      this.activeWatchers.set(appId, { abort })

      const pollInterval = setInterval(async () => {
        if (aborted) return

        const acf = await this.findAcfState(appId)
        const now = Date.now()
        const deltaTimeSec = Math.max(0.5, (now - lastTime) / 1000)

        if (!acf) {
          sendGameStatusUpdate({
            appName: appId,
            runner: 'steam',
            status: 'installing',
            progress: {
              bytes: '0 MB / ...',
              eta: '--:--',
              percent: 0,
              downSpeed: 0
            }
          })
          return
        }

        const { stateFlags, bytesDownloaded, bytesToDownload, fullInstallPath, name } = acf

        const bytesDiff = Math.max(0, bytesDownloaded - lastDownloaded)
        const speedMBps = bytesDiff / (1024 * 1024 * deltaTimeSec)
        lastDownloaded = bytesDownloaded
        lastTime = now

        let percent = 0
        if (bytesToDownload > 0) {
          percent = Math.min(100, Math.max(0, Math.round((bytesDownloaded / bytesToDownload) * 100)))
        }

        const remainingBytes = Math.max(0, bytesToDownload - bytesDownloaded)
        const secondsRemaining = speedMBps > 0 ? Math.round(remainingBytes / (speedMBps * 1024 * 1024)) : 0

        const formattedEta = secondsRemaining > 0
          ? `${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s`
          : '00:00'

        const formattedDownloaded = (bytesDownloaded / (1024 * 1024 * 1024)).toFixed(2)
        const formattedTotal = (bytesToDownload / (1024 * 1024 * 1024)).toFixed(2)
        const bytesString = bytesToDownload > 0
          ? `${formattedDownloaded} GB / ${formattedTotal} GB`
          : `${(bytesDownloaded / (1024 * 1024)).toFixed(1)} MB`

        const isFullyInstalled = stateFlags === 4 || (bytesToDownload > 0 && bytesDownloaded >= bytesToDownload && stateFlags !== 1026)

        if (isFullyInstalled) {
          consecutiveCompleteChecks++
          if (consecutiveCompleteChecks >= 2) {
            clearInterval(pollInterval)
            this.activeWatchers.delete(appId)

            logInfo(`Steam download complete for ${name} (${appId})`, LogPrefix.Steam)

            const list = libraryStore.get('games', [])
            const gameIdx = list.findIndex((g) => g.app_name === appId)
            const exes = findGameExecutables(fullInstallPath)
            const mainExe = exes.length > 0 ? exes[0] : ''

            if (gameIdx >= 0) {
              list[gameIdx] = {
                ...list[gameIdx],
                is_installed: true,
                install: {
                  ...list[gameIdx].install,
                  install_path: fullInstallPath,
                  executable: mainExe,
                  version: acf.buildId || '1.0'
                }
              }
              libraryStore.set('games', list)
            }

            sendProgressUpdate({
              appName: appId,
              runner: 'steam',
              status: 'done',
              folder: fullInstallPath,
              progress: {
                bytes: bytesString,
                eta: '00:00',
                percent: 100,
                downSpeed: 0,
                folder: fullInstallPath
              }
            })

            sendGameStatusUpdate({
              appName: appId,
              runner: 'steam',
              status: 'done'
            })

            sendFrontendMessage('refreshLibrary', 'steam')

            resolve({ status: 'done' })
            return
          }
        } else {
          consecutiveCompleteChecks = 0
        }

        sendProgressUpdate({
          appName: appId,
          runner: 'steam',
          status: 'installing',
          folder: fullInstallPath,
          progress: {
            bytes: bytesString,
            eta: formattedEta,
            percent,
            downSpeed: Math.round(speedMBps * 10) / 10,
            folder: fullInstallPath
          }
        })

        sendGameStatusUpdate({
          appName: appId,
          runner: 'steam',
          status: 'installing',
          folder: fullInstallPath,
          progress: {
            bytes: bytesString,
            eta: formattedEta,
            percent,
            downSpeed: Math.round(speedMBps * 10) / 10,
            folder: fullInstallPath
          }
        })
      }, 750)
    })
  }

  /**
   * Cancels a currently monitored download for a Steam game.
   */
  public static cancelDownload(appId: string) {
    if (this.activeWatchers.has(appId)) {
      this.activeWatchers.get(appId)?.abort()
      this.activeWatchers.delete(appId)
    }
  }
}
