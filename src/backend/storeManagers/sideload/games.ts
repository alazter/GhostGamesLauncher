import {
  ExecResult,
  ExtraInfo,
  GameInfo,
  GameSettings,
  LaunchOption
} from 'common/types'
import { libraryStore } from './electronStores'
import { GameConfig } from '../../game_config'
import { GlobalConfig } from 'backend/config'
import {
  killPattern,
  moveOnUnix,
  moveOnWindows,
  sendGameStatusUpdate,
  shutdownWine
} from '../../utils'
import { sendFrontendMessage } from '../../ipc'
import { logError, logInfo, LogPrefix, logWarning } from 'backend/logger'
import { dirname, basename, join, relative, resolve, isAbsolute } from 'path'
import { existsSync, rmSync } from 'graceful-fs'
import i18next from 'i18next'
import {
  addShortcuts as addShortcutsUtil,
  removeShortcuts as removeShortcutsUtil
} from '../../shortcuts/shortcuts/shortcuts'
import { notify } from '../../dialog/dialog'
import {
  findCandidateGameExesInFolder,
  launchGame
} from 'backend/storeManagers/storeManagerCommon/games'
import { stopBeforeLaunchScript } from 'backend/launcher'
import { Game, InstallResult, RemoveArgs } from 'common/types/game_manager'
import { removePrefix } from 'backend/utils/uninstaller'
import { removeRecentGame } from 'backend/recent_games/recent_games'
import { isLinux, isMac, isWindows } from 'backend/constants/environment'
import { removeNonSteamGame } from 'backend/shortcuts/nonesteamgame/nonesteamgame'

import type LogWriter from 'backend/logger/log_writer'
import { ExternalGames } from 'backend/plugins/externalGames'

export default class SideloadGame implements Game {
  private readonly id: string

  constructor(id: string) {
    this.id = id
  }

  getGameInfo(): GameInfo {
    const store = libraryStore.get('games', [])
    const info = store.find((app) => app.app_name === this.id)
    if (!info) {
      // @ts-expect-error TODO: As with LegendaryGame and GOGGame, handle this properly
      return {}
    }
    if (info.accountProvider && info.is_installed && (!info.install?.executable || info.install.executable.trim() === '')) {
      return { ...info, is_installed: false }
    }
    return info
  }

  async getSettings(): Promise<GameSettings> {
    return (
      GameConfig.get(this.id).config ||
      (await GameConfig.get(this.id).getSettings())
    )
  }

  async addShortcuts(fromMenu?: boolean): Promise<void> {
    return addShortcutsUtil(this, fromMenu)
  }

  async removeShortcuts(): Promise<void> {
    return removeShortcutsUtil(this)
  }

  async isGameAvailable(): Promise<boolean> {
    if (this.getGameInfo().accountProvider) return true
    const { install } = this.getGameInfo()

    if (install && install.platform === 'Browser') {
      return true
    }

    if (install && install.executable) {
      return existsSync(install.executable)
    }

    return false
  }

  async launch(
    logWriter: LogWriter,
    launchArguments?: LaunchOption,
    args: string[] = []
  ): Promise<boolean> {
    if (!ExternalGames.getInstance().canLaunch(this.id)) {
      logWriter.logError(['O Ghost está protegendo os saves ou finalizando uma instalação. Aguarde a operação terminar.'])
      return false
    }
    return launchGame(this, logWriter, args)
  }

  async stop(): Promise<void> {
    const game = this.getGameInfo()
    const executable = game?.install?.executable

    if (executable) {
      const gameSettings = await this.getSettings()
      const target = game.install.romPlatform === 'switch'
        ? GlobalConfig.get().getSettings().switchEmulatorPath
        : gameSettings.targetExe || executable
      if (!target) return
      const split = target.split(/[/\\]/)
      const exe = split[split.length - 1]
      killPattern(exe)

      if (isWindows && !game.install.romPlatform) {
        const installDir =
          game.folder_name || game.install?.install_path || dirname(executable)
        if (installDir && existsSync(installDir)) {
          const excludeNames = new Set<string>([exe.toLowerCase()])
          if (gameSettings.beforeLaunchScriptPath) {
            excludeNames.add(
              basename(gameSettings.beforeLaunchScriptPath).toLowerCase()
            )
          }
          if (gameSettings.afterLaunchScriptPath) {
            excludeNames.add(
              basename(gameSettings.afterLaunchScriptPath).toLowerCase()
            )
          }
          const childExes = findCandidateGameExesInFolder(
            installDir,
            excludeNames
          )
          for (const childExe of childExes) {
            killPattern(childExe)
          }
        }
      }

      await stopBeforeLaunchScript(game, gameSettings).catch(() => undefined)

      if (!this.isNative()) {
        shutdownWine(gameSettings)
      }
    }

    if (this.id) {
      killPattern(this.id)
    }
  }

