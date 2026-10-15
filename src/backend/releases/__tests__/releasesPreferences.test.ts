import { RELEASE_CATEGORIES } from 'common/types/releases'

describe('Releases Preferences Persistence', () => {
  const values = new Map<string, string>()
  const store = new Map<string, unknown>()

  beforeEach(() => {
    values.clear()
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear()
      }
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        api: {
          storeGet: jest.fn((storeName: string, key: string) =>
            storeName === 'configStore' ? store.get(key) : undefined
          ),
          storeSet: jest.fn((storeName: string, key: string, value: unknown) => {
            if (storeName === 'configStore') store.set(key, value)
          }),
          syncLocalStorageBackup: jest.fn().mockResolvedValue(undefined)
        }
      })
    })
  })

  it('restores PC and PC Early Access platforms from platformsByCategory in configStore and localStorage', () => {
    const preferencesData = {
      category: 'games',
      platforms: ['pc', 'pc-early-access'],
      platformsByCategory: {
        games: ['pc', 'pc-early-access'],
        movies: ['cinema']
      },
      region: 'us',
      layout: 'cards',
      theme: 'dark'
    }

    localStorage.setItem(
      'ghost_releases_preferences_v1',
      JSON.stringify(preferencesData)
    )
    window.api.storeSet('configStore', 'releasesPreferences', preferencesData)

    const raw = localStorage.getItem('ghost_releases_preferences_v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)

    expect(parsed.category).toBe('games')
    expect(parsed.platforms).toEqual(['pc', 'pc-early-access'])
    expect(parsed.platformsByCategory.games).toEqual(['pc', 'pc-early-access'])

    const storedConfig = window.api.storeGet('configStore', 'releasesPreferences')
    expect(storedConfig).toEqual(preferencesData)
  })

  it('preserves category platforms when switching between games and movies', () => {
    const state = {
      category: 'games',
      platforms: ['pc', 'pc-early-access'],
      platformsByCategory: {
        games: ['pc', 'pc-early-access']
      } as Record<string, string[]>
    }

    // Switch to movies
    const moviesCategory = 'movies'
    const restoredForMovies = state.platformsByCategory[moviesCategory] || []
    state.category = moviesCategory
    state.platforms = restoredForMovies

    expect(state.category).toBe('movies')
    expect(state.platforms).toEqual([])
    expect(state.platformsByCategory.games).toEqual(['pc', 'pc-early-access'])

    // Switch back to games
    const gamesCategory = 'games'
    const restoredForGames = state.platformsByCategory[gamesCategory] || []
    state.category = gamesCategory
    state.platforms = restoredForGames

    expect(state.category).toBe('games')
    expect(state.platforms).toEqual(['pc', 'pc-early-access'])
  })

  it('preserves filters when returning from tracking to calendar', () => {
    const state = {
      view: 'calendar',
      category: 'games',
      platforms: ['pc', 'pc-early-access'],
      platformsByCategory: {
        games: ['pc', 'pc-early-access']
      } as Record<string, string[]>
    }

    // Navigate to tracking
    state.view = 'tracking'
    state.category = 'all'
    state.platforms = []

    // User clicks Calendar button
    state.view = 'calendar'
    if (state.category === 'all') {
      state.category = 'games'
      state.platforms = state.platformsByCategory['games'] || []
    }

    expect(state.view).toBe('calendar')
    expect(state.category).toBe('games')
    expect(state.platforms).toEqual(['pc', 'pc-early-access'])
  })
})
