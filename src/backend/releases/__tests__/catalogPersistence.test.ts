import { mkdtemp, mkdir, rm } from 'fs/promises'
import { resolve, join, sep } from 'path'
import { ReleaseArchive } from '../archive'
import { getReleaseDetails } from '../catalog'

const mockFetch = jest.fn()
let mockDirectory: string
jest.mock('electron', () => ({
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
  obscuraReleasePage: async () => undefined
}))

const root = resolve('build/release-source-tests')
beforeEach(async () => {
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'source-'))
  mockFetch.mockReset()
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
