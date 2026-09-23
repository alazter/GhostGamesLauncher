import type { GhostSearchResult } from 'common/types/plugins'
import { libraryStore } from 'backend/storeManagers/sideload/electronStores'
import { gameOverridesStore } from 'backend/game_overrides/electronStores'
import { sendFrontendMessage } from 'backend/ipc'

/** Installed provenance is authoritative; preserve unrelated custom metadata. */
export function synchronizeExternalVersion(appName: string, version?: string) {
  const games = libraryStore.get('games', [])
  const game = games.find(
    (item) => item.app_name === appName && item.runner === 'sideload'
  )
  if (!game) return
  if (game.version !== version) {
    libraryStore.set(
      'games',
      games.map((item) => (item === game ? { ...item, version } : item))
    )
  }
  const overrides = gameOverridesStore.get('overrides', {}) || {}
  const override = overrides[appName]
  if (override?.version !== undefined && override.version !== version) {
    const { version: _staleVersion, ...metadata } = override
    const updated = { ...overrides, [appName]: metadata }
    gameOverridesStore.set('overrides', updated)
    sendFrontendMessage('metadataChanged', updated)
  }
}

export async function refreshExternalRelease(
  cached: GhostSearchResult,
  getDetails: (id: string) => Promise<GhostSearchResult>
): Promise<GhostSearchResult> {
  const latest = await getDetails(cached.id)
  if (
    latest.id !== cached.id ||
    latest.platform !== cached.platform ||
    latest.edition !== cached.edition
  )
    throw new Error(
      'A edição da fonte mudou. Busque o jogo novamente antes de baixar.'
    )
  return { ...cached, ...latest, version: latest.version }
}
