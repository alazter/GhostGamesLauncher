import vm from 'node:vm'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { GhostMovie } from 'common/types/plugins'
import { groupMoviesIntoShows } from 'common/mediaCatalog'
import { mediaTmdbRating } from '../../../frontend/screens/Alazterflix/cardPreferences'

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value))

function item(path: string, extra: Partial<GhostMovie> = {}): GhostMovie {
  return {
    id: path,
    title: 'Example',
    cleanTitle: 'Example',
    filePath: path,
    fileName: path.split(/[\\/]/).pop()!,
    fileSize: '1 GB',
    fileSizeBytes: 100,
    addedAt: '2026-01-01',
    source: 'local',
    ...extra
  }
}

function harness(initial: GhostMovie[] = []) {
  const storage: Record<string, any> = {
    movies: clone(initial),
    metadata_settings: { autoFetch: false }
  }
  let provider: any
  const context = vm.createContext({
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    Date,
    ghost: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      storage: {
        get: async (key: string) => clone(storage[key]),
        set: async (key: string, value: any) => {
          storage[key] = clone(value)
        }
      },
      http: { fetch: jest.fn() },
      ui: { injectCSS: jest.fn() },
      media: {
        registerMediaProvider: (registered: any) => {
          provider = registered
        },
        artworkExists: async () => true,
        scanFolder: jest.fn(),
        saveArtwork: jest.fn()
      }
    }
  })

  vm.runInContext(
    readFileSync(resolve('plugins/alazterflix/index.js'), 'utf8'),
    context
  )

  return {
    provider,
    storage
  }
}

