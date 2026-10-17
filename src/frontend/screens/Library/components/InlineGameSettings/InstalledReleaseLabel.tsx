import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPen,
  faCheck,
  faTimes,
  faSpinner
} from '@fortawesome/free-solid-svg-icons'
import {
  formatSourceReleaseDate,
  isValidReleaseDate
} from 'common/externalReleaseInfo'
import { parseDateToIso } from 'common/utils'

interface Props {
  version: string
  sourceDate?: string
  onSaveDate?: (sourceDate: string) => Promise<void>
  disabled?: boolean
}

export default function InstalledReleaseLabel({
  version,
  sourceDate,
  onSaveDate,
  disabled
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const buttonStyle = {
    background: 'rgba(0, 229, 255, 0.08)',
    border: '1px solid rgba(0, 229, 255, 0.35)',
    borderRadius: '8px',
    color: 'inherit',
    padding: '3px 5px',
    fontSize: '10px',
    cursor: 'pointer'
  }
  const cancel = () => {
    if (saving) return
    setEditing(false)
    setError('')
  }
  const save = async () => {
    if (saving || disabled || !onSaveDate) return
    if (!isValidReleaseDate(draft)) {
      setError('Informe uma data válida.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSaveDate(draft)
      setEditing(false)
      setMessage('Data salva. Use Buscar Update para consultar a fonte.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar a data.'
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '3px',
        minWidth: 0
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {version}
      </span>
      {editing ? (
        <span
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <label style={{ fontSize: '10px', letterSpacing: 0 }}>
            LAST UPDATE da release instalada
            <input
              type="date"
              aria-label="Data da release instalada"
              value={draft}
              autoFocus
              required
              disabled={saving || disabled}
              min="0001-01-01"
              max="9999-12-31"
              onChange={(event) => {
                setDraft(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void save()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  cancel()
                }
              }}
              style={{
                display: 'block',
                background: '#101923',
                border: '1px solid #00cbd4',
                borderRadius: '6px',
                color: '#e6ffff',
                colorScheme: 'dark',
                padding: '4px',
                fontSize: '12px'
              }}
            />
          </label>
          <span style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              style={buttonStyle}
              disabled={saving || disabled}
              onClick={() => void save()}
            >
              <FontAwesomeIcon
                icon={saving ? faSpinner : faCheck}
                spin={saving}
              />{' '}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              style={buttonStyle}
              disabled={saving}
              onClick={cancel}
            >
              <FontAwesomeIcon icon={faTimes} /> Cancelar
            </button>
          </span>
        </span>
      ) : onSaveDate ? (
        <button
          type="button"
          disabled={disabled}
          style={{
            ...buttonStyle,
            textAlign: 'left',
            whiteSpace: 'nowrap',
            letterSpacing: 0
          }}
          aria-label={`Editar data da release instalada: ${formatSourceReleaseDate(sourceDate)}`}
          title="Clique para corrigir o LAST UPDATE da release instalada na fonte. O Ghost compara esta data e a versão com o site. Não é a data de instalação no computador."
          onClick={() => {
            setDraft(parseDateToIso(sourceDate) || '')
            setEditing(true)
            setError('')
            setMessage('')
          }}
        >
          LAST UPDATE: {formatSourceReleaseDate(sourceDate)}{' '}
          <FontAwesomeIcon icon={faPen} />
        </button>
      ) : (
        <span
          style={{ fontSize: '10px', letterSpacing: 0, whiteSpace: 'nowrap' }}
          title="Data da release instalada na fonte. Não é a data de instalação no computador."
        >
          LAST UPDATE: {formatSourceReleaseDate(sourceDate)}
        </span>
      )}
      {(error || message) && (
        <span
          role={error ? 'alert' : 'status'}
          style={{
            fontSize: '10px',
            letterSpacing: 0,
            whiteSpace: 'normal',
            maxWidth: '190px',
            color: error ? '#f87171' : 'inherit'
          }}
        >
          {error || message}
        </span>
      )}
    </span>
  )
}
