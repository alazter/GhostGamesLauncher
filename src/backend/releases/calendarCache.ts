import { createHash } from 'crypto'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import { setTimeout as delay } from 'timers/promises'
import type {
  ReleaseCatalog,
  ReleaseProduct,
  ReleaseQuery
} from 'common/types/releases'
import { isReleaseCatalog } from 'common/releaseValidation'
import { mergeReleaseProducts } from 'common/releaseCatalog'

export interface CalendarSnapshot {
  at: number
  value: ReleaseCatalog
}

export function calendarDay(date = new Date(Date.now())): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function exactDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function calendarTarget(
  query: ReleaseQuery,
  today = calendarDay()
): { year: number; day?: string } | undefined {
  if (query.search || query.view === 'hot') return undefined
  if (query.cursor) {
    const code =
      new URL(query.cursor, 'https://www.releases.com').searchParams.get(
        'Code'
      ) || ''
    const year = code.match(/^Y(\d{4})(?:-|$)/)?.[1]
    if (!year) return undefined
    const match = code.match(/^Y(\d{4})-M(\d{1,2})-D(\d{1,2})$/)
    const day = match
      ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
      : undefined
    return { year: Number(year), day: day && exactDay(day) ? day : undefined }
  }
  const day = query.date || today
  return exactDay(day) ? { year: Number(day.slice(0, 4)), day } : undefined
}

export function annualCalendarYear(
  query: ReleaseQuery,
  today = calendarDay()
): number | undefined {
  const year = calendarTarget(query, today)?.year
  return year === Number(today.slice(0, 4)) ? year : undefined
}

/** Use source filters, including cursor filters, rather than trusting a second copy from the renderer. */
export function calendarScope(query: ReleaseQuery, sourceUrl: string): string {
  const url = new URL(sourceUrl)
  const category = query.cursor
    ? url.searchParams.get('Category') || 'all'
    : url.pathname.split('/')[2] || 'all'
  const filters = [
    ...new Set([
      ...url.searchParams.getAll('f'),
      ...url.searchParams.getAll('F')
    ])
  ].sort()
  return JSON.stringify([category, filters, query.region || 'us'])
}

function confirmedPast(product: ReleaseProduct, today: string): boolean {
  return (
    !!product.releaseDate &&
    product.releaseDate.startsWith(today.slice(0, 4)) &&
    product.releaseDate < today &&
    product.releases.length > 0 &&
    product.releases.every(
      (row) =>
        !row.estimated &&
        !!row.date &&
        row.date.startsWith(today.slice(0, 4)) &&
        row.date < today
    )
  )
}

export function historicalCalendarPage(
  value: ReleaseCatalog,
  query: ReleaseQuery,
  today = calendarDay()
): boolean {
  const target = calendarTarget(query, today)
  return (
    annualCalendarYear(query, today) !== undefined &&
    !!target?.day &&
    target.day < today &&
    !value.stale &&
    value.products.length > 0 &&
    value.products.every((product) => confirmedPast(product, today))
  )
}

export function frozenCalendarPage(
  snapshot: CalendarSnapshot,
  query: ReleaseQuery,
  today = calendarDay()
): boolean {
  if (!historicalCalendarPage(snapshot.value, query, today)) return false
  const captured = calendarDay(new Date(snapshot.at))
  const target = calendarTarget(query, today)!.day!
  // A pre-release or release-day snapshot needs one final check after that day ends.
  return (
    captured > target &&
    snapshot.value.products.every((product) =>
      product.releases.every((row) => !!row.date && row.date < captured)
    )
  )
}

