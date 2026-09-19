import { GameInfo } from 'common/types'

export function syncAutoStoreAssignments(
  epicGames: GameInfo[] = [],
  gogGames: GameInfo[] = [],
  amazonGames: GameInfo[] = [],
  zoomGames: GameInfo[] = [],
  steamGames: GameInfo[] = []
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
    }

    // Also sync Piratas store assignments for SteamRIP, AnkerGames and Online-Fix
    void syncPiratasStoreAssignments()
  } catch (e) {
    console.error('Error syncing auto store assignments:', e)
  }
}

export function findPiratasStoreId(): string {
  try {
    const rawCustomStores = localStorage.getItem('heroic_custom_stores') || '[]'
    const customStores: Array<{ id: string; name: string }> = JSON.parse(rawCustomStores)
    const found = customStores.find((s) => {
      const nameLower = (s.name || '').toLowerCase()
      const idLower = (s.id || '').toLowerCase()
      return nameLower.includes('pirata') || idLower === 'piratas'
    })
    return found ? found.id : 'piratas'
  } catch {
    return 'piratas'
  }
}

export function assignGameToPiratasStore(appName: string): boolean {
  if (!appName) return false
  try {
    const piratasStoreId = findPiratasStoreId()
    const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
    let currentAssignments: Record<string, string> = {}
    try {
      currentAssignments = JSON.parse(rawAssignments)
    } catch {
      currentAssignments = {}
    }

    if (currentAssignments[appName] !== piratasStoreId) {
      currentAssignments[appName] = piratasStoreId
      localStorage.setItem('heroic_game_assignments', JSON.stringify(currentAssignments))
      window.dispatchEvent(new Event('gameAssignmentsChanged'))
      return true
    }
  } catch (e) {
    console.error('Error assigning game to Piratas store:', e)
  }
  return false
}

export async function syncPiratasStoreAssignments(): Promise<void> {
  try {
    if (!window.api?.externalGamesState) return
    const state = await window.api.externalGamesState()
    if (!state?.installations?.length) return

    // Exclusive sources allowed for Piratas store
    const piratasSources = ['anker', 'steamrip', 'online-fix', 'ankergames']
    const piratasStoreId = findPiratasStoreId()
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
      if (isEligible && inst.appName && currentAssignments[inst.appName] !== piratasStoreId) {
        currentAssignments[inst.appName] = piratasStoreId
        hasChanges = true
      }
    }

    if (hasChanges) {
      localStorage.setItem('heroic_game_assignments', JSON.stringify(currentAssignments))
      window.dispatchEvent(new Event('gameAssignmentsChanged'))
    }
  } catch (e) {
    console.error('Error syncing Piratas store assignments:', e)
  }
}

