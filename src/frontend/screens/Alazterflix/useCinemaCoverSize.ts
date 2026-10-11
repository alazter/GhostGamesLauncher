import { useCallback, useEffect, useState } from 'react'
import { syncLocalStorageToBackend } from 'frontend/utils/localStorageBackup'
import {
  coverSizeLabels,
  coverSizesKey,
  legacyCoverSizeKey,
  normalizeCoverSizes,
  type CoverSizePage
} from './coverSizes'

export { coverSizeLabels } from './coverSizes'

function readSaved(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function loadCoverSizes() {
  return normalizeCoverSizes(
    readSaved(coverSizesKey),
    readSaved(legacyCoverSizeKey)
  )
}

export default function useCinemaCoverSize(page: CoverSizePage) {
  const [sizes, setSizes] = useState(loadCoverSizes)
  useEffect(() => {
    const reload = () => setSizes(loadCoverSizes())
    const handleStorage = (event: StorageEvent) => {
      if ([coverSizesKey, legacyCoverSizeKey, null].includes(event.key))
        reload()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('heroicSettingsChanged', reload)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('heroicSettingsChanged', reload)
    }
  }, [])

  const changeCoverSize = useCallback(
    (size: number) => {
      if (!Number.isInteger(size)) return
      const next = Math.max(0, Math.min(coverSizeLabels.length - 1, size))
      const updated = { ...loadCoverSizes(), [page]: next }
      setSizes(updated)
      try {
        localStorage.setItem(coverSizesKey, JSON.stringify(updated))
        void syncLocalStorageToBackend().catch((error) =>
          console.warn(
            '[Alazterflix] Não foi possível sincronizar o tamanho das capas.',
            error
          )
        )
      } catch (error) {
        console.warn(
          '[Alazterflix] Não foi possível salvar o tamanho das capas.',
          error
        )
      }
    },
    [page]
  )

  return { coverSize: sizes[page], changeCoverSize }
}
