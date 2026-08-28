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
import { sendGameStatusUpdate } from '../../utils'
import { logInfo, LogPrefix } from 'backend/logger'
import type LogWriter from 'backend/logger/log_writer'
import {
  watchSteamGameSession,
  killSteamGameProcesses,
  findGameExecutables
} from './processWatcher'

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
        app_name: this.id,
        title: this.id,
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
    await shell.openExternal(url)

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

  async install(): Promise<InstallResult> {
    logInfo(`Opening Steam install dialogue for ${this.id}`, LogPrefix.Steam)
    const url = STEAM_PROTOCOL.installGame(this.id)
    await shell.openExternal(url)
    return { status: 'done' }
  }

  async stop(): Promise<void> {
    logInfo(`Stop requested for Steam game ${this.id}`, LogPrefix.Steam)
    this.isStopping = true

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
    await shell.openExternal(url)
    return { stdout: '', stderr: '' }
  }

  async forceUninstall(): Promise<void> {
    return Promise.resolve()
  }

  async repair(): Promise<ExecResult> {
    const url = `steam://validate/${this.id}`
    await shell.openExternal(url)
    return { stdout: '', stderr: '' }
  }

  async update(): Promise<InstallResult> {
    return { status: 'done' }
  }

  async moveInstall(): Promise<InstallResult> {
    return { status: 'done' }
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
