import { catalogUrl } from '../catalog'

jest.mock('electron', () => ({ BrowserWindow: jest.fn(), session: {} }))
jest.mock('../engines', () => ({
  parseResilient: jest.fn(),
  obscuraReleasePage: jest.fn()
}))

it('combines several source version filters, a genre and the selected date', () => {
  const url = new URL(
    catalogUrl({
      category: 'games',
      platforms: ['PC', 'PlayStation 5', 'PC'],
      tag: 'Action',
      date: '2026-10-04',
      region: 'us'
    })
  )
  expect(url.pathname).toBe('/calendar/games')
  expect(url.searchParams.getAll('f')).toEqual([
    'v:PC',
    'v:PlayStation 5',
    'tags:Action'
  ])
  expect(url.searchParams.get('at')).toBe('2026-oct-4')
})

it('keeps popular intervals, legacy single-platform queries and the source pagination filters', () => {
  expect(
    new URL(
      catalogUrl({
        category: 'games',
        platforms: ['PC', 'Xbox Series X'],
        view: 'hot',
        interval: 'month'
      })
    ).pathname
  ).toBe('/hot/games/monthly')
  expect(
    new URL(catalogUrl({ category: 'games', platform: 'pc' })).pathname
  ).toBe('/calendar/games_pc')
  const cursor =
    'https://www.releases.com/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-M10-D15&Category=games&F=v%3APC&F=v%3APlayStation+5&Direction=Forward'
  expect(
    catalogUrl({ cursor, platforms: ['PC', 'PlayStation 5'], region: 'uk' })
  ).toBe(cursor)
})

it('rejects malformed filters and pagination outside the catalogue domain', () => {
  expect(() => catalogUrl({ platforms: ['PC\n'] })).toThrow(
    'Plataformas inválidas'
  )
  expect(() => catalogUrl({ platforms: [''] })).toThrow('Plataformas inválidas')
  expect(() => catalogUrl({ platforms: new Array(51).fill('PC') })).toThrow(
    'Plataformas inválidas'
  )
  expect(() =>
    catalogUrl({
      cursor: 'https://example.com/partial/Releases.Www.PL.Calendar.Group'
    })
  ).toThrow('Página de lançamentos inválida')
})

it('accepts historical dates without a current-year floor and retains backward cursors', () => {
  const url = new URL(
    catalogUrl({ category: 'games', platforms: ['PC'], date: '2001-01-01' })
  )
  expect(url.searchParams.get('at')).toBe('2001-jan-1')
  expect(url.searchParams.getAll('f')).toEqual(['v:PC'])
  const cursor =
    '/partial/Releases.Www.PL.Calendar.Group?Code=Y2002-M9-D1&Category=games&Direction=Backward&F=v%3APC'
  expect(catalogUrl({ cursor })).toBe('https://www.releases.com' + cursor)
})

it('generates the exact query with PC and PC Early Access platforms preserved', () => {
  const url = new URL(
    catalogUrl({
      category: 'games',
      platforms: ['PC', 'PC (Early Access)'],
      date: '2026-10-15',
      region: 'us'
    })
  )
  expect(url.pathname).toBe('/calendar/games')
  expect(url.searchParams.getAll('f')).toEqual([
    'v:PC',
    'v:PC (Early Access)'
  ])
  expect(url.searchParams.get('at')).toBe('2026-oct-15')
})
