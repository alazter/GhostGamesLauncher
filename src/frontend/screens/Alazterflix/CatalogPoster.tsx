import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faFilm,
  faInfoCircle,
  faPlay,
  faPlus,
  faStar
} from '@fortawesome/free-solid-svg-icons'
import { mediaPoster } from 'common/mediaCatalog'
import type { GhostMovie, GhostShow, GhostMediaCategory } from 'common/types/plugins'
import { getMediaImageUrl } from './imageUrl'
import {
  CardPreferences,
  defaultCardPreferences,
  mediaTmdbRating,
  parseUserRating
} from './cardPreferences'

import './cardStyles.scss'

const categoryLabels: Record<string, string> = {
  anime: 'Animes',
  series: 'Séries',
  movie: 'Filmes',
  documentary: 'Documentários',
  cartoon: 'Desenhos',
  ova: 'OVAs',
  tv: 'TV ao Vivo'
}

const categoryBadgeLabels: Record<string, string> = {
  anime: 'Anime',
  series: 'Série',
  movie: 'Filme',
  documentary: 'Documentário',
  cartoon: 'Desenho',
  ova: 'OVA',
  tv: 'TV ao Vivo'
}

type Props = {
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  preferences?: CardPreferences
  isWatched?: boolean
  onToggleWatched?: () => Promise<void> | void
  onRate?: (rating: number | null) => Promise<void> | void
  onPlay?: (movie: GhostMovie) => void
  onPlayShow?: (show: GhostShow) => void
} & (
  | { show: GhostShow; onSelect: (show: GhostShow) => void }
  | { movie: GhostMovie; onSelect: (movie: GhostMovie) => void }
)

