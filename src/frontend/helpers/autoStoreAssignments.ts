import { GameInfo } from 'common/types'
import { AccountProvider } from 'common/types/connectedAccounts'
import { ensureConnectedAccountCustomStore } from 'frontend/helpers/connectedAccountStores'

export function syncAutoStoreAssignments(
  epicGames: GameInfo[] = [],
  gogGames: GameInfo[] = [],
  amazonGames: GameInfo[] = [],
  zoomGames: GameInfo[] = [],
  steamGames: GameInfo[] = [],
  accountGames: GameInfo[] = []
) {
  try {
    const rawCustomStores = localStorage.getItem('heroic_custom_stores') || '[]'
    let customStores: Array<{ id: string; name: string }> = []
    try {
      customStores = JSON.parse(rawCustomStores)
    } catch {
      customStores = []
    }

    // Helper to find custom store id by name/alias or fallback
    const findStoreId = (matcher: (name: string, id: string) => boolean, fallback: string): string => {
      const found = customStores.find((s) => {
        const nameLower = (s.name || '').toLowerCase()
        const idLower = (s.id || '').toLowerCase()
        return matcher(nameLower, idLower)
      })
      return found ? found.id : fallback
    }

    const epicStoreId = findStoreId((n, id) => n.includes('epic') || id === 'epic', 'epic')
    const gogStoreId = findStoreId((n, id) => n.includes('gog') || id === 'gog', 'gog')
    const amazonStoreId = findStoreId((n, id) => n.includes('amazon') || id === 'amazon' || id === 'nile', 'amazon')
    const zoomStoreId = findStoreId((n, id) => n.includes('zoom') || id === 'zoom', 'zoom')
    const steamStoreId = findStoreId((n, id) => n.includes('steam') || id === 'steam', 'steam')

    const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
    let currentAssignments: Record<string, string> = {}
    try {
      currentAssignments = JSON.parse(rawAssignments)
    } catch {
      currentAssignments = {}
    }

    let hasChanges = false

    for (const game of accountGames) {
      const provider = (game.accountProvider ||
        (game.app_name?.startsWith('account-') ? game.app_name.split('-')[1] : null)) as AccountProvider | null
      if (!provider) continue

      const storeId = ensureConnectedAccountCustomStore(provider)
      if (currentAssignments[game.app_name] !== storeId) {
        currentAssignments[game.app_name] = storeId
        hasChanges = true
      }
    }

    // Process Epic Games -> epicStoreId
    epicGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== epicStoreId) {
        currentAssignments[appName] = epicStoreId
        hasChanges = true
      }
    })

    // Process GOG Games -> gogStoreId
    gogGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== gogStoreId) {
        currentAssignments[appName] = gogStoreId
        hasChanges = true
      }
    })

    // Process Amazon Games -> amazonStoreId
    amazonGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== amazonStoreId) {
        currentAssignments[appName] = amazonStoreId
        hasChanges = true
      }
    })

    // Process Zoom Games -> zoomStoreId
    zoomGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== zoomStoreId) {
        currentAssignments[appName] = zoomStoreId
        hasChanges = true
      }
    })

    // Process Steam Games -> steamStoreId
    steamGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== steamStoreId) {
        currentAssignments[appName] = steamStoreId
        hasChanges = true
      }
    })

    if (hasChanges) {
      localStorage.setItem('heroic_game_assignments', JSON.stringify(currentAssignments))
      window.dispatchEvent(new Event('gameAssignmentsChanged'))
      window.dispatchEvent(new StorageEvent('storage', { key: 'heroic_game_assignments' }))
    }

    // Also sync Piratas store assignments for SteamRIP, AnkerGames and Online-Fix
    void syncPiratasStoreAssignments()
  } catch (e) {
    console.error('Error syncing auto store assignments:', e)
  }
}

export const DEFAULT_DOWNLOAD_STORE_KEY = 'ghost_default_download_store_id'

export function findPiratasStoreId(): string {
  try {
    const rawCustomStores = localStorage.getItem('heroic_custom_stores') || '[]'
    const customStores: Array<{ id: string; name: string }> = JSON.parse(rawCustomStores)
    const found = customStores.find((s) => {
      const nameLower = (s.name || '').toLowerCase()
      const idLower = (s.id || '').toLowerCase()
      return nameLower.includes('pirata') || idLower === 'piratas'
    })
    return found ? found.id : (customStores[0]?.id || 'piratas')
  } catch {
    return 'piratas'
  }
}

export function getDefaultDownloadStoreId(): string {
  try {
    const saved = localStorage.getItem(DEFAULT_DOWNLOAD_STORE_KEY)
    if (saved) return saved
    return findPiratasStoreId()
  } catch {
    return findPiratasStoreId()
  }
}

export function setDefaultDownloadStoreId(storeId: string): void {
  try {
    localStorage.setItem(DEFAULT_DOWNLOAD_STORE_KEY, storeId)
    window.dispatchEvent(new Event('defaultDownloadStoreChanged'))
    window.dispatchEvent(new Event('gameAssignmentsChanged'))
  } catch (e) {
    console.error('Error setting default download store id:', e)
  }
}

export function assignGameToDefaultStore(appName: string): boolean {
  if (!appName) return false
  try {
    const targetStoreId = getDefaultDownloadStoreId()
    const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
    let currentAssignments: Record<string, string> = {}
    try {
      currentAssignments = JSON.parse(rawAssignments)
    } catch {
      currentAssignments = {}
    }

    if (currentAssignments[appName] !== targetStoreId) {
      currentAssignments[appName] = targetStoreId
      localStorage.setItem('heroic_game_assignments', JSON.stringify(currentAssignments))
      window.dispatchEvent(new Event('gameAssignmentsChanged'))
      return true
    }
  } catch (e) {
    console.error('Error assigning game to default store:', e)
  }
  return false
}

export function assignGameToPiratasStore(appName: string): boolean {
  return assignGameToDefaultStore(appName)
}

export async function syncPiratasStoreAssignments(): Promise<void> {
  try {
    if (!window.api?.externalGamesState) return
    const state = await window.api.externalGamesState()
    if (!state?.installations?.length) return

    // Exclusive sources allowed for default external games store
    const piratasSources = ['anker', 'steamrip', 'online-fix', 'ankergames']
    const targetStoreId = getDefaultDownloadStoreId()
    const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
    let currentAssignments: Record<string, string> = {}
    try {
      currentAssignments = JSON.parse(rawAssignments)
    } catch {
      currentAssignments = {}
    }

    let hasChanges = false
    for (const inst of state.installations) {
      const isEligible = piratasSources.some(
        (s) =>
          (inst.game?.providerId || '').toLowerCase().includes(s) ||
          (inst.game?.providerName || '').toLowerCase().includes(s)
      )
      if (isEligible && inst.appName && currentAssignments[inst.appName] !== targetStoreId) {
        currentAssignments[inst.appName] = targetStoreId
        hasChanges = true
      }
    }

    if (hasChanges) {
      localStorage.setItem('heroic_game_assignments', JSON.stringify(currentAssignments))
      window.dispatchEvent(new Event('gameAssignmentsChanged'))
    }
  } catch (e) {
    console.error('Error syncing default store assignments:', e)
  }
}

