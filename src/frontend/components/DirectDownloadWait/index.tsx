import { useEffect, useState } from 'react'
import type { ExternalDownloadJob } from 'common/types/plugins'
import { directDownloadWaitMessage } from 'common/externalDownloadStatus'
import './index.css'

export default function DirectDownloadWait({ job }: { job: ExternalDownloadJob }) {
  const [now, setNow] = useState(Date.now)
  const state = job.status === 'downloading' ? job.directWait : undefined
  const deadline = state?.deadline
  useEffect(() => {
    if (deadline === undefined) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deadline])
  const message = directDownloadWaitMessage(job, now)
  if (!message || !state) return null
  return (
    <div className="directDownloadWait" data-phase={state.phase}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="directDownloadWaitCopy">
        <span className="directDownloadWaitTitle">{message.title}</span>
        <span className="directDownloadWaitDetail">{message.detail}</span>
      </div>
      <span className="directDownloadWaitTime" role="timer" aria-live="off" aria-label={message.timerLabel}>{message.time}</span>
    </div>
  )
}
