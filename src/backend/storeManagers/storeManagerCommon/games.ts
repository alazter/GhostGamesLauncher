import { GameInfo, GameSettings, Runner } from 'common/types'
import { GameConfig } from '../../game_config'
import { logInfo, LogPrefix, logWarning } from 'backend/logger'
import { basename, dirname } from 'path'
import { constants as FS_CONSTANTS } from 'graceful-fs'
import i18next from 'i18next'
import {
  callRunner,
  getKnownFixesEnvVariables,
  launchCleanup,
  prepareLaunch,
  prepareWineLaunch,
  runWineCommand,
  setupEnvVars,
  setupWrapperEnvVars,
  setupWrappers
} from '../../launcher'
import { access, chmod } from 'fs/promises'
import shlex from 'shlex'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
import { showDialogBoxModalAuto } from '../../dialog/dialog'
import {
  createAbortController,
  deleteAbortController
} from '../../utils/aborthandler/aborthandler'
import { BrowserWindow, dialog, Menu } from 'electron'
import { gameManagerMap } from '../index'
import { sendGameStatusUpdate } from 'backend/utils'
import { isLinux, isMac } from 'backend/constants/environment'
import { windowIcon } from 'backend/constants/paths'

import type LogWriter from 'backend/logger/log_writer'

async function getAppSettings(appName: string): Promise<GameSettings> {
  return (
    GameConfig.get(appName).config ||
    (await GameConfig.get(appName).getSettings())
  )
}

type BrowserGameOptions = {
  browserUrl: string
  abortId: string
  customUserAgent?: string
  launchFullScreen?: boolean
}

const openNewBrowserGameWindow = async ({
  browserUrl,
  abortId,
  customUserAgent,
  launchFullScreen
}: BrowserGameOptions): Promise<boolean> => {
  const hostname = new URL(browserUrl).hostname

  return new Promise((res) => {
    const browserGame = new BrowserWindow({
      icon: windowIcon,
      fullscreen: launchFullScreen ?? false,
      autoHideMenuBar: true,
      webPreferences: {
        partition: `persist:${hostname}`
      }
    })

    browserGame.setMenu(
      Menu.buildFromTemplate([
        { role: 'close' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ])
    )

    const defaultUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
    browserGame.webContents.userAgent = customUserAgent ?? defaultUserAgent

    browserGame.menuBarVisible = false
    browserGame.loadURL(browserUrl)
    browserGame.on('ready-to-show', () => browserGame.show())

    const abortController = createAbortController(abortId)

    abortController.signal.addEventListener('abort', () => {
      browserGame.close()
    })

    browserGame.webContents.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(browserGame, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: i18next.t(
          'box.warning.sideload.confirmExit.title',
          'Are you sure you want to quit?'
        ),
        message: i18next.t(
          'box.warning.sideload.confirmExit.message',
          'Any unsaved progress might be lost'
        ),
        defaultId: 0,
        cancelId: 1
      })
      const leave = choice === 0
      if (leave) {
        event.preventDefault()
      }
    })

    browserGame.on('closed', () => {
      deleteAbortController(abortId)
      res(true)
    })
  })
}

