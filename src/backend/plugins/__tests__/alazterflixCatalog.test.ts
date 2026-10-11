import vm from 'node:vm'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { GhostMovie } from 'common/types/plugins'
import { groupMoviesIntoShows } from 'common/mediaCatalog'

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
  const http = jest.fn<Promise<any>, any[]>(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ metas: [] })
  }))
  const saveArtwork = jest.fn(
    async (
      path: string,
      source: string,
      type: string,
      directory?: string,
      single?: boolean
    ) => ({
      localPath: single
        ? path + '-' + type + '.jpg'
        : (directory || path.substring(0, path.lastIndexOf('/'))) +
          '/' +
          type +
          '.jpg',
      streamUrl: source
    })
  )
  const scanFolder = jest.fn(async (_folder: string) => [] as any[])
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
      http: { fetch: http },
      ui: { injectCSS: jest.fn() },
      media: {
        registerMediaProvider: (registered: any) => {
          provider = registered
        },
        artworkExists: async () => true,
        scanFolder,
        saveArtwork
      }
    }
  })
  vm.runInContext(
    readFileSync(resolve('plugins/alazterflix/index.js'), 'utf8') +
      '\nglobalThis.testCatalog = { chooseMetadataCandidate, parseMediaHierarchy, extractCandidateFolder, isValidMediaTitle, resolveMediaTitle, autoCatalogMovies };',
    context
  )
  return {
    provider,
    storage,
    http,
    saveArtwork,
    scanFolder,
    internals: (context as any).testCatalog
  }
}

