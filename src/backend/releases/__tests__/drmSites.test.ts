import {
  parseDrmSiteGame,
  findDrmSiteGame,
  drmPageUnavailable
} from '../drmSitesParser'
import {
  safeDrmSourceUrl,
  drmGameSlug,
  combinedDrmStatus,
  isConfirmedDrmReport
} from 'common/releaseDrm'
import { getAdditionalDrmSources } from '../drmSites'

const mockFetch = jest.fn()
const mockBrowser = jest.fn()
const mockHiz = jest.fn()
const mockSkidrowBrowser = jest.fn()
jest.mock('../drmManual', () => ({
  readSkidrowManualPage: (...args: unknown[]) => mockSkidrowBrowser(...args),
  readAnkerManualPage: (...args: unknown[]) => mockBrowser(...args),
  readHizManualSource: (...args: unknown[]) => mockHiz(...args)
}))
jest.mock('electron', () => ({
  net: { fetch: (...args: unknown[]) => mockFetch(...args) }
}))
const anker = 'https://ankergames.net/game/minecraft-dungeons-ii'
const skidrow = 'https://www.skidrowreloaded.com/minecraft-dungeons-ii-rune/'
const title = 'Minecraft Dungeons 2'
const document = (heading: string, content = '') =>
  `<main><h1>${heading}</h1>${content}</main>`

it('accepts only public metadata/search pages of the three additional sites', () => {
  for (const url of [
    anker,
    skidrow,
    'https://www.skidrowreloaded.com/?s=Persona%203',
    'https://ankergames.net/search/Persona%203',
    'https://hizsearch.pages.dev/'
  ])
    expect(safeDrmSourceUrl(url)).toBe(url)
  for (const url of [
    'https://ankergames.net.evil.example/game/test',
    'https://www.skidrowreloaded.com/go/malware',
    'https://www.skidrowreloaded.com/download/',
    'https://www.skidrowreloaded.com/wp-content/archive.zip',
    'https://hizsearch.pages.dev/api/search',
    'http://ankergames.net/game/test',
    'https://ankergames.net/game/test?download=1'
  ])
    expect(safeDrmSourceUrl(url)).toBeUndefined()
})
it('does not turn a scene tag, download, comment or Denuvo removal into a confirmed verdict', () => {
  const source = parseDrmSiteGame(
    document(
      'Minecraft Dungeons II',
      '<a href="/scene/rune">RUNE</a><div class="comments"><pre>DRM status: Cracked</pre></div><div class="installation"><pre>Crack: RUNE</pre></div><dl>Protection: Steam\nDenuvo removed</dl>'
    ),
    title,
    anker,
    'AnkerGames'
  )!
  expect(source).toMatchObject({ availability: 'listed', protection: 'Steam' })
  expect(source.status).toBeUndefined()
  expect(combinedDrmStatus([source])).toBe('unknown')
  expect(
    parseDrmSiteGame(
      document(
        'Minecraft Dungeons II',
        '<pre>DRM status: DRM removed (Denuvo)</pre>'
      ),
      title,
      anker,
      'AnkerGames'
    )?.status
  ).toBeUndefined()
})
it('requires a matching complete title and explicit metadata for confirmation', () => {
  const source = parseDrmSiteGame(
    document(
      'Minecraft Dungeons II-RUNE',
      '<pre>Protection: Steam\nCracked by: RUNE</pre>'
    ),
    title,
    skidrow,
    'SkidrowReloaded'
  )!
  expect(source).toMatchObject({
    status: 'cracked',
    group: 'RUNE',
    protection: 'Steam'
  })
  for (const heading of [
    'Minecraft Dungeons II Deluxe Edition-RUNE',
    'Minecraft Dungeons II Update v1.2-RUNE',
    'Minecraft Dungeons II v1.2 Deluxe Edition-RUNE',
    'Minecraft Dungeons'
  ])
    expect(
      parseDrmSiteGame(
        document(heading, '<pre>DRM status: Cracked</pre>'),
        title,
        skidrow,
        'SkidrowReloaded'
      )
    ).toBeUndefined()
  expect(
    parseDrmSiteGame(
      document('Minecraft Dungeons II') +
        '<article><h1>Another game</h1><pre>Crack: RUNE</pre></article>',
      title,
      anker,
      'AnkerGames'
    )?.status
  ).toBeUndefined()
})
it('finds matching result links, rejecting other editions and untrusted destinations', () => {
  expect(
    findDrmSiteGame(
      '<a href="/game/minecraft-dungeons-ii">Minecraft Dungeons II</a>',
      title,
      'AnkerGames'
    )
  ).toBe(anker)
  expect(
    findDrmSiteGame(
      '<a href="/minecraft-dungeons-ii-rune/">Minecraft Dungeons II-RUNE</a>',
      title,
      'SkidrowReloaded'
    )
  ).toBe(skidrow)
  expect(
    findDrmSiteGame(
      '<a href="https://evil.example/game/minecraft-dungeons-ii">Minecraft Dungeons II</a>',
      title,
      'AnkerGames'
    )
  ).toBeUndefined()
})
it.each([
  ['DRM-free', 'drm-free', true],
  ['Hypervisor', 'bypassed', false],
  ['Uncracked', 'uncracked', false]
])('only freezes a final status (%s)', (label, status, frozen) => {
  const source = parseDrmSiteGame(
    document('Minecraft Dungeons II', `<pre>DRM status: ${label}</pre>`),
    title,
    anker,
    'AnkerGames'
  )!
  expect(source.status).toBe(status)
  expect(
    isConfirmedDrmReport({
      id: 'game',
      title,
      platform: 'PC',
      status: source.status!,
      sources: [source],
      checkedAt: new Date().toISOString()
    })
  ).toBe(frozen)
})
it('detects maintenance and verification rather than claiming no matching game', () => {
  expect(
    drmPageUnavailable('<title>Skidrow is under maintenance</title>')
  ).toMatch(/manutenção/)
  expect(drmPageUnavailable('<title>Just a moment...</title>')).toMatch(
    /verificação/
  )
})
it('backs off across games even during a manual batch and retains all three source links', async () => {
  mockFetch.mockImplementation(
    async (url: string) =>
      new Response(
        url.includes('skidrow')
          ? '<title>Site is under maintenance</title>'
          : '',
        { status: url.includes('skidrow') ? 200 : 403 }
      )
  )
  const first = await getAdditionalDrmSources(title, true)
  expect(first).toHaveLength(3)
  expect(first[0].notice).toMatch(/manutenção/)
  expect(first[1].notice).toMatch(/403/)
  expect(first[2]).toMatchObject({
    name: 'HizSearch',
    notice: expect.stringMatching(/verificação manual/)
  })
  const calls = mockFetch.mock.calls.length
  await getAdditionalDrmSources('Persona 3 Reload', true)
  expect(mockFetch).toHaveBeenCalledTimes(calls)
  expect(first.every((source) => !source.status)).toBe(true)
})
it('only uses the Scrapling fallback and Hiz session in the explicit general action', async () => {
  mockBrowser.mockResolvedValue(
    document('Minecraft Dungeons II', '<pre>DRM status: Cracked</pre>')
  )
  mockHiz.mockResolvedValue({
    name: 'HizSearch',
    url: 'https://hizsearch.pages.dev/',
    requiresVerification: true
  })
  await getAdditionalDrmSources(title, true)
  expect(mockBrowser).not.toHaveBeenCalled()
  expect(mockSkidrowBrowser).not.toHaveBeenCalled()
  expect(mockHiz).not.toHaveBeenCalled()
  const sources = await getAdditionalDrmSources(title, true, true)
  expect(mockBrowser).toHaveBeenCalled()
  expect(mockSkidrowBrowser).toHaveBeenCalled()
  expect(mockHiz).toHaveBeenCalledWith(title)
  expect(sources[1].status).toBe('cracked')
  expect(sources[2].requiresVerification).toBe(true)
})

