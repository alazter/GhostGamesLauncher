import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faCheck,
  faCloudArrowDown,
  faCompass,
  faFilm,
  faFolderOpen,
  faGear,
  faHardDrive,
  faPlay,
  faPlus,
  faPuzzlePiece,
  faRightFromBracket,
  faRotate,
  faSearch,
  faStar,
  faTv,
  faUserCheck,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import type {
  GhostMovie,
  StremioAccountStatus,
  StremioAddonManifest,
  StremioCalendarEpisode,
  StremioCalendarResult,
  StremioLibraryItem,
  StremioMetaPreview,
  StremioStreamItem
} from 'common/types/plugins'
import StremioLibraryView from './StremioLibraryView'
import StremioCalendarView from './StremioCalendarView'
import StremioDetailModal, { StremioModalTarget } from './StremioDetailModal'
import {
  buildLocalMediaIndex,
  extractImdbId,
  matchStremioItemToLocal
} from './localMediaMatcher'
import './stremioHub.scss'

type StremioSection = 'library' | 'calendar' | 'discover'

interface StremioHubProps {
  addons: StremioAddonManifest[]
  localMovies: GhostMovie[]
  onOpenAddonsSettings: () => void
  onPlayStream: (
    stream: StremioStreamItem,
    meta: StremioMetaPreview,
    episodeInfo?: { videoId: string; season: number; episode: number; title: string }
  ) => Promise<void> | void
  onPlayLocalMovie: (movie: GhostMovie) => Promise<void> | void
  onFeedback?: (msg: string) => void
  onAddonsChanged?: () => Promise<void> | void
}

