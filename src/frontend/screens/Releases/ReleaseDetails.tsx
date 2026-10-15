import { useState } from 'react'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faBoxOpen,
  faCalendarDays,
  faCheck,
  faCompress,
  faExpand,
  faFilm,
  faGamepad,
  faGlobe,
  faPlay,
  faSearch,
  faTv,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import type { ReleaseProduct, ReleaseRegion } from 'common/types/releases'
import { RELEASE_CATEGORIES } from 'common/types/releases'
import { releaseVideoEmbed, releaseVideoThumbnail } from 'common/releaseMedia'
import type { TrackedRelease } from 'frontend/helpers/releaseTracking'
import { localReleaseDay } from 'frontend/helpers/releaseTracking'
import './details.css'
import { ReleaseDrmDetails } from './ReleaseDrm'

interface Props {
  product: ReleaseProduct
  region: ReleaseRegion
  busy: boolean
  error: string
  follow?: TrackedRelease
  video: string | null
  expanded: boolean
  isTracked: (
    id: string,
    platform: string | null,
    region: ReleaseRegion
  ) => boolean
  onMonitor: (product: ReleaseProduct, platform?: string | null) => void
  onSearchExternal?: (title: string) => void
  onClose: () => void
  onExpand: () => void
  onRegion: (region: ReleaseRegion) => void
  onVideo: (url: string | null) => void
  onTag: (tag: string) => void
  onResume: () => void
  onRestore: (at: string) => void
}
type Media = { kind: 'video' | 'image'; url: string }
const longDate = (date?: string, fallback = 'A confirmar') =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : fallback
const relativeDate = (date: string) => {
  const days = Math.round(
    (Date.parse(date) - Date.parse(localReleaseDay())) / 86400000
  )
  return days === 0
    ? 'Hoje'
    : days === 1
      ? 'Amanhã'
      : days === -1
        ? 'Ontem'
        : days > 0
          ? `Em ${days} dias`
          : `Há ${-days} dias`
}

