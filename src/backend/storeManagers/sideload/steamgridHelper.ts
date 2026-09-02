import { GlobalConfig } from 'backend/config'
import * as SteamGridDB from 'backend/steamgrid/utils'
import { decryptApiKey, isEncryptedValue } from 'backend/steamgrid/secureKey'
import { logInfo, logError, LogPrefix } from 'backend/logger'

export function getApiKey(): string {
  const stored = GlobalConfig.get().getSettings().steamGridDbApiKey || ''
  if (!stored) return ''
  if (!isEncryptedValue(stored)) return stored
  try {
    return decryptApiKey(stored)
  } catch {
    return ''
  }
}

const failedSearchCache = new Set<string>()
const successfulSearchCache = new Map<string, { art_cover: string; art_square: string }>()

export function clearSteamGridCache() {
  failedSearchCache.clear()
  successfulSearchCache.clear()
}

export async function fetchCoverFromSteamGridDB(
  apiKey: string,
  title: string,
  steamAppId?: string
): Promise<{ art_cover: string; art_square: string } | null> {
  const normalizedKey = (steamAppId ? `steam_${steamAppId}_` : '') + title.trim().toLowerCase()
  if (failedSearchCache.has(normalizedKey)) {
    return null
  }
  if (successfulSearchCache.has(normalizedKey)) {
    return successfulSearchCache.get(normalizedKey)!
  }

  const selectBestGrid = (grids: any[]): string | null => {
    if (!grids || grids.length === 0) return null
    const nonBlurred = grids.filter((g) => g.style !== 'blurred')
    if (nonBlurred.length > 0) {
      return nonBlurred[0].url
    }
    return grids[0].url
  }

  // 1. If it's a Steam game, query directly by official Steam AppID (100% precision)
  if (steamAppId) {
    try {
      const grids = await SteamGridDB.getGridsBySteamAppId(apiKey, steamAppId)
      const bestUrl = selectBestGrid(grids)
      if (bestUrl) {
        const res = {
          art_cover: bestUrl,
          art_square: bestUrl
        }
        successfulSearchCache.set(normalizedKey, res)
        return res
      }
    } catch (err) {
      logError([`SteamGridDB fetch by steamAppId ${steamAppId} failed:`, err], LogPrefix.Backend)
    }
  }

  const cleanTitle = (t: string) => {
    return t
      .replace(/[®™©]/g, '') // Remove logos de registro/marca
      .replace(/\s*(?:-|:)\s*(?:game of the year|goty|complete|definitive|special|deluxe|standard|gold|ultimate|collector'?s)\s*edition/gi, '') // Remove sufixos de edições
      .replace(/\s+\(\d{4}\)/g, '') // Remove anos como (2020)
      .replace(/\s+-\s+repack/gi, '') // Remove sufixo repack
      .replace(/\s*(?:playtest|public testing|test server|closed beta|open beta|beta|alpha|pre-alpha|preview|samples|map editor|dedicated server|soundtrack|artbook)\b/gi, '') // Remove sufixos de playtests, previews e utilitários
      .replace(/\s*\([^)]*\)/g, '') // Remove parenteses (ex: (Public Testing))
      .trim()
  }

  const trySearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) return null
    try {
      const searchResults = await SteamGridDB.searchGame(apiKey, searchQuery)
      if (searchResults && searchResults.length > 0) {
        const lowerSearch = searchQuery.toLowerCase()
        const matched =
          searchResults.find((g) => g.name?.toLowerCase() === lowerSearch) ||
          searchResults[0]
        const gameId = matched.id

        const grids = await SteamGridDB.getGrids(apiKey, {
          gameId,
          dimensions: ['600x900', '342x482', '660x930'],
          styles: ['alternate', 'white_logo', 'material', 'no_logo']
        })
        const bestUrl = selectBestGrid(grids)
        if (bestUrl) {
          return {
            art_cover: bestUrl,
            art_square: bestUrl
          }
        }
      }
    } catch (err: any) {
      const apiError = err.response?.data?.errors?.join(', ') || err.message
      logError([`SteamGridDB search or grid fetch failed for query "${searchQuery}":`, apiError], LogPrefix.Backend)
    }
    return null
  }

  // 1. Tenta com o título original
  let result = await trySearch(title)
  if (result) {
    successfulSearchCache.set(normalizedKey, result)
    return result
  }

  // 2. Tenta com o título limpo (sem playtest, demo, pre-alpha, etc.)
  const cleaned = cleanTitle(title)
  if (cleaned && cleaned !== title) {
    result = await trySearch(cleaned)
    if (result) {
      successfulSearchCache.set(normalizedKey, result)
      return result
    }
  }

  // 3. Tenta prefixo antes de ':' ou ' - ' (ex: Agatha Christie: ABC Murders -> Agatha Christie)
  if (title.includes(':')) {
    const prefix = cleanTitle(title.split(':')[0])
    if (prefix && prefix !== cleaned && prefix !== title) {
      result = await trySearch(prefix)
      if (result) {
        successfulSearchCache.set(normalizedKey, result)
        return result
      }
    }
  }

  if (title.includes(' - ')) {
    const prefix = cleanTitle(title.split(' - ')[0])
    if (prefix && prefix !== cleaned && prefix !== title) {
      result = await trySearch(prefix)
      if (result) {
        successfulSearchCache.set(normalizedKey, result)
        return result
      }
    }
  }

  failedSearchCache.add(normalizedKey)
  return null
}
