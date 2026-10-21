import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarAlt,
  faExternalLinkAlt,
  faGamepad,
  faListCheck,
  faPlay,
  faStar,
  faThumbsUp,
  faUser
} from '@fortawesome/free-solid-svg-icons'
import { formatSourceReleaseDate } from 'common/externalReleaseInfo'
import type { GhostSearchResult } from 'common/types/plugins'
import CachedImage from 'frontend/components/UI/CachedImage'
import { useExternalGameCover } from 'frontend/hooks/useExternalGameCover'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import {
  detailsGenres,
  detailsVersion,
  translatedCompatibility
} from './gameDetailsMetadata'
import StoreSourceCards from './StoreSourceCards'
import './gameDetails.css'

type Props = {
  game: GhostSearchResult
  title: string
  sources: GhostSearchResult[]
  sourcesLoading?: boolean
  sourcesFailed?: boolean
  description: string
  onGameplay: () => void
  onSelectSource: (source: GhostSearchResult) => void
  children: ReactNode
}

export default function GameDetailsPanel({
  game,
  title,
  sources,
  sourcesLoading,
  sourcesFailed,
  description,
  onGameplay,
  onSelectSource,
  children
}: Props) {
  const { cover, rejectCover } = useExternalGameCover(game, sources)
  const titleParts = title.match(/^(.+?)\s[-–—]\s*(.+)$/)
  const image = cover || fallbackImage
  const rating = Number.parseFloat(game.rating?.replace(',', '.') || '')
  const genres = detailsGenres(game.genre, game.mode)
  const updateDate = formatSourceReleaseDate(game.sourceDate || game.uploadDate)
  const publicationDate =
    game.publicationDate && formatSourceReleaseDate(game.publicationDate)
  const sourceUrl = game.pageUrl || game.id
  const canOpenSource = /^https?:\/\//i.test(sourceUrl)
  const openSource = (reviews = false) => {
    if (canOpenSource)
      window.api.openExternalUrl(
        reviews ? `${sourceUrl.split('#')[0]}#reviews` : sourceUrl
      )
  }
  const tags = [
    ['Grupo da release', game.cracker],
    [
      'Lançamento',
      game.releaseDate
        ? /^\d{4}$/.test(game.releaseDate)
          ? game.releaseDate
          : formatSourceReleaseDate(game.releaseDate)
        : undefined
    ],
    ['Desenvolvedora', game.developer],
    ['Distribuidora', game.publisher]
  ]

  return (
    <>
      <div className="gdpPageHeading">
        <FontAwesomeIcon icon={faGamepad} /> Detalhes do jogo
      </div>
      <article className="gameDetailsPanel" aria-label={`Detalhes de ${title}`}>
        {cover && (
          <CachedImage
            key={`backdrop:${cover}`}
            src={cover}
            className="gdpBackdrop"
            loading="eager"
            alt=""
            aria-hidden="true"
            onError={rejectCover}
          />
        )}
        <div className="gdpHero">
          <div className="gdpPosterColumn">
            <CachedImage
              key={image}
              src={image}
              className="gdpPoster"
              loading="eager"
              alt={`Capa de ${title}`}
              onError={cover ? rejectCover : undefined}
            />
            <button
              type="button"
              className="gdpButton gdpGameplay"
              onClick={onGameplay}
            >
              <FontAwesomeIcon icon={faPlay} /> Assistir gameplay
            </button>
          </div>
          <div className="gdpInformation">
            <h1>
              {titleParts ? (
                <>
                  {titleParts[1]}{' '}
                  <span className="gdpSubtitle">{titleParts[2]}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {description && <p className="gdpDescription">{description}</p>}
            <div className="gdpRatings">
              {Number.isFinite(rating) && rating >= 0 && rating <= 5 ? (
                <>
                  <span className="gdpStars" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <FontAwesomeIcon
                        key={i}
                        icon={faStar}
                        className={rating >= i + 0.5 ? 'filled' : ''}
                      />
                    ))}
                  </span>
                  <span className="gdpRatingScore">
                    {rating.toLocaleString('pt-BR', {
                      minimumFractionDigits: 1
                    })}
                    /5
                    {game.ratingCount !== undefined
                      ? ` · ${game.ratingCount} avaliações`
                      : ''}
                  </span>
                </>
              ) : (
                <span className="gdpMuted">Sem avaliação informada</span>
              )}
              {game.recommendPercent && (
                <span className="gdpRecommend">
                  <FontAwesomeIcon icon={faThumbsUp} /> {game.recommendPercent}{' '}
                  recomendam
                </span>
              )}
              {canOpenSource && game.rating && (
                <button
                  type="button"
                  className="gdpButton gdpReview"
                  onClick={() => openSource(true)}
                >
                  Ler avaliações <FontAwesomeIcon icon={faExternalLinkAlt} />
                </button>
              )}
            </div>
            <div className="gdpRelease">
              <div className="gdpReleaseInformation">
                <span className="gdpMuted">Versão da {game.providerName}</span>
                <div className="gdpVersionLine">
                  <strong
                    className={`gdpBuild${game.version ? '' : ' unknown'}`}
                  >
                    {detailsVersion(game)}
                  </strong>
                  {game.version && (
                    <span
                      className="gdpLatest"
                      aria-label="Versão disponível na fonte"
                    >
                      Mais recente
                    </span>
                  )}
                  <span className="gdpUpdate">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>
                      Última atualização<strong>{updateDate}</strong>
                    </span>
                  </span>
                </div>
                {(publicationDate || game.uploader) && (
                  <div className="gdpPublication">
                    {publicationDate && (
                      <span>Publicado em {publicationDate}</span>
                    )}
                    {game.uploader && (
                      <span className="gdpUploader">
                        <FontAwesomeIcon icon={faUser} />
                        <span>
                          Conteúdo atualizado por{' '}
                          <strong>{game.uploader}</strong>
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <dl className="gdpFacts">
                <div>
                  <dt>Plataforma</dt>
                  <dd>
                    <span className="gdpPlatformTag">
                      {game.platform === 'switch' ? 'Switch' : 'PC'}
                    </span>
                    {game.platform !== 'switch' && <span>Windows</span>}
                  </dd>
                </div>
                <div>
                  <dt>Download</dt>
                  <dd>{game.size || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Após instalar</dt>
                  <dd>{game.installedSize || 'Não informado'}</dd>
                </div>
              </dl>
            </div>
            <div className="gdpMetadata">
              <div className="gdpTags">
                {tags.map(([label, value]) => (
                  <span className="gdpTag" key={label}>
                    <span>{label}</span>
                    <span aria-hidden="true">/</span>
                    <strong>{value || 'Não informado'}</strong>
                  </span>
                ))}
                {game.platform !== 'switch' && (
                  <>
                    <span
                      className={`gdpTag${/verified|verificado/i.test(game.deckCompatibility || '') ? ' supported' : ''}`}
                    >
                      <FontAwesomeIcon icon={faGamepad} />
                      <span>Deck</span>
                      <strong>
                        {translatedCompatibility(game.deckCompatibility)}
                      </strong>
                    </span>
                    <span
                      className={`gdpTag${/full|total|completo/i.test(game.controllerSupport || '') ? ' supported' : ''}`}
                    >
                      <FontAwesomeIcon icon={faGamepad} />
                      <span>Controle</span>
                      <strong>
                        {translatedCompatibility(game.controllerSupport)}
                      </strong>
                    </span>
                  </>
                )}
              </div>
              {genres.length > 0 && (
                <div className="gdpGenres">
                  <span className="gdpGenreLabel">Gêneros</span>
                  {genres.map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <StoreSourceCards
          game={game}
          sources={sources}
          loading={sourcesLoading}
          failed={sourcesFailed}
          onSelect={onSelectSource}
        />
        <div className="gdpInstall">{children}</div>
      </article>
      <p className="gdpPageNote">
        <FontAwesomeIcon icon={faListCheck} />
        <span>
          Acompanhe a preparação e a instalação em{' '}
          <Link to="/download-manager">Downloads</Link>.
        </span>
      </p>
    </>
  )
}
