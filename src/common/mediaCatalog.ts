import type { GhostMovie, GhostShow, GhostMediaCategory } from './types/plugins'

export const normalizeMediaTitle = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function mediaWorkKey(movie: GhostMovie): string {
  if (!movie.isSeries || movie.mediaCategory === 'movie')
    return `file:${movie.filePath}`
  const parts = movie.filePath.replace(/\\/g, '/').split('/')
  const root = parts.findIndex((part) =>
    [
      'series',
      'shows',
      'anime',
      'animes',
      'desenhos',
      'cartoons',
      'documentarios',
      'documentaries'
    ].includes(normalizeMediaTitle(part))
  )
  const directory =
    movie.showDirectory ||
    (root !== -1 && root + 2 < parts.length
      ? parts.slice(0, root + 2).join('/')
      : '')
  return [
    movie.mediaCategory || 'series',
    directory.replace(/\\/g, '/').toLowerCase(),
    normalizeMediaTitle(movie.showTitle || movie.cleanTitle || movie.title)
  ].join(':')
}

export function mediaPoster(movie: GhostMovie): string | undefined {
  return (
    movie.customCoverUrl ||
    movie.coverUrl ||
    (movie.localCoverPath
      ? `imagecache://localhost/${encodeURIComponent(movie.localCoverPath)}${movie.artworkRevision ? `?v=${movie.artworkRevision}` : ''}`
      : undefined)
  )
}

export function groupMoviesIntoShows(movies: GhostMovie[]): GhostShow[] {
  const groups = new Map<string, GhostMovie[]>()
  for (const movie of movies) {
    const key = mediaWorkKey(movie)
    const list = groups.get(key) || []
    list.push(movie)
    groups.set(key, list)
  }
  return Array.from(groups, ([key, episodes]) => {
    const score = (movie: GhostMovie) =>
      movie.isSeries && movie.artworkScope === 'item'
        ? 0
        : (movie.artworkLocked ? 8 : 0) +
          (mediaPoster(movie) ? 4 : 0) +
          (movie.localCoverPath ? 2 : 0) +
          (movie.backdropUrl ? 1 : 0)
    const sample = episodes.reduce(
      (best, movie) => (score(movie) > score(best) ? movie : best),
      episodes[0]
    )
    const category: GhostMediaCategory =
      sample.mediaCategory || (sample.isSeries ? 'series' : 'movie')
    const episodic = Boolean(sample.isSeries && category !== 'movie')
    const seasons = new Map<number, GhostMovie[]>()
    for (const episode of episodes) {
      const number = episode.isSpecial ? 0 : (episode.season ?? 1)
      const list = seasons.get(number) || []
      list.push(episode)
      seasons.set(number, list)
    }
    const sorted = Array.from(seasons)
      .sort(([a], [b]) => (a === b ? 0 : a === 0 ? 1 : b === 0 ? -1 : a - b))
      .map(([number, list]) => ({
        seasonNumber: number,
        seasonLabel: number === 0 ? 'Especiais' : `Temporada ${number}`,
        episodes: [...list].sort(
          (a, b) =>
            (a.episode ?? Infinity) - (b.episode ?? Infinity) ||
            a.fileName.localeCompare(b.fileName, 'pt-BR', { numeric: true })
        )
      }))
    return {
      id: episodic ? `show:${key}` : sample.id,
      showTitle: episodic
        ? sample.customShowTitle ||
          sample.showTitle ||
          sample.cleanTitle ||
          sample.title
        : sample.customTitle || sample.title || sample.cleanTitle,
      mediaCategory: category,
      coverUrl: mediaPoster(sample),
      backdropUrl:
        sample.backdropUrl ||
        (sample.localBackdropPath
          ? `imagecache://localhost/${encodeURIComponent(sample.localBackdropPath)}`
          : undefined),
      synopsis: sample.synopsis,
      rating: sample.rating,
      year: sample.year,
      resolution: sample.resolution,
      isSeries: episodic,
      seasonsCount: episodic
        ? sorted.filter((s) => s.seasonNumber > 0).length
        : 0,
      episodesCount: episodes.length,
      seasons: sorted,
      sampleMovie: sample
    }
  }).sort((a, b) =>
    a.showTitle.localeCompare(b.showTitle, 'pt-BR', { numeric: true })
  )
}
