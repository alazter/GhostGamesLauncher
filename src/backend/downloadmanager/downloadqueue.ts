import { libraryManagerMap } from 'backend/storeManagers'
import { TypeCheckedStoreBackend } from './../electron_store'
import { logError, logInfo, LogPrefix, logWarning } from 'backend/logger'
import { getFileSize, removeFolder, sendGameStatusUpdate } from '../utils'
import { DMQueue, DMQueueElement, DMStatus, DownloadManagerState } from 'common/types'
import { installQueueElement, updateQueueElement } from './utils'
import { sendFrontendMessage } from '../ipc'
import { callAbortController } from 'backend/utils/aborthandler/aborthandler'
import { notify } from '../dialog/dialog'
import i18next from 'i18next'
import { createRedistDMQueueElement } from 'backend/storeManagers/gog/redist'
import { existsSync } from 'fs'
import { gogRedistPath } from 'backend/storeManagers/gog/constants'
import { onConnectivityChange } from 'backend/online_monitor'
import { GlobalConfig } from 'backend/config'
import { SteamQueueWatcher } from 'backend/storeManagers/steam/queueWatcher'

const downloadManager = new TypeCheckedStoreBackend('downloadManager', {
  cwd: 'store',
  name: 'download-manager'
})

async function emitQueueUpdate() {
  const info = await getQueueInformation()
  sendFrontendMessage('changedDMQueueInformation', info.elements, info.state, info.finished)
}

SteamQueueWatcher.setOnQueueChanged(async () => {
  await emitQueueUpdate()
})

/*
#### Private ####
*/

let queueState: DownloadManagerState = 'idle'
let currentElement: DMQueueElement | null = null
let autoPaused = false

onConnectivityChange((status) => {
  if (status === 'offline' && isRunning()) {
    logInfo('System offline, auto-pausing downloads', LogPrefix.DownloadManager)
    pauseCurrentDownload()
    autoPaused = true
  } else if (status === 'online' && autoPaused) {
    logInfo('System online, auto-resuming downloads', LogPrefix.DownloadManager)
    autoPaused = false
    void resumeCurrentDownload()
  }
})

function getFirstQueueElement() {
  const elements = downloadManager.get('queue', [])
  return elements.at(0) ?? null
}

function isPaused(): boolean {
  return queueState === 'paused'
}

function isIdle(): boolean {
  return queueState === 'idle'
}

function isRunning(): boolean {
  return queueState === 'running'
}

function addToFinished(element: DMQueueElement, status: DMStatus) {
  const elements = downloadManager.get('finished', [])

  const elementIndex = elements.findIndex(
    (el) => el.params.appName === element.params.appName
  )

  if (elementIndex >= 0) {
    elements[elementIndex] = { ...element, status: status ?? 'abort' }
  } else {
    elements.push({ ...element, status })
  }

  downloadManager.set('finished', elements)
  logInfo(
    [element.params.appName, 'added to download manager finished.'],
    LogPrefix.DownloadManager
  )
}

/*
#### Public ####
*/

async function initQueue() {
  SteamQueueWatcher.startWatcher()
  let element = getFirstQueueElement()

  while (element) {
    if (element.params.runner === 'steam') {
      await removeFromQueue(element.params.appName)
      element = getFirstQueueElement()
      continue
    }

    if (element.type === 'update' && !GlobalConfig.get().getSettings().autoUpdateGames) {
      logInfo(
        `Skipping auto-update for ${element.params.gameInfo?.title || element.params.appName} because auto-updates are disabled`,
        LogPrefix.DownloadManager
      )
      await removeFromQueue(element.params.appName)
      element = getFirstQueueElement()
      continue
    }

    const queuedElements = downloadManager.get('queue', [])
    element.startTime = Date.now()
    queuedElements[0] = element
    downloadManager.set('queue', queuedElements)

    currentElement = element

    queueState = 'running'
    await emitQueueUpdate()

    const { status } =
      element.type === 'install'
        ? await installQueueElement(element.params)
        : await updateQueueElement(element.params)
    element.endTime = Date.now()

    processNotification(element, status)

    if (!isPaused()) {
      addToFinished(element, status)
      await removeFromQueue(element.params.appName)
      element = getFirstQueueElement()
    } else {
      element = null
    }
  }

  if (queueState !== 'paused') {
    queueState = 'idle'
    currentElement = null
  }
  await emitQueueUpdate()
}

