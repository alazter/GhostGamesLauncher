import type { GhostMovie } from 'common/types/plugins'

export type CatalogCardStyle = 'classic' | 'caption' | 'clean'
export type CardPreferences = {
  style: CatalogCardStyle
  showTitle: boolean
  titleAlignment: 'left' | 'center' | 'right'
}

export const defaultCardPreferences: CardPreferences = {
  style: 'classic',
  showTitle: true,
  titleAlignment: 'left'
}

export function normalizeCardPreferences(value: unknown): CardPreferences {
  if (!value || typeof value !== 'object') return defaultCardPreferences
  const saved = value as Partial<CardPreferences>
  return {
    style: ['classic', 'caption', 'clean'].includes(saved.style || '')
      ? saved.style!
      : 'classic',
    showTitle: typeof saved.showTitle === 'boolean' ? saved.showTitle : true,
    titleAlignment: ['left', 'center', 'right'].includes(
      saved.titleAlignment || ''
    )
      ? saved.titleAlignment!
      : 'left'
  }
}

/** null clears a rating; undefined represents invalid input. */
export function parseUserRating(input: string): number | null | undefined {
  const normalized = input.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : undefined
}

export function mediaTmdbRating(movie: GhostMovie): string | undefined {
  if (movie.tmdbRating === null) return undefined
  const value =
    movie.tmdbRating ??
    (movie.metadataProvider === 'tmdb' &&
    !movie.metadataLocked &&
    movie.rating?.trim()
      ? Number(movie.rating)
      : undefined)
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10
    ? value.toFixed(1)
    : undefined
}
