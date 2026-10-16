export type ReleaseRegion = 'us' | 'uk'
export type ReleaseCollector = 'electron' | 'scrapling' | 'obscura'

export interface ReleaseDate {
  platform: string
  region: ReleaseRegion
  dateLabel: string
  /** Present only when the source supplies an exact calendar date. */
  date?: string
  estimated: boolean
  /** Display ordering for an estimated period; never an exact release/notification date. */
  calendarOrder?: string
}

export interface ReleaseProduct {
  /** Stable Releases.com product slug; never a remote URL supplied by the renderer. */
  id: string
  title: string
  url: string
  category: string
  image?: string
  heroImage?: string
  platforms: string[]
  dateLabel: string
  releaseDate?: string
  calendarOrder?: string
  region: ReleaseRegion
  popularity?: string
  description?: string
  releases: ReleaseDate[]
  images: string[]
  videos: string[]
  tags: string[]
  verifiedAt?: string
  stale?: boolean
  warning?: string
}

export interface ReleaseCategory {
  id: string
  label: string
  platforms: { id: string; label: string }[]
}

export interface ReleaseQuery {
  /** Preferred public-page transport; Electron remains the compatibility fallback. */
  collector?: ReleaseCollector
  category?: string
  platform?: string
  /** Source version labels; multiple selections are combined with OR. */
  platforms?: string[]
  view?: 'calendar' | 'hot'
  interval?: 'week' | 'month' | 'year' | 'all'
  date?: string
  search?: string
  page?: number
  cursor?: string
  tag?: string
  region?: ReleaseRegion
  refresh?: boolean
}

export interface ReleaseCatalog {
  collectionWarning?: string
  products: ReleaseProduct[]
  filters: ReleaseCategory[]
  hasMore: boolean
  nextPage?: number
  nextCursor?: string
  previousCursor?: string
  fetchedAt: string
  sourceUrl: string
  stale: boolean
  warning?: string
}

/** Navigation remains available offline; refreshed from the source when online. */
export const RELEASE_CATEGORIES: ReleaseCategory[] = [
  { id: 'all', label: 'Todos os lançamentos', platforms: [] },
  {
    id: 'games',
    label: 'Jogos',
    platforms: [
      ['pc', 'PC'],
      ['playstation-5', 'PlayStation 5'],
      ['xbox-series-x', 'Xbox Series X'],
      ['switch', 'Switch'],
      ['switch-2', 'Switch 2'],
      ['playstation-4', 'PlayStation 4'],
      ['xbox-one', 'Xbox One'],
      ['pc-early-access', 'PC (Early Access)'],
      ['ios', 'iOS'],
      ['android', 'Android'],
      ['start-date', 'Start Date'],
      ['end-date', 'End Date'],
      ['psvr-2', 'PSVR 2'],
      ['mac', 'Mac'],
      ['linux', 'Linux'],
      ['meta-quest', 'Meta Quest'],
      ['twitch', 'Twitch'],
      ['youtube', 'YouTube'],
      ['psvr2', 'PSVR2'],
      ['pc-steam', 'PC (Steam)'],
      ['oculus-quest', 'Oculus Quest']
    ].map(([id, label]) => ({ id, label }))
  },
  {
    id: 'movies',
    label: 'Filmes',
    platforms: [
      ['cinema', 'Cinema'],
      ['vod', 'VOD'],
      ['dvd', 'DVD'],
      ['blu-ray', 'Blu-ray'],
      ['4k-blu-ray', '4K Blu-ray'],
      ['netflix', 'Netflix'],
      ['amazon', 'Amazon'],
      ['hulu', 'Hulu'],
      ['shudder', 'Shudder'],
      ['lifetime', 'Lifetime'],
      ['paramount-plus', 'Paramount+'],
      ['disney-plus', 'Disney+'],
      ['max', 'Max'],
      ['pbs', 'PBS'],
      ['peacock', 'Peacock'],
      ['apple-tv-plus', 'Apple TV+'],
      ['the-cw', 'The CW'],
      ['bet-plus', 'BET+'],
      ['crunchyroll', 'Crunchyroll'],
      ['hidive', 'HIDIVE']
    ].map(([id, label]) => ({ id, label }))
  },
  {
    id: 'tv-series',
    label: 'Séries',
    platforms: [
      ['netflix', 'Netflix'],
      ['amazon', 'Amazon'],
      ['max', 'Max'],
      ['hulu', 'Hulu'],
      ['disney-plus', 'Disney+'],
      ['apple-tv-plus', 'Apple TV+'],
      ['fox', 'FOX'],
      ['paramount-plus', 'Paramount+'],
      ['peacock', 'Peacock'],
      ['the-cw', 'The CW'],
      ['cbs', 'CBS'],
      ['nbc', 'NBC'],
      ['hgtv', 'HGTV'],
      ['dvd', 'DVD'],
      ['blu-ray', 'Blu-ray'],
      ['pbs', 'PBS'],
      ['abc', 'ABC'],
      ['hbo', 'HBO'],
      ['crunchyroll', 'Crunchyroll'],
      ['starz', 'Starz']
    ].map(([id, label]) => ({ id, label }))
  },
  ...[
    ['movies_tv-series', 'Filmes e séries'],
    ['specials', 'Especiais'],
    ['graphics-cards', 'Placas de vídeo'],
    ['collectibles', 'Colecionáveis'],
    ['smartphones', 'Smartphones'],
    ['boardgames', 'Boardgames'],
    ['game-consoles', 'Consoles'],
    ['monitors', 'Monitores'],
    ['hardwares', 'Hardware'],
    ['laptops', 'Notebooks'],
    ['softwares', 'Software'],
    ['events', 'Eventos'],
    ['board-games', 'Jogos de tabuleiro'],
    ['albums', 'Álbuns'],
    ['mixed-reality-headsets', 'Headsets de realidade mista'],
    ['books', 'Livros'],
    ['processors', 'Processadores'],
    ['televisions', 'Televisores']
  ].map(([id, label]) => ({ id, label, platforms: [] }))
]