/** Refresh mutable rows while keeping already finalized days in a mixed page intact. */
export function mergeFrozenCalendar(
  previous: CalendarSnapshot | undefined,
  next: ReleaseCatalog,
  today = calendarDay()
): ReleaseCatalog {
  if (!previous || previous.value.stale) return next
  const captured = calendarDay(new Date(previous.at))
  const frozen = previous.value.products.flatMap((product) => {
    const releases = product.releases.filter(
      (row) =>
        !row.estimated &&
        !!row.date &&
        row.date.startsWith(today.slice(0, 4)) &&
        row.date < today &&
        row.date < captured
    )
    return releases.length
      ? [
          {
            ...product,
            releases,
            releaseDate: releases[0].date,
            calendarOrder: releases[0].date,
            dateLabel: releases[0].dateLabel,
            platforms: [...new Set(releases.map((row) => row.platform))]
          }
        ]
      : []
  })
  const covered = new Set(
    frozen.flatMap((product) => product.releases.map((row) => row.date))
  )
  if (!covered.size) return next
  const mutable = next.products.flatMap((product) => {
    if (!product.releases.length)
      return covered.has(product.releaseDate) ? [] : [product]
    const releases = product.releases.filter(
      (row) => row.estimated || !covered.has(row.date)
    )
    return releases.length
      ? [
          {
            ...product,
            releases,
            releaseDate: releases[0].estimated ? undefined : releases[0].date,
            calendarOrder: releases[0].calendarOrder || releases[0].date,
            dateLabel: releases[0].dateLabel,
            platforms: [...new Set(releases.map((row) => row.platform))]
          }
        ]
      : []
  })
  return { ...next, products: mergeReleaseProducts([...frozen, ...mutable]) }
}

function dayCursor(
  template: string | undefined,
  day: string,
  direction: 'Backward' | 'Forward'
): string | undefined {
  if (!template) return undefined
  const url = new URL(template, 'https://www.releases.com')
  if (
    url.origin !== 'https://www.releases.com' ||
    url.pathname !== '/partial/Releases.Www.PL.Calendar.Group'
  )
    return undefined
  const [year, month, date] = day.split('-')
  url.searchParams.set('Code', `Y${year}-M${Number(month)}-D${Number(date)}`)
  url.searchParams.set('Direction', direction)
  return url.pathname + url.search
}

interface StoredCalendar extends CalendarSnapshot {
  version: 1
  key: string
  year: number
}
const MAX_PAGE_SIZE = 8 * 1024 * 1024

/** Retry transient Windows file locks without deleting the last good snapshot. */
export async function replaceCalendarFile(
  source: string,
  target: string
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(source, target)
      return
    } catch (error) {
      if (
        attempt >= 4 ||
        !['EPERM', 'EBUSY', 'EACCES'].includes(
          (error as NodeJS.ErrnoException).code || ''
        )
      )
        throw error
      await delay(25 * 2 ** attempt)
    }
  }
}

/** Separate files keep the current year out of the legacy 120-record LRU. */
export class CalendarYearCache {
  private pending: Promise<unknown> = Promise.resolve()
  constructor(private directory: string) {}

  private file(
    year: number,
    key: string
  ): { directory: string; hash: string; path: string } {
    if (!Number.isInteger(year) || year < 1000 || year > 9999)
      throw new Error('Ano do calendário inválido.')
    const hash = createHash('sha256').update(key).digest('hex')
    const directory = join(this.directory, 'calendar', String(year))
    return { directory, hash, path: join(directory, hash) }
  }

  async get(year: number, key: string): Promise<CalendarSnapshot | undefined> {
    await this.pending.catch(() => undefined)
    return this.read(year, key)
  }

  private async read(
    year: number,
    key: string
  ): Promise<CalendarSnapshot | undefined> {
    const file = this.file(year, key)
    for (const suffix of ['.json', '.previous.json']) {
      try {
        const raw = await readFile(file.path + suffix, 'utf8')
        if (raw.length > MAX_PAGE_SIZE) continue
        const saved = JSON.parse(raw) as StoredCalendar
        if (
          saved.version === 1 &&
          saved.year === year &&
          saved.key === file.hash &&
          Number.isFinite(saved.at) &&
          saved.at > 0 &&
          isReleaseCatalog(saved.value) &&
          !saved.value.stale
        )
          return { at: saved.at, value: saved.value }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          console.warn(
            '[Releases] Cópia anual inválida; tentando recuperar o calendário.',
            error
          )
      }
    }
    return undefined
  }

