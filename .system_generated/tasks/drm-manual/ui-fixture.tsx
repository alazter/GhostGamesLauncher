import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import NativeReleases from '../../../src/frontend/screens/Releases/NativeReleases'
import { RELEASE_CATEGORIES } from '../../../src/common/types/releases'
import { localReleaseDay, releaseTrackingId, RELEASE_TRACKING_KEY } from '../../../src/frontend/helpers/releaseTracking'
const day = localReleaseDay()
const make = (id: string, title: string, category = 'games') => ({ id, title, category, url: `https://www.releases.com/p/${id}`, platforms: ['PC'], dateLabel: day, releaseDate: day, region: 'us', releases: [{ platform: 'PC', region: 'us', date: day, dateLabel: day, estimated: false }], images: [], videos: [], tags: [], verifiedAt: new Date().toISOString() })
const games = [make('minecraft-dungeons-ii', 'Minecraft Dungeons II'), make('persona-3-reload', 'Persona 3 Reload'), make('keep-driving', 'Keep Driving')]
const monitored = make('monitored-only', 'Jogo monitorado fora da página')
const products = [...games, make('movie-test', 'Filme de teste', 'movies')]
localStorage.setItem('ghost_releases_preferences_v1', JSON.stringify({ category: 'games', platforms: [], region: 'us', layout: 'cards' }))
localStorage.setItem(RELEASE_TRACKING_KEY, JSON.stringify({ version: 1, entries: [{ id: releaseTrackingId(monitored.id, 'PC', 'us'), product: monitored, platform: 'PC', region: 'us', followedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notify: false }], removed: {} }))
const smoke = { calls: [] as any[], manualDelay: 180, opened: [] as string[], hizVerified: false, verifyCalls: 0, endCalls: 0 }
;(window as any).smoke = smoke
;(window as any).api = {
  releasesCatalog: async () => ({ products, filters: RELEASE_CATEGORIES, hasMore: false, fetchedAt: new Date().toISOString(), sourceUrl: 'https://www.releases.com/', stale: false }),
  releasesProduct: async (id: string) => [...products, monitored].find((game) => game.id === id),
  releasesDrm: async (query: any) => {
    smoke.calls.push(query)
    if (query.refresh) await new Promise((resolve) => setTimeout(resolve, smoke.manualDelay))
    const status = query.refresh ? 'cracked' : 'uncracked'
    return { id: query.id, title: query.title, platform: 'PC', status, checkedAt: new Date().toISOString(), sources: [{ name: 'IsItCracked', status, url: `https://isitcracked.com/game/${query.id}` }, { name: 'SkidrowReloaded', url: `https://www.skidrowreloaded.com/?s=${encodeURIComponent(query.title)}`, notice: 'Site em manutenção; consulte o link da fonte mais tarde.' }, { name: 'AnkerGames', url: `https://ankergames.net/game/${query.id}`, availability: 'listed' }, { name: 'HizSearch', url: 'https://hizsearch.pages.dev/', requiresVerification: !!query.manual && !smoke.hizVerified, notice: 'Consulta com verificação manual no site.' }] }
  },
  releasesDrmEndManual: async () => { smoke.endCalls++ },
  releasesDrmVerifyHiz: async () => { smoke.verifyCalls++; smoke.hizVerified = true; return true },
  getCloudProviderStatus: async () => ({ connected: false }),
  syncLocalStorageBackup: async () => undefined,
  storeSet: () => undefined,
  releasesNotifyToday: async () => undefined,
  openExternalUrl: async (url: string) => { smoke.opened.push(url) }
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><NativeReleases /></MemoryRouter>)
