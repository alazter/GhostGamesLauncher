import { create } from 'zustand'

export type RemovalType = 'deleting' | 'removing'

interface RemovingGamesState {
  removingGames: Record<string, RemovalType>
  startRemoval: (appName: string, type: RemovalType) => void
  finishRemoval: (appName: string) => void
  isGameRemoving: (appName: string) => RemovalType | undefined
}

export const useRemovingGamesStore = create<RemovingGamesState>((set, get) => ({
  removingGames: {},

  startRemoval: (appName: string, type: RemovalType) => {
    if (!appName) return
    set((state) => ({
      removingGames: {
        ...state.removingGames,
        [appName]: type
      }
    }))
  },

  finishRemoval: (appName: string) => {
    if (!appName) return
    set((state) => {
      const copy = { ...state.removingGames }
      delete copy[appName]
      return { removingGames: copy }
    })
  },

  isGameRemoving: (appName: string) => {
    if (!appName) return undefined
    return get().removingGames[appName]
  }
}))
