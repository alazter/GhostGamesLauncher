import {
  ExecResult,
  ExtraInfo,
  GameInfo,
  GameSettings,
  LaunchOption
} from 'common/types'
import { libraryStore } from './electronStores'
import { GameConfig } from '../../game_config'
import { Game, InstallResult } from 'common/types/game_manager'
import { shell } from 'electron'
import { STEAM_PROTOCOL } from './constants'
import { moveOnUnix, moveOnWindows, sendGameStatusUpdate } from '../../utils'
import { sendFrontendMessage } from '../../ipc'
import { isWindows } from 'backend/constants/environment'
import { logError, logInfo, LogPrefix } from 'backend/logger'
import type LogWriter from 'backend/logger/log_writer'
import {
  watchSteamGameSession,
  killSteamGameProcesses,
  findGameExecutables
} from './processWatcher'
import { dirname, basename, join } from 'path'
import { existsSync, renameSync, copyFileSync, unlinkSync } from 'fs'
import { SteamDownloader } from './downloader'
import { SteamQueueWatcher } from './queueWatcher'
import { SteamUser } from './user'

export default class SteamGame implements Game {
  private readonly id: string
  private isStopping = false
  private trackedPids: number[] = []

  constructor(id: string) {
    this.id = id
  }

  getGameInfo(): GameInfo {
    const store = libraryStore.get('games', [])
    const info = store.find((app) => app.app_name === this.id)
    if (!info) {
      return {
        runner: 'steam',
        app_name: '',
        title: '',
        art_cover: '',
        art_square: '',
        is_installed: false,
        canRunOffline: true,
        install: { is_dlc: false }
      }
    }
    return info
  }

  async getSettings(): Promise<GameSettings> {
    return (
      GameConfig.get(this.id).config ||
      (await GameConfig.get(this.id).getSettings())
    )
  }

  async addShortcuts(): Promise<void> {
    return Promise.resolve()
  }

  async removeShortcuts(): Promise<void> {
    return Promise.resolve()
  }

  async isGameAvailable(): Promise<boolean> {
    return Boolean(this.getGameInfo().is_installed)
  }

  async launch(
    logWriter?: LogWriter,
    launchArguments?: LaunchOption,
    args: string[] = []
  ): Promise<boolean> {
    this.isStopping = false
    this.trackedPids = []

    const gameInfo = this.getGameInfo()
    const installDir = gameInfo.install?.install_path || ''

    logInfo(
      `Launching Steam game ${gameInfo.title} (${this.id}) via Steam protocol`,
      LogPrefix.Steam
    )
    sendGameStatusUpdate({
      appName: this.id,
      runner: 'steam',
      status: 'playing'
    })

    const url = STEAM_PROTOCOL.runGame(this.id)
    await SteamQueueWatcher.triggerSteamUrl(url)

    const success = await watchSteamGameSession({
      appId: this.id,
      gameTitle: gameInfo.title,
      installDir,
      logWriter,
      isStoppingRequested: () => this.isStopping,
      onProcessDetected: (pids) => {
        this.trackedPids = pids
      }
    })

    sendGameStatusUpdate({
      appName: this.id,
      runner: 'steam',
      status: 'done'
    })

    return success
  }

  private async triggerSteamUrl(url: string): Promise<void> {
    await SteamQueueWatcher.triggerSteamUrl(url)
  }

  async install(): Promise<InstallResult> {
    logInfo(`Initiating Steam install for ${this.id}`, LogPrefix.Steam)
    SteamQueueWatcher.undismissApp(this.id)
    SteamQueueWatcher.trackPendingInstall(this.id)
    const url = `steam://install/${this.id}`
    await this.triggerSteamUrl(url)
    SteamQueueWatcher.startWatcher()
    return SteamQueueWatcher.waitForCompletion(this.id)
  }

