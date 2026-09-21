import React, { useState } from 'react'
import type { ExternalDownloadJob } from 'common/types/plugins'
import ExternalStoreLogo from '../ExternalStoreLogo'
import { useExternalGameCover } from '../../hooks/useExternalGameCover'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import CachedImage from 'frontend/components/UI/CachedImage'
import '../DownloadManagerItem/index.css'

interface ExternalQueueCardProps {
  job: ExternalDownloadJob
  onCancel: (jobId: string) => Promise<void>
}

export default function ExternalQueueCard({
  job,
  onCancel
}: ExternalQueueCardProps) {
  const [busy, setBusy] = useState(false)

  const { coverUrl } = useExternalGameCover(
    job.game.title,
    job.game.coverUrl,
    job.old?.appName
  )

  const handleCancel = async () => {
    setBusy(true)
    try {
      await onCancel(job.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dmQueueCard dmExternalQueueCard">
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

      <div className="dmQueueLeft">
        <div className="dmQueueCoverWrapper">
          <CachedImage
            src={coverUrl}
            fallback={fallbackImage}
            alt={job.game.title}
            className="dmQueueCoverImg"
          />
        </div>
        <div className="dmQueueContent">
          <span className="dmQueueTitle" title={job.game.title}>
            {job.game.title}
          </span>
          <span className="dmQueueStatus">
            Na fila · Fonte: {job.game.providerName}
          </span>
        </div>
      </div>

      <div className="dmQueueRight">
        <ExternalStoreLogo
          icon={job.game.providerIcon}
          name={job.game.providerName}
          size={30}
        />
        <button
          type="button"
          className="dmNeonCircleBtn dmNeonCancelBtn"
          onClick={handleCancel}
          disabled={busy}
          title="Remover da Fila"
        >
          <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
            <circle cx="19" cy="19" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <line x1="13.5" y1="13.5" x2="24.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="24.5" y1="13.5" x2="13.5" y2="24.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
