export const coverSizeLabels = [
  'Muito pequenas',
  'Pequenas',
  'Médias',
  'Grandes',
  'Muito grandes'
] as const
export const coverSizePages = [
  'all',
  'forYou',
  'anime',
  'series',
  'movie',
  'documentary',
  'cartoon',
  'ova',
  'tv',
  'stremio'
] as const
export type CoverSizePage = (typeof coverSizePages)[number]
export const coverSizesKey = 'ghost_alazterflix_cover_sizes'
export const legacyCoverSizeKey = 'ghost_alazterflix_cover_size'

function isSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < coverSizeLabels.length
  )
}

export function normalizeCoverSizes(saved: unknown, legacy: unknown) {
  const entries =
    saved && typeof saved === 'object' && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {}
  const fallback = isSize(legacy) ? legacy : 2
  return Object.fromEntries(
    coverSizePages.map((page) => [
      page,
      isSize(entries[page]) ? entries[page] : fallback
    ])
  ) as Record<CoverSizePage, number>
}
