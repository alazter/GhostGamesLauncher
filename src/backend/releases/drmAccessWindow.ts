import type { BrowserWindow } from 'electron'

/** Explicit user action: make the verification window identifiable and visible. */
export function showDrmAccessWindow(window: BrowserWindow, title: string) {
  window.webContents.on('page-title-updated', (event) => event.preventDefault())
  window.setTitle(title)
  window.center()
  window.setAlwaysOnTop(true)
  window.show()
  window.focus()
  window.moveTop()
  const timer = setTimeout(() => {
    if (!window.isDestroyed()) window.setAlwaysOnTop(false)
  }, 2000)
  timer.unref()
  window.on('closed', () => clearTimeout(timer))
}
