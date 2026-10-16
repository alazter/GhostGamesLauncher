import { useEffect, useRef } from 'react'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import type { ReleaseCollector } from 'common/types/releases'
import './collector.css'

export default function ReleaseCollectorPicker(props: {
  value: ReleaseCollector
  onChange: (value: ReleaseCollector) => void
  onManage: () => void
}) {
  const picker = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (picker.current && !picker.current.contains(event.target as Node))
        picker.current.open = false
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && picker.current) picker.current.open = false
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (
    <details ref={picker} className="nr-collector-picker">
      <summary title="Coleta de dados" aria-label="Coleta de dados">
        <Icon icon={faGear} />
      </summary>
      <div className="nr-collector-popup">
        <label htmlFor="nr-collector">Coleta de dados</label>
        <select
          id="nr-collector"
          value={props.value}
          onChange={(event) =>
            props.onChange(event.target.value as ReleaseCollector)
          }
        >
          <option value="electron">Electron (padrão)</option>
          <option value="scrapling">Preferir Scrapling</option>
          <option value="obscura">Preferir Obscura</option>
        </select>
        <p>
          O calendário salvo é consultado primeiro. Se o motor escolhido estiver
          indisponível, o Ghost usa o coletor padrão.
        </p>
        <p>
          Scrapling e Obscura precisam estar instalados e habilitados em
          Plugins. A busca e a seleção regional podem usar o Electron. Se a
          fonte exigir verificação, os dados salvos são preservados.
        </p>
        <button
          onClick={() => {
            if (picker.current) picker.current.open = false
            props.onManage()
          }}
        >
          Gerenciar motores
        </button>
      </div>
    </details>
  )
}
