import { initImagesCache } from './images_cache'
import { fetchLastestReleases } from './utils/releases'
import { DiskSpaceData, StatusPromise, WineInstallation, WindowProps } from 'common/types'
import * as path from 'path'
import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  powerSaveBlocker,
  protocol,
  screen,
  clipboard,
  session,
  shell,
  Notification
} from 'electron'
import {
  addHandler,
  addListener,
  addOneTimeListener,
  sendFrontendMessage
} from 'backend/ipc'
import 'backend/updater'
import 'backend/discounts'
import { autoUpdater } from 'electron-updater'
import { cpus } from 'os'
import { existsSync, watch, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'graceful-fs'
import 'source-map-support/register'

import Backend from 'i18next-fs-backend'
import i18next from 'i18next'
import { join } from 'path'
import { DXVK, Winetricks } from './tools'
import { GameConfig } from './game_config'
import { GlobalConfig } from './config'
import { LegendaryUser } from 'backend/storeManagers/legendary/user'
import { GOGUser } from './storeManagers/gog/user'
import gogPresence from './storeManagers/gog/presence'
import { NileUser } from './storeManagers/nile/user'
import { ZoomUser } from './storeManagers/zoom/user'
import { SteamUser } from './storeManagers/steam/user'
import { syncAutoStartSettings, getPermanentAppExecutable } from './autostart'

if (process.platform === 'win32') {
  app.name = 'Ghost Games Launcher'
  app.setName('Ghost Games Launcher')
  app.setAppUserModelId('com.ghostgameslauncher.ghost')
}
import {
  clearCache,
  isEpicServiceOffline,
  handleExit,
  openUrlOrFile,
  resetHeroic,
  showAboutWindow,
  showItemInFolder,
  getFileSize,
  detectVCRedist,
  getLatestReleases,
  getShellPath,
  getCurrentChangelog,
  removeFolder,
  downloadDefaultWine,
  sendGameStatusUpdate,
  checkRosettaInstall,
  writeConfig,
  createNecessaryFolders,
  clearAchievementCache,
  getGame
} from './utils'
import { startPlausible } from './utils/plausible'

import {
  getDiskInfo,
  isAccessibleWithinFlatpakSandbox,
  isWritable
} from './utils/filesystem'
import { getAvailableStorageDrives } from './utils/filesystem/drives'
import { SteamAuthModal } from './storeManagers/steam/authModal'
import { configStore as steamConfigStore } from './storeManagers/steam/electronStores'

import { Path } from './schemas'

import { uninstallGameCallback, bulkUninstallCallback } from './utils/uninstaller'
import { handleProtocol, shouldHideWindowForProtocolArgs } from './protocol'
import {
  init as initLogger,
  logDebug,
  logError,
  logInfo,
  LogPrefix,
  logWarning
} from './logger'
import { gameInfoStore } from 'backend/storeManagers/legendary/electronStores'
import {
  launchEventCallback,
  readKnownFixes,
  runWineCommand,
  validWine
} from './launcher'
import { initQueue } from './downloadmanager/downloadqueue'
import {
  initOnlineMonitor,
  isOnline,
  runOnceWhenOnline
} from './online_monitor'
import { notify, showDialogBoxModalAuto } from './dialog/dialog'
import { callAbortController } from './utils/aborthandler/aborthandler'
import { getDefaultSavePath } from './save_sync'
import { initTrayIcon } from './tray_icon/tray_icon'
import { createMainWindow, getMainWindow, isFrameless } from './main_window'

import { playtimeSyncQueue } from './storeManagers/gog/electronStores'
import {
  autoUpdate,
  initStoreManagers,
  libraryManagerMap
} from './storeManagers'
import { updateSideloadedApps } from './storeManagers/sideload/library'
import {
  scanInstalledGames,
  discoverInstalledGames,
  discoverAllGames,
  abortScan,
  importSelectedGames,
  undoImport,
  addGameToBlacklist,
  clearBlacklist,
  getBlacklist,
  removeGameFromBlacklist,
  getDrives
} from './storeManagers/sideload/scanner'
import {
  setGameOverrides,
  setAllGameOverrides,
  getGameOverrides,
  getAllGameOverrides,
  attachOverrides
} from './game_overrides'
import { backendEvents } from './backend_events'
import { libraryStore } from './storeManagers/sideload/electronStores'
import { gameOverridesStore } from './game_overrides/electronStores'
import { configStore, tsStore } from './constants/key_value_stores'
import {
  customThemesWikiLink,
  discordLink,
  epicLoginUrl,
  githubSponsorsPage,
  heroicGithubURL,
  kofiPage,
  patreonPage,
  sidInfoUrl,
  supportURL,
  weblateUrl,
  wikiLink,
  wineprefixFAQ
} from './constants/urls'
import { legendaryInstalled } from './storeManagers/legendary/constants'
import {
  isCLIConsoleMode,
  isCLIFullscreen,
  isCLINoGui,
  isFlatpak,
  isIntelMac,
  isLinux,
  isMac,
  isSteamDeckGameMode,
  isWindows
} from './constants/environment'
import {
  configPath,
  gamesConfigPath,
  publicDir,
  userHome,
  webviewPreloadPath,
  windowIcon,
  ensurePermanentAppIcon
} from './constants/paths'
import { supportedLanguages } from 'common/languages'
import MigrationSystem from './migration'

import {
  connectCloudProvider,
  clearCloudTokens,
  getCloudProviderStatus,
  uploadBackupToCloud,
  downloadBackupFromCloud,
  getGoogleCredentials,
  setGoogleCredentials
} from './backup/cloudBackup'

import { getBackupPayload } from './backup/backupHelper'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'imagecache',
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

if (isLinux) app.commandLine?.appendSwitch('--gtk-version', '3')

async function initializeWindow(): Promise<BrowserWindow> {
  createNecessaryFolders()
  configStore.set('userHome', userHome)
  const mainWindow = createMainWindow()

  mainWindow.on('minimize', () => {
    if (global.gc) {
      try {
        global.gc()
      } catch (e) {}
    }
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logInfo(`[Renderer Console] [Level ${level}] [${sourceId}:${line}]: ${message}`)
  })

  if ((isSteamDeckGameMode || isCLIFullscreen) && !isCLINoGui) {
    logInfo(
      [
        isSteamDeckGameMode
          ? 'Heroic started via Steam-Deck gamemode.'
          : 'Heroic started with --fullscreen',
        'Switching to fullscreen'
      ],
      LogPrefix.Backend
    )
    mainWindow.setFullScreen(true)
  }

  setTimeout(async () => {
    // Will download Wine/GPTK if none was found
    const availableWine = await GlobalConfig.get().getAlternativeWine()
    let shouldDownloadWine = !availableWine.length

    if (isMac && !isIntelMac) {
      const toolkitDownloaded = availableWine.some(
        (wine) => wine.type === 'toolkit'
      )

      if (!toolkitDownloaded) {
        shouldDownloadWine = true
      }
    }

    void DXVK.getLatest()

    Winetricks.download()
    if (shouldDownloadWine) {
      downloadDefaultWine()
    }

    if (isMac) {
      checkRosettaInstall()
    }
  }, 2500)

  const globalConf = GlobalConfig.get().getSettings()

  mainWindow.setIcon(windowIcon)
  app.commandLine.appendSwitch('enable-spatial-navigation')

  // Configure Quad9 Secure DNS over HTTPS (DoH) for encrypted, privacy-first, malware-protected DNS
  app.commandLine.appendSwitch('enable-features', 'DnsOverHttps')
  app.commandLine.appendSwitch(
    'dns-over-https-templates',
    'https://dns.quad9.net/dns-query'
  )

  mainWindow.on('maximize', () => sendFrontendMessage('maximized'))
  mainWindow.on('unmaximize', () => sendFrontendMessage('unmaximized'))
  mainWindow.on('enter-full-screen', () =>
    sendFrontendMessage('fullscreen', true)
  )
  mainWindow.on('leave-full-screen', () =>
    sendFrontendMessage('fullscreen', false)
  )
  mainWindow.on('close', async (e) => {
    e.preventDefault()

    if (!isCLIFullscreen && !isSteamDeckGameMode && !mainWindow.isMinimized()) {
      // store windows properties
      const isMax = mainWindow.isMaximized()
      const bounds = isMax ? mainWindow.getNormalBounds() : mainWindow.getBounds()
      configStore.set('window-props', {
        ...bounds,
        maximized: isMax
      })
    }

    const { exitToTray, noTrayIcon } = GlobalConfig.get().getSettings()

    if (exitToTray && !noTrayIcon) {
      logInfo('Exiting to tray instead of quitting', LogPrefix.Backend)
      return mainWindow.hide()
    }

    handleExit()
  })

  detectVCRedist(mainWindow)

  const startHash =
    isCLIConsoleMode || globalConf.startInConsoleMode ? '/console' : undefined

  if (process.env.ELECTRON_RENDERER_URL) {
    try {
      const devToolsModule = 'electron-devtools-installer'
      const { installExtension, REACT_DEVELOPER_TOOLS } = await import(
        /* @vite-ignore */ devToolsModule
      )
      await installExtension(REACT_DEVELOPER_TOOLS)
    } catch {
      // optional dev dependency
    }

    const devUrl = startHash
      ? `${process.env.ELECTRON_RENDERER_URL}#${startHash}`
      : process.env.ELECTRON_RENDERER_URL
    mainWindow.loadURL(devUrl)
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    Menu.setApplicationMenu(null)
    mainWindow.loadFile(
      join(publicDir, 'index.html'),
      startHash ? { hash: startHash } : undefined
    )
    if (globalConf.checkForUpdatesOnStartup) {
      autoUpdater.checkForUpdates()
    }
  }

  // Changelog links workaround
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const pattern = app.isPackaged ? publicDir : 'localhost:5173'
    if (!url.match(pattern)) {
      event.preventDefault()
      openUrlOrFile(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const pattern = app.isPackaged ? publicDir : 'localhost:5173'
    return { action: !details.url.match(pattern) ? 'allow' : 'deny' }
  })

  addListener('setZoomFactor', async (event, zoomFactor) => {
    const factor = processZoomForScreen(parseFloat(zoomFactor))
    mainWindow.webContents.setZoomLevel(factor)
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
  })

  function applyZoom() {
    const zoomFactor = processZoomForScreen(
      configStore.get('zoomPercent', 100) / 100
    )
    mainWindow.webContents.setZoomLevel(zoomFactor)
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
  }

  mainWindow.on('maximize', applyZoom)
  mainWindow.on('unmaximize', applyZoom)
  mainWindow.on('restore', applyZoom)
  mainWindow.on('enter-full-screen', applyZoom)
  mainWindow.on('leave-full-screen', applyZoom)
  mainWindow.webContents.on('did-navigate', applyZoom)

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
const gotTheLock = app.requestSingleInstanceLock()
let openUrlArgument = ''

const processZoomForScreen = (zoomFactor: number) => {
  const screenSize = screen.getPrimaryDisplay().workAreaSize.width
  if (screenSize < 1200) {
    const extraDPIZoomIn = screenSize / 1200
    return (zoomFactor * extraDPIZoomIn - 1) / 0.2
  } else {
    return (zoomFactor - 1) / 0.2
  }
}

if (!gotTheLock) {
  console.log('Heroic is already running, quitting this instance')
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    const mainWindow = getMainWindow()
    if (!shouldHideWindowForProtocolArgs(argv)) {
      mainWindow?.show()
    }

    handleProtocol(argv)
  })
  app.whenReady().then(async () => {
    initLogger()

    await MigrationSystem.get().applyMigrations()

    initOnlineMonitor()
    initStoreManagers()
    initImagesCache()

    // Add User-Agent Client hints to behave like Windows
    if (process.argv.includes('--spoof-windows')) {
      session.defaultSession.webRequest.onBeforeSendHeaders(
        (details, callback) => {
          details.requestHeaders['sec-ch-ua-platform'] = 'Windows'
          callback({ cancel: false, requestHeaders: details.requestHeaders })
        }
      )
    }

    // Network-level Ad & Tracker Blocker (Cancels socket connections to ad networks)
    const AD_TRACKER_DOMAINS = [
      'googlesyndication.com',
      'doubleclick.net',
      'googleadservices.com',
      'adservice.google.com',
      'amazon-adsystem.com',
      'taboola.com',
      'outbrain.com',
      'adnxs.com',
      'rubiconproject.com',
      'criteo.com',
      'popads.net',
      'adroll.com',
      'scorecardresearch.com',
      'connect.facebook.net',
      'analytics.tiktok.com',
      'clarity.ms',
      'media.net',
      'pubmatic.com',
      'openx.net',
      'casalemedia.com'
    ]

    try {
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ['*://*/*'] },
        (details, callback) => {
          const isAd = AD_TRACKER_DOMAINS.some((domain) =>
            details.url.includes(domain)
          )
          if (isAd) {
            logInfo(
              `🛡️ [Security AdBlocker] CANCELLED network connection to ad server: ${details.url}`,
              LogPrefix.Backend
            )
            callback({ cancel: true })
          } else {
            callback({ cancel: false })
          }
        }
      )
    } catch (err) {
      logError(`Failed to setup network ad blocker: ${err}`, LogPrefix.Backend)
    }

    // try to fix notification app name on windows
    if (isWindows) {
      app.name = 'Ghost Games Launcher'
      app.setName('Ghost Games Launcher')
      app.setAppUserModelId('com.ghostgameslauncher.ghost')

      try {
        const currentExePath = getPermanentAppExecutable()
        const startMenuFolder = path.join(
          app.getPath('appData'),
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs'
        )
        const iconToUse = ensurePermanentAppIcon()

        const normalizedExePath = currentExePath.toLowerCase()
        const isDevOrRepoBuild =
          !app.isPackaged ||
          normalizedExePath.includes('node_modules') ||
          normalizedExePath.includes('heroicgameslauncher') ||
          normalizedExePath.includes('\\dist\\') ||
          normalizedExePath.includes('/dist/')

        // Start Menu shortcut (crucial for Windows Notifications to display "Ghost Games Launcher" instead of "Electron")
        if (existsSync(startMenuFolder) && !isDevOrRepoBuild) {
          const startMenuShortcutPath = path.join(
            startMenuFolder,
            'Ghost Games Launcher.lnk'
          )
          shell.writeShortcutLink(startMenuShortcutPath, 'create', {
            target: currentExePath,
            description: 'Ghost Games Launcher',
            icon: iconToUse,
            iconIndex: 0,
            appUserModelId: 'com.ghostgameslauncher.ghost'
          })
        }

        if (app.isPackaged && !isDevOrRepoBuild) {
          const desktopFolder = app.getPath('desktop')

          // Remove old Ghost.lnk shortcut
          try {
            const oldShortcut = path.join(desktopFolder, 'Ghost.lnk')
            if (existsSync(oldShortcut)) {
              require('fs').unlinkSync(oldShortcut)
            }
          } catch {}

          // Desktop shortcut
          const desktopShortcutPath = path.join(
            desktopFolder,
            'Ghost Games Launcher.lnk'
          )
          shell.writeShortcutLink(desktopShortcutPath, 'create', {
            target: currentExePath,
            description: 'Ghost Games Launcher',
            icon: iconToUse,
            iconIndex: 0,
            appUserModelId: 'com.ghostgameslauncher.ghost'
          })
        }
      } catch (err) {
        logError(`Failed to create shortcuts on startup: ${err}`, LogPrefix.Backend)
      }
    }

    runOnceWhenOnline(async () => {
      const isLoggedIn = LegendaryUser.isLoggedIn()

      if (!isLoggedIn) {
        logInfo('User Not Found, removing it from Store', {
          prefix: LogPrefix.Backend,
          forceLog: true
        })
        configStore.delete('userInfo')
      }

      // Update user details
      if (GOGUser.isLoggedIn()) {
        GOGUser.getUserDetails()
      }
    })

    const settings = GlobalConfig.get().getSettings()

    syncAutoStartSettings(
      settings.startAtLogin === true,
      settings.startInTray === true
    )

    if (settings && settings.analyticsOptIn === true) {
      startPlausible()
    }

    if (settings?.disableSmoothScrolling) {
      app.commandLine.appendSwitch('disable-smooth-scrolling')
    }

    // Make sure lock is not present when starting up
    playtimeSyncQueue.delete('lock')
    if (!settings.disablePlaytimeSync) {
      runOnceWhenOnline(() => libraryManagerMap['gog'].syncQueuedPlaytime())
    } else {
      logDebug('Skipping playtime sync queue upload - playtime sync disabled', {
        prefix: LogPrefix.Backend
      })
    }
    runOnceWhenOnline(gogPresence.setPresence)
    await i18next.use(Backend).init({
      backend: {
        addPath: path.join(publicDir, 'locales', '{{lng}}', '{{ns}}'),
        allowMultiLoading: false,
        loadPath: path.join(publicDir, 'locales', '{{lng}}', '{{ns}}.json')
      },
      debug: false,
      returnEmptyString: false,
      returnNull: false,
      fallbackLng: 'en',
      lng: settings.language,
      supportedLngs: supportedLanguages
    })

    const mainWindow = await initializeWindow()

    protocol.handle('heroic', (request) => {
      handleProtocol([request.url])
      return new Response('Operation initiated.', { status: 201 })
    })
    if (process.env.CI !== 'e2e' && !app.isDefaultProtocolClient('heroic')) {
      if (app.setAsDefaultProtocolClient('heroic')) {
        logInfo('Registered protocol with OS.', LogPrefix.Backend)
      } else {
        logWarning('Failed to register protocol with OS.', LogPrefix.Backend)
      }
    } else {
      logWarning('Protocol already registered.', LogPrefix.Backend)
    }

    const hideForProtocol = shouldHideWindowForProtocolArgs([
      openUrlArgument,
      ...process.argv
    ])
    const isOpenedAtLogin =
      process.argv.includes('--hidden') ||
      process.argv.includes('--minimized') ||
      Boolean(app.getLoginItemSettings?.().wasOpenedAsHidden) ||
      Boolean(app.getLoginItemSettings?.().wasOpenedAtLogin)

    const headless =
      isCLINoGui ||
      hideForProtocol ||
      (settings.startInTray && !settings.noTrayIcon) ||
      (settings.startAtLogin && isOpenedAtLogin && !settings.noTrayIcon)

    if (headless) {
      mainWindow.hide()
    } else {
      const isWayland = Boolean(process.env.WAYLAND_DISPLAY)
      const showWindow = () => {
        const props = configStore.get('window-props', {
          height: 690,
          width: 1200,
          x: 0,
          y: 0,
          maximized: false
        }) as WindowProps
        if (props?.maximized) {
          mainWindow.maximize()
        }
        mainWindow.show()
      }
      if (isWayland) {
        // Electron + Wayland don't send ready-to-show
        mainWindow.webContents.once('did-finish-load', showWindow)
      } else {
        mainWindow.once('ready-to-show', showWindow)
      }
    }

    // set initial zoom level after a moment, if set in sync the value stays as 1
    setTimeout(() => {
      const zoomFactor = processZoomForScreen(
        configStore.get('zoomPercent', 100) / 100
      )

      mainWindow.webContents.setZoomLevel(zoomFactor)
      mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
    }, 200)

    addListener('changeLanguage', async (event, language) => {
      logInfo(['Changing Language to:', language], LogPrefix.Backend)
      await i18next.changeLanguage(language)
      gameInfoStore.clear()
      GlobalConfig.get().setSetting('language', language)
      backendEvents.emit('languageChanged')
    })

    fetchLastestReleases()

    initTrayIcon(mainWindow)

    return
  })
}