  async uninstall({
    shouldRemovePrefix,
    deleteFiles = false
  }: RemoveArgs): Promise<ExecResult> {
    sendGameStatusUpdate({
      appName: this.id,
      runner: 'sideload',
      status: 'uninstalling'
    })

    const old = libraryStore.get('games', [])
    const current = old.filter((a: GameInfo) => a.app_name !== this.id)

    let gameInfo: GameInfo | null = null
    try {
      gameInfo = this.getGameInfo()
    } catch {}

    const title = gameInfo?.title || this.id
    const executable = gameInfo?.install?.executable

    if (shouldRemovePrefix) {
      try {
        removePrefix(this.id, 'sideload')
      } catch {}
    }
    libraryStore.set('games', current)
    try {
      ExternalGames.getInstance().removeInstallation(this.id)
    } catch {}
    sendFrontendMessage('refreshLibrary', 'sideload')

    if (deleteFiles && executable !== undefined && existsSync(executable)) {
      try {
        rmSync(dirname(executable), { recursive: true })
      } catch {}
    }

    notify({ title, body: i18next.t('notify.uninstalled') })

    removeShortcutsUtil(this)
    removeRecentGame(this.id)
    removeNonSteamGame(this)

    sendGameStatusUpdate({
      appName: this.id,
      runner: 'sideload',
      status: 'done'
    })

    logInfo('finished uninstalling', LogPrefix.Backend)
    return { stderr: '', stdout: '' }
  }

  isNative(): boolean {
    const {
      install: { platform }
    } = this.getGameInfo()
    if (platform) {
      if (platform === 'Browser') {
        return true
      }

      if (isWindows) {
        return true
      }

      if (isMac && platform === 'Mac') {
        return true
      }

      // small hack, but needs to fix the typings
      const plat = platform.toLowerCase()
      if (isLinux && plat === 'linux') {
        return true
      }
    }

    return false
  }

  async getExtraInfo(): Promise<ExtraInfo> {
    logWarning(
      `getExtraInfo not implemented on Sideload Game Manager. called for ID = ${this.id}`
    )
    return {
      about: {
        description: '',
        shortDescription: ''
      },
      reqs: [],
      storeUrl: ''
    }
  }

  onInstallOrUpdateOutput() {
    logWarning(
      `onInstallOrUpdateOutput not implemented on Sideload Game Manager. called for ID = ${this.id}`
    )
  }

