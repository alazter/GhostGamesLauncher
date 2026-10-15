import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import type { SourceSearchProgress } from 'common/types/plugins'

interface Props {
  loading: boolean
  detailsLoading: boolean
  term: string
  progress?: SourceSearchProgress
  resultCount: number
}

export default function SearchStatus({ loading, detailsLoading, term, progress, resultCount }: Props) {
  if (!loading && !detailsLoading) return null
  return (
    <div className="externalSearchStatus" role="status" aria-live="polite">
      <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
      <div className="externalSearchStatusText">
        <strong>{loading ? <>Buscando “{term}”…</> : 'Carregando informações do jogo…'}</strong>
        {loading && (
          <>
            <span>{progress && progress.total > 0
              ? `${progress.completed} de ${progress.total} fontes consultadas`
              : 'Consultando as fontes habilitadas…'}
              {resultCount > 0 && ` · ${resultCount} resultado${resultCount === 1 ? '' : 's'} ${resultCount === 1 ? 'disponível' : 'disponíveis'}`}
            </span>
            {Boolean(progress?.total) && <progress aria-label="Fontes consultadas"
              value={progress!.completed} max={progress!.total} />}
            {Boolean(progress?.pendingProviders.length) && <small>Aguardando: {progress!.pendingProviders.map(item => item.name).join(', ')}</small>}
            {detailsLoading && <small>Carregando informações do jogo selecionado…</small>}
          </>
        )}
      </div>
    </div>
  )
}
