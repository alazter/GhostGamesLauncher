import { memo, useEffect, useId, useRef, useState } from 'react'
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
import type { GhostMovie, GhostShow } from 'common/types/plugins'
import { getMediaImageUrl } from './imageUrl'
import {
  CardPreferences,
  defaultCardPreferences,
  mediaTmdbRating,
  parseUserRating
} from './cardPreferences'

import './cardStyles.scss'

const categoryLabels = {
  anime: 'Animes',
  series: 'Séries',
  movie: 'Filmes',
  documentary: 'Documentários',
  cartoon: 'Desenhos'
}

type Props = {
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  preferences?: CardPreferences
  isWatched?: boolean
  onToggleWatched?: () => Promise<void> | void
  onRate?: (rating: number | null) => Promise<void> | void
  onPlay?: (movie: GhostMovie) => void
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
            </button>
          </div>
          {!clean && (
            <div className="catalog-modern-caption" aria-hidden={open}>
              <span className="catalog-modern-category">
                {categoryLabels[category]}
              </span>
              <h4>{title}</h4>
              <span className="catalog-modern-rating">
                <FontAwesomeIcon icon={faStar} /> {tmdbRating ?? '—'}{' '}
                <span>/10 · TMDB</span>
              </span>
            </div>
          )}
          {open && (
            <div className="catalog-hover-panel" id={panelId}>
              <div className="catalog-overlay-top">
                <span className="catalog-modern-category">
                  {categoryLabels[category]}
                </span>
                <div className="catalog-media-actions">
                  <button
                    type="button"
                    className="catalog-icon-action"
                    aria-label={`${props.isFavorite ? 'Remover' : 'Adicionar'} ${title} ${props.isFavorite ? 'dos favoritos' : 'aos favoritos'}`}
                    aria-pressed={props.isFavorite}
                    onClick={() => props.onToggleFavorite(movie.id)}
                  >
                    <FontAwesomeIcon icon={faStar} />
                  </button>
                  <button
                    type="button"
                    className="catalog-icon-action catalog-watched-action"
                    aria-label={`${props.isWatched ? 'Desmarcar' : 'Marcar'} ${title} como assistido`}
                    aria-pressed={props.isWatched === true}
                    disabled={pending}
                    onClick={async () => {
                      setPending(true)
                      try {
                        await props.onToggleWatched?.()
                        setFeedback(
                          props.isWatched
                            ? 'Desmarcado como assistido.'
                            : 'Marcado como assistido.'
                        )
                      } catch (error) {
                        setFeedback(
                          error instanceof Error
                            ? error.message
                            : 'Não foi possível salvar o status assistido.'
                        )
                      } finally {
                        setPending(false)
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </button>
                </div>
              </div>
              {clean && !preferences.showTitle && <h4>{title}</h4>}
              <div className="catalog-card-ratings">
                <div>
                  <span className="catalog-meta-label">Nota TMDB</span>
                  <span className="catalog-modern-rating">
                    <FontAwesomeIcon icon={faStar} /> {tmdbRating ?? '—'}{' '}
                    <span>/10</span>
                  </span>
                </div>
                <label htmlFor={ratingId}>
                  <span className="catalog-meta-label">Sua nota</span>
                  <span className="catalog-user-rating">
                    <input
                      id={ratingId}
                      aria-label={`Sua nota de 0 a 10 para ${title}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      maxLength={12}
                      placeholder="Sem nota"
                      value={draftRating}
                      disabled={pending}
                      aria-invalid={invalidRating}
                      aria-describedby={invalidRating ? errorId : undefined}
                      onChange={(event) => setDraftRating(event.target.value)}
                      onBlur={() => {
                        void commitRating()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void commitRating()
                        }
                      }}
                    />
                    <span>/10</span>
                  </span>
                </label>
              </div>
              {invalidRating && (
                <span className="catalog-card-error" id={errorId} role="alert">
                  Digite uma nota de 0 a 10.
                </span>
              )}
              <dl className="catalog-card-facts">
                <div>
                  <dt>Lançamento</dt>
                  <dd>{movie.year ?? 'Não informado'}</dd>
                </div>
                <div>
                  <dt>
                    {'show' in props && props.show.isSeries
                      ? 'Duração / episódio'
                      : 'Duração'}
                  </dt>
                  <dd>{duration}</dd>
                </div>
                {'show' in props && props.show.isSeries && (
                  <div>
                    <dt>Temporadas</dt>
                    <dd>{length}</dd>
                  </div>
                )}
                {!('show' in props) && movie.isSeries && (
                  <div>
                    <dt>Episódio</dt>
                    <dd>
                      {movie.season !== undefined ? `T${movie.season}` : ''}
                      {movie.episode !== undefined
                        ? ` · E${movie.episode}`
                        : ''}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="catalog-card-actions">
                <button
                  type="button"
                  className="catalog-card-play"
                  onClick={() => props.onPlay?.(movie)}
                >
                  <FontAwesomeIcon icon={faPlay} /> Play
                </button>
                <button
                  type="button"
                  className="catalog-card-details"
                  onClick={select}
                >
                  <FontAwesomeIcon icon={faInfoCircle} /> Detalhes
                </button>
              </div>
              {feedback && (
                <span className="catalog-card-feedback" role="status">
                  {feedback}
                </span>
              )}
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
        <span className="catalog-poster-category">
          {categoryLabels[category]}
        </span>
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