export default memo(function CatalogPoster(props: Props) {
  const preferences = props.preferences || defaultCardPreferences
  const modern = preferences.style !== 'classic'
  const clean = preferences.style === 'clean'
  const movie = 'show' in props ? props.show.sampleMovie : props.movie
  const title =
    'show' in props ? props.show.showTitle : movie.customTitle || movie.title
  const cover = getMediaImageUrl(
    'show' in props
      ? props.show.coverUrl || mediaPoster(movie)
      : mediaPoster(movie)
  )
  const [hasError, setHasError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pending, setPending] = useState(false)
  const savingRating = useRef(false)
  const [feedback, setFeedback] = useState('')
  const [draftRating, setDraftRating] = useState(String(movie.userRating ?? ''))
  const [invalidRating, setInvalidRating] = useState(false)
  const panelId = useId()
  const ratingId = useId()
  const errorId = useId()
  useEffect(() => setHasError(false), [cover])
  useEffect(() => {
    setDraftRating(String(movie.userRating ?? ''))
    setInvalidRating(false)
  }, [movie.id, movie.userRating])
  useEffect(() => {
    setExpanded(false)
    setFocused(false)
    setHovered(false)
  }, [preferences.style])
  const open = expanded || focused || hovered
  const tmdbRating = mediaTmdbRating(movie)
  const select = () => {
    if ('show' in props) props.onSelect(props.show)
    else props.onSelect(props.movie)
  }
  const commitRating = async () => {
    if (savingRating.current) return
    const value = parseUserRating(draftRating)
    if (value === undefined) {
      setInvalidRating(true)
      setFeedback('Digite uma nota de 0 a 10.')
      return
    }
    setInvalidRating(false)
    setDraftRating(String(value ?? ''))
    if (value === (movie.userRating ?? null)) return
    savingRating.current = true
    try {
      await props.onRate?.(value)
      setFeedback(
        value === null ? 'Sua nota foi removida.' : `Sua nota: ${value}/10.`
      )
    } catch (error) {
      setDraftRating(String(movie.userRating ?? ''))
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar sua nota.'
      )
    } finally {
      savingRating.current = false
    }
  }
  const itemCategories: GhostMediaCategory[] =
    ('show' in props
      ? props.show.categories && props.show.categories.length > 0
        ? props.show.categories
        : props.show.mediaCategory
        ? [props.show.mediaCategory]
        : ['movie']
      : props.movie.categories && props.movie.categories.length > 0
      ? props.movie.categories
      : props.movie.mediaCategory
      ? [props.movie.mediaCategory]
      : [props.movie.isSeries ? 'series' : 'movie']) as GhostMediaCategory[]

  const category =
    'show' in props ? props.show.mediaCategory : movie.mediaCategory || 'movie'
  const length =
    'show' in props && props.show.isSeries
      ? `${props.show.seasonsCount} ${props.show.seasonsCount === 1 ? 'temporada' : 'temporadas'}`
      : movie.durationFormatted

  const duration =
    movie.durationFormatted ||
    (movie.duration
      ? `${Math.round(movie.duration / 60)} min`
      : 'Não informada')
  const image =
    cover && !hasError ? (
      <img
        src={cover}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
      />
    ) : (
      <span className="poster-fallback">
        <FontAwesomeIcon icon={faFilm} />
      </span>
    )

  const primaryCategory = itemCategories[0] || 'movie'
  const primaryCategoryLabel = useMemo(() => {
    switch (primaryCategory) {
      case 'anime':
        return '⛩️ ANIMES'
      case 'series':
        return '📺 SÉRIES'
      case 'cartoon':
        return '🎨 DESENHOS'
      case 'documentary':
        return '🌍 DOCS'
      case 'ova':
        return '📀 OVAS'
      case 'movie':
      default:
        return '🎬 FILMES'
    }
  }, [primaryCategory])

  const tagline = useMemo(() => {
    const rawTagline = movie.tagline || ('show' in props ? props.show.tagline : undefined)
    if (rawTagline) {
      const clean = rawTagline.replace(/^"+|"+$/g, '').trim()
      return clean ? `"${clean}"` : ''
    }
    const syn = movie.synopsis || ('show' in props ? props.show.synopsis : '')
    if (!syn) return ''
    const match = syn.match(/^([^.!?]+[.!?])/)?.[1]
    const extracted = match ? match.trim() : syn.slice(0, 48).trim() + '...'
    return extracted ? `"${extracted.replace(/^"+|"+$/g, '')}"` : ''
  }, [movie.tagline, movie.synopsis, props])

  const resBadge = useMemo(() => {
    const res =
      movie.resolution ||
      ('show' in props ? props.show.resolution : undefined) ||
      '1080p'
    return res.includes('4K') ? '4K HDR' : `${res} REMUX`
  }, [movie.resolution, props])

  if (modern)
    return (
      <article
        className={`catalog-modern-card catalog-modern-card--${preferences.style} ${open ? 'is-open' : ''}`}
        aria-label={title}
        onMouseEnter={() => {
          if (window.matchMedia('(hover: hover)').matches) setHovered(true)
        }}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={(event) => {
          if (
            window.matchMedia('(hover: hover)').matches ||
            !(event.target instanceof HTMLElement) ||
            !event.target.classList.contains('catalog-modern-open')
          )
            setFocused(true)
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocused(false)
            // A disabled action loses focus while its asynchronous save runs.
            if (!pending) setExpanded(false)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setExpanded(false)
            setHovered(false)
            setFocused(false)
          }
        }}
      >
        <div className="catalog-modern-surface">
          <div className="catalog-modern-poster">
            <button
              type="button"
              className="catalog-modern-open"
              aria-label={`Mostrar informações de ${title}`}
              aria-controls={panelId}
              aria-expanded={open}
              onClick={() => {
                if (window.matchMedia('(hover: hover)').matches) select()
                else setExpanded(!expanded)
              }}
            >
              {image}
              {!clean && !open && (
                <div className="catalog-cover-badges">
                {itemCategories.map((c) => (
                  <span
                    key={c}
                    className={`catalog-cover-badge catalog-cover-badge--${c}`}
                  >
                    {categoryBadgeLabels[c] || c}
                  </span>
                ))}
              </div>
              )}
            </button>
          </div>
          {!clean && (
            <div className="catalog-modern-caption" aria-hidden={open}>
              <div className="catalog-category-badges">
                {itemCategories.map((c) => (
                  <span
                    key={c}
                    className={`catalog-modern-category catalog-category-badge--${c}`}
                  >
                    {categoryBadgeLabels[c] || c}
                  </span>
                ))}
              </div>
              <h4>{title}</h4>
              <span className="catalog-modern-rating">
                <FontAwesomeIcon icon={faStar} /> {tmdbRating ?? '—'}{' '}
                <span>/10 · TMDB</span>
              </span>
            </div>
          )}
          {open && (
            <div className="catalog-hover-panel fade-cinematic-b" id={panelId}>
              {/* Topo: Categoria + Ações */}
              <div className="catalog-hover-top">
                <span className="catalog-hover-category-tag">
                  {primaryCategoryLabel}
                </span>
                <div className="catalog-hover-actions-top">
                  <button
                    type="button"
                    className={`btn-circle-blur ${props.isFavorite ? 'active' : ''}`}
                    aria-label={`${props.isFavorite ? 'Remover' : 'Adicionar'} ${title} dos favoritos`}
                    aria-pressed={props.isFavorite}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onToggleFavorite(movie.id)
                    }}
                    title={props.isFavorite ? 'Remover dos Favoritos' : 'Favoritar'}
                  >
                    <FontAwesomeIcon icon={faStar} />
                  </button>
                  <button
                    type="button"
                    className={`btn-circle-blur ${props.isWatched ? 'active-check' : ''}`}
                    aria-label={`${props.isWatched ? 'Desmarcar' : 'Marcar'} ${title} como assistido`}
                    aria-pressed={props.isWatched === true}
                    disabled={pending}
                    onClick={async (e) => {
                      e.stopPropagation()
                      setPending(true)
                      try {
                        await props.onToggleWatched?.()
                      } finally {
                        setPending(false)
                      }
                    }}
                    title={props.isWatched ? 'Desmarcar como Assistido' : 'Marcar como Assistido'}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </button>
                </div>
              </div>

              {/* Centro Livre: Deixa a Arte 100% Visível e Nítida sem nada no meio */}
              <div className="catalog-hover-spacer" />

              {/* Rodapé: Título, Tagline, Linha de Metadados e Botões Play + Detalhes */}
              <div className="catalog-hover-bottom">
                <h4 className="catalog-hover-title" title={title}>
                  {title}
                </h4>

                {tagline && (
                  <p className="catalog-hover-tagline" title={tagline}>
                    {tagline}
                  </p>
                )}

                <div className="catalog-hover-metas-row">
                  {tmdbRating !== undefined && (
                    <span className="meta-star-rating">
                      <FontAwesomeIcon icon={faStar} /> {tmdbRating}
                    </span>
                  )}
                  {movie.year && (
                    <>
                      <span className="meta-dot">·</span>
                      <span className="meta-year">{movie.year}</span>
                    </>
                  )}
                  {('show' in props && props.show.isSeries ? length : duration) && (
                    <>
                      <span className="meta-dot">·</span>
                      <span className="meta-duration">
                        {'show' in props && props.show.isSeries ? length : duration}
                      </span>
                    </>
                  )}
                  <span className="meta-res-badge">{resBadge}</span>
                </div>

                <div className="catalog-hover-buttons-grid">
                  <button
                    type="button"
                    className="catalog-card-play"
                    onClick={(e) => {
                      e.stopPropagation()
                      if ('show' in props && props.onPlayShow) {
                        props.onPlayShow(props.show)
                      } else {
                        props.onPlay?.(movie)
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faPlay} /> Play
                  </button>
                  <button
                    type="button"
                    className="catalog-card-details"
                    onClick={(e) => {
                      e.stopPropagation()
                      select()
                    }}
                  >
                    <FontAwesomeIcon icon={faInfoCircle} /> Detalhes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {clean && preferences.showTitle && (
          <h4
            className="catalog-clean-title"
            style={{ textAlign: preferences.titleAlignment }}
          >
            {title}
          </h4>
        )}
      </article>
    )

  return (
    <article className="movie-poster-card catalog-poster">
      <div className="poster-image-box">
        <button
          type="button"
          className="catalog-poster-open"
          aria-label={`Ver detalhes de ${title}`}
          onClick={() => {
            if ('show' in props) props.onSelect(props.show)
            else props.onSelect(props.movie)
          }}
        >
          {image}
          <span className="catalog-poster-art-title">{title}</span>
        </button>
        <div className="catalog-cover-badges">
          {itemCategories.map((c) => (
            <span
              key={c}
              className={`catalog-cover-badge catalog-cover-badge--${c}`}
            >
              {categoryBadgeLabels[c] || c}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="catalog-poster-save"
          aria-label={`${props.isFavorite ? 'Remover' : 'Adicionar'} ${title} ${props.isFavorite ? 'da minha lista' : 'à minha lista'}`}
          aria-pressed={props.isFavorite}
          onClick={() => props.onToggleFavorite(movie.id)}
        >
          <FontAwesomeIcon icon={props.isFavorite ? faCheck : faPlus} />
        </button>
      </div>
      <div className="movie-card-info">
        <h4>{title}</h4>
        <div className="movie-card-meta">
          {tmdbRating !== undefined && (
            <span className="catalog-poster-rating">
              <FontAwesomeIcon icon={faStar} /> {tmdbRating} · TMDB
            </span>
          )}
          {movie.year && <span>{movie.year}</span>}
          {length && <span>{length}</span>}
        </div>
      </div>
    </article>
  )
})
