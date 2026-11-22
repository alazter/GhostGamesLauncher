import { GameInfo } from 'common/types'
import { gameOverridesStore, GameMetadataOverride } from './electronStores'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { appFolder, userDataPath } from 'backend/constants/paths'
import { existsSync, readdirSync, unlinkSync } from 'graceful-fs'
import { join } from 'node:path'

const logPrefix: LogPrefix = 'GameOverrides'

const overridesImagesDir = join(userDataPath, 'game_overrides_images')
const customCoversDir = join(appFolder, 'custom-covers')

const removeImagesMatching = (dir: string, predicate: (file: string) => boolean) => {
  if (!existsSync(dir)) return
  for (const file of readdirSync(dir)) {
    if (!predicate(file)) continue
    try {
      unlinkSync(join(dir, file))
    } catch (error) {
      logError(
        `Failed to delete override image ${file}: ${String(error)}`,
        logPrefix
      )
    }
  }
}

const removeImagesForApp = (appName: string) => {
  removeImagesMatching(overridesImagesDir, (file) => file.startsWith(`${appName}-`))
  removeImagesMatching(customCoversDir, (file) => file.startsWith(`${appName}_`))
}

let overridesMemoryCache: Record<string, GameMetadataOverride> | null = null

/**
 * Get stored overrides for a specific game
 */
export function getGameOverrides(appName: string): GameMetadataOverride | null {
  try {
    const overrides = getAllGameOverrides()
    return overrides[appName] || null
  } catch {
    logError(`Failed to get overrides for ${appName}`, logPrefix)
    return null
  }
}

/**
 * Get all stored overrides
 */
export function getAllGameOverrides(): Record<string, GameMetadataOverride> {
  if (overridesMemoryCache !== null) {
    return overridesMemoryCache
  }
  try {
    overridesMemoryCache = gameOverridesStore.get('overrides', {}) as Record<
      string,
      GameMetadataOverride
    >
    return overridesMemoryCache
  } catch {
    logError('Failed to get all overrides', logPrefix)
    return {}
  }
}

/**
 * Save custom overrides for a game
 */
export function setGameOverrides(
  appName: string,
  override: GameMetadataOverride
): boolean {
  try {
    const currentOverrides = {
      ...getAllGameOverrides()
    }

    if (!override.art_cover && !override.art_square && !override.art_background) {
      removeImagesForApp(appName)
    }

    // If override is empty, remove it and drop any stored image files.
    if (!override.title && !override.art_cover && !override.art_square && !override.art_background && !override.version) {
      delete currentOverrides[appName]
    } else {
      currentOverrides[appName] = {
        ...override,
        is_manual: override.is_manual ?? true
      }
    }

    overridesMemoryCache = { ...currentOverrides }
    gameOverridesStore.set('overrides', currentOverrides)
    logInfo(`Saved overrides for ${appName}`, logPrefix)
    return true
  } catch {
    logError(`Failed to save overrides for ${appName}`, logPrefix)
    return false
  }
}

/**
 * Attach stored overrides to a GameInfo object as the `overrides` property.
 * Original fields (title, art_cover, art_square) are left untouched so callers
 * can choose between the canonical value and the user-edited one.
 */
export function attachOverrides(gameInfo: GameInfo): GameInfo {
  const overrides = getGameOverrides(gameInfo.app_name)
  if (!overrides) {
    return gameInfo
  }
  return { ...gameInfo, overrides }
}

/**
 * Save all game overrides at once (bulk update)
 */
export function setAllGameOverrides(overrides: Record<string, GameMetadataOverride>): boolean {
  try {
    const previousOverrides = getAllGameOverrides()

    // Find apps that had overrides but now either don't, or have empty cover fields
    for (const appName of Object.keys(previousOverrides)) {
      const prev = previousOverrides[appName]
      const next = overrides[appName]
      if (
        (prev.art_cover || prev.art_square || prev.art_background) &&
        (!next || (!next.art_cover && !next.art_square && !next.art_background))
      ) {
        removeImagesForApp(appName)
      }
    }

    overridesMemoryCache = { ...overrides }
    gameOverridesStore.set('overrides', overrides)
    logInfo('Saved all overrides', logPrefix)
    return true
  } catch {
    logError('Failed to save all overrides', logPrefix)
    return false
  }
}
