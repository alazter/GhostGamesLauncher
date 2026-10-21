import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import type { GhostSearchResult } from 'common/types/plugins'
import ExternalStoreLogo from 'frontend/screens/DownloadManager/components/ExternalStoreLogo'
import { detailsVersion } from './gameDetailsMetadata'

type Props = {
  game: GhostSearchResult
  sources: GhostSearchResult[]
  loading?: boolean
  failed?: boolean
  onSelect: (source: GhostSearchResult) => void
}

export default function StoreSourceCards({
  game,
  sources,
  loading,
  failed,
  onSelect
}: Props) {
  const stores = [
    ...new Map(
      [...sources, game].map((source) => [
        `${source.providerId}:${source.id}`,
        source
      ])
    ).values()
  ]

  return (
    <fieldset className="gdpSources">
      <legend>Fontes disponíveis para download</legend>
      {(loading || failed) && (
        <p className="gdpSourcesStatus" role="status">
          {loading
            ? 'Buscando o jogo nas outras lojas…'
            : 'Algumas lojas não responderam. As fontes já encontradas continuam disponíveis.'}
        </p>
      )}
      <div className="gdpSourcesGrid">
        {stores.map((source) => {
          const selected =
            source.providerId === game.providerId && source.id === game.id
          return (
            <button
              type="button"
              className="gdpButton gdpSourceCard"
              key={`${source.providerId}:${source.id}`}
              aria-pressed={selected}
              aria-label={`${source.providerName} · ${detailsVersion(source)}`}
              onClick={() => {
                if (!selected) onSelect(source)
              }}
            >
              <span className="gdpSourceHeading">
                <ExternalStoreLogo
                  name={source.providerName}
                  icon={source.providerIcon}
                  size={24}
                />
                <strong>{source.providerName}</strong>
                <span className="gdpSourceIndicator" aria-hidden="true">
                  {selected && <FontAwesomeIcon icon={faCheck} />}
                </span>
              </span>
              <span className="gdpSourceVersion">{detailsVersion(source)}</span>
              <span className="gdpSourceSize">
                Download: {source.size || 'tamanho não informado'}
              </span>
              {(source.cracker || source.uploader) && (
                <span className="gdpSourceCredits">
                  {source.cracker || `Por ${source.uploader}`}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
