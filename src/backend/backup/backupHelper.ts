import { configStore, tsStore } from '../constants/key_value_stores'
import { libraryStore } from '../storeManagers/sideload/electronStores'
import { libraryStore as steamLibraryStore } from '../storeManagers/steam/electronStores'
import { gameOverridesStore } from '../game_overrides/electronStores'
import { getBlacklist } from '../storeManagers/sideload/scanner'
import { userDataPath } from '../constants/paths'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync, lstatSync } from 'graceful-fs'

export async function getBackupPayload(): Promise<any> {
  const settings = (configStore.get_nodefault('settings') || {}) as any
  
  let coversBackup = null
  try {
    const backupPath = join(userDataPath, 'store', 'covers-backup.json')
    if (existsSync(backupPath)) {
      coversBackup = JSON.parse(readFileSync(backupPath, 'utf8'))
    }
  } catch {}

  let externalGamesBackup: any = null
  try {
    const { ExternalGames } = await import('../plugins/externalGames')
    const externalGamesInstance = ExternalGames.getInstance()
    const externalState = externalGamesInstance.snapshot()

    const backupsDir = join(userDataPath, 'external-games', 'backups')
    const snapshotPacks: Array<{
      backupId: string
      files: Array<{ relativePath: string; contentBase64: string; bytes: number }>
    }> = []

    if (existsSync(backupsDir)) {
      const backupFolders = readdirSync(backupsDir)
      for (const folder of backupFolders) {
        const folderPath = join(backupsDir, folder)
        try {
          if (lstatSync(folderPath).isDirectory()) {
            const filesInFolder: Array<{
              relativePath: string
              contentBase64: string
              bytes: number
            }> = []
            const readDirRecursive = (currentDir: string, relativePrefix = '') => {
              const items = readdirSync(currentDir)
              for (const item of items) {
                const fullPath = join(currentDir, item)
                const rel = relativePrefix ? `${relativePrefix}/${item}` : item
                const stat = lstatSync(fullPath)
                if (stat.isDirectory()) {
                  readDirRecursive(fullPath, rel)
                } else if (stat.isFile()) {
                  if (stat.size <= 50 * 1024 * 1024) {
                    const contentBase64 = readFileSync(fullPath).toString('base64')
                    filesInFolder.push({
                      relativePath: rel,
                      contentBase64,
                      bytes: stat.size
                    })
                  }
                }
              }
            }
            readDirRecursive(folderPath)
            snapshotPacks.push({ backupId: folder, files: filesInFolder })
          }
        } catch {
          // Ignora erro em pasta individual
        }
      }
    }

    externalGamesBackup = {
      state: externalState,
      snapshots: snapshotPacks
    }
  } catch {
    // Ignora se módulo de plugins não estiver disponível
  }

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
    localStorageData: settings.localStorageBackup || {},
    externalGames: externalGamesBackup
  }
}

