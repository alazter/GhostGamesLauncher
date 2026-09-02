import {
  InstallPlatform,
  AppSettings,
  GameInfo,
  InstallProgress,
  Runner,
  UpdateParams,
  LaunchOption
} from 'common/types'

import { TFunction } from 'i18next'
import { getGameInfo } from './index'
import { DialogModalOptions } from 'frontend/types'
import { markGameAsPlayed } from './newGamesTracker'

const storage: Storage = window.localStorage

type InstallArgs = {
  gameInfo: GameInfo
  installPath: string
  isInstalling: boolean
  previousProgress: InstallProgress | null
  progress: InstallProgress
  installDlcs?: Array<string>
  t: TFunction<'gamepage'>
  showDialogModal: (options: DialogModalOptions) => void
  setInstallPath?: (path: string) => void
  platformToInstall?: InstallPlatform
  sdlList?: Array<string>
  installLanguage?: string
  build?: string
  branch?: string
}

async function install({
  gameInfo,
  installPath,
  t,
  progress,
  isInstalling,
  previousProgress,
  setInstallPath,
  sdlList = [],
  installDlcs = [],
  installLanguage = 'en-US',
  platformToInstall = 'Windows',
  build,
  branch,
  showDialogModal
}: InstallArgs) {
  if (!installPath) {
    return
  }

  const { folder_name, is_installed, app_name: appName, runner } = gameInfo
  if (isInstalling) {
    // NOTE: This can't really happen, since `folder_name` can only be undefined if we got a
    //       SideloadGame from getGameInfo, but we can't "install" sideloaded games
    if (!folder_name) return
    return handleStopInstallation(
      appName,
      installPath,
      t,
      progress,
      runner,
      showDialogModal
    )
  }

  if (is_installed) {
    return
  }

  if (installPath !== 'default') {
    if (setInstallPath) setInstallPath(installPath)
  }

  if (installPath === 'default') {
    const { defaultInstallPath }: AppSettings =
      await window.api.requestAppSettings()
    installPath = defaultInstallPath
  }

  // If the user changed the previous folder, the percentage should start from zero again.
  if (previousProgress && previousProgress.folder !== installPath) {
    storage.removeItem(appName)
  }

  return window.api.install({
    appName,
    path: installPath,
    installDlcs,
    sdlList,
    installLanguage,
    runner,
    platformToInstall,
    gameInfo,
    build,
    branch
  })
}

function handleStopInstallation(
  appName: string,
  path: string,
  t: TFunction<'gamepage'>,
  progress: InstallProgress,
  runner: Runner,
  showDialogModal: (options: DialogModalOptions) => void
) {
  showDialogModal({
    title: t('gamepage:box.stopInstall.title'),
    message: t('gamepage:box.stopInstall.message'),
    buttons: [
      { text: t('gamepage:box.stopInstall.keepInstalling') },
      {
        text: t('box.yes'),
        onClick: () => {
          storage.setItem(
            appName,
            JSON.stringify({ ...progress, folder: path })
          )
          window.api.cancelDownload(false)
        }
      },
      {
        text: t('box.no'),
        onClick: () => {
          window.api.cancelDownload(true)
          storage.removeItem(appName)
        }
      }
    ]
  })
}

const repair = async (appName: string, runner: Runner): Promise<void> =>
  window.api.repair(appName, runner)

type LaunchOptions = {
  appName: string
  t: TFunction<'gamepage'>
  launchArguments?: LaunchOption
  runner: Runner
  hasUpdate: boolean
  showDialogModal: (options: DialogModalOptions) => void
  args?: string[]
  notPlayableOffline?: boolean
}

const launch = async ({
  appName,
  t,
  launchArguments,
  runner,
  hasUpdate,
  showDialogModal,
  args,
  notPlayableOffline
}: LaunchOptions): Promise<{ status: 'done' | 'error' | 'abort' }> => {
  markGameAsPlayed(appName, runner)
  const proceedToLaunch = async () => {
    // First handle update dialog if needed
    if (hasUpdate) {
      const { ignoreGameUpdates } =
        await window.api.requestGameSettings(appName)

      if (ignoreGameUpdates) {
        // If updates are ignored, proceed to check launch options
        return checkLaunchOptionsAndLaunch({
          appName,
          t,
          launchArguments,
          runner,
          showDialogModal,
          args,
          skipVersionCheck: true,
          hasUpdate
        })
      }

      // promisifies the showDialogModal button click callbacks
      const launchFinished = new Promise<{
        status: 'done' | 'error' | 'abort'
      }>((res) => {
        showDialogModal({
          message: t('gamepage:box.update.message'),
          title: t('gamepage:box.update.title'),
          buttons: [
            {
              text: t('gamepage:box.yes'),
              onClick: async () => {
                const gameInfo = await getGameInfo(appName, runner)
                if (gameInfo && gameInfo.runner !== 'sideload') {
                  void updateGame({ appName, runner, gameInfo })
                  res({ status: 'done' })
                }
                res({ status: 'error' })
              }
            },
            {
              text: t('box.no'),
              onClick: () => {
                // User chose to skip the update, now check launch options
                res(
                  checkLaunchOptionsAndLaunch({
                    appName,
                    t,
                    launchArguments,
                    runner,
                    showDialogModal,
                    args,
                    skipVersionCheck: true,
                    hasUpdate
                  })
                )
              }
            }
          ]
        })
      })

      return launchFinished
    }

    // No update needed, proceed to check launch options
    return checkLaunchOptionsAndLaunch({
      appName,
      t,
      launchArguments,
      runner,
      showDialogModal,
      args,
      hasUpdate
    })
  }

  if (notPlayableOffline) {
    return new Promise((res) => {
      showDialogModal({
        title: t('gamepage:box.offline_warning.title', 'Offline Warning'),
        message: t(
          'gamepage:box.offline_warning.message',
          'This game might not work properly offline. Do you want to play anyway?'
        ),
        type: 'MESSAGE',
        buttons: [
          {
            text: t('box.ok', 'OK'),
            onClick: () => {
              showDialogModal({ showDialog: false })
              res({ status: 'abort' })
            }
          },
          {
            text: t('gamepage:box.offline_warning.playAnyway', 'Play Anyway'),
            onClick: async () => {
              showDialogModal({ showDialog: false })
              res(await proceedToLaunch())
            }
          }
        ]
      })
    })
  }

  return proceedToLaunch()
}

