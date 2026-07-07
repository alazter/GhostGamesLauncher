import { configStore, tsStore } from '../constants/key_value_stores'
import { libraryStore } from '../storeManagers/sideload/electronStores'
import { gameOverridesStore } from '../game_overrides/electronStores'
import { getBlacklist } from '../storeManagers/sideload/scanner'

export async function getBackupPayload(): Promise<any> {
  const settings = (configStore.get_nodefault('settings') || {}) as any
  
  // Exclude sensitive or temporary keys if any, though settings is generally fine
  return {
    version: '0.0.8-alpha',
    exportedAt: new Date().toISOString(),
    settings,
    windowProps: configStore.get_nodefault('window-props') || {},
    zoomPercent: configStore.get('zoomPercent', 100),
    sideloadedGames: libraryStore.get('games', []),
    gameOverrides: gameOverridesStore.get('overrides', {}),
    blacklist: await getBlacklist(),
    playtimes: tsStore.raw_store || {},
    // Get the synced localStorage data saved under settings
    localStorageData: settings.localStorageBackup || {}
  }
}
