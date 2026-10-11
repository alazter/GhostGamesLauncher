import type { ReleaseCatalog, ReleaseProduct } from './types/releases'

/** Filter the dated versions too, so another platform's day cannot leak into the calendar. */
export function filterReleasePlatforms(
  products: ReleaseProduct[],
  platforms: string[]
): ReleaseProduct[] {
  if (!platforms.length) return products
  return products.flatMap((product) => {
    const releases = product.releases.filter(
      (row) => row.region === product.region && platforms.includes(row.platform)
    )
    const names = product.platforms.filter((platform) =>
      platforms.includes(platform)
    )
    if (product.releases.length ? !releases.length : !names.length) return []
    return [
      {
        ...product,
        platforms: names,
        releases,
        releaseDate: releases.length
          ? releases[0].estimated
            ? undefined
            : releases[0].date
          : product.releaseDate,
        calendarOrder:
          releases[0]?.calendarOrder ||
          releases[0]?.date ||
          product.calendarOrder,
        dateLabel: releases[0]?.dateLabel || product.dateLabel
      }
    ]
  })
}

/** Preserve all loaded titles and dates; an offline or looping page must not replace them. */
export function appendReleasePage(
  catalog: ReleaseCatalog,
  page: ReleaseCatalog,
  cursor: string,
  direction: 'forward' | 'backward' = 'forward'
): ReleaseCatalog {
  if (page.stale)
    throw new Error(
      page.warning ||
        'Não foi possível atualizar a próxima página. Os títulos carregados foram preservados.'
    )
  if (
    (direction === 'forward' &&
      page.hasMore &&
      (!page.nextCursor || page.nextCursor === cursor)) ||
    (direction === 'backward' && page.previousCursor === cursor)
  )
    throw new Error(
      'A fonte não avançou para a próxima página. Tente novamente.'
    )
  return direction === 'forward'
    ? {
        ...page,
        previousCursor: catalog.previousCursor,
        sourceUrl: catalog.sourceUrl,
        products: mergeReleaseProducts([...catalog.products, ...page.products])
      }
    : {
        ...catalog,
        fetchedAt: page.fetchedAt,
        previousCursor: page.previousCursor,
        products: mergeReleaseProducts([...page.products, ...catalog.products])
      }
}

/** A product can appear on later pages with additional platform release dates. */
export function mergeReleaseProducts(
  products: ReleaseProduct[]
): ReleaseProduct[] {
  const merged = new Map<string, ReleaseProduct>()
  for (const product of products) {
    const previous = merged.get(product.id)
    if (!previous) {
      merged.set(product.id, product)
      continue
    }
    merged.set(product.id, {
      ...previous,
      platforms: [...new Set([...previous.platforms, ...product.platforms])],
      releases: [
        ...new Map(
          [...previous.releases, ...product.releases].map((row) => [
            JSON.stringify([
              row.platform,
              row.region,
              row.date || row.calendarOrder,
              row.dateLabel
            ]),
            row
          ])
        ).values()
      ]
    })
  }
  return [...merged.values()]
}

/** Keep one occurrence per day, including products with staggered platform launches. */
export function releaseCalendarOccurrences(
  product: ReleaseProduct
): ReleaseProduct[] {
  const rows = product.releases.filter((row) => row.region === product.region)
  if (!rows.length) return [product]
  const groups = new Map<string, ReleaseProduct['releases']>()
  for (const row of rows) {
    const key =
      (!row.estimated && row.date) ||
      `${row.calendarOrder || ''}:${row.dateLabel || 'A confirmar'}`
    groups.set(key, [...(groups.get(key) || []), row])
  }
  return [...groups.values()].map((releases) => ({
    ...product,
    releaseDate: releases[0].estimated ? undefined : releases[0].date,
    calendarOrder: releases[0].calendarOrder || releases[0].date,
    dateLabel: releases[0].dateLabel || 'A confirmar',
    platforms: [...new Set(releases.map((row) => row.platform))]
  }))
}

export interface ReleaseCalendarSection {
  key: string
  /** Only confirmed days belong to a named month. Period estimates stay distinct. */
  month?: string
  groups: {
    key: string
    date?: string
    label: string
    products: ReleaseProduct[]
  }[]
}

/** Pick a confirmed day nearest today, preferring the past when equally close. */
export function closestReleaseDate(
  dates: string[],
  today: string
): string | undefined {
  const current = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(current)) return undefined
  let closest: string | undefined
  let distance = Infinity
  for (const date of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== date
    )
      continue
    const difference = Math.abs(timestamp - current)
    if (
      difference < distance ||
      (difference === distance && (!closest || date < closest))
    ) {
      closest = date
      distance = difference
    }
  }
  return closest
}

/** Calendar order includes the full source history; it does not invent dates for estimates. */
export function releaseCalendarSections(
  products: ReleaseProduct[],
  repeatPlatformDates = true
): ReleaseCalendarSection[] {
  const sections = new Map<string, ReleaseCalendarSection>()
  // A calendar has one occurrence per date. Saved follows have one card per
  // title, retaining every monitored platform/date inside that card's data.
  const occurrences = repeatPlatformDates
    ? products.flatMap(releaseCalendarOccurrences)
    : mergeReleaseProducts(products)
  for (const product of occurrences.sort((a, b) =>
    (a.releaseDate || a.calendarOrder || '9999').localeCompare(
      b.releaseDate || b.calendarOrder || '9999'
    )
  )) {
    const month = product.releaseDate?.slice(0, 7)
    const dayKey =
      product.releaseDate ||
      `estimated:${product.calendarOrder || ''}:${product.dateLabel}`
    const key = month || dayKey
    let section = sections.get(key)
    if (!section) {
      section = { key, month, groups: [] }
      sections.set(key, section)
    }
    let group = section.groups.find((value) => value.key === dayKey)
    if (!group) {
      group = {
        key: dayKey,
        date: product.releaseDate,
        label: product.dateLabel,
        products: []
      }
      section.groups.push(group)
    }
    group.products.push(product)
  }
  return [...sections.values()]
}
