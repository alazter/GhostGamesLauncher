import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStore } from '@fortawesome/free-solid-svg-icons'
import type { ExternalGamesState } from 'common/types/plugins'

export function SourceBadge({ name, icon }: { name: string; icon?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [icon])
  return (
    <span className="externalSourceBadge" title={name}>
      {icon?.startsWith('https://') && !failed ? (
        <img src={icon} alt="" onError={() => setFailed(true)} />
      ) : (
        <FontAwesomeIcon icon={faStore} />
      )}
      {name}
    </span>
  )
}

let cachedExternalGamesState: ExternalGamesState = {
  jobs: [],
  installations: [],
  backups: []
}

const stateSubscribers = new Set<(s: ExternalGamesState) => void>()

function broadcastState(next: ExternalGamesState) {
  cachedExternalGamesState = next
  stateSubscribers.forEach((subscriber) => {
    try {
      subscriber(next)
    } catch {}
  })
}

// Prefetch on module load if window.api is ready
if (typeof window !== 'undefined' && window.api?.externalGamesState) {
  window.api
    .externalGamesState()
    .then((s) => {
      if (s) broadcastState(s)
    })
    .catch(() => {})

  window.api.onExternalGamesUpdated((_event, next) => {
    if (next) broadcastState(next)
  })
}

export function useExternalGames() {
  const [state, setState] = useState<ExternalGamesState>(() => cachedExternalGamesState)
  const [error, setError] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await window.api.externalGamesState()
      if (next) {
        broadcastState(next)
        setError('')
      }
    } catch {
      setError('Não foi possível carregar os jogos externos.')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const handleUpdate = (next: ExternalGamesState) => {
      if (mounted) {
        setState(next)
        setError('')
      }
    }
    stateSubscribers.add(handleUpdate)

    // Initial refresh if cache is empty or incomplete
    if (!cachedExternalGamesState.installations.length) {
      void refresh()
    }

    const removeLibrary = window.api.handleRefreshLibrary(() => { void refresh() })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => {
      mounted = false
      stateSubscribers.delete(handleUpdate)
      if (typeof removeLibrary === 'function') removeLibrary()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])
  return { state, error, refresh }
}

export function bytes(value: number) {
  if (!value) return '0 MB'
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(1)} GB`
    : `${(value / 1024 ** 2).toFixed(1)} MB`
}
