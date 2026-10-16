import { GameInfo } from 'common/types'
import { CustomStore } from 'frontend/types'
import { isGameAssignedToStore } from './customStoreFiltering'

export interface SoftwareStoreEntry {
  appName: string
  title: string
  executablePath: string
  iconUrl: string
  storeId: string
  storeName: string
}

const EXECUTABLE_OR_SCRIPT_REGEX = /\.(exe|bat|cmd|ps1|sh|appimage|py|vbs)$/i

export function normalizeExecutablePathComparison(p: string): string {
  return (p || '').trim().replace(/\\/g, '/').toLowerCase()
}

export function resolveGameExecutablePath(game: GameInfo): string {
  if (!game) return ''
  const rawExe = (game.install?.executable || '').trim()
  const rawInstallPath = (game.install?.install_path || '').trim()

  if (rawExe) {
    const isAbsoluteWin = /^[a-zA-Z]:[\\/]/.test(rawExe) || rawExe.startsWith('\\\\')
    const isAbsoluteUnix = rawExe.startsWith('/')
    if (isAbsoluteWin || isAbsoluteUnix || !rawInstallPath) {
      return rawExe
    }

    const cleanInstall = rawInstallPath.replace(/[\\/]+$/, '')
    const cleanExe = rawExe.replace(/^[\\/]+/, '')
    if (cleanInstall.toLowerCase().endsWith(cleanExe.toLowerCase())) {
      return rawInstallPath
    }
    const sep = rawInstallPath.includes('\\') ? '\\' : '/'
    return `${cleanInstall}${sep}${cleanExe}`
  }

  if (rawInstallPath && EXECUTABLE_OR_SCRIPT_REGEX.test(rawInstallPath)) {
    return rawInstallPath
  }

  return ''
}

export function findPrimarySoftwareStore(
  customStores: CustomStore[]
): CustomStore | undefined {
  if (!Array.isArray(customStores) || customStores.length === 0) return undefined

  const exactMatch = customStores.find((s) => {
    const n = (s.name || '').trim().toLowerCase()
    const id = (s.id || '').trim().toLowerCase()
    return n === 'softwares' || n === 'software' || id === 'softwares' || id === 'software'
  })
  if (exactMatch) return exactMatch

  return customStores.find((s) => {
    const n = (s.name || '').toLowerCase()
    const id = (s.id || '').toLowerCase()
    return n.includes('software') || id.includes('software') || n.includes('programa') || n.includes('app')
  })
}

export function resolveStoreForGame(
  game: GameInfo,
  customStores: CustomStore[],
  assignments: Record<string, string>
): { storeId: string; storeName: string } {
  const matched = customStores.find((store) =>
    isGameAssignedToStore(game, store, assignments)
  )
  if (matched) {
    return { storeId: matched.id, storeName: matched.name }
  }

  const rawAssigned = (assignments[game.app_name] || '').trim()
  if (rawAssigned) {
    const byIdOrName = customStores.find(
      (s) =>
        s.id.toLowerCase() === rawAssigned.toLowerCase() ||
        s.name.toLowerCase() === rawAssigned.toLowerCase()
    )
    if (byIdOrName) {
      return { storeId: byIdOrName.id, storeName: byIdOrName.name }
    }
    if (rawAssigned.toLowerCase().includes('software')) {
      return { storeId: 'softwares', storeName: 'Softwares' }
    }
    return { storeId: rawAssigned, storeName: rawAssigned }
  }

  return { storeId: game.runner || 'sideload', storeName: 'Biblioteca Local' }
}

export interface GetSoftwareStoreItemsParams {
  allGames: GameInfo[]
  customStores: CustomStore[]
  assignments: Record<string, string>
  storeFilter?: string
  searchQuery?: string
  excludeAppName?: string
}

export function getSoftwareStoreItems({
  allGames,
  customStores,
  assignments,
  storeFilter = 'softwares',
  searchQuery = '',
  excludeAppName = ''
}: GetSoftwareStoreItemsParams): SoftwareStoreEntry[] {
  if (!Array.isArray(allGames) || allGames.length === 0) return []

  const primarySoftwareStore = findPrimarySoftwareStore(customStores)
  const effectiveFilter = (storeFilter || 'softwares').trim().toLowerCase()
  const cleanSearch = (searchQuery || '').trim().toLowerCase()

  const seenPaths = new Set<string>()
  const entries: SoftwareStoreEntry[] = []

  for (const game of allGames) {
    if (!game || !game.app_name) continue
    if (excludeAppName && game.app_name === excludeAppName) continue

    const executablePath = resolveGameExecutablePath(game)
    if (!executablePath) continue

    const assignedRaw = (assignments[game.app_name] || '').trim().toLowerCase()
    const isSoftwareStoreMatch =
      (primarySoftwareStore &&
        isGameAssignedToStore(game, primarySoftwareStore, assignments)) ||
      assignedRaw === 'softwares' ||
      assignedRaw === 'software' ||
      assignedRaw.includes('software')

    if (
      effectiveFilter === 'softwares' ||
      (primarySoftwareStore &&
        effectiveFilter === primarySoftwareStore.id.toLowerCase())
    ) {
      if (!isSoftwareStoreMatch) continue
    } else if (effectiveFilter !== 'all') {
      const targetStore = customStores.find(
        (s) =>
          s.id.toLowerCase() === effectiveFilter ||
          s.name.toLowerCase() === effectiveFilter
      )
      if (targetStore) {
        if (!isGameAssignedToStore(game, targetStore, assignments)) continue
      } else if (assignedRaw !== effectiveFilter) {
        continue
      }
    }

    const title = (game.title || game.app_name).trim()
    if (
      cleanSearch &&
      !title.toLowerCase().includes(cleanSearch) &&
      !executablePath.toLowerCase().includes(cleanSearch)
    ) {
      continue
    }

    const normPath = normalizeExecutablePathComparison(executablePath)
    if (seenPaths.has(normPath)) continue
    seenPaths.add(normPath)

    const storeMeta = isSoftwareStoreMatch
      ? {
          storeId: primarySoftwareStore?.id || 'softwares',
          storeName: primarySoftwareStore?.name || 'Softwares'
        }
      : resolveStoreForGame(game, customStores, assignments)

    entries.push({
      appName: game.app_name,
      title,
      executablePath,
      iconUrl: game.art_square || game.art_cover || game.art_icon || '',
      storeId: storeMeta.storeId,
      storeName: storeMeta.storeName
    })
  }

  return entries.sort((a, b) => {
    const aIsSoft = a.storeName.toLowerCase().includes('software') ? 0 : 1
    const bIsSoft = b.storeName.toLowerCase().includes('software') ? 0 : 1
    if (aIsSoft !== bIsSoft) return aIsSoft - bIsSoft
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  })
}

export function findMatchingSoftwareByPath(
  scriptPath: string,
  entries: SoftwareStoreEntry[]
): SoftwareStoreEntry | undefined {
  const normTarget = normalizeExecutablePathComparison(scriptPath)
  if (!normTarget) return undefined
  return entries.find(
    (entry) =>
      normalizeExecutablePathComparison(entry.executablePath) === normTarget
  )
}
