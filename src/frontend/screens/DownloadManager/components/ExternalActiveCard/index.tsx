import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFolderOpen,
  faCheckCircle,
  faPlay
} from '@fortawesome/free-solid-svg-icons'
import type {
  ExternalDownloadJob,
  ExternalGameAction
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
  const [busy, setBusy] = useState(false)
  const [executable, setExecutable] = useState(
    job.candidates.length === 1 ? job.candidates[0] : ''
  )
  const [errorMessage, setErrorMessage] = useState('')

  const { coverUrl } = useExternalGameCover(
    job.game.title,
    job.game.coverUrl,
    job.old?.appName
  )

  const progress = job.total
    ? Math.min(100, Math.round((job.bytes / job.total) * 100))
    : undefined

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

  const operationLabel =
    job.operation === 'switch-source'
      ? '🔄 Troca de Loja'
      : job.operation === 'update'
      ? '⚡ Atualização'
      : '📥 Instalação Inicial'

  const operationClass =
    job.operation === 'switch-source'
      ? 'switch'
      : job.operation === 'update'
      ? 'update'
      : 'install'

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
            <ExternalStoreLogo
              icon={job.game.providerIcon}
              name={job.game.providerName}
              size={34}
            />
            <span className={`dmActiveOperationBadge ${operationClass}`}>
              {operationLabel}
            </span>
          </div>
        </div>

        <div className="dmActiveBottomRow">
          <div className="dmActiveProgressCol">
            {/* Status Line */}
            <div className="dmActiveStatusRow">
              <span className="dmActiveStatusText">
                {job.operation === 'switch-source'
                  ? `Migrando para ${job.game.providerName}`
                  : job.operation === 'update'
                  ? `Atualizando via ${job.game.providerName}`
                  : `Fonte: ${job.game.providerName}`}{' '}
                · {job.transport === 'torbox' ? 'via TorBox · ' : ''}
                {statusLabels[job.status] || job.status}
              </span>
              {job.status === 'downloading' && progress !== undefined && (
                <span className="dmActiveProgressPercent">{progress}%</span>
              )}
            </div>

            {/* Downloading State */}
            {job.status === 'downloading' && job.directDiagnostic && ['interrupted', 'retry-scheduled', 'resuming'].includes(job.directDiagnostic.event) && (
              <p role="status">Conexão interrompida. Tentando continuar o download automaticamente ({job.directDiagnostic.attempts}/5)…</p>
            )}
            {job.status === 'error' && job.directDiagnostic && (
              <details><summary>Detalhes da interrupção</summary>
                <p>Hospedagem: {job.directDiagnostic.host || 'não identificada'} · Recebido: {bytes(job.directDiagnostic.bytes)} de {bytes(job.directDiagnostic.total)} · Tentativas: {job.directDiagnostic.attempts}. O navegador não informou a causa da interrupção.</p>
              </details>
            )}
            {job.status === 'downloading' && job.transferPhase === 'torrent' && (
              <p role="status">Obtendo torrent de {job.game.providerName}. Na janela do site, entre na conta se necessário e escolha Torrent.</p>
            )}
            {job.status === 'downloading' && ['anker-direct', 'steamrip-direct', 'rom-direct'].includes(job.transport || '') && !job.transferPhase && (
              <p role="status">Confirme o download do pacote na janela de {job.game.providerName}. O Ghost receberá o arquivo automaticamente.</p>
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
                  <span>
                    {bytes(job.bytes)}
                    {job.total ? ` / ${bytes(job.total)}` : ''}
                    {job.speed ? ` · ${bytes(job.speed)}/s` : ''}
                    {etaMinutes ? ` · ${etaMinutes} min restantes` : ''}
                  </span>
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

            {/* Awaiting File or Error State */}
            {(job.status === 'awaiting-file' || job.status === 'error') && (
              <div className="dmExternalActionContainer">
                <span className="dmExternalNoticeText">
                  {job.error ||
                    (job.status === 'awaiting-file'
                      ? 'Conclua o download no navegador e selecione o arquivo baixado (.zip, .rar, .7z).'
                      : 'A fonte requer ação manual para prosseguir.')}
                </span>
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
            )}

            {/* Ready for executable selection */}
            {job.status === 'ready' && (
              <div className="dmExternalReadyContainer">
                <select
                  aria-label={`${job.game.platform === 'switch' ? 'ROM' : 'Executável'} de ${job.game.title}`}
                  value={executable}
                  className="dmExternalExecSelect"
                  onChange={(e) => setExecutable(e.target.value)}
                >
                  <option value="">{job.game.platform === 'switch' ? 'Selecione a ROM do jogo base (não update/DLC)...' : 'Selecione o executável principal...'}</option>
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

            {(job.status === 'paused' || (job.status === 'error' && job.canResume)) && (
              <button
                type="button"
                className="dmActiveSelectArchiveBtn dmResumeDownloadBtn"
                title="Retomar Download"
                aria-label={`Retomar ${job.game.title}`}
                disabled={busy}
                onClick={() =>
                  void handleAction({ type: 'resume', jobId: job.id })
                }
              >
                <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                  <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <polygon points="15,12 27,19 15,26" fill="currentColor" />
                </svg>
                <span>Retomar</span>
              </button>
            )}

            {/* Cancel Button for active / error / awaiting-file tasks */}
            {!['extracting', 'installing', 'completed'].includes(job.status) && (
              <button
                type="button"
                className="dmNeonCircleBtn dmNeonCancelBtn"
                title="Cancelar Tarefa"
                aria-label={`Cancelar ${job.game.title}`}
                disabled={busy}
                onClick={() =>
                  void handleAction({ type: 'cancel', jobId: job.id })
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
      </div>
    </div>
  )
}
