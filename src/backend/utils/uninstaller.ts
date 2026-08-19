import { GlobalConfig } from 'backend/config'
import {
  defaultWinePrefix,
  fixesPath,
  gamesConfigPath
} from 'backend/constants/paths'
import { notify } from 'backend/dialog/dialog'
import { logError, logInfo, LogPrefix } from 'backend/logger'
import { libraryManagerMap } from 'backend/storeManagers'
import { sendGameStatusUpdate } from 'backend/utils'
import { Runner, GameInfo } from 'common/types'
import { storeMap } from 'common/utils'
import { Event } from 'electron'
import { existsSync, readdirSync, rmSync } from 'graceful-fs'
import i18next from 'i18next'
import { join } from 'path'
import { libraryStore } from 'backend/storeManagers/sideload/electronStores'
import { getGameInfo as getSideloadGameInfo } from 'backend/storeManagers/sideload/games'
import { removeShortcuts as removeShortcutsUtil } from 'backend/shortcuts/shortcuts/shortcuts'
import { removeNonSteamGame } from 'backend/shortcuts/nonesteamgame/nonesteamgame'
import { removeRecentGame } from 'backend/recent_games/recent_games'
import { sendFrontendMessage } from 'backend/ipc'


export const removePrefix = async (appName: string, runner: Runner) => {
  const { winePrefix } = await libraryManagerMap[runner]
    .getGame(appName)
    .getSettings()
  logInfo(`Removing prefix ${winePrefix}`, LogPrefix.Backend)

  if (!existsSync(winePrefix)) {
    logInfo(`Prefix folder ${winePrefix} doesn't exist, ignoring removal`)
    return
  }

  // folder exists, do some sanity checks before deleting it
  const { defaultInstallPath, sharedWinePrefix } =
    GlobalConfig.get().getSettings()

  if (winePrefix === defaultInstallPath) {
    logInfo(
      `Can't delete folder ${winePrefix}, prefix folder is the default install directory ${defaultInstallPath}`
    )
    return
  }

  if (winePrefix === sharedWinePrefix) {
    logInfo(
      `Can't delete folder ${winePrefix}, prefix folder is the shared prefix directory ${sharedWinePrefix}`
    )
    return
  }

  // keep this check for backwards compatibility
  if (winePrefix === defaultWinePrefix) {
    logInfo(
      `Can't delete folder ${winePrefix}, prefix folder is the default prefix directory ${defaultWinePrefix}`
    )
    return
  }

  const dirContent = readdirSync(winePrefix)

  if (dirContent.length > 0) {
    const driveCPath = join(winePrefix, 'drive_c')
    const pfxPath = join(winePrefix, 'pfx')

    if (!existsSync(driveCPath) && !existsSync(pfxPath)) {
      logInfo(
        `Can't delete folder ${winePrefix}, folder does not contain a drive_c/pfx folder. If this is the correct prefix folder, delete it manually.`
      )
      return
    }
  }

  // if we got here, we are safe to delete this folder
  rmSync(winePrefix, { recursive: true })
}

const removeFixFile = (appName: string, runner: Runner) => {
  const fixFilePath = join(fixesPath, `${appName}-${storeMap[runner]}.json`)
  if (existsSync(fixFilePath)) {
    rmSync(fixFilePath)
  }
}

const removeSettingsAndLogs = (appName: string) => {
  const removeIfExists = (filename: string) => {
    logInfo(`Removing ${filename}`, LogPrefix.Backend)
    const gameSettingsFile = join(gamesConfigPath, filename)
    if (existsSync(gameSettingsFile)) {
      rmSync(gameSettingsFile)
    }
  }

  removeIfExists(appName.concat('.json'))
  removeIfExists(appName.concat('.log'))
  removeIfExists(appName.concat('-lastPlay.log'))
}