addListener('notify', (event, args) => notify(args))

addOneTimeListener('frontendReady', () => {
  logInfo('Frontend Ready', LogPrefix.Backend)
  handleProtocol([openUrlArgument, ...process.argv])

  // skip the download queue if we are running in CLI mode
  if (isCLINoGui) {
    return
  }

  setTimeout(() => {
    logInfo('Starting the Download Queue', LogPrefix.Backend)
    initQueue()
  }, 5000)
})

// Maybe this can help with white screens
process.on('uncaughtException', async (err) => {
  logError(err, LogPrefix.Backend)

  // We might get "object has been destroyed" exceptions in CI, since we start
  // and close Heroic quickly there. Displaying an error box would lock up
  // the test (until the timeout is reached), so let's not do that
  if (process.env.CI === 'e2e') return

  showDialogBoxModalAuto({
    title: i18next.t(
      'box.error.uncaught-exception.title',
      'Uncaught Exception occured!'
    ),
    message: i18next.t('box.error.uncaught-exception.message', {
      defaultValue:
        'A uncaught exception occured:{{newLine}}{{error}}{{newLine}}{{newLine}} Report the exception on our Github repository.',
      newLine: '\n',
      error: err
    }),
    type: 'ERROR'
  })
})

let powerId: number | undefined
let displaySleepId: number | undefined