describe('Alazterflix catalog and artwork persistence', () => {
  afterEach(() => jest.useRealTimers())

  test('personal decimal ratings persist for the whole work without replacing the TMDB rating or artwork', async () => {
    const { provider, storage } = harness([
      item('T:/Animes/Aika/Aika.S01E01.mkv', {
        id: 'aika-1',
        tmdbRating: 8,
        coverUrl: 'poster.jpg'
      }),
      item('T:/Animes/Aika/Aika.S01E02.mkv', { id: 'aika-2', tmdbRating: 8 })
    ])
    const ids = (await provider.getState()).movies.map(
      (movie: GhostMovie) => movie.id
    )
    await provider.updateMediaPreferences(ids, { userRating: 9.5 })
    expect(storage.movies.map((movie: GhostMovie) => movie.userRating)).toEqual(
      [9.5, 9.5]
    )
    expect(storage.movies[0].tmdbRating).toBe(8)
    expect(storage.movies[0].coverUrl).toBe('poster.jpg')
    await provider.updateMediaPreferences(ids, { userRating: 0 })
    expect((await provider.getState()).movies[0].userRating).toBe(0)
    await provider.updateMediaPreferences(ids, { userRating: null })
    expect(
      storage.movies.every(
        (movie: GhostMovie) => movie.userRating === undefined
      )
    ).toBe(true)
    for (const userRating of [11, -1, NaN, Infinity, '9,5', undefined])
      await expect(
        provider.updateMediaPreferences(ids, { userRating })
      ).rejects.toThrow('0 a 10')
    await expect(
      provider.updateMediaPreferences([...ids, 'missing'], { userRating: 10 })
    ).rejects.toThrow('biblioteca')
    expect(
      storage.movies.every(
        (movie: GhostMovie) => movie.userRating === undefined
      )
    ).toBe(true)
  })

  test('manual watched state is independent of resume progress, survives playback and updates ID/path history for every episode', async () => {
    const { provider, storage } = harness([
      item('T:/Animes/Aika/Aika.S01E01.mkv', { id: 'aika-1', duration: 1800 }),
      item('T:/Animes/Aika/Aika.S01E02.mkv', { id: 'aika-2', duration: 1800 })
    ])
    const state = await provider.getState()
    const ids = state.movies.map((movie: GhostMovie) => movie.id)
    await provider.saveProgress(ids[0], 90, 1800)
    await provider.updateMediaPreferences(ids, { isWatched: true })
    expect(storage.movies.every((movie: GhostMovie) => movie.isWatched)).toBe(
      true
    )
    expect(storage.movies[0].progressSeconds).toBe(90)
    expect(storage.movies[1].progressSeconds).toBeUndefined()
    for (const movie of storage.movies) {
      expect(storage.playback_history[movie.id].isWatched).toBe(true)
      expect(storage.playback_history[movie.filePath].isWatched).toBe(true)
    }
    await provider.saveProgress(ids[0], 120, 1800)
    expect(storage.movies[0].isWatched).toBe(true)
    await provider.updateMediaPreferences(ids, { isWatched: false })
    expect(
      storage.movies.every((movie: GhostMovie) => movie.isWatched === false)
    ).toBe(true)
    expect(storage.movies[0].progressSeconds).toBe(120)
    await provider.saveProgress(ids[0], 1710, 1800)
    expect(storage.movies[0].isWatched).toBe(true)
    await expect(
      provider.updateMediaPreferences(ids, { isWatched: 'yes' })
    ).rejects.toThrow('inválido')
  })

  test('TMDB vote data is saved separately; zero votes cannot reuse an old IMDb score', async () => {
    const { provider, storage, http } = harness([
      item('T:/Filmes/Example.mkv', {
        metadataProvider: 'tmdb',
        metadataId: '123',
        rating: '9.4'
      })
    ])
    storage.metadata_settings = {
      tmdbToken: 'test-read-token',
      autoFetch: false
    }
    const movie = (await provider.getState()).movies[0]
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        title: 'Example',
        vote_average: 8.2,
        vote_count: 20
      })
    })
    await provider.enrichMovie(movie.id)
    expect(storage.movies[0].tmdbRating).toBe(8.2)
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        title: 'Example',
        vote_average: 0,
        vote_count: 0
      })
    })
    await provider.enrichMovie(movie.id)
    expect(storage.movies[0].tmdbRating).toBeNull()
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        title: 'Example',
        vote_average: 0,
        vote_count: 1
      })
    })
    await provider.enrichMovie(movie.id)
    expect(storage.movies[0].tmdbRating).toBe(0)
  })

  test('migrates colliding IDs, preserves artwork and paths, and keeps a recovery snapshot', async () => {
    const original = [
      item('T:/Filmes/First.mkv', {
        id: 'old-id',
        localCoverPath: 'T:/Filmes/First-poster.jpg'
      }),
      item('T:/Filmes/Second.mkv', { id: 'old-id' })
    ]
    const { provider, storage } = harness(original)
    const state = await provider.getState()
    expect(new Set(state.movies.map((m: GhostMovie) => m.id)).size).toBe(2)
    expect(state.movies.map((m: GhostMovie) => m.filePath)).toEqual(
      original.map((m) => m.filePath)
    )
    expect(state.movies[0].localCoverPath).toBe(original[0].localCoverPath)
    expect(storage.catalog_v2_backup.movies).toEqual(original)
    const second = await provider.getState()
    expect(second.movies.map((m: GhostMovie) => m.id)).toEqual(
      state.movies.map((m: GhostMovie) => m.id)
    )
  })

  test('new scans give files with the same path prefix unique IDs and deduplicate overlapping folders', async () => {
    const { provider, scanFolder } = harness()
    const files = ['First.2020.mkv', 'Second.2021.mkv'].map((name) => ({
      name,
      path: 'T:/Filmes/' + name,
      size: 100
    }))
    scanFolder.mockResolvedValue(files)
    const movies = await provider.scanFolders(['T:/Filmes', 'T:/Filmes'])
    expect(movies).toHaveLength(2)
    expect(new Set(movies.map((m: GhostMovie) => m.id)).size).toBe(2)
  })

  test('manual edits and independent playback progress survive concurrent writes and a new plugin instance', async () => {
    const { provider, storage } = harness([
      item('T:/Filmes/First.mkv'),
      item('T:/Filmes/Second.mkv')
    ])
    const { movies } = await provider.getState()
    await Promise.all([
      provider.updateMovie({
        ...movies[0],
        title: 'First edited',
        metadataLocked: true
      }),
      provider.updateMovie({
        ...movies[1],
        title: 'Second edited',
        metadataLocked: true
      }),
      provider.saveProgress(movies[0].id, 90, 300)
    ])
    expect(storage.movies.map((m: GhostMovie) => m.title)).toEqual([
      'First edited',
      'Second edited'
    ])
    expect(storage.movies[0].progressSeconds).toBe(90)
    expect(storage.movies[1].progressSeconds).toBeUndefined()
    const restarted = harness(storage.movies)
    await restarted.provider.autoCatalog()
    expect(restarted.storage.movies.map((m: GhostMovie) => m.title)).toEqual([
      'First edited',
      'Second edited'
    ])
  })

  test('editing one episode does not change sibling artwork and uses a file-specific image', async () => {
    const { provider, storage, saveArtwork } = harness([
      item('T:/Séries/Example/Season 01/Example.S01E01.mkv'),
      item('T:/Séries/Example/Season 01/Example.S01E02.mkv')
    ])
    const state = await provider.getState()
    await provider.updateMovie(
      {
        ...state.movies[0],
        coverUrl: 'https://example.com/custom.jpg',
        artworkLocked: true
      },
      { applyToShow: false }
    )
    expect(storage.movies[0].coverUrl).toContain('imagecache://')
    expect(storage.movies[0].customCoverUrl).toBe(storage.movies[0].coverUrl)
    expect(storage.movies[1].coverUrl).toBeUndefined()
    expect(saveArtwork).toHaveBeenCalledWith(
      state.movies[0].filePath,
      'https://example.com/custom.jpg',
      'poster',
      undefined,
      true
    )
  })

  test('one series edit propagates in one save and never crosses category or show directory', async () => {
    const { provider, storage } = harness([
      item('T:/Séries/Example/Season 01/Example.S01E01.mkv'),
      item('T:/Séries/Example/Season 02/Example.S02E01.mkv'),
      item('T:/Animes/Example/Season 01/Example.S01E01.mkv')
    ])
    const { movies } = await provider.getState()
    await provider.updateMovie(
      {
        ...movies[0],
        coverUrl: 'https://example.com/custom.jpg',
        artworkLocked: true
      },
      { applyToShow: true }
    )
    expect(storage.movies[1].coverUrl).toBe(storage.movies[0].coverUrl)
    expect(storage.movies[1].artworkLocked).toBe(true)
    expect(storage.movies[2].coverUrl).toBeUndefined()
  })

  test('manual category and standalone documentary format survive recataloging', async () => {
    const { provider } = harness([item('T:/Filmes/Example.2020.mkv')])
    const state = await provider.getState()
    await provider.updateMovie({
      ...state.movies[0],
      mediaCategory: 'documentary',
      isSeries: false,
      metadataLocked: true
    })
    const cataloged = await provider.autoCatalog()
    expect(cataloged[0].mediaCategory).toBe('documentary')
    expect(cataloged[0].isSeries).toBe(false)
    expect(groupMoviesIntoShows(cataloged)[0].seasonsCount).toBe(0)
  })

  test('unavailable folders retain previously indexed media', async () => {
    const { provider, scanFolder } = harness([item('T:/Filmes/First.mkv')])
    scanFolder.mockRejectedValue(new Error('Drive disconnected'))
    expect(await provider.scanFolders(['T:/Filmes'])).toHaveLength(1)
  })

  test('automatic identification refuses unrelated search hits and ambiguous remakes', () => {
    const { internals } = harness()
    const candidate = {
      provider: 'cinemeta',
      title: 'Example',
      year: 2000,
      id: 'tt1'
    }
    expect(
      internals.chooseMetadataCandidate(
        [{ ...candidate, title: 'Other' }],
        'Example'
      )
    ).toBeNull()
    expect(
      internals.chooseMetadataCandidate(
        [candidate, { ...candidate, id: 'tt2', year: 2020 }],
        'Example'
      )
    ).toBeNull()
    expect(
      internals.chooseMetadataCandidate(
        [candidate, { ...candidate, id: 'tt2', year: 2020 }],
        'Example',
        2020
      ).id
    ).toBe('tt2')
  })

  test('TMDB offers only Portuguese posters and preserves the Portuguese catalog title', async () => {
    jest.useFakeTimers()
    const { provider, storage, http } = harness([
      item('T:/Filmes/O.Exemplo.2020.mkv', {
        title: 'O Exemplo',
        cleanTitle: 'O Exemplo',
        metadataProvider: 'tmdb',
        metadataId: '123'
      })
    ])
    storage.metadata_settings = {
      tmdbToken: 'test-read-token',
      language: 'pt-BR',
      autoFetch: false
    }
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        title: 'The Example',
        release_date: '2020-01-01',
        images: {
          posters: [
            { file_path: '/english.jpg', iso_639_1: 'en' },
            { file_path: '/portuguese.jpg', iso_639_1: 'pt' },
            { file_path: '/no-text.jpg', iso_639_1: null }
          ],
          backdrops: [{ file_path: '/background.jpg', iso_639_1: null }]
        }
      })
    })
    const details = await provider.metadataDetails({
      provider: 'tmdb',
      id: '123',
      type: 'movie'
    })
    expect(details.posters).toEqual([
      'https://image.tmdb.org/t/p/w500/portuguese.jpg'
    ])
    expect(details.posterLanguage).toBe('pt')
    await provider.refreshMetadata('all')
    await jest.runAllTimersAsync()
    expect(storage.movies[0].title).toBe('O Exemplo')
    expect(storage.movies[0].artworkLanguage).toBe('pt')
    const state = await provider.getState()
    expect(state.metadataSettings.tmdbConfigured).toBe(true)
    expect(state.metadataSettings.tmdbToken).toBeUndefined()
  })

  test('TMDB selects high-resolution landscape backdrops, prefers textless art and keeps its default fallback', async () => {
    const { provider, storage, http } = harness()
    storage.metadata_settings = { tmdbToken: 'test-read-token' }
    const data = {
      id: 123,
      backdrop_path: '/default.jpg',
      images: {
        backdrops: [
          {
            file_path: '/portrait.jpg',
            iso_639_1: null,
            width: 3000,
            height: 4500
          },
          { file_path: '/small.jpg', iso_639_1: null, width: 400, height: 225 },
          {
            file_path: '/text.jpg',
            iso_639_1: 'pt',
            width: 3840,
            height: 2160
          },
          { file_path: '/wide.jpg', iso_639_1: null, width: 1920, height: 1080 }
        ]
      }
    }
    http.mockResolvedValue({ ok: true, json: async () => data })
    const candidate = { provider: 'tmdb', id: '123', type: 'series' }
    const details = await provider.metadataDetails(candidate)
    expect(details.background).toBe(
      'https://image.tmdb.org/t/p/original/wide.jpg'
    )
    expect(details.backdrops).not.toContain(
      'https://image.tmdb.org/t/p/original/portrait.jpg'
    )
    data.images.backdrops = []
    expect((await provider.metadataDetails(candidate)).background).toBe(
      'https://image.tmdb.org/t/p/original/default.jpg'
    )
  })

  test('searching Portuguese covers also fills missing backdrops without replacing an existing Portuguese poster', async () => {
    jest.useFakeTimers()
    const { provider, storage, http, saveArtwork } = harness([
      item('T:/Filmes/Exemplo/Exemplo.mkv', {
        artworkLanguage: 'pt',
        localCoverPath: 'T:/Filmes/Exemplo/poster.jpg',
        coverUrl: 'imagecache://original-poster',
        backdropUrl: 'https://example.com/old-portrait.jpg',
        metadataProvider: 'tmdb',
        metadataId: '123'
      }),
      item('T:/Filmes/Completo/Completo.mkv', {
        artworkLanguage: 'pt',
        localCoverPath: 'T:/Filmes/Completo/poster.jpg',
        localBackdropPath: 'T:/Filmes/Completo/fanart.jpg',
        metadataProvider: 'tmdb',
        metadataId: '456'
      }),
      item('T:/Filmes/Manual/Manual.mkv', {
        artworkLocked: true,
        coverUrl: 'imagecache://manual-poster',
        backdropUrl: 'imagecache://manual-backdrop'
      })
    ])
    storage.metadata_settings = { tmdbToken: 'test-read-token' }
    http.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 123,
        images: {
          posters: [{ file_path: '/poster.jpg', iso_639_1: 'pt' }],
          backdrops: [
            {
              file_path: '/wide.jpg',
              iso_639_1: null,
              width: 1920,
              height: 1080
            }
          ]
        }
      })
    })
    await provider.getState()
    const originalCover = storage.movies[0].coverUrl
    expect((await provider.refreshMetadata('portuguese')).total).toBe(1)
    await jest.runAllTimersAsync()
    expect(saveArtwork).toHaveBeenCalledTimes(1)
    expect(saveArtwork.mock.calls[0][1]).toBe(
      'https://image.tmdb.org/t/p/original/wide.jpg'
    )
    expect(saveArtwork.mock.calls[0][2]).toBe('backdrop')
    expect(storage.movies[0].coverUrl).toBe(originalCover)
    expect(storage.movies[0].localBackdropPath).toBe(
      'T:/Filmes/Exemplo/backdrop.jpg'
    )
    expect(storage.movies[1].localBackdropPath).toBe(
      'T:/Filmes/Completo/fanart.jpg'
    )
    expect(storage.movies[2].backdropUrl).toBe('imagecache://manual-backdrop')
  })

  test('Cinemeta artwork without a declared language is never applied automatically', async () => {
    const { provider, http } = harness()
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        meta: {
          id: 'tt123',
          name: 'Example',
          poster: 'https://example.com/english.jpg'
        }
      })
    })
    const details = await provider.metadataDetails({
      provider: 'cinemeta',
      id: 'tt123',
      type: 'movie'
    })
    expect(details.poster).toBeUndefined()
    expect(details.posters).toEqual([])
  })

  test('Portuguese artwork refresh replaces an old poster, preserves manual artwork, and keeps existing art when Portuguese is unavailable', async () => {
    jest.useFakeTimers()
    const { provider, storage, http, saveArtwork } = harness([
      item('T:/Filmes/O.Exemplo.2020.mkv', {
        title: 'O Exemplo',
        cleanTitle: 'O Exemplo',
        localCoverPath: 'T:/Filmes/O.Exemplo-poster.jpg',
        coverUrl: 'imagecache://old-poster',
        metadataProvider: 'tmdb',
        metadataId: '123'
      }),
      item('T:/Filmes/Protegido.2020.mkv', {
        title: 'Protegido',
        artworkLocked: true,
        localCoverPath: 'T:/Filmes/Protegido-poster.jpg',
        coverUrl: 'imagecache://manual',
        metadataProvider: 'tmdb',
        metadataId: '123'
      }),
      item('T:/Filmes/Sem.Traducao.2020.mkv', {
        title: 'Sem Tradução',
        cleanTitle: 'Sem Tradução',
        localCoverPath: 'T:/Filmes/Sem.Traducao-poster.jpg',
        coverUrl: 'imagecache://no-translation',
        metadataProvider: 'tmdb',
        metadataId: '456'
      })
    ])
    storage.metadata_settings = {
      tmdbToken: 'test-read-token',
      language: 'pt-BR',
      autoFetch: false
    }
    http.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: url.includes('/456') ? 456 : 123,
        title: 'English Name',
        images: {
          posters: url.includes('/456')
            ? [{ file_path: '/english.jpg', iso_639_1: 'en' }]
            : [{ file_path: '/portuguese.jpg', iso_639_1: 'pt' }]
        }
      })
    }))
    await provider.refreshMetadata('all')
    await jest.runAllTimersAsync()
    expect(saveArtwork).not.toHaveBeenCalled()
    const before = clone(storage.movies)
    const job = await provider.refreshMetadata('portuguese')
    expect(job.total).toBe(2)
    await jest.runAllTimersAsync()
    expect(saveArtwork).toHaveBeenCalledTimes(1)
    expect(saveArtwork.mock.calls[0][1]).toBe(
      'https://image.tmdb.org/t/p/w500/portuguese.jpg'
    )
    expect(storage.movies[0].coverUrl).not.toBe(before[0].coverUrl)
    expect(storage.movies[0].artworkLanguage).toBe('pt')
    expect(storage.movies.map((movie: GhostMovie) => movie.title)).toEqual([
      'O Exemplo',
      'Protegido',
      'Sem Tradução'
    ])
    expect(storage.movies[1].coverUrl).toBe(before[1].coverUrl)
    expect(storage.movies[2].coverUrl).toBe(before[2].coverUrl)
    expect(storage.movies[2].portuguesePosterUnavailable).toBe(true)
  })

  test('Portuguese poster refresh explains missing TMDB configuration before starting', async () => {
    const { provider } = harness()
    await expect(provider.refreshMetadata('portuguese')).rejects.toThrow(
      'Configure o token de leitura TMDB'
    )
    expect((await provider.getMetadataStatus()).running).toBe(false)
  })

  test('refresh processes the whole collection past 50 works and marks unresolved identifications', async () => {
    jest.useFakeTimers()
    const { provider, http, storage } = harness(
      Array.from({ length: 55 }, (_, i) =>
        item('T:/Filmes/Movie' + i + '.mkv', {
          title: 'Movie' + i,
          cleanTitle: 'Movie' + i
        })
      )
    )
    http.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ metas: [] })
    }))
    const job = await provider.refreshMetadata('all')
    expect(job.total).toBe(55)
    await jest.runAllTimersAsync()
    const final = await provider.getMetadataStatus()
    expect(final.running).toBe(false)
    expect(final.completed).toBe(55)
    expect(final.unidentified).toBe(55)
    expect(
      storage.movies.every(
        (m: GhostMovie) => m.metadataStatus === 'needs-identification'
      )
    ).toBe(true)
  })

  test('refresh cannot overwrite a manual cover saved while online lookup is in flight', async () => {
    jest.useFakeTimers()
    const { provider, http, storage } = harness([
      item('T:/Filmes/Example.2020.mkv', { year: 2020, imdbId: 'tt123' })
    ])
    let release!: (value: any) => void
    http.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    await provider.refreshMetadata('all')
    await jest.advanceTimersByTimeAsync(0)
    const movie = (await provider.getState()).movies[0]
    await provider.updateMovie({
      ...movie,
      coverUrl: 'https://example.com/manual.jpg',
      artworkLocked: true,
      metadataLocked: true
    })
    const manual = storage.movies[0].coverUrl
    release({
      ok: true,
      status: 200,
      json: async () => ({
        meta: {
          id: 'tt123',
          name: 'Example',
          poster: 'https://example.com/automatic.jpg'
        }
      })
    })
    await jest.runAllTimersAsync()
    expect(storage.movies[0].coverUrl).toBe(manual)
    expect(storage.movies[0].customCoverUrl).toBe(manual)
  })

  test('parser understands category names without case or accent dependence and puts specials in season zero', () => {
    const { internals } = harness()
    expect(
      internals.parseMediaHierarchy(
        'T:/SÉRIES/Example/Season 02/Example.S02E03.mkv',
        'Example.S02E03.mkv'
      ).season
    ).toBe(2)
    expect(
      internals.parseMediaHierarchy(
        'T:/animes/Example/Especiais/Example.OVA01.mkv',
        'Example.OVA01.mkv'
      ).season
    ).toBe(0)
    expect(
      internals.parseMediaHierarchy(
        'T:/Documentários/Example/Example.2020.mkv',
        'Example.2020.mkv'
      ).isSeries
    ).toBe(false)
    expect(
      internals.parseMediaHierarchy(
        'T:/Documentários/Série Construindo a História/Construindo Um Império - China.mkv',
        'Construindo Um Império - China.mkv'
      )
    ).toMatchObject({
      mediaCategory: 'documentary',
      isSeries: true,
      season: 1,
      showTitle: 'Série Construindo a História'
    })
  })

  test('grouping separates independent films, homonymous show directories, and puts seasons in numeric order', () => {
    const movies = [
      item('T:/Filmes/First.mkv', {
        mediaCategory: 'movie',
        showTitle: 'Saga'
      }),
      item('T:/Filmes/Second.mkv', {
        mediaCategory: 'movie',
        showTitle: 'Saga'
      }),
      ...[10, 2, 0].map((number) =>
        item('T:/Séries/Example (2020)/' + number + '.mkv', {
          mediaCategory: 'series',
          showTitle: 'Example',
          isSeries: true,
          season: number,
          episode: 1
        })
      ),
      item('T:/Séries/Example (2000)/1.mkv', {
        mediaCategory: 'series',
        showTitle: 'Example',
        isSeries: true,
        season: 1
      })
    ]
    const shows = groupMoviesIntoShows(movies)
    expect(shows).toHaveLength(4)
    expect(
      shows
        .find((show) => show.episodesCount === 3)!
        .seasons.map((season) => season.seasonNumber)
    ).toEqual([2, 10, 0])
    expect(new Set(shows.map((show) => show.id)).size).toBe(4)
  })

  test('extractCandidateFolder ignores category roots, drive roots, and subfolders', () => {
    const { internals } = harness()
    expect(
      internals.extractCandidateFolder(
        'D:/Filmes/Interestelar (2014)/video.mkv'
      )
    ).toBe('Interestelar (2014)')
    expect(
      internals.extractCandidateFolder(
        'D:/Series/Breaking Bad/Season 01/ep01.mkv'
      )
    ).toBe('Breaking Bad')
    expect(
      internals.extractCandidateFolder(
        'D:/Filmes/Oppenheimer (2023)/CD1/cd1.avi'
      )
    ).toBe('Oppenheimer (2023)')
    // Categorias e raízes não são candidatos de título de obra
    expect(
      internals.extractCandidateFolder('D:/Filmes/Interestelar.2014.1080p.mkv')
    ).toBeNull()
    expect(
      internals.extractCandidateFolder('C:/Downloads/Avatar.mkv')
    ).toBeNull()
    expect(internals.extractCandidateFolder('E:/movie.mp4')).toBeNull()
  })

  test('isValidMediaTitle identifies valid movie titles vs generic placeholders and codes', () => {
    const { internals } = harness()
    expect(internals.isValidMediaTitle('Interestelar')).toBe(true)
    expect(internals.isValidMediaTitle('De Volta Para o Futuro')).toBe(true)
    expect(internals.isValidMediaTitle('Up')).toBe(true)
    expect(internals.isValidMediaTitle('video')).toBe(false)
    expect(internals.isValidMediaTitle('movie')).toBe(false)
    expect(internals.isValidMediaTitle('filme')).toBe(false)
    expect(internals.isValidMediaTitle('01')).toBe(false)
    expect(internals.isValidMediaTitle('S01E02')).toBe(false)
    expect(internals.isValidMediaTitle('sample')).toBe(false)
    expect(internals.isValidMediaTitle('')).toBe(false)
  })

  test('resolveMediaTitle applies user choice when both file and folder are valid', () => {
    const { internals } = harness()
    const fromFolder = internals.resolveMediaTitle({
      filePath: 'D:/Filmes/Interestelar (2014)/Interstellar.2014.1080p.mkv',
      fileName: 'Interstellar.2014.1080p.mkv',
      preferredSource: 'folder'
    })
    expect(fromFolder.cleanTitle).toBe('Interestelar')
    expect(fromFolder.year).toBe(2014)
    expect(fromFolder.sourceUsed).toBe('folder')

    const fromFile = internals.resolveMediaTitle({
      filePath: 'D:/Filmes/Interestelar (2014)/Interstellar.2014.1080p.mkv',
      fileName: 'Interstellar.2014.1080p.mkv',
      preferredSource: 'file'
    })
    expect(fromFile.cleanTitle).toBe('Interstellar')
    expect(fromFile.year).toBe(2014)
    expect(fromFile.sourceUsed).toBe('file')
  })

  test('resolveMediaTitle falls back intelligently when chosen source is invalid or generic without errors', () => {
    const { internals } = harness()
    // Usuário escolheu 'folder', mas arquivo está solto em 'Filmes' (pasta genérica)
    const fallbackToFile = internals.resolveMediaTitle({
      filePath: 'D:/Filmes/Interestelar.2014.1080p.mkv',
      fileName: 'Interestelar.2014.1080p.mkv',
      preferredSource: 'folder'
    })
    expect(fallbackToFile.cleanTitle).toBe('Interestelar')
    expect(fallbackToFile.sourceUsed).toBe('file')

    // Usuário escolheu 'file', mas o arquivo é genérico (video.mp4) e a pasta tem o nome do filme
    const fallbackToFolder = internals.resolveMediaTitle({
      filePath: 'D:/Filmes/Interestelar (2014)/video.mp4',
      fileName: 'video.mp4',
      preferredSource: 'file'
    })
    expect(fallbackToFolder.cleanTitle).toBe('Interestelar')
    expect(fallbackToFolder.year).toBe(2014)
    expect(fallbackToFolder.sourceUsed).toBe('folder')
  })

  test('parseMediaHierarchy respects titleSource options for movies and series', () => {
    const { internals } = harness()
    const folderMovie = internals.parseMediaHierarchy(
      'D:/Filmes/Matrix (1999)/The.Matrix.1999.mkv',
      'The.Matrix.1999.mkv',
      { titleSource: 'folder' }
    )
    expect(folderMovie.cleanTitle).toBe('Matrix')
    expect(folderMovie.year).toBe(1999)

    const fileMovie = internals.parseMediaHierarchy(
      'D:/Filmes/Matrix (1999)/The.Matrix.1999.mkv',
      'The.Matrix.1999.mkv',
      { titleSource: 'file' }
    )
    expect(fileMovie.cleanTitle).toBe('The Matrix')
    expect(fileMovie.year).toBe(1999)
  })

  test('clears the entire continuation list while preserving resume points, ratings and watched records', async () => {
    const initial = Array.from({ length: 14 }, (_, index) =>
      item(`D:/Movies/Example${index}.2020.mkv`, {
        progressSeconds: 120 + index, duration: 1000, userRating: 9.5
      })
    )
    initial.push(item('D:/Movies/Completed.2020.mkv', { progressSeconds: 1000, duration: 1000, isWatched: true }))
    initial.push(item('D:/Movies/Unstarted.2020.mkv'))
    const { provider, storage } = harness(initial)
    await provider.getState()
    const before = clone(storage.movies)
    const watched = { progressSeconds: 1000, durationSeconds: 1000, lastWatched: '2026-01-02', isWatched: true }
    const completed = before.find((movie: GhostMovie) => movie.isWatched)
    storage.playback_history = { [completed.id]: clone(watched) }
    const updated = await provider.clearContinueWatching()
    expect(storage.movies).toEqual(before)
    for (const movie of before.slice(0, 14)) {
      expect(updated.playbackHistory[movie.id]).toMatchObject({
        progressSeconds: movie.progressSeconds, durationSeconds: 1000, continueHidden: true, isWatched: false
      })
      expect(updated.playbackHistory[movie.filePath]).toEqual(updated.playbackHistory[movie.id])
    }
    expect(updated.playbackHistory[completed.id]).toEqual(watched)
    const after = clone(storage.playback_history)
    await provider.clearContinueWatching()
    expect(storage.playback_history).toEqual(after)
  })

  test('new playback restores a cleared entry and keeps other entries hidden after reload', async () => {
    const { provider, storage } = harness([
      item('D:/Movies/First.2020.mkv', { progressSeconds: 120, duration: 1000 }),
      item('D:/Movies/Second.2020.mkv', { progressSeconds: 240, duration: 1000 })
    ])
    const cleared = await provider.clearContinueWatching()
    const [first, second] = cleared.movies
    expect((await provider.getState()).playbackHistory[first.id].continueHidden).toBe(true)
    await provider.saveProgress(first.id, 150, 1000)
    expect(storage.playback_history[first.id].continueHidden).toBeUndefined()
    expect(storage.playback_history[first.filePath].progressSeconds).toBe(150)
    expect(storage.playback_history[second.id].continueHidden).toBe(true)
  })

  test('clear respects per-file history and does not replace a legacy resume point', async () => {
    const { provider, storage } = harness([item('D:/Movies/Legacy.2020.mkv', { progressSeconds: 10 })])
    await provider.getState()
    const movie = storage.movies[0]
    storage.playback_history = { [movie.filePath]: { progressSeconds: 400, durationSeconds: 1000, lastWatched: '2026-01-01' } }
    await provider.clearContinueWatching()
    expect(storage.playback_history[movie.id]).toMatchObject({ progressSeconds: 400, continueHidden: true, lastWatched: '2026-01-01' })
  })

  test('updateMetadataSettings stores titleSource and re-catalogs existing movies immediately', async () => {
    const initialMovies = [
      item('D:/Filmes/Gladiador (2000)/Gladiator.2000.1080p.mkv', {
        title: 'Gladiator',
        cleanTitle: 'Gladiator'
      })
    ]
    const { provider, storage } = harness(initialMovies)
    const updatedSettings = await provider.updateMetadataSettings({
      language: 'pt-BR',
      autoFetch: false,
      titleSource: 'folder'
    })
    expect(updatedSettings.titleSource).toBe('folder')
    expect(storage.metadata_settings.titleSource).toBe('folder')

    // Filmes no catálogo devem ter sido re-catalogados com o nome da pasta
    expect(storage.movies[0].title).toBe('Gladiador')
    expect(storage.movies[0].cleanTitle).toBe('Gladiador')
  })
})
