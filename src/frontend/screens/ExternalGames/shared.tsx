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

export function useExternalGames() {
  const [state, setState] = useState<ExternalGamesState>({
    jobs: [],
    installations: [],
    backups: []
  })
  const [error, setError] = useState('')
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await window.api.externalGamesState()
      setState(next)
      setError('')
    } catch {
      setError('Não foi possível carregar os jogos externos.')
    }
  }, [])
  useEffect(() => {
    let mounted = true
    let receivedEvent = false
    const poll = async () => {
      try {
        const next = await window.api.externalGamesState()
        if (mounted && !receivedEvent) {
          setState(next)
          setError('')
        }
      } catch {
        if (mounted) setError('Não foi possível carregar os jogos externos.')
      }
    }
    const remove = window.api.onExternalGamesUpdated((_event, next) => {
      receivedEvent = true
      setState(next)
      setError('')
    })
    void poll()
    const removeLibrary = window.api.handleRefreshLibrary(() => { void refresh() })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => {
      mounted = false
      remove()
      removeLibrary()
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
