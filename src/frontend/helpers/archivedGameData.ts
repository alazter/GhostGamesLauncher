import { GameInfo } from 'common/types'
import { gameOverridesStore } from './electronStores'

export interface ArchivedGameData {
  appName: string
  title: string
  cleanTitle: string
  art_cover?: string
  art_square?: string
  overrides?: {
    title?: string
    art_cover?: string
    art_square?: string
    is_manual?: boolean
  }
  savePath?: string
  archivedAt: number
}

const STORAGE_KEY = 'ghost_archived_game_data'

function normalizeTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Retorna todos os jogos arquivados salvos no localStorage
 */
export function getAllArchivedGames(): Record<string, ArchivedGameData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Salva metadados, capas e saves de um jogo que está sendo removido da biblioteca.
 * Esses dados serão reutilizados automaticamente se o jogo for adicionado novamente no futuro.
 */
export function archiveGameData(
  game: GameInfo,
  overrides?: any,
  savePath?: string
): void {
  try {
    const archives = getAllArchivedGames()
    const appName = game.app_name
    const title = game.title || overrides?.title || appName
    const norm = normalizeTitle(title)

    const curOverrides = overrides || gameOverridesStore.get('overrides', {})[appName] || game.overrides || {}

    const record: ArchivedGameData = {
      appName,
      title,
      cleanTitle: norm,
      art_cover: curOverrides.art_cover || game.art_cover || '',
      art_square: curOverrides.art_square || game.art_square || '',
      overrides: {
        title: curOverrides.title || title,
        art_cover: curOverrides.art_cover || game.art_cover || '',
        art_square: curOverrides.art_square || game.art_square || '',
        is_manual: Boolean(curOverrides.is_manual)
      },
      savePath: savePath || undefined,
      archivedAt: Date.now()
    }

    archives[appName] = record
    if (norm) {
      archives[`title:${norm}`] = record
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(archives))
  } catch (err) {
    console.error('Falha ao arquivar dados do jogo:', err)
  }
}

/**
 * Busca dados arquivados por appName ou pelo título do jogo.
 */
export function getArchivedGameData(query: {
  appName?: string
  title?: string
}): ArchivedGameData | undefined {
  try {
    const archives = getAllArchivedGames()
    if (query.appName && archives[query.appName]) {
      return archives[query.appName]
    }
    if (query.title) {
      const norm = normalizeTitle(query.title)
      if (archives[`title:${norm}`]) {
        return archives[`title:${norm}`]
      }
      // Procura por título aproximado
      for (const key of Object.keys(archives)) {
        if (key.startsWith('title:')) continue
        const item = archives[key]
        if (item && item.cleanTitle && (item.cleanTitle === norm || item.cleanTitle.includes(norm) || norm.includes(item.cleanTitle))) {
          return item
        }
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Remove definitivamente os dados arquivados de um jogo
 */
export function removeArchivedGameData(appName: string, title?: string): void {
  try {
    const archives = getAllArchivedGames()
    delete archives[appName]
    if (title) {
      delete archives[`title:${normalizeTitle(title)}`]
    }
    // Remove qualquer registro que tenha o mesmo appName
    for (const key of Object.keys(archives)) {
      if (archives[key]?.appName === appName) {
        delete archives[key]
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(archives))
  } catch (err) {
    console.error('Falha ao remover dados arquivados:', err)
  }
}

/**
 * Tenta restaurar automaticamente capas e metadados arquivados para um novo jogo que está sendo adicionado
 */
export function tryRestoreArchivedDataForGame(game: Partial<GameInfo>): {
  restored: boolean
  art_cover?: string
  art_square?: string
  title?: string
} {
  try {
    const archived = getArchivedGameData({
      appName: game.app_name,
      title: game.title
    })

    if (!archived) {
      return { restored: false }
    }

    // Restaura overrides em gameOverridesStore
    if (game.app_name && archived.overrides) {
      const overrides = gameOverridesStore.get('overrides', {})
      overrides[game.app_name] = {
        ...overrides[game.app_name],
        ...archived.overrides,
        title: archived.overrides.title || archived.title || game.title,
        art_cover: archived.overrides.art_cover || archived.art_cover || game.art_cover,
        art_square: archived.overrides.art_square || archived.art_square || game.art_square
      }
      gameOverridesStore.set('overrides', overrides)
    }

    return {
      restored: true,
      art_cover: archived.overrides?.art_cover || archived.art_cover,
      art_square: archived.overrides?.art_square || archived.art_square,
      title: archived.overrides?.title || archived.title
    }
  } catch {
    return { restored: false }
  }
}