async function addToQueue(element: DMQueueElement) {
  if (!element) {
    logError(
      'Can not add undefined element to queue!',
      LogPrefix.DownloadManager
    )
    return
  }

  sendGameStatusUpdate({
    appName: element.params.appName,
    runner: element.params.runner,
    folder: element.params.path,
    status: 'queued'
  })

  const elements = downloadManager.get('queue', [])

  const elementIndex = elements.findIndex(
    (el) =>
      el.params.appName === element.params.appName &&
      el.params.runner === element.params.runner
  )

  if (elementIndex >= 0) {
    elements[elementIndex] = element
  } else {
    const gameInfo = libraryManagerMap[element.params.runner].getGameInfo(
      element.params.appName
    )
    if (!gameInfo?.isEAManaged && !gameInfo?.isUbisoftManaged) {
      const installInfo = await libraryManagerMap[
        element.params.runner
      ].getInstallInfo(
        element.params.appName,
        element.params.platformToInstall,
        {
          branch: element.params.branch,
          build: element.params.build
        }
      )

      element.params.size = installInfo?.manifest?.download_size
        ? getFileSize(installInfo?.manifest?.download_size)
        : '?? MB'

      if (
        element.params.runner === 'gog' &&
        element.params.platformToInstall.toLowerCase() === 'windows' &&
        installInfo &&
        installInfo.manifest &&
        'dependencies' in installInfo.manifest
      ) {
        const newDependencies = installInfo.manifest.dependencies || []
        if (newDependencies?.length || !existsSync(gogRedistPath)) {
          // create redist element
          const redistElement = createRedistDMQueueElement()
          redistElement.params.dependencies = newDependencies
          elements.push(redistElement)
        }
      }
    } else {
      element.params.size = '?? MB'
    }
    elements.push(element)
  }

  downloadManager.set('queue', elements)
  logInfo(
    [element.params.gameInfo.title, ' was added to the download queue.'],
    LogPrefix.DownloadManager
  )

  await emitQueueUpdate()

  if (isIdle()) {
    void initQueue()
  }
}

async function removeFromQueue(appName: string) {
  if (appName) {
    if (downloadManager.has('queue')) {
      const elements = downloadManager.get('queue', [])
      const index = elements.findIndex(
        (queueElement) => queueElement?.params.appName === appName
      )
      if (index !== -1) {
        elements.splice(index, 1)
        downloadManager.delete('queue')
        downloadManager.set('queue', elements)
      }
    }

    SteamQueueWatcher.dismissApp(appName)

    sendGameStatusUpdate({
      appName,
      status: 'done'
    })

    logInfo(
      [appName, 'removed from download manager.'],
      LogPrefix.DownloadManager
    )

    await emitQueueUpdate()
  }
}

async function removeFromFinished(appName: string) {
  if (!appName) return
  const finished = downloadManager.get('finished', [])
  const filtered = finished.filter((f) => f.params?.appName !== appName)
  if (filtered.length !== finished.length) {
    downloadManager.set('finished', filtered)
  }
}

