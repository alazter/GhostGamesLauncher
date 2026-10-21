import { useEffect, useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faFolder,
  faFolderOpen,
  faPlus,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { freeSpaceLabel, installedSizeBytes } from './gameDetailsMetadata'

type Props = {
  paths: string[]
  value: string
  installedDirectory?: string
  installedSize?: string
  busy: boolean
  isPlaying: boolean
  isReplacement: boolean
  actionLabel: string
  actionIcon: IconDefinition
  status?: string
  onChange: (path: string) => void
  onAdd: () => void
  onManage: () => void
  onAction: () => void
}

export default function InstallDestination(props: Props) {
  const id = useId()
  const pathsKey = JSON.stringify([
    ...new Set([...props.paths, props.value].filter(Boolean))
  ])
  const [space, setSpace] = useState<{
    key: string
    values: Record<string, number | undefined>
    loading: boolean
  }>({ key: '', values: {}, loading: true })
  useEffect(() => {
    let current = true
    let request = 0
    const refresh = async () => {
      const generation = ++request
      setSpace({ key: pathsKey, values: {}, loading: true })
      const paths = JSON.parse(pathsKey) as string[]
      const entries = await Promise.all(
        paths.map(async (path) => {
          try {
            const data = await window.api.checkDiskSpace(path)
            return [
              path,
              Number.isFinite(data.free) && data.free >= 0 && data.diskSize > 0
                ? data.free
                : undefined
            ] as const
          } catch {
            return [path, undefined] as const
          }
        })
      )
      if (current && request === generation)
        setSpace({
          key: pathsKey,
          values: Object.fromEntries(entries),
          loading: false
        })
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => {
      current = false
      window.removeEventListener('focus', refresh)
    }
  }, [pathsKey])
  const free = space.key === pathsKey ? space.values[props.value] : undefined
  const loading = space.key !== pathsKey || space.loading
  const required = installedSizeBytes(props.installedSize)
  const insufficient =
    !props.isPlaying &&
    !props.isReplacement &&
    free !== undefined &&
    required !== undefined &&
    free < required
  const paths = JSON.parse(pathsKey) as string[]

  return (
    <>
      <div className="gdpInstallHeading">
        <label htmlFor={id}>Instalar em</label>
        <button
          type="button"
          className="gdpButton gdpTextButton"
          onClick={props.onManage}
        >
          <FontAwesomeIcon icon={faFolderOpen} /> Gerenciar pastas
        </button>
      </div>
      {props.status && (
        <p className="gdpInstallStatus" role="status">
          {props.status}
        </p>
      )}
      <div className="gdpInstallRow">
        <div className={`gdpDestination${insufficient ? ' insufficient' : ''}`}>
          <FontAwesomeIcon icon={faFolder} aria-hidden="true" />
          <select
            id={id}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            aria-describedby={`${id}-free`}
          >
            {paths.map((path) => (
              <option key={path} value={path}>
                {path}
                {path === props.installedDirectory
                  ? ' (Pasta atual do jogo)'
                  : ''}
                {space.values[path] !== undefined && space.key === pathsKey
                  ? ` — ${freeSpaceLabel(space.values[path])}`
                  : ''}
              </option>
            ))}
          </select>
          <span className="gdpFreeSpace" id={`${id}-free`} role="status">
            {loading ? 'Consultando espaço…' : freeSpaceLabel(free)}
          </span>
          <span className="gdpSelectedPath" aria-hidden="true">
            {props.value || 'Selecione uma pasta'}
          </span>
          <FontAwesomeIcon
            className="gdpDestinationChevron"
            icon={faChevronDown}
            aria-hidden="true"
          />
        </div>
        <button
          type="button"
          className={`gdpButton gdpPrimary${props.isPlaying ? ' play' : ''}`}
          onClick={props.onAction}
          disabled={props.busy || insufficient}
          aria-describedby={insufficient ? `${id}-warning` : undefined}
        >
          <FontAwesomeIcon icon={props.actionIcon} />{' '}
          {props.busy ? 'Preparando…' : props.actionLabel}
        </button>
      </div>
      {insufficient && (
        <p className="gdpSpaceWarning" role="alert" id={`${id}-warning`}>
          Espaço insuficiente para o jogo instalado ({props.installedSize}).
          Escolha outra pasta ou libere espaço no disco.
        </p>
      )}
      <div className="gdpInstallFoot">
        <span>
          <FontAwesomeIcon icon={faShieldAlt} /> Instalação automatizada ·
          GhostShield
        </span>
        <button
          type="button"
          className="gdpButton gdpTextButton"
          onClick={props.onAdd}
        >
          <FontAwesomeIcon icon={faPlus} /> Adicionar pasta
        </button>
      </div>
    </>
  )
}
