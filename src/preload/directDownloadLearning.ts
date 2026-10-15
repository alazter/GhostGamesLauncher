// eslint-disable-next-line no-restricted-imports -- Dedicated sandbox preload; this channel is never exposed to page scripts.
import { ipcRenderer } from 'electron'
import { DIRECT_LEARNING_CLICK, DIRECT_LEARNING_MODE, describeDownloadAction } from '../common/directDownloadLearning'

// Dedicated sandboxed preload: never expose IPC or launcher APIs to the page.
let enabled = false
ipcRenderer.on(DIRECT_LEARNING_MODE, (_event, value: unknown) => { enabled = value === true })
window.addEventListener('click', event => {
  if (!enabled || !event.isTrusted || event.button !== 0 || !(event.target instanceof Element) || window.top !== window) return
  const node = event.target.closest('a, button, input[type="submit"], input[type="button"]')
  if (!node) return
  const action = describeDownloadAction(node)
  if (action) ipcRenderer.send(DIRECT_LEARNING_CLICK, { page: location.origin + location.pathname, action })
}, true)
