import { mkdtemp, mkdir, rm } from 'fs/promises'
import { resolve, join, sep } from 'path'
import { ReleaseArchive } from '../archive'
import { catalogUrl, getReleaseCatalog, getReleaseDetails } from '../catalog'
import { parseReleaseCatalog } from '../parser'

const mockFetch = jest.fn()
const mockCatalogHtml = jest.fn<Promise<string>, []>()
const mockScraplingPage = jest.fn<Promise<string | undefined>, [string]>()
let mockDirectory: string
jest.mock('electron', () => ({
  BrowserWindow: class {
    webContents = {
      setAudioMuted: jest.fn(),
      setWindowOpenHandler: jest.fn(),
      on: jest.fn(),
      executeJavaScript: async (script: string) =>
        script === 'document.documentElement.outerHTML'
          ? mockCatalogHtml()
          : false
    }
    loadURL() {
      return Promise.resolve()
    }
    isDestroyed() {
      return false
    }
    destroy() {
      return undefined
    }
  },
  session: {
    fromPartition: () => ({
      fetch: mockFetch,
      setPermissionRequestHandler: jest.fn(),
      webRequest: { onBeforeRequest: jest.fn() }
    })
  }
}))
jest.mock('../archive', () => {
  const actual = jest.requireActual('../archive')
  return {
    ...actual,
    getReleaseArchive: async () => new actual.ReleaseArchive(mockDirectory)
  }
})
jest.mock('../engines', () => ({
  parseResilient: async (
    html: string,
    _key: string,
    parse: (html: string) => unknown
  ) => parse(html),
  obscuraReleasePage: async () => undefined,
  scraplingReleasePage: (url: string) => mockScraplingPage(url)
}))

const root = resolve('build/release-source-tests')
const annualNow = Date.parse('2026-10-16T15:00:00Z')
const annualCursor = (code: string) =>
  `/partial/Releases.Www.PL.Calendar.Group?Code=${code}&Category=games&F=v%3APC&Direction=Backward`
const calendarGroup = (id: string, day: string) =>
  `<div class="RWP-Calendar-Group" data-calendarcode="${day}" data-atprimarytext="${day}"><article class="RWPCC-CalendarItems-CardControl"><a class="RWPCC-CalendarItems-CardControl-Name" href="/p/${id}">${id}</a><span class="RWPCC-CalendarItems-TypeAndVersionsControl-Version">PC</span><button data-regionid="us"></button></article></div>`
beforeEach(async () => {
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'source-'))
  mockFetch.mockReset()
  mockCatalogHtml.mockReset()
  mockScraplingPage.mockReset()
})

it('revalidates a persisted 31-title quarter into one current estimate and retains its older revision', async () => {
  const cursor =
    '/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-Q3&Category=games&Direction=Backward&F=v%3APC'
  const query = {
    category: 'games',
    cursor,
    region: 'us' as const,
    refresh: true
  }
  const sourceUrl = catalogUrl(query)
  const card = (id: number) =>
    `<article class="RWPCC-CalendarItems-CardControl"><a class="RWPCC-CalendarItems-CardControl-Name" href="/p/estimate-${id}">Estimate ${id}</a><span class="RWPCC-CalendarItems-TypeAndVersionsControl-Version">PC</span><button data-regionid="us"></button></article>`
  const page = (cards: string) =>
    `<div class="RWP-Calendar-Group" data-calendarcode="2026-q3-est" data-atprimarytext="Estimated Q3">${cards}</div><div class="RWPCC-InfinityUp-InfinityUpTypes" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-M9-D30&amp;Direction=Backward"></div>`
  const old = parseReleaseCatalog(
    page(Array.from({ length: 31 }, (_, index) => card(index)).join('')),
    query,
    sourceUrl
  )
  const key = JSON.stringify([sourceUrl, '', 'us'])
  const archive = new ReleaseArchive(mockDirectory)
  await archive.put('catalog', key, old)
  mockCatalogHtml.mockResolvedValueOnce(page(card(0)))
  const updated = await getReleaseCatalog(query)
  expect(updated.products).toHaveLength(1)
  expect(updated.stale).toBe(false)
  expect(updated.previousCursor).toContain('Code=Y2026-M9-D30')
  expect(
    (await new ReleaseArchive(mockDirectory).get('catalog', key))?.value
  ).toEqual(JSON.parse(JSON.stringify(updated)))
  const revisions = (await archive.export()).records[0].revisions
  expect(
    revisions.map((row) => (row.value as typeof updated).products.length)
  ).toEqual([1, 31])
  const reopened = await getReleaseCatalog({ ...query, refresh: false })
  expect(reopened.stale).toBe(false)
  expect(reopened.products).toHaveLength(1)
  expect(mockCatalogHtml).toHaveBeenCalledTimes(1)
})
afterEach(async () => {
  jest.restoreAllMocks()
  if (!resolve(mockDirectory).startsWith(root + sep))
    throw new Error('Unsafe test path')
  await rm(mockDirectory, { recursive: true, force: true })
})

it('serves the durable last good product after network failure or lost source fields', async () => {
  const html =
    '<h1 class="RWP-Product-MainInfoView-Name">Example</h1><div class="RWP-Product-ReleaseInfoView-DateListItem" data-regionid="us"><b class="RWP-Product-ReleaseInfoView-Item">PC</b><span class="RWP-Product-ReleaseInfoView-ItemReleaseDate">Oct 3, 2026</span></div>'
  mockFetch.mockResolvedValueOnce({ ok: true, text: async () => html })
  const original = await getReleaseDetails('example')
  expect(original.releases[0].date).toBe('2026-10-03')
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000)
  mockFetch.mockRejectedValueOnce(new Error('Network unavailable'))
  const offline = await getReleaseDetails('example')
  expect(offline).toMatchObject({
    ...JSON.parse(JSON.stringify(original)),
    stale: true
  })
  expect(offline.warning).toContain('Network unavailable')
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => '<h1 class="RWP-Product-MainInfoView-Name">Example</h1>'
  })
  const incomplete = await getReleaseDetails('example')
  expect(incomplete.stale).toBe(true)
  expect(incomplete.releases).toEqual(original.releases)
  expect(
    (await new ReleaseArchive(mockDirectory).get('product', 'us:example'))
      ?.value
  ).toEqual(original)
})

