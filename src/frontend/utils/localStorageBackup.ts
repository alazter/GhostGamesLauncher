export function syncLocalStorageToBackend() {
  try {
    const localStorageData: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('heroic_')) {
        const val = localStorage.getItem(key)
        if (val !== null) {
          localStorageData[key] = val
        }
      }
    }
    // Save under the default app settings config store
    window.api.setSetting({
      appName: 'default',
      key: 'localStorageBackup' as any,
      value: localStorageData
    })
  } catch (err) {
    console.error('Failed to sync localStorage to backend:', err)
  }
}
