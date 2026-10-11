import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome'
import {
  faClock,
  faLock,
  faQuestion,
  faRotate,
  faTriangleExclamation,
  faUnlock
} from '@fortawesome/free-solid-svg-icons'
import type { ReleaseProduct } from 'common/types/releases'
import type { ReleaseDrmReport, ReleaseDrmStatus } from 'common/releaseDrm'
import {
  releaseDrmLabels,
  releaseDrmSourceLabels,
  safeDrmSourceUrl,
  isConfirmedDrmReport
} from 'common/releaseDrm'
import {
  requestReleaseDrm as request,
  subscribeReleaseDrm,
  hasSavedDrmConfirmation
} from 'frontend/helpers/releaseDrmRequests'
import './drm.css'

const dateLabel = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR')
    : date
const statusIcon = (status: ReleaseDrmStatus) =>
  status === 'cracked' || status === 'drm-free'
    ? faUnlock
    : status === 'uncracked'
      ? faLock
      : status === 'unreleased' || status === 'early-access'
        ? faClock
        : status === 'bypassed' || status === 'conflicting'
          ? faTriangleExclamation
          : faQuestion

export function ReleaseDrmBadge({
  product,
  onOpen
}: {
  product: ReleaseProduct
  onOpen: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [report, setReport] = useState<ReleaseDrmReport | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let alive = true
    const update = (report: ReleaseDrmReport) => {
      if (alive) setReport(report)
    }
    const unsubscribe = subscribeReleaseDrm(product, update)
    let visible = false
    const load = () => {
      setBusy(true)
      void request({ id: product.id, title: product.title })
        .then((report) => {
          if (alive) setReport(report)
        })
        .catch(() => undefined)
        .finally(() => {
          if (alive) setBusy(false)
        })
    }
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting)
        if (visible) load()
      },
      { root: element.closest('.nr-results'), rootMargin: '80px' }
    )
    observer.observe(element)
    const periodic = setInterval(() => {
      if (visible && !document.hidden && !hasSavedDrmConfirmation(product))
        load()
    }, 15 * 60000)
    return () => {
      alive = false
      observer.disconnect()
      clearInterval(periodic)
      unsubscribe()
    }
  }, [product.id, product.title])
  const status = report?.status || 'unknown'
  const label = `DRM da versão PC: ${busy ? 'Consultando fontes' : releaseDrmLabels[status]}${report?.stale ? ' · consulta anterior' : ''}`
  return (
    <button
      ref={ref}
      className={`nr-drm-badge nr-drm--${status}`}
      aria-label={`${label} · ${product.title}`}
      title={label}
      onClick={onOpen}
    >
      <span>DRM</span>
      <Icon icon={busy ? faRotate : statusIcon(status)} spin={busy} />
    </button>
  )
}

export function ReleaseDrmDetails({ product }: { product: ReleaseProduct }) {
  const [report, setReport] = useState<ReleaseDrmReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    const unsubscribe = subscribeReleaseDrm(product, (report) => {
      if (alive) setReport(report)
    })
    setBusy(true)
    setError('')
    void request({ id: product.id, title: product.title }, revision > 0, true)
      .then((report) => {
        if (alive) setReport(report)
      })
      .catch(() => {
        if (alive) setError('Não foi possível consultar as fontes agora.')
      })
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [product.id, product.title, revision])
  const status = report?.status || 'unknown'
  const primary = report?.sources.find(
    (source) => source.protection || source.crackDate || source.group
  )
  const open = (url: string) => {
    const safe = safeDrmSourceUrl(url)
    if (safe) void window.api.openExternalUrl(safe)
  }
  return (
    <section className="nr-drm-details" aria-label="Status do DRM da versão PC">
      <div className="nr-drm-heading">
        <h3>DRM · versão PC</h3>
        <button
          aria-label="Atualizar status do DRM"
          disabled={busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          <Icon icon={faRotate} spin={busy} />
        </button>
      </div>
      <p className={`nr-drm-summary nr-drm--${status}`}>
        <Icon icon={statusIcon(status)} />{' '}
        {busy && !report
          ? 'Consultando fontes de DRM…'
          : releaseDrmLabels[status]}
      </p>
      {primary &&
        (primary.protection || primary.crackDate || primary.group) && (
          <dl>
            {primary.protection && (
              <>
                <dt>Proteção informada</dt>
                <dd>{primary.protection}</dd>
              </>
            )}
            {primary.crackDate && (
              <>
                <dt>Data da quebra</dt>
                <dd>{dateLabel(primary.crackDate)}</dd>
              </>
            )}
            {primary.group && (
              <>
                <dt>Grupo informado</dt>
                <dd>{primary.group}</dd>
              </>
            )}
          </dl>
        )}
      {report?.sources.map((source, index) => (
        <div className="nr-drm-source" key={source.url + index}>
          <button onClick={() => open(source.url)}>
            {releaseDrmSourceLabels[source.name]}
          </button>
          <span>
            {source.status
              ? releaseDrmLabels[source.status]
              : source.protection
                ? 'Proteção listada'
                : source.availability === 'listed'
                  ? 'Jogo listado na fonte'
                  : 'Sem confirmação nesta consulta'}
          </span>
          {source.title && <small>{source.title}</small>}
          {source.category && <small>{source.category}</small>}
          {source.notice && <small>{source.notice}</small>}
          {source.protection && <small>{source.protection}</small>}
          {(source.crackDate || source.group) && (
            <small>
              {[
                source.crackDate ? dateLabel(source.crackDate) : undefined,
                source.group
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          )}
          {source.observedAt && (
            <small>
              Base consultada em{' '}
              {new Date(source.observedAt).toLocaleString('pt-BR')}
            </small>
          )}
          {source.reportedAt && (
            <small>
              {new Date(source.reportedAt).toLocaleDateString('pt-BR')}
            </small>
          )}
        </div>
      ))}
      {report && (
        <small className="nr-drm-checked">
          {report.stale ? 'Consulta anterior preservada' : 'Consultado em'} ·{' '}
          {new Date(report.checkedAt).toLocaleString('pt-BR')}
        </small>
      )}
      {(error || report?.warning) && (
        <p className="nr-drm-warning">{error || report?.warning}</p>
      )}
      {report && isConfirmedDrmReport(report) && (
        <p className="nr-drm-note">
          Resultado salvo. Consultas automáticas encerradas para este jogo. Use
          Atualizar ou Verificar DRM para consultar novamente.
        </p>
      )}
      {status === 'unknown' && !busy && (
        <p className="nr-drm-note">
          Ausência de confirmação não significa que o jogo foi ou não foi
          quebrado.
        </p>
      )}
      {status === 'bypassed' && (
        <p className="nr-drm-note">
          Bypass relatado é exibido separadamente de uma quebra convencional do
          DRM.
        </p>
      )}
      <p className="nr-drm-note">
        Informações das fontes para PC. O status não se aplica às versões de
        console.
      </p>
    </section>
  )
}