export default function ReleaseDetails(props: Props) {
  const { product, region } = props
  const [chosenMedia, setChosenMedia] = useState<Media | null>(null)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const thumbnail = (url: string) => {
    const fallback = releaseVideoThumbnail(url)
    if (!fallback) return undefined
    const prefix = fallback.slice(0, fallback.lastIndexOf('/') + 1)
    return product.images.find((image) => image.startsWith(prefix)) || fallback
  }
  const media: Media[] = [
    ...product.videos
      .filter((url) => releaseVideoEmbed(url))
      .map((url) => ({ kind: 'video' as const, url })),
    ...product.images
      .filter(
        (url) => !/^https:\/\/(?:i\.ytimg\.com|img\.youtube\.com)\//.test(url)
      )
      .map((url) => ({ kind: 'image' as const, url }))
  ]
  const active = props.video
    ? { kind: 'video' as const, url: props.video }
    : chosenMedia || media[0]
  const rows = product.releases.filter((row) => row.region === region)
  const today = localReleaseDay()
  const upcoming = rows.filter(
    (row) => !row.estimated && row.date && row.date >= today
  )
  const released = rows.filter(
    (row) => !row.estimated && row.date && row.date < today
  )
  const estimated = rows.filter((row) => row.estimated || !row.date)
  const next =
    [...upcoming].sort((a, b) => a.date!.localeCompare(b.date!))[0] ||
    [...released].sort((a, b) => b.date!.localeCompare(a.date!))[0] ||
    estimated[0]
  const matching = next
    ? rows.filter(
        (row) => row.date === next.date && row.dateLabel === next.dateLabel
      )
    : []
  const followed = props.isTracked(product.id, null, region)
  const category =
    RELEASE_CATEGORIES.find((category) => category.id === product.category)
      ?.label || product.category
  const categoryIcon =
    product.category === 'games'
      ? faGamepad
      : product.category === 'movies'
        ? faFilm
        : product.category === 'tv-series'
          ? faTv
          : faBoxOpen

  return (
    <>
      <div className="nr-detail-controls">
        <button aria-label="Fechar detalhes" onClick={props.onClose}>
          <Icon icon={faXmark} />
        </button>
        <button
          aria-label={props.expanded ? 'Reduzir painel' : 'Expandir painel'}
          aria-pressed={props.expanded}
          onClick={props.onExpand}
        >
          <Icon icon={props.expanded ? faCompress : faExpand} />
        </button>
      </div>
      <div className="nr-detail-scroll">
        <div className="nr-detail-layout">
          <section
            className="nr-detail-main"
            aria-label="Informações do lançamento"
          >
            <header className="nr-product-header">
              {product.image && <img src={product.image} alt="" />}
              <div>
                <h2 id="nr-detail-title">{product.title}</h2>
                <div className="nr-product-meta">
                  <span>
                    <Icon icon={categoryIcon} /> {category}
                  </span>
                  {rows.length > 0 && (
                    <span className="nr-product-status">
                      <Icon icon={faCalendarDays} />{' '}
                      {upcoming.length
                        ? `Próximos (${upcoming.length})`
                        : released.length
                          ? `Lançado (${released.length})`
                          : 'A confirmar'}
                    </span>
                  )}
                </div>
                <div className="nr-product-actions">
                  <button
                    className="nr-product-follow"
                    aria-pressed={followed}
                    aria-label={`${followed ? 'Deixar de monitorar' : 'Monitorar'} todas as plataformas de ${product.title}`}
                    title={
                      followed
                        ? 'Deixar de monitorar todas as plataformas'
                        : 'Monitorar todas as plataformas'
                    }
                    onClick={() => props.onMonitor(product)}
                  >
                    <Icon icon={followed ? faCheck : faBell} />{' '}
                    {product.popularity || (followed ? 'Salvo' : 'Seguir')}
                  </button>
                  {product.category === 'games' && props.onSearchExternal && (
                    <button
                      type="button"
                      className="nr-product-search"
                      aria-label={`Buscar ${product.title} na página Buscar jogos`}
                      title={`Buscar "${product.title}" na página Buscar jogos`}
                      onClick={() => props.onSearchExternal!(product.title)}
                    >
                      <Icon icon={faSearch} /> Buscar na loja
                    </button>
                  )}
                </div>
              </div>
            </header>
            {props.busy && (
              <p className="nr-detail-status" role="status">
                Carregando detalhes…
              </p>
            )}
            {props.error && (
              <p className="nr-detail-alert" role="alert">
                {props.error} Os dados disponíveis foram preservados.
              </p>
            )}
            {(product.warning || props.follow?.updateWarning) && (
              <p className="nr-detail-alert" role="status">
                {product.warning || props.follow?.updateWarning}
              </p>
            )}
            {product.description && (
              <div className="nr-product-description">
                <p className={descriptionOpen ? '' : 'is-collapsed'}>
                  {product.description}
                </p>
                {product.description.length > 450 && (
                  <button
                    aria-expanded={descriptionOpen}
                    onClick={() => setDescriptionOpen(!descriptionOpen)}
                  >
                    {descriptionOpen ? 'Mostrar menos' : 'Ler mais'}
                  </button>
                )}
              </div>
            )}
            {active && (
              <div className="nr-product-media">
                <div className="nr-media-stage">
                  {active.kind === 'video' ? (
                    props.video && releaseVideoEmbed(props.video) ? (
                      <iframe
                        title={`Trailer de ${product.title}`}
                        src={`${releaseVideoEmbed(props.video)}?autoplay=1`}
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    ) : (
                      <button
                        className="nr-media-play"
                        aria-label={`Reproduzir trailer de ${product.title}`}
                        onClick={() => props.onVideo(active.url)}
                      >
                        {thumbnail(active.url) && (
                          <img
                            src={thumbnail(active.url)}
                            alt={`Trailer de ${product.title}`}
                          />
                        )}
                        <span>
                          <Icon icon={faPlay} />
                        </span>
                      </button>
                    )
                  ) : (
                    <img src={active.url} alt={`Imagem de ${product.title}`} />
                  )}
                </div>
                <div
                  className="nr-media-thumbnails"
                  aria-label="Trailers e imagens"
                >
                  {media.map((item, index) => {
                    const selected =
                      item.kind === active.kind &&
                      (item.url === active.url ||
                        (item.kind === 'video' &&
                          releaseVideoEmbed(item.url) ===
                            releaseVideoEmbed(active.url)))
                    return (
                      <button
                        key={`${item.kind}:${item.url}`}
                        aria-label={
                          item.kind === 'video'
                            ? `Selecionar trailer ${index + 1}`
                            : `Selecionar imagem ${index - product.videos.length + 1}`
                        }
                        aria-pressed={selected}
                        onClick={() => {
                          props.onVideo(null)
                          setChosenMedia(item)
                        }}
                      >
                        {(item.kind === 'image' || thumbnail(item.url)) && (
                          <img
                            src={
                              item.kind === 'image'
                                ? item.url
                                : thumbnail(item.url)
                            }
                            alt=""
                            loading="lazy"
                          />
                        )}
                        {item.kind === 'video' && (
                          <span>
                            <Icon icon={faPlay} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {props.video && (
                  <div className="nr-media-links">
                    <button
                      onClick={() => window.api.openExternalUrl(props.video!)}
                    >
                      Abrir no site do vídeo
                    </button>
                    <button onClick={() => props.onVideo(null)}>
                      Fechar vídeo
                    </button>
                  </div>
                )}
              </div>
            )}
            {product.tags.length > 0 && (
              <div className="nr-product-tags">
                {product.tags.map((tag) => (
                  <button key={tag} onClick={() => props.onTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </section>
          <aside className="nr-detail-dates" aria-label="Datas por plataforma">
            <div className="nr-dates-heading">
              <h3>Datas de lançamento</h3>
              <label>
                <Icon icon={faGlobe} />
                <select
                  aria-label="Região das datas"
                  value={region}
                  onChange={(event) =>
                    props.onRegion(event.target.value as ReleaseRegion)
                  }
                >
                  <option value="us">EUA</option>
                  <option value="uk">Reino Unido</option>
                </select>
              </label>
            </div>
            {next && (
              <div className="nr-release-summary">
                <strong>
                  <Icon icon={faCalendarDays} />{' '}
                  {longDate(
                    next.estimated ? undefined : next.date,
                    next.dateLabel
                  )}
                </strong>
                <div>
                  {!next.estimated && next.date
                    ? relativeDate(next.date)
                    : 'Data estimada'}
                </div>
                <p>{matching.map((row) => row.platform).join(' / ')}</p>
              </div>
            )}
            {[
              ['Próximos', upcoming],
              ['Lançados', released],
              ['A confirmar', estimated]
            ].map(([label, group]) => {
              const releases = group as typeof rows
              return (
                releases.length > 0 && (
                  <section className="nr-version-group" key={label as string}>
                    <h4>
                      <Icon icon={faCalendarDays} /> {label as string}
                    </h4>
                    <div>
                      {releases.map((row, index) => {
                        const followed = props.isTracked(
                          product.id,
                          row.platform,
                          region
                        )
                        return (
                          <div
                            className="nr-version"
                            key={`${row.platform}:${row.dateLabel}:${index}`}
                          >
                            <div>
                              <strong>{row.platform}</strong>
                              <time
                                dateTime={row.estimated ? undefined : row.date}
                              >
                                {longDate(
                                  row.estimated ? undefined : row.date,
                                  row.dateLabel
                                )}
                              </time>
                            </div>
                            <button
                              aria-label={`${followed ? 'Deixar de monitorar' : 'Monitorar'} ${row.platform}`}
                              aria-pressed={followed}
                              title={
                                followed
                                  ? 'Monitorando'
                                  : 'Monitorar plataforma'
                              }
                              onClick={() =>
                                props.onMonitor(product, row.platform)
                              }
                            >
                              <Icon icon={followed ? faCheck : faBell} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              )
            })}
            {!rows.length && !props.busy && (
              <p className="nr-detail-status">
                A fonte ainda não informou datas por plataforma nesta região.
              </p>
            )}
            {product.category === 'games' && (
              <ReleaseDrmDetails product={product} />
            )}
            <div className="nr-detail-footnote">
              <strong>{product.title} · lançamento</strong>
              <p>
                {next
                  ? `${matching.map((row) => row.platform).join(' / ')} · ${longDate(next.estimated ? undefined : next.date, next.dateLabel)}.`
                  : 'Data a confirmar.'}{' '}
                Região: {region === 'us' ? 'Estados Unidos' : 'Reino Unido'}.
              </p>
              {product.verifiedAt && (
                <small>
                  Última confirmação:{' '}
                  {new Date(product.verifiedAt).toLocaleString('pt-BR')}
                </small>
              )}
              {props.follow?.metadataPaused && (
                <button onClick={props.onResume}>
                  Retomar atualizações e avisos
                </button>
              )}
              {!!props.follow?.history?.length && (
                <details className="nr-product-history">
                  <summary>
                    Histórico salvo ({props.follow.history.length})
                  </summary>
                  <p>
                    Recuperar uma versão pausa as atualizações e os avisos até
                    você retomá-los.
                  </p>
                  {props.follow.history.map((revision, index) => (
                    <div key={`${revision.at}:${index}`}>
                      <span>
                        {new Date(revision.at).toLocaleString('pt-BR')} ·{' '}
                        {revision.product.releases
                          .map((row) => `${row.platform}: ${row.dateLabel}`)
                          .join(' / ')}
                      </span>
                      <button onClick={() => props.onRestore(revision.at)}>
                        Recuperar esta versão
                      </button>
                    </div>
                  ))}
                </details>
              )}
              <button
                className="nr-detail-source"
                onClick={() => window.api.openExternalUrl(product.url)}
              >
                Ver informação no Releases.com
              </button>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
