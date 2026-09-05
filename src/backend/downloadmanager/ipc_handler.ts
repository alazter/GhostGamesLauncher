import { addHandler, addListener } from '../ipc'
import {
  addToQueue,
  cancelCurrentDownload,
  clearAutoUpdatesFromQueue,
  getQueueInformation,
  pauseCurrentDownload,
  removeFromQueue,
  resumeCurrentDownload
} from './downloadqueue'

import type { DMQueueElement } from 'common/types'

addHandler('install', async (_e, args) => {
  const dmQueueElement: DMQueueElement = {
    params: args,
    type: 'install',
    addToQueueTime: Date.now(),
    endTime: 0,
    startTime: 0
  }

  await addToQueue(dmQueueElement)

  // Add Dlcs to the queue
  if (
    Array.isArray(args.installDlcs) &&
    args.installDlcs.length > 0 &&
    args.runner === 'legendary'
  ) {
    for (const dlc of args.installDlcs) {
      const dlcQueueElement: DMQueueElement = {
        params: {
          ...args,
          appName: dlc
        },
        type: 'install',
        addToQueueTime: Date.now(),
        endTime: 0,
        startTime: 0
      }
      await addToQueue(dlcQueueElement)
    }
  }
})

addHandler('updateGame', async (_e, args) => {
  const platform = args.gameInfo?.install?.platform || 'Windows'
  const install_path = args.gameInfo?.install?.install_path || ''

  const dmQueueElement: DMQueueElement = {
    params: { ...args, path: install_path, platformToInstall: platform },
    type: 'update',
    addToQueueTime: Date.now(),
    endTime: 0,
    startTime: 0
  }

  await addToQueue(dmQueueElement)
})

addListener('removeFromDMQueue', (e, appName) => removeFromQueue(appName))
addListener('resumeCurrentDownload', () => resumeCurrentDownload())
addListener('pauseCurrentDownload', () => pauseCurrentDownload())
addListener('cancelDownload', (e, removeDownloaded) =>
  cancelCurrentDownload({ removeDownloaded })
)
addListener('clearAutoUpdates', () => clearAutoUpdatesFromQueue())
addHandler('getDMQueueInformation', getQueueInformation)
