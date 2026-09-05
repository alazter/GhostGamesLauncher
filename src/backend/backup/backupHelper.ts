import { configStore, tsStore } from '../constants/key_value_stores'
import { libraryStore } from '../storeManagers/sideload/electronStores'
import { libraryStore as steamLibraryStore } from '../storeManagers/steam/electronStores'
import { gameOverridesStore } from '../game_overrides/electronStores'
import { getBlacklist } from '../storeManagers/sideload/scanner'
import { userDataPath } from '../constants/paths'
import { join } from 'path'
import { existsSync, readFileSync } from 'graceful-fs'

export async function getBackupPayload(): Promise<any> {
  const settings = (configStore.get_nodefault('settings') || {}) as any
  
  let coversBackup = null
  try {
    const backupPath = join(userDataPath, 'store', 'covers-backup.json')
    if (existsSync(backupPath)) {
      coversBackup = JSON.parse(readFileSync(backupPath, 'utf8'))
    }
  } catch {}

  // Exclude sensitive or temporary keys if any, though settings is generally fine
  return {
    version: '0.0.8-alpha',
    exportedAt: new Date().toISOString(),
    settings,
    windowProps: configStore.get_nodefault('window-props') || {},
    zoomPercent: configStore.get('zoomPercent', 100),
    sideloadedGames: libraryStore.get('games', []),
    steamGames: steamLibraryStore.get('games', []),
    gameOverrides: gameOverridesStore.get('overrides', {}),
    coversBackup,
    blacklist: await getBlacklist(),
    playtimes: tsStore.raw_store || {},
    // Get the synced localStorage data saved under settings
    localStorageData: settings.localStorageBackup || {}
  }
}