addListener('lock', (e, playing: boolean) => {
  const isSleepBlocked = powerId !== undefined
  const isDisplaySleepBlocked = displaySleepId !== undefined

  if (!playing && !isSleepBlocked) {
    logInfo('Preventing machine to sleep', LogPrefix.Backend)
    powerId = powerSaveBlocker.start('prevent-app-suspension')
  }

  if (playing && !isDisplaySleepBlocked) {
    logInfo('Preventing display to sleep', LogPrefix.Backend)
    displaySleepId = powerSaveBlocker.start('prevent-display-sleep')
  }
})

addListener('unlock', () => {
  if (powerId !== undefined) {
    logInfo('Stopping Power Saver Blocker', LogPrefix.Backend)
    powerSaveBlocker.stop(powerId)
    powerId = undefined
  }
  if (displaySleepId !== undefined) {
    logInfo('Stopping Display Sleep Blocker', LogPrefix.Backend)
    powerSaveBlocker.stop(displaySleepId)
    displaySleepId = undefined
  }
})

addHandler('checkDiskSpace', async (_e, folder): Promise<DiskSpaceData> => {
  // FIXME: Propagate errors

  const parsedPath = Path.parse(folder)

  const { freeSpace, totalSpace } = await getDiskInfo(parsedPath)
  const pathIsWritable = await isWritable(parsedPath)
  const pathIsFlatpakAccessible = isAccessibleWithinFlatpakSandbox(parsedPath)

  return {
    free: freeSpace,
    diskSize: totalSpace,
    validPath: pathIsWritable,
    validFlatpakPath: pathIsFlatpakAccessible,
    message: `${getFileSize(freeSpace)} / ${getFileSize(totalSpace)}`
  }
})

addHandler('getAvailableStorageDrives', async (_e, runner) =>
  getAvailableStorageDrives(runner)
)