const boltgun = 'Warhammer 40,000: Boltgun 2'
const boltgunUrl =
  'https://www.skidrowreloaded.com/warhammer-40000-boltgun-2-rune/'
// Minimal structure observed on the public page (including the h2 and malformed class).
const boltgunPage = `<link rel="canonical" href="${boltgunUrl}">
<div class="post-extended class=" post-643715>
<h2>Warhammer 40000 Boltgun 2-RUNE</h2>
<div class="meta">Posted October 17, 2026 in <a rel="category tag">PC GAMES</a></div>
<p><strong>RUNE – ONE FTP LINK – TORRENT</strong></p>
<div class="wordpress-post-tabs"><div id="tabs-643715-0-0">
<p>Title: Warhammer 40,000: Boltgun 2\nGenre: Action, Indie\nRelease Date: 14 Oct, 2026</p>
<p>Warhammer 40000 Boltgun 2-RUNE\nSize: 9.9 GB</p>
</div></div></div>`

it('recognizes the complete Boltgun 2 scene announcement without requiring an h1 or NFO', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-17T12:00:00Z'))
  try {
    const source = parseDrmSiteGame(
      boltgunPage,
      boltgun,
      boltgunUrl,
      'SkidrowReloaded'
    )!
    expect(source).toMatchObject({
      status: 'cracked',
      group: 'RUNE',
      availability: 'listed',
      url: boltgunUrl
    })
    expect(source.category).toContain('17/10/2026')
    expect(source.crackDate).toBeUndefined() // Publication date is not a measured crack date.
    expect(source.protection).toBeUndefined()
    expect(combinedDrmStatus([source])).toBe('cracked')
    for (const changed of [
      boltgunPage.replace('rel="canonical"', 'rel="other"'),
      boltgunPage.replace('PC GAMES', 'GAME UPDATES'),
      boltgunPage.replace(
        'Title: Warhammer 40,000: Boltgun 2',
        'Title: Warhammer 40,000: Boltgun'
      ),
      boltgunPage.replace('Release Date: 14 Oct, 2026', 'Release Date: TBD'),
      boltgunPage.replace('Posted October 17, 2026', 'Posted October 17, 2099'),
      boltgunPage.replace('Size: 9.9 GB', 'No release metadata'),
      boltgunPage.replace('post-extended class=', 'comments')
    ])
      expect(
        parseDrmSiteGame(changed, boltgun, boltgunUrl, 'SkidrowReloaded')
          ?.status
      ).toBeUndefined()
    expect(
      parseDrmSiteGame(
        boltgunPage,
        'Warhammer 40,000: Boltgun',
        boltgunUrl,
        'SkidrowReloaded'
      )
    ).toBeUndefined()
  } finally {
    jest.useRealTimers()
  }
})