async function getQueueInformation(): Promise<DMQueue> {
  const elements = downloadManager.get('queue', [])
  const finished = downloadManager.get('finished', [])
  const finishedAppNames = new Set(finished.map((f) => f.params.appName))

  try {
    SteamQueueWatcher.startWatcherIfNeeded()
    const steamState = await SteamQueueWatcher.getSteamDownloadState()

    // 1. Determine active element
    let activeElement: DMQueueElement | null = null

    if (currentElement && queueState !== 'idle' && currentElement.params.runner !== 'steam') {
      activeElement = currentElement
    } else if (
      steamState.active &&
      !SteamQueueWatcher.isDismissed(steamState.active.params.appName)
    ) {
      activeElement = steamState.active
    } else if (elements.length > 0 && queueState === 'running') {
      activeElement = elements[0]
    }

    // Determine state
    const isSteamPaused = Boolean(
      (steamState.active &&
        steamState.rawActive &&
        steamState.rawActive.isPaused) ||
      (steamState.active &&
        SteamQueueWatcher.isUserPaused(steamState.active.params.appName))
    )
    const effectiveState: DownloadManagerState =
      queueState === 'paused' || isSteamPaused
        ? 'paused'
        : activeElement
        ? 'running'
        : 'idle'

    // 2. Gather candidates for queue (all non-active elements)
    const activeAppName = activeElement?.params.appName

    // Heroic queue items (excluding active and finished)
    const heroicQueueCandidates = elements.filter(
      (el) => el.params.appName !== activeAppName && !finishedAppNames.has(el.params.appName)
    )

    // Steam queue items (excluding active and dismissed)
    const steamQueueCandidates: DMQueueElement[] = []

    if (
      steamState.active &&
      steamState.active.params.appName !== activeAppName &&
      !SteamQueueWatcher.isDismissed(steamState.active.params.appName)
    ) {
      steamQueueCandidates.push(steamState.active)
    }

    for (const sq of steamState.queue) {
      if (
        sq.params.appName !== activeAppName &&
        !SteamQueueWatcher.isDismissed(sq.params.appName)
      ) {
        steamQueueCandidates.push(sq)
      }
    }

    // 3. Strict deduplication of queue items by appName
    const dedupedQueue: DMQueueElement[] = []
    const seenAppNames = new Set<string>()
    if (activeAppName) {
      seenAppNames.add(activeAppName)
    }

    for (const item of [...heroicQueueCandidates, ...steamQueueCandidates]) {
      const id = item.params.appName
      if (!seenAppNames.has(id)) {
        seenAppNames.add(id)
        dedupedQueue.push(item)
      }
    }

    const allElements = activeElement
      ? [activeElement, ...dedupedQueue]
      : dedupedQueue

    return {
      elements: allElements,
      finished,
      state: effectiveState
    }
  } catch (err) {
    logWarning(['Failed to scan Steam download state:', err], LogPrefix.DownloadManager)
    return { elements, finished, state: queueState }
  }
}

async function cancelCurrentDownload({ removeDownloaded = false }) {
  if (currentElement && currentElement.params.runner !== 'steam') {
    if (Array.isArray(currentElement.params.installDlcs)) {
      const dlcsToRemove = currentElement.params.installDlcs
      for (const dlc of dlcsToRemove) {
        await removeFromQueue(dlc)
      }
    }
    if (isRunning()) {
      stopCurrentDownload()
    }
    await removeFromQueue(currentElement.params.appName)

    if (removeDownloaded) {
      const { runner, appName } = currentElement.params
      const { folder_name } = libraryManagerMap[runner]
        .getGame(appName)
        .getGameInfo()
      if (folder_name) {
        removeFolder(currentElement.params.path, folder_name)
      }
    }
    currentElement = null
  } else {
    try {
      const steamState = await SteamQueueWatcher.getSteamDownloadState()
      const steamAppId =
        currentElement?.params?.runner === 'steam'
          ? currentElement.params.appName
          : steamState.active?.params?.appName
      if (steamAppId) {
        SteamQueueWatcher.dismissApp(steamAppId)
      }
    } catch {}
    currentElement = null
  }

  queueState = 'idle'
  await emitQueueUpdate()
}