async function checkLaunchOptionsAndLaunch({
  appName,
  t,
  launchArguments,
  runner,
  showDialogModal,
  args,
  skipVersionCheck = false
}: LaunchOptions & { skipVersionCheck?: boolean }): Promise<{
  status: 'done' | 'error' | 'abort'
}> {
  // If launch arguments already provided, launch directly
  if (launchArguments) {
    return window.api.launch({
      appName,
      runner,
      launchArguments,
      args,
      skipVersionCheck
    })
  }

  // Get available launch options
  const availableLaunchOptions = await window.api.getLaunchOptions(
    appName,
    runner
  )

  // If no launch options or only one option, launch directly
  if (!availableLaunchOptions.length || availableLaunchOptions.length === 1) {
    // If there's exactly one option, use it
    const singleOption =
      availableLaunchOptions.length === 1
        ? availableLaunchOptions[0]
        : undefined

    return window.api.launch({
      appName,
      runner,
      launchArguments: singleOption,
      args,
      skipVersionCheck
    })
  }

  // If we have multiple launch options and none selected, show dialog
  // First check if there's a saved launch option
  const gameSettings = await window.api.requestGameSettings(appName)
  if (gameSettings.lastUsedLaunchOption) {
    return window.api.launch({
      appName,
      runner,
      launchArguments: gameSettings.lastUsedLaunchOption,
      args,
      skipVersionCheck
    })
  }

  // Show dialog to select launch option
  return new Promise((res) => {
    let timeoutId: NodeJS.Timeout | null = null
    let countdownInterval: NodeJS.Timeout | null = null
    let hasSelected = false
    let secondsRemaining = 10
    let launchCanceled = false

    // Set up auto-select timeout (10 seconds)
    const autoSelectFirstOption = () => {
      if (hasSelected || launchCanceled) return

      const firstOption = availableLaunchOptions[0]

      // Clean up intervals
      if (countdownInterval) {
        clearInterval(countdownInterval)
      }

      // Close the dialog
      showDialogModal({ showDialog: false })

      // Save this choice for future launches
      window.api.setSetting({
        appName,
        key: 'lastUsedLaunchOption',
        value: firstOption
      })

      // Launch with the first option
      res(
        window.api.launch({
          appName,
          runner,
          launchArguments: firstOption,
          args,
          skipVersionCheck
        })
      )
    }

    // Update the dialog title with countdown
    const updateCountdown = () => {
      if (launchCanceled) {
        return res({ status: 'done' })
      }
      showDialogModal({
        message: t(
          'gamepage:box.selectLaunchOption.body',
          'Please select a launch option for this game (it can be changed later on the game settings):'
        ),
        title: t(
          'gamepage:box.selectLaunchOption.title',
          'Select Launch Option ({{seconds}}s)',
          { seconds: secondsRemaining }
        ),
        buttons: optionButtons,
        className: 'launchOptionsDialog',
        onClose: () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          if (countdownInterval) {
            clearInterval(countdownInterval)
          }
          showDialogModal({ showDialog: false })
          launchCanceled = true
          return res({ status: 'done' })
        }
      })
    }

    // Create button for each launch option
    const optionButtons = availableLaunchOptions.map((option) => {
      let label = ''
      switch (option.type) {
        case undefined:
        case 'basic':
          label = option.name
          break
        case 'dlc':
          label = option.dlcTitle
          break
        case 'altExe':
          label = option.executable
          break
      }

      return {
        text: label,
        onClick: () => {
          hasSelected = true
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          if (countdownInterval) {
            clearInterval(countdownInterval)
          }

          // Close the dialog
          showDialogModal({ showDialog: false })

          // Save this choice for future launches
          window.api.setSetting({
            appName,
            key: 'lastUsedLaunchOption',
            value: option
          })

          res(
            window.api.launch({
              appName,
              runner,
              launchArguments: option,
              args,
              skipVersionCheck
            })
          )
        }
      }
    })

    // Set timeout for 10 seconds
    timeoutId = setTimeout(autoSelectFirstOption, 10000)

    // Update countdown every second
    countdownInterval = setInterval(() => {
      secondsRemaining--
      if (secondsRemaining > 0 && !launchCanceled) {
        updateCountdown()
      }
    }, 1000)

    // Show initial dialog
    updateCountdown()
  })
}