it('retains thousand separators in identity but removes them from slugs and allows only public Hiz queries', () => {
  expect(drmGameSlug(boltgun)).toBe('warhammer-40000-boltgun-2')
  expect(
    safeDrmSourceUrl('https://hizsearch.pages.dev/?q=boltgun%202')
  ).toBeDefined()
  for (const url of [
    'https://hizsearch.pages.dev/?q=test&token=secret',
    'https://hizsearch.pages.dev/?q=a&q=b',
    'https://hizsearch.pages.dev/api?q=a'
  ])
    expect(safeDrmSourceUrl(url)).toBeUndefined()
  expect(
    drmPageUnavailable(
      '<title>Access denied</title><h1>Error 1015</h1><p>You are being rate limited</p>'
    )
  ).toContain('limite temporário')
})

it('finds Boltgun 2 through the normal search path and records the corrected Anker slug', async () => {
  jest.resetModules()
  const { getAdditionalDrmSources: read } = await import('../drmSites')
  mockFetch.mockImplementation((url: string) =>
    Promise.resolve(
      new Response(
        url === boltgunUrl
          ? boltgunPage
          : url.includes('skidrowreloaded')
            ? `<h2><a href="${boltgunUrl}">Warhammer 40000 Boltgun 2-RUNE</a></h2>`
            : '',
        { status: url.includes('ankergames') ? 404 : 200 }
      )
    )
  )
  const result = await read(boltgun, true)
  expect(result[0]).toMatchObject({
    status: 'cracked',
    group: 'RUNE',
    url: boltgunUrl
  })
  expect(mockFetch).toHaveBeenCalledWith(
    'https://ankergames.net/game/warhammer-40000-boltgun-2',
    expect.anything()
  )
  expect(result[2].url).toContain('?q=Warhammer')
  expect(mockBrowser).not.toHaveBeenCalled()
})

it('honors Anker Retry-After even during manual refresh without starting the browser fallback', async () => {
  jest.resetModules()
  const { getAdditionalDrmSources: read } = await import('../drmSites')
  const started = Date.now()
  const now = jest.spyOn(Date, 'now').mockReturnValue(started)
  mockFetch.mockImplementation((url: string) =>
    Promise.resolve(
      new Response('', {
        status: url.includes('ankergames') ? 429 : 404,
        headers: { 'Retry-After': '180' }
      })
    )
  )
  mockHiz.mockResolvedValue({
    name: 'HizSearch',
    url: 'https://hizsearch.pages.dev/',
    requiresVerification: true
  })
  try {
    expect((await read(boltgun, true, true))[1].notice).toContain('429')
    expect(mockBrowser).not.toHaveBeenCalled()
    const calls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('ankergames')
    ).length
    now.mockReturnValue(started + 61000)
    expect((await read('Other', true, true))[1].notice).toContain(
      'limite temporário'
    )
    expect(
      mockFetch.mock.calls.filter(([url]) => String(url).includes('ankergames'))
    ).toHaveLength(calls)
    now.mockReturnValue(started + 181000)
    await read(boltgun, true, true)
    expect(
      mockFetch.mock.calls.filter(([url]) => String(url).includes('ankergames'))
    ).toHaveLength(calls + 1)
  } finally {
    now.mockRestore()
  }
})
