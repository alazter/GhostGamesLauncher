import { GameInfo } from 'common/types'

export const STORE_NAME_MAP: Record<string, string> = {
  legendary: 'Epic Games',
  epic: 'Epic Games',
  gog: 'GOG',
  nile: 'Amazon Games',
  amazon: 'Amazon Games',
  steam: 'Steam',
  zoom: 'Zoom Platform'
}

export function syncAutoStoreCategories(
  games: GameInfo[],
  currentCustomCategories: Record<string, string[]>,
  updateCustomCategories: (updatedCategories: Record<string, string[]>) => void,
  defaultRunner?: string
) {
  if (!games || !games.length || !currentCustomCategories || !updateCustomCategories) return

  // Clone existing categories map
  const updatedCategories: Record<string, string[]> = {}
  Object.keys(currentCustomCategories).forEach((cat) => {
    updatedCategories[cat] = [...(currentCustomCategories[cat] || [])]
  })

  let hasChanges = false

  games.forEach((game) => {
    const rawAppName = game.app_name || (game as any).appName || (game as any).app_title
    if (!rawAppName) return

    const runner = String(game.runner || defaultRunner || 'legendary')
    if (!STORE_NAME_MAP[runner]) return

    const storeCategoryName = STORE_NAME_MAP[runner]

    // Create normalized alias keys
    const keysToAdd: string[] = [`${rawAppName}_${runner}`]
    if (runner === 'legendary' || runner === 'epic') {
      keysToAdd.push(`${rawAppName}_legendary`, `${rawAppName}_epic`)
    } else if (runner === 'nile' || runner === 'amazon') {
      keysToAdd.push(`${rawAppName}_nile`, `${rawAppName}_amazon`)
    } else if (runner === 'gog') {
      keysToAdd.push(`${rawAppName}_gog`)
    } else if (runner === 'steam') {
      keysToAdd.push(`${rawAppName}_steam`)
    } else if (runner === 'zoom') {
      keysToAdd.push(`${rawAppName}_zoom`)
    }

    // 1. Ensure category array exists
    if (!updatedCategories[storeCategoryName]) {
      updatedCategories[storeCategoryName] = []
      hasChanges = true
    }

    // 2. Ensure all keys are in category array
    keysToAdd.forEach((key) => {
      if (!updatedCategories[storeCategoryName].includes(key)) {
        updatedCategories[storeCategoryName].push(key)
        hasChanges = true
      }
    })
  })

  if (hasChanges) {
    updateCustomCategories(updatedCategories)
  }
}
