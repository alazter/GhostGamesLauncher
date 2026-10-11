import { useCallback, useEffect, useState } from 'react'

const storageKey = 'ghost_alazterflix_favorites'

function loadFavorites(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
    return Array.isArray(saved)
      ? saved.filter((value): value is string => typeof value === 'string')
      : []
  } catch (error) {
    console.warn(
      '[Alazterflix] Não foi possível carregar a lista de favoritos.',
      error
    )
    return []
  }
}

export default function useCinemaFavorites() {
  const [favorites, setFavorites] = useState(loadFavorites)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setFavorites(loadFavorites())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    const current = loadFavorites()
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setFavorites(next)
    } catch (error) {
      console.warn(
        '[Alazterflix] Não foi possível salvar a lista de favoritos.',
        error
      )
    }
  }, [])

  return { favorites, toggleFavorite }
}
