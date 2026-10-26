import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFilm,
  faFolderPlus,
  faRotate,
  faSearch,
  faPlay,
  faPause,
  faForward,
  faBackward,
  faVolumeHigh,
  faVolumeXmark,
  faExpand,
  faCompress,
  faXmark,
  faStar,
  faCheck,
  faFolder,
  faFolderOpen,
  faPlus,
  faTrashAlt,
  faTv,
  faSlidersH,
  faCirclePlay,
  faCircleInfo,
  faClosedCaptioning,
  faHeadphones,
  faShieldHalved,
  faGlobe,
  faMicrochip,
  faLayerGroup,
  faPuzzlePiece,
  faArrowUp,
  faPenToSquare,
  faTags,
  faFloppyDisk,
  faWandMagicSparkles,
  faImage,
  faVolumeLow,
  faForwardStep,
  faListUl,
  faDownload,
  faSliders,
  faChevronLeft,
  faChevronRight,
  faChevronDown,
  faChevronUp,
  faBarsStaggered,
  faArrowsLeftRight,
  faGear,
  faArrowRight,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons'
import type {
  CinemaLibraryState,
  CinemaMediaPreferences,
  GhostMovie,
  GhostMediaCategory,
  GhostShow,
  CinemaMetadataCandidate,
  StremioMetaPreview,
  StremioStreamItem
} from 'common/types/plugins'
import './index.scss'
import './catalog.scss'
import { groupMoviesIntoShows, mediaPoster } from 'common/mediaCatalog'
import MetadataSettings from './MetadataSettings'
import SubtitleStyleSettings from './SubtitleStyleSettings'
import CategoryShortcuts from './CategoryShortcuts'
import CatalogNavigation, { CatalogCategory } from './CatalogNavigation'
import { recommendCatalog } from './recommendations'
import CatalogPoster from './CatalogPoster'
import { getMediaImageUrl } from './imageUrl'
import useCinemaFavorites from './useCinemaFavorites'
import CatalogCoverSize from './CatalogCoverSize'
import useCinemaCoverSize from './useCinemaCoverSize'
import { observeVideoBuffering } from './videoBuffering'
import useCinemaCardPreferences from './useCinemaCardPreferences'
import CatalogCardSettings from './CatalogCardSettings'
import { mediaTmdbRating } from './cardPreferences'
import useFeaturedCatalog from './useFeaturedCatalog'
import FeaturedArtwork from './FeaturedArtwork'
import alazterflixLogo from 'frontend/assets/alazterflix/logo.png'
import { describeMediaError } from './errors'
import { computeToastDuration, resolveToastIconType } from './toastUtils'
import { openGameFolder } from 'frontend/utils/pathUtils'
import {
  ParsedSubtitleCue,
  parseVttContent,
  findCueAtTime,
  sanitizeSubtitleHtml
} from 'common/subtitleEngine'

export { getMediaImageUrl } from './imageUrl'

const needsPortuguesePoster = (movie: GhostMovie) =>
  Boolean(
    movie.portuguesePosterUnavailable ||
    (movie.artworkLanguage !== 'pt' &&
      !movie.artworkLocked &&
      !movie.customCoverUrl)
  )

interface EditMovieModalProps {
  movie: GhostMovie
  onClose: () => void
  onSave: (updated: GhostMovie, applyCoverToAll?: boolean) => Promise<void>
}