const updateGame = (args: UpdateParams) => {
  return window.api.updateGame(args)
}

export const normalizeTitle = (title: string) => {
  return title.replace(/[^\w\s]/g, '').toLowerCase()
}

export const normalizeTitleForDuplicateCheck = (rawTitle: string): string => {
  if (!rawTitle) return ''
  let t = rawTitle.trim()
  t = t.replace(/\[(?:fitgirl|repack|steam\.rip|p2p|nosteam|deadc0de|insaneramzes|gog|dvd|iso)[^\]]*\]/gi, '')
  t = t.replace(/\((?:off\s*line\s*version|tradução|traducao|repack|portable|nosTEAM)[^)]*\)/gi, '')
  t = t.replace(/[-.](?:P2P|nosTEAM|0xdeadc0de|InsaneRamZes|FitGirl|Dodi|EMPRESS|SKIDROW|CODEX|RELOADED|FLT|HOODLUM|PLAZA|RAZOR1911)$/gi, '')
  t = t.replace(/(?:\bversion\b|\bbuild\b|\bver\b)?\s*v?\d+(?:\.\d+)+(?:[._-][a-z0-9]+)*/gi, '')
  t = t.replace(/[._-]build[._-]\d+/gi, '')
  t = t.replace(/^path_nocd_/gi, '')
  return t.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export const isOfficialStoreGame = (game: any): boolean => {
  if (!game) return false
  const runner = (game.runner || '').toLowerCase()
  return runner !== 'sideload' && runner !== 'sideloaded'
}

export const isManualSideloadGame = (game: any): boolean => {
  if (!game) return false
  const runner = (game.runner || '').toLowerCase()
  return runner === 'sideload' || runner === 'sideloaded'
}

export const getDuplicateGameIds = (allGames: any[]): Set<string> => {
  let hiddenDuplicateIds = new Set<string>()
  let showHiddenDuplicates = false
  try {
    showHiddenDuplicates =
      localStorage.getItem('heroic_show_hidden_duplicates') === 'true'
    if (!showHiddenDuplicates) {
      const saved = localStorage.getItem('heroic_hidden_duplicate_ids')
      if (saved) {
        hiddenDuplicateIds = new Set(JSON.parse(saved))
      }
    }
  } catch {}

  const map = new Map<
    string,
    Array<{ gameId: string; appName: string; isOfficial: boolean; isManual: boolean }>
  >()

  allGames.forEach((game) => {
    if (!game || game.install?.is_dlc) return
    const runner = (game.runner || 'sideload').toLowerCase()
    const gameId = `${game.app_name}_${runner}`

    // Skip games hidden from duplicate tracking unless the toggle is enabled
    if (
      !showHiddenDuplicates &&
      (hiddenDuplicateIds.has(gameId) || hiddenDuplicateIds.has(game.app_name))
    ) {
      return
    }

    const rawTitle = game.overrides?.title || game.title || ''
    const norm = normalizeTitleForDuplicateCheck(rawTitle)
    if (!norm) return

    const isOfficial = runner !== 'sideload' && runner !== 'sideloaded'
    const isManual = !isOfficial

    if (!map.has(norm)) {
      map.set(norm, [])
    }
    const list = map.get(norm)!
    if (!list.some((g) => g.gameId === gameId || g.appName === game.app_name)) {
      list.push({ gameId, appName: game.app_name, isOfficial, isManual })
    }
  })

  const duplicateIds = new Set<string>()
  map.forEach((gamesList) => {
    // Only mark duplicates if there's a real conflict:
    // 1. Conflict between an Official connected store game and a Manual/Sideload game (hasOfficial && hasManual)
    // 2. OR two manual sideload copies of the exact same game (manualCount > 1)
    // CRITICAL: Two official store games (e.g. Steam + Epic, or Epic + GOG) are NEVER marked as duplicates.
    const hasOfficial = gamesList.some((g) => g.isOfficial)
    const hasManual = gamesList.some((g) => g.isManual)
    const manualCount = gamesList.filter((g) => g.isManual).length

    const isDuplicate = (hasOfficial && hasManual) || manualCount > 1

    if (isDuplicate) {
      gamesList.forEach((g) => {
        duplicateIds.add(g.gameId)
        duplicateIds.add(g.appName)
      })
    }
  })
  return duplicateIds
}

export const epicCategories = ['all', 'legendary', 'epic']
export const gogCategories = ['all', 'gog']
export const sideloadedCategories = ['all', 'sideload']
export const amazonCategories = ['all', 'nile', 'amazon']
export const zoomCategories = ['all', 'zoom']

export { handleStopInstallation, install, launch, repair, updateGame }
