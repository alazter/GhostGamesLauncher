import { GameInfo } from 'common/types'

export function syncAutoStoreAssignments(
  epicGames: GameInfo[] = [],
  gogGames: GameInfo[] = [],
  amazonGames: GameInfo[] = []
) {
  try {
    const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
    let currentAssignments: Record<string, string> = {}
    try {
      currentAssignments = JSON.parse(rawAssignments)
    } catch {
      currentAssignments = {}
    }

    let hasChanges = false

    // Process Epic Games -> 'epic'
    epicGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== 'epic') {
        currentAssignments[appName] = 'epic'
        hasChanges = true
      }
    })

    // Process GOG Games -> 'gog'
    gogGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== 'gog') {
        currentAssignments[appName] = 'gog'
        hasChanges = true
      }
    })

    // Process Amazon Games -> 'amazon'
    amazonGames.forEach((game) => {
      const appName = game.app_name || (game as any).appName
      if (appName && currentAssignments[appName] !== 'amazon') {
        currentAssignments[appName] = 'amazon'
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
