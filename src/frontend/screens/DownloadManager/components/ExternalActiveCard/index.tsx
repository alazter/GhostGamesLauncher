import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFolderOpen,
  faCheckCircle,
  faPlay,
  faDownload,
  faBolt,
  faExchangeAlt,
  faShieldAlt,
  faCloud,
  faTimes,
  faSpinner
} from '@fortawesome/free-solid-svg-icons'
import type {
  ExternalDownloadJob,
  ExternalGameAction,
  GhostDownloadSource
} from 'common/types/plugins'
import { bytes } from 'frontend/screens/ExternalGames/shared'
import ExternalStoreLogo from '../ExternalStoreLogo'
import { useExternalGameCover } from '../../hooks/useExternalGameCover'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import CachedImage from 'frontend/components/UI/CachedImage'
import '../DownloadManagerItem/index.css'
import './index.css'

interface ExternalActiveCardProps {
  job: ExternalDownloadJob
  onRefresh?: () => Promise<void>
}

const statusLabels: Record<ExternalDownloadJob['status'], string> = {
  queued: 'Na fila',
  downloading: 'Baixando',
  paused: 'Pausado',
  'awaiting-file': 'Aguardando pacote do navegador',
  extracting: 'Extraindo arquivos…',
  ready: 'Instalação pronta para conclusão',
  installing: 'Instalando e restaurando saves…',
  completed: 'Instalado com sucesso!',
  cancelled: 'Cancelado',
  error: 'Atenção necessária'
}

