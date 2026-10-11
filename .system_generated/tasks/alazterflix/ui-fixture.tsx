import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import Alazterflix from '../../../src/frontend/screens/Alazterflix/index'
import SettingsDialog from '../../../src/frontend/screens/Alazterflix/AlazterflixSettingsDialog'

const poster = (title: string, color: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="${color}"/><circle cx="200" cy="200" r="100" fill="#ffffff22"/><text x="200" y="405" font-family="sans-serif" font-size="27" text-anchor="middle" fill="white">${title}</text><text x="200" y="450" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">PORTUGUÊS • BRASIL</text></svg>`)
const oldPoster = poster('MATRIX', '#163438')
const newPoster = poster('MATRIX • 1999', '#174829')
const altPoster = poster('MATRIX • BRASIL', '#252746')
const base = { fileSize: '2 GB', fileSizeBytes: 2_000_000_000, addedAt: '2026-10-05', source: 'local', resolution: '1080p', year: 1999, synopsis: 'Sinopse em português do Brasil.', duration: 7200 }
let state: any = {
  isPluginActive: true, folders: ['T:/Multimídia'], addons: [], playbackHistory: {},
  metadataSettings: { autoFetch: true, language: 'pt-BR', tmdbConfigured: true },
  metadataJob: { running: false, total: 0, completed: 0, matched: 0, failed: 0, unidentified: 0 },
  movies: [
    { ...base, id: 'film', title: 'Matrix', cleanTitle: 'Matrix', fileName: 'Matrix.1999.mkv', filePath: 'T:/Multimídia/Filmes/Matrix/Matrix.1999.mkv', mediaCategory: 'movie', isSeries: false, coverUrl: oldPoster },
    ...[1, 2, 0].map((season) => ({ ...base, id: 'ep' + season, title: 'Os Guardiões', cleanTitle: 'Os Guardiões', showTitle: 'Os Guardiões', fileName: `Guardioes.S0${season}E01.mkv`, filePath: `T:/Multimídia/Séries/Os Guardiões/Temporada ${season}/Guardioes.S0${season}E01.mkv`, showDirectory: 'T:/Multimídia/Séries/Os Guardiões', mediaCategory: 'series', isSeries: true, season, episode: 1, isSpecial: season === 0, coverUrl: poster('OS GUARDIÕES', '#38223a') }))
  ]
}
const clone = (value: any) => JSON.parse(JSON.stringify(value))
;(window as any).smoke = { saved: [], newPoster, altPoster }
;(window as any).api = {
  cinemaGetState: async () => clone(state),
  cinemaGetMetadataStatus: async () => ({ ...state.metadataJob, libraryRevision: 0 }),
  onPluginsUpdated: () => () => {},
  cinemaSearchMetadata: async () => [{ provider: 'tmdb', id: '603', title: 'The Matrix', year: 1999, type: 'movie', poster: oldPoster }],
  cinemaMetadataDetails: async () => ({ provider: 'tmdb', id: '603', title: 'The Matrix', year: 1999, type: 'movie', description: 'Sinopse traduzida do Matrix.', poster: newPoster, posters: [newPoster, altPoster], posterLanguage: 'pt', rating: '8.2' }),
  cinemaPickCoverImage: async () => oldPoster,
  cinemaUpdateMovie: async (movie: any, options: any) => {
    (window as any).smoke.saved.push(clone({ movie, options }))
    state.movies = state.movies.map((current: any) => current.id === movie.id ? movie : current)
    return clone(movie)
  },
  cinemaUpdateMetadataSettings: async (settings: any) => { state.metadataSettings = { ...state.metadataSettings, ...settings, tmdbConfigured: true }; delete state.metadataSettings.tmdbToken; return clone(state.metadataSettings) },
  cinemaRefreshMetadata: async (mode: string) => { (window as any).smoke.mode = mode; return clone(state.metadataJob) }
}
function Fixture() {
  const [open, setOpen] = React.useState(false)
  ;(window as any).smoke.openDialog = () => setOpen(true)
  return <MemoryRouter><Alazterflix />{open && <SettingsDialog close={() => setOpen(false)} />}</MemoryRouter>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