describe('Alazterflix Episode Editing and Drawer Sync', () => {
  test('persists episode number and episode name when updating media', async () => {
    const initialMovie = item('D:/Media/Series/Police.Squad.S01E01.mkv', {
      id: 'ep-1',
      title: 'Police Squad S01E01',
      showTitle: 'Police Squad',
      mediaCategory: 'series',
      isSeries: true,
      season: 1,
      episode: 1
    })

    const { provider, storage } = harness([initialMovie])

    const updated = await provider.updateMovie({
      id: 'ep-1',
      title: 'A Volta do Esquadrão',
      showTitle: 'Police Squad - Esquadrão de Polícia',
      season: 1,
      episode: 1,
      mediaCategory: 'series',
      isSeries: true
    })

    expect(updated.title).toBe('A Volta do Esquadrão')
    expect(updated.customTitle).toBe('A Volta do Esquadrão')
    expect(updated.episode).toBe(1)
    expect(updated.season).toBe(1)
    expect(updated.showTitle).toBe('Police Squad - Esquadrão de Polícia')
    expect(updated.isSeries).toBe(true)

    const inStorage = storage.movies.find((m: GhostMovie) => m.id === 'ep-1')
    expect(inStorage.title).toBe('A Volta do Esquadrão')
    expect(inStorage.customTitle).toBe('A Volta do Esquadrão')
    expect(inStorage.episode).toBe(1)
    expect(inStorage.season).toBe(1)
  })

  test('converts standalone movie into series when episode and season are provided', async () => {
    const standaloneMovie = item('D:/Media/Filmes/1917.mkv', {
      id: 'movie-1917',
      title: '1917',
      cleanTitle: '1917',
      mediaCategory: 'movie',
      isSeries: false
    })

    const { provider, storage } = harness([standaloneMovie])

    const updated = await provider.updateMovie({
      id: 'movie-1917',
      title: 'Parte 1 - A Travessia',
      showTitle: '1917 - Minissérie',
      season: 1,
      episode: 1,
      mediaCategory: 'series'
    })

    expect(updated.title).toBe('Parte 1 - A Travessia')
    expect(updated.customTitle).toBe('Parte 1 - A Travessia')
    expect(updated.episode).toBe(1)
    expect(updated.season).toBe(1)
    expect(updated.showTitle).toBe('1917 - Minissérie')
    expect(updated.isSeries).toBe(true)

    const inStorage = storage.movies.find((m: GhostMovie) => m.id === 'movie-1917')
    expect(inStorage.isSeries).toBe(true)
    expect(inStorage.episode).toBe(1)
    expect(inStorage.season).toBe(1)
  })

  test('groupMoviesIntoShows groups edited episodes with correct badges and names for right-side drawer navigation', () => {
    const ep1: GhostMovie = item('D:/Media/Series/PoliceSquad/ep1.mkv', {
      id: 'ps-1',
      title: 'A Volta do Esquadrão',
      customTitle: 'A Volta do Esquadrão',
      showTitle: 'Police Squad',
      mediaCategory: 'series',
      isSeries: true,
      season: 1,
      episode: 1
    })

    const ep2: GhostMovie = item('D:/Media/Series/PoliceSquad/ep2.mkv', {
      id: 'ps-2',
      title: 'Ring of Fear',
      customTitle: 'Ring of Fear',
      showTitle: 'Police Squad',
      mediaCategory: 'series',
      isSeries: true,
      season: 1,
      episode: 2
    })

    const ep3: GhostMovie = item('D:/Media/Series/PoliceSquad/ep3.mkv', {
      id: 'ps-3',
      title: 'The Butler Diddit',
      customTitle: 'The Butler Diddit',
      showTitle: 'Police Squad',
      mediaCategory: 'series',
      isSeries: true,
      season: 1,
      episode: 3
    })

    // Put them in non-sorted order to verify sorting by episode number
    const shows = groupMoviesIntoShows([ep3, ep1, ep2])
    expect(shows).toHaveLength(1)

    const show = shows[0]
    expect(show.showTitle).toBe('Police Squad')
    expect(show.seasons).toHaveLength(1)

    const season1 = show.seasons[0]
    expect(season1.seasonNumber).toBe(1)
    expect(season1.episodes).toHaveLength(3)

    // Check sorted episodes
    expect(season1.episodes[0].episode).toBe(1)
    expect(season1.episodes[0].customTitle || season1.episodes[0].title).toBe('A Volta do Esquadrão')
    expect(season1.episodes[0].episode !== undefined ? `E${String(season1.episodes[0].episode).padStart(2, '0')}` : 'EP').toBe('E01')

    expect(season1.episodes[1].episode).toBe(2)
    expect(season1.episodes[1].customTitle || season1.episodes[1].title).toBe('Ring of Fear')
    expect(season1.episodes[1].episode !== undefined ? `E${String(season1.episodes[1].episode).padStart(2, '0')}` : 'EP').toBe('E02')

    expect(season1.episodes[2].episode).toBe(3)
    expect(season1.episodes[2].customTitle || season1.episodes[2].title).toBe('The Butler Diddit')
    expect(season1.episodes[2].episode !== undefined ? `E${String(season1.episodes[2].episode).padStart(2, '0')}` : 'EP').toBe('E03')
  })

  test('persists manual TMDB rating when updating movie or series', async () => {
    const movie = item('D:/Media/Filmes/Inception.mkv', {
      id: 'movie-inception',
      title: 'Inception',
      mediaCategory: 'movie',
      isSeries: false,
      tmdbRating: 8.3,
      rating: '8.3'
    })

    const { provider, storage } = harness([movie])

    const updated = await provider.updateMovie({
      id: 'movie-inception',
      title: 'Inception - A Origem',
      rating: '8.8',
      tmdbRating: 8.8
    })

    expect(updated.tmdbRating).toBe(8.8)
    expect(updated.rating).toBe('8.8')
    expect(mediaTmdbRating(updated)).toBe('8.8')

    const inStorage = storage.movies.find((m: GhostMovie) => m.id === 'movie-inception')
    expect(inStorage.tmdbRating).toBe(8.8)
    expect(inStorage.rating).toBe('8.8')
    expect(mediaTmdbRating(inStorage)).toBe('8.8')
  })

  test('clears TMDB rating when empty or null is passed', async () => {
    const movie = item('D:/Media/Filmes/Inception.mkv', {
      id: 'movie-inception',
      title: 'Inception',
      mediaCategory: 'movie',
      isSeries: false,
      tmdbRating: 8.8,
      rating: '8.8'
    })

    const { provider, storage } = harness([movie])

    const updated = await provider.updateMovie({
      id: 'movie-inception',
      title: 'Inception',
      rating: '',
      tmdbRating: null
    })

    expect(updated.tmdbRating).toBeNull()
    expect(updated.rating).toBeUndefined()
    expect(mediaTmdbRating(updated)).toBeUndefined()

    const inStorage = storage.movies.find((m: GhostMovie) => m.id === 'movie-inception')
    expect(inStorage.tmdbRating).toBeNull()
    expect(mediaTmdbRating(inStorage)).toBeUndefined()
  })

  test('propagates manual TMDB rating to all sibling episodes when requested', async () => {
    const ep1 = item('D:/Media/Series/BreakingBad/S01E01.mkv', {
      id: 'bb-1',
      title: 'Pilot',
      showTitle: 'Breaking Bad',
      mediaCategory: 'series',
      isSeries: true,
      season: 1,
      episode: 1,
      tmdbRating: null
    })
    const ep2 = item('D:/Media/Series/BreakingBad/S01E02.mkv', {
      id: 'bb-2',
      title: 'Cat\'s in the Bag...',
      showTitle: 'Breaking Bad',
      mediaCategory: 'series',
      isSeries: true,
      season: 1,
      episode: 2,
      tmdbRating: null
    })

    const { provider, storage } = harness([ep1, ep2])

    await provider.updateMovie(
      {
        id: 'bb-1',
        title: 'Pilot',
        showTitle: 'Breaking Bad',
        mediaCategory: 'series',
        isSeries: true,
        rating: '9.5',
        tmdbRating: 9.5
      },
      { applyToShow: true }
    )

    const storedEp1 = storage.movies.find((m: GhostMovie) => m.id === 'bb-1')
    const storedEp2 = storage.movies.find((m: GhostMovie) => m.id === 'bb-2')

    expect(storedEp1.tmdbRating).toBe(9.5)
    expect(storedEp1.rating).toBe('9.5')
    expect(storedEp2.tmdbRating).toBe(9.5)
    expect(storedEp2.rating).toBe('9.5')

    expect(mediaTmdbRating(storedEp1)).toBe('9.5')
    expect(mediaTmdbRating(storedEp2)).toBe('9.5')
  })

  test('gracefully ignores vertical backdrop errors and saves poster and metadata without crashing', async () => {
    const movie = item('D:/Media/Filmes/1917/1917.mkv', {
      id: 'movie-1917',
      title: '1917',
      mediaCategory: 'movie',
      isSeries: false,
      coverUrl: 'http://localhost/cover.jpg',
      backdropUrl: 'http://localhost/backdrop.jpg'
    })

    const { provider, storage } = harness([movie])

    // Mock saveArtwork: poster succeeds, backdrop throws "A imagem de fundo recebida precisa ser horizontal."
    const saveArtworkMock = jest.fn(
      async (_path: string, _source: string, type: string) => {
        if (type === 'poster') {
          return {
            localPath: 'D:/Media/Filmes/1917/poster.jpg',
            streamUrl: 'imagecache://localhost/poster.jpg'
          }
        }
        if (type === 'backdrop') {
          throw new Error('A imagem de fundo recebida precisa ser horizontal.')
        }
        return null
      }
    )

    // Let's create a custom harness with saveArtworkMock
    const customHarness = () => {
      const storageObj: Record<string, any> = {
        movies: [clone(movie)],
        metadata_settings: { autoFetch: false }
      }
      let prov: any
      const ctx = vm.createContext({
        Buffer,
        URL,
        URLSearchParams,
        setTimeout,
        clearTimeout,
        Date,
        ghost: {
          log: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          storage: {
            get: async (key: string) => clone(storageObj[key]),
            set: async (key: string, value: any) => {
              storageObj[key] = clone(value)
            }
          },
          http: { fetch: jest.fn() },
          ui: { injectCSS: jest.fn() },
          media: {
            registerMediaProvider: (registered: any) => {
              prov = registered
            },
            artworkExists: async () => true,
            scanFolder: jest.fn(),
            saveArtwork: saveArtworkMock
          }
        }
      })
      vm.runInContext(
        readFileSync(resolve('plugins/alazterflix/index.js'), 'utf8'),
        ctx
      )
      return { prov, storageObj }
    }

    const { prov, storageObj } = customHarness()

    // Updating with new coverUrl and an invalid/vertical backdropUrl
    const updated = await prov.updateMovie({
      id: 'movie-1917',
      title: '1917',
      coverUrl: 'https://m.media-amazon.com/images/M/1917-poster._V1_.jpg',
      backdropUrl: 'https://example.com/vertical-portrait.jpg'
    })

    expect(saveArtworkMock).toHaveBeenCalledWith(
      'D:/Media/Filmes/1917/1917.mkv',
      'https://m.media-amazon.com/images/M/1917-poster._V1_.jpg',
      'poster',
      undefined,
      false
    )
    expect(saveArtworkMock).toHaveBeenCalledWith(
      'D:/Media/Filmes/1917/1917.mkv',
      'https://example.com/vertical-portrait.jpg',
      'backdrop',
      undefined,
      false
    )

    // The movie is saved with the new poster, without throwing!
    expect(updated.title).toBe('1917')
    expect(updated.localCoverPath).toBe('D:/Media/Filmes/1917/poster.jpg')
    expect(updated.coverUrl).toContain('D%3A%2FMedia%2FFilmes%2F1917%2Fposter.jpg')

    const stored = storageObj.movies.find((m: GhostMovie) => m.id === 'movie-1917')
    expect(stored.localCoverPath).toBe('D:/Media/Filmes/1917/poster.jpg')
  })

  test('skips backdrop saving if backdropUrl is identical to coverUrl or is an IMDb mediaviewer URL', async () => {
    const movie = item('D:/Media/Filmes/1917/1917.mkv', {
      id: 'movie-1917',
      title: '1917',
      mediaCategory: 'movie',
      isSeries: false
    })

    const saveArtworkMock = jest.fn(
      async (_path: string, _source: string, type: string) => ({
        localPath: `D:/Media/Filmes/1917/${type}.jpg`,
        streamUrl: `imagecache://localhost/${type}.jpg`
      })
    )

    const storageObj: Record<string, any> = {
      movies: [clone(movie)],
      metadata_settings: { autoFetch: false }
    }
    let prov: any
    const ctx = vm.createContext({
      Buffer,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      Date,
      ghost: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        storage: {
          get: async (key: string) => clone(storageObj[key]),
          set: async (key: string, value: any) => {
            storageObj[key] = clone(value)
          }
        },
        http: { fetch: jest.fn() },
        ui: { injectCSS: jest.fn() },
        media: {
          registerMediaProvider: (registered: any) => {
            prov = registered
          },
          artworkExists: async () => true,
          scanFolder: jest.fn(),
          saveArtwork: saveArtworkMock
        }
      }
    })
    vm.runInContext(
      readFileSync(resolve('plugins/alazterflix/index.js'), 'utf8'),
      ctx
    )

    const imdbUrl = 'https://www.imdb.com/pt/title/tt8579674/mediaviewer/rm4236618753/'

    await prov.updateMovie({
      id: 'movie-1917',
      title: '1917',
      coverUrl: imdbUrl,
      backdropUrl: imdbUrl // Same IMDb poster link passed as backdrop
    })

    // saveArtwork should have been called ONLY for poster, NOT for backdrop!
    expect(saveArtworkMock).toHaveBeenCalledTimes(1)
    expect(saveArtworkMock).toHaveBeenCalledWith(
      'D:/Media/Filmes/1917/1917.mkv',
      imdbUrl,
      'poster',
      undefined,
      false
    )
  })
})
