import { GameInfo } from 'common/types'

export function syncAutoStoreAssignments(
  epicGames: GameInfo[] = [],
  gogGames: GameInfo[] = [],
  amazonGames: GameInfo[] = [],
  zoomGames: GameInfo[] = []
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

    if (hasChanges) {
      localStorage.setItem('heroic_game_assignments', JSON.stringify(currentAssignments))
      window.dispatchEvent(new Event('gameAssignmentsChanged'))
    }
  } catch (e) {
    console.error('Error syncing auto store assignments:', e)
  }
}

