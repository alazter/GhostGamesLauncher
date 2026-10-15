import type { BrowserWindow } from 'electron'
import { builtinGameSources } from 'common/builtinGameSources'
import type { PluginManifest } from 'common/types/plugins'
import {
  DirectPageEngines,
  directPageNavigation,
  readDirectPage,
  validateDirectPageData
} from '../directPageEngines'
import { withSourceEngine } from '../sourceEngines'
import { engineProcess } from '../engineProcess'
import { experimentalPage } from '../adaptiveSource'
import { evaluateAnkerPage } from '../ankerNavigation'
import { onlineFixPackagesFromEntries } from '../onlineFixHosters'

jest.mock('../sourceEngines', () => ({ withSourceEngine: jest.fn() }))
jest.mock('../engineProcess', () => ({ engineProcess: jest.fn() }))
jest.mock('../adaptiveSource', () => ({
  ...jest.requireActual('../adaptiveSource'),
  experimentalPage: jest.fn()
}))
jest.mock('../ankerNavigation', () => ({ evaluateAnkerPage: jest.fn() }))
const base = 'https://ankergames.net/game/test'
const url = 'https://filekeeper.net/Test.zip'
const manifest = {
  id: builtinGameSources[0].id,
  allowedDomains: ['ankergames.net', 'filekeeper.net']
} as PluginManifest
const allowed = (raw: string) =>
  ['ankergames.net', 'filekeeper.net', 'hosters.online-fix.me'].includes(
    new URL(raw).hostname
  )
const response = (
  links: Array<{ url: string; title: string }>,
  entries: unknown[] = []
) => ({ capability: 'direct-download-page-v1', links, entries })
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(withSourceEngine).mockResolvedValue(undefined)
})

it.each(builtinGameSources)(
  'uses the shared Scrapling operation for $name',
  async (source) => {
    jest
      .mocked(withSourceEngine)
      .mockImplementation(async (_id, run) => run('worker', '/unused-storage'))
    jest
      .mocked(engineProcess)
      .mockResolvedValue(JSON.stringify(response([{ url, title: 'Download' }])))
    expect(
      (
        await readDirectPage(
          '<a>changed layout</a>',
          `https://${source.domain}/game/test`,
          { ...manifest, id: source.id },
          () => true
        )
      ).links
    ).toEqual([{ url, title: 'Download' }])
    expect(engineProcess).toHaveBeenCalledWith(
      'worker',
      [],
      expect.stringContaining('direct-download-page-v1'),
      4000
    )
    expect(experimentalPage).not.toHaveBeenCalled()
  }
)

it('rejects old worker catalog output and falls back to Obscura on a public game page', async () => {
  jest
    .mocked(withSourceEngine)
    .mockImplementation(async (_id, run) => run('old-worker', '/unused'))
  jest
    .mocked(engineProcess)
    .mockResolvedValue(JSON.stringify([{ url, title: 'Download' }]))
  jest
    .mocked(experimentalPage)
    .mockResolvedValue(
      `<a href="${url}" aria-label="Download"><img alt="Download"></a>`
    )
  expect(
    (await readDirectPage('<main>Waiting</main>', base, manifest, allowed))
      .links
  ).toEqual([{ url, title: 'Download' }])
  expect(experimentalPage).toHaveBeenCalledWith(
    base,
    expect.objectContaining({
      allowedDomains: [
        'ankergames.net',
        '*.ankergames.net',
        'challenges.cloudflare.com'
      ]
    })
  )
})

it.each(builtinGameSources)(
  'offers Obscura fallback for the public game page of $name',
  async (source) => {
    const path = source.id.includes('ankergames')
      ? '/game/test'
      : source.id.includes('online-fix')
        ? '/games/strategy/test.html'
        : '/test-free-download/'
    jest
      .mocked(experimentalPage)
      .mockResolvedValue(`<a href="${url}"><img alt="Download"></a>`)
    const data = await readDirectPage(
      '<main/>',
      `https://${source.domain}${path}`,
      { ...manifest, id: source.id },
      () => true
    )
    expect(data.links).toEqual([{ url, title: 'Download' }])
    expect(experimentalPage).toHaveBeenCalledTimes(1)
  }
)

it('does not render Online-Fix authenticated subdomains separately, including default HTTPS ports', async () => {
  await readDirectPage(
    '<main/>',
    'https://hosters.online-fix.me/Test',
    { ...manifest, id: 'com.ghost.online-fix-source' },
    () => true
  )
  expect(experimentalPage).not.toHaveBeenCalled()
})