addHandler('steamLoginWebView', async () => SteamAuthModal.openLoginModal())
addHandler('steamLogout', async () => {
  await SteamAuthModal.logout()
  await SteamUser.logout()
})
addHandler('steamGetConfig', async () => ({
  syncMode: steamConfigStore.get('syncMode', 'all'),
  apiKey: steamConfigStore.get('apiKey', ''),
  hasSession: steamConfigStore.has('sessionCookie')
}))
addHandler('steamSaveConfig', async (_e, config) => {
  if (config.syncMode) steamConfigStore.set('syncMode', config.syncMode)
  if (config.apiKey !== undefined) {
    if (config.apiKey) {
      steamConfigStore.set('apiKey', config.apiKey.trim())
    } else {
      steamConfigStore.delete('apiKey')
    }
  }
  steamConfigStore.set('isLoggedIn', true)
  const account = await SteamUser.getDetectedAccount()
  if (account) {
    steamConfigStore.set('username', account.personaName)
    steamConfigStore.set('steamId', account.steamId64)
    steamConfigStore.set('steamId32', account.steamId32)
  }
})

addHandler('isFrameless', () => isFrameless())
addHandler('isMinimized', () => !!getMainWindow()?.isMinimized())
addHandler('isMaximized', () => !!getMainWindow()?.isMaximized())
addListener('minimizeWindow', () => getMainWindow()?.minimize())
addListener('maximizeWindow', () => getMainWindow()?.maximize())
addListener('unmaximizeWindow', () => getMainWindow()?.unmaximize())
addListener('closeWindow', () => getMainWindow()?.close())
addListener('setFullscreen', (_e, enabled) =>
  getMainWindow()?.setFullScreen(enabled)
)
addListener('quit', async () => handleExit())

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  const mainWindow = getMainWindow()

  if (mainWindow) {
    handleProtocol([url])
  } else {
    openUrlArgument = url
  }
})

addListener('openExternalUrl', async (event, url) => openUrlOrFile(url))
addListener('openFolder', async (event, folder) => openUrlOrFile(folder))
addListener('openSupportPage', async () => openUrlOrFile(supportURL))
addListener('openReleases', async () => openUrlOrFile(heroicGithubURL))
addListener('openWeblate', async () => openUrlOrFile(weblateUrl))
addListener('showAboutWindow', () => showAboutWindow())
addListener('openLoginPage', async () => openUrlOrFile(epicLoginUrl))
addListener('openDiscordLink', async () => openUrlOrFile(discordLink))
addListener('openPatreonPage', async () => openUrlOrFile(patreonPage))
addListener('openKofiPage', async () => openUrlOrFile(kofiPage))
addListener('openGithubSponsorsPage', async () =>
  openUrlOrFile(githubSponsorsPage)
)
addListener('openWinePrefixFAQ', async () => openUrlOrFile(wineprefixFAQ))
addListener('openWebviewPage', async (event, url) => openUrlOrFile(url))
addListener('openWikiLink', async () => openUrlOrFile(wikiLink))
addListener('openSidInfoPage', async () => openUrlOrFile(sidInfoUrl))
addListener('openCustomThemesWiki', async () =>
  openUrlOrFile(customThemesWikiLink)
)
addListener('showConfigFileInFolder', async (event, appName) => {
  if (appName === 'default') {
    return openUrlOrFile(configPath)
  }
  return openUrlOrFile(path.join(gamesConfigPath, `${appName}.json`))
})

addListener('removeFolder', async (e, [path, folderName]) => {
  removeFolder(path, folderName)
})

addHandler('runWineCommand', async (e, args) => runWineCommand(args))

/// IPC handlers begin here.

addHandler('checkGameUpdates', async (): Promise<string[]> => {
  let oldGames: string[] = []
  const { autoUpdateGames } = GlobalConfig.get().getSettings()
  for (const runner of Object.keys(
    libraryManagerMap
  ) as (keyof typeof libraryManagerMap)[]) {
    let gamesToUpdate = await libraryManagerMap[runner].listUpdateableGames()
    if (autoUpdateGames) {
      gamesToUpdate = autoUpdate(runner, gamesToUpdate)
    }
    oldGames = [...oldGames, ...gamesToUpdate]
  }

  return oldGames
})

addHandler('getEpicGamesStatus', async () => isEpicServiceOffline())

addHandler('getMaxCpus', () => cpus().length)

addHandler('getHeroicVersion', () => app.getVersion())
addHandler('isFullscreen', () => isSteamDeckGameMode || isCLIFullscreen)
addHandler('getGameOverride', async () =>
  libraryManagerMap['legendary'].getGameOverride()
)
addHandler('getGameSdl', async (event, appName) =>
  libraryManagerMap['legendary'].getGameSdl(appName)
)

addHandler('showUpdateSetting', () => !isFlatpak)

addHandler('getLatestReleases', async () => {
  const { checkForUpdatesOnStartup } = GlobalConfig.get().getSettings()
  if (checkForUpdatesOnStartup) {
    return getLatestReleases()
  } else {
    return []
  }
})

addHandler('getCurrentChangelog', async () => {
  return getCurrentChangelog()
})

addHandler('checkTodayTrackedReleases', async (): Promise<{ count: number; titles: string[] }> => {
  try {
    const ses = session.fromPartition('persist:releases')
    const url = 'https://www.releases.com/tracking?f=t%3AGame&f=v%3APC&f=v%3APC%20%28Early%20Access%29'
    const response = await ses.fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    })

    if (!response.ok) return { count: 0, titles: [] }

    const html = await response.text()

    // Locate current today header
    const currentHeaderMatch = html.match(
      /<h2[^>]*class="[^"]*RWP-Calendar-GroupHeader-Current[^"]*"[^>]*>([\s\S]*?)<\/h2>/i
    )
    if (!currentHeaderMatch) return { count: 0, titles: [] }

    const afterHeader = html.slice(
      currentHeaderMatch.index! + currentHeaderMatch[0].length
    )
    const nextHeaderIndex = afterHeader.search(
      /<h2[^>]*class="[^"]*RWP-Calendar-GroupHeader/i
    )
    const todaySection =
      nextHeaderIndex !== -1 ? afterHeader.slice(0, nextHeaderIndex) : afterHeader

    // Match card inner elements inside today section
    const cardMatches =
      todaySection.match(
        /<div[^>]*class="[^"]*RWPCC-CalendarItems-CardControl-Inner[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
      ) || []

    const trackedTitles: string[] = []
    for (const card of cardMatches) {
      const clean = card.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const titleClean = clean
        .replace(/PC\d*Today$/i, '')
        .replace(/Today$/i, '')
        .replace(/\s+PC$/i, '')
        .trim()
      if (titleClean) {
        trackedTitles.push(titleClean)
      }
    }

    if (trackedTitles.length > 0 && Notification.isSupported()) {
      try {
        const gameNames = trackedTitles.join(', ')
        const notif = new Notification({
          title: '👻 Ghost - Lançamento Hoje!',
          body:
            trackedTitles.length === 1
              ? `${gameNames} foi lançado hoje!`
              : `${trackedTitles.length} jogos monitorados foram lançados hoje: ${gameNames}`,
          icon: ensurePermanentAppIcon()
        })
        notif.show()
      } catch (notifErr) {
        logError(`Erro ao disparar notificação do Windows: ${notifErr}`, LogPrefix.Backend)
      }
    }

    return {
      count: trackedTitles.length,
      titles: trackedTitles
    }
  } catch (err) {
    logError(`Error checking today tracked releases: ${err}`, LogPrefix.Backend)
    return { count: 0, titles: [] }
  }
})

