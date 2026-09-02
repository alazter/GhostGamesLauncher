import { GameInfo, Runner } from 'common/types'
import { configStore, timestampStore } from './electronStores'

export interface NewGameTrackerEntry {
  addedAt: number
  played: boolean
}

export type NewGamesMap = Record<string, NewGameTrackerEntry>

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// In-Memory RAM Caches (0ms, Zero Synchronous IPC)
let newGamesMemoryCache: NewGamesMap | null = null
const playtimeMemoryCache = new Map<string, number>()

export const getNewGamesMap = (): NewGamesMap => {
  if (newGamesMemoryCache !== null) {
    return newGamesMemoryCache
  }
  try {
    const gamesObj = configStore.get('games', {
      recent: [],
      hidden: [],
      favourites: [],
      customCategories: {}
    })
    newGamesMemoryCache = (gamesObj as any)?.newTracker || {}
    return newGamesMemoryCache!
  } catch {
    newGamesMemoryCache = {}
    return newGamesMemoryCache
  }
}

export const syncNewGamesTracker = (allGames: GameInfo[]): NewGamesMap => {
  if (!allGames || allGames.length === 0) return getNewGamesMap()

  const currentMap: NewGamesMap = { ...getNewGamesMap() }
  const isInitialBaseline = Object.keys(currentMap).length === 0

  let hasChanges = false
  const now = Date.now()

  for (const game of allGames) {
    const key = `${game.app_name}_${game.runner || 'sideload'}`
    if (!currentMap[key] && !currentMap[game.app_name]) {
      hasChanges = true
      if (isInitialBaseline) {
        // Marcação inicial de baseline para não acender os 590 jogos já existentes
        currentMap[key] = {
          addedAt: 0,
          played: true
        }
      } else {
        // Jogo realmente adicionado após o baseline inicial
        currentMap[key] = {
          addedAt: now,
          played: false
        }
      }
    }
  }

  if (hasChanges) {
    newGamesMemoryCache = currentMap
    const gamesObj = configStore.get('games', {
      recent: [],
      hidden: [],
      favourites: [],
      customCategories: {}
    })
    ;(configStore as any).set('games', { ...gamesObj, newTracker: currentMap })
    window.dispatchEvent(
      new CustomEvent('heroicNewGamesChanged', { detail: currentMap })
    )
  }

  return currentMap
}

export const markGameAsPlayed = (appName: string, runner: Runner) => {
  const currentMap: NewGamesMap = { ...getNewGamesMap() }
  const key = `${appName}_${runner}`

  const entry = currentMap[key] || currentMap[appName]
  if (entry && !entry.played) {
    currentMap[key] = {
      ...entry,
      played: true
    }
    if (currentMap[appName]) {
      currentMap[appName] = {
        ...currentMap[appName],
        played: true
      }
    }
    newGamesMemoryCache = currentMap
    const gamesObj = configStore.get('games', {
      recent: [],
      hidden: [],
      favourites: [],
      customCategories: {}
    })
    ;(configStore as any).set('games', { ...gamesObj, newTracker: currentMap })
    window.dispatchEvent(
      new CustomEvent('heroicNewGamesChanged', { detail: currentMap })
    )
  }
}

export const isGameNew = (
  appName: string,
  runner: Runner,
  tracker?: NewGamesMap
): boolean => {
  const map = tracker || getNewGamesMap()
  const key = `${appName}_${runner}`
  const entry = map[key] || map[appName]

  if (!entry) return false
  if (entry.played) return false
  if (entry.addedAt <= 0) return false

  return Date.now() - entry.addedAt < SEVEN_DAYS_MS
}

export const getGamePlaytime = (appName: string): number => {
  if (playtimeMemoryCache.has(appName)) {
    return playtimeMemoryCache.get(appName)!
  }
  try {
    const tsInfo = timestampStore.get_nodefault(appName as any) as
      | { totalPlayed?: number }
      | undefined
    const played = tsInfo?.totalPlayed || 0
    playtimeMemoryCache.set(appName, played)
    return played
  } catch {
    playtimeMemoryCache.set(appName, 0)
    return 0
  }
}

export const sortGamesByPlaytime = (games: GameInfo[]): GameInfo[] => {
  // Precarrega todos os tempos em 1 passada síncrona/cacheada em RAM
  for (const game of games) {
    if (!playtimeMemoryCache.has(game.app_name)) {
      try {
        const tsInfo = timestampStore.get_nodefault(game.app_name as any) as
          | { totalPlayed?: number }
          | undefined
        playtimeMemoryCache.set(game.app_name, tsInfo?.totalPlayed || 0)
      } catch {
        playtimeMemoryCache.set(game.app_name, 0)
      }
    }
  }

  return [...games].sort((a, b) => {
    const timeA = playtimeMemoryCache.get(a.app_name) || 0
    const timeB = playtimeMemoryCache.get(b.app_name) || 0
    if (timeA !== timeB) {
      return timeB - timeA // Maior tempo de jogo primeiro
    }
    return a.title.localeCompare(b.title)
  })
}

export const sortGamesByNewest = (
  games: GameInfo[],
  tracker?: NewGamesMap
): GameInfo[] => {
  const map = tracker || getNewGamesMap()
  return [...games].sort((a, b) => {
    const keyA = `${a.app_name}_${a.runner || 'sideload'}`
    const keyB = `${b.app_name}_${b.runner || 'sideload'}`
    const entryA = map[keyA] || map[a.app_name]
    const entryB = map[keyB] || map[b.app_name]
    const timeA = entryA?.addedAt || 0
    const timeB = entryB?.addedAt || 0
    if (timeA !== timeB) {
      return timeB - timeA // Mais novo primeiro
    }
    return a.title.localeCompare(b.title)
  })
}

export const getNewestGamesPrioritized = (
  allGames: GameInfo[],
  tracker?: NewGamesMap
): { newGames: GameInfo[]; otherGames: GameInfo[] } => {
  const map = tracker || getNewGamesMap()
  const newGames: GameInfo[] = []
  const otherGames: GameInfo[] = []

  for (const game of allGames) {
    if (isGameNew(game.app_name, game.runner, map)) {
      newGames.push(game)
    } else {
      otherGames.push(game)
    }
  }

  return {
    newGames: sortGamesByNewest(newGames, map),
    otherGames
  }
}
