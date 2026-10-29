import type { GhostMovie, GhostShow, GhostMediaCategory } from './types/plugins'

export const normalizeMediaTitle = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const CATEGORY_ROOT_NAMES = new Set([
  'filmes',
  'movies',
  'series',
  'shows',
  'anime',
  'animes',
  'desenhos',
  'cartoons',
  'documentarios',
  'documentaries',
  'ova',
  'ovas'
])

export function mediaWorkKey(movie: GhostMovie): string {
  const normPath = (movie.filePath || '').replace(/\\/g, '/')
  const parts = normPath.split('/')
  const root = parts.findIndex((part) =>
    CATEGORY_ROOT_NAMES.has(normalizeMediaTitle(part))
  )
  const directory =
    movie.showDirectory ||
    (root !== -1 && root + 2 < parts.length
      ? parts.slice(0, root + 2).join('/')
      : '')

  const dirParts = directory
    ? directory.replace(/\\/g, '/').split('/').filter(Boolean)
    : []
  const folderName = dirParts.length > 0 ? dirParts[dirParts.length - 1] : ''
  const isDedicatedFolder =
    Boolean(folderName) &&
    !CATEGORY_ROOT_NAMES.has(normalizeMediaTitle(folderName))

  // Se o arquivo estiver dentro de pasta dedicada de obra (ex: Animes/Akira ou Filmes/Avatar (2009)):
  // Todos os arquivos/qualidades dessa mesma pasta pertencem ao mesmo card de obra
  if (isDedicatedFolder) {
    const workTitle = movie.showTitle || folderName
    return [
      directory.replace(/\\/g, '/').toLowerCase(),
      normalizeMediaTitle(workTitle)
    ].join(':')
  }

  // Se for série ou episódico fora de pasta dedicada:
  if (movie.isSeries) {
    return [
      movie.mediaCategory || 'series',
      directory.replace(/\\/g, '/').toLowerCase(),
      normalizeMediaTitle(movie.showTitle || movie.cleanTitle || movie.title)
    ].join(':')
  }

  // Mídias soltas em raiz de categorias (ex: D:/Filmes/Filme1.mkv) sem pasta dedicada: cada arquivo é único
  return `file:${movie.filePath}`
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
        seasonLabel:
          number === 0
            ? 'Especiais'
            : episodic
              ? `Temporada ${number}`
              : episodes.length > 1
                ? 'Versões / Qualidades'
                : `Temporada ${number}`,
        episodes: [...list].sort(
          (a, b) =>
            (a.episode ?? Infinity) - (b.episode ?? Infinity) ||
            a.fileName.localeCompare(b.fileName, 'pt-BR', { numeric: true })
        )
      }))

    const dirParts = (sample.showDirectory || '').replace(/\\/g, '/').split('/').filter(Boolean)
    const folderName = dirParts.length > 0 ? dirParts[dirParts.length - 1] : ''
    const isDedicatedFolder =
      Boolean(folderName) &&
      !CATEGORY_ROOT_NAMES.has(normalizeMediaTitle(folderName))

    const computedTitle = episodic
      ? sample.customShowTitle ||
        sample.showTitle ||
        sample.cleanTitle ||
        sample.title
      : episodes.length > 1
        ? sample.customShowTitle ||
          sample.showTitle ||
          (isDedicatedFolder ? folderName : sample.customTitle || sample.cleanTitle || sample.title)
        : sample.customTitle || sample.title || sample.cleanTitle

    return {
      id: episodic || episodes.length > 1 ? `show:${key}` : sample.id,
      showTitle: computedTitle,
      mediaCategory: category,
      categories:
        sample.categories && sample.categories.length > 0
          ? sample.categories
          : [category],
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
      seasonsCount: episodic ? sorted.filter((s) => s.seasonNumber > 0).length : 0,
      episodesCount: episodes.length,
      seasons: sorted,
      sampleMovie: sample
    }
  }).sort((a, b) =>
    a.showTitle.localeCompare(b.showTitle, 'pt-BR', { numeric: true })
  )
}
