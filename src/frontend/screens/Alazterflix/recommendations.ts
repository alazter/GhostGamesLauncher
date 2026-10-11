import type {
  CinemaLibraryState,
  GhostMediaCategory,
  GhostShow
} from 'common/types/plugins'

export function recommendCatalog(
  shows: GhostShow[],
  history: CinemaLibraryState['playbackHistory']
) {
  const activity = new Map<GhostMediaCategory, number>()
  const candidates = shows.map((show) => {
    const episodes = show.seasons.flatMap((season) => season.episodes)
    const unwatched = episodes.filter((movie) => {
      const playback = history[movie.id] || history[movie.filePath]
      return !(playback?.isWatched ?? movie.isWatched ?? false)
    })
    const hasActivity = episodes.some((movie) => {
      const playback = history[movie.id] || history[movie.filePath]
      return (
        (playback?.isWatched ?? movie.isWatched ?? false) ||
        (playback?.progressSeconds ?? movie.progressSeconds ?? 0) > 0
      )
    })
    if (hasActivity) {
      activity.set(
        show.mediaCategory,
        (activity.get(show.mediaCategory) || 0) + 1
      )
    }
    return { show, unwatched }
  })

  const score = (show: GhostShow) =>
    Math.min(activity.get(show.mediaCategory) || 0, 5) * 2 +
    (Number.parseFloat(show.rating || '') || 0)

  const selected = candidates
    .filter(({ unwatched }) => unwatched.length > 0)
    .sort((a, b) => score(b.show) - score(a.show))
    .slice(0, 20)

  return {
    shows: selected.map(({ show }) => show),
    movies: selected.flatMap(({ unwatched }) => unwatched)
  }
}
