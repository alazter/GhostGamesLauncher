import { configStore, tsStore } from '../constants/key_value_stores'
import { libraryStore } from '../storeManagers/sideload/electronStores'
import { libraryStore as steamLibraryStore } from '../storeManagers/steam/electronStores'
import { gameOverridesStore } from '../game_overrides/electronStores'
import { getBlacklist } from '../storeManagers/sideload/scanner'
import { userDataPath } from '../constants/paths'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync, lstatSync } from 'graceful-fs'
import { getReleaseArchive } from '../releases/archive'
import {
  collectGhostIptvBackupData,
  GhostIptvBackupData
} from './ghostIptvBackup'
import { getGhostIptvAddonsFallbackPaths } from '../plugins/ghostIptvServer'

export async function getBackupPayload(): Promise<any> {
  const settings = (configStore.get_nodefault('settings') || {}) as any
  
  let coversBackup = null
  try {
    const backupPath = join(userDataPath, 'store', 'covers-backup.json')
    if (existsSync(backupPath)) {
      coversBackup = JSON.parse(readFileSync(backupPath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
  } catch {}

  let externalGamesBackup: any = null
  try {
    const { ExternalGames } = await import('../plugins/externalGames')
    const externalGamesInstance = ExternalGames.getInstance()
    await externalGamesInstance.ensureMissingSavesBackedUp()
    const externalState = externalGamesInstance.snapshot()

    const backupsDir = join(userDataPath, 'external-games', 'backups')
    const snapshotPacks: Array<{
      backupId: string
      files: Array<{ relativePath: string; contentBase64: string; bytes: number }>
    }> = []

    if (existsSync(backupsDir)) {
      const diskFolders = new Set(readdirSync(backupsDir))
      const knownBackupIds = new Set<string>()
      const latestByInstallation = new Map<string, { id: string; createdAtMs: number }>()

      if (Array.isArray(externalState?.backups)) {
        for (const entry of externalState.backups) {
          if (!entry?.id) continue
          knownBackupIds.add(entry.id)
          if (!diskFolders.has(entry.id)) continue
          const instKey = entry.installationId || entry.id
          const createdAtMs = Date.parse(entry.createdAt || '') || 0
          const prev = latestByInstallation.get(instKey)
          if (!prev || createdAtMs >= prev.createdAtMs) {
            latestByInstallation.set(instKey, { id: entry.id, createdAtMs })
          }
        }
      }

      // Prioriza apenas o snapshot mais recente de cada jogo + pastas órfãs ordenadas por data,
      // evitando empacotar dezenas de cópias antigas do mesmo jogo e estourar o limite de string do V8 (RangeError).
      const selectedFolders: Array<{ folder: string; sortTime: number }> = Array.from(
        latestByInstallation.values()
      ).map((item) => ({ folder: item.id, sortTime: item.createdAtMs }))

      for (const folder of diskFolders) {
        if (knownBackupIds.has(folder)) continue
        try {
          const st = lstatSync(join(backupsDir, folder))
          if (st.isDirectory()) {
            selectedFolders.push({ folder, sortTime: st.mtimeMs || 0 })
          }
        } catch {}
      }

      selectedFolders.sort((a, b) => b.sortTime - a.sortTime)

      const maxFileBytes = 5 * 1024 * 1024 // 5 MB por arquivo individual
      const maxFolderBytes = 10 * 1024 * 1024 // 10 MB por pasta de jogo
      const maxTotalSnapshotBytes = 64 * 1024 * 1024 // 64 MB globais (~85 MB Base64) para nunca estourar V8 JSON.stringify
      let totalSnapshotBytes = 0

      for (const { folder } of selectedFolders) {
        if (totalSnapshotBytes >= maxTotalSnapshotBytes) break
        const folderPath = join(backupsDir, folder)
        try {
          if (lstatSync(folderPath).isDirectory()) {
            const filesInFolder: Array<{
              relativePath: string
              contentBase64: string
              bytes: number
            }> = []
            let folderBytes = 0

            const readDirRecursive = (currentDir: string, relativePrefix = '') => {
              const items = readdirSync(currentDir)
              for (const item of items) {
                if (folderBytes >= maxFolderBytes || totalSnapshotBytes >= maxTotalSnapshotBytes) {
                  break
                }
                const fullPath = join(currentDir, item)
                const rel = relativePrefix ? `${relativePrefix}/${item}` : item
                const stat = lstatSync(fullPath)
                if (stat.isDirectory()) {
                  readDirRecursive(fullPath, rel)
                } else if (stat.isFile()) {
                  const lower = item.toLowerCase()
                  // Do not embed huge logs, crash dumps or caches into cloud JSON payload
                  if (lower.endsWith('.log') || lower.endsWith('.dmp') || lower.endsWith('.tmp') || lower.includes('cache')) {
                    continue
                  }
                  if (
                    stat.size <= maxFileBytes &&
                    folderBytes + stat.size <= maxFolderBytes &&
                    totalSnapshotBytes + stat.size <= maxTotalSnapshotBytes
                  ) {
                    const contentBase64 = readFileSync(fullPath).toString('base64')
                    folderBytes += stat.size
                    totalSnapshotBytes += stat.size
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
            if (filesInFolder.length > 0) {
              snapshotPacks.push({ backupId: folder, files: filesInFolder })
            }
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

  // Dados de Plugins (Alazterflix playback_history, filmes assistidos, catálogo, addons Stremio e IPTV)
  const pluginsData: Record<string, any> = {}
  try {
    const pluginsDataDir = join(userDataPath, 'plugins_data')
    if (existsSync(pluginsDataDir)) {
      const files = readdirSync(pluginsDataDir)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const fullPath = join(pluginsDataDir, file)
        try {
          const stat = lstatSync(fullPath)
          if (stat.isFile() && stat.size <= 25 * 1024 * 1024) {
            const raw = readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '').trim()
            if (raw) {
              pluginsData[file.slice(0, -5)] = JSON.parse(raw)
            }
          }
        } catch {}
      }
    }
  } catch {}

  // Fontes & Listas Cadastradas do Ghost IPTV (dentro do Alazterflix):
  // Regra condicional automática: só inclui no backup se TANTO o plugin Alazterflix QUANTO o addon Ghost IPTV
  // estiverem instalados E houver pelo menos 1 fonte/lista cadastrada pelo usuário; caso contrário, ignora.
  let ghostIptvSources: GhostIptvBackupData | undefined
  try {
    ghostIptvSources = collectGhostIptvBackupData({
      userDataPath,
      extraAddonsCandidatePaths: getGhostIptvAddonsFallbackPaths(),
      pluginsData
    })
  } catch {}

  let pluginsState: any = null
  try {
    const statePath = join(userDataPath, 'plugins_state.json')
    if (existsSync(statePath)) {
      pluginsState = JSON.parse(readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
  } catch {}

  let sourceEnginesState: any = null
  try {
    const enginesStatePath = join(userDataPath, 'source-engines', 'state.json')
    if (existsSync(enginesStatePath)) {
      sourceEnginesState = JSON.parse(readFileSync(enginesStatePath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
  } catch {}

  let sourceSettings: any = null
  try {
    const sourceSettingsPath = join(userDataPath, 'source-settings.json')
    if (existsSync(sourceSettingsPath)) {
      sourceSettings = JSON.parse(readFileSync(sourceSettingsPath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
  } catch {}

  // Dados da Biblioteca Stremio (Filmes/Séries Salvos, Assistidos, Progresso, Contagem de Visualizações e Calendário)
  const stremioData: {
    library?: any
    calendarCache?: any
    account?: any
    cinemaDownloadDirectories?: any
  } = {}
  try {
    const stremioDir = join(userDataPath, 'stremio_data')
    const libPath = join(stremioDir, 'stremio_library.json')
    if (existsSync(libPath)) {
      stremioData.library = JSON.parse(readFileSync(libPath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
    const calPath = join(stremioDir, 'stremio_calendar_cache.json')
    if (existsSync(calPath)) {
      stremioData.calendarCache = JSON.parse(readFileSync(calPath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
    const accPath = join(stremioDir, 'stremio_account.json')
    if (existsSync(accPath)) {
      stremioData.account = JSON.parse(readFileSync(accPath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
    const dlDirsPath = join(userDataPath, 'cinema_download_directories.json')
    if (existsSync(dlDirsPath)) {
      stremioData.cinemaDownloadDirectories = JSON.parse(readFileSync(dlDirsPath, 'utf8').replace(/^\uFEFF/, '').trim())
    }
  } catch {}

  // Se Alazterflix + Ghost IPTV não estiverem instalados ou não houver fontes/listas,
  // remove chaves de listas IPTV do snapshot de localStorage para ignorar completamente.
  const rawLocalStorageData: Record<string, string> = {
    ...(settings.localStorageBackup || {})
  }
  if (!ghostIptvSources) {
    delete rawLocalStorageData.ghost_alazterflix_tv_playlists
    delete rawLocalStorageData.ghost_alazterflix_tv_epg_sources
    delete rawLocalStorageData.ghost_alazterflix_tv_favorites
    delete rawLocalStorageData.ghost_alazterflix_tv_epg_assignments
  }

  // Exclude sensitive or temporary keys if any, though settings is generally fine
  const payload: Record<string, any> = {
    version: '0.0.9-alpha',
    exportedAt: new Date().toISOString(),
    settings,
    windowProps: configStore.get_nodefault('window-props') || {},
    zoomPercent: configStore.get('zoomPercent', 100),
    theme: configStore.get('theme', 'midnightMirage'),
    hiddenGames: configStore.get('games.hidden', []),
    favouriteGames: configStore.get('games.favourites', []),
    customCategories: configStore.get('games.customCategories', {}),
    recentGames: configStore.get('games.recent', []),
    sideloadedGames: libraryStore.get('games', []),
    steamGames: steamLibraryStore.get('games', []),
    gameOverrides: gameOverridesStore.get('overrides', {}),
    coversBackup,
    blacklist: await getBlacklist(),
    playtimes: tsStore.raw_store || {},
    // Get the synced localStorage data saved under settings
    localStorageData: rawLocalStorageData,
    releaseArchive: await (await getReleaseArchive()).export(),
    externalGames: externalGamesBackup,
    pluginsData,
    pluginsState,
    sourceEnginesState,
    sourceSettings,
    stremioData
  }

  if (ghostIptvSources) {
    payload.ghostIptvSources = ghostIptvSources
    payload.ghostIptvAddons = ghostIptvSources.addons
  }

  return payload
}

