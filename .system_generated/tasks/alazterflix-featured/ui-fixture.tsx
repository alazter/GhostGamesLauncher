import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import Alazterflix from '../../../src/frontend/screens/Alazterflix/index'
import SettingsDialog from '../../../src/frontend/screens/Alazterflix/AlazterflixSettingsDialog'
import '../../../src/frontend/index.scss'
import '../../../src/frontend/themes.scss'

const art = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#233750"/><stop offset="1" stop-color="#050a16"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><circle cx="200" cy="180" r="110" fill="#a8204933"/><text x="200" y="340" text-anchor="middle" font-family="sans-serif" font-size="35" fill="white">AGENT AIKA</text></svg>')
const base = { title: 'Agent Aika', cleanTitle: 'Agent Aika', showTitle: 'Agent Aika', showDirectory: 'T:/Animes/Agent Aika', fileSize: '1 GB', fileSizeBytes: 100, addedAt: '2026-01-01', source: 'local', mediaCategory: 'anime', isSeries: true, season: 1, episode: 1, resolution: '1080p', duration: 1800, durationFormatted: '30 min', year: 1997, metadataProvider: 'tmdb', metadataId: '43249', tmdbRating: 8, rating: '8.0', coverUrl: art }
let state: any = { isPluginActive: true, folders: ['T:/Animes'], addons: [], playbackHistory: {}, metadataSettings: { autoFetch: false, language: 'pt-BR', tmdbConfigured: true }, metadataJob: { libraryRevision: 0, running: false, total: 0, completed: 0, matched: 0, failed: 0, unidentified: 0 }, movies: [
  { ...base, id: 'aika-1', progressSeconds: 300, fileName: 'Aika.S01E01.mkv', filePath: 'T:/Animes/Agent Aika/Aika.S01E01.mkv' },
  { ...base, id: 'aika-2', episode: 2, fileName: 'Aika.S01E02.mkv', filePath: 'T:/Animes/Agent Aika/Aika.S01E02.mkv' },
  ...['series', 'documentary', 'cartoon'].map((mediaCategory) => ({ ...base, id: mediaCategory, title: mediaCategory, cleanTitle: mediaCategory, showTitle: mediaCategory, showDirectory: `T:/${mediaCategory}`, mediaCategory, isSeries: mediaCategory === 'series', fileName: `${mediaCategory}.mkv`, filePath: `T:/${mediaCategory}/${mediaCategory}.mkv` })),
  ...Array.from({ length: 7 }, (_, index) => ({ ...base, id: `random-${index}`, title: `Indicação ${index}`, cleanTitle: `Indicação ${index}`, showTitle: `Indicação ${index}`, showDirectory: `T:/Random/${index}`, isSeries: false, mediaCategory: 'movie', fileName: `${index}.mkv`, filePath: `T:/Random/${index}.mkv` })),
  { ...base, id: 'film', title: 'Filme de teste', cleanTitle: 'Filme de teste', isSeries: false, mediaCategory: 'movie', duration: 7200, durationFormatted: '2h', fileName: 'Filme.mkv', filePath: 'T:/Filmes/Filme.mkv', tmdbRating: undefined, rating: '9.9', metadataProvider: 'cinemeta' }
] }
const clone = (value: any) => JSON.parse(JSON.stringify(value))
const originalMovies = clone(state.movies)
;(window as any).smoke = { updates: [], streams: [], state: () => clone(state), setMovies: (ids: string[]) => { state.movies = originalMovies.filter((movie: any) => ids.includes(movie.id)); (window as any).smoke.reload() } }
;(window as any).api = {
  cinemaGetState: async () => clone(state),
  cinemaGetMetadataStatus: async () => clone(state.metadataJob),
  onPluginsUpdated: (callback: any) => { (window as any).smoke.reload = callback; return () => {} },
  cinemaUpdateMediaPreferences: async (ids: string[], preferences: any) => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    ;(window as any).smoke.updates.push(clone({ ids, preferences }))
    state.movies = state.movies.map((movie: any) => !ids.includes(movie.id) ? movie : { ...movie, ...(Object.hasOwn(preferences, 'userRating') ? { userRating: preferences.userRating ?? undefined } : {}), ...(Object.hasOwn(preferences, 'isWatched') ? { isWatched: preferences.isWatched, manualWatched: preferences.isWatched || undefined } : {}) })
    return clone(state)
  },
  cinemaProbeMedia: async () => ({ duration: 1800, audioTracks: [] }),
  cinemaGetStreamUrl: async (path: string) => { (window as any).smoke.streams.push(path); return 'data:video/mp4;base64,AAAA' },
  cinemaGetSubtitles: async () => [],
  cinemaSaveProgress: async () => {},
  cinemaStremioGetSubtitles: async () => []
}
function Fixture() {
  const [open, setOpen] = React.useState(false)
  ;(window as any).smoke.openDialog = () => setOpen(true)
  return <MemoryRouter><Alazterflix />{open && <SettingsDialog close={() => setOpen(false)} />}</MemoryRouter>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
