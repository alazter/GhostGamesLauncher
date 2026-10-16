import { Notification } from 'electron'
import { addHandler, sendFrontendMessage } from 'backend/ipc'
import { getMainWindow } from 'backend/main_window'
import { ensurePermanentAppIcon } from 'backend/constants/paths'
import { getReleaseCatalog, getReleaseDetails } from './catalog'
import { getReleaseDrm } from './drm'

export function registerReleasesIPC() {
  addHandler('releasesCatalog', (_event, query) => getReleaseCatalog(query))
  addHandler('releasesDrm', (_event, query) => getReleaseDrm(query))
  addHandler('releasesDrmVerifyHiz', async () =>
    (await import('./drmManual')).verifyHizAccess()
  )
  addHandler('releasesDrmEndManual', async () =>
    (await import('./drmManual')).endManualDrm()
  )
  addHandler('releasesProduct', (_event, id, region, collector) =>
    getReleaseDetails(id, region, collector)
  )

  let notifiedDay = ''
  const notified = new Set<string>()
  addHandler('releasesNotifyToday', async (_event, entries) => {
    if (!Array.isArray(entries) || !Notification.isSupported()) return
    const today = new Date().toLocaleDateString('en-CA')
    if (today !== notifiedDay) {
      notified.clear()
      notifiedDay = today
    }
    const fresh = entries.slice(0, 500).filter((entry) => {
      if (
        !entry ||
        typeof entry.id !== 'string' ||
        typeof entry.title !== 'string'
      )
        return false
      if (
        !entry.id ||
        entry.id.length > 400 ||
        !entry.title ||
        entry.title.length > 500
      )
        return false
      return !notified.has(entry.id)
    })
    if (!fresh.length) return
    const names = [...new Set(fresh.map((entry) => entry.title))]
    const notification = new Notification({
      title: 'Ghost • Lançamentos de hoje',
      body:
        names.length === 1
          ? `${names[0]} tem lançamento hoje.`
          : `${names.length} títulos acompanhados têm lançamento hoje: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}`,
      icon: ensurePermanentAppIcon()
    })
    notification.on('click', () => {
      const mainWindow = getMainWindow()
      if (mainWindow?.isMinimized()) mainWindow.restore()
      mainWindow?.show()
      mainWindow?.focus()
      sendFrontendMessage('openScreen', '/releases?view=tracking')
    })
    notification.show()
    fresh.forEach((entry) => notified.add(entry.id))
  })
}