export const uninstallGameCallback = async (
  event: Event,
  appName: string,
  runner: Runner,
  shouldRemovePrefix: boolean,
  shouldRemoveSetting: boolean
) => {
  sendGameStatusUpdate({
    appName,
    runner,
    status: 'uninstalling'
  })

  const game = libraryManagerMap[runner].getGame(appName)
  const { title } = game.getGameInfo()

  let uninstalled = false

  try {
    await game.uninstall({ shouldRemovePrefix })
    uninstalled = true
  } catch (error) {
    notify({
      title,
      body: i18next.t('notify.uninstalled.error', 'Error uninstalling')
    })
    logError(error, LogPrefix.Backend)
  }

  if (uninstalled) {
    if (shouldRemovePrefix) {
      removePrefix(appName, runner)
    }
    if (shouldRemoveSetting) {
      removeSettingsAndLogs(appName)
    }
    removeFixFile(appName, runner)

    notify({ title, body: i18next.t('notify.uninstalled') })
    logInfo('Finished uninstalling', LogPrefix.Backend)
  }

  sendGameStatusUpdate({
    appName,
    runner,
    status: 'done'
  })
}

export const bulkUninstallCallback = async (
  event: Event,
  apps: { appName: string; runner: Runner }[],
  shouldRemovePrefix: boolean,
  shouldRemoveSetting: boolean
) => {
  logInfo(`Bulk uninstalling ${apps.length} apps`, LogPrefix.Backend)
  const sideloadApps = apps.filter((a) => a.runner === 'sideload')

  if (sideloadApps.length > 0) {
    const appNamesToUninstall = new Set(sideloadApps.map((a) => a.appName))
    const old = libraryStore.get('games', [])
    const current = old.filter((a: GameInfo) => !appNamesToUninstall.has(a.app_name))

    for (const app of sideloadApps) {
      try {
        sendGameStatusUpdate({
          appName: app.appName,
          runner: 'sideload',
          status: 'uninstalling'
        })
        const gameInfo = getSideloadGameInfo(app.appName)
        if (shouldRemovePrefix) {
          await removePrefix(app.appName, 'sideload')
        }
        removeShortcutsUtil(gameInfo)
        removeRecentGame(app.appName)
        removeNonSteamGame({ gameInfo })

        sendGameStatusUpdate({
          appName: app.appName,
          runner: 'sideload',
          status: 'done'
        })
      } catch (err) {
        logError(
          `Error cleaning up sideload app ${app.appName}: ${String(err)}`,
          LogPrefix.Backend
        )
      }
    }

    libraryStore.set('games', current)
  }

  const otherApps = apps.filter((a) => a.runner !== 'sideload')
  for (const app of otherApps) {
    try {
      sendGameStatusUpdate({
        appName: app.appName,
        runner: app.runner,
        status: 'uninstalling'
      })
      await gameManagerMap[app.runner].uninstall({
        appName: app.appName,
        shouldRemovePrefix
      })
      if (shouldRemovePrefix) {
        await removePrefix(app.appName, app.runner)
      }
      if (shouldRemoveSetting) {
        removeSettingsAndLogs(app.appName)
      }
      removeFixFile(app.appName, app.runner)

      sendGameStatusUpdate({
        appName: app.appName,
        runner: app.runner,
        status: 'done'
      })
    } catch (err) {
      logError(
        `Error uninstalling game ${app.appName} (${app.runner}): ${String(err)}`,
        LogPrefix.Backend
      )
    }
  }

  // Notify frontend to refresh libraries
  const runnersToRefresh = new Set(apps.map((a) => a.runner))
  for (const runner of runnersToRefresh) {
    sendFrontendMessage('refreshLibrary', runner)
  }

  notify({
    title: i18next.t('notify.uninstalled.bulk.title', 'Bulk Uninstall Finished'),
    body: i18next.t('notify.uninstalled.bulk.body', {
      count: apps.length,
      defaultValue: '{{count}} game(s) uninstalled successfully.'
    })
  })

  logInfo('Bulk uninstall finished', LogPrefix.Backend)
}
