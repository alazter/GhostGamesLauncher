import { useCallback, useEffect, useState } from 'react'
import { CardPreferences, normalizeCardPreferences } from './cardPreferences'

export const cardPreferencesKey = 'ghost_alazterflix_card_preferences'
const changedEvent = 'ghostCinemaCardPreferencesChanged'

function loadPreferences(): CardPreferences {
  try {
    return normalizeCardPreferences(
      JSON.parse(localStorage.getItem(cardPreferencesKey) || 'null')
    )
  } catch {
    return normalizeCardPreferences(null)
  }
}

export default function useCinemaCardPreferences() {
  const [cardPreferences, setPreferences] = useState(loadPreferences)
  const [saveError, setSaveError] = useState<string | null>(null)
  useEffect(() => {
    const update = () => setPreferences(loadPreferences())
    const storage = (event: StorageEvent) => {
      if (!event.key || event.key === cardPreferencesKey) update()
    }
    window.addEventListener('storage', storage)
    window.addEventListener(changedEvent, update)
    return () => {
      window.removeEventListener('storage', storage)
      window.removeEventListener(changedEvent, update)
    }
  }, [])
  const changeCardPreferences = useCallback(
    (patch: Partial<CardPreferences>) => {
      const next = normalizeCardPreferences({ ...loadPreferences(), ...patch })
      try {
        localStorage.setItem(cardPreferencesKey, JSON.stringify(next))
        setPreferences(next)
        setSaveError(null)
        window.dispatchEvent(new Event(changedEvent))
      } catch {
        setSaveError('Não foi possível salvar a aparência do catálogo.')
      }
    },
    []
  )
  return { cardPreferences, changeCardPreferences, saveError }
}
