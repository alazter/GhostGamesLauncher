import {
  LEGACY_RELEASE_TRACKING_KEYS,
  RELEASE_TRACKING_KEY,
  RELEASE_TRACKING_RECOVERY_KEY,
  restoreReleaseTrackingBackup
} from 'frontend/helpers/releaseTracking'

const isBackupKey = (key: string) =>
  key.startsWith('heroic_') ||
  [
    RELEASE_TRACKING_KEY,
    RELEASE_TRACKING_RECOVERY_KEY,
    ...LEGACY_RELEASE_TRACKING_KEYS,
    'ghost_releases_region',
    'ghost_releases_lang',
    'ghost_releases_view',
    'ghost_releases_preferences_v1',
    'ghost_alazterflix_card_preferences',
    'ghost_alazterflix_favorites',
    'ghost_alazterflix_cover_size',
    'ghost_alazterflix_cover_sizes'
  ].includes(key)

export function collectLocalStorageBackup(): Record<string, string> {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isBackupKey(key)) continue
    const value = localStorage.getItem(key)
    if (value !== null) data[key] = value
  }
  return data
}

let pending: Promise<void> = Promise.resolve()
/** Resolve only after the main process confirms the snapshot was written. */
export function syncLocalStorageToBackend(): Promise<void> {
  const data = collectLocalStorageBackup()
  pending = pending
    .catch(() => undefined)
    .then(() => window.api.syncLocalStorageBackup(data))
  return pending
}

export async function restoreLocalStorageBackup(
  data: Record<string, string>
): Promise<void> {
  restoreReleaseTrackingBackup(data)
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value !== 'string' ||
      key === RELEASE_TRACKING_KEY ||
      LEGACY_RELEASE_TRACKING_KEYS.some((legacy) => legacy === key)
    )
      continue
    if (key === RELEASE_TRACKING_RECOVERY_KEY) {
      const previous = localStorage.getItem(key)
      if (previous !== value)
        localStorage.setItem(key, previous ? `${previous}\n${value}` : value)
    } else if (isBackupKey(key)) localStorage.setItem(key, value)
  }
  await syncLocalStorageToBackend()
  window.dispatchEvent(new Event('heroicSettingsChanged'))
  window.dispatchEvent(new Event('customBgChanged'))
  window.dispatchEvent(new Event('ghostReleaseTrackingChanged'))
}
