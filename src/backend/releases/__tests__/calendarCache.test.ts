import fs, {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'fs/promises'
import { join, resolve, sep } from 'path'
import {
  annualCalendarYear,
  CalendarYearCache,
  frozenCalendarPage,
  mergeFrozenCalendar,
  replaceCalendarFile
} from '../calendarCache'
import { ReleaseArchive } from '../archive'
import type {
  ReleaseCatalog,
  ReleaseProduct,
  ReleaseQuery
} from 'common/types/releases'

const root = resolve('build/release-year-tests')
let directory: string
const now = Date.parse('2026-10-16T15:00:00Z')
const cursor = (day: number, filters = 'F=v%3APC') =>
  `/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-M10-D${day}&Category=games&${filters}&Direction=Backward`
const product = (id: string, day: string): ReleaseProduct => ({
  id,
  title: id,
  url: `https://www.releases.com/p/${id}`,
  category: 'games',
  region: 'us',
  platforms: ['PC'],
  releaseDate: day,
  dateLabel: day,
  releases: [
    {
      platform: 'PC',
      region: 'us',
      date: day,
      dateLabel: day,
      estimated: false
    }
  ],
  images: [],
  videos: [],
  tags: []
})
const catalog = (products: ReleaseProduct[]): ReleaseCatalog => ({
  products,
  filters: [],
  sourceUrl: 'https://www.releases.com/calendar/games?f=v%3APC&at=2026-oct-16',
  fetchedAt: new Date(now).toISOString(),
  stale: false,
  hasMore: true,
  previousCursor: cursor(13),
  nextCursor: cursor(17).replace('Backward', 'Forward')
})
beforeEach(async () => {
  await mkdir(root, { recursive: true })
  directory = await mkdtemp(join(root, 'annual-'))
  jest.spyOn(Date, 'now').mockReturnValue(now)
})
afterEach(async () => {
  jest.restoreAllMocks()
  if (!resolve(directory).startsWith(root + sep))
    throw new Error('Unsafe test path')
  await rm(directory, { recursive: true, force: true })
})

it('pins only finalized past dates of the current calendar year', () => {
  const query: ReleaseQuery = { date: '2026-10-14', region: 'us' }
  const value = catalog([product('old', '2026-10-14')])
  expect(frozenCalendarPage({ at: now, value }, query)).toBe(true)
  expect(frozenCalendarPage({ at: now, value: catalog([]) }, query)).toBe(false)
  expect(
    frozenCalendarPage({ at: Date.parse('2026-10-13T15:00:00Z'), value }, query)
  ).toBe(false)
  expect(
    frozenCalendarPage({ at: Date.parse('2026-10-14T15:00:00Z'), value }, query)
  ).toBe(false)
  expect(frozenCalendarPage({ at: now, value }, { date: '2026-10-16' })).toBe(
    false
  )
  expect(frozenCalendarPage({ at: now, value }, { date: '2026-10-20' })).toBe(
    false
  )
  expect(frozenCalendarPage({ at: now, value }, { date: '2025-10-14' })).toBe(
    false
  )
  expect(annualCalendarYear({ date: '2026-01-01' })).toBe(2026)
  expect(annualCalendarYear({ date: '2026-12-31' })).toBe(2026)
  expect(annualCalendarYear({ date: '2027-01-01' })).toBeUndefined()
  expect(annualCalendarYear({ view: 'hot' })).toBeUndefined()
  expect(annualCalendarYear({ search: 'Game' })).toBeUndefined()
  expect(
    annualCalendarYear({
      cursor: '/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-Q3'
    })
  ).toBe(2026)
  const estimate = {
    ...value.products[0],
    releaseDate: undefined,
    calendarOrder: '2026-09-30',
    releases: [
      {
        ...value.products[0].releases[0],
        date: undefined,
        estimated: true,
        calendarOrder: '2026-09-30'
      }
    ]
  }
  expect(
    frozenCalendarPage({ at: now, value: catalog([estimate]) }, query)
  ).toBe(false)
})

it('keeps finalized historical data and replaces today and future dates in mixed pages', () => {
  const previous = {
    at: Date.parse('2026-10-15T15:00:00Z'),
    value: catalog([
      product('past', '2026-10-14'),
      product('today', '2026-10-16'),
      product('future', '2026-10-20')
    ])
  }
  const next = catalog([
    { ...product('past', '2026-10-14'), title: 'changed historical title' },
    { ...product('today', '2026-10-16'), title: 'updated today' },
    product('future', '2026-10-21')
  ])
  const result = mergeFrozenCalendar(previous, next)
  expect(result.products.find((item) => item.id === 'past')?.title).toBe('past')
  expect(result.products.find((item) => item.id === 'today')?.title).toBe(
    'updated today'
  )
  expect(
    result.products.find((item) => item.id === 'future')?.releaseDate
  ).toBe('2026-10-21')
  expect(previous.value.products[2].releaseDate).toBe('2026-10-20')
})

it('reuses complete days from another page with the same filters and real neighbor cursors', async () => {
  const cache = new CalendarYearCache(directory)
  const query = {
    category: 'games',
    date: '2026-10-16',
    platforms: ['PC'],
    region: 'us' as const
  }
  const value = catalog([
    product('day-14', '2026-10-14'),
    product('day-15', '2026-10-15'),
    product('day-16', '2026-10-16')
  ])
  await cache.save(2026, 'initial-page', query, { at: now, value })
  const nextQuery = { ...query, cursor: cursor(15) }
  const result = await new CalendarYearCache(directory).page(
    2026,
    'different-page-key',
    nextQuery,
    'https://www.releases.com' + cursor(15)
  )
  expect(result?.value.products.map((item) => item.id)).toEqual(['day-15'])
  expect(result?.value.previousCursor).toContain('Code=Y2026-M10-D14')
  expect(result?.value.nextCursor).toContain('Code=Y2026-M10-D16')
  expect(result?.value.nextCursor).toContain('Direction=Forward')
  expect(
    await cache.page(
      2026,
      'uk-key',
      { ...nextQuery, region: 'uk' },
      result!.value.sourceUrl
    )
  ).toBeUndefined()
  expect(
    await cache.page(
      2026,
      'other-filter-key',
      nextQuery,
      'https://www.releases.com' +
        cursor(15, 'F=v%3APC&F=v%3APC+(Early+Access)')
    )
  ).toBeUndefined()
  expect(
    await cache.page(
      2026,
      'initial-other-day',
      { ...query, date: '2026-10-15' },
      value.sourceUrl
    )
  ).toBeUndefined()
})

it('retains the annual page after the legacy LRU exceeds 120 entries and after reopening', async () => {
  const archive = new ReleaseArchive(directory)
  const value = catalog([product('retained', '2026-10-14')])
  await archive.calendar.save(
    2026,
    'saved-key',
    { cursor: cursor(14), region: 'us' },
    { at: now, value }
  )
  for (let index = 0; index < 122; index++)
    await archive.put(
      'product',
      `other-${index}`,
      product(`other-${index}`, '2026-10-14')
    )
  expect((await archive.export()).records).toHaveLength(120)
  const reopened = await new ReleaseArchive(directory).calendar.page(
    2026,
    'saved-key',
    { cursor: cursor(14), region: 'us' },
    value.sourceUrl
  )
  expect(reopened?.value.products[0].id).toBe('retained')
}, 15000)

it('recovers the previous annual copy and rejects invalid snapshots without replacing data', async () => {
  const cache = new CalendarYearCache(directory)
  const value = catalog([product('old', '2026-10-14')])
  await cache.put(2026, 'key', { at: now, value })
  await cache.put(2026, 'key', {
    at: now + 1,
    value: { ...value, products: [product('new', '2026-10-14')] }
  })
  const yearDirectory = join(directory, 'calendar', '2026')
  const file = (await readdir(yearDirectory)).find(
    (name) => name.endsWith('.json') && !name.endsWith('.previous.json')
  )!
  await writeFile(join(yearDirectory, file), '{broken')
  const warning = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => undefined)
  expect(
    (await new CalendarYearCache(directory).get(2026, 'key'))?.value.products[0]
      .id
  ).toBe('old')
  expect(warning).toHaveBeenCalled()
  await expect(
    cache.put(2026, 'key', { at: now, value: { ...value, stale: true } })
  ).rejects.toThrow('validados')
  expect(await readFile(join(yearDirectory, file), 'utf8')).toBe('{broken')
})

it('retries a transient file lock atomically and leaves the original intact on a hard failure', async () => {
  const source = join(directory, 'new.tmp')
  const target = join(directory, 'saved.json')
  await writeFile(source, 'new')
  await writeFile(target, 'old')
  const actualRename = fs.rename
  const rename = jest
    .spyOn(fs, 'rename')
    .mockRejectedValueOnce(
      Object.assign(new Error('Locked'), { code: 'EPERM' })
    )
    .mockImplementation(actualRename)
  await replaceCalendarFile(source, target)
  expect(rename).toHaveBeenCalledTimes(2)
  expect(await readFile(target, 'utf8')).toBe('new')
  await writeFile(source, 'other')
  rename.mockRejectedValueOnce(
    Object.assign(new Error('I/O failure'), { code: 'EIO' })
  )
  await expect(replaceCalendarFile(source, target)).rejects.toThrow(
    'I/O failure'
  )
  expect(await readFile(target, 'utf8')).toBe('new')
})
