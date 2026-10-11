import { useId } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { coverSizeLabels } from './useCinemaCoverSize'

interface Props {
  size: number
  onChange: (size: number) => void
}

export default function CatalogCoverSize({ size, onChange }: Props) {
  const id = useId()
  return (
    <div className="catalog-cover-size">
      <label htmlFor={id}>Capas</label>
      <button
        type="button"
        aria-label="Diminuir capas"
        disabled={size === 0}
        onClick={() => onChange(size - 1)}
      >
        <FontAwesomeIcon icon={faMinus} />
      </button>
      <input
        id={id}
        type="range"
        min={0}
        max={coverSizeLabels.length - 1}
        step={1}
        value={size}
        aria-label="Tamanho das capas"
        aria-valuetext={coverSizeLabels[size]}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        type="button"
        aria-label="Aumentar capas"
        disabled={size === coverSizeLabels.length - 1}
        onClick={() => onChange(size + 1)}
      >
        <FontAwesomeIcon icon={faPlus} />
      </button>
      <span className="catalog-cover-size-value">{coverSizeLabels[size]}</span>
    </div>
  )
}
