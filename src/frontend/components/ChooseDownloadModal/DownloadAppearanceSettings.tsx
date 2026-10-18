import { useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import {
  setDownloadDialogLayout,
  useDownloadDialogLayout,
  type DownloadDialogLayout
} from 'frontend/state/downloadDialogAppearance'
import './appearance.css'

export default function DownloadAppearanceSettings() {
  const layout = useDownloadDialogLayout()
  const group = useId()
  const [error, setError] = useState('')
  function select(value: DownloadDialogLayout) {
    try {
      setDownloadDialogLayout(value)
      setError('')
    } catch {
      setError('Não foi possível salvar o estilo. Tente novamente.')
    }
  }
  return (
    <fieldset className="downloadAppearance">
      <legend>Janela de download</legend>
      <p>
        Escolha o estilo de “Escolha como baixar”. A escolha é salva
        automaticamente.
      </p>
      <div className="downloadAppearanceOptions">
        {(
          [
            ['compact', 'Ghost compacto', 'Capa e informações lado a lado.'],
            ['cover', 'Ghost com capa', 'Capa em destaque na lateral.']
          ] as const
        ).map(([value, name, description]) => (
          <label
            key={value}
            className={`downloadAppearanceOption ${layout === value ? 'is-selected' : ''}`}
          >
            <input
              type="radio"
              name={group}
              value={value}
              checked={layout === value}
              onChange={() => select(value)}
            />
            <span
              className={`downloadAppearanceMini downloadAppearanceMini--${value}`}
              aria-hidden="true"
            >
              <span className="downloadAppearanceMiniHeader" />
              <span className="downloadAppearanceMiniPoster" />
              <span className="downloadAppearanceMiniInfo" />
              <span className="downloadAppearanceMiniChoice" />
              <span className="downloadAppearanceMiniChoice second" />
            </span>
            <span className="downloadAppearanceName">
              {name}
              {layout === value && <FontAwesomeIcon icon={faCheck} />}
            </span>
            <span className="downloadAppearanceDescription">{description}</span>
          </label>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
