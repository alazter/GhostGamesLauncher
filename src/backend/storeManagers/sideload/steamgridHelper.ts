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

  // 1. If it's a Steam game, query directly by official Steam AppID (100% precision)
  if (steamAppId) {
    try {
      const grids = await SteamGridDB.getGridsBySteamAppId(apiKey, steamAppId)
      if (grids && grids.length > 0) {
        const res = {
          art_cover: grids[0].url,
          art_square: grids[0].url
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
      .trim()
  }

  const trySearch = async (searchQuery: string) => {
    try {
      const searchResults = await SteamGridDB.searchGame(apiKey, searchQuery)
      if (searchResults && searchResults.length > 0) {
        const gameId = searchResults[0].id
        // Busca com as dimensões verticais padrão sem restringir estilos
        const grids = await SteamGridDB.getGrids(apiKey, {
          gameId,
          dimensions: ['600x900', '342x482', '660x930']
        })
        if (grids && grids.length > 0) {
          return {
            art_cover: grids[0].url,
            art_square: grids[0].url
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

  // 2. Se falhar, tenta com o título limpo
  const cleaned = cleanTitle(title)
  if (cleaned !== title) {
    result = await trySearch(cleaned)
    if (result) {
      successfulSearchCache.set(normalizedKey, result)
      return result
    }
  }

  failedSearchCache.add(normalizedKey)
  return null
}
