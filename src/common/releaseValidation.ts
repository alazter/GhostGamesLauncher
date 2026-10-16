import type { ReleaseCatalog, ReleaseProduct } from './types/releases'
import { safeReleaseMedia } from './releaseMedia'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 500 &&
  value.every((item) => typeof item === 'string' && item.length <= 4000)
const exact = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function isReleaseProduct(value: unknown): value is ReleaseProduct {
  if (
    !object(value) ||
    typeof value.id !== 'string' ||
    !/^[a-z0-9][a-z0-9._~-]{0,200}$/i.test(value.id) ||
    value.url !== `https://www.releases.com/p/${value.id}` ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > 1000 ||
    typeof value.category !== 'string' ||
    !/^[a-z0-9_-]{1,80}$/.test(value.category) ||
    !['us', 'uk'].includes(String(value.region)) ||
    typeof value.dateLabel !== 'string' ||
    value.dateLabel.length > 500 ||
    !strings(value.platforms) ||
    !strings(value.tags) ||
    !strings(value.images) ||
    !strings(value.videos) ||
    !Array.isArray(value.releases) ||
    value.releases.length > 500
  )
    return false
  if (value.releaseDate !== undefined && !exact(value.releaseDate)) return false
  if (value.calendarOrder !== undefined && !exact(value.calendarOrder))
    return false
  if (
    (value.verifiedAt !== undefined &&
      (typeof value.verifiedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.verifiedAt)))) ||
    (value.stale !== undefined && typeof value.stale !== 'boolean') ||
    (value.warning !== undefined && typeof value.warning !== 'string')
  )
    return false
  if (
    value.description !== undefined &&
    (typeof value.description !== 'string' || value.description.length > 100000)
  )
    return false
  if (value.popularity !== undefined && typeof value.popularity !== 'string')
    return false
  if (
    [value.image, value.heroImage, ...value.images, ...value.videos].some(
      (url) =>
        url !== undefined &&
        (typeof url !== 'string' || safeReleaseMedia(url) !== url)
    )
  )
    return false
  return value.releases.every(
    (row) =>
      object(row) &&
      typeof row.platform === 'string' &&
      !!row.platform.trim() &&
      row.platform.length <= 200 &&
      ['us', 'uk'].includes(String(row.region)) &&
      typeof row.dateLabel === 'string' &&
      !!row.dateLabel.trim() &&
      row.dateLabel.length <= 500 &&
      typeof row.estimated === 'boolean' &&
      (row.calendarOrder === undefined || exact(row.calendarOrder)) &&
      (row.date === undefined ? row.estimated : exact(row.date))
  )
}

/** Reject disappearing fields, but allow explicit postponements and TBA estimates. */
export function releaseUpdateProblem(
  next: ReleaseProduct,
  previous?: ReleaseProduct
): string | undefined {
  if (!isReleaseProduct(next)) return 'A fonte retornou campos inválidos.'
  if (!previous) return undefined
  if (next.id !== previous.id || next.region !== previous.region)
    return 'A identidade ou região do título mudou.'
  const versions = new Set(
    next.releases.map((row) => JSON.stringify([row.platform, row.region]))
  )
  if (
    previous.releases.some(
      (row) =>
        row.region === previous.region &&
        !versions.has(JSON.stringify([row.platform, row.region]))
    )
  )
    return 'A consulta deixou de informar plataformas ou datas já conhecidas.'
  if (
    (previous.description && !next.description) ||
    (previous.image && !next.image) ||
    (previous.images.length && !next.images.length) ||
    (previous.videos.length && !next.videos.length) ||
    (previous.category !== 'all' && next.category === 'all')
  )
    return 'A consulta perdeu informações já conhecidas do título.'
  return undefined
}

export function isReleaseCatalog(value: unknown): value is ReleaseCatalog {
  return (
    object(value) &&
    Array.isArray(value.products) &&
    value.products.length <= 1000 &&
    value.products.every(isReleaseProduct) &&
    Array.isArray(value.filters) &&
    value.filters.every(
      (filter) =>
        object(filter) &&
        typeof filter.id === 'string' &&
        /^[a-z0-9_-]{1,80}$/.test(filter.id) &&
        typeof filter.label === 'string' &&
        Array.isArray(filter.platforms) &&
        filter.platforms.every(
          (platform) =>
            object(platform) &&
            typeof platform.id === 'string' &&
            /^[a-z0-9-]{1,80}$/.test(platform.id) &&
            typeof platform.label === 'string'
        )
    ) &&
    typeof value.fetchedAt === 'string' &&
    Number.isFinite(Date.parse(value.fetchedAt)) &&
    typeof value.sourceUrl === 'string' &&
    value.sourceUrl.startsWith('https://www.releases.com/') &&
    typeof value.hasMore === 'boolean' &&
    typeof value.stale === 'boolean' &&
    (value.nextCursor === undefined ||
      (typeof value.nextCursor === 'string' &&
        value.nextCursor.startsWith(
          '/partial/Releases.Www.PL.Calendar.Group?'
        ))) &&
    (value.previousCursor === undefined ||
      (typeof value.previousCursor === 'string' &&
        value.previousCursor.startsWith(
          '/partial/Releases.Www.PL.Calendar.Group?'
        ))) &&
    (value.warning === undefined || typeof value.warning === 'string')
  )
}

export function catalogUpdateProblem(
  next: ReleaseCatalog,
  previous?: ReleaseCatalog
): string | undefined {
  if (!isReleaseCatalog(next))
    return 'A estrutura do catálogo não pôde ser validada.'
  // Estimated month/quarter rosters naturally shrink as releases acquire real
  // dates or move to another period. They are not a fixed set of confirmed days.
  const stableCount = (catalog: ReleaseCatalog) =>
    catalog.products.filter(
      (product) =>
        !(
          !product.releaseDate &&
          product.calendarOrder &&
          product.releases.length &&
          product.releases.every((row) => row.estimated)
        )
    ).length
  const previousCount = previous ? stableCount(previous) : 0
  if (previousCount && stableCount(next) < previousCount * 0.4)
    return 'A quantidade de títulos caiu de forma inesperada; a atualização foi suspensa.'
  for (const product of next.products) {
    const old = previous?.products.find((item) => item.id === product.id)
    if (old?.releases.length && !product.releases.length)
      return 'O calendário deixou de informar datas conhecidas.'
  }
  return undefined
}