export default function ExternalActiveCard({
  job,
  onRefresh
}: ExternalActiveCardProps) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [executable, setExecutable] = useState(
    job.candidates.length === 1 ? job.candidates[0] : ''
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [showTransportModal, setShowTransportModal] = useState(false)
  const [availableSources, setAvailableSources] = useState<GhostDownloadSource[]>([])
  const [loadingSources, setLoadingSources] = useState(false)

  useEffect(() => {
    if (!showTransportModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTransportModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showTransportModal])

  const handleBrowseExecutable = async () => {
    setBusy(true)
    setErrorMessage('')
    try {
      const result = await window.api.externalGamesAction({
        type: 'browse-executable',
        jobId: job.id
      })
      if (result.selectedExecutable) {
        setExecutable(result.selectedExecutable)
      }
      if (onRefresh) await onRefresh()
    } catch {
      setErrorMessage('Não foi possível selecionar o executável.')
    } finally {
      setBusy(false)
    }
  }

  const promptTransportChoice = async () => {
    setLoadingSources(true)
    setErrorMessage('')
    try {
      const fetched = await window.api.pluginsGetDownloadSources(
        job.game.providerId,
        job.game.pageUrl || job.game.id
      )
      if (fetched && fetched.length > 0) {
        setAvailableSources(fetched)
        setShowTransportModal(true)
      } else {
        setErrorMessage('Nenhuma fonte de download alternativa encontrada.')
      }
    } catch {
      setErrorMessage('Não foi possível obter opções de download.')
    } finally {
      setLoadingSources(false)
    }
  }

  const handleResume = async () => {
    if (job.status === 'error') {
      setLoadingSources(true)
      try {
        const fetched = await window.api.pluginsGetDownloadSources(
          job.game.providerId,
          job.game.pageUrl || job.game.id
        )
        if (fetched && fetched.length > 1) {
          setAvailableSources(fetched)
          setShowTransportModal(true)
          setLoadingSources(false)
          return
        }
      } catch {}
      setLoadingSources(false)
    }

    setBusy(true)
    setErrorMessage('')
    try {
      const result = await window.api.externalGamesAction({ type: 'resume', jobId: job.id })
      if (result.error) {
        setErrorMessage(result.error)
        void promptTransportChoice()
      }
      if (onRefresh) await onRefresh()
    } catch {
      setErrorMessage('Não foi possível retomar o download.')
      void promptTransportChoice()
    } finally {
      setBusy(false)
    }
  }

  const handleSwitchSource = async (source: GhostDownloadSource) => {
    setBusy(true)
    setErrorMessage('')
    try {
      const result = await window.api.externalGamesAction({
        type: 'switch-source',
        jobId: job.id,
        source
      })
      if (result.error) {
        setErrorMessage(result.error)
      } else {
        setShowTransportModal(false)
      }
      if (onRefresh) await onRefresh()
    } catch {
      setErrorMessage('Não foi possível alterar a fonte de download.')
    } finally {
      setBusy(false)
    }
  }

  const handleGoToSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const targetTitle = job.game?.title || ''
    if (!targetTitle) return
    const params = new URLSearchParams()
    params.set('q', targetTitle)
    if (job.installationId) {
      params.set('installation', job.installationId)
    }
    navigate(`/external-games?${params.toString()}`)
  }

  const { coverUrl } = useExternalGameCover(
    job.game.title,
    job.game.coverUrl,
    job.old?.appName
  )

  const isRemoteTorbox = job.transport === 'torbox' && job.transferPhase === 'remote'
  const isLocalTorbox = job.transport === 'torbox' && job.transferPhase === 'local'

  const progress = isRemoteTorbox
    ? (job.remoteProgress !== undefined ? Math.min(100, Math.round(job.remoteProgress * 100)) : 0)
    : job.total
    ? Math.min(100, Math.round((job.bytes / job.total) * 100))
    : undefined

  const getTorboxStatusLabel = (status?: string) => {
    if (!status) return 'Processando na Nuvem'
    if (status === 'downloading') return 'Baixando no Servidor'
    if (status === 'checkingResumeData') return 'Verificando Torrent'
    if (status === 'cached') return 'Disponível em Cache'
    if (status === 'completed') return 'Pronto no Servidor'
    if (status === 'paused') return 'Pausado no Servidor'
    if (status === 'uploading') return 'Semeando no Servidor'
    return status
  }

  const etaMinutes =
    job.speed && job.total && job.total > job.bytes
      ? Math.ceil((job.total - job.bytes) / job.speed / 60)
      : null

  const handleAction = async (command: ExternalGameAction & { jobId: string }) => {
    setBusy(true)
    setErrorMessage('')
    try {
      const result = await window.api.externalGamesAction(command)
      if (result.error) setErrorMessage(result.error)
      if (onRefresh) await onRefresh()
    } catch {
      setErrorMessage('Não foi possível executar esta operação.')
    } finally {
      setBusy(false)
    }
  }

  const operationIcon =
    job.operation === 'switch-source'
      ? faExchangeAlt
      : job.operation === 'update'
      ? faBolt
      : faDownload

  const operationLabel =
    job.operation === 'switch-source'
      ? 'Troca de Loja'
      : job.operation === 'update'
      ? 'Atualização'
      : 'Instalação Inicial'

  const operationClass =
    job.operation === 'switch-source'
      ? 'switch'
      : job.operation === 'update'
      ? 'update'
      : 'install'

  const isAttentionState =
    !job.spacePlan &&
    (job.status === 'awaiting-file' ||
      job.status === 'error' ||
      (Boolean(job.error) &&
        !['downloading', 'extracting', 'installing', 'ready'].includes(job.status)))

  return (
    <div className="dmActiveCard dmExternalActiveCard">
      {/* Background blur artwork */}
      <div className="dmGlassBgContainer">
        <CachedImage
          src={coverUrl}
          fallback={fallbackImage}
          alt=""
          className="dmGlassBgImg"
        />
        <div className="dmGlassOverlay" />
      </div>

      {/* Cover Image */}
      <div className="dmActiveCoverWrapper">
        <CachedImage
          src={coverUrl}
          fallback={fallbackImage}
          alt={job.game.title}
          className="dmActiveCoverImg"
        />
      </div>

      {/* Content */}
      <div className="dmActiveContent">
        <div className="dmActiveTopRow">
          <span className="dmActiveTitle" title={job.game.title}>
            {job.game.title}
          </span>
          <div className="dmExternalBadgesRow">
            <div
              role="button"
              tabIndex={0}
              onClick={handleGoToSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleGoToSearch()
                }
              }}
              className="dmExternalStoreLogoClickable"
              title={`Ver opções de "${job.game.title}" em Buscar Jogos`}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              <ExternalStoreLogo
                icon={job.game.providerIcon}
                name={job.game.providerName}
                size={34}
              />
            </div>
            <button
              type="button"
              className={`dmActiveOperationBadge ${operationClass} is-clickable`}
              onClick={handleGoToSearch}
              title={
                job.operation === 'switch-source'
                  ? `Trocar de loja: Ver "${job.game.title}" em Buscar Jogos`
                  : `Ver "${job.game.title}" em Buscar Jogos`
              }
              aria-label={
                job.operation === 'switch-source'
                  ? `Trocar de loja: Ver ${job.game.title} em Buscar Jogos`
                  : `Ver ${job.game.title} em Buscar Jogos`
              }
            >
              <FontAwesomeIcon icon={operationIcon} style={{ marginRight: '6px', fontSize: '10px' }} />
              {operationLabel}
            </button>
          </div>
        </div>

        {isAttentionState ? (
          <div className="dmActiveAttentionBody">
            <div className="dmActiveAttentionTextCol">
              {/* Status Line */}
              <div className="dmActiveStatusRow">
                <span className="dmActiveStatusText">
                  {job.operation === 'switch-source' ? (
                    <button
                      type="button"
                      className="dmActiveMigrateLinkBtn"
                      onClick={handleGoToSearch}
                      title={`Trocar de loja: Ver "${job.game.title}" em Buscar Jogos`}
                    >
                      {`Migrando para ${job.game.providerName}`}
                    </button>
                  ) : job.operation === 'update' ? (
                    `Atualizando via ${job.game.providerName}`
                  ) : (
                    `Fonte: ${job.game.providerName}`
                  )}{' '}
                  ·{' '}
                  {isRemoteTorbox ? (
                    <>
                      <FontAwesomeIcon icon={faCloud} style={{ color: '#00ffff', marginRight: '4px', fontSize: '11px' }} />
                      <span>Nuvem TorBox · </span>
                      <span className="dmActiveStatusHighlight">
                        {getTorboxStatusLabel(job.remoteStatus)}
                      </span>
                    </>
                  ) : isLocalTorbox ? (
                    <>
                      <span>via TorBox · </span>
                      <span className="dmActiveStatusHighlight">Transferindo para o PC</span>
                    </>
                  ) : (
                    <>
                      {job.transport === 'torbox' ? 'via TorBox · ' : ''}
                      <span className="dmActiveStatusHighlight">
                        {statusLabels[job.status] || job.status}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {job.oldRemoved && job.status !== 'completed' && (
                <p
                  role="status"
                  className="dmExternalNoticeBanner"
                  title="A instalação antiga foi removida. O jogo ficará indisponível até concluir a reinstalação. O backup dos saves está preservado com o GhostShield."
                >
                  <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#00ffff', marginRight: '6px' }} />
                  Instalação antiga removida. O jogo ficará indisponível até reinstalar. <span className="dmHighlightText">Backup dos saves preservado</span>.
                </p>
              )}

              {/* Error or Awaiting File Notice (Full Width, up to 3 lines, unclipped) */}
              <span
                className="dmExternalNoticeText"
                title={job.error || undefined}
              >
                {job.error ||
                  (job.status === 'awaiting-file'
                    ? 'Conclua o download no navegador e selecione o arquivo baixado (.zip, .rar, .7z).'
                    : 'A fonte requer ação manual para prosseguir.')}
              </span>

              {job.status === 'error' && (
                <div style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    className="dmActiveMigrateLinkBtn"
                    onClick={() => void promptTransportChoice()}
                    style={{ textDecoration: 'underline', color: '#00ffff', fontWeight: 600, fontSize: '11.5px' }}
                    title="Escolha entre Download Direto ou TorBox"
                  >
                    <FontAwesomeIcon icon={faExchangeAlt} style={{ marginRight: '5px' }} />
                    Escolher como baixar (Download Direto / TorBox)
                  </button>
                </div>
              )}

              {job.status === 'error' && job.directDiagnostic && (
                <details style={{ fontSize: '11px', color: '#94a3b8' }}>
                  <summary>Detalhes da interrupção</summary>
                  <p>
                    Hospedagem: {job.directDiagnostic.host || 'não identificada'} · Recebido: {bytes(job.directDiagnostic.bytes)} de {bytes(job.directDiagnostic.total)} · Tentativas: {job.directDiagnostic.attempts}.
                  </p>
                </details>
              )}

              {errorMessage && (
                <div className="dmActiveErrorRow">
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Unified Bottom Actions Row */}
            <div className="dmActiveActionsRow">
              <div className="dmActiveActionsLeft">
                {job.transport !== 'torbox' && (
                  <button
                    type="button"
                    className="externalSelectArchiveBtn dmActiveSelectArchiveBtn"
                    disabled={busy}
                    onClick={() =>
                      void handleAction({
                        type: 'import-archive',
                        jobId: job.id
                      })
                    }
                  >
                    <FontAwesomeIcon icon={faFolderOpen} style={{ marginRight: '6px' }} />
                    Selecionar Arquivo Baixado (ZIP, RAR, 7Z)
                  </button>
                )}
              </div>

              <div className="dmActiveControls">
                {!job.spacePlan && (job.canResume || ['error', 'cancelled', 'paused'].includes(job.status)) && (
                  <button
                    type="button"
                    className="dmActiveSelectArchiveBtn dmResumeDownloadBtn"
                    title="Retomar Download"
                    aria-label={`Retomar ${job.game.title}`}
                    disabled={busy}
                    onClick={() => void handleResume()}
                  >
                    <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                      <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                      <polygon points="15,12 27,19 15,26" fill="currentColor" />
                    </svg>
                    <span>Retomar</span>
                  </button>
                )}

                <button
                  type="button"
                  className="dmNeonCircleBtn dmNeonCancelBtn"
                  title={['cancelled', 'error'].includes(job.status) ? 'Remover Tarefa' : 'Cancelar Tarefa'}
                  aria-label={`${['cancelled', 'error'].includes(job.status) ? 'Remover' : 'Cancelar'} ${job.game.title}`}
                  disabled={busy}
                  onClick={() =>
                    void handleAction({
                      type: ['cancelled', 'error'].includes(job.status) ? 'dismiss' : 'cancel',
                      jobId: job.id
                    })
                  }
                >
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <line x1="13.5" y1="13.5" x2="24.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="24.5" y1="13.5" x2="13.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="dmActiveBottomRow">
            <div className="dmActiveProgressCol">
              {/* Status Line */}
              <div className="dmActiveStatusRow">
                <span className="dmActiveStatusText">
                  {job.operation === 'switch-source' ? (
                    <button
                      type="button"
                      className="dmActiveMigrateLinkBtn"
                      onClick={handleGoToSearch}
                      title={`Trocar de loja: Ver "${job.game.title}" em Buscar Jogos`}
                    >
                      {`Migrando para ${job.game.providerName}`}
                    </button>
                  ) : job.operation === 'update' ? (
                    `Atualizando via ${job.game.providerName}`
                  ) : (
                    `Fonte: ${job.game.providerName}`
                  )}{' '}
                  ·{' '}
                  {isRemoteTorbox ? (
                    <>
                      <FontAwesomeIcon icon={faCloud} style={{ color: '#00ffff', marginRight: '4px', fontSize: '11px' }} />
                      <span>Nuvem TorBox · </span>
                      <span className="dmActiveStatusHighlight">
                        {getTorboxStatusLabel(job.remoteStatus)}
                      </span>
                    </>
                  ) : isLocalTorbox ? (
                    <>
                      <span>via TorBox · </span>
                      <span className="dmActiveStatusHighlight">Transferindo para o PC</span>
                    </>
                  ) : (
                    <>
                      {job.transport === 'torbox' ? 'via TorBox · ' : ''}
                      <span className="dmActiveStatusHighlight">
                        {statusLabels[job.status] || job.status}
                      </span>
                    </>
                  )}
                </span>
                {job.status === 'downloading' && progress !== undefined && (
                  <span className="dmActiveProgressPercent">{progress}%</span>
                )}
              </div>

              {job.oldRemoved && job.status !== 'completed' && (
                <p
                  role="status"
                  className="dmExternalNoticeBanner"
                  title="A instalação antiga foi removida. O jogo ficará indisponível até concluir a reinstalação. O backup dos saves está preservado com o GhostShield."
                >
                  <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#00ffff', marginRight: '6px' }} />
                  Instalação antiga removida. O jogo ficará indisponível até reinstalar. <span className="dmHighlightText">Backup dos saves preservado</span>.
                  {isRemoteTorbox && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="dmActiveMigrateLinkBtn"
                        onClick={handleGoToSearch}
                        style={{ textDecoration: 'underline', color: '#ffb703', fontWeight: 600 }}
                        title={`Trocar fonte: Ver opções de "${job.game.title}" em Buscar Jogos`}
                      >
                        Trocar para Download Direto
                      </button>
                    </>
                  )}
                </p>
              )}
              {job.status === 'downloading' && isRemoteTorbox && !job.oldRemoved && (
                <p
                  role="status"
                  className="dmExternalNoticeBanner"
                  title="O TorBox está baixando o torrent na nuvem. Você pode trocar para download direto a qualquer momento se houver fonte direta disponível."
                >
                  <FontAwesomeIcon icon={faCloud} style={{ color: '#00ffff', marginRight: '6px' }} />
                  Baixando na nuvem TorBox. Preferir alta velocidade imediata?{' '}
                  <button
                    type="button"
                    className="dmActiveMigrateLinkBtn"
                    onClick={handleGoToSearch}
                    style={{ textDecoration: 'underline', color: '#00ffff', fontWeight: 600 }}
                  >
                    Trocar para Download Direto
                  </button>
                </p>
              )}
              {job.spacePlan && (
                <section className="dmExternalSpacePlan" aria-label="Espaço para reinstalação">
                  <h3>Espaço necessário para reinstalar</h3>
                  <p>Destino: <strong>{job.spacePlan.destination}</strong></p>
                  <p>{job.spacePlan.packageReady ? 'Pacote já baixado' : `Pacote: ${bytes(job.spacePlan.packageBytes)}`} · Jogo instalado: {bytes(job.spacePlan.installedBytes)}{job.spacePlan.estimated ? ' (estimativa; o tamanho real pode ser maior)' : ''}.</p>
                  <p>Para baixar e extrair no disco original, mantenha {bytes(job.spacePlan.requiredOriginal)} livres, incluindo margem de segurança. Faltam {bytes(job.spacePlan.missingOriginal)}.</p>
                  {job.spacePlan.missingDestination > 0 ? (
                    <p>Libere pelo menos {bytes(job.spacePlan.missingDestination)} no destino para comportar o jogo instalado. Outro disco para o pacote não resolve essa falta de espaço.</p>
                  ) : job.spacePlan.temporaryDirectory ? (
                    <p>O pacote será baixado temporariamente em <strong>{job.spacePlan.temporaryDirectory}</strong> porque o disco original não comporta o pacote e o jogo juntos. Se houver uma transferência parcial, ela será reiniciada no novo local. Após instalar e restaurar os saves, essa pasta será removida.</p>
                  ) : <p>Nenhum outro disco com espaço suficiente foi encontrado. Libere espaço e verifique novamente.</p>}
                  <button type="button" disabled={busy || !job.spacePlan.temporaryDirectory || job.spacePlan.missingDestination > 0} onClick={() => void handleAction({ type: 'space-proceed', jobId: job.id })}>Prosseguir</button>
                  <button type="button" disabled={busy} onClick={() => void handleAction({ type: 'space-recheck', jobId: job.id })}>Verificar novamente após liberar espaço</button>
                  <button type="button" disabled={busy} onClick={() => void handleAction({ type: 'cancel', jobId: job.id })}>Cancelar</button>
                </section>
              )}

              {/* Downloading State */}
              {job.status === 'downloading' && job.directDiagnostic && ['interrupted', 'retry-scheduled', 'resuming'].includes(job.directDiagnostic.event) && (
                <p
                  role="status"
                  className="dmExternalNoticeBanner"
                  title={`Conexão interrompida. Tentando continuar o download automaticamente (${job.directDiagnostic.attempts}/5)…`}
                >
                  Conexão interrompida. Tentando continuar automaticamente ({job.directDiagnostic.attempts}/5)…
                </p>
              )}
              {job.status === 'error' && job.directDiagnostic && (
                <details className="dmExternalNoticeBanner">
                  <summary>Detalhes da interrupção</summary>
                  <p>Hospedagem: {job.directDiagnostic.host || 'não identificada'} · Recebido: {bytes(job.directDiagnostic.bytes)} de {bytes(job.directDiagnostic.total)} · Tentativas: {job.directDiagnostic.attempts}. O navegador não informou a causa da interrupção.</p>
                </details>
              )}
              {job.status === 'downloading' && job.transferPhase === 'torrent' && (
                <p
                  role="status"
                  className="dmExternalNoticeBanner"
                  title={`Obtendo torrent de ${job.game.providerName}. Na janela do site, entre na conta se necessário e escolha Torrent.`}
                >
                  Obtendo torrent de {job.game.providerName}. Na janela do site, escolha Torrent.
                </p>
              )}
              {job.status === 'downloading' && ['anker-direct', 'steamrip-direct', 'rom-direct'].includes(job.transport || '') && !job.transferPhase && (
                <p
                  role="status"
                  className="dmExternalNoticeBanner"
                  title={`Confirme o download do pacote na janela de ${job.game.providerName}. O Ghost receberá o arquivo automaticamente.`}
                >
                  Confirme o download na janela de {job.game.providerName}. O Ghost receberá o arquivo automaticamente.
                </p>
              )}
              {job.status === 'downloading' && (
                <>
                  <div className="dmProgressBarTrack">
                    <div
                      className="dmProgressBarFill"
                      style={{ width: `${progress || 0}%` }}
                    />
                  </div>
                  <div className="dmActiveEtaRow">
                    {isRemoteTorbox ? (
                      <span>
                        <FontAwesomeIcon icon={faCloud} style={{ color: '#00ffff', marginRight: '6px' }} />
                        Nuvem TorBox: {progress !== undefined ? `${progress}%` : '0%'} baixado no servidor · Aguardando nuvem para transferir ao PC
                      </span>
                    ) : (
                      <span>
                        {bytes(job.bytes)}
                        {job.total ? ` / ${bytes(job.total)}` : ''}
                        {job.speed ? ` · ${bytes(job.speed)}/s` : ''}
                        {etaMinutes ? ` · ${etaMinutes} min restantes` : ''}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Extracting / Installing State */}
              {(job.status === 'extracting' || job.status === 'installing') && (
                <>
                  <div className="dmProgressBarTrack">
                    <div className="dmProgressBarFill dmMarqueeFill" style={{ width: '100%' }} />
                  </div>
                  <div className="dmActiveEtaRow">
                    <span>
                      {job.status === 'extracting'
                        ? 'Descompactando arquivos na pasta do jogo…'
                        : job.game.platform === 'switch' ? 'Adicionando a ROM à biblioteca…' : 'Configurando executável e protegendo saves GhostShield…'}
                    </span>
                  </div>
                </>
              )}

              {/* Ready for executable selection */}
              {job.status === 'ready' && (
                <div className="dmExternalReadyContainer">
                  <select
                    aria-label={`${job.game.platform === 'switch' ? 'ROM' : 'Executável'} de ${job.game.title}`}
                    value={executable}
                    className="dmExternalExecSelect"
                    onChange={(e) => {
                      if (e.target.value === '__browse__') {
                        void handleBrowseExecutable()
                      } else {
                        setExecutable(e.target.value)
                      }
                    }}
                  >
                    <option value="">{job.game.platform === 'switch' ? 'Selecione a ROM do jogo base (não update/DLC)...' : 'Selecione o executável principal...'}</option>
                    <option value="__browse__">📁 Procurar no computador...</option>
                    {job.candidates.map((cand) => (
                      <option key={cand} value={cand}>
                        {cand}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="dmPlayBtn dmFinishInstallBtn"
                    disabled={busy || !executable}
                    onClick={() =>
                      void handleAction({
                        type: 'finish',
                        jobId: job.id,
                        executable
                      })
                    }
                  >
                    <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '6px' }} />
                    Concluir Instalação
                  </button>
                </div>
              )}

              {/* Paused State */}
              {job.status === 'paused' && (
                <div className="dmActiveEtaRow">
                  <span style={{ color: '#ffb703' }}>Download pausado pelo usuário</span>
                </div>
              )}

              {errorMessage && (
                <div className="dmActiveErrorRow">
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Action Controls on the Right */}
            <div className="dmActiveControls">
              {job.status === 'downloading' && (
                <button
                  type="button"
                  className="dmNeonCircleBtn"
                  title="Pausar Download"
                  aria-label={`Pausar ${job.game.title}`}
                  disabled={busy}
                  onClick={() =>
                    void handleAction({ type: 'pause', jobId: job.id })
                  }
                >
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <line x1="14" y1="13" x2="14" y2="25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="24" y1="13" x2="24" y2="25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              {!job.spacePlan && (job.status === 'paused' || (['error', 'cancelled'].includes(job.status) && job.canResume)) && (
                <button
                  type="button"
                  className="dmActiveSelectArchiveBtn dmResumeDownloadBtn"
                  title="Retomar Download"
                  aria-label={`Retomar ${job.game.title}`}
                  disabled={busy}
                  onClick={() => void handleResume()}
                >
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <polygon points="15,12 27,19 15,26" fill="currentColor" />
                  </svg>
                  <span>Retomar</span>
                </button>
              )}

              {/* Cancel / Dismiss Button */}
              {!['extracting', 'installing', 'completed'].includes(job.status) && (
                <button
                  type="button"
                  className="dmNeonCircleBtn dmNeonCancelBtn"
                  title={['cancelled', 'error'].includes(job.status) ? 'Remover Tarefa' : 'Cancelar Tarefa'}
                  aria-label={`${['cancelled', 'error'].includes(job.status) ? 'Remover' : 'Cancelar'} ${job.game.title}`}
                  disabled={busy}
                  onClick={() =>
                    void handleAction({
                      type: ['cancelled', 'error'].includes(job.status) ? 'dismiss' : 'cancel',
                      jobId: job.id
                    })
                  }
                >
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <line x1="13.5" y1="13.5" x2="24.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="24.5" y1="13.5" x2="13.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Cyber Neon: Escolha como baixar (Download Direto / TorBox) */}
      {showTransportModal && (
        <div
          className="dmTransportModalOverlay"
          onClick={() => setShowTransportModal(false)}
        >
          <div
            className="dmTransportModalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dmTransportTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dmTransportModalHeader">
              <div className="dmTransportModalTitle">
                <FontAwesomeIcon icon={faExchangeAlt} style={{ color: '#00ffff' }} />
                <span id="dmTransportTitle">Escolha como baixar</span>
              </div>
              <button
                type="button"
                className="dmTransportModalCloseBtn"
                aria-label="Fechar"
                onClick={() => setShowTransportModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="dmTransportModalBody">
              <p className="dmTransportGameSubtitle">
                <strong>{job.game.title}</strong> · {job.game.providerName}
              </p>

              {loadingSources ? (
                <div className="dmTransportLoadingRow">
                  <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#00ffff', marginRight: '8px' }} />
                  <span>Buscando opções de download disponíveis...</span>
                </div>
              ) : (
                <div className="dmTransportChoices">
                  {availableSources.map((source) => {
                    const isTorbox = source.type === 'torbox'
                    const isExternal = source.type === 'external'
                    const label = isTorbox
                      ? 'TorBox — Torrent'
                      : isExternal
                      ? 'Download direto — Confirmar no site'
                      : source.type === 'direct'
                      ? 'Download Direto'
                      : source.name

                    const isCurrent = (isTorbox && job.transport === 'torbox') || (!isTorbox && job.transport !== 'torbox')

                    return (
                      <button
                        key={source.id}
                        type="button"
                        className={`dmTransportChoiceBtn ${isCurrent ? 'isCurrent' : ''}`}
                        disabled={busy}
                        onClick={() => void handleSwitchSource(source)}
                      >
                        <div className="dmTransportBtnLeft">
                          <FontAwesomeIcon
                            icon={isTorbox ? faCloud : faDownload}
                            className="dmTransportBtnIcon"
                          />
                          <div className="dmTransportBtnTexts">
                            <span className="dmTransportBtnLabel">{label}</span>
                            {source.size && (
                              <span className="dmTransportBtnSize">Tamanho: {source.size}</span>
                            )}
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="dmTransportCurrentBadge">Atual</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="dmTransportModalFooter">
              <button
                type="button"
                className="dmTransportBtnCancel"
                onClick={() => setShowTransportModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
