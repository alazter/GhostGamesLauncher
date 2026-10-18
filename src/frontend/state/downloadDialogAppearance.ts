import { useSyncExternalStore } from 'react'

export type DownloadDialogLayout = 'compact' | 'cover'
export const downloadDialogLayoutKey = 'ghost_download_dialog_layout'

export function readDownloadDialogLayout(): DownloadDialogLayout {
  const value = window.localStorage.getItem(downloadDialogLayoutKey)
  return value === 'cover' ? 'cover' : 'compact'
}

export function setDownloadDialogLayout(layout: DownloadDialogLayout) {
  window.localStorage.setItem(downloadDialogLayoutKey, layout)
  window.dispatchEvent(new Event('heroicSettingsChanged'))
}

function subscribe(changed: () => void) {
  window.addEventListener('storage', changed)
  window.addEventListener('heroicSettingsChanged', changed)
  return () => {
    window.removeEventListener('storage', changed)
    window.removeEventListener('heroicSettingsChanged', changed)
  }
}

export function useDownloadDialogLayout(): DownloadDialogLayout {
  return useSyncExternalStore(
    subscribe,
    readDownloadDialogLayout,
    () => 'compact'
  )
}