  put(year: number, key: string, snapshot: CalendarSnapshot): Promise<void> {
    const file = this.file(year, key)
    if (
      !isReleaseCatalog(snapshot.value) ||
      snapshot.value.stale ||
      !Number.isFinite(snapshot.at) ||
      snapshot.at <= 0
    )
      return Promise.reject(
        new Error(
          'Somente calendários validados podem entrar no arquivo anual.'
        )
      )
    const data = JSON.stringify({
      ...snapshot,
      version: 1,
      year,
      key: file.hash
    })
    if (data.length > MAX_PAGE_SIZE)
      return Promise.reject(
        new Error('A página excedeu o limite do arquivo anual.')
      )
    const operation = this.pending
      .catch(() => undefined)
      .then(async () => {
        await mkdir(file.directory, { recursive: true })
        const previous = await this.read(year, key)
        if (previous) {
          await writeFile(
            file.path + '.previous.tmp',
            JSON.stringify({ ...previous, version: 1, year, key: file.hash }),
            'utf8'
          )
          await replaceCalendarFile(
            file.path + '.previous.tmp',
            file.path + '.previous.json'
          )
        }
        await writeFile(file.path + '.tmp', data, 'utf8')
        await replaceCalendarFile(file.path + '.tmp', file.path + '.json')
      })
    this.pending = operation.catch(() => undefined)
    return operation
  }

  async save(
    year: number,
    key: string,
    query: ReleaseQuery,
    snapshot: CalendarSnapshot
  ): Promise<void> {
    await this.put(year, `page:${key}`, snapshot)
    const value = snapshot.value
    // Only complete, confirmed source groups can supply another query's day.
    if (
      !value.products.length ||
      value.products.some(
        (product) =>
          !product.releaseDate ||
          !product.releases.length ||
          product.releases.some((row) => row.estimated || !row.date)
      )
    )
      return
    const days = [
      ...new Set(
        value.products.flatMap((product) =>
          product.releases.map((row) => row.date!)
        )
      )
    ].sort()
    const template = value.previousCursor || value.nextCursor
    if (!template && days.length > 1) return
    const scope = calendarScope(query, value.sourceUrl)
    for (const [index, day] of days.entries()) {
      if (!day.startsWith(String(year))) continue
      const dayKey = `day:${scope}:${day}`
      const previous = await this.get(year, dayKey)
      const dayQuery = { ...query, cursor: undefined, date: day }
      if (previous && frozenCalendarPage(previous, dayQuery)) continue
      const products = value.products.flatMap((product) => {
        const releases = product.releases.filter((row) => row.date === day)
        return releases.length
          ? [
              {
                ...product,
                releases,
                releaseDate: day,
                calendarOrder: day,
                dateLabel: releases[0].dateLabel,
                platforms: [...new Set(releases.map((row) => row.platform))]
              }
            ]
          : []
      })
      const previousCursor = index
        ? dayCursor(template, days[index - 1], 'Backward')
        : value.previousCursor
      const nextCursor =
        index < days.length - 1
          ? dayCursor(template, days[index + 1], 'Forward')
          : value.nextCursor
      await this.put(year, dayKey, {
        at: snapshot.at,
        value: {
          ...value,
          products,
          previousCursor,
          nextCursor,
          hasMore: !!nextCursor
        }
      })
    }
  }

  async page(
    year: number,
    key: string,
    query: ReleaseQuery,
    sourceUrl: string
  ): Promise<CalendarSnapshot | undefined> {
    const direct = await this.get(year, `page:${key}`)
    if (direct && frozenCalendarPage(direct, query)) return direct
    const day = calendarTarget(query)?.day
    if (day && day < calendarDay()) {
      const daily = await this.get(
        year,
        `day:${calendarScope(query, sourceUrl)}:${day}`
      )
      // A full calendar query needs its entire page, not just the selected day.
      if (query.cursor && daily && frozenCalendarPage(daily, query))
        return { ...daily, value: { ...daily.value, sourceUrl } }
    }
    return direct
  }
}