it.each([
  'https://filekeeper.net/Test.zip',
  'https://ankergames.net/download/test',
  `${base}?token=secret`,
  'https://hosters.online-fix.me:2053/Test'
])(
  'never asks Obscura to fetch a private/signed hoster flow: %s',
  async (page) => {
    await readDirectPage(
      '<main>Needs confirmation</main>',
      page,
      manifest,
      allowed
    )
    expect(experimentalPage).not.toHaveBeenCalled()
  }
)

it('keeps native/manual resolution available when both optional engines fail', async () => {
  jest.mocked(withSourceEngine).mockRejectedValue(new Error('offline'))
  jest.mocked(experimentalPage).mockRejectedValue(new Error('offline'))
  expect(await readDirectPage('<main/>', base, manifest, allowed)).toEqual({
    links: [],
    entries: []
  })
})

it('revalidates engine links, blocking reports, advertisements, credentials and foreign domains', () => {
  expect(
    validateDirectPageData(
      response([
        { url, title: '↓ Download' },
        { url: 'https://evil.test/Game.zip', title: 'Download' },
        { url: 'https://filekeeper.net/report/file', title: 'Download' },
        { url: 'https://filekeeper.net/other', title: 'Report abuse' },
        { url: 'https://user:password@filekeeper.net/file', title: 'Download' },
        { url: 'http://filekeeper.net/file', title: 'Download' },
        {
          url: 'https://filekeeper.net/extension',
          title: 'Download extension'
        },
        { url: 'https://filekeeper.net/ignored', title: 'Home' }
      ]),
      base,
      allowed
    ).links
  ).toEqual([{ url, title: 'Download' }])
})

it('retains Online-Fix game/fix validation for entries supplied by the engine', () => {
  const data = validateDirectPageData(
    response(
      [],
      [
        { file_name: 'Test.zip', direct_link: url },
        {
          file_name: 'Test_Fix.zip',
          direct_link: 'https://filekeeper.net/Fix.zip'
        },
        { file_name: '../escape.zip', direct_link: url },
        { file_name: 'Ad.zip', direct_link: 'https://evil.test/Ad.zip' }
      ]
    ),
    base,
    allowed
  )
  expect(
    onlineFixPackagesFromEntries(data.entries).map((item) => item.role)
  ).toEqual(['game', 'fix'])
  expect(() =>
    onlineFixPackagesFromEntries([{ file_name: 'Game.zip', direct_link: url }])
  ).toThrow('incompleta')
})

it('requires one filename-matching hoster link and never converts a form action into GET', () => {
  const data = response([
    { url, title: 'Download' },
    { url: 'https://filekeeper.net/form', title: 'Download' }
  ])
  expect(directPageNavigation(data, false, 'Test.zip')).toEqual([url])
  expect(directPageNavigation(data, false, 'Other.zip')).toEqual([])
  expect(
    directPageNavigation(
      response([
        { url, title: 'Download' },
        { url: 'https://filekeeper.net/Other.zip', title: 'Download' }
      ]),
      false
    )
  ).toEqual([])
})

it('ignores engine completion after cancellation or navigation and does not block the caller', async () => {
  let current = base
  let finish: (html: string) => void = () => undefined
  const rendering = new Promise<string>((resolve) => {
    finish = resolve
  })
  jest
    .mocked(evaluateAnkerPage)
    .mockResolvedValue({ url: base, html: '<main/>' })
  jest.mocked(experimentalPage).mockReturnValue(rendering)
  const window = {
    webContents: { id: 1, getURL: () => current },
    isDestroyed: () => false
  } as unknown as BrowserWindow
  const engines = new DirectPageEngines(manifest, allowed)
  expect(engines.poll(window)).toBeUndefined()
  await new Promise((resolve) => setImmediate(resolve))
  expect(engines.pending(window)).toBe(true)
  current = 'https://filekeeper.net/changed'
  engines.stop()
  finish(`<a href="${url}">Download</a>`)
  await new Promise((resolve) => setImmediate(resolve))
  expect(engines.poll(window)).toBeUndefined()
})

it('rejects oversized input and non-native source plugins without starting engines', async () => {
  await readDirectPage('a'.repeat(2097153), base, manifest, allowed)
  await readDirectPage(
    '<main/>',
    base,
    { ...manifest, id: 'third-party' },
    allowed
  )
  expect(withSourceEngine).not.toHaveBeenCalled()
})

it('does not start Obscura when cancellation occurs during the Scrapling operation', async () => {
  let active = true
  jest
    .mocked(withSourceEngine)
    .mockImplementation(async (_id, run) => run('worker', '/unused'))
  jest.mocked(engineProcess).mockImplementation(async () => {
    active = false
    return JSON.stringify(response([]))
  })
  expect(
    await readDirectPage('<main/>', base, manifest, allowed, () => active)
  ).toEqual({ links: [], entries: [] })
  expect(experimentalPage).not.toHaveBeenCalled()
})
