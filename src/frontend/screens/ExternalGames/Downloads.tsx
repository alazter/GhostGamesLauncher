import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faFolderOpen,
  faPlay,
  faSearch
} from '@fortawesome/free-solid-svg-icons'
import type {
  ExternalDownloadJob,
  ExternalGameAction
} from 'common/types/plugins'
import { SourceBadge, bytes, useExternalGames } from './shared'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import CachedImage from 'frontend/components/UI/CachedImage'
import '../DownloadManager/components/DownloadManagerItem/index.css'
import './index.css'

const labels: Record<ExternalDownloadJob['status'], string> = {
  queued: 'Na fila',
  downloading: 'Baixando',
  paused: 'Pausado',
  'awaiting-file': 'Aguardando pacote do navegador',
  extracting: 'Extraindo arquivos…',
  ready: 'Instalando automaticamente…',
  installing: 'Instalando e restaurando saves…',
  completed: 'Instalado com sucesso!',
  cancelled: 'Cancelado',
  error: 'Falha'
}

export default function ExternalDownloads({
  hideWhenEmpty = false
}: {
  hideWhenEmpty?: boolean
} = {}) {
  const { state, error, refresh } = useExternalGames()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string[]>([])
  const [executables, setExecutables] = useState<Record<string, string>>({})

  if (hideWhenEmpty && !state.jobs.length) {
    return null
  }
  async function action(command: ExternalGameAction & { jobId: string }) {
    setBusy((ids) => [...ids, command.jobId])
    setMessage('')
    try {
      const result = await window.api.externalGamesAction(command)
      if (result.error) setMessage(result.error)
      await refresh()
    } catch {
      setMessage('Não foi possível executar esta operação.')
    } finally {
      setBusy((ids) => ids.filter((id) => id !== command.jobId))
    }
  }
  return (
    <section
      className="externalDownloads"
      aria-label="Downloads de fontes externas"
    >
      <div className="downloadManagerSectionHeader">
        <h5 className="downloadManagerSectionTitle">
          JOGOS EXTERNOS ({state.jobs.length})
        </h5>
        <Link to="/external-games" className="externalSearchLink">
          <FontAwesomeIcon icon={faSearch} style={{ marginRight: '5px' }} /> Buscar jogos
        </Link>
      </div>
      {(message || error) && (
        <p role="alert" className="externalNotice">
          {message || error}
        </p>
      )}
      {!state.jobs.length && (
        <p className="externalMuted">
          Os downloads iniciados nas fontes de plugins aparecerão aqui.
        </p>
      )}
      {[...state.jobs].reverse().map((job) => {
        const progress = job.total
          ? Math.min(100, Math.round((job.bytes / job.total) * 100))
          : undefined
        const executable =
          executables[job.id] ||
          (job.candidates.length === 1 ? job.candidates[0] : '')
        const disabled = busy.includes(job.id)
        return (
          <article
            key={job.id}
            className={`externalDownloadCard ${job.status === 'downloading' ? 'active' : ''}`}
          >
            <div className="dmGlassBgContainer">
              <CachedImage
                className="dmGlassBgImg"
                src={job.game.coverUrl || fallbackImage}
                fallback={fallbackImage}
                alt=""
              />
              <div className="dmGlassOverlay" />
            </div>
            <CachedImage
              className="externalDownloadCover"
              src={job.game.coverUrl || fallbackImage}
              fallback={fallbackImage}
              alt=""
            />
            <div className="externalDownloadBody">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <SourceBadge
                  name={job.game.providerName}
                  icon={job.game.providerIcon}
                />
                {job.operation === 'switch-source' && (
                  <span style={{ fontSize: '11px', color: '#ffb703', fontWeight: 'bold', background: 'rgba(255,183,3,0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(255,183,3,0.3)' }}>
                    🔄 Troca de Loja
                  </span>
                )}
                {job.operation === 'update' && (
                  <span style={{ fontSize: '11px', color: '#00ffff', fontWeight: 'bold', background: 'rgba(0,255,255,0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,255,0.3)' }}>
                    ⚡ Atualização
                  </span>
                )}
                {job.operation === 'install' && (
                  <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                    📥 Instalação Inicial
                  </span>
                )}
              </div>
              <h3>{job.game.title}</h3>
              <p>
                {job.operation === 'switch-source'
                  ? `Migrando para ${job.game.providerName}`
                  : job.operation === 'update'
                    ? `Atualizando via ${job.game.providerName}`
                    : `Fonte: ${job.game.providerName}`}{' '}
                · {job.transport === 'torbox' ? 'via TorBox · ' : ''}{labels[job.status]}
              </p>
              {job.transport === 'torbox' && !['completed', 'cancelled'].includes(job.status) && (
                <p>Pausar ou cancelar interrompe a transferência no Ghost. A tarefa na nuvem permanece na sua conta TorBox.</p>
              )}
              {job.transport === 'anker-direct' && (
                <p>Download direto pelo Ghost. {job.status === 'downloading' && !job.transferPhase ? 'Confirme Download na janela do site; escolha o pacote, não o torrent.' : 'Ao retomar, confirme novamente no site; a transferência reinicia do começo.'}</p>
              )}
              {job.status === 'downloading' && job.transferPhase === 'torrent' && <p role="status">Obtendo o torrent oficial do AnkerGames… Se o site precisar de interação, uma janela será aberta. Conclua nela a verificação ou clique em Download Torrent.</p>}
              {job.status === 'downloading' && job.transferPhase === 'remote' && <>
                <p role="status">Preparando no TorBox{job.remoteProgress !== undefined ? ` · ${Math.round(job.remoteProgress * 100)}%` : ''}{job.remoteStatus ? ` · ${job.remoteStatus}` : ''}</p>
                <progress aria-label="Preparação no TorBox" max={1} value={job.remoteProgress} />
              </>}
              {job.status === 'downloading' && (!job.transferPhase || job.transferPhase === 'local') && (
                <>
                  <progress
                    aria-label={`Download de ${job.game.title}`}
                    max={100}
                    value={progress}
                  />
                  <p>
                    {bytes(job.bytes)}
                    {job.total ? ` / ${bytes(job.total)} · ${progress}%` : ''}
                    {job.speed
                      ? ` · ${bytes(job.speed)}/s${job.total ? ` · ${Math.ceil((job.total - job.bytes) / job.speed / 60)} min restantes` : ''}`
                      : ''}
                  </p>
                </>
              )}
              {job.error && (
                <p role="status" className="externalNotice">
                  {job.error}
                </p>
              )}
              {job.status === 'awaiting-file' && (
                <p className="externalMuted" style={{ color: '#00ffff', fontWeight: 500 }}>
                  <FontAwesomeIcon icon={faFolderOpen} style={{ marginRight: '6px' }} />
                  Conclua o download no navegador e selecione o arquivo baixado (.zip, .rar, .7z). O Ghost automatizará a extração, instalação e proteção dos saves.
                </p>
              )}
              <div className="externalActions">
                {['downloading', 'queued'].includes(job.status) && (
                  <button
                    className="dmNeonCircleBtn"
                    title="Pausar"
                    aria-label={`Pausar ${job.game.title}`}
                    disabled={disabled}
                    onClick={() =>
                      void action({ type: 'pause', jobId: job.id })
                    }
                  >
                    <svg
                      viewBox="0 0 38 38"
                      width="38"
                      height="38"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <circle cx="19" cy="19" r="16" />
                      <path d="M15 13v12M23 13v12" />
                    </svg>
                  </button>
                )}
                {(job.status === 'paused' || (job.status === 'error' && ['torbox', 'anker-direct'].includes(job.transport || ''))) && (
                  <button
                    disabled={disabled}
                    onClick={() =>
                      void action({ type: 'resume', jobId: job.id })
                    }
                  >
                    Continuar
                  </button>
                )}
                {['awaiting-file', 'error'].includes(job.status) && job.transport !== 'torbox' && (
                  <button
                    className="externalSelectArchiveBtn"
                    disabled={disabled}
                    onClick={() =>
                      void action({ type: 'import-archive', jobId: job.id })
                    }
                  >
                    <FontAwesomeIcon icon={faFolderOpen} style={{ marginRight: '6px' }} />
                    Selecionar Arquivo Baixado (ZIP, RAR, 7Z)
                  </button>
                )}
                {job.status === 'ready' && (
                  <>
                    <select
                      aria-label={`Executável de ${job.game.title}`}
                      value={executable}
                      onChange={(event) =>
                        setExecutables({
                          ...executables,
                          [job.id]: event.target.value
                        })
                      }
                    >
                      <option value="">Escolha o executável</option>
                      {job.candidates.map((candidate) => (
                        <option key={candidate}>{candidate}</option>
                      ))}
                    </select>
                    <button
                      disabled={disabled || !executable}
                      onClick={() =>
                        void action({
                          type: 'finish',
                          jobId: job.id,
                          executable
                        })
                      }
                    >
                      Concluir instalação
                    </button>
                  </>
                )}
                {![
                  'extracting',
                  'installing',
                  'completed',
                  'cancelled'
                ].includes(job.status) && (
                  <button
                    className="dmNeonCircleBtn dmNeonCancelBtn"
                    title="Cancelar"
                    aria-label={`Cancelar ${job.game.title}`}
                    disabled={disabled}
                    onClick={() =>
                      void action({ type: 'cancel', jobId: job.id })
                    }
                  >
                    <svg
                      viewBox="0 0 38 38"
                      width="38"
                      height="38"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <circle cx="19" cy="19" r="16" />
                      <path d="m14 14 10 10m0-10L14 24" />
                    </svg>
                  </button>
                )}
                {['completed', 'cancelled', 'error'].includes(job.status) && (
                  <button
                    disabled={disabled}
                    title="Remover do histórico"
                    className="dmNeonCircleBtn dmNeonCancelBtn"
                    aria-label={`Remover ${job.game.title} do histórico`}
                    onClick={() =>
                      void action({ type: 'dismiss', jobId: job.id })
                    }
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                )}
                {job.status === 'completed' && (
                  <button
                    className="externalPlayBtn"
                    disabled={disabled}
                    onClick={async () => {
                      const installation = state.installations.find(
                        (item) => item.id === job.installationId
                      )
                      if (!installation) {
                        setMessage('Instalação não encontrada.')
                        return
                      }
                      try {
                        const result = await window.api.launch({
                          appName: installation.appName,
                          runner: 'sideload'
                        })
                        if (result.status === 'error')
                          setMessage(
                            'Não foi possível iniciar o jogo. Consulte os logs do jogo.'
                          )
                      } catch {
                        setMessage('Não foi possível iniciar o jogo.')
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faPlay} style={{ marginRight: '6px' }} />
                    Jogar
                  </button>
                )}
                {job.status === 'completed' && (
                  <Link
                    to={`/external-games?installation=${job.installationId}`}
                  >
                    Fonte, updates e saves
                  </Link>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}
