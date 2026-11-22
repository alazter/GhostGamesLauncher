import type { GhostMovie } from 'common/types/plugins'
import {
  buildLocalMediaIndex,
  findLocalFilesForEpisode,
  matchStremioItemToLocal,
  normalizeLocalMediaKey
} from 'common/stremioLocalMedia'

function makeMovie(overrides: Partial<GhostMovie>): GhostMovie {
  return {
    id: overrides.id || 'm1',
    title: overrides.title || 'Untitled',
    cleanTitle: overrides.cleanTitle || overrides.title || 'Untitled',
    filePath: overrides.filePath || 'T:\\Alazter Multimídia\\Filmes\\Untitled.mkv',
    fileName: overrides.fileName || 'Untitled.mkv',
    fileSize: overrides.fileSize || '2.5 GB',
    fileSizeBytes: overrides.fileSizeBytes || 2_500_000_000,
    addedAt: '2026-11-01T00:00:00.000Z',
    source: 'local',
    ...overrides
  }
}

describe('stremioLocalMedia', () => {
  it('normalizes titles removing quality tags, years, extensions, and accents', () => {
    expect(normalizeLocalMediaKey('Akira - QUALIDADE 1')).toBe('akira')
    expect(normalizeLocalMediaKey('Inception.2010.2160p.REMUX.Dual.mkv')).toBe('inception')
    expect(normalizeLocalMediaKey('O Poderoso Chefão (1972)')).toBe('o poderoso chefao')
  })

  it('matches local movies by IMDb ID even when local title is in Portuguese', () => {
    const localMovies: GhostMovie[] = [
      makeMovie({
        id: 'local-inception',
        title: 'A Origem',
        cleanTitle: 'A Origem',
        imdbId: 'tt1375666',
        resolution: '4K',
        filePath: 'T:\\Alazter Multimídia\\Filmes\\A Origem (2010)\\A.Origem.2160p.mkv',
        fileName: 'A.Origem.2160p.mkv'
      })
    ]

    const index = buildLocalMediaIndex(localMovies)
    const match = matchStremioItemToLocal(index, {
      id: 'tt1375666',
      type: 'movie',
      name: 'Inception',
      year: 2010
    })

    expect(match).not.toBeNull()
    expect(match?.movies).toHaveLength(1)
    expect(match?.movies[0].id).toBe('local-inception')
    expect(match?.bestResolution).toBe('4K')
  })

  it('matches multi-quality local movies by folder/title even without imdbId', () => {
    const localMovies: GhostMovie[] = [
      makeMovie({
        id: 'akira-1080',
        title: 'Akira - QUALIDADE 1',
        cleanTitle: 'Akira - QUALIDADE 1',
        year: 1988,
        resolution: '1080p',
        filePath: 'T:\\Alazter Multimídia\\Animes\\Akira\\Akira.80.1080p.mkv',
        fileName: 'Akira.80.1080p.mkv'
      }),
      makeMovie({
        id: 'akira-4k',
        title: 'Akira - QUALIDADE 2',
        cleanTitle: 'Akira - QUALIDADE 2',
        year: 1988,
        resolution: '4K',
        filePath: 'T:\\Alazter Multimídia\\Animes\\Akira\\Akira.2160p.REMUX.mkv',
        fileName: 'Akira.2160p.REMUX.mkv'
      })
    ]

    const index = buildLocalMediaIndex(localMovies)
    const match = matchStremioItemToLocal(index, {
      id: 'tt0094625',
      type: 'movie',
      name: 'Akira',
      year: 1988
    })

    expect(match).not.toBeNull()
    expect(match?.movies).toHaveLength(2)
    expect(match?.bestResolution).toBe('4K')
  })

  it('matches local series and locates exact season/episode files', () => {
    const localMovies: GhostMovie[] = [
      makeMovie({
        id: 'bcs-s1e1',
        title: 'S01E01 - Uno',
        showTitle: 'Better Call Saul',
        isSeries: true,
        season: 1,
        episode: 1,
        resolution: '1080p',
        filePath: 'T:\\Series\\Better Call Saul\\Season 1\\Better.Call.Saul.S01E01.mkv',
        fileName: 'Better.Call.Saul.S01E01.mkv'
      }),
      makeMovie({
        id: 'bcs-s1e2',
        title: 'S01E02 - Mijo',
        showTitle: 'Better Call Saul',
        isSeries: true,
        season: 1,
        episode: 2,
        resolution: '1080p',
        filePath: 'T:\\Series\\Better Call Saul\\Season 1\\Better.Call.Saul.S01E02.mkv',
        fileName: 'Better.Call.Saul.S01E02.mkv'
      })
    ]

    const index = buildLocalMediaIndex(localMovies)
    const seriesMatch = matchStremioItemToLocal(index, {
      id: 'tt3032476',
      type: 'series',
      name: 'Better Call Saul',
      releaseInfo: '2015-2022'
    })

    expect(seriesMatch).not.toBeNull()
    expect(seriesMatch?.isSeries).toBe(true)
    expect(seriesMatch?.episodesCount).toBe(2)

    const ep2 = findLocalFilesForEpisode(seriesMatch!.movies, 1, 2)
    expect(ep2).toHaveLength(1)
    expect(ep2[0].id).toBe('bcs-s1e2')

    const ep9 = findLocalFilesForEpisode(seriesMatch!.movies, 1, 9)
    expect(ep9).toHaveLength(0)
  })
})
