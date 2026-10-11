import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import NativeReleases from '../../../src/frontend/screens/Releases/NativeReleases'
import { RELEASE_CATEGORIES, ReleaseProduct } from '../../../src/common/types/releases'
import { localReleaseDay, releaseTrackingId, RELEASE_TRACKING_KEY } from '../../../src/frontend/helpers/releaseTracking'

const make = (id: string, date?: string): ReleaseProduct => ({
  id, title: `Jogo ${id}`, category: 'games', url: `https://www.releases.com/p/${id}`,
  platforms: ['PC'], dateLabel: date || 'A confirmar', releaseDate: date, region: 'us',
  releases: date ? [{ platform: 'PC', region: 'us', date, dateLabel: date, estimated: false }] : [],
  images: [], videos: [], tags: [], verifiedAt: new Date().toISOString()
})
const offsetDay = (offset: number) => { const date = new Date(); date.setDate(date.getDate() + offset); return localReleaseDay(date) }
const allProducts = [make('antigo', '2001-10-07'), make('sem-data'), make('ontem', offsetDay(-1)), make('hoje', offsetDay(0)), make('futuro-cinco-dias-a', offsetDay(5)), make('futuro-cinco-dias-b', offsetDay(5))]
const scenario = new URLSearchParams(location.search).get('scenario') || 'today'
const products = allProducts.filter(product => scenario === 'today' || (scenario === 'near-past' ? product.id !== 'hoje' : scenario === 'only-past' ? ['antigo', 'ontem'].includes(product.id) : scenario === 'only-future' ? product.id.startsWith('futuro') : product.id === 'sem-data'))
localStorage.setItem('ghost_releases_preferences_v1', JSON.stringify({ category: 'games', platforms: [], region: 'us', layout: 'cards' }))
localStorage.setItem(RELEASE_TRACKING_KEY, JSON.stringify({ version: 1,
  entries: products.map((product, i) => ({ id: releaseTrackingId(product.id, 'PC', 'us'), product, platform: 'PC', region: 'us', followedAt: `2026-10-0${i+1}T12:00:00Z`, updatedAt: new Date().toISOString(), notify: false })), removed: {} }))
;(window as any).api = {
  releasesCatalog: async () => ({ products, filters: RELEASE_CATEGORIES, hasMore: false, fetchedAt: new Date().toISOString(), sourceUrl: 'https://www.releases.com/', stale: false }),
  releasesProduct: async (id: string) => products.find(product => product.id === id),
  releasesDrm: async (query: any) => ({ id: query.id, title: query.title, platform: 'PC', status: 'unknown', checkedAt: new Date().toISOString(), sources: [] }),
  getCloudProviderStatus: async () => ({ connected: false }), syncLocalStorageBackup: async () => undefined,
  storeSet: () => undefined, releasesNotifyToday: async () => undefined
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/releases?view=tracking']}><div className="App"><NativeReleases /></div></MemoryRouter>)