async function pauseCurrentDownload() {
  queueState = 'paused'
  autoPaused = false

  if (currentElement && currentElement.params.runner !== 'steam') {
    stopCurrentDownload()
  } else {
    try {
      const steamState = await SteamQueueWatcher.getSteamDownloadState()
      const steamAppId =
        currentElement?.params?.runner === 'steam'
          ? currentElement.params.appName
          : steamState.active?.params?.appName
      if (steamAppId) {
        await SteamQueueWatcher.pauseApp(steamAppId)
      }
    } catch {}
  }

  await emitQueueUpdate()
}

async function resumeCurrentDownload() {
  queueState = 'running'
  autoPaused = false

  if (currentElement && currentElement.params.runner !== 'steam') {
    void initQueue()
  } else {
    try {
      const steamState = await SteamQueueWatcher.getSteamDownloadState()
      const steamAppId =
        currentElement?.params?.runner === 'steam'
          ? currentElement.params.appName
          : steamState.active?.params?.appName

      if (steamAppId) {
        await SteamQueueWatcher.resumeApp(steamAppId)
      } else {
        void initQueue()
      }
    } catch {
      void initQueue()
    }
  }

  await emitQueueUpdate()
}

function stopCurrentDownload() {
  const { appName, runner } = currentElement!.params
  callAbortController(appName)
  libraryManagerMap[runner].getGame(appName).stop(false)
}

// notify the user based on the status of the element and the status of the queue
function processNotification(element: DMQueueElement, status: DMStatus) {
  const action = element.type === 'install' ? 'Installation' : 'Update'
  if (
    element.params.runner === 'gog' &&
    element.params.appName === 'gog-redist'
  ) {
    return
  }
  const { title } = libraryManagerMap[element.params.runner]
    .getGame(element.params.appName)
    .getGameInfo()

  if (status === 'abort') {
    if (isPaused()) {
      logWarning(
        [action, 'of', element.params.appName, 'paused!'],
        LogPrefix.DownloadManager
      )
      // i18next.t('notify.update.paused', 'Update Paused')
      // i18next.t('notify.install.paused', 'Installation Paused')
      notify({ title, body: i18next.t(`notify.${element.type}.paused`) })
    } else {
      logWarning(
        [action, 'of', element.params.appName, 'aborted!'],
        LogPrefix.DownloadManager
      )
      // i18next.t('notify.update.canceled', 'Update Canceled')
      // i18next.t('notify.install.canceled', 'Installation Canceled')
      notify({ title, body: i18next.t(`notify.${element.type}.canceled`) })
    }
  } else if (status === 'error') {
    logWarning(
      [action, 'of', element.params.appName, 'failed!'],
      LogPrefix.DownloadManager
    )
    // i18next.t('notify.update.failed', 'Update Failed')
    // i18next.t('notify.install.failed', 'Installation Failed')
    notify({ title, body: i18next.t(`notify.${element.type}.failed`) })
  } else if (status === 'done') {
    // i18next.t('notify.update.finished', 'Update Finished')
    // i18next.t('notify.install.finished', 'Installation Finished')
    notify({
      title,
      body: i18next.t(`notify.${element.type}.finished`)
    })

    logInfo(
      ['Finished', action, 'of', element.params.appName],
      LogPrefix.DownloadManager
    )
  }
}

async function clearAutoUpdatesFromQueue() {
  const elements = downloadManager.get('queue', [])
  const filtered = elements.filter((el) => el.type !== 'update')
  downloadManager.set('queue', filtered)

  if (currentElement && currentElement.type === 'update') {
    logInfo('Stopping active auto-update as autoUpdateGames was disabled', LogPrefix.DownloadManager)
    await cancelCurrentDownload({ removeDownloaded: false })
  }

  await emitQueueUpdate()
  logInfo(`Cleared auto-updates from queue. Remaining elements: ${filtered.length}`, LogPrefix.DownloadManager)
}

export {
  initQueue,
  addToQueue,
  removeFromQueue,
  removeFromFinished,
  addToFinished,
  getQueueInformation,
  cancelCurrentDownload,
  pauseCurrentDownload,
  resumeCurrentDownload,
  clearAutoUpdatesFromQueue,
  isRunning,
  emitQueueUpdate
}