addHandler('downloadLauncherUpdate', async (event, assets: any[]) => {
  const { downloadFile } = await import('./utils')
  const exePath = getPermanentAppExecutable()
  const currentExeName = path.basename(exePath).toLowerCase()
  const isPortable = currentExeName.includes('portable')

  // Find matching asset
  let selectedAsset = assets.find((asset) => {
    const assetName = asset.name.toLowerCase()
    if (isPortable) {
      return assetName.includes('portable') && assetName.endsWith('.exe')
    } else {
      return assetName.includes('setup') && assetName.endsWith('.exe')
    }
  })

  // Fallback to first .exe if no match
  if (!selectedAsset) {
    selectedAsset = assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'))
  }

  if (!selectedAsset) {
    logError('No executable asset found in release for download.', LogPrefix.Backend)
    return { success: false, error: 'Nenhum arquivo executável (.exe) encontrado para download.' }
  }

  let installDir = app.getPath('downloads')
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local')
    installDir = path.join(localAppData, 'Programs', 'Ghost Games Launcher')
    if (!existsSync(installDir)) {
      mkdirSync(installDir, { recursive: true })
    }
  }

  const destPath = path.join(installDir, selectedAsset.name)

  try {
    await downloadFile({
      url: selectedAsset.browser_download_url,
      dest: destPath,
      progressCallback: (bytes, speed, percentage, writingSpeed) => {
        sendFrontendMessage('download-launcher-update-progress', {
          bytes,
          speed,
          percentage,
          writingSpeed
        })
      }
    })

    // Create or Update Desktop Shortcuts on Windows
    if (process.platform === 'win32') {
      try {
        const desktopFolder = app.getPath('desktop')
        
        // Remove old Ghost.lnk shortcut
        try {
          const oldShortcut = path.join(desktopFolder, 'Ghost.lnk')
          if (existsSync(oldShortcut)) {
            require('fs').unlinkSync(oldShortcut)
          }
        } catch {}

        const iconToUse = ensurePermanentAppIcon()

        const shortcutPath = path.join(desktopFolder, 'Ghost Games Launcher.lnk')
        shell.writeShortcutLink(shortcutPath, 'create', {
          target: destPath,
          description: 'Ghost Games Launcher',
          icon: iconToUse,
          iconIndex: 0,
          appUserModelId: 'com.ghostgameslauncher.ghost'
        })
      } catch (err) {
        logError(['Failed to create desktop shortcut for update:', err], LogPrefix.Backend)
      }
    }

    app.releaseSingleInstanceLock()
    shell.openPath(destPath).then((err) => {
      if (err) {
        logError(['Failed to launch update file:', err], LogPrefix.Backend)
        app.requestSingleInstanceLock()
      } else {
        handleExit()
      }
    })

    return { success: true, destPath }
  } catch (error) {
    logError(['Failed to download launcher update:', error], LogPrefix.Backend)
    return { success: false, error: String(error) }
  }
})

addHandler('exportGhostBackup', async (event, frontendData?: { localStorageData?: Record<string, string> }) => {
  const mainWindow = getMainWindow()
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Exportar Backup do Ghost Games Launcher',
    defaultPath: `Ghost_Backup_${new Date().toISOString().slice(0, 10)}.ghostbackup`,
    filters: [{ name: 'Ghost Backup (*.ghostbackup, *.json)', extensions: ['ghostbackup', 'json'] }]
  })

  if (canceled || !filePath) {
    return { success: false, error: 'Exportação cancelada.' }
  }

  try {
    if (frontendData?.localStorageData) {
      (configStore as any).set('settings.localStorageBackup', frontendData.localStorageData)
    }
    const backupData = await getBackupPayload()

    writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    logError(['Failed to export backup:', error], LogPrefix.Backend)
    return { success: false, error: String(error) }
  }
})