export default function StremioHub({
  addons,
  localMovies,
  onOpenAddonsSettings,
  onPlayStream,
  onPlayLocalMovie,
  onFeedback,
  onAddonsChanged
}: StremioHubProps) {
  const [section, setSection] = useState<StremioSection>('library')
  const [searchQuery, setSearchQuery] = useState('')

  // Library & Calendar State
  const [library, setLibrary] = useState<StremioLibraryItem[]>([])
  const [calendar, setCalendar] = useState<StremioCalendarResult | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [accountStatus, setAccountStatus] = useState<StremioAccountStatus>({
    connected: false
  })

  // Discover / Catalog State
  const [discoverType, setDiscoverType] = useState<'series' | 'movie' | 'anime'>('series')
  const [discoverCatalogId, setDiscoverCatalogId] = useState<'top' | 'imdbRating'>('top')
  const [discoverItems, setDiscoverItems] = useState<StremioMetaPreview[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)

  // Detail Modal State
  const [modalTarget, setModalTarget] = useState<StremioModalTarget | null>(null)

  // Account Sync Modal State
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [importAccountAddons, setImportAccountAddons] = useState(true)
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  const notify = useCallback(
    (msg: string) => {
      if (onFeedback) onFeedback(msg)
    },
    [onFeedback]
  )

  const refreshLibrary = useCallback(async () => {
    try {
      const items = await window.api.cinemaStremioGetLibrary()
      setLibrary(Array.isArray(items) ? items : [])
      return items || []
    } catch {
      return []
    }
  }, [])

  const refreshCalendar = useCallback(
    async (forceRefresh = false) => {
      try {
        setCalendarLoading(true)
        const result = await window.api.cinemaStremioGetCalendar(forceRefresh)
        setCalendar(result)
        // Reload library so updated `newEpisodesCount` (+4) badges appear immediately
        const freshLib = await window.api.cinemaStremioGetLibrary()
        setLibrary(Array.isArray(freshLib) ? freshLib : [])
        if (forceRefresh) {
          notify(
            `✓ Calendário Stremio atualizado (${result.seriesCount} séries, ${result.episodes.length} episódios catalogados).`
          )
        }
      } catch (err) {
        if (forceRefresh) {
          notify(
            `Erro ao atualizar calendário: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      } finally {
        setCalendarLoading(false)
      }
    },
    [notify]
  )

  // Initial load on mount
  useEffect(() => {
    let active = true
    ;(async () => {
      const [lib, status] = await Promise.all([
        window.api.cinemaStremioGetLibrary().catch(() => []),
        window.api.cinemaStremioGetAccountStatus().catch(() => ({ connected: false }))
      ])
      if (!active) return
      setLibrary(Array.isArray(lib) ? lib : [])
      setAccountStatus(status || { connected: false })
      // Pre-load calendar in background so badges (+4) & calendar tab are ready immediately
      refreshCalendar(false)
    })()
    return () => {
      active = false
    }
  }, [refreshCalendar])

  // Discover catalog loader (supports series, movie, anime & search)
  useEffect(() => {
    if (section !== 'discover') return
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        setDiscoverLoading(true)
        const query = searchQuery.trim()
        const cinemetaAddon =
          addons.find(
            (a) =>
              a.id === 'org.stremio.cinemeta' || a.id === 'com.linvo.cinemeta'
          ) ||
          addons.find((a) => a.isEnabled !== false) ||
          addons[0]

        const animeAddon = addons.find(
          (a) =>
            a.isEnabled !== false &&
            (a.id.toLowerCase().includes('kitsu') ||
              a.types?.includes('anime') ||
              a.catalogs?.some((c) => c.type === 'anime'))
        )

        if (query) {
          // Search across both series and movies so the user finds anything fast
          const targetAddonId =
            discoverType === 'anime' && animeAddon
              ? animeAddon.id
              : cinemetaAddon?.id || 'org.stremio.cinemeta'

          if (discoverType === 'anime' && animeAddon) {
            const animeCat =
              animeAddon.catalogs?.find((c) => c.type === 'anime')?.id || 'kitsu-anime-airing'
            const res = await window.api.cinemaStremioGetCatalog(
              targetAddonId,
              'anime',
              animeCat,
              0,
              query
            )
            if (!cancelled) setDiscoverItems(res?.metas || [])
          } else {
            const [seriesRes, movieRes] = await Promise.all([
              window.api
                .cinemaStremioGetCatalog(
                  cinemetaAddon?.id || 'org.stremio.cinemeta',
                  'series',
                  'top',
                  0,
                  query
                )
                .catch(() => ({ metas: [] })),
              window.api
                .cinemaStremioGetCatalog(
                  cinemetaAddon?.id || 'org.stremio.cinemeta',
                  'movie',
                  'top',
                  0,
                  query
                )
                .catch(() => ({ metas: [] }))
            ])
            const combined =
              discoverType === 'movie'
                ? [...(movieRes?.metas || []), ...(seriesRes?.metas || [])]
                : [...(seriesRes?.metas || []), ...(movieRes?.metas || [])]
            const seen = new Set<string>()
            const unique = combined.filter((m) => {
              if (!m?.id || seen.has(m.id)) return false
              seen.add(m.id)
              return true
            })
            if (!cancelled) setDiscoverItems(unique)
          }
        } else {
          if (discoverType === 'anime' && animeAddon) {
            const animeCat =
              animeAddon.catalogs?.find((c) => c.type === 'anime')?.id || 'kitsu-anime-airing'
            const res = await window.api.cinemaStremioGetCatalog(
              animeAddon.id,
              'anime',
              animeCat,
              0
            )
            if (!cancelled) setDiscoverItems(res?.metas || [])
          } else {
            const effectiveType = discoverType === 'anime' ? 'series' : discoverType
            const extra =
              discoverType === 'anime' ? { genre: 'Animation' } : undefined
            const res = await window.api.cinemaStremioGetCatalog(
              cinemetaAddon?.id || 'org.stremio.cinemeta',
              effectiveType,
              discoverCatalogId,
              0,
              undefined,
              extra
            )
            if (!cancelled) setDiscoverItems(res?.metas || [])
          }
        }
      } catch {
        if (!cancelled) setDiscoverItems([])
      } finally {
        if (!cancelled) setDiscoverLoading(false)
      }
    }, searchQuery.trim() ? 320 : 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [section, discoverType, discoverCatalogId, searchQuery, addons])

  const localMediaIndex = useMemo(
    () => buildLocalMediaIndex(localMovies),
    [localMovies]
  )

  const libraryMap = useMemo(() => {
    const map = new Map<string, StremioLibraryItem>()
    for (const item of library) map.set(item.id, item)
    return map
  }, [library])

  const localImportableItems = useMemo(() => {
    const seen = new Map<
      string,
      {
        id: string
        type: string
        name: string
        poster?: string
        background?: string
        year?: string
        imdbRating?: string
        description?: string
        genres?: string[]
      }
    >()
    for (const m of localMovies || []) {
      if (!m || m.isLiveStream || !m.filePath) continue
      const candidateId =
        extractImdbId(m.imdbId) ||
        (m.metadataId && /^(?:tt\d+|kitsu:\d+)/i.test(m.metadataId)
          ? m.metadataId.trim()
          : null) ||
        extractImdbId(m.filePath)
      if (!candidateId) continue
      if (libraryMap.has(candidateId) || seen.has(candidateId)) continue
      const isSeries =
        m.customIsSeries === true ||
        m.isSeries === true ||
        m.season !== undefined ||
        m.episode !== undefined ||
        ['series', 'anime', 'cartoon'].includes(m.mediaCategory || '')
      seen.set(candidateId, {
        id: candidateId,
        type: m.mediaCategory === 'anime' && candidateId.startsWith('kitsu:') ? 'anime' : isSeries ? 'series' : 'movie',
        name: (isSeries
          ? m.customShowTitle || m.showTitle || m.cleanTitle || m.title
          : m.customTitle || m.cleanTitle || m.title
        ).trim(),
        poster: m.customCoverUrl || m.coverUrl,
        background: m.backdropUrl,
        year: m.year ? String(m.year) : undefined,
        imdbRating: m.rating,
        description: m.synopsis,
        genres: m.genres
      })
    }
    return Array.from(seen.values())
  }, [localMovies, libraryMap])

  const handleImportLocalToLibrary = useCallback(async () => {
    if (localImportableItems.length === 0) return
    let latest = library
    for (const item of localImportableItems) {
      latest = await window.api.cinemaStremioUpsertLibraryItem(item)
    }
    setLibrary(latest)
    notify(
      `✓ ${localImportableItems.length} obra(s) do seu PC importadas para a Biblioteca Stremio!`
    )
    refreshCalendar(false)
  }, [localImportableItems, library, notify, refreshCalendar])

  const seriesCount = useMemo(
    () =>
      library.filter(
        (i) =>
          i.type === 'series' ||
          i.type === 'anime' ||
          i.type === 'tv' ||
          i.id.toLowerCase().startsWith('kitsu:')
      ).length,
    [library]
  )

  const upcomingCount = useMemo(() => {
    if (!calendar?.episodes) return 0
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return calendar.episodes.filter((e) => e.dateKey >= todayKey).length
  }, [calendar])

  const handleAddToLibrary = useCallback(
    async (meta: StremioMetaPreview) => {
      const updated = await window.api.cinemaStremioUpsertLibraryItem({
        id: meta.id,
        type: meta.type || 'movie',
        name: meta.name,
        poster: meta.poster,
        background: meta.background,
        logo: meta.logo,
        year: meta.year !== undefined ? String(meta.year) : undefined,
        imdbRating: meta.imdbRating,
        releaseInfo: meta.releaseInfo,
        description: meta.description,
        genres: meta.genres
      })
      setLibrary(updated)
      notify(`✓ "${meta.name}" adicionado à sua Biblioteca Stremio!`)
      const t = (meta.type || '').toLowerCase()
      if (t === 'series' || t === 'anime' || meta.id.toLowerCase().startsWith('kitsu:')) {
        refreshCalendar(false)
      }
    },
    [notify, refreshCalendar]
  )

  const handleRemoveFromLibrary = useCallback(
    async (id: string) => {
      const existing = libraryMap.get(id)
      const updated = await window.api.cinemaStremioRemoveLibraryItem(id)
      setLibrary(updated)
      if (existing) {
        notify(`"${existing.name}" removido da Biblioteca Stremio.`)
      }
      refreshCalendar(false)
    },
    [libraryMap, notify, refreshCalendar]
  )

  const handleToggleWatched = useCallback(
    async (id: string, isWatched: boolean, videoId?: string) => {
      const updated = await window.api.cinemaStremioToggleWatched(id, isWatched, videoId)
      setLibrary(updated)
      if (videoId) {
        // Update calendar watched state locally right away
        setCalendar((prev) =>
          prev
            ? {
                ...prev,
                episodes: prev.episodes.map((ep) =>
                  ep.seriesId === id && ep.videoId === videoId
                    ? { ...ep, isWatched }
                    : ep
                )
              }
            : prev
        )
      }
    },
    []
  )

  const handleOpenEpisodeFromCalendar = useCallback(
    (ep: StremioCalendarEpisode) => {
      const lib = libraryMap.get(ep.seriesId)
      setModalTarget({
        id: ep.seriesId,
        type: ep.seriesType || lib?.type || 'series',
        name: ep.seriesName,
        poster: ep.seriesPoster || lib?.poster,
        background: ep.seriesBackground || lib?.background,
        year: lib?.year,
        imdbRating: lib?.imdbRating,
        description: lib?.description,
        genres: lib?.genres,
        initialSeason: ep.season,
        initialVideoId: ep.videoId
      })
    },
    [libraryMap]
  )

  const handleLoginAndSync = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountError(null)
    setAccountBusy(true)
    try {
      const res = await window.api.cinemaStremioLoginAndSync(
        loginEmail,
        loginPassword,
        importAccountAddons
      )
      if (!res.success) {
        setAccountError(res.error || 'Falha ao conectar na conta Stremio.')
        return
      }
      if (res.library) setLibrary(res.library)
      if (res.status) setAccountStatus(res.status)
      setLoginPassword('')
      setAccountModalOpen(false)
      if (importAccountAddons && onAddonsChanged) {
        await onAddonsChanged()
      }
      notify(
        `✓ Conta Stremio sincronizada! ${res.importedCount || 0} títulos na biblioteca${res.importedAddons ? ` e ${res.importedAddons} addons importados` : ''}.`
      )
      refreshCalendar(true)
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : String(err))
    } finally {
      setAccountBusy(false)
    }
  }

  const handleQuickAccountSync = async () => {
    setAccountBusy(true)
    try {
      const res = await window.api.cinemaStremioSyncAccount()
      if (!res.success) {
        notify(res.error || 'Erro ao sincronizar conta Stremio.')
        return
      }
      if (res.library) setLibrary(res.library)
      if (res.status) setAccountStatus(res.status)
      notify(`✓ Biblioteca sincronizada (${res.importedCount || 0} títulos).`)
      refreshCalendar(true)
    } finally {
      setAccountBusy(false)
    }
  }

  const handleLogoutAccount = async () => {
    await window.api.cinemaStremioLogoutAccount()
    setAccountStatus({ connected: false })
    setAccountModalOpen(false)
    notify('Conta Stremio desconectada. Seus itens locais foram mantidos.')
  }

  const handlePlayFromModal = useCallback(
    async (
      stream: StremioStreamItem,
      meta: StremioMetaPreview,
      episodeInfo?: { videoId: string; season: number; episode: number; title: string }
    ) => {
      // Ensure the item is tracked with lastWatchedAt in library if it already exists
      if (libraryMap.has(meta.id)) {
        window.api
          .cinemaStremioSaveProgress({
            id: meta.id,
            type: meta.type,
            name: meta.name,
            poster: meta.poster,
            background: meta.background,
            progressSeconds: libraryMap.get(meta.id)?.progressSeconds || 1,
            durationSeconds: libraryMap.get(meta.id)?.durationSeconds || 0,
            videoId: episodeInfo?.videoId
          })
          .then((updated) => setLibrary(updated))
          .catch(() => {})
      }
      await onPlayStream(stream, meta, episodeInfo)
      setModalTarget(null)
    },
    [libraryMap, onPlayStream]
  )

  return (
    <div className="stremio-hub-root">
      {/* Left Vertical Stremio Rail (Matches Screenshots 1 & 2) */}
      <nav className="stremio-rail" aria-label="Navegação Stremio">
        <div className="stremio-rail-brand" title="Stremio Hub · Ghost">
          <FontAwesomeIcon icon={faPlay} />
        </div>

        <button
          type="button"
          className={`stremio-rail-btn ${section === 'discover' ? 'active' : ''}`}
          onClick={() => setSection('discover')}
          title="Explorar Catálogo Stremio (Adicionar Filmes, Séries e Animes)"
          aria-label="Explorar"
        >
          <FontAwesomeIcon icon={faCompass} />
        </button>

        <button
          type="button"
          className={`stremio-rail-btn ${section === 'library' ? 'active' : ''}`}
          onClick={() => setSection('library')}
          title="Biblioteca Stremio"
          aria-label="Biblioteca"
        >
          <FontAwesomeIcon icon={faFolderOpen} />
          {library.length > 0 && (
            <span className="rail-badge">
              {library.length > 99 ? '99+' : library.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`stremio-rail-btn ${section === 'calendar' ? 'active' : ''}`}
          onClick={() => setSection('calendar')}
          title="Calendário de Episódios das suas Séries"
          aria-label="Calendário"
        >
          <FontAwesomeIcon icon={faCalendarDays} />
          {upcomingCount > 0 && (
            <span className="rail-badge">
              {upcomingCount > 99 ? '99+' : upcomingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="stremio-rail-btn"
          onClick={onOpenAddonsSettings}
          title="Gerenciar Addons Stremio"
          aria-label="Addons"
        >
          <FontAwesomeIcon icon={faPuzzlePiece} />
        </button>

        <div className="stremio-rail-spacer" />

        <button
          type="button"
          className="stremio-rail-btn"
          onClick={onOpenAddonsSettings}
          title="Configurações do Stremio"
          aria-label="Configurações Stremio"
        >
          <FontAwesomeIcon icon={faGear} />
        </button>
      </nav>

      {/* Main Content Workspace */}
      <div className="stremio-main">
        {/* Top Bar with Search Pill & Account Sync */}
        <div className="stremio-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#e2e8f0',
                letterSpacing: '0.02em'
              }}
            >
              {section === 'library'
                ? 'Biblioteca'
                : section === 'calendar'
                  ? 'Calendário'
                  : 'Explorar'}
            </span>
          </div>

          <div className="stremio-search-pill">
            <input
              type="text"
              placeholder={
                section === 'library'
                  ? 'Buscar na Biblioteca ou procurar no Stremio...'
                  : section === 'calendar'
                    ? 'Filtrar séries no calendário...'
                    : 'Buscar filmes, séries e animes no Stremio...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && section === 'library' && searchQuery.trim()) {
                  const hasLocalMatch = library.some((i) =>
                    i.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
                  )
                  if (!hasLocalMatch) setSection('discover')
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-icon-btn"
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
            <button
              type="button"
              className="search-icon-btn"
              onClick={() => {
                if (section !== 'discover' && searchQuery.trim()) {
                  setSection('discover')
                }
              }}
              title="Buscar"
            >
              <FontAwesomeIcon icon={faSearch} />
            </button>
          </div>

          <div className="stremio-topbar-actions">
            {accountStatus.connected && (
              <button
                type="button"
                className="stremio-icon-action-btn"
                onClick={handleQuickAccountSync}
                disabled={accountBusy}
                title="Sincronizar biblioteca agora com a conta Stremio"
              >
                <FontAwesomeIcon icon={faRotate} spin={accountBusy} />
              </button>
            )}

            <button
              type="button"
              className={`stremio-account-pill ${accountStatus.connected ? 'connected' : ''}`}
              onClick={() => {
                setAccountError(null)
                setAccountModalOpen(true)
              }}
              title={
                accountStatus.connected
                  ? `Conta Stremio conectada: ${accountStatus.email}`
                  : 'Conectar conta Stremio para importar sua biblioteca e séries'
              }
            >
              <FontAwesomeIcon
                icon={accountStatus.connected ? faUserCheck : faCloudArrowDown}
              />
              <span>
                {accountStatus.connected
                  ? accountStatus.email?.split('@')[0] || 'Stremio Conectado'
                  : 'Conectar Conta Stremio'}
              </span>
            </button>
          </div>
        </div>

        {/* SECTION 1: LIBRARY (SCREENSHOT 1) */}
        {section === 'library' && (
          <StremioLibraryView
            items={library}
            localMediaIndex={localMediaIndex}
            searchQuery={searchQuery}
            onOpenItem={(item) =>
              setModalTarget({
                id: item.id,
                type: item.type,
                name: item.name,
                poster: item.poster,
                background: item.background,
                year: item.year,
                imdbRating: item.imdbRating,
                description: item.description,
                releaseInfo: item.releaseInfo,
                genres: item.genres
              })
            }
            onToggleWatched={(item) => handleToggleWatched(item.id, !item.isWatched)}
            onRemoveItem={(item) => handleRemoveFromLibrary(item.id)}
            onGoDiscover={() => setSection('discover')}
            onOpenAccountSync={() => setAccountModalOpen(true)}
            onImportLocalToLibrary={handleImportLocalToLibrary}
            localImportableCount={localImportableItems.length}
          />
        )}

        {/* SECTION 2: CALENDAR (SCREENSHOT 2) */}
        {section === 'calendar' && (
          <StremioCalendarView
            calendar={calendar}
            localMediaIndex={localMediaIndex}
            loading={calendarLoading}
            seriesCount={seriesCount}
            searchQuery={searchQuery}
            onRefresh={() => refreshCalendar(true)}
            onOpenEpisode={handleOpenEpisodeFromCalendar}
            onGoDiscover={() => {
              setDiscoverType('series')
              setSection('discover')
            }}
            onOpenAccountSync={() => setAccountModalOpen(true)}
          />
        )}

        {/* SECTION 3: DISCOVER / GLOBAL CATALOG */}
        {section === 'discover' && (
          <>
            <div className="stremio-library-filters">
              <div className="stremio-sort-pills">
                <button
                  type="button"
                  className={`stremio-sort-pill ${discoverType === 'series' ? 'active' : ''}`}
                  onClick={() => setDiscoverType('series')}
                >
                  Séries
                </button>
                <button
                  type="button"
                  className={`stremio-sort-pill ${discoverType === 'movie' ? 'active' : ''}`}
                  onClick={() => setDiscoverType('movie')}
                >
                  Filmes
                </button>
                <button
                  type="button"
                  className={`stremio-sort-pill ${discoverType === 'anime' ? 'active' : ''}`}
                  onClick={() => setDiscoverType('anime')}
                >
                  Animes
                </button>
              </div>

              {!searchQuery.trim() && discoverType !== 'anime' && (
                <div className="stremio-sort-pills" style={{ marginLeft: 8 }}>
                  <button
                    type="button"
                    className={`stremio-sort-pill ${discoverCatalogId === 'top' ? 'active' : ''}`}
                    onClick={() => setDiscoverCatalogId('top')}
                  >
                    Populares
                  </button>
                  <button
                    type="button"
                    className={`stremio-sort-pill ${discoverCatalogId === 'imdbRating' ? 'active' : ''}`}
                    onClick={() => setDiscoverCatalogId('imdbRating')}
                  >
                    Mais Bem Avaliados
                  </button>
                </div>
              )}

              <span className="stremio-library-count">
                {discoverLoading
                  ? 'Buscando no Stremio...'
                  : `${discoverItems.length} resultados`}
              </span>
            </div>

            {discoverLoading ? (
              <div className="stremio-empty-box">
                <FontAwesomeIcon icon={faRotate} spin className="empty-ico" />
                <h4>Carregando catálogo Stremio...</h4>
              </div>
            ) : discoverItems.length === 0 ? (
              <div className="stremio-empty-box">
                <FontAwesomeIcon icon={faCompass} className="empty-ico" />
                <h4>Nenhum título encontrado</h4>
                <p>
                  Tente outro termo de busca ou verifique seus addons ativos em Configurações.
                </p>
              </div>
            ) : (
              <div className="stremio-poster-grid">
                {discoverItems.map((item) => {
                  const inLib = libraryMap.has(item.id)
                  const localMatch = matchStremioItemToLocal(localMediaIndex, {
                    id: item.id,
                    type: item.type || discoverType,
                    name: item.name,
                    year: item.year,
                    releaseInfo: item.releaseInfo
                  })
                  const isSeriesItem =
                    item.type === 'series' ||
                    item.type === 'anime' ||
                    item.id.startsWith('kitsu:')

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="stremio-library-card"
                      onClick={() =>
                        setModalTarget({
                          id: item.id,
                          type: item.type || discoverType,
                          name: item.name,
                          poster: item.poster,
                          background: item.background,
                          year: item.year,
                          imdbRating: item.imdbRating,
                          description: item.description,
                          releaseInfo: item.releaseInfo,
                          genres: item.genres
                        })
                      }
                    >
                      <div className="stremio-card-poster-box">
                        {item.poster ? (
                          <img src={item.poster} alt={item.name} loading="lazy" />
                        ) : (
                          <div className="stremio-card-fallback">
                            <FontAwesomeIcon icon={isSeriesItem ? faTv : faFilm} />
                          </div>
                        )}

                        {item.imdbRating && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 7,
                              left: 7,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: 'rgba(15, 20, 26, 0.85)',
                              color: '#fbbf24',
                              fontSize: 10.5,
                              fontWeight: 700,
                              zIndex: 3
                            }}
                          >
                            <FontAwesomeIcon icon={faStar} style={{ marginRight: 3 }} />
                            {item.imdbRating}
                          </div>
                        )}

                        <button
                          type="button"
                          className={`stremio-card-lib-btn ${inLib ? 'in-library' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (inLib) {
                              handleRemoveFromLibrary(item.id)
                            } else {
                              handleAddToLibrary(item)
                            }
                          }}
                          title={
                            inLib
                              ? 'Já está na Biblioteca (clique para remover)'
                              : 'Adicionar à Biblioteca Stremio'
                          }
                        >
                          <FontAwesomeIcon icon={inLib ? faCheck : faPlus} />
                          <span>{inLib ? 'Na Biblioteca' : 'Biblioteca'}</span>
                        </button>

                        {localMatch && (
                          <div
                            className="stremio-local-pc-badge no-progress"
                            title={`Disponível localmente no PC (${localMatch.episodesCount} arquivo(s)${localMatch.bestResolution ? ` · ${localMatch.bestResolution}` : ''})`}
                          >
                            <FontAwesomeIcon icon={faHardDrive} />
                            <span>
                              NO PC{localMatch.isSeries && localMatch.episodesCount > 1 ? ` · ${localMatch.episodesCount}` : ''}
                            </span>
                          </div>
                        )}

                        <div className="stremio-card-play-circle" aria-hidden="true">
                          <FontAwesomeIcon icon={faPlay} />
                        </div>
                      </div>

                      <div className="stremio-card-title">{item.name}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Movie / Series Detail & Streams Modal */}
      {modalTarget && (
        <StremioDetailModal
          target={modalTarget}
          libraryItem={libraryMap.get(modalTarget.id)}
          localMediaIndex={localMediaIndex}
          onClose={() => setModalTarget(null)}
          onAddToLibrary={handleAddToLibrary}
          onRemoveFromLibrary={handleRemoveFromLibrary}
          onToggleWatched={handleToggleWatched}
          onPlayStream={handlePlayFromModal}
          onPlayLocalMovie={onPlayLocalMovie}
        />
      )}

      {/* Stremio Account Sync Modal */}
      {accountModalOpen && (
        <div
          className="stremio-detail-overlay"
          onClick={() => setAccountModalOpen(false)}
        >
          <div
            className="stremio-account-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Sincronizar Conta Stremio"
          >
            <button
              type="button"
              className="stremio-detail-close"
              onClick={() => setAccountModalOpen(false)}
              title="Fechar"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <h3>
              <FontAwesomeIcon
                icon={faCloudArrowDown}
                style={{ color: 'var(--stremio-purple-soft)', marginRight: 8 }}
              />
              Conta Stremio
            </h3>

            {accountStatus.connected ? (
              <>
                <p>
                  Conectado como <strong>{accountStatus.email}</strong>.
                  {accountStatus.lastSyncAt && (
                    <>
                      <br />
                      Última sincronização:{' '}
                      {new Date(accountStatus.lastSyncAt).toLocaleString('pt-BR')} (
                      {accountStatus.syncedItemsCount || library.length} títulos)
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="stremio-primary-btn"
                    onClick={handleQuickAccountSync}
                    disabled={accountBusy}
                  >
                    <FontAwesomeIcon icon={faRotate} spin={accountBusy} />
                    <span>{accountBusy ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                  </button>
                  <button
                    type="button"
                    className="stremio-secondary-btn"
                    onClick={handleLogoutAccount}
                    disabled={accountBusy}
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    <span>Desconectar</span>
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={handleLoginAndSync}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <p>
                  Entre com sua conta oficial do Stremio para importar automaticamente toda a sua <strong>Biblioteca</strong>, progresso assistido e acompanhar suas séries no <strong>Calendário</strong>. Sua chave de sessão é armazenada criptografada no Windows (DPAPI).
                </p>

                <input
                  type="email"
                  required
                  placeholder="E-mail da conta Stremio"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={accountBusy}
                />

                <input
                  type="password"
                  required
                  placeholder="Senha da conta Stremio"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={accountBusy}
                />

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    color: '#d5d7ee',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={importAccountAddons}
                    onChange={(e) => setImportAccountAddons(e.target.checked)}
                    disabled={accountBusy}
                  />
                  <span>Importar também os Addons da minha conta Stremio</span>
                </label>

                {accountError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#fca5a5',
                      background: 'rgba(239, 68, 68, 0.14)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 8,
                      padding: '8px 10px'
                    }}
                  >
                    {accountError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="stremio-secondary-btn"
                    onClick={() => setAccountModalOpen(false)}
                    disabled={accountBusy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="stremio-primary-btn"
                    disabled={accountBusy}
                  >
                    <FontAwesomeIcon
                      icon={accountBusy ? faRotate : faCloudArrowDown}
                      spin={accountBusy}
                    />
                    <span>{accountBusy ? 'Importando...' : 'Conectar & Importar'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