  async stop(): Promise<void> {
    logInfo(`Stop requested for Steam game ${this.id}`, LogPrefix.Steam)
    this.isStopping = true
    SteamDownloader.cancelDownload(this.id)
    SteamQueueWatcher.dismissApp(this.id)
    await SteamQueueWatcher.pauseApp(this.id)

    const gameInfo = this.getGameInfo()
    const installDir = gameInfo.install?.install_path || ''
    const exes = findGameExecutables(installDir)

    await killSteamGameProcesses(this.trackedPids, exes)

    sendGameStatusUpdate({
      appName: this.id,
      runner: 'steam',
      status: 'done'
    })

    return Promise.resolve()
  }

  async uninstall(): Promise<ExecResult> {
    const url = `steam://uninstall/${this.id}`
    await this.triggerSteamUrl(url)
    return { stdout: '', stderr: '' }
  }

  async forceUninstall(): Promise<void> {
    return Promise.resolve()
  }

  async repair(): Promise<ExecResult> {
    logInfo(`Repair requested for Steam game ${this.id}`, LogPrefix.Steam)
    const url = `steam://validate/${this.id}`
    await this.triggerSteamUrl(url)
    void SteamDownloader.watchDownload(this.id)
    return { stdout: '', stderr: '' }
  }

  async update(): Promise<InstallResult> {
    logInfo(`Update requested for Steam game ${this.id}`, LogPrefix.Steam)
    const url = `steam://validate/${this.id}`
    await this.triggerSteamUrl(url)
    return SteamDownloader.watchDownload(this.id)
  }

  async moveInstall(newInstallPath: string): Promise<InstallResult> {
    try {
      const gameInfo = this.getGameInfo()
      const sourceDir = gameInfo.install?.install_path || gameInfo.folder_name || ''
      if (!sourceDir || !existsSync(sourceDir)) {
        return {
          status: 'error',
          error: 'Pasta de instalação original do jogo Steam não encontrada no disco.'
        }
      }

      const moveImpl = isWindows ? moveOnWindows : moveOnUnix
      const moveResult = await moveImpl(newInstallPath, {
        ...gameInfo,
        install: {
          ...gameInfo.install,
          install_path: sourceDir
        }
      })

      if (moveResult.status === 'error') {
        logError(['[SteamGame] Error moving', gameInfo.title, 'to', newInstallPath, moveResult.error], LogPrefix.Steam)
        return { status: 'error', error: moveResult.error }
      }

      // Se a origem possuir um appmanifest_<appid>.acf em steamapps e o destino também estiver em steamapps/common, mover o manifesto .acf
      try {
        const oldCommonDir = dirname(sourceDir)
        const oldSteamappsDir = dirname(oldCommonDir)
        const acfName = `appmanifest_${this.id}.acf`
        const oldAcfPath = join(oldSteamappsDir, acfName)
        const newCommonDir = dirname(moveResult.installPath)
        const newSteamappsDir = dirname(newCommonDir)
        if (
          existsSync(oldAcfPath) &&
          basename(newCommonDir).toLowerCase() === 'common' &&
          existsSync(newSteamappsDir)
        ) {
          const newAcfPath = join(newSteamappsDir, acfName)
          try {
            renameSync(oldAcfPath, newAcfPath)
          } catch {
            copyFileSync(oldAcfPath, newAcfPath)
            unlinkSync(oldAcfPath)
          }
        }
      } catch {}

      const games = libraryStore.get('games', [])
      const idx = games.findIndex((g) => g.app_name === this.id)
      if (idx !== -1) {
        games[idx] = {
          ...games[idx],
          folder_name: moveResult.installPath,
          install: {
            ...games[idx].install,
            install_path: moveResult.installPath,
            executable: moveResult.installPath
          }
        }
        libraryStore.set('games', games)
      }

      sendFrontendMessage('refreshLibrary', 'steam')
      return { status: 'done' }
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  async syncSaves(): Promise<string> {
    return ''
  }

  async getExtraInfo(): Promise<ExtraInfo> {
    const info = this.getGameInfo()
    return {
      about: {
        description: info.description || '',
        shortDescription: ''
      },
      reqs: []
    }
  }

  async importGame(): Promise<ExecResult> {
    return { stdout: '', stderr: '' }
  }

  onInstallOrUpdateOutput(): void {}

  isNative(): boolean {
    return true
  }
}
