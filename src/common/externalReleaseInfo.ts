import { parseDateToIso, type GameReleaseCandidate } from './utils'
import type { GhostSearchResult } from './types/plugins'

/** A manually entered release date must be a real calendar date, without a time zone. */
export function isValidReleaseDate(value: string): boolean {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000-')
  )
    return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function installedReleaseCandidate(
  game: GhostSearchResult
): GameReleaseCandidate {
  const sourceDate =
    parseDateToIso(game.sourceDate) || parseDateToIso(game.uploadDate)
  // Old sideload discovery wrote 1.0 even when no release was identified.
  const placeholder =
    (!game.providerId || game.providerId === 'sideload') &&
    !sourceDate &&
    /^v?1\.0(?:\.0)?$/i.test(game.version?.trim() || '')
  return { version: placeholder ? undefined : game.version, sourceDate }
}

export function formatSourceReleaseDate(value?: string): string {
  const iso = parseDateToIso(value)
  if (!iso) return 'Data não registrada'
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year.slice(-2)}`
}
