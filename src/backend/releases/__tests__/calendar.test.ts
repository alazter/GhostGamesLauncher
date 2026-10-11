import {
  mergeReleaseProducts,
  releaseCalendarOccurrences,
  filterReleasePlatforms,
  appendReleasePage,
  releaseCalendarSections,
  closestReleaseDate
} from 'common/releaseCatalog'
import type { ReleaseProduct } from 'common/types/releases'

it('anchors today before future releases instead of selecting the greatest date', () => {
  expect(
    closestReleaseDate(
      ['2026-10-14', '2001-10-07', '2026-10-09', '2026-10-08'],
      '2026-10-09'
    )
  ).toBe('2026-10-09')
})

it('selects the nearest day on either side of today and prefers the past on a tie', () => {
  expect(closestReleaseDate(['2026-10-14', '2026-10-08'], '2026-10-09')).toBe(
    '2026-10-08'
  )
  expect(closestReleaseDate(['2001-10-07', '2026-10-11'], '2026-10-09')).toBe(
    '2026-10-11'
  )
  expect(closestReleaseDate(['2026-10-10', '2026-10-08'], '2026-10-09')).toBe(
    '2026-10-08'
  )
})

it('ignores estimated periods, missing days and invalid dates', () => {
  expect(
    closestReleaseDate(
      ['', 'Q4 2026', '2026-02-30', '2026-10-14'],
      '2026-10-09'
    )
  ).toBe('2026-10-14')
  expect(closestReleaseDate(['', 'Q4 2026'], '2026-10-09')).toBeUndefined()
  expect(closestReleaseDate([], '2026-10-09')).toBeUndefined()
})

it('retains staggered platform dates across pagination and renders each on its own day', () => {
  const product: ReleaseProduct = {
    id: 'game',
    title: 'Game',
    url: 'https://www.releases.com/p/game',
    category: 'games',
    platforms: ['PC'],
    region: 'us',
    dateLabel: 'Oct 3',
    releaseDate: '2026-10-03',
    releases: [
      {
        platform: 'PC',
        region: 'us',
        date: '2026-10-03',
        dateLabel: 'Oct 3',
        estimated: false
      }
    ],
    images: [],
    videos: [],
    tags: []
  }
  const later: ReleaseProduct = {
    ...product,
    platforms: ['PS5'],
    releases: [
      {
        platform: 'PS5',
        region: 'us',
        date: '2026-10-10',
        dateLabel: 'Oct 10',
        estimated: false
      }
    ]
  }
  const merged = mergeReleaseProducts([product, later, later])
  expect(merged).toHaveLength(1)
  expect(merged[0].releases).toHaveLength(2)
  expect(
    releaseCalendarOccurrences(merged[0]).map((item) => [
      item.releaseDate,
      item.platforms
    ])
  ).toEqual([
    ['2026-10-03', ['PC']],
    ['2026-10-10', ['PS5']]
  ])
  const followed = releaseCalendarSections([merged[0], merged[0]], false)
    .flatMap((section) => section.groups)
    .flatMap((group) => group.products)
  expect(followed).toHaveLength(1)
  expect(followed[0].platforms).toEqual(['PC', 'PS5'])
  expect(followed[0].releases).toHaveLength(2)
  expect(
    releaseCalendarSections(merged)
      .flatMap((section) => section.groups)
      .flatMap((group) => group.products)
  ).toHaveLength(2)
})

it('groups historical and future days by month without treating estimated periods as confirmed dates', () => {
  const make = (
    id: string,
    date?: string,
    calendarOrder?: string
  ): ReleaseProduct => ({
    id,
    title: id,
    url: `https://www.releases.com/p/${id}`,
    category: 'games',
    platforms: ['PC'],
    region: 'us',
    dateLabel: date || 'Q3 2026',
    releaseDate: date,
    calendarOrder,
    releases: [],
    images: [],
    videos: [],
    tags: []
  })
  const sections = releaseCalendarSections([
    make('future', '2027-01-01'),
    make('october', '2026-10-01'),
    make('old', '2001-10-07'),
    make('estimate', undefined, '2026-09-30'),
    make('same-day', '2026-10-01')
  ])
  expect(sections.map((section) => section.month)).toEqual([
    '2001-10',
    undefined,
    '2026-10',
    '2027-01'
  ])
  expect(sections[1].groups[0].date).toBeUndefined()
  expect(sections[2].groups[0].products.map((product) => product.id)).toEqual([
    'october',
    'same-day'
  ])
})

it('shows any selected platform and only that platform’s dates without altering the saved product', () => {
  const product: ReleaseProduct = {
    id: 'game',
    title: 'Game',
    url: 'https://www.releases.com/p/game',
    category: 'games',
    platforms: ['PC', 'PlayStation 5', 'Xbox Series X'],
    region: 'us',
    dateLabel: 'Oct 3',
    releaseDate: '2026-10-03',
    releases: ['PC', 'PlayStation 5', 'Xbox Series X'].map(
      (platform, index) => ({
        platform,
        region: 'us',
        dateLabel: `Oct ${index + 3}`,
        date: `2026-10-0${index + 3}`,
        estimated: false
      })
    ),
    images: [],
    videos: [],
    tags: []
  }
  const filtered = filterReleasePlatforms([product], ['PC', 'PlayStation 5'])
  expect(filtered[0].platforms).toEqual(['PC', 'PlayStation 5'])
  expect(
    filtered
      .flatMap(releaseCalendarOccurrences)
      .map((product) => product.releaseDate)
  ).toEqual(['2026-10-03', '2026-10-04'])
  expect(product.releases).toHaveLength(3)
  expect(filterReleasePlatforms([product], ['Switch'])).toEqual([])
  expect(
    filterReleasePlatforms(
      [{ ...product, releases: [], dateLabel: 'Ver datas por plataforma' }],
      ['PC']
    )
  ).toHaveLength(1)
})

it('preserves loaded pages when the next page is unavailable or fails to advance', () => {
  const page = {
    products: [],
    filters: [],
    fetchedAt: '2026-10-04',
    sourceUrl: 'https://www.releases.com/calendar/games',
    stale: false,
    hasMore: true,
    nextCursor: 'page-2'
  }
  expect(
    appendReleasePage(page, { ...page, hasMore: false }, 'page-2').hasMore
  ).toBe(false)
  expect(() =>
    appendReleasePage(
      page,
      { ...page, stale: true, warning: 'Offline' },
      'page-2'
    )
  ).toThrow('Offline')
  expect(() => appendReleasePage(page, page, 'page-2')).toThrow('não avançou')
  expect(page.hasMore).toBe(true)
})

it('extends the past without dropping the remaining future or advancing the wrong cursor', () => {
  const page = {
    products: [],
    filters: [],
    fetchedAt: '2026-10-04',
    sourceUrl: 'https://www.releases.com/calendar/games',
    stale: false,
    hasMore: true,
    nextCursor: 'future',
    previousCursor: 'past'
  }
  const older = {
    ...page,
    hasMore: false,
    nextCursor: undefined,
    previousCursor: 'older'
  }
  const result = appendReleasePage(page, older, 'past', 'backward')
  expect(result.nextCursor).toBe('future')
  expect(result.hasMore).toBe(true)
  expect(result.previousCursor).toBe('older')
  expect(
    appendReleasePage(result, { ...page, nextCursor: 'future2' }, 'future')
      .previousCursor
  ).toBe('older')
  expect(() => appendReleasePage(page, page, 'past', 'backward')).toThrow(
    'não avançou'
  )
})