it('loads finalized current-year history from disk even after expiry, refresh and reopening', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(annualNow)
  const query = {
    cursor: annualCursor('Y2026-M10-D14'),
    category: 'games',
    region: 'us' as const,
    refresh: true
  }
  mockCatalogHtml.mockResolvedValueOnce(
    calendarGroup('saved-history', '2026-oct-14')
  )
  const first = await getReleaseCatalog(query)
  expect(first.products[0].id).toBe('saved-history')
  jest.spyOn(Date, 'now').mockReturnValue(annualNow + 30 * 86400000)
  const reopened = await getReleaseCatalog(query)
  expect(reopened.products[0].id).toBe('saved-history')
  expect(reopened.stale).toBe(false)
  expect(mockCatalogHtml).toHaveBeenCalledTimes(1)
})

it('reuses an earlier calendar day across source query shapes with matching filters', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(annualNow)
  const base = { category: 'games', platforms: ['PC'], region: 'us' as const }
  const html =
    calendarGroup('older', '2026-oct-14') +
    calendarGroup('yesterday', '2026-oct-15') +
    calendarGroup('today', '2026-oct-16') +
    `<div class="RWPCC-InfinityUp-InfinityUpTypes" data-ui-url="${annualCursor('Y2026-M10-D13').replace(/&/g, '&amp;')}"></div><div class="RWPCC-InfinityDown-InfinityDownControl" data-ui-url="${annualCursor('Y2026-M10-D17').replace('Backward', 'Forward').replace(/&/g, '&amp;')}"></div>`
  mockCatalogHtml.mockResolvedValueOnce(html)
  await getReleaseCatalog({ ...base, date: '2026-10-16' })
  const historical = await getReleaseCatalog({
    ...base,
    cursor: annualCursor('Y2026-M10-D15'),
    refresh: true
  })
  expect(historical.products.map((item) => item.id)).toEqual(['yesterday'])
  expect(historical.previousCursor).toContain('Code=Y2026-M10-D14')
  expect(mockCatalogHtml).toHaveBeenCalledTimes(1)
})

it('refreshes future data and finalizes a pre-release snapshot once after the release day', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(annualNow)
  const query = {
    cursor: annualCursor('Y2026-M10-D20'),
    category: 'games',
    region: 'us' as const,
    refresh: true
  }
  mockCatalogHtml.mockResolvedValueOnce(calendarGroup('future', '2026-oct-20'))
  await getReleaseCatalog(query)
  mockCatalogHtml.mockResolvedValueOnce(calendarGroup('future', '2026-oct-21'))
  const moved = await getReleaseCatalog(query)
  expect(moved.products[0].releaseDate).toBe('2026-10-21')
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T15:00:00Z'))
  mockCatalogHtml.mockResolvedValueOnce(calendarGroup('future', '2026-oct-21'))
  await getReleaseCatalog(query)
  await getReleaseCatalog(query)
  expect(mockCatalogHtml).toHaveBeenCalledTimes(3)
})

it('keeps previous years on the existing refresh policy', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(annualNow)
  const query = {
    cursor: annualCursor('Y2025-M10-D14'),
    category: 'games',
    region: 'us' as const,
    refresh: true
  }
  mockCatalogHtml.mockResolvedValue(
    calendarGroup('previous-year', '2025-oct-14')
  )
  await getReleaseCatalog(query)
  await getReleaseCatalog(query)
  expect(mockCatalogHtml).toHaveBeenCalledTimes(2)
})

it('collects through the preferred engine, then shares frozen history across engine choices', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(annualNow)
  const query = {
    collector: 'scrapling' as const,
    cursor: annualCursor('Y2026-M10-D14'),
    region: 'us' as const,
    refresh: true
  }
  mockScraplingPage.mockResolvedValueOnce(
    calendarGroup('preferred-history', '2026-oct-14')
  )
  const first = await getReleaseCatalog(query)
  expect(first.products[0].id).toBe('preferred-history')
  const reopened = await getReleaseCatalog({ ...query, collector: 'obscura' })
  expect(reopened.products[0].id).toBe('preferred-history')
  expect(mockScraplingPage).toHaveBeenCalledTimes(1)
  expect(mockCatalogHtml).not.toHaveBeenCalled()
})

it('validates preferred-engine product details using the explicit region in the URL', async () => {
  mockScraplingPage.mockResolvedValueOnce(
    '<h1 class="RWP-Product-MainInfoView-Name">Example</h1><div class="RWP-Product-ReleaseInfoView-DateListItem" data-regionid="uk"><b class="RWP-Product-ReleaseInfoView-Item">PC</b><span class="RWP-Product-ReleaseInfoView-ItemReleaseDate">Oct 3, 2026</span></div>'
  )
  const result = await getReleaseDetails('example', 'uk', 'scrapling')
  expect(result.region).toBe('uk')
  expect(result.releases[0].region).toBe('uk')
  expect(mockFetch).not.toHaveBeenCalled()
  expect(mockScraplingPage.mock.calls[0][0]).toContain('RegionId=uk')
})