function EditMovieModal({ movie, onClose, onSave }: EditMovieModalProps) {
  const [title, setTitle] = useState(movie.customTitle || movie.title || '')
  const [showTitle, setShowTitle] = useState(movie.showTitle || '')
  const [mediaCategory, setMediaCategory] = useState<GhostMediaCategory>(
    movie.mediaCategory || (movie.isSeries ? 'series' : 'movie')
  )
  const [coverUrl, setCoverUrl] = useState(
    movie.customCoverUrl || movie.coverUrl || ''
  )
  const [backdropUrl, setBackdropUrl] = useState(movie.backdropUrl || '')
  const [artworkLanguage, setArtworkLanguage] = useState(
    movie.artworkLanguage || 'local'
  )
  const [isSeries, setIsSeries] = useState(Boolean(movie.isSeries))
  const [season, setSeason] = useState<string>(
    movie.season !== undefined ? String(movie.season) : ''
  )
  const [applyCoverToAll, setApplyCoverToAll] = useState(
    Boolean(movie.isSeries)
  )
  const [episode, setEpisode] = useState<string>(
    movie.episode !== undefined ? String(movie.episode) : ''
  )
  const [year, setYear] = useState<string>(
    movie.year !== undefined ? String(movie.year) : ''
  )
  const [resolution, setResolution] = useState<string>(
    movie.resolution || '1080p'
  )
  const [synopsis, setSynopsis] = useState(movie.synopsis || '')
  const [rating, setRating] = useState(mediaTmdbRating(movie) || '')
  const [metadataLocked, setMetadataLocked] = useState(
    movie.metadataLocked ?? true
  )
  const [artworkLocked, setArtworkLocked] = useState(
    movie.artworkLocked ?? true
  )
  const [candidates, setCandidates] = useState<CinemaMetadataCandidate[]>([])
  const [identified, setIdentified] = useState<CinemaMetadataCandidate | null>(
    null
  )
  const [isSaving, setIsSaving] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [metadataQuery, setMetadataQuery] = useState(
    movie.showTitle || movie.cleanTitle || movie.title
  )
  const [isSearching, setIsSearching] = useState(false)
  useEffect(() => setImageError(false), [coverUrl])
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null)

  // Resolução automática de links do IMDb para obter imagem de alta resolução e exibir na prévia
  useEffect(() => {
    let isMounted = true
    const trimmed = coverUrl.trim()
    if (
      /https?:\/\/(?:www\.)?imdb\.com\//i.test(trimmed) &&
      !trimmed.includes('m.media-amazon.com/images/M/')
    ) {
      setIsSearching(true)
      setSearchFeedback('Buscando capa em alta resolução no IMDb…')

      window.api
        .cinemaResolveImdbImage(trimmed)
        .then((resolved) => {
          if (!isMounted) return
          if (resolved) {
            setCoverUrl(resolved)
            setImageError(false)
            setArtworkLanguage('local')
            setSearchFeedback(
              '✓ Capa do IMDb encontrada em alta resolução! Clique em Salvar para baixar para a pasta da mídia.'
            )
          } else {
            setSearchFeedback(
              'Não foi possível extrair a imagem do link do IMDb informado. Verifique o link e tente novamente.'
            )
          }
        })
        .catch((err) => {
          if (!isMounted) return
          setSearchFeedback(
            `Erro ao resolver capa do IMDb: ${err instanceof Error ? err.message : String(err)}`
          )
        })
        .finally(() => {
          if (isMounted) setIsSearching(false)
        })
    }

    return () => {
      isMounted = false
    }
  }, [coverUrl])

  const handlePickLocalCover = async () => {
    try {
      const picked = await window.api.cinemaPickCoverImage()
      if (picked) {
        setCoverUrl(picked)
        setArtworkLanguage('local')
      }
    } catch (err) {
      alert(`Falha ao selecionar imagem: ${describeMediaError(err)}`)
    }
  }

  const handleSearchOnlineMetadata = async () => {
    const query = metadataQuery.trim()
    if (!query) return
    setIsSearching(true)
    setSearchFeedback('Buscando obras e capas…')
    try {
      const found = await window.api.cinemaSearchMetadata(
        query,
        isSeries ? 'series' : 'movie'
      )
      setCandidates(found)
      setSearchFeedback(
        found.length
          ? 'Escolha a obra correta pelo título, ano e capa.'
          : 'Nenhuma obra encontrada. Tente o título original ou escolha uma imagem local.'
      )
    } catch (error) {
      setSearchFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível buscar as capas.'
      )
    } finally {
      setIsSearching(false)
    }
  }
  const handleIdentify = async (candidate: CinemaMetadataCandidate) => {
    setIsSearching(true)
    try {
      const details = await window.api.cinemaMetadataDetails(candidate)
      setIdentified(details)
      if (details.poster) {
        setCoverUrl(details.poster)
        setArtworkLanguage(details.posterLanguage || 'local')
      }
      if (details.background) setBackdropUrl(details.background)
      if (details.description) setSynopsis(details.description)
      setRating(details.provider === 'tmdb' ? details.rating || '' : '')
      if (details.year) setYear(String(details.year))
      // Keep the user's Brazilian Portuguese display names when identifying an online work.
      setSearchFeedback(
        details.poster
          ? '✓ Capa em português encontrada. Os nomes do catálogo serão mantidos. Clique em Salvar para aplicar.'
          : 'Identificação escolhida. Esta fonte não oferece uma capa confirmada em português; sua capa atual será mantida. Você pode escolher uma imagem local ou configurar o TMDB.'
      )
    } catch (error) {
      setSearchFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar esta obra.'
      )
    } finally {
      setIsSearching(false)
    }
  }
  const handlePickBackdrop = async () => {
    try {
      const picked = await window.api.cinemaPickCoverImage()
      if (picked) setBackdropUrl(picked)
    } catch (error) {
      setSearchFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível escolher o fundo.'
      )
    }
  }

  const handleOpenFileLocation = () => {
    if (!movie.filePath) return
    try {
      window.api.showItemInFolder(movie.filePath)
    } catch {
      openGameFolder(movie.filePath, true)
    }
  }

  const handleCleanTitleTags = () => {
    const clean = title
      .replace(
        /\b(2160p|1080p|720p|480p|4k|uhd|bluray|blu-ray|bdrip|brrip|web-dl|webrip|web|hdtv|x264|x265|hevc|avc|aac|dts|ac3|atmos|ddp5\.1|dual|dublado|legendado|multi|yts|rarbg|psa|eztv|evo|fg|repack|proper|unrated|extended|remux)\b/gi,
        ''
      )
      .replace(/[._]/g, ' ')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/^[\s._\-–()[\]]+|[\s._\-–()[\]]+$/g, '')
      .trim()
    setTitle(clean)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    const parsedSeason = season.trim() !== '' ? parseInt(season, 10) : undefined
    const parsedEpisode =
      episode.trim() !== '' ? parseInt(episode, 10) : undefined
    const effectiveIsSeries =
      isSeries ||
      parsedEpisode !== undefined ||
      (parsedSeason !== undefined && parsedSeason > 0) ||
      ['series', 'anime', 'cartoon'].includes(mediaCategory)

    const cleanEpTitle =
      title.trim() ||
      (parsedEpisode !== undefined ? `Episódio ${parsedEpisode}` : movie.title)
    const effectiveShowTitle =
      showTitle.trim() ||
      (effectiveIsSeries
        ? movie.showTitle || movie.cleanTitle || cleanEpTitle
        : undefined)

    const parsedRating =
      rating.trim() !== ''
        ? Number(rating.trim().replace(',', '.'))
        : null
    if (
      rating.trim() !== '' &&
      (parsedRating === null ||
        !Number.isFinite(parsedRating) ||
        parsedRating < 0 ||
        parsedRating > 10)
    ) {
      setSearchFeedback(
        'A nota do TMDB deve ser um número entre 0 e 10 (ex: 8.5).'
      )
      setIsSaving(false)
      return
    }
    const validTmdbRating =
      parsedRating !== null && Number.isFinite(parsedRating)
        ? parsedRating
        : null

    const updated: GhostMovie = {
      ...movie,
      title: cleanEpTitle,
      customTitle: cleanEpTitle,
      showTitle: effectiveShowTitle,
      customShowTitle: effectiveShowTitle,
      mediaCategory:
        effectiveIsSeries && mediaCategory === 'movie'
          ? 'series'
          : mediaCategory,
      coverUrl: coverUrl.trim() || undefined,
      customCoverUrl: artworkLocked ? coverUrl.trim() || undefined : undefined,
      metadataLocked,
      artworkLocked,
      metadataProvider: identified?.provider || movie.metadataProvider,
      artworkLanguage,
      metadataId: identified?.id || movie.metadataId,
      imdbId: identified?.imdbId || movie.imdbId,
      backdropUrl:
        backdropUrl.trim() &&
        backdropUrl.trim() !== coverUrl.trim() &&
        !/imdb\.com\/.*\/mediaviewer\/rm/i.test(backdropUrl.trim())
          ? backdropUrl.trim()
          : movie.backdropUrl,
      isSeries: effectiveIsSeries,
      season: effectiveIsSeries
        ? parsedSeason !== undefined
          ? parsedSeason
          : 1
        : undefined,
      episode: effectiveIsSeries ? parsedEpisode : undefined,
      year: year !== '' ? parseInt(year, 10) : undefined,
      resolution,
      synopsis: synopsis.trim() || undefined,
      rating: validTmdbRating !== null ? validTmdbRating.toFixed(1) : undefined,
      tmdbRating: validTmdbRating
    }
    try {
      await onSave(updated, applyCoverToAll)
    } catch (error) {
      setSearchFeedback(
        error instanceof Error ? error.message : 'Não foi possível salvar.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const seasonPreview =
    season !== '' ? `S${String(season).padStart(2, '0')}` : undefined
  const episodePreview =
    episode !== '' ? `E${String(episode).padStart(2, '0')}` : undefined

  return (
    <div className="alazter-modal-overlay alazter-edit-modal-overlay">
      <div className="modal-container alazter-edit-modal">
        <button
          className="modal-close-btn"
          onClick={onClose}
          title="Fechar (ESC)"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className="alazter-edit-header">
          <div className="edit-header-badge">
            <FontAwesomeIcon icon={faPenToSquare} />
          </div>
          <div>
            <h3>Catalogação de Mídia no Ghost</h3>
            <p>
              Edite título, capa, temporada e episódio exclusivamente no Ghost.
              O arquivo original no disco não é renomeado.
            </p>
          </div>
        </div>

        <div className="alazter-physical-file-banner">
          <FontAwesomeIcon icon={faShieldHalved} />
          <div className="path-details">
            <span className="label">Arquivo Físico Original (Windows):</span>
            <code title={movie.filePath}>{movie.filePath}</code>
          </div>
          <button
            type="button"
            className="btn-open-file-location"
            onClick={handleOpenFileLocation}
            title="Abrir pasta e selecionar arquivo no Windows Explorer"
          >
            <FontAwesomeIcon icon={faFolderOpen} />
            <span>Abrir local do arquivo</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="alazter-edit-form">
          <div className="edit-form-grid">
            {/* PREVIEW DA CAPA À ESQUERDA */}
            <div className="edit-poster-preview-col">
              <div className="poster-preview-card">
                {getMediaImageUrl(coverUrl) && !imageError ? (
                  <img
                    src={getMediaImageUrl(coverUrl)}
                    alt="Prévia da Capa"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="poster-empty-preview">
                    <FontAwesomeIcon icon={faFilm} />
                    <span>Sem Capa</span>
                  </div>
                )}
                <div className="poster-preview-badges">
                  <span
                    className={`badge-res ${resolution === '4K' ? 'res-4k' : ''}`}
                  >
                    {resolution}
                  </span>
                  {isSeries && seasonPreview && (
                    <span className="badge-tag badge-season">
                      {seasonPreview}
                    </span>
                  )}
                  {isSeries && episodePreview && (
                    <span className="badge-tag badge-episode">
                      {episodePreview}
                    </span>
                  )}
                </div>
              </div>

              <label className="metadata-search-label">
                Buscar título online ou colar link da capa (IMDb / Web)
                <input
                  value={metadataQuery}
                  onChange={(event) => {
                    const val = event.target.value
                    setMetadataQuery(val)
                    const trimmed = val.trim()
                    if (
                      /https?:\/\/(?:www\.)?imdb\.com\//i.test(trimmed) ||
                      /\.(jpe?g|png|webp)(\?.*)?$/i.test(trimmed)
                    ) {
                      setCoverUrl(trimmed)
                      setArtworkLanguage('local')
                      setSearchFeedback('✓ Link detectado! Aplicando como capa…')
                    }
                  }}
                  placeholder="Ex: 1917, Batman ou https://www.imdb.com/.../rm..."
                />
              </label>
              <div className="poster-action-buttons">
                <button
                  type="button"
                  className="btn-form-action"
                  onClick={handlePickLocalCover}
                  title="Escolher imagem do seu computador"
                >
                  <FontAwesomeIcon icon={faFolder} />
                  <span>Escolher Imagem Local</span>
                </button>
                <button
                  type="button"
                  className="btn-form-action accent"
                  onClick={handleSearchOnlineMetadata}
                  disabled={isSearching}
                  title="Buscar obras para escolher a identificação correta"
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  <span>
                    {isSearching ? 'Buscando…' : 'Identificar e buscar capas'}
                  </span>
                </button>
              </div>

              {/* CAMPOS EXPLÍCITOS DE LINK DE CAPA E IMAGEM DE FUNDO */}
              <div className="form-group form-group-artwork-url" style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                  URL / Link da Capa (Pôster 2:3 ou link IMDb):
                </label>
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value)
                    setArtworkLanguage('local')
                  }}
                  placeholder="https://... ou link IMDb mediaviewer/rm..."
                  style={{
                    fontSize: 12,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--alazter-bg-deep)',
                    border: '1px solid var(--alazter-border-subtle)',
                    color: '#fff'
                  }}
                />
              </div>

              <div className="form-group form-group-artwork-url" style={{ marginTop: 10 }}>
                <div
                  className="label-row"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                    Imagem de Fundo (Backdrop 16:9):
                  </label>
                  <button
                    type="button"
                    className="btn-inline-clean"
                    onClick={handlePickBackdrop}
                    title="Escolher imagem de fundo do seu computador"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--alazter-cyan)',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <FontAwesomeIcon icon={faFolder} />
                    <span>Escolher Fundo PC</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={backdropUrl}
                  onChange={(e) => setBackdropUrl(e.target.value)}
                  placeholder="https://... imagem panorâmica 16:9"
                  style={{
                    fontSize: 12,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--alazter-bg-deep)',
                    border: '1px solid var(--alazter-border-subtle)',
                    color: '#fff'
                  }}
                />
              </div>

              {candidates.length > 0 && (
                <div
                  className="metadata-candidates"
                  aria-label="Obras encontradas"
                >
                  {candidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate.provider + candidate.id}
                      onClick={() => handleIdentify(candidate)}
                      disabled={isSearching}
                      className={
                        identified?.provider === candidate.provider &&
                        identified.id === candidate.id
                          ? 'selected'
                          : ''
                      }
                    >
                      {candidate.poster && (
                        <img
                          src={candidate.poster}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <span>
                        <strong>{candidate.title}</strong>
                        <small>
                          {candidate.year || 'Ano desconhecido'} ·{' '}
                          {candidate.provider === 'tmdb' ? 'TMDB' : 'Cinemeta'}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {identified?.posters && identified.posters.length > 1 && (
                <div
                  className="metadata-image-choices"
                  aria-label="Capas disponíveis"
                >
                  {identified.posters.map((url) => (
                    <button
                      type="button"
                      key={url}
                      className={coverUrl === url ? 'selected' : ''}
                      onClick={() => {
                        setCoverUrl(url)
                        setArtworkLanguage(identified.posterLanguage || 'local')
                      }}
                      aria-label="Escolher esta capa"
                    >
                      <img
                        src={url}
                        alt="Capa alternativa"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
              {identified?.backdrops && identified.backdrops.length > 1 && (
                <div
                  className="metadata-image-choices backdrops"
                  aria-label="Fundos disponíveis"
                >
                  {identified.backdrops.map((url) => (
                    <button
                      type="button"
                      key={url}
                      className={backdropUrl === url ? 'selected' : ''}
                      onClick={() => setBackdropUrl(url)}
                      aria-label="Escolher este fundo"
                    >
                      <img
                        src={url}
                        alt="Fundo alternativo"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
              {searchFeedback && (
                <div
                  className={`search-feedback-box ${searchFeedback.startsWith('✓') ? 'success' : ''}`}
                >
                  {searchFeedback}
                </div>
              )}
            </div>

            {/* CAMPOS À DIREITA */}
            <div className="edit-fields-col">
              {/* TIPO: 5 CATEGORIAS PRINCIPAIS */}
              <div className="form-group-type-selector">
                <label>Categoria Principal da Mídia:</label>
                <div
                  className="category-select-buttons"
                  style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
                >
                  <button
                    type="button"
                    className={`btn-type-pill ${mediaCategory === 'movie' ? 'active' : ''}`}
                    onClick={() => {
                      setMediaCategory('movie')
                      setIsSeries(false)
                    }}
                  >
                    <span>🎬 Filme</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-type-pill ${mediaCategory === 'series' ? 'active' : ''}`}
                    onClick={() => {
                      setMediaCategory('series')
                      setIsSeries(true)
                      if (!showTitle) setShowTitle(title)
                      if (!season) setSeason('1')
                    }}
                  >
                    <span>📺 Série</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-type-pill ${mediaCategory === 'anime' ? 'active' : ''}`}
                    onClick={() => {
                      setMediaCategory('anime')
                      setIsSeries(true)
                      if (!showTitle) setShowTitle(title)
                      if (!season) setSeason('1')
                    }}
                  >
                    <span>⛩️ Anime</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-type-pill ${mediaCategory === 'cartoon' ? 'active' : ''}`}
                    onClick={() => {
                      setMediaCategory('cartoon')
                      setIsSeries(true)
                      if (!showTitle) setShowTitle(title)
                      if (!season) setSeason('1')
                    }}
                  >
                    <span>🎨 Desenho</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-type-pill ${mediaCategory === 'documentary' ? 'active' : ''}`}
                    onClick={() => {
                      setMediaCategory('documentary')
                    }}
                  >
                    <span>🌍 Documentário</span>
                  </button>
                </div>
              </div>

              {/* TIPO: FILME VS SÉRIE */}
              <div className="form-group-type-selector">
                <label>Formato de Exibição:</label>
                <div className="type-toggle-buttons">
                  <button
                    type="button"
                    className={`btn-type-pill ${!isSeries ? 'active' : ''}`}
                    onClick={() => setIsSeries(false)}
                  >
                    <FontAwesomeIcon icon={faFilm} />
                    <span>Filme / documentário único</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-type-pill ${isSeries ? 'active' : ''}`}
                    onClick={() => {
                      setIsSeries(true)
                      if (mediaCategory === 'movie') setMediaCategory('series')
                      if (!showTitle) setShowTitle(title)
                      if (!season) setSeason('1')
                    }}
                  >
                    <FontAwesomeIcon icon={faTv} />
                    <span>Série / Anime / Episódios</span>
                  </button>
                </div>
              </div>

              {/* CAMPOS ESPECÍFICOS DE SÉRIE / EPISÓDIOS OU FILME ÚNICO */}
              {isSeries ? (
                <div className="alazter-series-fields-group">
                  <div className="form-group">
                    <label>Nome da Obra / Série (Agrupamento no Ghost):</label>
                    <input
                      type="text"
                      value={showTitle}
                      onChange={(e) => setShowTitle(e.target.value)}
                      placeholder="Ex: Police Squad!, Breaking Bad, Kimetsu no Yaiba..."
                    />
                  </div>

                  <div className="form-row-2col">
                    <div className="form-group">
                      <label>Temporada (Season):</label>
                      <div className="input-with-tag-prefix">
                        <span className="input-tag-badge badge-season">S</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={season}
                          onChange={(e) => setSeason(e.target.value)}
                          placeholder="Ex: 1"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Número do Episódio (Episode):</label>
                      <div className="input-with-tag-prefix">
                        <span className="input-tag-badge badge-episode">E</span>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={episode}
                          onChange={(e) => setEpisode(e.target.value)}
                          placeholder="Ex: 1, 2, 5..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="label-row">
                      <label>Nome / Título do Episódio:</label>
                      <button
                        type="button"
                        className="btn-inline-clean"
                        onClick={handleCleanTitleTags}
                        title="Remover tags de release como 1080p, x264, etc."
                      >
                        <FontAwesomeIcon icon={faTags} />
                        <span>Limpar Tags de Release</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Piloto, A Volta do Esquadrão, Episódio 1..."
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="alazter-movie-fields-group">
                  <div className="form-group">
                    <div className="label-row">
                      <label>Título do Filme / Documentário:</label>
                      <button
                        type="button"
                        className="btn-inline-clean"
                        onClick={handleCleanTitleTags}
                        title="Remover tags de release como 1080p, x264, etc."
                      >
                        <FontAwesomeIcon icon={faTags} />
                        <span>Limpar Tags de Release</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: 1917, Interestelar, Oppenheimer..."
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-toggle-to-series"
                    onClick={() => {
                      setIsSeries(true)
                      setMediaCategory('series')
                      if (!showTitle) setShowTitle(title)
                      if (!season) setSeason('1')
                      if (!episode) setEpisode('1')
                    }}
                    title="Definir este arquivo como episódio de uma série ou anime"
                  >
                    <FontAwesomeIcon icon={faTv} />
                    <span>É um episódio de série ou anime? Definir número e nome do episódio</span>
                  </button>
                </div>
              )}

              {/* LINHA DE DETALHES TÉCNICOS */}
              <div className="form-row-3col">
                <div className="form-group">
                  <label>Ano:</label>
                  <input
                    type="number"
                    min="1900"
                    max="2099"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2024"
                  />
                </div>
                <div className="form-group">
                  <label>Resolução:</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  >
                    <option value="4K">4K UHD</option>
                    <option value="1080p">1080p FHD</option>
                    <option value="720p">720p HD</option>
                    <option value="HD">HD</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nota TMDB (0 a 10):</label>
                  <input
                    type="text"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    placeholder="Ex: 8.5"
                    title="Editar nota do TMDB (número de 0 a 10, ex: 8.5)"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Sinopse / Descrição:</label>
                <textarea
                  rows={3}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Resumo do filme ou episódio..."
                />
              </div>

              <div className="metadata-locks">
                <label>
                  <input
                    type="checkbox"
                    checked={artworkLocked}
                    onChange={(event) => setArtworkLocked(event.target.checked)}
                  />{' '}
                  Proteger minhas capas e imagens de fundo
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={metadataLocked}
                    onChange={(event) =>
                      setMetadataLocked(event.target.checked)
                    }
                  />{' '}
                  Proteger título, categoria e numeração que editei
                </label>
              </div>
              {isSeries && (
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--alazter-cyan)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={applyCoverToAll}
                      onChange={(e) => setApplyCoverToAll(e.target.checked)}
                    />
                    <span>
                      Aplicar capa, fundo e identificação a todos os episódios
                      de &quot;{showTitle || title}&quot;
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="alazter-edit-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-save-ghost"
              disabled={isSaving || isSearching}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />
              <span>{isSaving ? 'Salvando…' : 'Salvar no Ghost'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ShowDetailsModalProps {
  show: GhostShow
  onClose: () => void
  onPlayEpisode: (movie: GhostMovie) => void
  onEditMovie: (movie: GhostMovie) => void
  onEnrichShow: (movieId: string) => void
}

function ShowDetailsModal({
  show,
  onClose,
  onPlayEpisode,
  onEditMovie,
  onEnrichShow
}: ShowDetailsModalProps) {
  // Inicializa com a primeira temporada válida (> 0 se houver)
  const initialSeasonNumber = useMemo(() => {
    const firstPositive = show.seasons.find((s) => s.seasonNumber > 0)
    return firstPositive
      ? firstPositive.seasonNumber
      : (show.seasons[0]?.seasonNumber ?? 1)
  }, [show.seasons])

  const [activeSeasonNumber, setActiveSeasonNumber] =
    useState<number>(initialSeasonNumber)

  useEffect(() => {
    setActiveSeasonNumber(initialSeasonNumber)
  }, [show.id, initialSeasonNumber])

  const activeSeason = useMemo(() => {
    return (
      show.seasons.find((s) => s.seasonNumber === activeSeasonNumber) ||
      show.seasons[0]
    )
  }, [show.seasons, activeSeasonNumber])

  const catInfo = useMemo(() => {
    switch (show.mediaCategory) {
      case 'anime':
        return { label: '⛩️ Anime', className: 'badge-cat-anime' }
      case 'series':
        return { label: '📺 Série', className: 'badge-cat-series' }
      case 'cartoon':
        return { label: '🎨 Desenho', className: 'badge-cat-cartoon' }
      case 'documentary':
        return { label: '🌍 Doc', className: 'badge-cat-doc' }
      case 'movie':
      default:
        return { label: '🎬 Filme', className: 'badge-cat-movie' }
    }
  }, [show.mediaCategory])

  const firstPlayableEpisode = useMemo(() => {
    if (activeSeason && activeSeason.episodes.length > 0) {
      return activeSeason.episodes[0]
    }
    return show.sampleMovie
  }, [activeSeason, show.sampleMovie])

  return (
    <div className="alazter-modal-overlay alazter-show-modal-overlay">
      <div className="modal-container alazter-show-modal">
        <button
          className="modal-close-btn"
          onClick={onClose}
          title="Fechar (ESC)"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {/* HERO PANORÂMICO DA OBRA */}
        <div className="modal-hero-cover show-hero-cover">
          {getMediaImageUrl(
            show.backdropUrl ||
              (show.sampleMovie.localBackdropPath
                ? `imagecache://localhost/${encodeURIComponent(show.sampleMovie.localBackdropPath)}`
                : undefined) ||
              show.sampleMovie.backdropUrl ||
              show.coverUrl
          ) ? (
            <img
              src={getMediaImageUrl(
                show.backdropUrl ||
                  (show.sampleMovie.localBackdropPath
                    ? `imagecache://localhost/${encodeURIComponent(show.sampleMovie.localBackdropPath)}`
                    : undefined) ||
                  show.sampleMovie.backdropUrl ||
                  show.coverUrl
              )}
              alt="Backdrop"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle, #1a2230, #0a0e14)'
              }}
            />
          )}
          <div className="modal-cover-gradient" />
        </div>

        <div className="modal-body show-modal-body">
          <div className="modal-poster-col show-poster-col">
            {getMediaImageUrl(
              show.coverUrl ||
                (show.sampleMovie.localCoverPath
                  ? `imagecache://localhost/${encodeURIComponent(show.sampleMovie.localCoverPath)}`
                  : undefined) ||
                show.sampleMovie.coverUrl
            ) ? (
              <img
                src={getMediaImageUrl(
                  show.coverUrl ||
                    (show.sampleMovie.localCoverPath
                      ? `imagecache://localhost/${encodeURIComponent(show.sampleMovie.localCoverPath)}`
                      : undefined) ||
                    show.sampleMovie.coverUrl
                )}
                alt={show.showTitle}
              />
            ) : (
              <div
                style={{
                  aspectRatio: '2/3',
                  background: '#1a2230',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)'
                }}
              >
                <FontAwesomeIcon
                  icon={show.isSeries ? faTv : faFilm}
                  style={{ fontSize: 36 }}
                />
              </div>
            )}
          </div>

          <div className="modal-info-col show-info-col">
            <h2>{show.showTitle}</h2>
            <div className="modal-badges-row">
              <span className={`tag-badge ${catInfo.className}`}>
                {catInfo.label}
              </span>
              <span className="tag-badge tag-4k">
                {show.resolution || '1080p'} REMUX
              </span>
              {mediaTmdbRating(show.sampleMovie) !== undefined && (
                <span className="tag-badge tag-rating">
                  <FontAwesomeIcon icon={faStar} /> {mediaTmdbRating(show.sampleMovie)} · TMDB
                </span>
              )}
              {show.sampleMovie.userRating !== undefined && <span className="tag-badge tag-rating">Sua nota: {show.sampleMovie.userRating}/10</span>}
              <span className="tag-badge badge-summary">
                {show.isSeries || show.episodesCount > 1
                  ? `${show.seasonsCount} ${show.seasonsCount === 1 ? 'Temporada' : 'Temporadas'} • ${show.episodesCount} Episódios`
                  : 'Filme Standalone'}
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--alazter-text-muted)' }}
              >
                {show.year || show.sampleMovie.year || 'Ano desconhecido'}
              </span>
            </div>

            <p className="modal-synopsis show-synopsis">
              {show.synopsis ||
                show.sampleMovie.synopsis ||
                'Obra catalogada na biblioteca Alazterflix pronta para reprodução acelerada por GPU.'}
            </p>

            <div className="modal-actions-bar show-actions-bar">
              <button
                className="btn-play-modal"
                onClick={() => onPlayEpisode(firstPlayableEpisode)}
              >
                <FontAwesomeIcon icon={faPlay} />
                <span>
                  {show.isSeries || show.episodesCount > 1
                    ? `Reproduzir ${firstPlayableEpisode.episode !== undefined ? `E${String(firstPlayableEpisode.episode).padStart(2, '0')}` : 'Primeiro Episódio'}`
                    : 'Reproduzir Filme'}
                </span>
              </button>
              <button
                className="btn-secondary-hero btn-edit-metadata"
                onClick={() => onEditMovie(firstPlayableEpisode)}
                title="Editar informações catalogadas no Ghost"
              >
                <FontAwesomeIcon icon={faPenToSquare} />
                <span>Editar capa e informações</span>
              </button>
              <button
                className="btn-secondary-hero"
                onClick={() => onEnrichShow(show.sampleMovie.id)}
                title="Atualizar informações e preencher capas ausentes"
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} />
                <span>Buscar Capa</span>
              </button>
              <button className="btn-secondary-hero" onClick={onClose}>
                <FontAwesomeIcon icon={faCheck} />
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
           SELETOR DE TEMPORADAS HORIZONTAL E LISTA DE EPISÓDIOS (JELLYFIN STYLE)
           ========================================================================= */}
        {show.seasons.length > 0 &&
          (show.isSeries || show.episodesCount > 1) && (
            <div className="show-seasons-section">
              <div className="show-seasons-tabs-bar">
                <div className="seasons-label">
                  <FontAwesomeIcon icon={faTv} />
                  <span>Temporadas:</span>
                </div>
                <div className="seasons-tabs-list">
                  {show.seasons.map((season) => {
                    const isActive = season.seasonNumber === activeSeasonNumber
                    return (
                      <button
                        key={season.seasonNumber}
                        type="button"
                        className={`season-tab-btn ${isActive ? 'active' : ''}`}
                        onClick={() =>
                          setActiveSeasonNumber(season.seasonNumber)
                        }
                      >
                        <span>{season.seasonLabel}</span>
                        <span className="season-count-pill">
                          {season.episodes.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* LISTA DE EPISÓDIOS DA TEMPORADA SELECIONADA */}
              {activeSeason && (
                <div className="show-episodes-wrapper">
                  <div className="season-episodes-header">
                    <h4>
                      {activeSeason.seasonLabel} &bull;{' '}
                      {activeSeason.episodes.length} Episódios
                    </h4>
                  </div>
                  <div className="season-episodes-list">
                    {activeSeason.episodes.map((ep) => {
                      const epDisplay =
                        ep.customTitle || ep.title || ep.fileName
                      const epTag =
                        ep.episode !== undefined
                          ? `E${String(ep.episode).padStart(2, '0')}`
                          : undefined
                      const sTag =
                        ep.season !== undefined
                          ? `S${String(ep.season).padStart(2, '0')}`
                          : undefined

                      return (
                        <div key={ep.id} className="episode-item-card">
                          <div className="ep-num-box">{epTag || 'EP'}</div>
                          <div className="ep-info-box">
                            <div className="ep-title-row">
                              <span className="ep-title-text" title={epDisplay}>
                                {epDisplay}
                              </span>
                              <span
                                className={`ep-res-badge ${ep.resolution === '4K' ? 'res-4k' : ''}`}
                              >
                                {ep.resolution || '1080p'}
                              </span>
                            </div>
                            <div className="ep-meta-row">
                              <span>
                                {sTag ? `${sTag} ` : ''}
                                {epTag || ''}
                              </span>
                              <span>{ep.fileSize || 'MKV'}</span>
                              <span
                                className="ep-file-path"
                                title={ep.filePath}
                              >
                                {ep.fileName}
                              </span>
                            </div>
                          </div>
                          <div className="ep-actions-box">
                            <button
                              type="button"
                              className="btn-play-ep"
                              onClick={() => onPlayEpisode(ep)}
                              title={`Assistir ${epDisplay}`}
                            >
                              <FontAwesomeIcon icon={faPlay} />
                              <span>Assistir</span>
                            </button>
                            <button
                              type="button"
                              className="btn-edit-ep"
                              onClick={() => onEditMovie(ep)}
                              title="Editar metadados deste episódio no Ghost"
                            >
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}

export default function AlazterflixScreen() {
  const { favorites, toggleFavorite } = useCinemaFavorites()
  const { cardPreferences } = useCinemaCardPreferences()
  const [showAllContinue, setShowAllContinue] = useState(false)
  const [clearingContinue, setClearingContinue] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'local' | 'stremio' | 'addons' | 'settings'
  >('local')
  const [state, setState] = useState<CinemaLibraryState>({
    isPluginActive: false,
    folders: [],
    movies: [],
    addons: [],
    playbackHistory: {}
  })
  const [, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter] = useState<
    'all' | 'movies' | 'series' | '4k' | '1080p' | 'unwatched' | 'watched'
  >('all')
  const [selectedCategory, setSelectedCategory] =
    useState<CatalogCategory>('all')
  const { coverSize, changeCoverSize } = useCinemaCoverSize(
    activeTab === 'stremio' ? 'stremio' : selectedCategory
  )
  const [selectedQualityFilter, setSelectedQualityFilter] = useState<
    | 'all'
    | '4k'
    | '1080p'
    | 'unwatched'
    | 'watched'
    | 'missingArtwork'
    | 'unidentified'
    | 'portugueseArtwork'
  >('all')
  const [viewMode, setViewMode] = useState<'shows' | 'allFiles'>('shows')

  // Debounce da pesquisa por 150ms para eliminar qualquer travamento ao digitar
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 150)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Selected Show for Jellyfin series/anime view modal
  const [selectedShow, setSelectedShow] = useState<GhostShow | null>(null)
  // Selected Movie for details modal
  const [selectedMovie, setSelectedMovie] = useState<GhostMovie | null>(null)
  // Editing Movie for metadata/catalog modal
  const [editingMovie, setEditingMovie] = useState<GhostMovie | null>(null)
  const [isCataloging, setIsCataloging] = useState(false)
  const [catalogFeedback, setCatalogFeedback] = useState<string | null>(null)

  // Auto-dismiss do feedback de catálogo para não ficar travado na tela para sempre
  useEffect(() => {
    if (!catalogFeedback) return

    const timeoutMs = computeToastDuration(catalogFeedback)
    const timer = setTimeout(() => {
      setCatalogFeedback(null)
    }, timeoutMs)

    return () => clearTimeout(timer)
  }, [catalogFeedback])

  // Stremio Catalog state
  const [stremioCatalog, setStremioCatalog] = useState<StremioMetaPreview[]>([])
  const [selectedCatalogId, setSelectedCatalogId] = useState('top')
  const [stremioSearch, setStremioSearch] = useState('')
  const [stremioLoading, setStremioLoading] = useState(false)
  const [selectedStremioItem, setSelectedStremioItem] =
    useState<StremioMetaPreview | null>(null)
  const [availableStreams, setAvailableStreams] = useState<StremioStreamItem[]>(
    []
  )
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [newAddonUrl, setNewAddonUrl] = useState('')

  // Active Video Player state
  const [playerMovie, setPlayerMovie] = useState<{
    title: string
    streamUrl: string
    movieId: string
    initialProgress?: number
    duration?: number
    coverUrl?: string
    backdropUrl?: string
    resolution?: string
    season?: number
    episode?: number
    showTitle?: string
    mediaCategory?: GhostMediaCategory
    filePath?: string
    imdbId?: string
    movie?: GhostMovie
  } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('alazterflix_player_volume')
    return saved !== null ? Math.max(0, Math.min(1, Number(saved))) : 1
  })
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)

  // Subtitles & Audio States
  const [subtitlesMenuOpen, setSubtitlesMenuOpen] = useState(false)
  const [subtitlesTab, setSubtitlesTab] = useState<'local' | 'remote' | 'settings'>('local')
  const [subtitlesList, setSubtitlesList] = useState<{
    local: Array<{
      name: string
      filePath: string
      lang: string
      streamUrl: string
      isDefault?: boolean
    }>
    remote: Array<{
      id: string
      name: string
      lang: string
      streamUrl: string
      format?: string
    }>
  }>({ local: [], remote: [] })
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [activeSubtitleUrl, setActiveSubtitleUrl] = useState<string | null>(null)
  const [activeSubtitleLabel, setActiveSubtitleLabel] = useState<string>('Desativada')
  const [subtitleDelay, setSubtitleDelay] = useState(0)
  const subtitleDelayRef = useRef(0)
  const [customDelayInput, setCustomDelayInput] = useState('')
  const [subtitleToast, setSubtitleToast] = useState<string | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    subtitleDelayRef.current = subtitleDelay
  }, [subtitleDelay])

  // Motor dedicado de renderização de legendas (Cinema Overlay)
  const parsedCuesRef = useRef<ParsedSubtitleCue[]>([])
  const subtitleCuesCacheRef = useRef<Map<string, ParsedSubtitleCue[]>>(new Map())
  const [activeCueText, setActiveCueText] = useState<string | null>(null)
  const currentCueTextRef = useRef<string | null>(null)

  // Audio Tracks state (Dual Audio support & Codec Probing)
  const [audioMenuOpen, setAudioMenuOpen] = useState(false)
  const [audioTracks, setAudioTracks] = useState<
    Array<{
      index: number
      id: string
      label: string
      language: string
      codec?: string
      channels?: number
      isSupported?: boolean
      enabled: boolean
    }>
  >([])
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0)
  const isTranscodingRef = useRef(false)
  const streamStartTimeRef = useRef(0)
  const durationRef = useRef(0)
  const seekToTimeRef = useRef<(t: number) => void>(() => {})

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  // Subtitle Customization Studio State (Stremio Style)
  const [subFontSize, setSubFontSize] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
      if (saved) return JSON.parse(saved).fontSize || '24px'
    } catch {}
    return '24px'
  })
  const [subColor, setSubColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
      if (saved) return JSON.parse(saved).color || '#ffffff'
    } catch {}
    return '#ffffff'
  })
  const [subBgStyle, setSubBgStyle] = useState<'shadow' | 'box'>(() => {
    try {
      const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
      if (saved) return JSON.parse(saved).bgStyle || 'shadow'
    } catch {}
    return 'shadow'
  })
  const [subPosition, setSubPosition] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.position === 'number') {
          // Migração automática do valor antigo 85 (excessivamente baixo) para 78 (cinema padrão)
          return parsed.position === 85 ? 78 : parsed.position
        }
      }
    } catch {}
    return 78
  })

  const loadAndApplySavedSubSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.fontSize) setSubFontSize(parsed.fontSize)
        if (parsed.color) setSubColor(parsed.color)
        if (parsed.bgStyle) setSubBgStyle(parsed.bgStyle)
        if (typeof parsed.position === 'number') {
          setSubPosition(parsed.position === 85 ? 78 : parsed.position)
        }
      }
    } catch (err) {
      console.warn('[Alazterflix] Erro ao carregar configurações de legenda:', err)
    }
  }, [])

  const saveSubSettings = useCallback(
    (
      updates: Partial<{
        fontSize: string
        color: string
        bgStyle: 'shadow' | 'box'
        position: number
      }>
    ) => {
      try {
        let current: any = {}
        try {
          const raw = localStorage.getItem('ghost_alazterflix_sub_settings')
          if (raw) current = JSON.parse(raw)
        } catch {}

        const next = {
          fontSize:
            updates.fontSize !== undefined
              ? updates.fontSize
              : current.fontSize || subFontSize,
          color:
            updates.color !== undefined
              ? updates.color
              : current.color || subColor,
          bgStyle:
            updates.bgStyle !== undefined
              ? updates.bgStyle
              : current.bgStyle || subBgStyle,
          position:
            updates.position !== undefined
              ? updates.position
              : typeof current.position === 'number'
                ? current.position
                : subPosition
        }

        localStorage.setItem(
          'ghost_alazterflix_sub_settings',
          JSON.stringify(next)
        )
        // Dispara evento 'storage' para sincronizar com todos os componentes e abas
        window.dispatchEvent(new Event('storage'))
      } catch (err) {
        console.warn('[Alazterflix] Erro ao persistir configurações de legenda:', err)
      }
    },
    [subFontSize, subColor, subBgStyle, subPosition]
  )

  // Sincronização reativa dos estilos de legenda com o painel de configurações
  useEffect(() => {
    const handleStorageChange = () => {
      loadAndApplySavedSubSettings()
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [loadAndApplySavedSubSettings])

  // Assegura que todo novo vídeo aberto herde rigorosamente os estilos e posições salvos
  useEffect(() => {
    if (!playerMovie) return
    loadAndApplySavedSubSettings()
  }, [playerMovie?.streamUrl, playerMovie?.movieId, loadAndApplySavedSubSettings])

  // Episodes Drawer state
  const [episodesDrawerOpen, setEpisodesDrawerOpen] = useState(false)
  const [drawerSeasonNumber, setDrawerSeasonNumber] = useState<number>(1)
  const drawerOpenedByHoverRef = useRef<boolean>(false)
  const drawerCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const seasonsBarRef = useRef<HTMLDivElement | null>(null)
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null)
  const [edgeArrowTabVisible, setEdgeArrowTabVisible] = useState(false)
  const edgeTabTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Layout de exibição de temporadas na gaveta ('dropdown' | 'pills' | 'accordion' | 'stepper')
  // Default: 'stepper' (Stepper Sequencial Cyber Neon < 3ª TEMPORADA >)
  const [seasonDrawerLayout, setSeasonDrawerLayout] = useState<
    'dropdown' | 'pills' | 'accordion' | 'stepper'
  >(() => {
    return (
      (localStorage.getItem(
        'ghost_alazterflix_season_drawer_layout'
      ) as 'dropdown' | 'pills' | 'accordion' | 'stepper') || 'stepper'
    )
  })
  const [customSeasonDropdownOpen, setCustomSeasonDropdownOpen] =
    useState(false)
  const [accordionOpenSeasons, setAccordionOpenSeasons] = useState<
    Record<number, boolean>
  >({})

  const handleUpdateSeasonDrawerLayout = useCallback(
    (layout: 'dropdown' | 'pills' | 'accordion' | 'stepper') => {
      setSeasonDrawerLayout(layout)
      localStorage.setItem('ghost_alazterflix_season_drawer_layout', layout)
      window.dispatchEvent(new Event('storage'))
    },
    []
  )

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'ghost_alazterflix_season_drawer_layout' &&
        e.newValue &&
        ['dropdown', 'pills', 'accordion', 'stepper'].includes(e.newValue)
      ) {
        setSeasonDrawerLayout(e.newValue as 'dropdown' | 'pills' | 'accordion' | 'stepper')
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    if (drawerSeasonNumber !== undefined) {
      setAccordionOpenSeasons((prev) => ({
        ...prev,
        [drawerSeasonNumber]: true
      }))
    }
  }, [drawerSeasonNumber])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial cinema state from backend plugin
  const loadCinemaState = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.cinemaGetState()
      setState(
        data || {
          isPluginActive: false,
          folders: [],
          movies: [],
          addons: [],
          playbackHistory: {}
        }
      )
    } catch (err) {
      console.error('[Alazterflix] Falha ao carregar estado:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCinemaState()

    let removeListener: (() => void) | undefined
    if (window.api?.onPluginsUpdated) {
      removeListener = window.api.onPluginsUpdated(() => {
        loadCinemaState()
      })
    }

    return () => {
      if (typeof removeListener === 'function') removeListener()
    }
  }, [loadCinemaState])

  const metadataRevision = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!state.isPluginActive) return
    let disposed = false
    let polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const job = await window.api.cinemaGetMetadataStatus()
        if (disposed) return
        if (metadataRevision.current !== job.libraryRevision) {
          const data = await window.api.cinemaGetState()
          if (disposed) return
          metadataRevision.current = data.metadataJob?.libraryRevision
          setState(data)
        } else setState((previous) => ({ ...previous, metadataJob: job }))
      } catch (error) {
        if (!disposed)
          setCatalogFeedback(
            error instanceof Error
              ? error.message
              : 'Não foi possível acompanhar a atualização.'
          )
      } finally {
        polling = false
      }
    }
    const timer = setInterval(poll, 2500)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [state.isPluginActive])

  const handleRefreshMetadata = async (
    mode: 'missing' | 'all' | 'portuguese'
  ) => {
    try {
      const job = await window.api.cinemaRefreshMetadata(mode)
      setState((previous) => ({ ...previous, metadataJob: job }))
      setCatalogFeedback(null)
    } catch (error) {
      setCatalogFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar as capas.'
      )
    }
  }
  const handleCancelMetadata = async () => {
    try {
      const job = await window.api.cinemaCancelMetadataRefresh()
      setState((previous) => ({ ...previous, metadataJob: job }))
      setCatalogFeedback(
        'A atualização será interrompida após a consulta atual. O que já foi salvo será mantido.'
      )
    } catch (error) {
      setCatalogFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível interromper a atualização.'
      )
    }
  }

  const updateMediaPreferences = useCallback(async (movieIds: string[], preferences: CinemaMediaPreferences) => {
    const updated = await window.api.cinemaUpdateMediaPreferences(movieIds, preferences)
    setState(updated)
    setSelectedMovie((current) => current ? updated.movies.find((movie) => movie.id === current.id) || null : null)
    setSelectedShow((current) => current ? groupMoviesIntoShows(updated.movies).find((show) => show.id === current.id) || null : null)
  }, [])

  // Local Folder Handlers
  const handleAddFolder = async () => {
    try {
      const selectedPath = await window.api.cinemaPickFolder()
      if (selectedPath) {
        setLoading(true)
        const updated = await window.api.cinemaAddFolder(selectedPath)
        setState(updated)
      }
    } catch (err) {
      console.error('[Alazterflix] Erro ao adicionar pasta:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFolder = async (folderPath: string) => {
    try {
      setLoading(true)
      const updated = await window.api.cinemaRemoveFolder(folderPath)
      setState(updated)
    } catch (err) {
      console.error('[Alazterflix] Erro ao remover pasta:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRescan = async () => {
    try {
      setLoading(true)
      const movies = await window.api.cinemaScanFolders()
      setState((prev) => ({ ...prev, movies }))
    } catch (err) {
      console.error('[Alazterflix] Erro ao re-escanear pastas:', err)
    } finally {
      setLoading(false)
    }
  }

  // Metadata & Cataloging Handlers
  const handleOpenEditMovie = useCallback((movie: GhostMovie) => {
    setEditingMovie(movie)
  }, [])

  const handleSaveEditedMovie = useCallback(
    async (updated: GhostMovie, applyCoverToAll?: boolean) => {
      const saved = await window.api.cinemaUpdateMovie(updated, {
        applyToShow: applyCoverToAll
      })
      const data = await window.api.cinemaGetState()
      setState(data)
      setSelectedMovie((previous) =>
        previous?.id === saved.id ? saved : previous
      )
      setPlayerMovie((prev) => {
        if (!prev) return null
        if (prev.movieId === saved.id || prev.filePath === saved.filePath) {
          return {
            ...prev,
            title: saved.customTitle || saved.title,
            season: saved.season,
            episode: saved.episode,
            showTitle: saved.showTitle || saved.cleanTitle,
            mediaCategory: saved.mediaCategory,
            coverUrl: saved.customCoverUrl || saved.coverUrl || prev.coverUrl,
            movie: { ...prev.movie, ...saved }
          }
        }
        return prev
      })
      if (saved.season !== undefined) {
        setDrawerSeasonNumber(saved.season)
      }
      setEditingMovie(null)
      setCatalogFeedback(
        '✓ Informações e capa salvas para ' + saved.title + '.'
      )
    },
    []
  )

  const handleEnrichSingleMovie = useCallback(async (movieId: string) => {
    try {
      setCatalogFeedback('Buscando capa e informações da obra…')
      const enriched = await window.api.cinemaEnrichMovie(movieId)
      setState(await window.api.cinemaGetState())
      if (enriched) {
        setSelectedMovie((previous) =>
          previous?.id === enriched.id ? enriched : previous
        )
        setCatalogFeedback(
          '✓ Informações atualizadas. Suas imagens protegidas foram preservadas.'
        )
      } else {
        setCatalogFeedback(
          'A identificação precisa ser escolhida. Abra Editar capa e informações para selecionar a obra correta.'
        )
        const data = await window.api.cinemaGetState()
        setEditingMovie(
          data.movies.find((movie) => movie.id === movieId) || null
        )
      }
    } catch (error) {
      setCatalogFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar esta obra.'
      )
    }
  }, [])

  const handleAutoCatalogAll = useCallback(async () => {
    try {
      setIsCataloging(true)
      setCatalogFeedback(
        'Catalogando títulos, temporadas e episódios de toda a biblioteca...'
      )
      const updatedList = await window.api.cinemaAutoCatalog()
      setState((prev) => ({ ...prev, movies: updatedList }))
      setCatalogFeedback(
        `✓ Biblioteca catalogada com sucesso! (${updatedList.length} itens salvos no Ghost)`
      )
      setTimeout(() => setCatalogFeedback(null), 4500)
    } catch (err) {
      setCatalogFeedback(`Erro ao catalogar: ${describeMediaError(err)}`)
      setTimeout(() => setCatalogFeedback(null), 4000)
    } finally {
      setIsCataloging(false)
    }
  }, [])

  // Play Movie Handler
  const handlePlayMovie = useCallback(async (movie: GhostMovie) => {
    try {
      const filePath = movie.filePath
      let streamUrl = movie.streamUrl
      let isTranscode = false
      let initProgress = movie.progressSeconds || 0
      let realDuration = movie.duration || 0

      if (filePath) {
        try {
          const probe = await window.api.cinemaProbeMedia(filePath)
          if (probe) {
            if (probe.duration && probe.duration > 0) {
              realDuration = probe.duration
            }
            if (probe.audioTracks && probe.audioTracks.length > 0) {
              const mappedTracks = probe.audioTracks.map((t) => ({
                index: t.index,
                id: `track-${t.index}`,
                label: t.title,
                language: t.language,
                codec: t.codec,
                channels: t.channels,
                isSupported: t.isSupported,
                enabled: t.index === 0
              }))
              setAudioTracks(mappedTracks)
              setSelectedAudioIndex(0)

              const defaultTrack = probe.audioTracks[0]
              // Transcode apenas se o codec de áudio não for suportado nativamente pelo Chromium (ex: AC3, EAC3, DTS).
              // Áudios suportados (AAC, MP3, Opus, FLAC) rodam via Direct Stream (HTTP 206) com seek nativo e zero uso de CPU.
              if (defaultTrack && !defaultTrack.isSupported) {
                isTranscode = true
                streamUrl = await window.api.cinemaGetTranscodeStreamUrl(
                  filePath,
                  0,
                  initProgress
                )
                try {
                  const urlObj = new URL(streamUrl)
                  const parsedStart = parseFloat(
                    urlObj.searchParams.get('startTime') || ''
                  )
                  if (!isNaN(parsedStart) && parsedStart >= 0) {
                    initProgress = parsedStart
                  }
                } catch {}
              }
            }
          }
        } catch (probeErr) {
          console.warn('[Alazterflix] Erro no probe de mídia:', probeErr)
        }
      }

      if (!streamUrl && filePath) {
        streamUrl = await window.api.cinemaGetStreamUrl(filePath)
      }

      if (!streamUrl) {
        alert('Não foi possível obter a URL de reprodução deste filme.')
        return
      }

      // Reinicia sincronia de legendas limpa para o novo filme
      setSubtitleDelay(0)
      subtitleDelayRef.current = 0
      setCustomDelayInput('')
      setActiveCueText(null)
      currentCueTextRef.current = null
      loadAndApplySavedSubSettings()

      isTranscodingRef.current = isTranscode
      streamStartTimeRef.current = isTranscode ? initProgress : 0
      durationRef.current = realDuration
      setDuration(realDuration)
      setCurrentTime(initProgress)

      const rawCover = mediaPoster(movie)
      const coverUrl = getMediaImageUrl(rawCover)
      const rawBackdrop = movie.backdropUrl || movie.localBackdropPath
      const backdropUrl = getMediaImageUrl(rawBackdrop)

      setPlayerMovie({
        title: movie.customTitle || movie.title,
        streamUrl,
        movieId: movie.id,
        initialProgress: initProgress,
        duration: realDuration,
        coverUrl,
        backdropUrl,
        resolution: movie.resolution,
        season: movie.season,
        episode: movie.episode,
        showTitle: movie.showTitle || movie.cleanTitle,
        mediaCategory: movie.mediaCategory,
        filePath: movie.filePath,
        imdbId: movie.imdbId,
        movie: {
          ...movie,
          duration: realDuration || movie.duration
        }
      })
      setSelectedMovie(null)
      setSelectedStremioItem(null)
      setSelectedShow(null)
    } catch (err) {
      alert(`Falha ao iniciar player: ${describeMediaError(err)}`)
    }
  }, [])

  // Stremio Catalog Handler
  const loadStremioCatalog = useCallback(
    async (catalogId: string, search?: string) => {
      if (!state.addons || state.addons.length === 0) return
      const primaryAddon =
        state.addons.find((a) => a.isEnabled) || state.addons[0]
      if (!primaryAddon) return

      try {
        setStremioLoading(true)
        const result = await window.api.cinemaStremioGetCatalog(
          primaryAddon.id,
          'movie',
          catalogId,
          0,
          search
        )
        setStremioCatalog(result?.metas || [])
      } catch (err) {
        console.error('[Alazterflix] Erro ao carregar catálogo Stremio:', err)
      } finally {
        setStremioLoading(false)
      }
    },
    [state.addons]
  )

  useEffect(() => {
    if (activeTab === 'stremio' && state.isPluginActive) {
      loadStremioCatalog(selectedCatalogId, stremioSearch)
    }
  }, [
    activeTab,
    selectedCatalogId,
    state.isPluginActive,
    loadStremioCatalog,
    stremioSearch
  ])

  // Stremio Streams Resolver
  const handleOpenStremioItem = async (item: StremioMetaPreview) => {
    setSelectedStremioItem(item)
    setLoadingStreams(true)
    setAvailableStreams([])

    try {
      const streams = await window.api.cinemaStremioGetStreams('movie', item.id)
      setAvailableStreams(streams || [])
    } catch (err) {
      console.error('[Alazterflix] Erro ao buscar streams:', err)
    } finally {
      setLoadingStreams(false)
    }
  }

  const handlePlayStremioStream = (
    stream: StremioStreamItem,
    item: StremioMetaPreview
  ) => {
    if (!stream.url) {
      alert(
        'Este stream requer um descompactador torrent ou cliente Debrid configurado.'
      )
      return
    }

    isTranscodingRef.current = false
    streamStartTimeRef.current = 0
    durationRef.current = 0
    setDuration(0)
    setPlayerMovie({
      title: `${item.name} (${stream.quality || 'HD'})`,
      streamUrl: stream.url,
      movieId: item.id,
      initialProgress: 0,
      duration: 0,
      coverUrl: getMediaImageUrl(item.poster),
      backdropUrl: getMediaImageUrl(item.background),
      resolution: stream.quality || 'HD',
      imdbId: item.id
    })
    setSelectedStremioItem(null)
  }

  // Addon Manager Handlers
  const handleInstallAddon = async (urlToInstall?: string) => {
    const url = (urlToInstall || newAddonUrl).trim()
    if (!url) return

    try {
      setLoading(true)
      const res = await window.api.cinemaStremioAddAddon(url)
      if (res.success && res.addon) {
        setState((prev) => ({
          ...prev,
          addons: [...prev.addons, res.addon!]
        }))
        setNewAddonUrl('')
      } else {
        alert(res.error || 'Falha ao instalar Addon.')
      }
    } catch (err) {
      alert(describeMediaError(err) || 'Erro inesperado ao instalar addon.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAddon = async (addonId: string) => {
    if (addonId === 'org.stremio.cinemeta') {
      alert(
        'O Addon Cinemeta Oficial é essencial para metadados e não pode ser removido.'
      )
      return
    }

    try {
      const res = await window.api.cinemaStremioRemoveAddon(addonId)
      if (res.success) {
        setState((prev) => ({
          ...prev,
          addons: prev.addons.filter((a) => a.id !== addonId)
        }))
      }
    } catch (err) {
      alert(describeMediaError(err) || 'Erro ao remover addon.')
    }
  }

  // Agrupamento completo de obras Jellyfin-Style
  const allShows = useMemo(() => {
    return groupMoviesIntoShows(state.movies)
  }, [state.movies])

  const recommendations = useMemo(
    () => recommendCatalog(allShows, state.playbackHistory),
    [allShows, state.playbackHistory]
  )

  // Mantém a obra selecionada (selectedShow) sincronizada com edições
  useEffect(() => {
    if (selectedShow) {
      const fresh = allShows.find((s) => s.id === selectedShow.id)
      if (fresh) setSelectedShow(fresh)
      else
        setSelectedShow(
          allShows.find(
            (show) => show.sampleMovie.id === selectedShow.sampleMovie.id
          ) || null
        )
    }
  }, [allShows])

  // Obra atualmente em reprodução no player (para navegação de episódios)
  const currentPlayingShow = useMemo(() => {
    if (!playerMovie) return null
    return (
      allShows.find(
        (show) =>
          show.seasons.some((s) =>
            s.episodes.some(
              (ep) =>
                ep.id === playerMovie.movieId ||
                ep.filePath === playerMovie.filePath
            )
          ) ||
          (playerMovie.showTitle &&
            show.showTitle.toLowerCase() ===
              playerMovie.showTitle.toLowerCase())
      ) || null
    )
  }, [allShows, playerMovie])

  // Sincroniza a temporada ativa da gaveta com o episódio atual
  useEffect(() => {
    if (playerMovie?.season !== undefined) {
      setDrawerSeasonNumber(playerMovie.season)
    }
  }, [playerMovie?.season])

  // Próximo episódio da série / obra para transição contínua
  const nextEpisode = useMemo(() => {
    if (!playerMovie || !currentPlayingShow) return null
    const allEps = currentPlayingShow.seasons.flatMap((s) => s.episodes)
    const currentIdx = allEps.findIndex(
      (ep) =>
        ep.id === playerMovie.movieId || ep.filePath === playerMovie.filePath
    )
    if (currentIdx >= 0 && currentIdx + 1 < allEps.length) {
      return allEps[currentIdx + 1]
    }
    return null
  }, [currentPlayingShow, playerMovie])

  // Obtém a URL de thumbnail no formato 16:9 para cada episódio
  const getEpisodeThumbnailUrl = useCallback(
    (ep: GhostMovie, show: GhostShow | null): string | undefined => {
      const candidate =
        ep.localBackdropPath ||
        ep.backdropUrl ||
        ep.localCoverPath ||
        ep.coverUrl ||
        show?.backdropUrl ||
        show?.sampleMovie?.localBackdropPath ||
        show?.sampleMovie?.backdropUrl ||
        show?.coverUrl ||
        show?.sampleMovie?.localCoverPath ||
        show?.sampleMovie?.coverUrl
      return getMediaImageUrl(candidate)
    },
    []
  )

  const currentSeasonObj = useMemo(() => {
    if (!currentPlayingShow) return null
    return (
      currentPlayingShow.seasons.find(
        (s) => s.seasonNumber === drawerSeasonNumber
      ) || currentPlayingShow.seasons[0]
    )
  }, [currentPlayingShow, drawerSeasonNumber])

  // Rolagem suave para centralizar a aba da temporada ativa na barra
  const scrollSeasonTabIntoView = useCallback((seasonNum: number) => {
    setTimeout(() => {
      const tabEl = document.getElementById(`drawer-season-tab-${seasonNum}`)
      if (tabEl && seasonsBarRef.current) {
        tabEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        })
      }
    }, 40)
  }, [])

  // Auto-scroll para a temporada ativa ao abrir a gaveta ou trocar de episódio
  useEffect(() => {
    if (episodesDrawerOpen && drawerSeasonNumber !== undefined) {
      scrollSeasonTabIntoView(drawerSeasonNumber)
    }
  }, [episodesDrawerOpen, drawerSeasonNumber, scrollSeasonTabIntoView])

  // Navegação horizontal por botões ‹ e › na barra de temporadas
  const handleScrollSeasons = useCallback((direction: 'left' | 'right') => {
    if (!seasonsBarRef.current) return
    const amount = direction === 'left' ? -140 : 140
    seasonsBarRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }, [])

  // Suporte a scroll horizontal suave com a roda do mouse na barra de temporadas
  const handleSeasonsBarWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.stopPropagation()
      if (seasonsBarRef.current) {
        seasonsBarRef.current.scrollLeft += e.deltaY * 0.9
      }
    },
    []
  )

  // Hover na borda direita: exibe a seta elegante com background sem abrir a gaveta imediatamente
  const handleRightEdgeHover = useCallback(() => {
    if (!currentPlayingShow || episodesDrawerOpen) return
    if (edgeTabTimeoutRef.current) {
      clearTimeout(edgeTabTimeoutRef.current)
      edgeTabTimeoutRef.current = null
    }
    setEdgeArrowTabVisible(true)
  }, [currentPlayingShow, episodesDrawerOpen])

  const handleRightEdgeLeave = useCallback(() => {
    if (edgeTabTimeoutRef.current) clearTimeout(edgeTabTimeoutRef.current)
    edgeTabTimeoutRef.current = setTimeout(() => {
      setEdgeArrowTabVisible(false)
    }, 700)
  }, [])

  const handleArrowTabEnter = useCallback(() => {
    if (edgeTabTimeoutRef.current) {
      clearTimeout(edgeTabTimeoutRef.current)
      edgeTabTimeoutRef.current = null
    }
    setEdgeArrowTabVisible(true)
  }, [])

  const handleArrowTabLeave = useCallback(() => {
    handleRightEdgeLeave()
  }, [handleRightEdgeLeave])

  // Clicar na seta elegante: expande e exibe a gaveta
  const expandDrawerFromArrowTab = useCallback(() => {
    if (edgeTabTimeoutRef.current) {
      clearTimeout(edgeTabTimeoutRef.current)
      edgeTabTimeoutRef.current = null
    }
    setEdgeArrowTabVisible(false)
    drawerOpenedByHoverRef.current = false
    setEpisodesDrawerOpen(true)
    setSubtitlesMenuOpen(false)
    setAudioMenuOpen(false)
  }, [])

  const handleDrawerMouseEnter = useCallback(() => {
    if (drawerCloseTimeoutRef.current) {
      clearTimeout(drawerCloseTimeoutRef.current)
      drawerCloseTimeoutRef.current = null
    }
  }, [])

  const handleDrawerMouseLeave = useCallback(() => {
    if (drawerOpenedByHoverRef.current) {
      if (drawerCloseTimeoutRef.current)
        clearTimeout(drawerCloseTimeoutRef.current)
      drawerCloseTimeoutRef.current = setTimeout(() => {
        setEpisodesDrawerOpen(false)
        drawerOpenedByHoverRef.current = false
      }, 550)
    }
  }, [])

  const handleToggleDrawerByButton = useCallback(() => {
    if (drawerCloseTimeoutRef.current) {
      clearTimeout(drawerCloseTimeoutRef.current)
      drawerCloseTimeoutRef.current = null
    }
    drawerOpenedByHoverRef.current = false
    setEpisodesDrawerOpen((prev) => !prev)
  }, [])

  const renderDrawerEpCard = useCallback(
    (ep: GhostMovie) => {
      const isCurrent =
        ep.id === playerMovie?.movieId ||
        ep.filePath === playerMovie?.filePath
      const epNum =
        ep.episode !== undefined
          ? `E${String(ep.episode).padStart(2, '0')}`
          : ep.season === 0
            ? 'ESP'
            : 'EP'
      const thumbUrl = getEpisodeThumbnailUrl(ep, currentPlayingShow)
      return (
        <div
          key={ep.id}
          className={`drawer-ep-card ${isCurrent ? 'active' : ''}`}
          onClick={() => {
            handlePlayMovie(ep)
          }}
        >
          {/* PREVIEW THUMBNAIL 16:9 */}
          <div className="ep-thumb-wrapper">
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt={ep.customTitle || ep.title}
                className="ep-thumb-img"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="ep-thumb-fallback">
                <FontAwesomeIcon icon={faFilm} />
              </div>
            )}
            <span className="ep-thumb-badge">{epNum}</span>
            <div className="ep-thumb-overlay">
              <FontAwesomeIcon icon={faPlay} className="ep-thumb-play-icon" />
            </div>
            {isCurrent && <div className="ep-thumb-playing-pulse" />}
          </div>

          {/* DETALHES DO EPISÓDIO */}
          <div className="ep-card-info">
            <div
              className="ep-card-title"
              title={ep.customTitle || ep.title}
            >
              {ep.customTitle || ep.title}
            </div>
            <div className="ep-card-sub">
              <span className="ep-card-res">{ep.resolution || 'HD'}</span>
              <span>&bull;</span>
              <span>{ep.fileSize || ep.durationFormatted}</span>
              {isCurrent && (
                <>
                  <span>&bull;</span>
                  <span className="now-playing-tag">TOCANDO AGORA</span>
                </>
              )}
            </div>
          </div>

          <div className="ep-card-actions">
            <button
              type="button"
              className="btn-edit-drawer-ep"
              title="Editar nome e número deste episódio"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenEditMovie(ep)
              }}
            >
              <FontAwesomeIcon icon={faPenToSquare} />
            </button>
            <FontAwesomeIcon
              icon={faPlay}
              className="ep-card-side-play"
              style={{
                fontSize: 12,
                color: isCurrent ? 'var(--alazter-cyan)' : '#64748b'
              }}
            />
          </div>
        </div>
      )
    },
    [
      playerMovie,
      currentPlayingShow,
      getEpisodeThumbnailUrl,
      handlePlayMovie,
      handleOpenEditMovie
    ]
  )

  // Atualização atômica de progresso no backend e no estado React local
  const updatePlaybackProgress = useCallback(
    async (movieId: string, curTime: number, durTime: number) => {
      if (!movieId) return
      const nowIso = new Date().toISOString()
      const automaticallyWatched = durTime > 0 && curTime / durTime >= 0.95

      // Atualiza o estado React imediatamente para reatividade instantânea (0ms)
      setState((prev) => {
        const current = prev.movies.find((movie) => movie.id === movieId || movie.filePath === movieId)
        const isWatched = current?.manualWatched === true || automaticallyWatched
        const updatedMovies = prev.movies.map((m) => {
          if (m.id === movieId || m.filePath === movieId) {
            return {
              ...m,
              progressSeconds: curTime,
              duration: durTime || m.duration,
              lastWatchedAt: nowIso,
              isWatched
            }
          }
          return m
        })

        const updatedHistory = {
          ...(prev.playbackHistory || {}),
          [movieId]: {
            progressSeconds: curTime,
            durationSeconds: durTime,
            lastWatched: nowIso,
            lastWatchedAt: nowIso,
            isWatched
          }
        }

        return {
          ...prev,
          movies: updatedMovies,
          playbackHistory: updatedHistory
        }
      })

      // Persiste no save do Ghost de forma confiável
      try {
        await window.api.cinemaSaveProgress(movieId, curTime, durTime)
      } catch (err) {
        console.warn('[Alazterflix] Erro ao salvar progresso de reprodução:', err)
      }
    },
    []
  )

  const activeSubtitleUrlRef = useRef(activeSubtitleUrl)
  useEffect(() => {
    activeSubtitleUrlRef.current = activeSubtitleUrl
  }, [activeSubtitleUrl])

  // Atualização instantânea e atômica da legenda ativa (Cinema Subtitle Engine)
  const updateActiveCue = useCallback((overrideTime?: number) => {
    const video = videoRef.current
    if (!video && overrideTime === undefined) return

    const curTime =
      overrideTime !== undefined
        ? overrideTime
        : isTranscodingRef.current
          ? streamStartTimeRef.current + (video ? video.currentTime : 0)
          : video
            ? video.currentTime
            : 0

    const adjustedTime = curTime - subtitleDelayRef.current
    const cue = findCueAtTime(parsedCuesRef.current, adjustedTime)
    const newText = cue ? cue.text : null

    if (newText !== currentCueTextRef.current) {
      currentCueTextRef.current = newText
      setActiveCueText(newText)
    }
  }, [])

  // Manipulação unificada de ativação e sincronização de faixas de legendas
  const handleSelectSubtitle = useCallback(
    (url: string | null, label = 'Desativada', preserveDelay = false) => {
      setActiveSubtitleUrl(url)
      setActiveSubtitleLabel(label)
      if (!preserveDelay) {
        setSubtitleDelay(0)
        subtitleDelayRef.current = 0
        setCustomDelayInput('')
      }

      // Desativa todas as faixas nativas do Chromium para evitar duplicações/flicker
      const video = videoRef.current
      if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = 'disabled'
        }
      }
    },
    []
  )

  // Carregamento inteligente de legendas locais e remotas Stremio v3
  useEffect(() => {
    if (!playerMovie) {
      setSubtitlesList({ local: [], remote: [] })
      handleSelectSubtitle(null, 'Desativada')
      setSubtitleDelay(0)
      return
    }

    let isMounted = true
    setLoadingSubs(true)

    window.api
      .cinemaGetSubtitles(
        playerMovie.filePath || '',
        playerMovie.imdbId,
        playerMovie.season,
        playerMovie.episode
      )
      .then((result) => {
        if (!isMounted) return
        const subs = result || { local: [], remote: [] }
        setSubtitlesList(subs)

        // Auto-seleção inteligente de legenda PT-BR/Português com preferência estrita por faixa completa (não-forçada)
        const isPortuguese = (lang: string, name: string) =>
          /portugu|brasil|brazil|\bpt\b|\bpor\b|pob|dublado/i.test(lang) ||
          /pt-br|ptbr|pob|\bpt\b|\bpor\b|portugu|dublado/i.test(name)
        const isForcedTrack = (lang: string, name: string) =>
          /for[çc]ad|forced/i.test(lang) || /for[çc]ad|forced/i.test(name)

        // 1. Legenda local PT completa (NÃO-FORÇADA): tem prioridade máxima absoluta (ex: MKV FULL ou .srt do filme)
        const ptFullLocal = subs.local.find(
          (s) => isPortuguese(s.lang, s.name) && !isForcedTrack(s.lang, s.name)
        )
        // 2. Qualquer legenda local marcada como padrão (não-forçada)
        const defaultLocal = subs.local.find(
          (s) => s.isDefault && !isForcedTrack(s.lang, s.name)
        )
        // 3. Qualquer legenda local em PT (mesmo que forçada, caso não exista outra)
        const ptAnyLocal = subs.local.find((s) => isPortuguese(s.lang, s.name))
        // 4. Primeira legenda local existente
        const firstLocal = subs.local[0]
        // 5. Legenda remota do Stremio em PT (completa)
        const ptRemote =
          subs.remote.find(
            (s) => isPortuguese(s.lang, s.name) && !isForcedTrack(s.lang, s.name)
          ) || subs.remote[0]

        const autoSub =
          ptFullLocal || defaultLocal || ptAnyLocal || firstLocal || ptRemote
        // Só auto-seleciona se nenhuma legenda tiver sido selecionada ainda e preserva qualquer delay já configurado
        if (autoSub && !activeSubtitleUrlRef.current) {
          handleSelectSubtitle(autoSub.streamUrl, autoSub.name, true)
        }
      })
      .catch((err) => {
        console.warn('[Alazterflix] Erro ao carregar legendas:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingSubs(false)
      })

    return () => {
      isMounted = false
    }
  }, [
    playerMovie?.filePath,
    playerMovie?.movieId,
    playerMovie?.imdbId,
    playerMovie?.season,
    playerMovie?.episode,
    handleSelectSubtitle
  ])

  // Carrega e faz parse das legendas em RAM para sincronização frame-accurate
  useEffect(() => {
    if (!activeSubtitleUrl) {
      parsedCuesRef.current = []
      currentCueTextRef.current = null
      setActiveCueText(null)
      return
    }

    if (subtitleCuesCacheRef.current.has(activeSubtitleUrl)) {
      parsedCuesRef.current = subtitleCuesCacheRef.current.get(activeSubtitleUrl)!
      updateActiveCue()
      return
    }

    let isMounted = true
    fetch(activeSubtitleUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        if (!isMounted) return
        const parsed = parseVttContent(text)
        subtitleCuesCacheRef.current.set(activeSubtitleUrl, parsed)
        parsedCuesRef.current = parsed
        updateActiveCue()
      })
      .catch((err) => {
        console.warn('[Alazterflix] Erro ao carregar/parsear VTT:', err)
      })

    return () => {
      isMounted = false
    }
  }, [activeSubtitleUrl, updateActiveCue])

  // Ticker soberano de alta precisão (60-120 FPS) totalmente blindado e independente de UI/Volume
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playerMovie) return

    let animId: number | null = null
    let active = true

    const loop = () => {
      if (!active) return
      if (!video.paused && !video.ended) {
        updateActiveCue()
      }
      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)

    const syncNow = () => updateActiveCue()
    video.addEventListener('timeupdate', syncNow)
    video.addEventListener('seeked', syncNow)
    video.addEventListener('seeking', syncNow)
    video.addEventListener('play', syncNow)
    video.addEventListener('pause', syncNow)
    video.addEventListener('ratechange', syncNow)

    return () => {
      active = false
      if (animId) cancelAnimationFrame(animId)
      video.removeEventListener('timeupdate', syncNow)
      video.removeEventListener('seeked', syncNow)
      video.removeEventListener('seeking', syncNow)
      video.removeEventListener('play', syncNow)
      video.removeEventListener('pause', syncNow)
      video.removeEventListener('ratechange', syncNow)
    }
  }, [playerMovie?.streamUrl, updateActiveCue])

  // Aplica posição vertical em porcentagem (0 a 100%) da legenda
  const applySubtitlePosition = useCallback(
    (targetPercent: number) => {
      // Permite descer até 98% (2% do rodapé) para quem quer a legenda rente ao fundo da tela / tarja preta
      const clamped = Math.max(5, Math.min(98, Math.round(targetPercent)))
      setSubPosition(clamped)
      saveSubSettings({ position: clamped })
    },
    [saveSubSettings]
  )

  const applySubtitlePositionRef = useRef(applySubtitlePosition)
  useEffect(() => {
    applySubtitlePositionRef.current = applySubtitlePosition
  }, [applySubtitlePosition])

  const subPositionRef = useRef(subPosition)
  useEffect(() => {
    subPositionRef.current = subPosition
  }, [subPosition])

  // Ajustes de sincronia de legendas em tempo real
  const adjustSubtitleDelay = useCallback(
    (deltaSeconds: number) => {
      const current = subtitleDelayRef.current
      const next = Math.round((current + deltaSeconds) * 10) / 10
      subtitleDelayRef.current = next
      setSubtitleDelay(next)
      setCustomDelayInput(String(next))
      updateActiveCue()
      setSubtitleToast(`Legenda: ${next > 0 ? `+${next}s` : `${next}s`}`)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = setTimeout(() => setSubtitleToast(null), 2000)
    },
    [updateActiveCue]
  )

  const resetSubtitleDelay = useCallback(() => {
    subtitleDelayRef.current = 0
    setSubtitleDelay(0)
    setCustomDelayInput('')
    updateActiveCue()
    setSubtitleToast('Legenda: 0.0s (Padrão)')
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setSubtitleToast(null), 2000)
  }, [updateActiveCue])

  const handleApplyCustomDelay = useCallback(() => {
    const parsed = parseFloat(customDelayInput.replace(',', '.'))
    if (!isNaN(parsed)) {
      const rounded = Math.round(parsed * 10) / 10
      subtitleDelayRef.current = rounded
      setSubtitleDelay(rounded)
      setCustomDelayInput(String(rounded))
      updateActiveCue()
      setSubtitleToast(`Legenda: ${rounded > 0 ? `+${rounded}s` : `${rounded}s`}`)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = setTimeout(() => setSubtitleToast(null), 2000)
    }
  }, [customDelayInput, updateActiveCue])

  // Manipulação de áudio e dual áudio com transcode on-the-fly
  const handleSelectAudioTrack = useCallback(
    async (index: number) => {
      setSelectedAudioIndex(index)
      setAudioTracks((prev) =>
        prev.map((t) => ({ ...t, enabled: t.index === index }))
      )
      setAudioMenuOpen(false)

      const video = videoRef.current
      if (!video || !playerMovie?.filePath) return

      const curTime = isTranscodingRef.current
        ? streamStartTimeRef.current + video.currentTime
        : video.currentTime

      setIsBuffering(true)
      try {
        const newUrl = await window.api.cinemaGetTranscodeStreamUrl(
          playerMovie.filePath,
          index,
          curTime
        )
        let actualStart = curTime
        try {
          const urlObj = new URL(newUrl)
          const parsedStart = parseFloat(
            urlObj.searchParams.get('startTime') || ''
          )
          if (!isNaN(parsedStart) && parsedStart >= 0) {
            actualStart = parsedStart
          }
        } catch {}

        streamStartTimeRef.current = actualStart
        isTranscodingRef.current = true
        setCurrentTime(actualStart)
        updateActiveCue(actualStart)

        video.src = newUrl
        video.currentTime = 0
        video.play().catch(() => {})
      } catch (err) {
        console.error('[Alazterflix] Erro ao alternar faixa de áudio:', err)
        setIsBuffering(false)
      }
    },
    [playerMovie?.filePath, updateActiveCue]
  )

  // Controle de volume e slider
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.round(parseFloat(e.target.value) * 100) / 100
      setVolume(val)
      if (videoRef.current) {
        videoRef.current.volume = val
        if (val > 0 && isMuted) {
          videoRef.current.muted = false
          setIsMuted(false)
        }
      }
      localStorage.setItem('alazterflix_player_volume', String(val))
    },
    [isMuted]
  )

  const showControlsBriefly = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false)
    }, 3500)
  }, [isPlaying])

  const handlePlayerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      showControlsBriefly()
      if (!currentPlayingShow) return
      const rect = e.currentTarget.getBoundingClientRect()
      const distFromRight = rect.right - e.clientX
      if (distFromRight <= 48 && !episodesDrawerOpen) {
        if (edgeTabTimeoutRef.current) {
          clearTimeout(edgeTabTimeoutRef.current)
          edgeTabTimeoutRef.current = null
        }
        setEdgeArrowTabVisible(true)
      } else if (distFromRight > 60 && edgeArrowTabVisible) {
        handleRightEdgeLeave()
      }
    },
    [
      currentPlayingShow,
      episodesDrawerOpen,
      edgeArrowTabVisible,
      showControlsBriefly,
      handleRightEdgeLeave
    ]
  )

  const handleContainerWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.stopPropagation()
      const step = e.deltaY < 0 ? 0.01 : -0.01
      setVolume((prev) => {
        const next = Math.max(
          0,
          Math.min(1, Math.round((prev + step) * 100) / 100)
        )
        if (videoRef.current) {
          videoRef.current.volume = next
          if (next > 0 && isMuted) {
            videoRef.current.muted = false
            setIsMuted(false)
          }
        }
        localStorage.setItem('alazterflix_player_volume', String(next))
        return next
      })
      showControlsBriefly()
    },
    [isMuted, showControlsBriefly]
  )

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [])

  const seekToTime = useCallback(
    async (targetTime: number) => {
      const video = videoRef.current
      if (!video) return
      const curDur =
        durationRef.current ||
        duration ||
        playerMovie?.duration ||
        playerMovie?.movie?.duration ||
        0
      const clampedTarget = Math.max(
        0,
        curDur > 0 ? Math.min(curDur, targetTime) : Math.max(0, targetTime)
      )

      if (isTranscodingRef.current && playerMovie?.filePath) {
        setIsBuffering(true)
        try {
          const newUrl = await window.api.cinemaGetTranscodeStreamUrl(
            playerMovie.filePath,
            selectedAudioIndex,
            clampedTarget
          )
          let actualStart = clampedTarget
          try {
            const urlObj = new URL(newUrl)
            const parsedStart = parseFloat(
              urlObj.searchParams.get('startTime') || ''
            )
            if (!isNaN(parsedStart) && parsedStart >= 0) {
              actualStart = parsedStart
            }
          } catch {}

          streamStartTimeRef.current = actualStart
          setCurrentTime(actualStart)
          updateActiveCue(actualStart)

          video.src = newUrl
          video.currentTime = 0
          video.play().catch(() => {})
        } catch (err) {
          console.error(
            '[Alazterflix] Erro ao buscar posição no transcode:',
            err
          )
          setIsBuffering(false)
        }
      } else {
        video.currentTime = clampedTarget
        setCurrentTime(clampedTarget)
        updateActiveCue(clampedTarget)
      }
    },
    [
      duration,
      playerMovie?.duration,
      playerMovie?.filePath,
      playerMovie?.movie?.duration,
      selectedAudioIndex,
      updateActiveCue
    ]
  )

  useEffect(() => {
    seekToTimeRef.current = seekToTime
  }, [seekToTime])

  const handleSeek = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const curDur =
        durationRef.current ||
        duration ||
        playerMovie?.duration ||
        playerMovie?.movie?.duration ||
        0
      if (!curDur) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const targetTime = pos * curDur
      seekToTime(targetTime)
    },
    [duration, playerMovie?.duration, playerMovie?.movie?.duration, seekToTime]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = playerContainerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  const closePlayer = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {}
    }
    const video = videoRef.current
    if (video && playerMovie) {
      const saveTime = isTranscodingRef.current
        ? streamStartTimeRef.current + video.currentTime
        : video.currentTime
      const effectiveDur =
        durationRef.current || duration || playerMovie.duration || video.duration || 0
      await updatePlaybackProgress(
        playerMovie.movieId,
        saveTime,
        effectiveDur
      )
    }
    if (drawerCloseTimeoutRef.current) {
      clearTimeout(drawerCloseTimeoutRef.current)
      drawerCloseTimeoutRef.current = null
    }
    if (edgeTabTimeoutRef.current) {
      clearTimeout(edgeTabTimeoutRef.current)
      edgeTabTimeoutRef.current = null
    }
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setEdgeArrowTabVisible(false)
    drawerOpenedByHoverRef.current = false
    isTranscodingRef.current = false
    streamStartTimeRef.current = 0
    setPlayerMovie(null)
    setSubtitlesMenuOpen(false)
    setAudioMenuOpen(false)
    setEpisodesDrawerOpen(false)
    setAutoPlayCountdown(null)
  }, [playerMovie, updatePlaybackProgress, duration])

  // Video Player Event Handlers
  const playerStreamUrl = playerMovie?.streamUrl
  useEffect(() => {
    if (!playerStreamUrl || !videoRef.current) return
    return observeVideoBuffering(videoRef.current, setIsBuffering)
  }, [playerStreamUrl])

  useEffect(() => {
    if (!playerMovie) return

    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      if (isTranscodingRef.current) {
        // Em modo transcode FMP4, o browser calcula video.duration apenas com base no fragmento inicial (~4s).
        // Preservamos estritamente a duração real obtida via probe/metadados da obra.
        if ((!durationRef.current || durationRef.current <= 0) && playerMovie.duration) {
          durationRef.current = playerMovie.duration
          setDuration(playerMovie.duration)
        }
      } else {
        // Direct stream nativo HTTP 206 (MP4, MKV com AAC/MP3, etc.)
        const nativeDur = video.duration
        if (Number.isFinite(nativeDur) && nativeDur > 0) {
          durationRef.current = nativeDur
          setDuration(nativeDur)
        } else if (playerMovie.duration) {
          durationRef.current = playerMovie.duration
          setDuration(playerMovie.duration)
        }
        if (
          playerMovie.initialProgress &&
          playerMovie.initialProgress > 0
        ) {
          video.currentTime = playerMovie.initialProgress
        }
      }

      video.volume = isMuted ? 0 : volume

      // Se audioTracks ainda não foi populado pelo probe, detecta nativamente
      if (audioTracks.length === 0) {
        const aTracks = (video as any).audioTracks
        if (aTracks && aTracks.length > 0) {
          const list = []
          for (let i = 0; i < aTracks.length; i++) {
            list.push({
              index: i,
              id: aTracks[i].id || String(i),
              label:
                aTracks[i].label ||
                `Faixa ${i + 1} (${aTracks[i].language || 'Estéreo/Surround'})`,
              language: aTracks[i].language || 'und',
              enabled: aTracks[i].enabled || i === 0
            })
          }
          setAudioTracks(list)
          const activeIdx = list.findIndex((t) => t.enabled)
          setSelectedAudioIndex(activeIdx >= 0 ? activeIdx : 0)
        }
      }

      const effectiveDuration =
        durationRef.current || duration || playerMovie.duration || video.duration || 0
      if (playerMovie.movieId && effectiveDuration > 0) {
        updatePlaybackProgress(
          playerMovie.movieId,
          playerMovie.initialProgress || 1,
          effectiveDuration
        )
      }

      video.play().catch(() => {})
      setIsPlaying(true)
    }

    const handleTimeUpdate = () => {
      const actualCurrent = isTranscodingRef.current
        ? streamStartTimeRef.current + video.currentTime
        : video.currentTime

      setCurrentTime(actualCurrent)
      updateActiveCue(actualCurrent)

      const currentDur =
        durationRef.current || duration || playerMovie.duration || video.duration || 0
      if (currentDur > 30 && nextEpisode) {
        const remaining = Math.round(currentDur - actualCurrent)
        if (remaining <= 20 && remaining > 0) {
          setAutoPlayCountdown(remaining)
        } else {
          setAutoPlayCountdown(null)
        }
      } else {
        setAutoPlayCountdown(null)
      }
    }

    const handleEnded = () => {
      const actualCurrent = isTranscodingRef.current
        ? streamStartTimeRef.current + video.currentTime
        : video.currentTime
      const curDur =
        durationRef.current || duration || playerMovie.duration || video.duration || 0

      // Se estiver em modo transcode e o tempo atual ainda estiver distante do fim da obra,
      // o evento 'ended' disparado pelo Chromium é um falso término decorrente do buffer de fragmento fmp4.
      // Ignoramos o falso término para não pausar nem avançar precocemente o episódio aos 4s.
      if (isTranscodingRef.current && curDur > 10 && actualCurrent < curDur - 5) {
        return
      }

      setIsPlaying(false)
      updatePlaybackProgress(
        playerMovie.movieId,
        curDur,
        curDur
      )
      if (nextEpisode) {
        handlePlayMovie(nextEpisode)
      }
    }

    const disableNativeTracks = () => {
      if (!video || !video.textTracks) return
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled'
      }
    }

    const handleCanPlay = () => {
      disableNativeTracks()
    }

    const handlePlaying = () => {
      disableNativeTracks()
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('pause', handlePause)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('playing', handlePlaying)
    if (video.textTracks) {
      video.textTracks.addEventListener('addtrack', disableNativeTracks)
    }

    // Salva progresso periodicamente a cada 15 segundos
    const progressInterval = setInterval(() => {
      if (video && !video.paused) {
        const curTime = isTranscodingRef.current
          ? streamStartTimeRef.current + video.currentTime
          : video.currentTime
        const curDur =
          durationRef.current || duration || playerMovie.duration || video.duration || 0
        if (curDur > 0) {
          updatePlaybackProgress(
            playerMovie.movieId,
            curTime,
            curDur
          )
        }
      }
    }, 15000)

    // Atalhos globais do teclado para o player
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playerMovie) return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowRight') {
        const cur = isTranscodingRef.current
          ? streamStartTimeRef.current + video.currentTime
          : video.currentTime
        seekToTimeRef.current(cur + 10)
      } else if (e.key === 'ArrowLeft') {
        const cur = isTranscodingRef.current
          ? streamStartTimeRef.current + video.currentTime
          : video.currentTime
        seekToTimeRef.current(cur - 10)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.shiftKey) {
          applySubtitlePositionRef.current(subPositionRef.current - 5)
        } else {
          setVolume((prev) => {
            const next = Math.min(1, Math.round((prev + 0.01) * 100) / 100)
            video.volume = next
            if (next > 0 && isMuted) {
              video.muted = false
              setIsMuted(false)
            }
            localStorage.setItem('alazterflix_player_volume', String(next))
            return next
          })
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (e.shiftKey) {
          applySubtitlePositionRef.current(subPositionRef.current + 5)
        } else {
          setVolume((prev) => {
            const next = Math.max(0, Math.round((prev - 0.01) * 100) / 100)
            video.volume = next
            localStorage.setItem('alazterflix_player_volume', String(next))
            return next
          })
        }
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault()
        const step = e.shiftKey ? -2.0 : -0.5
        adjustSubtitleDelay(step)
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault()
        const step = e.shiftKey ? 2.0 : 0.5
        adjustSubtitleDelay(step)
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute()
      } else if (e.key === 'Escape') {
        closePlayer()
      }
      showControlsBriefly()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('playing', handlePlaying)
      if (video.textTracks) {
        video.textTracks.removeEventListener('addtrack', disableNativeTracks)
      }
      clearInterval(progressInterval)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    playerMovie,
    nextEpisode,
    isMuted,
    volume,
    updatePlaybackProgress,
    handlePlayMovie,
    closePlayer,
    togglePlay,
    updateActiveCue,
    toggleFullscreen,
    toggleMute,
    showControlsBriefly,
    adjustSubtitleDelay
  ])

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00:00'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Contagens de Obras agrupadas por Categoria
  const {
    countShowsMovies,
    countShowsSeries,
    countShowsAnime,
    countShowsCartoon,
    countShowsDoc
  } = useMemo(() => {
    let m = 0
    let s = 0
    let a = 0
    let c = 0
    let d = 0
    for (let i = 0; i < allShows.length; i++) {
      const show = allShows[i]
      if (show.mediaCategory === 'movie') m++
      else if (show.mediaCategory === 'series') s++
      else if (show.mediaCategory === 'anime') a++
      else if (show.mediaCategory === 'cartoon') c++
      else if (show.mediaCategory === 'documentary') d++
    }
    return {
      countShowsAll: allShows.length,
      countShowsMovies: m,
      countShowsSeries: s,
      countShowsAnime: a,
      countShowsCartoon: c,
      countShowsDoc: d
    }
  }, [allShows])

  // Obras filtradas por categoria, qualidade e busca
  const filteredShows = useMemo(() => {
    let list = selectedCategory === 'forYou' ? recommendations.shows : allShows

    // Filtro de Categoria Principal (5 tipos)
    if (selectedCategory !== 'all' && selectedCategory !== 'forYou') {
      list = list.filter((s) => s.mediaCategory === selectedCategory)
    }

    // Filtro de Qualidade / Status
    if (selectedQualityFilter === '4k') {
      list = list.filter((s) => s.resolution === '4K')
    } else if (selectedQualityFilter === '1080p') {
      list = list.filter((s) => s.resolution === '1080p')
    } else if (selectedQualityFilter === 'unwatched') {
      list = list.filter((s) =>
        s.seasons.some((season) => season.episodes.some((e) => !e.isWatched))
      )
    } else if (selectedQualityFilter === 'watched') {
      list = list.filter((s) =>
        s.seasons.every((season) => season.episodes.every((e) => e.isWatched))
      )
    }

    if (selectedQualityFilter === 'missingArtwork')
      list = list.filter(
        (show) => !show.coverUrl || show.sampleMovie.artworkMissing
      )
    if (selectedQualityFilter === 'unidentified')
      list = list.filter((show) =>
        ['needs-identification', 'error'].includes(
          show.sampleMovie.metadataStatus || ''
        )
      )

    if (selectedQualityFilter === 'portugueseArtwork')
      list = list.filter((show) => needsPortuguesePoster(show.sampleMovie))

    // Filtro por termo de busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.showTitle.toLowerCase().includes(q) ||
          (s.synopsis && s.synopsis.toLowerCase().includes(q)) ||
          s.seasons.some((season) =>
            season.episodes.some(
              (e) =>
                e.title.toLowerCase().includes(q) ||
                e.fileName.toLowerCase().includes(q) ||
                e.cleanTitle.toLowerCase().includes(q)
            )
          )
      )
    }

    return list
  }, [
    allShows,
    recommendations,
    selectedCategory,
    selectedQualityFilter,
    searchQuery
  ])

  // Filter and Sort Movies (visão de episódios avulsos)
  const filteredMovies = useMemo(() => {
    let list = [
      ...(selectedCategory === 'forYou' ? recommendations.movies : state.movies)
    ]

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (m) =>
          (m.customTitle && m.customTitle.toLowerCase().includes(q)) ||
          m.title.toLowerCase().includes(q) ||
          m.cleanTitle.toLowerCase().includes(q) ||
          m.fileName.toLowerCase().includes(q) ||
          (m.genres && m.genres.some((g) => g.toLowerCase().includes(q)))
      )
    }

    // Category filter for flat view
    if (selectedCategory !== 'all' && selectedCategory !== 'forYou') {
      list = list.filter((m) => m.mediaCategory === selectedCategory)
    }

    // Resolution & Status & Type filter
    if (selectedFilter === 'movies') {
      list = list.filter((m) => !m.isSeries)
    } else if (selectedFilter === 'series') {
      list = list.filter((m) => m.isSeries)
    } else if (selectedFilter === '4k' || selectedQualityFilter === '4k') {
      list = list.filter((m) => m.resolution === '4K')
    } else if (
      selectedFilter === '1080p' ||
      selectedQualityFilter === '1080p'
    ) {
      list = list.filter((m) => m.resolution === '1080p')
    } else if (
      selectedFilter === 'unwatched' ||
      selectedQualityFilter === 'unwatched'
    ) {
      list = list.filter((m) => !m.isWatched)
    } else if (
      selectedFilter === 'watched' ||
      selectedQualityFilter === 'watched'
    ) {
      list = list.filter((m) => m.isWatched)
    }

    if (selectedQualityFilter === 'missingArtwork')
      list = list.filter((movie) => !mediaPoster(movie) || movie.artworkMissing)
    if (selectedQualityFilter === 'unidentified')
      list = list.filter((movie) =>
        ['needs-identification', 'error'].includes(movie.metadataStatus || '')
      )
    if (selectedQualityFilter === 'portugueseArtwork')
      list = list.filter(needsPortuguesePoster)
    return list
  }, [
    state.movies,
    recommendations,
    searchQuery,
    selectedFilter,
    selectedCategory,
    selectedQualityFilter
  ])

  // Métricas O(N) calculadas em uma única passada
  const {
    countCatMovies,
    countCatSeries,
    countCatAnime,
    countCatCartoon,
    countCatDoc,
    count4k,
    count1080p,
    countWatched,
    countUnwatched
  } = useMemo(() => {
    let movies = 0
    let series = 0
    let catM = 0
    let catS = 0
    let catA = 0
    let catC = 0
    let catD = 0
    let k4 = 0
    let p1080 = 0
    let watched = 0
    let unwatched = 0
    const len = state.movies.length
    for (let i = 0; i < len; i++) {
      const m = state.movies[i]
      if (m.isSeries) series++
      else movies++
      const cat = m.mediaCategory || 'movie'
      if (cat === 'movie') catM++
      else if (cat === 'series') catS++
      else if (cat === 'anime') catA++
      else if (cat === 'cartoon') catC++
      else if (cat === 'documentary') catD++
      if (m.resolution === '4K') k4++
      else if (m.resolution === '1080p') p1080++
      if (m.isWatched) watched++
      else unwatched++
    }
    return {
      countMovies: movies,
      countSeries: series,
      countCatMovies: catM,
      countCatSeries: catS,
      countCatAnime: catA,
      countCatCartoon: catC,
      countCatDoc: catD,
      count4k: k4,
      count1080p: p1080,
      countWatched: watched,
      countUnwatched: unwatched
    }
  }, [state.movies])

  // Total de itens ativos no modo atual
  const currentTotalCount =
    viewMode === 'shows' ? filteredShows.length : filteredMovies.length

  // Carregamento Progressivo Assíncrono (Scroll Infinito Virtual a 120 FPS)
  const BATCH_SIZE = 60
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE)

  // Reseta o lote para 60 sempre que a busca, filtro, categoria ou modo mudar
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [
    searchQuery,
    selectedFilter,
    selectedCategory,
    selectedQualityFilter,
    viewMode,
    activeTab
  ])

  const visibleShows = useMemo(() => {
    if (filteredShows.length <= visibleCount) {
      return filteredShows
    }
    return filteredShows.slice(0, visibleCount)
  }, [filteredShows, visibleCount])

  const visibleMovies = useMemo(() => {
    if (filteredMovies.length <= visibleCount) {
      return filteredMovies
    }
    return filteredMovies.slice(0, visibleCount)
  }, [filteredMovies, visibleCount])

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // IntersectionObserver nativo em C++ para rolagem ultra-fluida sem layout thrashing
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => {
            if (prev >= currentTotalCount) return prev
            return Math.min(prev + BATCH_SIZE, currentTotalCount)
          })
        }
      },
      {
        root: null,
        rootMargin: '1200px',
        threshold: 0
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [currentTotalCount, activeTab])

  // Ouvinte passivo de rolagem para barra de rolagem e roda do mouse
  useEffect(() => {
    const scrollContainer = document.querySelector('.content') || window
    const handleScroll = () => {
      let atBottom = false
      if (scrollContainer instanceof HTMLElement) {
        atBottom =
          scrollContainer.scrollTop + scrollContainer.clientHeight >=
          scrollContainer.scrollHeight - 1200
      } else {
        atBottom =
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 1200
      }

      if (atBottom) {
        setVisibleCount((prev) => {
          if (prev >= currentTotalCount) return prev
          return Math.min(prev + BATCH_SIZE, currentTotalCount)
        })
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [currentTotalCount])

  // Botão flutuante Voltar ao Topo
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const scrollContainer = document.querySelector('.content') || window
    const handleScrollPos = () => {
      const top =
        scrollContainer instanceof HTMLElement
          ? scrollContainer.scrollTop
          : window.scrollY
      setShowBackToTop(top > 400)
    }

    scrollContainer.addEventListener('scroll', handleScrollPos, {
      passive: true
    })
    return () => scrollContainer.removeEventListener('scroll', handleScrollPos)
  }, [])

  const handleScrollToTop = useCallback(() => {
    const scrollContainer = document.querySelector('.content')
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const handleSelectMovie = useCallback((movie: GhostMovie) => {
    setSelectedMovie(movie)
  }, [])

  const handleSelectShow = useCallback((show: GhostShow) => {
    if (
      show.mediaCategory === 'movie' ||
      (!show.isSeries && show.episodesCount <= 1)
    ) {
      setSelectedMovie(show.sampleMovie)
    } else {
      setSelectedShow(show)
    }
  }, [])

  // Apenas progresso real de reprodução pertence ao Continuar Assistindo, ordenado pelos mais recentes
  const continueWatchingList = useMemo(() => {
    const withProgress = state.movies.filter((m) => {
      const hist =
        state.playbackHistory?.[m.id] ||
        (m.filePath ? state.playbackHistory?.[m.filePath] : undefined)
      const prog = hist?.progressSeconds ?? m.progressSeconds ?? 0
      const watched = hist?.isWatched ?? m.isWatched ?? false
      return prog > 0 && !watched && !hist?.continueHidden
    })

    return withProgress
      .sort((a, b) => {
        const histA =
          state.playbackHistory?.[a.id] ||
          (a.filePath ? state.playbackHistory?.[a.filePath] : undefined)
        const histB =
          state.playbackHistory?.[b.id] ||
          (b.filePath ? state.playbackHistory?.[b.filePath] : undefined)
        const dateA = new Date(
          histA?.lastWatchedAt || histA?.lastWatched || a.lastWatchedAt || 0
        ).getTime()
        const dateB = new Date(
          histB?.lastWatchedAt || histB?.lastWatched || b.lastWatchedAt || 0
        ).getTime()
        return dateB - dateA
      })
  }, [state.movies, state.playbackHistory])

  const featured = useFeaturedCatalog(
    allShows,
    activeTab === 'local' && selectedCategory === 'forYou',
    Boolean(selectedMovie || selectedShow || editingMovie || playerMovie)
  )
  const heroMovie = featured.movie
  const heroTitle = heroMovie?.customTitle || heroMovie?.title || ''
  const heroTitleBreak = heroTitle.lastIndexOf(' ')

  const handleClearContinue = async () => {
    if (clearingContinue) return
    setClearingContinue(true)
    try {
      const updated = await window.api.cinemaClearContinueWatching()
      setState(updated)
      setShowAllContinue(false)
      setCatalogFeedback(null)
    } catch (error) {
      setCatalogFeedback(
        error instanceof Error ? error.message : 'Não foi possível limpar a lista.'
      )
    } finally {
      setClearingContinue(false)
    }
  }

  return (
    <div id="alazterflix-page" className="alazterflixScreen">
      {/* =========================================================================
         TOP HEADER COM IDENTIDADE VISUAL DO MOCKUP
         ========================================================================= */}
      <header className="top-header">
        <div className="header-left">
          <h1 className="header-brand">
            <button
              type="button"
              onClick={() => setActiveTab('local')}
              aria-label="Alazterflix, início"
            >
              <img
                src={alazterflixLogo}
                alt="Alazterflix"
                width="2172"
                height="724"
              />
            </button>
          </h1>
          <p className="header-slogan">Seu cinema. Seu ritmo. Seu universo.</p>
        </div>
  
        {activeTab === 'local' && (
          <label className="header-search">
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="search"
              aria-label="Buscar no catálogo"
              placeholder="O que vamos assistir?"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => setSearchInput('')}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </label>
        )}
  
        <div className="header-right-actions">
          <button
            type="button"
            className={`btn-action header-settings-button ${activeTab === 'settings' ? 'active' : ''}`}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            onClick={() => setActiveTab('settings')}
          >
            <FontAwesomeIcon icon={faGear} />
            <span>Configurações</span>
          </button>
        </div>
      </header>
  
      {activeTab === 'local' && (
        <CatalogNavigation
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          counts={{
            all: viewMode === 'shows' ? allShows.length : state.movies.length,
            forYou:
              viewMode === 'shows'
                ? recommendations.shows.length
                : recommendations.movies.length,
            anime: viewMode === 'shows' ? countShowsAnime : countCatAnime,
            series: viewMode === 'shows' ? countShowsSeries : countCatSeries,
            movie: viewMode === 'shows' ? countShowsMovies : countCatMovies,
            documentary: viewMode === 'shows' ? countShowsDoc : countCatDoc,
            cartoon: viewMode === 'shows' ? countShowsCartoon : countCatCartoon
          }}
        />
      )}
  
      {catalogFeedback && (
        <div
          className="alazter-global-toast"
          onClick={() => setCatalogFeedback(null)}
          title="Clique para fechar aviso"
        >
          <FontAwesomeIcon
            icon={
              resolveToastIconType(catalogFeedback) === 'loading'
                ? faRotate
                : resolveToastIconType(catalogFeedback) === 'error'
                  ? faCircleInfo
                  : faCheck
            }
            spin={resolveToastIconType(catalogFeedback) === 'loading'}
          />
          <span>{catalogFeedback}</span>
          <button
            type="button"
            className="toast-dismiss-btn"
            onClick={(e) => {
              e.stopPropagation()
              setCatalogFeedback(null)
            }}
            title="Fechar aviso"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      )}
  
      {/* =========================================================================
                 TAB 1: MEUS FILMES (JELLYFIN STYLE COMPLETO)
                 ========================================================================= */}
      {activeTab === 'local' && (
        <section className="view-container catalog-home">
          {state.movies.length === 0 ? (
            <div className="alazter-empty-state">
              <FontAwesomeIcon icon={faFilm} className="empty-icon" />
              <h3>Nenhum filme catalogado</h3>
              <p>
                Adicione suas pastas de mídia locais para que o Alazterflix
                catalogue seus filmes com metadados e suporte a reprodução
                acelerada por GPU.
              </p>
              <button className="btn-action primary" onClick={handleAddFolder}>
                <FontAwesomeIcon icon={faFolderPlus} />
                <span>Adicionar Primeira Pasta de Filmes</span>
              </button>
            </div>
          ) : (
            <>
              {/* HERO SHOWCASE BANNER */}
              {selectedCategory === 'forYou' && heroMovie && (
                <div
                  className="hero-banner"
                  aria-label="Destaques da biblioteca"
                  onMouseEnter={() => featured.setHovered(true)}
                  onMouseLeave={() => featured.setHovered(false)}
                  onFocusCapture={() => featured.setFocused(true)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      featured.setFocused(false)
                  }}
                >
                  <FeaturedArtwork key={heroMovie.id} movie={heroMovie} />
                  <div className="hero-backdrop-gradient" />
                  <div className="hero-content">
                    <div key={heroMovie.id} className="hero-copy">
                      <div className="hero-eyebrow">
                        <span />
                        UMA HISTÓRIA PARA IR ALÉM
                      </div>
                      <h2 className="hero-title" aria-label={heroTitle}>
                        {heroTitleBreak > 0 ? (
                          <>
                            {heroTitle.slice(0, heroTitleBreak)}{' '}
                            <span className="hero-title-accent">
                              {heroTitle.slice(heroTitleBreak + 1)}
                            </span>
                          </>
                        ) : (
                          heroTitle
                        )}
                      </h2>
                      <div className="hero-tags">
                        {mediaTmdbRating(heroMovie) !== undefined && (
                          <span className="tag-badge tag-rating">
                            <FontAwesomeIcon icon={faStar} /> {mediaTmdbRating(heroMovie)} · TMDB
                          </span>
                        )}
                        <span className="hero-meta-text">
                          {heroMovie.year}
                          {heroMovie.durationFormatted && (
                            <> &bull; {heroMovie.durationFormatted}</>
                          )}
                        </span>
                        {heroMovie.genres?.[0] && (
                          <span className="hero-meta-text">
                            {heroMovie.genres[0]}
                          </span>
                        )}
                        {heroMovie.resolution && (
                          <span className="tag-badge tag-4k">
                            {heroMovie.resolution}
                          </span>
                        )}
                      </div>
                      <p className="hero-synopsis">
                        {heroMovie.synopsis || 'Sinopse indisponível.'}
                      </p>
                      </div>
                    <div className="hero-actions">
                      <button
                        className="btn-play-hero"
                        onClick={() => handlePlayMovie(heroMovie)}
                      >
                        <FontAwesomeIcon icon={faPlay} />
                        <span>
                          {heroMovie.progressSeconds
                            ? 'Continuar Assistindo'
                            : 'Assistir agora'}
                        </span>
                      </button>
                      <button
                        className="btn-secondary-hero"
                        onClick={() => setSelectedMovie(heroMovie)}
                      >
                        <FontAwesomeIcon icon={faCircleInfo} />
                        <span>Saiba mais</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-hero"
                        onClick={featured.surprise}
                      >
                        <FontAwesomeIcon icon={faWandMagicSparkles} />
                        <span>Surpreenda-me</span>
                      </button>
                    </div>
                  </div>
                  <nav
                    className="hero-pagination"
                    aria-label="Destaques do catálogo"
                  >
                    {featured.movies.length > 1 && (
                      <button
                        type="button"
                        className="hero-rotation-toggle"
                        aria-label={featured.paused ? 'Retomar rotação dos destaques' : 'Pausar rotação dos destaques'}
                        aria-pressed={featured.paused}
                        onClick={featured.togglePaused}
                      >
                        <FontAwesomeIcon icon={featured.paused ? faPlay : faPause} />
                      </button>
                    )}
                    {featured.movies.map((movie, index) => (
                      <button
                        type="button"
                        key={movie.id}
                        aria-label={`Destaque ${index + 1}: ${movie.customTitle || movie.title}`}
                        aria-pressed={index === featured.index}
                        onClick={() => featured.select(index)}
                      />
                    ))}
                  </nav>
                </div>
              )}
  
              {/* CONTINUAR ASSISTINDO */}
              {selectedCategory === 'forYou' && continueWatchingList.length > 0 && (
                <div className="continue-section">
                  <div className="section-header">
                    <h3 className="section-title">Continue de onde parou</h3>
                    <div className="continue-actions">
                      {showAllContinue && (
                        <button
                          type="button"
                          className="catalog-text-button"
                          disabled={clearingContinue}
                          title="Retira os vídeos desta lista e mantém o ponto de reprodução. Eles voltam ao assistir novamente."
                          onClick={() => void handleClearContinue()}
                        >
                          {clearingContinue ? 'Limpando…' : 'Limpar lista'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="catalog-text-button"
                        onClick={() => setShowAllContinue((previous) => !previous)}
                      >
                        {showAllContinue ? 'Mostrar menos' : 'Ver todos'}
                        <FontAwesomeIcon icon={faArrowRight} />
                      </button>
                    </div>
                  </div>
                  <div className="continue-row">
                    {(showAllContinue
                      ? continueWatchingList
                      : continueWatchingList.slice(0, 3)
                    ).map((movie) => {
                      const hist =
                        state.playbackHistory?.[movie.id] ||
                        (movie.filePath
                          ? state.playbackHistory?.[movie.filePath]
                          : undefined)
                      const prog =
                        hist?.progressSeconds ?? movie.progressSeconds ?? 0
                      const dur = hist?.durationSeconds || movie.duration || 0
                      const pct =
                        dur > 0
                          ? Math.min(100, Math.round((prog / dur) * 100))
                          : 0
                      const displayTitle = movie.customTitle || movie.title
                      const seasonEpTag =
                        movie.isSeries && movie.season !== undefined
                          ? `T${movie.season}${movie.episode !== undefined ? ` · E${movie.episode}` : ''}`
                          : null
  
                      return (
                        <button
                          type="button"
                          key={movie.id}
                          className="continue-card"
                          aria-label={`Continuar ${displayTitle}`}
                          onClick={() => handlePlayMovie(movie)}
                        >
                          <div className="continue-thumb-box">
                            {getMediaImageUrl(
                              movie.backdropUrl ||
                                (movie.localBackdropPath
                                  ? `imagecache://localhost/${encodeURIComponent(movie.localBackdropPath)}`
                                  : undefined) ||
                                movie.coverUrl ||
                                (movie.localCoverPath
                                  ? `imagecache://localhost/${encodeURIComponent(movie.localCoverPath)}`
                                  : undefined)
                            ) ? (
                              <img
                                src={getMediaImageUrl(
                                  movie.backdropUrl ||
                                    (movie.localBackdropPath
                                      ? `imagecache://localhost/${encodeURIComponent(movie.localBackdropPath)}`
                                      : undefined) ||
                                    movie.coverUrl ||
                                    (movie.localCoverPath
                                      ? `imagecache://localhost/${encodeURIComponent(movie.localCoverPath)}`
                                      : undefined)
                                )}
                                alt={displayTitle}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  background:
                                    'linear-gradient(135deg, #16202e, #0c121a)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'rgba(255,255,255,0.2)'
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={faFilm}
                                  style={{ fontSize: 38 }}
                                />
                              </div>
                            )}
                            <div className="play-overlay-icon">
                              <FontAwesomeIcon icon={faPlay} />
                            </div>
                            <div
                              className="progress-bar-container"
                              role="progressbar"
                              aria-label={`Progresso em ${displayTitle}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={dur > 0 ? pct : undefined}
                            >
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div className="continue-info">
                            <h4>{displayTitle}</h4>
                            <div className="continue-meta">
                              {seasonEpTag && <span>{seasonEpTag}</span>}
                              <span>
                                {dur > 0
                                  ? `${Math.max(0, Math.ceil((dur - prog) / 60))} min restantes`
                                  : 'Em andamento'}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
  
              {(selectedCategory === 'all' || selectedCategory === 'forYou') && (
                <section className="category-shortcuts-section">
                  <div className="section-header">
                    <h3 className="section-title">Qual é o seu universo?</h3>
                    <span className="section-subtitle">
                      Um play para cada momento.
                    </span>
                  </div>
                  <CategoryShortcuts onSelect={setSelectedCategory} />
                </section>
              )}
  
              {/* CATÁLOGO EM GRID (PROGRESSIVO ULTRA-FLUIDO A 60-120 FPS) */}
              <div className="home-catalog-section">
                <div className="section-header">
                  <div>
                    <span className="catalog-kicker">SEU PRÓXIMO PLAY</span>
                    <h3 className="section-title">
                      {selectedCategory === 'forYou'
                        ? 'Em alta no Alazterflix'
                        : selectedCategory === 'all'
                          ? 'Todos os títulos'
                          : {
                              anime: 'Animes',
                              series: 'Séries',
                              movie: 'Filmes',
                              documentary: 'Documentários',
                              cartoon: 'Desenhos'
                            }[selectedCategory]}
                    </h3>
                  </div>
                  <div className="catalog-header-actions">
                    <span className="section-subtitle">
                      {selectedCategory === 'forYou'
                        ? 'Escolhidos para você'
                        : `${currentTotalCount} ${currentTotalCount === 1 ? 'título' : 'títulos'}`}
                    </span>
                    <CatalogCoverSize
                      size={coverSize}
                      onChange={changeCoverSize}
                    />
                  </div>
                </div>
  
                <div className="movies-grid" data-cover-size={coverSize}>
                  {viewMode === 'shows'
                    ? visibleShows.map((show) => (
                        <CatalogPoster
                          key={show.id}
                          show={show}
                          onSelect={handleSelectShow}
                          isFavorite={favorites.includes(show.sampleMovie.id)}
                          onToggleFavorite={toggleFavorite}
                          preferences={cardPreferences}
                          isWatched={show.seasons.every((season) => season.episodes.every((episode) => episode.isWatched))}
                          onToggleWatched={() => updateMediaPreferences(show.seasons.flatMap((season) => season.episodes.map((episode) => episode.id)), { isWatched: !show.seasons.every((season) => season.episodes.every((episode) => episode.isWatched)) })}
                          onRate={(userRating) => updateMediaPreferences(show.seasons.flatMap((season) => season.episodes.map((episode) => episode.id)), { userRating })}
                          onPlay={() => handlePlayMovie(show.seasons.flatMap((season) => season.episodes).find((episode) => !episode.isWatched) || show.sampleMovie)}
                        />
                      ))
                    : visibleMovies.map((movie) => (
                        <CatalogPoster
                          key={movie.id}
                          movie={movie}
                          onSelect={handleSelectMovie}
                          isFavorite={favorites.includes(movie.id)}
                          onToggleFavorite={toggleFavorite}
                          preferences={cardPreferences}
                          isWatched={movie.isWatched}
                          onToggleWatched={() => updateMediaPreferences([movie.id], { isWatched: !movie.isWatched })}
                          onRate={(userRating) => updateMediaPreferences([movie.id], { userRating })}
                          onPlay={handlePlayMovie}
                        />
                      ))}
                </div>
  
                {currentTotalCount === 0 && (
                  <p className="catalog-empty-results" role="status">
                    {selectedCategory === 'forYou'
                      ? 'Nenhuma sugestão disponível com os filtros atuais. Explore a aba Todos.'
                      : 'Nenhum título encontrado com os filtros atuais.'}
                  </p>
                )}
  
                {/* SENTINEL PARA CARREGAMENTO PROGRESSIVO VIA INTERSECTIONOBSERVER */}
                <div
                  ref={sentinelRef}
                  className="catalog-load-sentinel"
                  aria-hidden="true"
                />
  
                {visibleCount < currentTotalCount && (
                  <button
                    type="button"
                    className="catalog-load-more"
                    onClick={() =>
                      setVisibleCount((count) =>
                        Math.min(count + BATCH_SIZE, currentTotalCount)
                      )
                    }
                  >
                    Carregar mais títulos <FontAwesomeIcon icon={faChevronDown} />
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
  
      {/* =========================================================================
                 TAB 2: STREMIO & CATÁLOGO
                 ========================================================================= */}
      {activeTab === 'stremio' && (
        <section className="view-container">
          <div className="filter-bar">
            <div className="filter-search" style={{ width: 380 }}>
              <FontAwesomeIcon icon={faSearch} />
              <input
                type="text"
                placeholder="Buscar no ecossistema Stremio Addons..."
                value={stremioSearch}
                onChange={(e) => setStremioSearch(e.target.value)}
              />
            </div>
            <div className="filter-chips">
              <button
                className={`chip-btn ${selectedCatalogId === 'top' ? 'active' : ''}`}
                onClick={() => setSelectedCatalogId('top')}
              >
                Populares (Cinemeta)
              </button>
              <button
                className={`chip-btn ${selectedCatalogId === 'imdbRating' ? 'active' : ''}`}
                onClick={() => setSelectedCatalogId('imdbRating')}
              >
                Mais Bem Avaliados
              </button>
              <span
                style={{
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid var(--alazter-cyan)',
                  color: 'var(--alazter-cyan)',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <FontAwesomeIcon icon={faGlobe} /> Stremio v3 Ready
              </span>
            </div>
          </div>
  
          <div>
            <div className="section-header">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faGlobe} />
                <span>Catálogo Global Stremio</span>
              </h3>
              <span className="section-subtitle">
                Provedor primário: Cinemeta Oficial
              </span>
            </div>
  
            {stremioLoading ? (
              <div className="alazter-empty-state">
                <p>Carregando catálogo Stremio...</p>
              </div>
            ) : (
              <div className="movies-grid">
                {stremioCatalog.map((item) => (
                  <div
                    key={item.id}
                    className="movie-poster-card"
                    onClick={() => handleOpenStremioItem(item)}
                  >
                    <div className="poster-image-box">
                      {item.poster ? (
                        <img src={item.poster} alt={item.name} loading="lazy" />
                      ) : (
                        <div className="poster-fallback">
                          <FontAwesomeIcon icon={faTv} />
                        </div>
                      )}
                      <div className="card-top-badges">
                        <span className="badge-res res-4k">ONLINE</span>
                        <span className="badge-rating">
                          <FontAwesomeIcon icon={faStar} />{' '}
                          {item.imdbRating || '8.0'}
                        </span>
                      </div>
                    </div>
                    <div className="movie-card-info">
                      <h4>{item.name}</h4>
                      <div className="movie-card-meta">
                        <span>{item.releaseInfo || 'Stremio'}</span>
                        <span>Filme</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
  
      {/* =========================================================================
                 TAB 3: ADDONS STREMIO
                 ========================================================================= */}
      {activeTab === 'addons' && (
        <section className="view-container">
          <div className="section-header">
            <h3 className="section-title">
              <FontAwesomeIcon icon={faPuzzlePiece} />
              <span>Addons Stremio Instalados ({state.addons.length})</span>
            </h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                placeholder="URL do Manifesto Stremio..."
                value={newAddonUrl}
                onChange={(e) => setNewAddonUrl(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--alazter-border-subtle)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  width: 280
                }}
              />
              <button
                className="btn-action primary"
                onClick={() => handleInstallAddon()}
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Instalar Addon</span>
              </button>
            </div>
          </div>
  
          <div className="settings-grid">
            {state.addons.map((addon) => (
              <div key={addon.id} className="settings-card">
                <h3>
                  <FontAwesomeIcon icon={faFilm} />
                  <span>{addon.name}</span>
                </h3>
                <p>
                  {addon.description || 'Addon oficial do protocolo Stremio v3.'}
                </p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(0, 255, 255, 0.15)',
                      border: '1px solid var(--alazter-cyan)',
                      color: 'var(--alazter-cyan)',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4
                    }}
                  >
                    {addon.isEnabled ? 'ATIVO' : 'DESATIVADO'}
                  </span>
                  {addon.id !== 'org.stremio.cinemeta' && (
                    <button
                      className="btn-action"
                      style={{
                        color: '#ef4444',
                        borderColor: 'rgba(239,68,68,0.4)'
                      }}
                      onClick={() => handleRemoveAddon(addon.id)}
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                      <span>Remover</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
  
      {/* =========================================================================
                 TAB 4: CONFIGURAÇÕES
                 ========================================================================= */}
      {activeTab === 'settings' && (
        <section className="view-container settings-view">
          <button
            type="button"
            className="catalog-back-button"
            onClick={() => setActiveTab('local')}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Voltar ao catálogo
          </button>
          <div className="section-header">
            <h3 className="section-title">
              <FontAwesomeIcon icon={faSlidersH} />
              <span>Configurações do Alazterflix</span>
            </h3>
          </div>
  
          <div className="header-library-toolbar">
            {/* HEADER TABS */}
            <nav className="header-nav-tabs" aria-label="Biblioteca e serviços">
              <button
                type="button"
                className="tab-btn"
                onClick={() => setActiveTab('local')}
              >
                <FontAwesomeIcon icon={faFolderOpen} />
                <span>Meus Filmes ({state.movies.length})</span>
              </button>
              <button
                type="button"
                className="tab-btn"
                onClick={() => setActiveTab('stremio')}
              >
                <FontAwesomeIcon icon={faTv} />
                <span>Stremio &amp; Catálogo</span>
              </button>
              <button
                type="button"
                className="tab-btn"
                onClick={() => setActiveTab('addons')}
              >
                <FontAwesomeIcon icon={faPuzzlePiece} />
                <span>Addons</span>
              </button>
            </nav>
  
            <div className="header-library-actions header-right-actions">
              <button
                className="btn-action"
                onClick={handleAutoCatalogAll}
                disabled={isCataloging}
                title="Auto-catalogar temporadas e episódios em toda a biblioteca"
              >
                <FontAwesomeIcon icon={faTags} />
                <span>{isCataloging ? 'Catalogando...' : 'Auto-Catalogar'}</span>
              </button>
              <button
                className="btn-action"
                onClick={handleRescan}
                title="Re-escanear pastas locais"
              >
                <FontAwesomeIcon icon={faRotate} />
                <span>Re-escanear</span>
              </button>
              <button
                className="btn-action primary"
                onClick={handleAddFolder}
                title="Adicionar pasta de filmes"
              >
                <FontAwesomeIcon icon={faFolderPlus} />
                <span>Adicionar Pasta</span>
              </button>
            </div>
          </div>
  
          {/* BANNER TOAST DE FEEDBACK DE CATALOGAÇÃO */}
          {state.isPluginActive && state.movies.length > 0 && (
            <div className="alazter-artwork-library">
              <div className="artwork-library-summary">
                <strong>
                  <FontAwesomeIcon icon={faImage} /> Capas em português do Brasil
                </strong>
                <span>
                  {allShows.length} obras · {state.movies.length} vídeos
                </span>
                <button
                  type="button"
                  className={
                    selectedQualityFilter === 'missingArtwork' ? 'active' : ''
                  }
                  onClick={() => {
                    setSelectedQualityFilter(
                      selectedQualityFilter === 'missingArtwork'
                        ? 'all'
                        : 'missingArtwork'
                    )
                    setSelectedCategory('all')
                    setSearchInput('')
                    setActiveTab('local')
                  }}
                >
                  Sem capa (
                  {
                    allShows.filter(
                      (show) => !show.coverUrl || show.sampleMovie.artworkMissing
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  className={
                    selectedQualityFilter === 'unidentified' ? 'active' : ''
                  }
                  onClick={() => {
                    setSelectedQualityFilter(
                      selectedQualityFilter === 'unidentified'
                        ? 'all'
                        : 'unidentified'
                    )
                    setSelectedCategory('all')
                    setSearchInput('')
                    setActiveTab('local')
                  }}
                >
                  Revisar identificação (
                  {
                    allShows.filter((show) =>
                      ['needs-identification', 'error'].includes(
                        show.sampleMovie.metadataStatus || ''
                      )
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  className={
                    selectedQualityFilter === 'portugueseArtwork' ? 'active' : ''
                  }
                  onClick={() => {
                    setSelectedQualityFilter(
                      selectedQualityFilter === 'portugueseArtwork'
                        ? 'all'
                        : 'portugueseArtwork'
                    )
                    setSelectedCategory('all')
                    setSearchInput('')
                    setActiveTab('local')
                  }}
                >
                  Capa em português pendente (
                  {
                    allShows.filter((show) =>
                      needsPortuguesePoster(show.sampleMovie)
                    ).length
                  }
                  )
                </button>
              </div>
              <div className="artwork-library-actions">
                <button
                  type="button"
                  onClick={() => handleRefreshMetadata('portuguese')}
                  disabled={state.metadataJob?.running}
                >
                  Buscar capas em português
                </button>
                <button
                  type="button"
                  onClick={() => handleRefreshMetadata('missing')}
                  disabled={state.metadataJob?.running}
                >
                  Completar capas ausentes
                </button>
                <button
                  type="button"
                  onClick={() => handleRefreshMetadata('all')}
                  disabled={state.metadataJob?.running}
                >
                  Atualizar informações
                </button>
              </div>
              {state.metadataJob && state.metadataJob.total > 0 && (
                <div className="artwork-job" role="status" aria-live="polite">
                  <span>
                    {state.metadataJob.running
                      ? 'Atualizando: ' +
                        (state.metadataJob.currentTitle || 'preparando…')
                      : 'Atualização encerrada'}{' '}
                    · {state.metadataJob.completed}/{state.metadataJob.total}{' '}
                    obras
                  </span>
                  <progress
                    value={state.metadataJob.completed}
                    max={state.metadataJob.total}
                    aria-label="Progresso da atualização de capas"
                  />
                  <small>
                    {state.metadataJob.matched} identificadas ·{' '}
                    {state.metadataJob.unidentified} para escolher ·{' '}
                    {state.metadataJob.failed} falhas
                  </small>
                  {state.metadataJob.lastError && (
                    <small>{state.metadataJob.lastError}</small>
                  )}
                  {state.metadataJob.running && (
                    <button type="button" onClick={handleCancelMetadata}>
                      Interromper
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
  
          {/* FILTROS, CATEGORIAS E BUSCA */}
          <div className="filter-bar">
            <h4 className="filter-heading">Exibição do catálogo</h4>
            <CatalogCardSettings movie={state.movies.find((movie) => mediaPoster(movie)) || state.movies[0]} />
            <CatalogCoverSize size={coverSize} onChange={changeCoverSize} />
            <div className="filter-top-row">
              {/* ALTERNADOR DE MODO: OBRAS (JELLYFIN) VS EPISÓDIOS AVULSOS */}
              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'shows' ? 'active' : ''}`}
                  onClick={() => setViewMode('shows')}
                  title="Agrupamento inteligente Jellyfin (1 card por anime/série/filme)"
                >
                  <FontAwesomeIcon icon={faLayerGroup} />
                  <span>Obras Agrupadas ({allShows.length})</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'allFiles' ? 'active' : ''}`}
                  onClick={() => setViewMode('allFiles')}
                  title="Exibir todos os arquivos de vídeo"
                >
                  <FontAwesomeIcon icon={faFilm} />
                  <span>Todos os Episódios ({state.movies.length})</span>
                </button>
              </div>
            </div>
  
            {/* SUB-FILTROS DE QUALIDADE E STATUS */}
            <div className="sub-filters-row">
              <span className="sub-filters-label">Qualidade &amp; Status:</span>
              <button
                type="button"
                className={`chip-btn ${selectedQualityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedQualityFilter('all')}
              >
                Qualquer
              </button>
              <button
                type="button"
                className={`chip-btn ${selectedQualityFilter === '4k' ? 'active' : ''}`}
                onClick={() => setSelectedQualityFilter('4k')}
              >
                4K UHD ({count4k})
              </button>
              <button
                type="button"
                className={`chip-btn ${selectedQualityFilter === '1080p' ? 'active' : ''}`}
                onClick={() => setSelectedQualityFilter('1080p')}
              >
                1080p ({count1080p})
              </button>
              <button
                type="button"
                className={`chip-btn ${selectedQualityFilter === 'unwatched' ? 'active' : ''}`}
                onClick={() => setSelectedQualityFilter('unwatched')}
              >
                Não Assistidos ({countUnwatched})
              </button>
              <button
                type="button"
                className={`chip-btn ${selectedQualityFilter === 'watched' ? 'active' : ''}`}
                onClick={() => setSelectedQualityFilter('watched')}
              >
                Assistidos ({countWatched})
              </button>
            </div>
          </div>
  
          <div className="settings-grid">
            <MetadataSettings
              settings={state.metadataSettings}
              onSaved={(metadataSettings) =>
                setState((previous) => ({ ...previous, metadataSettings }))
              }
            />
            <SubtitleStyleSettings />
            {/* Pastas de Filmes */}
            <div className="settings-card">
              <h3>
                <FontAwesomeIcon icon={faFolder} />
                <span>Pastas Locais de Filmes</span>
              </h3>
              <p>
                Pastas monitoradas onde o Alazterflix procura arquivos de vídeo
                (.mkv, .mp4, etc.).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state.folders.map((folder) => (
                  <div key={folder} className="folder-item">
                    <span className="folder-path" title={folder}>
                      {folder}
                    </span>
                    <button
                      className="btn-icon-danger"
                      onClick={() => handleRemoveFolder(folder)}
                      title="Remover pasta"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-action primary" onClick={handleAddFolder}>
                <FontAwesomeIcon icon={faPlus} />
                <span>Adicionar Nova Pasta</span>
              </button>
            </div>
  
            {/* Reprodutor & Hardware */}
            <div className="settings-card">
              <h3>
                <FontAwesomeIcon icon={faMicrochip} />
                <span>Reprodução &amp; Hardware</span>
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  fontSize: 13
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Aceleração de Hardware GPU (NVDEC / VAAPI)</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Salvar Progresso de Vídeo Automaticamente</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Buscar Legendas em Português Automaticamente</span>
                  <input type="checkbox" defaultChecked />
                </label>
  
                {/* Layout de Temporadas no Player */}
                <div
                  className="settings-season-layout-group"
                  style={{
                    marginTop: 10,
                    paddingTop: 14,
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faListUl}
                      style={{ color: 'var(--alazter-cyan)' }}
                    />
                    <span>Layout das Temporadas na Gaveta do Player</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#94a3b8',
                      marginBottom: 10
                    }}
                  >
                    Escolha o estilo de exibição dos botões de temporada na gaveta
                    lateral de episódios:
                  </div>
                  <div className="season-layout-options-grid">
                    <div
                      className={`season-layout-option-card ${
                        seasonDrawerLayout === 'stepper' ? 'active' : ''
                      }`}
                      onClick={() => handleUpdateSeasonDrawerLayout('stepper')}
                    >
                      <div
                        className="layout-card-badge"
                        style={{
                          background: 'rgba(0, 229, 255, 0.25)',
                          borderColor: '#00e5ff',
                          color: '#00e5ff'
                        }}
                      >
                        Padrão
                      </div>
                      <div className="layout-card-title">
                        <FontAwesomeIcon icon={faArrowsLeftRight} />
                        <span>Stepper (&lt; 3ª TEMPORADA &gt;)</span>
                      </div>
                      <div className="layout-card-desc">
                        Navegação linear por setas (&lt; e &gt;) com temporada no
                        centro. O botão apaga e fica não-clicável no início ou
                        fim.
                      </div>
                    </div>
  
                    <div
                      className={`season-layout-option-card ${
                        seasonDrawerLayout === 'dropdown' ? 'active' : ''
                      }`}
                      onClick={() => handleUpdateSeasonDrawerLayout('dropdown')}
                    >
                      <div className="layout-card-title">
                        <FontAwesomeIcon icon={faLayerGroup} />
                        <span>Dropdown Stremio</span>
                      </div>
                      <div className="layout-card-desc">
                        Menu suspenso elegante no topo (Apple TV style). Ocupa
                        mínimo espaço e desafoga a lista de episódios.
                      </div>
                    </div>
  
                    <div
                      className={`season-layout-option-card ${
                        seasonDrawerLayout === 'pills' ? 'active' : ''
                      }`}
                      onClick={() => handleUpdateSeasonDrawerLayout('pills')}
                    >
                      <div className="layout-card-title">
                        <FontAwesomeIcon icon={faTags} />
                        <span>Pílulas Netflix</span>
                      </div>
                      <div className="layout-card-desc">
                        Chips horizontais flexíveis lado a lado. Salto direto para
                        qualquer temporada em 1 clique.
                      </div>
                    </div>
  
                    <div
                      className={`season-layout-option-card ${
                        seasonDrawerLayout === 'accordion' ? 'active' : ''
                      }`}
                      onClick={() => handleUpdateSeasonDrawerLayout('accordion')}
                    >
                      <div className="layout-card-title">
                        <FontAwesomeIcon icon={faBarsStaggered} />
                        <span>Sanfona Jellyfin</span>
                      </div>
                      <div className="layout-card-desc">
                        Seções colapsáveis na própria lista de episódios. Ideal
                        para visualização contínua de episódios.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            {/* Sandbox GhostShield */}
            <div className="settings-card">
              <h3>
                <FontAwesomeIcon icon={faShieldHalved} />
                <span>Sandbox GhostShield</span>
              </h3>
              <p>
                Status de segurança do plugin isolado. O código de mídia roda 100%
                dentro da sandbox.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ID do Plugin:</span>
                  <code style={{ color: 'var(--alazter-cyan)' }}>
                    com.ghost.alazterflix
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Servidor de Streaming HTTP 206:</span>
                  <span style={{ color: '#4ade80' }}>Ativo (Range Seek)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nível de Auditoria:</span>
                  <span style={{ color: '#4ade80' }}>🛡️ Tier 1 Verificado</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
  
      <footer className="catalog-footer">
        <span className="footer-wordmark">
          Alazter<span>flix</span>
        </span>
        <span className="footer-slogan">
          Seu cinema. Seu ritmo. Seu universo.
        </span>
      </footer>

      {/* =========================================================================
         MODAL DE DETALHES DA OBRA/SÉRIE/ANIME (JELLYFIN STYLE COMPLETO)
         ========================================================================= */}
      {selectedShow && (
        <ShowDetailsModal
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
          onPlayEpisode={handlePlayMovie}
          onEditMovie={handleOpenEditMovie}
          onEnrichShow={handleEnrichSingleMovie}
        />
      )}

      {/* =========================================================================
         MODAL DE DETALHES DO FILME (IDÊNTICO AO MOCKUP)
         ========================================================================= */}
      {selectedMovie && (
        <div className="alazter-modal-overlay">
          <div className="modal-container">
            <button
              className="modal-close-btn"
              onClick={() => setSelectedMovie(null)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <div className="modal-hero-cover">
              {getMediaImageUrl(
                selectedMovie.backdropUrl ||
                  (selectedMovie.localBackdropPath
                    ? `imagecache://localhost/${encodeURIComponent(selectedMovie.localBackdropPath)}`
                    : undefined) ||
                  selectedMovie.coverUrl
              ) ? (
                <img
                  src={getMediaImageUrl(
                    selectedMovie.backdropUrl ||
                      (selectedMovie.localBackdropPath
                        ? `imagecache://localhost/${encodeURIComponent(selectedMovie.localBackdropPath)}`
                        : undefined) ||
                      selectedMovie.coverUrl
                  )}
                  alt="Backdrop"
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, #1a2230, #0a0e14)'
                  }}
                />
              )}
              <div className="modal-cover-gradient" />
            </div>
            <div className="modal-body">
              <div className="modal-poster-col">
                {getMediaImageUrl(
                  selectedMovie.coverUrl ||
                    (selectedMovie.localCoverPath
                      ? `imagecache://localhost/${encodeURIComponent(selectedMovie.localCoverPath)}`
                      : undefined)
                ) ? (
                  <img
                    src={getMediaImageUrl(
                      selectedMovie.coverUrl ||
                        (selectedMovie.localCoverPath
                          ? `imagecache://localhost/${encodeURIComponent(selectedMovie.localCoverPath)}`
                          : undefined)
                    )}
                    alt="Poster"
                  />
                ) : (
                  <div
                    style={{
                      aspectRatio: '2/3',
                      background: '#1a2230',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.3)'
                    }}
                  >
                    <FontAwesomeIcon icon={faFilm} style={{ fontSize: 36 }} />
                  </div>
                )}
              </div>
              <div className="modal-info-col">
                <h2>{selectedMovie.customTitle || selectedMovie.title}</h2>
                <div className="modal-badges-row">
                  {selectedMovie.season !== undefined && (
                    <span
                      className="tag-badge badge-season"
                      title={`Temporada ${selectedMovie.season}`}
                    >
                      S{String(selectedMovie.season).padStart(2, '0')}
                    </span>
                  )}
                  {selectedMovie.episode !== undefined && (
                    <span
                      className="tag-badge badge-episode"
                      title={`Episódio ${selectedMovie.episode}`}
                    >
                      E{String(selectedMovie.episode).padStart(2, '0')}
                    </span>
                  )}
                  <span className="tag-badge tag-4k">
                    {selectedMovie.resolution} REMUX
                  </span>
                  {mediaTmdbRating(selectedMovie) !== undefined && <span className="tag-badge tag-rating">
                    <FontAwesomeIcon icon={faStar} />{' '}
                    {mediaTmdbRating(selectedMovie)} · TMDB
                  </span>}
                  {selectedMovie.userRating !== undefined && <span className="tag-badge tag-rating">Sua nota: {selectedMovie.userRating}/10</span>}
                  <span
                    style={{ fontSize: 12, color: 'var(--alazter-text-muted)' }}
                  >
                    {selectedMovie.year || 'Ano não informado'} &bull;{' '}
                    {selectedMovie.durationFormatted || 'Duração não informada'}
                  </span>
                </div>
                <p className="modal-synopsis">
                  {selectedMovie.synopsis ||
                    'Filme indexado na biblioteca Alazterflix pronto para reprodução.'}
                </p>

                <div className="modal-tech-specs">
                  <div className="spec-item">
                    <span className="spec-label">Resolução:</span>
                    <span>
                      {selectedMovie.resolution === '4K'
                        ? '3840x2160 (2160p)'
                        : '1920x1080 (1080p)'}
                    </span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Codec:</span>
                    <span>
                      HEVC / H.264 (
                      {selectedMovie.container?.toUpperCase() || 'MKV'})
                    </span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Áudio:</span>
                    <span>Dolby Digital / Stereo</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Tamanho:</span>
                    <span>{selectedMovie.fileSize}</span>
                  </div>
                </div>

                <div className="modal-actions-bar">
                  <button
                    className="btn-play-modal"
                    onClick={() => handlePlayMovie(selectedMovie)}
                  >
                    <FontAwesomeIcon icon={faPlay} />
                    <span>Reproduzir Filme</span>
                  </button>
                  <button
                    className="btn-secondary-hero btn-edit-metadata"
                    onClick={() => handleOpenEditMovie(selectedMovie)}
                    title="Editar informações catalogadas no Ghost"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                    <span>Catalogar no Ghost</span>
                  </button>
                  <button
                    className="btn-secondary-hero"
                    onClick={() => handleEnrichSingleMovie(selectedMovie.id)}
                    title="Buscar capa e metadados no Cinemeta"
                  >
                    <FontAwesomeIcon icon={faWandMagicSparkles} />
                    <span>Buscar Capa</span>
                  </button>
                  <button
                    className="btn-secondary-hero"
                    onClick={() => setSelectedMovie(null)}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL DE EDIÇÃO E CATALOGAÇÃO JELLYFIN NO GHOST
         ========================================================================= */}
      {editingMovie && (
        <EditMovieModal
          movie={editingMovie}
          onClose={() => setEditingMovie(null)}
          onSave={handleSaveEditedMovie}
        />
      )}

      {/* =========================================================================
         MODAL DE STREAMS DO STREMIO
         ========================================================================= */}
      {selectedStremioItem && (
        <div className="alazter-modal-overlay">
          <div className="modal-container" style={{ maxWidth: 600 }}>
            <button
              className="modal-close-btn"
              onClick={() => setSelectedStremioItem(null)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <div style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 8, color: '#fff' }}>
                {selectedStremioItem.name}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--alazter-text-muted)',
                  marginBottom: 16
                }}
              >
                Selecione a fonte de streaming resolvida pelos Addons Stremio:
              </p>

              {loadingStreams ? (
                <p style={{ color: 'var(--alazter-cyan)' }}>
                  Resolvendo streams nos addons...
                </p>
              ) : availableStreams.length === 0 ? (
                <p style={{ color: 'var(--alazter-text-muted)' }}>
                  Nenhum stream direto localizado para este título nos addons
                  ativos.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 240,
                    overflowY: 'auto'
                  }}
                >
                  {availableStreams.map((stream, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        handlePlayStremioStream(stream, selectedStremioItem)
                      }
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--alazter-border-subtle)',
                        padding: '10px 14px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12
                        }}
                      >
                        <span className="tag-badge tag-4k">
                          {stream.quality || 'HD'}
                        </span>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#fff'
                            }}
                          >
                            {stream.addonName || 'Addon Stream'}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--alazter-text-muted)'
                            }}
                          >
                            {stream.details || stream.name || 'Stream online'}
                          </div>
                        </div>
                      </div>
                      <FontAwesomeIcon
                        icon={faCirclePlay}
                        style={{ color: 'var(--alazter-cyan)', fontSize: 20 }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         PLAYER DE VÍDEO FULLSCREEN (CYBER NEON RANGE SEEK 206)
         ========================================================================= */}
      {/* =========================================================================
         PLAYER DE VÍDEO FULLSCREEN CYBER NEON (STREMIO & JELLYFIN STYLE)
         ========================================================================= */}
      {playerMovie && (
        <div
          ref={playerContainerRef}
          className="alazter-player-modal"
          onMouseMove={handlePlayerMouseMove}
          onWheel={handleContainerWheel}
        >
          {/* HEADER DO PLAYER COM CAPA 2:3, METADADOS E SEM TAG HTTP 206 */}
          <div className={`player-header ${controlsVisible ? '' : 'hidden'}`}>
            <div className="player-title-box">
              {playerMovie.coverUrl && (
                <img
                  src={getMediaImageUrl(playerMovie.coverUrl)}
                  alt={playerMovie.title}
                  className="player-poster-thumb"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              )}
              <div className="player-info-meta">
                <div className="player-main-title">
                  <FontAwesomeIcon
                    icon={faFilm}
                    style={{ color: 'var(--alazter-red)' }}
                  />
                  <span>{playerMovie.title}</span>
                </div>
                <div className="player-badges-row">
                  <span className="badge-res-pill">
                    {playerMovie.resolution || 'HD'}
                  </span>
                  {playerMovie.season !== undefined && (
                    <span className="badge-series-pill">
                      {`S${String(playerMovie.season).padStart(2, '0')}${playerMovie.episode !== undefined ? `E${String(playerMovie.episode).padStart(2, '0')}` : ''}`}
                    </span>
                  )}
                  {playerMovie.mediaCategory && (
                    <span className="badge-cat-tag">
                      {playerMovie.mediaCategory === 'anime'
                        ? '⛩️ Anime'
                        : playerMovie.mediaCategory === 'series'
                          ? '📺 Série'
                          : playerMovie.mediaCategory === 'cartoon'
                            ? '🎨 Desenho'
                            : playerMovie.mediaCategory === 'documentary'
                              ? '🌍 Doc'
                              : '🎬 Filme'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              className="p-btn-close"
              onClick={closePlayer}
              title="Fechar player (ESC)"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          {/* VIEWPORT DO VÍDEO COM DOUBLE CLICK FULLSCREEN E BUFFERING SPINNER */}
          <div
            className="player-video-viewport"
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            style={{
              ['--sub-font-size' as any]: subFontSize,
              ['--sub-color' as any]: subColor,
              ['--sub-bg' as any]:
                subBgStyle === 'box' ? 'rgba(0, 0, 0, 0.85)' : 'transparent',
              ['--sub-shadow' as any]:
                subBgStyle === 'box'
                  ? 'none'
                  : '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.9)',
              ['--sub-offset-y' as any]: `${(subPosition - 85) * 4}px`
            }}
          >
            <video
              ref={videoRef}
              src={playerMovie.streamUrl}
              poster={getMediaImageUrl(
                playerMovie.backdropUrl || playerMovie.coverUrl
              )}
              preload="auto"
              crossOrigin="anonymous"
            />

            {/* OVERLAY SOBERANO DE LEGENDAS (FRAME-ACCURATE CINEMA ENGINE) */}
            {activeCueText && (
              <div
                className="player-subtitle-overlay"
                style={{
                  bottom: `calc(${Math.max(1, Math.min(90, 100 - subPosition))}% + ${controlsVisible && subPosition < 92 ? '32px' : '0px'})`
                }}
              >
                <div
                  className={`player-subtitle-cue-box ${subBgStyle === 'box' ? 'style-box' : 'style-shadow'}`}
                  style={{
                    fontSize: subFontSize,
                    color: subColor,
                    backgroundColor:
                      subBgStyle === 'box' ? 'rgba(0, 0, 0, 0.85)' : 'transparent',
                    textShadow:
                      subBgStyle === 'box'
                        ? 'none'
                        : '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.9)'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeSubtitleHtml(activeCueText)
                  }}
                />
              </div>
            )}

            {/* TOAST DE SINCRONIA DE LEGENDA */}
            {subtitleToast && (
              <div
                className="player-subtitle-sync-toast"
                style={{
                  position: 'absolute',
                  top: '30px',
                  right: '30px',
                  background: 'rgba(0, 0, 0, 0.88)',
                  border: '1px solid var(--alazter-cyan, #00e5ff)',
                  color: 'var(--alazter-cyan, #00e5ff)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  zIndex: 35,
                  pointerEvents: 'none',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
                }}
              >
                {subtitleToast}
              </div>
            )}

            {isBuffering && (
              <div className="player-loading-overlay">
                <div className="player-spinner-ring" />
                <span className="player-loading-text">
                  Carregando transmissão...
                </span>
              </div>
            )}
          </div>

          {/* TRIGGER INVISÍVEL NA BORDA DIREITA E ABA FLUTUANTE ELEGANTE COM SETA */}
          {currentPlayingShow && !episodesDrawerOpen && (
            <>
              <div
                className="player-right-edge-trigger"
                onMouseEnter={handleRightEdgeHover}
                onMouseLeave={handleRightEdgeLeave}
              />
              <div
                className={`player-edge-arrow-tab ${edgeArrowTabVisible ? 'visible' : ''}`}
                onClick={expandDrawerFromArrowTab}
                onMouseEnter={handleArrowTabEnter}
                onMouseLeave={handleArrowTabLeave}
                title="Clique para ver episódios"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
                <span className="tab-hint-text">Eps</span>
              </div>
            </>
          )}

          {/* GAVETA LATERAL FLUTUANTE DE EPISÓDIOS (STREMIO STYLE) */}
          {episodesDrawerOpen && currentPlayingShow && (
            <div
              className="player-episodes-drawer"
              onMouseEnter={handleDrawerMouseEnter}
              onMouseLeave={handleDrawerMouseLeave}
            >
              <div className="drawer-header">
                <div className="drawer-title">
                  <FontAwesomeIcon
                    icon={faListUl}
                    style={{ color: 'var(--alazter-red)' }}
                  />
                  <span>
                    {currentPlayingShow.showTitle} &bull; Episódios
                  </span>
                </div>
                <button
                  className="btn-close-drawer"
                  onClick={() => {
                    drawerOpenedByHoverRef.current = false
                    setEpisodesDrawerOpen(false)
                  }}
                  title="Fechar gaveta"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              {/* LAYOUT 2 (PADRÃO / STREMIO STYLE): DROPDOWN CYBER NEON CUSTOMIZADO */}
              {seasonDrawerLayout === 'dropdown' && (
                <div className="drawer-seasons-dropdown-wrapper">
                  <button
                    type="button"
                    className="custom-season-select-btn"
                    onClick={() =>
                      setCustomSeasonDropdownOpen(!customSeasonDropdownOpen)
                    }
                  >
                    <span>
                      <FontAwesomeIcon
                        icon={faLayerGroup}
                        style={{
                          color: 'var(--alazter-cyan)',
                          marginRight: 8
                        }}
                      />
                      {currentSeasonObj?.seasonLabel || 'Temporada'} (
                      {currentSeasonObj?.episodes.length || 0} episódios)
                    </span>
                    <FontAwesomeIcon
                      icon={
                        customSeasonDropdownOpen
                          ? faChevronUp
                          : faChevronDown
                      }
                      style={{ fontSize: 11, color: '#94a3b8' }}
                    />
                  </button>
                  {customSeasonDropdownOpen && (
                    <div className="custom-season-dropdown-menu">
                      {currentPlayingShow.seasons.map((season) => (
                        <div
                          key={season.seasonNumber}
                          className={`custom-season-menu-item ${
                            drawerSeasonNumber === season.seasonNumber
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => {
                            setDrawerSeasonNumber(season.seasonNumber)
                            setCustomSeasonDropdownOpen(false)
                          }}
                        >
                          <span>
                            {season.seasonLabel} &bull;{' '}
                            {season.episodes.length} episódios
                          </span>
                          {drawerSeasonNumber === season.seasonNumber && (
                            <FontAwesomeIcon
                              icon={faCheck}
                              style={{
                                color: 'var(--alazter-cyan)',
                                fontSize: 12
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LAYOUT 4 (STEPPER STYLE): < 3ª TEMPORADA > NAVEGAÇÃO SEQUENCIAL COM DESATIVAÇÃO NO INÍCIO E FIM */}
              {seasonDrawerLayout === 'stepper' && (() => {
                const seasons = currentPlayingShow.seasons
                const foundIdx = seasons.findIndex(
                  (s) => s.seasonNumber === drawerSeasonNumber
                )
                const currentIdx = foundIdx >= 0 ? foundIdx : 0
                const isFirst = currentIdx <= 0
                const isLast = currentIdx >= seasons.length - 1
                const activeSeason = seasons[currentIdx] || currentSeasonObj || seasons[0]
                const seasonTitleDisplay =
                  activeSeason.seasonNumber > 0
                    ? `${activeSeason.seasonNumber}ª TEMPORADA`
                    : activeSeason.seasonLabel.toUpperCase()

                return (
                  <div className="drawer-seasons-stepper-wrapper">
                    <button
                      type="button"
                      className={`season-stepper-btn prev ${isFirst ? 'disabled' : ''}`}
                      disabled={isFirst}
                      onClick={() => {
                        if (!isFirst && currentIdx > 0) {
                          setDrawerSeasonNumber(seasons[currentIdx - 1].seasonNumber)
                        }
                      }}
                      title={isFirst ? 'Início das temporadas (não há anterior)' : 'Temporada anterior'}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>

                    <div className="season-stepper-content">
                      <div className="season-stepper-title">
                        <span>{seasonTitleDisplay}</span>
                      </div>
                      <div className="season-stepper-meta">
                        <span className="season-stepper-badge">
                          {activeSeason.episodes.length} episódios
                        </span>
                        <span className="season-stepper-count">
                          (Temp. {currentIdx + 1} de {seasons.length})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`season-stepper-btn next ${isLast ? 'disabled' : ''}`}
                      disabled={isLast}
                      onClick={() => {
                        if (!isLast && currentIdx < seasons.length - 1) {
                          setDrawerSeasonNumber(seasons[currentIdx + 1].seasonNumber)
                        }
                      }}
                      title={isLast ? 'Última temporada (não há posterior)' : 'Próxima temporada'}
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                )
              })()}

              {/* LAYOUT 1 (NETFLIX STYLE): PÍLULAS COMPACTAS FLEXÍVEIS */}
              {seasonDrawerLayout === 'pills' && (
                <div className="drawer-seasons-pills-wrapper">
                  {currentPlayingShow.seasons.map((season) => (
                    <button
                      key={season.seasonNumber}
                      type="button"
                      className={`season-pill-btn ${
                        drawerSeasonNumber === season.seasonNumber
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => setDrawerSeasonNumber(season.seasonNumber)}
                    >
                      {season.seasonLabel} ({season.episodes.length})
                    </button>
                  ))}
                </div>
              )}

              {/* LISTA DE EPISÓDIOS COM THUMBNAIL 16:9, BADGE E OVERLAY (OU MODO ACCORDION) */}
              <div className="drawer-episodes-list">
                {seasonDrawerLayout === 'accordion' ? (
                  currentPlayingShow.seasons.map((season) => {
                    const isOpen =
                      accordionOpenSeasons[season.seasonNumber] ??
                      (season.seasonNumber === drawerSeasonNumber)
                    return (
                      <div
                        key={season.seasonNumber}
                        className="drawer-accordion-season-group"
                      >
                        <div
                          className={`drawer-accordion-season-header ${
                            isOpen ? 'active' : ''
                          }`}
                          onClick={() => {
                            setAccordionOpenSeasons((prev) => ({
                              ...prev,
                              [season.seasonNumber]: !isOpen
                            }))
                          }}
                        >
                          <div className="accordion-title-left">
                            <FontAwesomeIcon
                              icon={isOpen ? faChevronDown : faChevronRight}
                              style={{
                                fontSize: 11,
                                color: 'var(--alazter-cyan)'
                              }}
                            />
                            <span className="accordion-season-label">
                              {season.seasonLabel}
                            </span>
                            <span className="accordion-count-badge">
                              {season.episodes.length} eps
                            </span>
                          </div>
                          {season.seasonNumber === drawerSeasonNumber && (
                            <span className="accordion-current-badge">
                              Temporada Atual
                            </span>
                          )}
                        </div>
                        {isOpen && (
                          <div className="drawer-accordion-episodes-list">
                            {season.episodes.map(renderDrawerEpCard)}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  (currentSeasonObj?.episodes || []).map(renderDrawerEpCard)
                )}
              </div>
            </div>
          )}

          {/* MODAL FLUTUANTE DE LEGENDAS STREMIO-STYLE */}
          {subtitlesMenuOpen && (
            <div className="player-subs-modal">
              <div className="subs-header">
                <div className="subs-tabs">
                  <button
                    className={`subs-tab-btn ${subtitlesTab === 'local' ? 'active' : ''}`}
                    onClick={() => setSubtitlesTab('local')}
                  >
                    Locais & Embutidas ({subtitlesList.local.length})
                  </button>
                  <button
                    className={`subs-tab-btn ${subtitlesTab === 'remote' ? 'active' : ''}`}
                    onClick={() => setSubtitlesTab('remote')}
                  >
                    Internet ({subtitlesList.remote.length})
                  </button>
                  <button
                    className={`subs-tab-btn ${subtitlesTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setSubtitlesTab('settings')}
                  >
                    <FontAwesomeIcon icon={faSliders} /> Sincronia & Estilo
                  </button>
                </div>
                <button
                  className="btn-close-subs"
                  onClick={() => setSubtitlesMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              <div className="subs-content">
                {/* BOTÃO PARA DESATIVAR LEGENDA */}
                <button
                  className={`sub-option-btn ${activeSubtitleUrl === null ? 'active' : ''}`}
                  onClick={() => {
                    handleSelectSubtitle(null, 'Desativada')
                  }}
                >
                  <span className="sub-name-text">
                    🚫 Desativar legendas
                  </span>
                  {activeSubtitleUrl === null && (
                    <FontAwesomeIcon icon={faCheck} />
                  )}
                </button>

                {subtitlesTab === 'local' && (
                  <>
                    {subtitlesList.local.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: 13
                        }}
                      >
                        Nenhuma legenda local ou embutida encontrada para este vídeo.
                      </div>
                    ) : (
                      subtitlesList.local.map((sub, i) => {
                        const isSelected = activeSubtitleUrl === sub.streamUrl
                        const isEmbedded =
                          (sub as any).isEmbedded ||
                          sub.name.startsWith('[Embutida]')
                        return (
                          <button
                            key={i}
                            className={`sub-option-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              handleSelectSubtitle(sub.streamUrl, sub.name)
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                overflow: 'hidden'
                              }}
                            >
                              <span className="sub-name-text">{sub.name}</span>
                              {isEmbedded && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    background: 'rgba(99, 102, 241, 0.25)',
                                    color: '#818cf8',
                                    fontWeight: 700
                                  }}
                                >
                                  EMBUTIDA
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="sub-lang-badge">
                                {sub.lang.toUpperCase()}
                              </span>
                              {isSelected && <FontAwesomeIcon icon={faCheck} />}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </>
                )}

                {subtitlesTab === 'remote' && (
                  <>
                    {loadingSubs ? (
                      <div
                        style={{
                          padding: 16,
                          textAlign: 'center',
                          color: '#00e5ff',
                          fontSize: 13
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faRotate}
                          spin
                          style={{ marginRight: 8 }}
                        />
                        Buscando legendas no Stremio OpenSubtitles...
                      </div>
                    ) : subtitlesList.remote.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: 13
                        }}
                      >
                        Nenhuma legenda online encontrada para este título.
                      </div>
                    ) : (
                      subtitlesList.remote.map((sub) => {
                        const isSelected = activeSubtitleUrl === sub.streamUrl
                        return (
                          <button
                            key={sub.id}
                            className={`sub-option-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              handleSelectSubtitle(sub.streamUrl, sub.name)
                            }}
                          >
                            <span className="sub-name-text">{sub.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="sub-lang-badge">
                                {sub.lang.toUpperCase()}
                              </span>
                              {isSelected && <FontAwesomeIcon icon={faCheck} />}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </>
                )}

                {subtitlesTab === 'settings' && (
                  <div className="subs-settings-box">
                    {/* SINCRONIA / DELAY */}
                    <div className="settings-group">
                      <div className="settings-label">
                        <span>Sincronia / Delay de Legenda</span>
                        <span className="settings-val-badge">
                          {subtitleDelay > 0
                            ? `+${subtitleDelay.toFixed(1)}s`
                            : `${subtitleDelay.toFixed(1)}s`}
                        </span>
                      </div>
                      <div className="delay-btns-row">
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(-5.0)}
                          title="Adiantar 5 segundos"
                        >
                          - 5s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(-1.0)}
                          title="Adiantar 1 segundo"
                        >
                          - 1s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(-0.5)}
                          title="Adiantar 0.5 segundo"
                        >
                          - 0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(-0.1)}
                          title="Ajuste fino (-0.1s)"
                        >
                          - 0.1s
                        </button>
                        <button
                          type="button"
                          className="reset-btn"
                          onClick={resetSubtitleDelay}
                          title="Redefinir sincronia para zero"
                        >
                          0.0s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(0.1)}
                          title="Ajuste fino (+0.1s)"
                        >
                          + 0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(0.5)}
                          title="Atrasar 0.5 segundo"
                        >
                          + 0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(1.0)}
                          title="Atrasar 1 segundo"
                        >
                          + 1s
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSubtitleDelay(5.0)}
                          title="Atrasar 5 segundos"
                        >
                          + 5s
                        </button>
                      </div>

                      {/* ENTRADA MANUAL DE SEGUNDOS */}
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Ajuste Direto:
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Ex: 2.5 ou -4.0"
                          value={customDelayInput}
                          onChange={(e) => setCustomDelayInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyCustomDelay()
                          }}
                          style={{
                            width: '110px',
                            padding: '4px 8px',
                            background: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '12px'
                          }}
                        />
                        <button
                          type="button"
                          className="sub-pill-btn active"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={handleApplyCustomDelay}
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>

                    {/* TAMANHO DO TEXTO */}
                    <div className="settings-group">
                      <div className="settings-label">
                        <span>Tamanho do Texto</span>
                        <span className="settings-val-badge">{subFontSize}</span>
                      </div>
                      <div className="pills-options-row">
                        {[
                          { label: 'Pequena', val: '18px' },
                          { label: 'Média', val: '24px' },
                          { label: 'Grande', val: '30px' },
                          { label: 'Extra', val: '36px' }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            className={`sub-pill-btn ${subFontSize === opt.val ? 'active' : ''}`}
                            onClick={() => {
                              setSubFontSize(opt.val)
                              saveSubSettings({ fontSize: opt.val })
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* COR DA LEGENDA */}
                    <div className="settings-group">
                      <div className="settings-label">
                        <span>Cor da Legenda</span>
                      </div>
                      <div className="pills-options-row">
                        {[
                          { label: 'Branco', val: '#ffffff', color: '#ffffff' },
                          { label: 'Amarelo Stremio', val: '#ffd700', color: '#ffd700' },
                          { label: 'Ciano Neon', val: '#00e5ff', color: '#00e5ff' }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            className={`sub-pill-btn ${subColor === opt.val ? 'active' : ''}`}
                            onClick={() => {
                              setSubColor(opt.val)
                              saveSubSettings({ color: opt.val })
                            }}
                          >
                            <span
                              className="color-dot"
                              style={{ backgroundColor: opt.color }}
                            />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ESTILO DE FUNDO */}
                    <div className="settings-group">
                      <div className="settings-label">
                        <span>Estilo de Fundo</span>
                      </div>
                      <div className="pills-options-row">
                        {[
                          { label: 'Sombra Stremio', val: 'shadow' },
                          { label: 'Caixa Escura', val: 'box' }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            className={`sub-pill-btn ${subBgStyle === opt.val ? 'active' : ''}`}
                            onClick={() => {
                              setSubBgStyle(opt.val as any)
                              saveSubSettings({ bgStyle: opt.val as any })
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* POSIÇÃO VERTICAL DA LEGENDA */}
                    <div className="settings-group">
                      <div className="settings-label">
                        <span>Posição Vertical da Legenda</span>
                        <span className="settings-val-badge">
                          {subPosition}% (
                          {subPosition >= 94
                            ? 'Rodapé'
                            : subPosition >= 85
                              ? 'Baixa'
                              : subPosition === 78
                                ? 'Padrão'
                                : subPosition >= 65
                                  ? 'Média'
                                  : subPosition >= 50
                                    ? 'Alta'
                                    : subPosition <= 20
                                      ? 'Topo'
                                      : subPosition < 78
                                        ? 'Elevada'
                                        : 'Rebaixada'}
                          )
                        </span>
                      </div>
                      <div className="pills-options-row">
                        {[
                          { label: 'Rodapé (96%)', val: 96 },
                          { label: 'Baixa (88%)', val: 88 },
                          { label: 'Padrão (78%)', val: 78 },
                          { label: 'Média (68%)', val: 68 },
                          { label: 'Alta (55%)', val: 55 },
                          { label: 'Topo (15%)', val: 15 }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            className={`sub-pill-btn ${subPosition === opt.val ? 'active' : ''}`}
                            onClick={() => applySubtitlePosition(opt.val)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="delay-btns-row" style={{ marginTop: 6 }}>
                        <button
                          onClick={() => applySubtitlePosition(subPosition - 5)}
                          title="Subir legenda 5% em direção ao topo"
                        >
                          <FontAwesomeIcon icon={faChevronUp} style={{ marginRight: 4 }} />
                          Subir (-5%)
                        </button>
                        <button
                          onClick={() => applySubtitlePosition(subPosition - 1)}
                          title="Subir legenda 1%"
                        >
                          -1%
                        </button>
                        <button
                          className="reset-btn"
                          onClick={() => applySubtitlePosition(78)}
                          title="Restaurar posição padrão (78%)"
                        >
                          78% Padrão
                        </button>
                        <button
                          onClick={() => applySubtitlePosition(subPosition + 1)}
                          title="Descer legenda 1%"
                        >
                          +1%
                        </button>
                        <button
                          onClick={() => applySubtitlePosition(subPosition + 5)}
                          title="Descer legenda 5% em direção ao rodapé"
                        >
                          <FontAwesomeIcon icon={faChevronDown} style={{ marginRight: 4 }} />
                          Descer (+5%)
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: '#64748b',
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <span>💡 <b>Atalhos:</b> Shift + ↑ sobe a legenda, Shift + ↓ desce a legenda no player</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODAL FLUTUANTE DE ÁUDIO (DUAL AUDIO) */}
          {audioMenuOpen && (
            <div className="player-audio-modal">
              <div className="subs-header">
                <div
                  className="drawer-title"
                  style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}
                >
                  <FontAwesomeIcon
                    icon={faHeadphones}
                    style={{ color: 'var(--alazter-cyan)', marginRight: 8 }}
                  />
                  <span>Faixas de Áudio ({audioTracks.length})</span>
                </div>
                <button
                  className="btn-close-subs"
                  onClick={() => setAudioMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
              <div className="subs-content">
                {audioTracks.map((track) => {
                  const isSelected = track.index === selectedAudioIndex
                  const isTranscoded = track.isSupported === false
                  return (
                    <button
                      key={track.id || track.index}
                      className={`sub-option-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectAudioTrack(track.index)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="sub-name-text">{track.label}</span>
                        {isTranscoded && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: 'rgba(0, 229, 255, 0.2)',
                              color: '#00e5ff',
                              fontWeight: 700
                            }}
                          >
                            AAC REMUX
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="sub-lang-badge">
                          {track.language.toUpperCase()}
                        </span>
                        {isSelected && <FontAwesomeIcon icon={faCheck} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CARD FLUTUANTE DE PRÓXIMO EPISÓDIO (AUTO-PLAY COUNTDOWN) */}
          {autoPlayCountdown !== null && nextEpisode && (
            <div className="player-next-ep-card">
              <div className="next-ep-header">
                <span>Próximo Episódio em {autoPlayCountdown}s</span>
                <FontAwesomeIcon icon={faForwardStep} />
              </div>
              <div className="next-ep-title">
                {nextEpisode.customTitle || nextEpisode.title}
              </div>
              <div className="next-ep-actions">
                <button
                  className="btn-play-next-now"
                  onClick={() => {
                    setAutoPlayCountdown(null)
                    handlePlayMovie(nextEpisode)
                  }}
                >
                  <FontAwesomeIcon icon={faPlay} />
                  <span>Assistir Agora</span>
                </button>
                <button
                  className="btn-cancel-next"
                  onClick={() => setAutoPlayCountdown(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* CONTROLES INFERIORES DO PLAYER */}
          <div
            className={`player-controls-bottom ${controlsVisible ? '' : 'hidden'}`}
          >
            {/* LINHA DO TEMPO */}
            <div className="player-timeline" onClick={handleSeek}>
              <div
                className="player-timeline-progress"
                style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`
                }}
              />
              <div
                className="player-timeline-thumb"
                style={{
                  left: `${duration ? (currentTime / duration) * 100 : 0}%`
                }}
              />
            </div>

            {/* BOTÕES DE CONTROLE */}
            <div className="player-buttons-row">
              <div className="player-btns-left">
                <button
                  className="p-btn p-btn-play"
                  onClick={togglePlay}
                  title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
                >
                  <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>
                <button
                  className="p-btn"
                  onClick={() => seekToTime(currentTime - 10)}
                  title="Voltar 10s (Seta Esquerda)"
                >
                  <FontAwesomeIcon icon={faBackward} />
                </button>
                <button
                  className="p-btn"
                  onClick={() => seekToTime(currentTime + 10)}
                  title="Avançar 10s (Seta Direita)"
                >
                  <FontAwesomeIcon icon={faForward} />
                </button>

                {/* BOTÃO PRÓXIMO EPISÓDIO */}
                {nextEpisode && (
                  <button
                    className="p-btn"
                    onClick={() => handlePlayMovie(nextEpisode)}
                    title={`Próximo Episódio: ${nextEpisode.customTitle || nextEpisode.title}`}
                  >
                    <FontAwesomeIcon icon={faForwardStep} />
                  </button>
                )}

                {/* SLIDER DE VOLUME CYBER NEON */}
                <div className="player-volume-group">
                  <button
                    className="p-btn"
                    onClick={toggleMute}
                    title={isMuted ? 'Desmutar (M)' : 'Mutar (M)'}
                  >
                    <FontAwesomeIcon
                      icon={
                        isMuted || volume === 0
                          ? faVolumeXmark
                          : volume < 0.5
                            ? faVolumeLow
                            : faVolumeHigh
                      }
                    />
                  </button>
                  <div className="volume-slider-box">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                      style={{
                        background: `linear-gradient(to right, #00e5ff 0%, #00e5ff ${Math.round((isMuted ? 0 : volume) * 100)}%, rgba(255, 255, 255, 0.2) ${Math.round((isMuted ? 0 : volume) * 100)}%, rgba(255, 255, 255, 0.2) 100%)`
                      }}
                    />
                  </div>
                  <span className="volume-label-pill">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>

                {/* DISPLAY DE TEMPO */}
                <div className="p-time-display">
                  <span>{formatSeconds(currentTime)}</span> /{' '}
                  <span>{formatSeconds(duration)}</span>
                </div>
              </div>

              <div className="player-btns-right">
                {/* BOTÃO DE LEGENDAS (STREMIO & LOCAL) */}
                <button
                  className={`p-btn ${subtitlesMenuOpen ? 'active' : ''}`}
                  title="Legendas (Stremio & Locais)"
                  onClick={() => {
                    setSubtitlesMenuOpen(!subtitlesMenuOpen)
                    setAudioMenuOpen(false)
                  }}
                >
                  <FontAwesomeIcon icon={faClosedCaptioning} />
                  {activeSubtitleUrl && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--alazter-cyan)',
                        marginLeft: 4,
                        fontWeight: 700
                      }}
                    >
                      CC
                    </span>
                  )}
                </button>

                {/* BOTÃO DE ÁUDIO / DUAL AUDIO */}
                <button
                  className={`p-btn ${audioMenuOpen ? 'active' : ''}`}
                  title="Áudio / Dual Áudio"
                  onClick={() => {
                    setAudioMenuOpen(!audioMenuOpen)
                    setSubtitlesMenuOpen(false)
                  }}
                >
                  <FontAwesomeIcon icon={faHeadphones} />
                  {audioTracks.length > 1 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--alazter-indigo)',
                        marginLeft: 4,
                        fontWeight: 700
                      }}
                    >
                      DUAL
                    </span>
                  )}
                </button>

                {/* BOTÃO DA GAVETA DE EPISÓDIOS (STREMIO STYLE) */}
                {currentPlayingShow && (
                  <button
                    className={`p-btn ${episodesDrawerOpen ? 'active' : ''}`}
                    title="Episódios & Temporadas (Stremio Drawer)"
                    onClick={handleToggleDrawerByButton}
                  >
                    <FontAwesomeIcon icon={faListUl} />
                  </button>
                )}

                {/* TELA CHEIA */}
                <button
                  className="p-btn"
                  onClick={toggleFullscreen}
                  title="Tela cheia (F)"
                >
                  <FontAwesomeIcon
                    icon={isFullscreen ? faCompress : faExpand}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTÃO FLUTUANTE VOLTAR AO TOPO CYBER NEON */}
      {showBackToTop && (
        <button
          className="alazter-back-to-top"
          onClick={handleScrollToTop}
          title="Voltar ao início da página"
        >
          <FontAwesomeIcon icon={faArrowUp} />
          <span>Topo</span>
        </button>
      )}
    </div>
  )
}