export async function launchGame(
  appName: string,
  logWriter: LogWriter,
  gameInfo: GameInfo,
  runner: Runner,
  args: string[] = []
): Promise<boolean> {
  if (!gameInfo) {
    return false
  }

  let {
    install: { executable }
  } = gameInfo

  const { browserUrl, customUserAgent, launchFullScreen } = gameInfo

  const gameSettingsOverrides = await GameConfig.get(appName).getSettings()
  const isSteamLaunchWithMonitor =
    executable &&
    basename(executable).toLowerCase() === 'steam.exe' &&
    gameSettingsOverrides.targetExe !== undefined &&
    gameSettingsOverrides.targetExe !== ''

  if (
    gameSettingsOverrides.targetExe !== undefined &&
    gameSettingsOverrides.targetExe !== '' &&
    !isSteamLaunchWithMonitor
  ) {
    executable = gameSettingsOverrides.targetExe
  }

  if (browserUrl) {
    return openNewBrowserGameWindow({
      browserUrl,
      abortId: appName,
      customUserAgent,
      launchFullScreen
    })
  }

  const gameSettings = await getAppSettings(appName)
  const { launcherArgs } = gameSettings
  const extraArgs = [...shlex.split(launcherArgs ?? ''), ...args]
  const extraArgsJoined = extraArgs.join(' ')

  if (executable) {
    const isNative = gameManagerMap[runner].isNative(appName)
    const {
      success: launchPrepSuccess,
      failureReason: launchPrepFailReason,
      rpcClient,
      mangoHudCommand,
      gameScopeCommand,
      gameModeBin,
      steamRuntime
    } = await prepareLaunch(gameSettings, logWriter, gameInfo, isNative)

    if (!isNative) {
      await prepareWineLaunch(runner, appName, logWriter)
    }

    const wrappers = setupWrappers(
      gameSettings,
      mangoHudCommand,
      gameModeBin,
      gameScopeCommand,
      steamRuntime?.length ? [...steamRuntime] : undefined
    )

    if (!launchPrepSuccess) {
      logWriter.logError(['Launch aborted:', launchPrepFailReason])
      launchCleanup()
      showDialogBoxModalAuto({
        title: i18next.t('box.error.launchAborted', 'Launch aborted'),
        message: launchPrepFailReason!,
        type: 'ERROR'
      })
      return false
    }

    sendGameStatusUpdate({
      appName,
      runner,
      status: 'playing'
    })

    // Native
    if (isNative) {
      logInfo(
        `launching native sideloaded game: ${executable} ${extraArgsJoined}`,
        LogPrefix.Backend
      )

      try {
        await access(executable, FS_CONSTANTS.X_OK)
      } catch {
        logWarning(
          'File not executable, changing permissions temporarily',
          LogPrefix.Backend
        )
        // On Mac, it gives an error when changing the permissions of the file inside the app bundle. But we need it for other executables like scripts.
        if (isLinux || (isMac && !executable.endsWith('.app'))) {
          await chmod(executable, 0o775)
        }
      }

      const env = {
        ...setupWrapperEnvVars({ appName, appRunner: runner }),
        ...setupEnvVars(gameSettings, gameInfo.install.install_path),
        ...getKnownFixesEnvVariables(appName, runner)
      }

      if (wrappers.length > 0) {
        extraArgs.unshift(...wrappers, executable)
        executable = extraArgs.shift()!
      }

      await callRunner(
        extraArgs,
        {
          name: runner,
          logPrefix: LogPrefix.Backend,
          bin: basename(executable),
          dir: dirname(executable)
        },
        {
          env,
          wrappers,
          logWriters: [logWriter],
          logMessagePrefix: LogPrefix.Backend
        }
      )

      if (isSteamLaunchWithMonitor) {
        await waitForProcessToExit(gameSettingsOverrides.targetExe, logWriter)
      }

      launchCleanup(rpcClient)
      // TODO: check and revert to previous permissions
      if (isLinux || (isMac && !executable.endsWith('.app'))) {
        await chmod(executable, 0o775)
      }
      return true
    }

    logInfo(
      `launching non-native sideloaded: ${executable} ${extraArgsJoined}`,
      LogPrefix.Backend
    )

    await runWineCommand({
      commandParts: [executable, ...extraArgs],
      gameSettings,
      wait: true,
      protonVerb: 'waitforexitandrun',
      startFolder: dirname(executable),
      options: {
        wrappers,
        logWriters: [logWriter],
        logMessagePrefix: LogPrefix.Backend
      }
    })

    if (isSteamLaunchWithMonitor) {
      await waitForProcessToExit(gameSettingsOverrides.targetExe, logWriter)
    }

    launchCleanup(rpcClient)

    return true
  }
  return false
}

async function isProcessRunning(processName: string): Promise<boolean> {
  let name = basename(processName)
  if (process.platform === 'win32' && !name.toLowerCase().endsWith('.exe')) {
    name += '.exe'
  }
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${name}" /NH`)
      return stdout.toLowerCase().includes(name.toLowerCase())
    } else {
      const { stdout } = await execAsync(`pgrep -f "${name}"`)
      return stdout.trim().length > 0
    }
  } catch (err) {
    return false
  }
}

async function waitForProcessToExit(targetExe: string, logWriter: LogWriter) {
  let name = basename(targetExe)
  if (process.platform === 'win32' && !name.toLowerCase().endsWith('.exe')) {
    name += '.exe'
  }
  logInfo(`Steam launch with monitor: waiting for process ${name} to start...`, LogPrefix.Backend)
  logWriter.logInfo(`Steam launch with monitor: waiting for process ${name} to start...`)

  // 1. Wait for the process to start (up to 60 seconds)
  let started = false
  for (let i = 0; i < 60; i++) {
    if (await isProcessRunning(name)) {
      started = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (!started) {
    logWarning(`Steam launch with monitor: process ${name} did not start within 60 seconds.`, LogPrefix.Backend)
    logWriter.logWarning(`Steam launch with monitor: process ${name} did not start within 60 seconds.`)
    return
  }

  logInfo(`Steam launch with monitor: process ${name} detected. Monitoring...`, LogPrefix.Backend)
  logWriter.logInfo(`Steam launch with monitor: process ${name} detected. Monitoring...`)

  // 2. Poll every 2 seconds until the process is no longer running
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    if (!(await isProcessRunning(name))) {
      break
    }
  }

  logInfo(`Steam launch with monitor: process ${name} has exited.`, LogPrefix.Backend)
  logWriter.logInfo(`Steam launch with monitor: process ${name} has exited.`)
}