addHandler('importGhostBackup', async (event, fileContent?: string) => {
  try {
    let backupData: any

    if (fileContent) {
      backupData = JSON.parse(fileContent)
    } else {
      const mainWindow = getMainWindow()
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow!, {
        title: 'Importar Backup do Ghost Games Launcher',
        filters: [{ name: 'Ghost Backup (*.ghostbackup, *.json)', extensions: ['ghostbackup', 'json'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) {
        return { success: false, error: 'Importação cancelada.' }
      }

      const filePath = filePaths[0]
      const rawContent = readFileSync(filePath, 'utf-8')
      backupData = JSON.parse(rawContent)
    }

    if (backupData.settings) {
      configStore.set('settings', backupData.settings)
    }
    if (backupData.windowProps) {
      configStore.set('window-props', backupData.windowProps)
    }
    if (backupData.zoomPercent !== undefined) {
      configStore.set('zoomPercent', backupData.zoomPercent)
    }
    if (Array.isArray(backupData.sideloadedGames)) {
      libraryStore.set('games', backupData.sideloadedGames)
    }
    if (backupData.gameOverrides) {
      gameOverridesStore.set('overrides', backupData.gameOverrides)
    }
    if (Array.isArray(backupData.blacklist)) {
      await clearBlacklist()
      for (const item of backupData.blacklist) {
        await addGameToBlacklist(item)
      }
    }
    if (backupData.playtimes) {
      Object.entries(backupData.playtimes).forEach(([key, value]) => {
        tsStore.set(key as any, value as any)
      })
    }

    sendFrontendMessage('refreshLibrary')
    return {
      success: true,
      localStorageData: backupData.localStorageData || {}
    }
  } catch (error) {
    logError(['Failed to import backup:', error], LogPrefix.Backend)
    return { success: false, error: String(error) }
  }
})

addHandler('connectCloudProvider', async (event, provider) => {
  return connectCloudProvider(provider)
})

addHandler('disconnectCloudProvider', async () => {
  clearCloudTokens()
})

addHandler('getCloudProviderStatus', async () => {
  return getCloudProviderStatus()
})

addHandler('getGoogleCredentials', async () => {
  return getGoogleCredentials()
})

addHandler('setGoogleCredentials', async (event, clientId, clientSecret) => {
  setGoogleCredentials(clientId, clientSecret)
})

addHandler('uploadBackupToCloud', async (event, frontendData?: { localStorageData?: Record<string, string> }) => {
  try {
    if (frontendData?.localStorageData) {
      (configStore as any).set('settings.localStorageBackup', frontendData.localStorageData)
    }
    const backupData = await getBackupPayload()
    return await uploadBackupToCloud(backupData)
  } catch (error) {
    logError(['Failed to upload backup to cloud:', error], LogPrefix.Backend)
    return { success: false, error: String(error) }
  }
})

addHandler('downloadBackupFromCloud', async () => {
  try {
    const res = await downloadBackupFromCloud()
    if (res.success && res.data) {
      return { success: true, data: res.data }
    }
    return { success: false, error: res.error || 'Falha ao baixar da nuvem.' }
  } catch (error) {
    logError(['Failed to download backup from cloud:', error], LogPrefix.Backend)
    return { success: false, error: String(error) }
  }
})

addListener('clearCache', (event, showDialog, fromVersionChange = false) => {
  clearCache(undefined, fromVersionChange)
  sendFrontendMessage('refreshLibrary')

  if (showDialog) {
    showDialogBoxModalAuto({
      event,
      title: i18next.t('box.cache-cleared.title', 'Cache Cleared'),
      message: i18next.t(
        'box.cache-cleared.message',
        'Heroic Cache Was Cleared!'
      ),
      type: 'MESSAGE',
      buttons: [{ text: i18next.t('box.ok', 'Ok') }]
    })
  }
})

addListener('clearAchievementCache', (event, appName: string) => {
  clearAchievementCache(appName)
  logInfo(
    'Achievement cache was cleared for game: ' + appName,
    LogPrefix.Backend
  )
})

addListener('resetHeroic', () => resetHeroic())

addListener('createNewWindow', (e, url) => {
  new BrowserWindow({ height: 700, width: 1200 }).loadURL(url)
})

addHandler('isGameAvailable', async (e, args) => {
  const { appName, runner } = args
  return libraryManagerMap[runner].getGame(appName).isGameAvailable()
})

addHandler('getGameInfo', async (event, appName, runner) => {
  // Fastpath since we sometimes have to request info for a GOG game as Legendary because we don't know it's a GOG game yet
  if (
    runner === 'legendary' &&
    !libraryManagerMap['legendary'].hasGame(appName)
  ) {
    return null
  }
  const tempGameInfo = libraryManagerMap[runner].getGame(appName).getGameInfo()
  // The game managers return an empty object if they couldn't fetch the game
  // info, since most of the backend assumes getting it can never fail (and
  // an empty object is a little easier to work with than `null`)
  // The frontend can however handle being passed an explicit `null` value, so
  // we return that here instead if the game info is empty
  if (!Object.keys(tempGameInfo).length) return null
  return attachOverrides(tempGameInfo)
})

addHandler(
  'getAchievements',
  async (event, appName, runner, lang = 'en-US') => {
    return getGame(appName, runner).getAchievements?.(lang) ?? []
  }
)

addHandler('getExtraInfo', async (event, appName, runner) => {
  // Fastpath since we sometimes have to request info for a GOG game as Legendary because we don't know it's a GOG game yet
  if (
    runner === 'legendary' &&
    !libraryManagerMap['legendary'].hasGame(appName)
  ) {
    return null
  }
  return libraryManagerMap[runner].getGame(appName).getExtraInfo()
})

addHandler('getGameSettings', async (event, appName, runner) => {
  try {
    return await libraryManagerMap[runner].getGame(appName).getSettings()
  } catch (error) {
    logError(error, LogPrefix.Backend)
    return null
  }
})

addHandler('getGOGLinuxInstallersLangs', async (event, appName) =>
  libraryManagerMap['gog'].getLinuxInstallersLanguages(appName)
)

addHandler(
  'getInstallInfo',
  async (event, appName, runner, installPlatform, build, branch) => {
    try {
      const info = await libraryManagerMap[runner].getInstallInfo(
        appName,
        installPlatform,
        {
          branch,
          build
        }
      )
      if (info === undefined) return null
      return info
    } catch (error) {
      logError(
        error,
        runner === 'legendary' ? LogPrefix.Legendary : LogPrefix.Gog
      )
      return null
    }
  }
)

addHandler('getUserInfo', async () => {
  return LegendaryUser.getUserInfo()
})

addHandler('getAmazonUserInfo', async () => NileUser.getUserData())

// Checks if the user have logged in with Legendary already
addHandler('isLoggedIn', () => LegendaryUser.isLoggedIn())

addHandler('login', async (event, sid) => LegendaryUser.login(sid))
addHandler('authGOG', async (event, code) => GOGUser.login(code))
addHandler('logoutLegendary', () => LegendaryUser.logout())
addListener('logoutGOG', () => GOGUser.logout())

addHandler('getAmazonLoginData', () => NileUser.getLoginData())
addHandler('authAmazon', async (event, data) => NileUser.login(data))
addHandler('logoutAmazon', () => NileUser.logout())

addHandler('authZoom', async (event, url) => {
  const login = await ZoomUser.login(url)
  if (login.status === 'done') {
    await ZoomUser.getUserDetails()
  }
  return login
})

addListener('logoutZoom', () => ZoomUser.logout())
addHandler('getZoomUserInfo', async () => ZoomUser.getUserDetails())

addListener('logoutSteam', () => SteamUser.logout())
addHandler('loginSteam', async () => SteamUser.login())
addHandler('getSteamUserInfo', async () => SteamUser.getUserDetails())

addHandler('getAlternativeWine', async () =>
  GlobalConfig.get().getAlternativeWine()
)

addHandler('readConfig', async (event, configClass) => {
  if (configClass === 'library') {
    await libraryManagerMap['legendary'].refresh()
    return libraryManagerMap['legendary'].getListOfGames()
  }
  const userInfo = LegendaryUser.getUserInfo()
  return userInfo?.displayName ?? ''
})

addHandler('requestAppSettings', () => GlobalConfig.get().getSettings())
addHandler(
  'requestGameSettings',
  async (_e, appName) => await GameConfig.get(appName).getSettings()
)

addHandler('toggleDXVK', async (event, { appName, action }) =>
  GameConfig.get(appName)
    .getSettings()
    .then(async (gameSettings) =>
      DXVK.installRemove(gameSettings, 'dxvk', action)
    )
)

addHandler('toggleDXVKNVAPI', async (event, { appName, action }) =>
  GameConfig.get(appName)
    .getSettings()
    .then(async (gameSettings) =>
      DXVK.installRemove(gameSettings, 'dxvk-nvapi', action)
    )
)

addHandler('toggleVKD3D', async (event, { appName, action }) =>
  GameConfig.get(appName)
    .getSettings()
    .then(async (gameSettings) =>
      DXVK.installRemove(gameSettings, 'vkd3d', action)
    )
)

addHandler('writeConfig', (event, { appName, config }) =>
  writeConfig(appName, config)
)

addListener('setSetting', (event, { appName, key, value }) => {
  if (appName === 'default') {
    GlobalConfig.get().setSetting(key, value)
    if (key === 'startAtLogin' || key === 'startInTray') {
      const curSettings = GlobalConfig.get().getSettings()
      syncAutoStartSettings(
        curSettings.startAtLogin === true,
        curSettings.startInTray === true
      )
    }
  } else {
    GameConfig.get(appName).setSetting(key, value)
  }
})

// Watch the installed games file and trigger a refresh on the installed games if something changes
if (existsSync(legendaryInstalled)) {
  let watchTimeout: NodeJS.Timeout | undefined
  watch(legendaryInstalled, () => {
    logInfo('installed.json updated, refreshing library', LogPrefix.Legendary)
    // `watch` might fire twice (while Legendary/we are still writing chunks of the file), which would in turn make LegendaryLibrary fail to
    // decode the JSON data. So instead of immediately calling LegendaryLibrary.get().refreshInstalled(), call it only after no writes happen
    // in a 500ms timespan
    if (watchTimeout) clearTimeout(watchTimeout)
    watchTimeout = setTimeout(
      () => libraryManagerMap['legendary'].refreshInstalled(),
      500
    )
  })
}

addHandler('refreshLibrary', async (e, library?) => {
  if (library !== undefined && library !== 'all') {
    await libraryManagerMap[library].refresh()
  } else {
    const allRefreshPromises = []
    for (const manager of Object.values(libraryManagerMap)) {
      allRefreshPromises.push(manager.refresh())
    }
    await Promise.allSettled(allRefreshPromises)
  }
})

// get pid/tid on launch and inject
addHandler('launch', (event, args): StatusPromise => {
  return launchEventCallback(args)
})

addHandler('openDialog', async (e, args) => {
  const mainWindow = getMainWindow()
  if (!mainWindow) {
    return false
  }

  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, args)
  if (!canceled) {
    return filePaths[0]
  }
  return false
})

addListener('showItemInFolder', async (e, item) => showItemInFolder(item))

addHandler('uninstall', uninstallGameCallback)
addHandler('bulkUninstall', bulkUninstallCallback)

addHandler('repair', async (event, appName, runner) => {
  if (!isOnline()) {
    logWarning(
      `App offline, skipping repair for game '${appName}'.`,
      LogPrefix.Backend
    )
    return
  }

  sendGameStatusUpdate({
    appName,
    runner,
    status: 'repairing'
  })

  const { title } = libraryManagerMap[runner].getGame(appName).getGameInfo()

  try {
    await libraryManagerMap[runner].getGame(appName).repair()
  } catch (error) {
    notify({
      title,
      body: i18next.t('notify.error.reparing', 'Error Repairing')
    })
    logError(error, LogPrefix.Backend)
  }
  notify({ title, body: i18next.t('notify.finished.reparing') })
  logInfo('Finished repairing', LogPrefix.Backend)

  sendGameStatusUpdate({
    appName,
    runner,
    status: 'done'
  })
})

addHandler(
  'moveInstall',
  async (event, { appName, path, runner }): Promise<void> => {
    sendGameStatusUpdate({
      appName,
      runner,
      status: 'moving'
    })

    const { title } = libraryManagerMap[runner].getGame(appName).getGameInfo()
    notify({ title, body: i18next.t('notify.moving', 'Moving Game') })

    const moveRes = await libraryManagerMap[runner]
      .getGame(appName)
      .moveInstall(path)
    if (moveRes.status === 'error') {
      notify({
        title,
        body: i18next.t('notify.error.move', 'Error Moving Game')
      })
      logError(
        `Error while moving ${appName} to ${path}: ${moveRes.error} `,
        LogPrefix.Backend
      )

      showDialogBoxModalAuto({
        event,
        title: i18next.t('box.error.title', 'Error'),
        message: i18next.t('box.error.moving', 'Error Moving Game {{error}}', {
          error: moveRes.error
        }),
        type: 'ERROR'
      })
    }

    if (moveRes.status === 'done') {
      notify({ title, body: i18next.t('notify.moved') })
      logInfo(`Finished moving ${appName} to ${path}.`, LogPrefix.Backend)
    }

    sendGameStatusUpdate({
      appName,
      runner,
      status: 'done'
    })
  }
)

addHandler(
  'importGame',
  async (
    event,
    {
      appName,
      path,
      runner,
      platform,
      winePrefix,
      wineVersion,
      wineCrossoverBottle
    }
  ): StatusPromise => {
    if (runner === 'legendary') {
      const epicOffline = await isEpicServiceOffline()
      if (epicOffline) {
        showDialogBoxModalAuto({
          event,
          title: i18next.t('box.warning.title', 'Warning'),
          message: i18next.t(
            'box.warning.epic.import',
            'Epic Servers are having major outage right now, the game cannot be imported!'
          ),
          type: 'ERROR'
        })
        return { status: 'error' }
      }
    }

    const { title } = libraryManagerMap[runner].getGame(appName).getGameInfo()
    sendGameStatusUpdate({
      appName,
      runner,
      status: 'importing'
    })

    const abortMessage = () => {
      notify({
        title,
        body: i18next.t('notify.import.failed', 'Importing Failed')
      })
      sendGameStatusUpdate({
        appName,
        runner,
        status: 'done'
      })
    }

    try {
      const { abort, error } = await libraryManagerMap[runner]
        .getGame(appName)
        .importGame(path, platform)
      if (abort || error) {
        abortMessage()
        return { status: 'done' }
      }
    } catch (error) {
      abortMessage()
      logError(error, LogPrefix.Backend)
      return { status: 'error' }
    }

    if (winePrefix && wineVersion) {
      const gameSettings = await getGame(appName, runner).getSettings()
      writeConfig(appName, {
        ...gameSettings,
        winePrefix,
        wineVersion,
        wineCrossoverBottle
      })
    }

    notify({
      title,
      body: i18next.t('notify.install.imported', 'Game Imported')
    })
    sendGameStatusUpdate({
      appName,
      runner,
      status: 'done'
    })
    logInfo(`imported ${title}`, LogPrefix.Backend)
    return { status: 'done' }
  }
)

addHandler('kill', async (event, appName, runner) => {
  callAbortController(appName)
  sendGameStatusUpdate({ appName, runner, status: 'done' })
  const res = await libraryManagerMap[runner].getGame(appName).stop()
  sendGameStatusUpdate({ appName, runner, status: 'done' })
  return res
})

addHandler('changeInstallPath', async (event, { appName, path, runner }) => {
  await libraryManagerMap[runner].changeGameInstallPath(appName, path)
  logInfo(
    `Finished changing install path of ${appName} to ${path}.`,
    LogPrefix.Backend
  )
})

addHandler('egsSync', async (event, args) => {
  return libraryManagerMap['legendary'].toggleGamesSync(args)
})

addHandler('syncGOGSaves', async (event, gogSaves, appName, arg) =>
  libraryManagerMap['gog'].getGame(appName).syncSaves(arg, '', gogSaves)
)

addHandler('getLaunchOptions', async (event, appName, runner) => {
  const availableLaunchOptions =
    await libraryManagerMap[runner].getLaunchOptions(appName)

  // add a default option if there are other options but no default
  if (
    availableLaunchOptions.length > 0 &&
    !availableLaunchOptions.some(
      (option) =>
        (option.type === undefined || option.type === 'basic') &&
        option.name === 'Default' &&
        option.parameters === ''
    )
  ) {
    availableLaunchOptions.unshift({
      name: i18next.t('launch.default', 'Default', {
        ns: 'gamepage'
      }),
      parameters: '',
      type: 'basic'
    })
  }

  return availableLaunchOptions
})

addHandler('syncSaves', async (event, { arg = '', path, appName, runner }) => {
  if (runner === 'legendary') {
    const epicOffline = await isEpicServiceOffline()
    if (epicOffline) {
      logWarning(
        'Epic is offline right now, cannot sync saves!',
        LogPrefix.Backend
      )
      return 'Epic is offline right now, cannot sync saves!'
    }
  }
  if (!isOnline()) {
    logWarning('App is offline, cannot sync saves!', LogPrefix.Backend)
    return 'App is offline, cannot sync saves!'
  }

  const output = await libraryManagerMap[runner]
    .getGame(appName)
    .syncSaves(arg, path)
  logInfo(output, LogPrefix.Backend)
  return output
})

addHandler(
  'getDefaultSavePath',
  async (event, appName, runner, alreadyDefinedGogSaves) =>
    getDefaultSavePath(appName, runner, alreadyDefinedGogSaves)
)

// Simulate keyboard and mouse actions as if the real input device is used
addHandler('gamepadAction', async (event, args) => {
  // we can only receive gamepad events if the main window exists
  const mainWindow = getMainWindow()!

  const { action, metadata } = args
  const inputEvents: (
    | Electron.MouseInputEvent
    | Electron.MouseWheelInputEvent
    | Electron.KeyboardInputEvent
  )[] = []

  /*
   * How to extend:
   *
   * Valid values for type are 'keyDown', 'keyUp' and 'char'
   * Valid values for keyCode are defined here:
   * https://www.electronjs.org/docs/latest/api/accelerator#available-key-codes
   *
   */
  switch (action) {
    case 'rightStickUp':
      inputEvents.push({
        type: 'mouseWheel',
        deltaY: 50,
        x: mainWindow.getBounds().width / 2,
        y: mainWindow.getBounds().height / 2
      })
      break
    case 'rightStickDown':
      inputEvents.push({
        type: 'mouseWheel',
        deltaY: -50,
        x: mainWindow.getBounds().width / 2,
        y: mainWindow.getBounds().height / 2
      })
      break
    case 'leftStickUp':
    case 'leftStickDown':
    case 'leftStickLeft':
    case 'leftStickRight':
    case 'padUp':
    case 'padDown':
    case 'padLeft':
    case 'padRight':
      // spatial navigation
      inputEvents.push({
        type: 'keyDown',
        keyCode: action.replace(/pad|leftStick/, '')
      })
      inputEvents.push({
        type: 'keyUp',
        keyCode: action.replace(/pad|leftStick/, '')
      })
      break
    case 'leftClick':
      inputEvents.push({
        type: 'mouseDown',
        button: 'left',
        x: metadata.x,
        y: metadata.y
      })
      inputEvents.push({
        type: 'mouseUp',
        button: 'left',
        x: metadata.x,
        y: metadata.y
      })
      break
    case 'rightClick':
      inputEvents.push({
        type: 'mouseDown',
        button: 'right',
        x: metadata.x,
        y: metadata.y
      })
      inputEvents.push({
        type: 'mouseUp',
        button: 'right',
        x: metadata.x,
        y: metadata.y
      })
      break
    case 'back':
      mainWindow.webContents.goBack()
      break
    case 'esc':
      inputEvents.push({
        type: 'keyDown',
        keyCode: 'Esc'
      })
      inputEvents.push({
        type: 'keyUp',
        keyCode: 'Esc'
      })
      break
    case 'tab':
      inputEvents.push(
        {
          type: 'keyDown',
          keyCode: 'Tab'
        },
        {
          type: 'keyUp',
          keyCode: 'Tab'
        }
      )
      break
    case 'shiftTab':
      inputEvents.push(
        {
          type: 'keyDown',
          keyCode: 'Tab',
          modifiers: ['shift']
        },
        {
          type: 'keyUp',
          keyCode: 'Tab',
          modifiers: ['shift']
        }
      )
      break
  }

  if (inputEvents.length) {
    inputEvents.forEach((event) => mainWindow.webContents.sendInputEvent(event))
  }
})

addHandler('getShellPath', async (event, path) => getShellPath(path))

addHandler('getWebviewPreloadPath', () => webviewPreloadPath)

addHandler('clipboardReadText', () => clipboard.readText())

addListener('clipboardWriteText', (e, text) => clipboard.writeText(text))

addHandler('getCustomThemes', async () => {
  const { customThemesPath } = GlobalConfig.get().getSettings()

  if (!existsSync(customThemesPath)) {
    return []
  }

  return readdirSync(customThemesPath).filter((fileName) =>
    fileName.endsWith('.css')
  )
})

addHandler('getThemeCSS', async (event, theme) => {
  const { customThemesPath = '' } = GlobalConfig.get().getSettings()

  const cssPath = path.join(customThemesPath, theme)

  if (!existsSync(cssPath)) {
    return ''
  }

  return readFileSync(cssPath, 'utf-8')
})

addHandler('getCustomCSS', async () => {
  return GlobalConfig.get().getSettings().customCSS
})

addListener('setTitleBarOverlay', (e, args) => {
  const mainWindow = getMainWindow()
  if (typeof mainWindow?.['setTitleBarOverlay'] === 'function') {
    logDebug(`Setting titlebar overlay options ${JSON.stringify(args)}`)
    mainWindow?.setTitleBarOverlay(args)
  }
})

addListener('addNewApp', (e, args) =>
  libraryManagerMap['sideload'].addNewApp(args)
)
addHandler('scanInstalledGames', () => scanInstalledGames())
addHandler('discoverInstalledGames', () => discoverInstalledGames())
addHandler('discoverAllGames', (e, searchTitles, selectedDrives) => discoverAllGames(searchTitles, selectedDrives))
addHandler('abortScan', () => abortScan())
addHandler('getLogicalDrives', () => getDrives())
addHandler('importSelectedGames', (e, args) => importSelectedGames(args))
addHandler('undoImport', (e, args) => undoImport(args))
addHandler('addGameToBlacklist', (e, args) => addGameToBlacklist(args))
addHandler('clearBlacklist', () => clearBlacklist())
addHandler('getBlacklist', () => getBlacklist())
addHandler('removeGameFromBlacklist', (e, executable: string) => removeGameFromBlacklist(executable))
addHandler('exportScanLog', async (e, text: string) => {
  const mainWindow = getMainWindow()
  if (!mainWindow) return false

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Log do PC Game Scanner',
    defaultPath: 'sideload_scan_log.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  })

  if (!canceled && filePath) {
    try {
      writeFileSync(filePath, text, 'utf-8')
      return true
    } catch (err) {
      logError(['Failed to write scan log file:', err])
      return false
    }
  }
  return false
})

addListener('setGameMetadataOverride', (e, args) => {
  const { appName, title, art_cover, art_square, is_manual } = args
  setGameOverrides(appName, { title, art_cover, art_square, is_manual: is_manual ?? true })
  sendFrontendMessage('metadataChanged', getAllGameOverrides())
})

addListener('setAllGameOverrides', (e, overrides) => {
  setAllGameOverrides(overrides)
  sendFrontendMessage('metadataChanged', overrides)
})

addListener('updateSideloadedApps', (e, apps) => {
  updateSideloadedApps(apps)
})

addHandler('getGameMetadataOverride', async (_e, appName) => {
  return getGameOverrides(appName)
})

addHandler('getAllGameOverrides', async () => {
  return getAllGameOverrides()
})

addHandler('isNative', (e, { appName, runner }) => {
  return libraryManagerMap[runner].getGame(appName).isNative()
})

addHandler('pathExists', async (e, path: string) => {
  return existsSync(path)
})

addListener('processShortcut', async (e, combination: string) => {
  const mainWindow = getMainWindow()

  switch (combination) {
    // hotkey to reload the app
    case 'ctrl+r':
      mainWindow?.reload()
      break
    // hotkey to quit the app
    case 'ctrl+q':
      handleExit()
      break
    // hotkey to open the settings on frontend
    case 'ctrl+k':
      sendFrontendMessage('openScreen', '/settings/general')
      break
    // hotkey to open the downloads screen on frontend
    case 'ctrl+j':
      sendFrontendMessage('openScreen', '/download-manager')
      break
    // hotkey to open the library screen on frontend
    case 'ctrl+l':
      sendFrontendMessage('openScreen', '/library')
      break
    case 'ctrl+shift+i':
      mainWindow?.webContents?.openDevTools()
      break
  }
})

addHandler(
  'getPlaytimeFromRunner',
  async (e, runner, appName): Promise<number | undefined> => {
    const { disablePlaytimeSync } = GlobalConfig.get().getSettings()
    if (disablePlaytimeSync) {
      return
    }
    if (runner === 'gog') {
      return libraryManagerMap[runner].getGame(appName).getGOGPlaytime()
    }

    return
  }
)

addHandler('getPrivateBranchPassword', (e, appName) =>
  libraryManagerMap['gog'].getGame(appName).getBranchPassword()
)
addHandler('setPrivateBranchPassword', (e, appName, password) =>
  libraryManagerMap['gog'].getGame(appName).setBranchPassword(password)
)

addHandler('getAvailableCyberpunkMods', async () =>
  libraryManagerMap['gog'].getCyberpunkMods()
)
addHandler('setCyberpunkModConfig', async (e, props) =>
  libraryManagerMap['gog'].setCyberpunkModConfig(props)
)

addListener('changeGameVersionPinnedStatus', (e, appName, runner, status) => {
  libraryManagerMap[runner].changeVersionPinnedStatus(appName, status)
})

addHandler('getKnownFixes', (e, appName, runner) =>
  readKnownFixes(appName, runner)
)

addHandler('wine.isValidVersion', async (e, wineVersion: WineInstallation) =>
  validWine(wineVersion)
)

/*
  Other Keys that should go into translation files:
  t('box.error.generic.title')
  t('box.error.generic.message')
 */

/*
 * INSERT OTHER IPC HANDLERS HERE
 */
import './logger/ipc_handler'
import './wine/manager/ipc_handler'
import './shortcuts/ipc_handler'
import './anticheat/ipc_handler'
import './storeManagers/legendary/eos_overlay/ipc_handler'
import './wine/runtimes/ipc_handler'
import './downloadmanager/ipc_handler'
import './utils/ipc_handler'
import './wiki_game_info/ipc_handler'
import './recent_games/ipc_handler'
import './tools/ipc_handler'
import './progress_bar'
import './steamgrid/ipc_handler'