  async moveInstall(
    newInstallPath: string
  ): Promise<
    { status: 'done'; installPath?: string } | { status: 'error'; error?: string }
  > {
    try {
      const gameInfo = this.getGameInfo()
      if (!gameInfo || !gameInfo.app_name) {
        return { status: 'error', error: 'Jogo não encontrado na biblioteca.' }
      }

      const oldExecutable = gameInfo.install?.executable || ''
      const extInst = ExternalGames.getInstance()
        .snapshot()
        .installations.find((i) => i.appName === this.id || i.id === this.id)

      const candidateDirs = [
        extInst?.directory,
        gameInfo.install?.install_path,
        gameInfo.folder_name,
        oldExecutable ? dirname(oldExecutable) : ''
      ].filter((p): p is string => Boolean(p && p.trim().length > 0))

      const sourceDir = candidateDirs.find((dir) => existsSync(dir))
      if (!sourceDir) {
        return {
          status: 'error',
          error: 'Pasta de instalação original do jogo não foi encontrada no disco.'
        }
      }

      const resolvedSource = resolve(sourceDir)
      if (resolvedSource === dirname(resolvedSource)) {
        return {
          status: 'error',
          error: 'Não é permitido mover a raiz de uma unidade de disco.'
        }
      }

      logInfo(
        `[SideloadGame] Moving ${gameInfo.title} from ${sourceDir} to ${newInstallPath}`,
        LogPrefix.Backend
      )

      const moveImpl = isWindows ? moveOnWindows : moveOnUnix
      const moveResult = await moveImpl(newInstallPath, {
        ...gameInfo,
        install: {
          ...gameInfo.install,
          install_path: sourceDir
        }
      })

      if (moveResult.status === 'error') {
        logError(
          ['[SideloadGame] Error moving', gameInfo.title, 'to', newInstallPath, moveResult.error],
          LogPrefix.Backend
        )
        return { status: 'error', error: moveResult.error }
      }

      const finalInstallPath = moveResult.installPath
      let newExecutable = oldExecutable

      if (oldExecutable) {
        const relExe = relative(sourceDir, oldExecutable)
        if (!relExe.startsWith('..') && !isAbsolute(relExe)) {
          const candidateExe = join(finalInstallPath, relExe)
          if (existsSync(candidateExe)) {
            newExecutable = candidateExe
          } else {
            const fallbackExe = join(finalInstallPath, basename(oldExecutable))
            newExecutable = existsSync(fallbackExe) ? fallbackExe : candidateExe
          }
        }
      }

      const games = libraryStore.get('games', [])
      const idx = games.findIndex((g) => g.app_name === this.id)
      if (idx !== -1) {
        const current = games[idx]
        games[idx] = {
          ...current,
          folder_name: finalInstallPath,
          install: {
            ...current.install,
            install_path: finalInstallPath,
            executable: newExecutable || current.install?.executable || ''
          }
        }
        libraryStore.set('games', games)
      }

      try {
        const gameSettings = await this.getSettings()
        if (gameSettings.targetExe) {
          const relTarget = relative(sourceDir, gameSettings.targetExe)
          if (!relTarget.startsWith('..') && !isAbsolute(relTarget)) {
            GameConfig.get(this.id).setSetting(
              'targetExe',
              join(finalInstallPath, relTarget)
            )
          }
        }
      } catch {}

      ExternalGames.getInstance().relocateInstallation(
        this.id,
        sourceDir,
        finalInstallPath,
        newExecutable
      )

      sendFrontendMessage('refreshLibrary', 'sideload')
      return { status: 'done', installPath: finalInstallPath }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logError(['[SideloadGame] Unexpected error in moveInstall:', err], LogPrefix.Backend)
      return { status: 'error', error: errorMsg }
    }
  }

  async repair(): Promise<ExecResult> {
    logWarning(
      `repair not implemented on Sideload Game Manager. called for ID = ${this.id}`
    )
    return { stderr: '', stdout: '' }
  }

  async syncSaves(): Promise<string> {
    logWarning(
      `syncSaves not implemented on Sideload Game Manager. called for ID = ${this.id}`
    )
    return ''
  }

  async forceUninstall(): Promise<void> {
    logWarning(
      `forceUninstall not implemented on Sideload Game Manager. called for ID = ${this.id}`
    )
  }

  async install(): Promise<InstallResult> {
    logWarning(
      `install not implemented on Sideload Game Manager. called for ID = ${this.id}`
    )
    return { status: 'error' }
  }

  async importGame(): Promise<ExecResult> {
    return { stderr: '', stdout: '' }
  }

  async update(): Promise<{ status: 'done' | 'error' }> {
    try {
      const { ExternalGames } = await import('../../plugins/externalGames')
      const { PluginManager } = await import('../../plugins/pluginManager')
      const extManager = ExternalGames.getInstance()
      let gameInfo: GameInfo | null = null
      try {
        gameInfo = this.getGameInfo()
      } catch {}
      const targetFolder = gameInfo?.folder_name || gameInfo?.install?.install_path
      const inst = extManager.snapshot().installations.find(
        (i) => i.appName === this.id || (targetFolder && i.directory && i.directory.toLowerCase() === targetFolder.toLowerCase())
      )
      if (inst?.availableUpdate) {
        logInfo(`[SideloadGame] Auto-updating ${inst.game.title} via ${inst.availableUpdate.providerName}...`, LogPrefix.Backend)
        const res = await PluginManager.getInstance().installExternalGame({
          game: inst.availableUpdate,
          sourceId: inst.availableUpdate.providerId,
          replaceInstallationId: inst.id,
          confirmed: true
        })
        if (res.success) return { status: 'done' }
      }
    } catch (err) {
      logError(['[SideloadGame] Error during game update:', err], LogPrefix.Backend)
    }
    return { status: 'error' }
  }
}
