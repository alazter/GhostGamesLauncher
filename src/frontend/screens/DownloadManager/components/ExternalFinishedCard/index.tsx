import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import type {
  ExternalDownloadJob,
  ExternalInstallation
} from 'common/types/plugins'
import ExternalStoreLogo from '../ExternalStoreLogo'
import { useExternalGameCover } from '../../hooks/useExternalGameCover'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import CachedImage from 'frontend/components/UI/CachedImage'
import '../DownloadManagerItem/index.css'
import './index.css'

interface ExternalFinishedCardProps {
  job: ExternalDownloadJob
  installations: ExternalInstallation[]
  onDismiss: (jobId: string) => Promise<void>
}

export default function ExternalFinishedCard({
  job,
  installations,
  onDismiss
}: ExternalFinishedCardProps) {
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const installation = installations.find((i) => i.id === job.installationId)
  const { coverUrl } = useExternalGameCover(
    job.game.title,
    job.game.coverUrl,
    installation?.appName || job.old?.appName
  )

  const handlePlay = async () => {
    setBusy(true)
    setErrorMsg('')
    try {
      if (!installation) {
        setErrorMsg('Instalação não encontrada.')
        return
      }
      const result = await window.api.launch({
        appName: installation.appName,
        runner: 'sideload'
      })
      if (result.status === 'error') {
        setErrorMsg('Não foi possível iniciar o jogo.')
      }
    } catch {
      setErrorMsg('Falha ao iniciar o jogo.')
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = async () => {
    setBusy(true)
    try {
      await onDismiss(job.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dmFinishedCard dmExternalFinishedCard">
      {/* Background artwork blur */}
      <div className="dmGlassBgContainer">
        <CachedImage
          src={coverUrl}
          fallback={fallbackImage}
          alt=""
          className="dmGlassBgImg"
        />
        <div className="dmGlassOverlay" />
      </div>

      {/* Cover */}
      <div className="dmFinishedCoverWrapper">
        <CachedImage
          src={coverUrl}
          fallback={fallbackImage}
          alt={job.game.title}
          className="dmFinishedCoverImg"
        />
      </div>

      {/* Content */}
      <div className="dmFinishedContent">
        <div className="dmFinishedTopRow">
          <span className="dmFinishedTitle" title={job.game.title}>
            {job.game.title}
          </span>
          <ExternalStoreLogo
            icon={job.game.providerIcon}
            name={job.game.providerName}
            size={36}
          />
        </div>

        <div className="dmFinishedBottomRow">
          <div className="dmFinishedMetaCol">
            <span className="dmFinishedTime">
              {errorMsg ? (
                <span style={{ color: '#ff4d6d' }}>{errorMsg}</span>
              ) : (
                job.game.platform === 'switch' ? 'ROM instalada · Jogar abre o emulador configurado' : 'Instalado com sucesso! · Proteção GhostShield ativa'
              )}
            </span>
            <span className="dmCompletedBadge">Concluído</span>
          </div>

          <div className="dmFinishedActions">
            {/* Link to Source / Updates / Saves */}
            <Link
              to={`/external-games?installation=${job.installationId}`}
              className="dmFinishedExternalLink"
              title="Ver detalhes da fonte, atualizações e backups GhostShield"
            >
              Fonte, updates e saves
            </Link>

            {/* Remove / Dismiss Button */}
            <button
              type="button"
              className="dmNeonCircleBtn dmNeonCancelBtn dmFinishedRemoveBtn"
              onClick={handleDismiss}
              disabled={busy}
              title="Remover do Histórico"
            >
              <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                <line x1="13.5" y1="13.5" x2="24.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="24.5" y1="13.5" x2="13.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Play Button */}
            <button
              type="button"
              className="dmPlayBtn"
              onClick={handlePlay}
              disabled={busy}
              title="Jogar Agora"
            >
              <FontAwesomeIcon icon={faPlay} style={{ marginRight: '6px', fontSize: '11px' }} />
              <span>Jogar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
