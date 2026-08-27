import { GameInfo } from 'common/types'
import { CustomStore, StoresFilters } from 'frontend/types'

export function isGameAssignedToStore(
  game: GameInfo,
  targetStore: { id: string; name: string },
  assignments: Record<string, string>
): boolean {
  if (!game || !targetStore) return false
  const explicitlyAssignedStore = (assignments[game.app_name] || '').toLowerCase()
  const targetIdLower = (targetStore.id || '').toLowerCase()
  const targetNameLower = (targetStore.name || '').toLowerCase()
  const runnerLower = (game.runner || '').toLowerCase()

  if (explicitlyAssignedStore) {
    if (explicitlyAssignedStore === targetIdLower) return true
    if (targetNameLower && explicitlyAssignedStore === targetNameLower) return true
  }

  // Epic Games
  if (
    targetIdLower === 'epic' ||
    targetIdLower === 'legendary' ||
    targetNameLower.includes('epic')
  ) {
    if (
      explicitlyAssignedStore === 'epic' ||
      explicitlyAssignedStore === 'legendary' ||
      explicitlyAssignedStore === 'epic games' ||
      runnerLower === 'legendary' ||
      runnerLower === 'epic'
    ) {
      return true
    }
  }

  // GOG
  if (targetIdLower === 'gog' || targetNameLower.includes('gog')) {
    if (explicitlyAssignedStore === 'gog' || runnerLower === 'gog') {
      return true
    }
  }

  // Amazon Games
  if (
    targetIdLower === 'amazon' ||
    targetIdLower === 'nile' ||
    targetNameLower.includes('amazon')
  ) {
    if (
      explicitlyAssignedStore === 'amazon' ||
      explicitlyAssignedStore === 'nile' ||
      explicitlyAssignedStore === 'amazon games' ||
      runnerLower === 'nile' ||
      runnerLower === 'amazon'
    ) {
      return true
    }
  }

  // Steam
  if (targetIdLower === 'steam' || targetNameLower.includes('steam')) {
    if (explicitlyAssignedStore === 'steam' || runnerLower === 'steam') {
      return true
    }
  }

  // Zoom
  if (targetIdLower === 'zoom' || targetNameLower.includes('zoom')) {
    if (explicitlyAssignedStore === 'zoom' || runnerLower === 'zoom') {
      return true
    }
  }

  // Sideload / Piratas / Indies
  if (
    targetIdLower === 'sideload' ||
    targetIdLower === 'sideloaded' ||
    targetNameLower.includes('sideload') ||
    targetNameLower.includes('pirata') ||
    targetNameLower.includes('indie')
  ) {
    if (
      explicitlyAssignedStore === targetIdLower ||
      explicitlyAssignedStore === 'sideload' ||
      explicitlyAssignedStore === 'sideloaded' ||
      explicitlyAssignedStore === 'piratas' ||
      explicitlyAssignedStore === 'indies' ||
      runnerLower === 'sideload' ||
      runnerLower === 'sideloaded'
    ) {
      return true
    }
  }

  return false
}

export function isGameVisibleInAllGames(
  game: GameInfo,
  customStores: CustomStore[],
  assignments: Record<string, string>,
  storesFilters: StoresFilters
): boolean {
  if (!storesFilters) return true

  // Find matching custom store
  const matchedStore = customStores.find((store) =>
    isGameAssignedToStore(game, store, assignments)
  )

  if (matchedStore) {
    // If the custom store is explicitly set to false, hide the game from All Games
    if (storesFilters[matchedStore.id] === false) return false

    // Also check standard runner alias filters if present
    const storeNameLower = matchedStore.name.toLowerCase()
    const storeIdLower = matchedStore.id.toLowerCase()
    if (
      (storeIdLower === 'epic' || storeNameLower.includes('epic')) &&
      storesFilters['legendary'] === false
    ) {
      return false
    }
    if (
      (storeIdLower === 'gog' || storeNameLower.includes('gog')) &&
      storesFilters['gog'] === false
    ) {
      return false
    }
    if (
      (storeIdLower === 'amazon' || storeNameLower.includes('amazon')) &&
      storesFilters['nile'] === false
    ) {
      return false
    }
    if (
      (storeIdLower === 'zoom' || storeNameLower.includes('zoom')) &&
      storesFilters['zoom'] === false
    ) {
      return false
    }
    if (
      (storeIdLower === 'steam' || storeNameLower.includes('steam')) &&
      storesFilters['steam'] === false
    ) {
      return false
    }
    if (
      (storeIdLower === 'sideload' ||
        storeNameLower.includes('sideload') ||
        storeNameLower.includes('pirata') ||
        storeNameLower.includes('indie')) &&
      storesFilters['sideload'] === false
    ) {
      return false
    }

    return true
  }

  // Fallback check by runner if not matched to any custom store
  const runner = (game.runner || '').toLowerCase()
  if (
    (runner === 'legendary' || runner === 'epic') &&
    storesFilters['legendary'] === false
  ) {
    return false
  }
  if (runner === 'gog' && storesFilters['gog'] === false) {
    return false
  }
  if (
    (runner === 'nile' || runner === 'amazon') &&
    storesFilters['nile'] === false
  ) {
    return false
  }
  if (runner === 'zoom' && storesFilters['zoom'] === false) {
    return false
  }
  if (runner === 'steam' && storesFilters['steam'] === false) {
    return false
  }
  if (
    (runner === 'sideload' || runner === 'sideloaded') &&
    storesFilters['sideload'] === false
  ) {
    return false
  }

  return true
}
