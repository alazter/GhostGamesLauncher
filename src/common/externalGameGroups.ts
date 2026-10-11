import { externalTitleKey as cleanTitle, externalTitleGroupKey } from './externalTitle'
import { isNewerGameRelease } from './utils'
import type { GhostSearchResult } from './types/plugins'

export function getCanonicalGameTitle(title: string): string {
  return title
    .replace(/[\[\(].*?[\]\)]/g, ' ')
    .replace(/\b(?:ofme|rune|tenoke|codex|skidrow|flt|reloaded|hoodlum|empress|cpy|elamigos|fitgirl|dodi|goldberg|clean steam files|own csf)\b/gi, ' ')
    .replace(/\b(?:build\s*)?\d{5,}\b/gi, ' ')
    .replace(/\b(?:v|ver|version)?\s*\d+(?:\.\d+)+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface GroupedGameResult {
  key: string
  canonicalTitle: string
  mainGame: GhostSearchResult
  allSources: GhostSearchResult[]
  platform: 'windows' | 'switch'
  coverUrl?: string
  size?: string
  installedSize?: string
  releaseDate?: string
  description?: string
  youtubeVideoId?: string
}

export function groupGamesByTitle(games: GhostSearchResult[]): GroupedGameResult[] {
  const groups = new Map<string, GroupedGameResult>()

  for (const game of games) {
    const key = cleanTitle(game.title)
    if (!key) continue

    const groupKey = externalTitleGroupKey(game.title, game.platform || 'windows')
    const existing = groups.get(groupKey)

    if (!existing) {
      groups.set(groupKey, {
        key: groupKey,
        canonicalTitle: getCanonicalGameTitle(game.title),
        mainGame: game,
        allSources: [game],
        platform: game.platform || 'windows',
        coverUrl: game.coverUrl,
        size: game.size,
        installedSize: game.installedSize,
        releaseDate: game.releaseDate,
        description: game.description
      })
    } else {
      if (
        !existing.allSources.some(
          (s) => s.id === game.id && s.providerId === game.providerId
        )
      ) {
        existing.allSources.push(game)
      }
      if (!existing.coverUrl && game.coverUrl) {
        existing.coverUrl = game.coverUrl
      }
      if (!existing.size && game.size) {
        existing.size = game.size
      }
      if (!existing.installedSize && game.installedSize) {
        existing.installedSize = game.installedSize
      }
      if (!existing.releaseDate && game.releaseDate) {
        existing.releaseDate = game.releaseDate
      }
      if (!existing.description && game.description) {
        existing.description = game.description
      }
      const comp = isNewerGameRelease(existing.mainGame, game)
      if (game.version && (!existing.mainGame.version || comp.isNewer)) {
        existing.mainGame = {
          ...game,
          coverUrl: existing.coverUrl || game.coverUrl,
          description: existing.description || game.description
        }
      }
      if (game.title.length > existing.mainGame.title.length && !existing.canonicalTitle.includes(':')) {
        existing.canonicalTitle = getCanonicalGameTitle(game.title)
      }
    }
  }

  // Promise completion order must not decide which platform opens first.
  return Array.from(groups.values()).sort((a, b) =>
    Number(a.platform === 'switch') - Number(b.platform === 'switch'))
}

