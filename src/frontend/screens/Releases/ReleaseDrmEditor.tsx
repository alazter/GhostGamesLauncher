import { useEffect, useRef, useState } from 'react'
import {
  manualDrmStatuses,
  displayedDrmStatus,
  releaseDrmLabels,
  type ManualDrmStatus,
  type ReleaseDrmReport
} from 'common/releaseDrm'
import { setManualReleaseDrm } from 'frontend/helpers/releaseDrmRequests'

export function ReleaseDrmEditor({
  game,
  report
}: {
  game: { id: string; title: string }
  report: ReleaseDrmReport | null
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ManualDrmStatus>('unknown')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const save = async (status: ManualDrmStatus | null) => {
    setSaving(true)
    setError('')
    try {
      await setManualReleaseDrm(game, status)
      if (alive.current) setEditing(false)
    } catch {
      if (alive.current)
        setError('Não foi possível salvar o status de DRM. Tente novamente.')
    } finally {
      if (alive.current) setSaving(false)
    }
  }
  return (
    <div className="nr-drm-editor">
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save(draft)
          }}
        >
          <label>
            Status manual do DRM
            <select
              value={draft}
              disabled={saving}
              onChange={(event) =>
                setDraft(event.target.value as ManualDrmStatus)
              }
            >
              {manualDrmStatuses.map((status) => (
                <option key={status} value={status}>
                  {releaseDrmLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <p className="nr-drm-note">
            Sua escolha permanece ativa até você voltar ao automático. As fontes
            continuam disponíveis abaixo.
          </p>
          <div className="nr-drm-editor-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar status'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false)
                setError('')
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const status = displayedDrmStatus(report)
            setDraft(status === 'conflicting' ? 'unknown' : status)
            setEditing(true)
            setError('')
          }}
        >
          Editar status
        </button>
      )}
      {report?.manualOverride && (
        <button type="button" disabled={saving} onClick={() => void save(null)}>
          Voltar ao automático
        </button>
      )}
      {error && (
        <p className="nr-drm-warning" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
