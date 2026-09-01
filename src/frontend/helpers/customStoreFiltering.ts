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

export const KNOWN_TEST_APP_IDS = new Set<string>([
  '4809930', // WARDOGS Playtest
  '3401450', // Arkheron Playtest
  '623990', // Rainbow Six Siege - Test Server
  '774941', // Squad - Public Testing
  '1472130', // Thunder Tier One Playtest
  '1611740', // BattleBit Remastered Playtest
  '1619990', // SUPER PEOPLE Testing Grounds
  '1887240', // World War 3 Playtest
  '2076040', // THE FINALS PLAYTEST
  '2427520', // ARC Raiders Playtest
  '2452260', // Dungeonborne Playtest
  '2943730', // FragPunk Playtest
  '3154560', // Apogea Playtest
  '3352190', // Prologue: Go Wayback! Playtest
  '3404800', // Chrono Odyssey Playtest
  '3723740', // Red Recon: 1944 Playtest
  '3780860', // Hell Let Loose Vietnam: Playtest
  '3816060', // Black Vultures: Prey of Greed Playtest
  '3830120', // Drakantos Playtest
  '4105130', // Hordeguard: Winds of the North Playtest
  '4146670', // ReStory Playtest
  '219540', // Arma 2: Operation Arrowhead Beta (Obsolete)
  '1015520', // Cardinal Preview
  '1478540', // Bless Unleashed - Beta Test
  '2075730', // Call of Duty MW II - Open Beta
  '2383950', // Anvil Empires Pre-Alpha
  '2429660', // Throne and Liberty - Open Beta
  '2709440', // Delta Force Alpha Test
  '3081410', // Battlefield 6 Open Beta
  '3145170', // Splitgate 2 - Alpha
  '3504830', // Wildgate Community Preview
  '912290' // Miscreated: Experimental Server
])

export function isPlaytestOrDemo(game: GameInfo): boolean {
  if (!game) return false
  const appName = String(game.app_name || '')
  if (KNOWN_TEST_APP_IDS.has(appName)) return true

  const titleLower = (game.title || '').toLowerCase()
  if (
    titleLower.includes('playtest') ||
    titleLower.includes('test server') ||
    titleLower.includes('public testing') ||
    titleLower.includes('testing grounds') ||
    titleLower.includes('open beta') ||
    titleLower.includes('closed beta') ||
    titleLower.includes('beta test') ||
    titleLower.includes('alpha test') ||
    titleLower.includes('pre-alpha') ||
    titleLower.includes('tech demo') ||
    titleLower.includes('free demo') ||
    titleLower.endsWith(' demo') ||
    titleLower.includes(' demo ') ||
    titleLower.includes('experimental server')
  ) {
    return true
  }

  return false
}
