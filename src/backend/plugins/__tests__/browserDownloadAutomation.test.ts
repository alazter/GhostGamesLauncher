import type { BrowserWindow } from 'electron'
import { BrowserDownloadAutomation } from '../browserDownloadAutomation'
import { evaluateAnkerPage } from '../ankerNavigation'
import { directDownloadManifest } from '../ankerAccount'
import { ROM_SOURCES, romManifest } from '../romSources'
import { NetworkGuard } from '../networkGuard'
import { runInNewContext } from 'vm'
import { sourceDownloadScript, sourceDownloadStatusScript } from '../sourceDownloadScript'
import { directHosterScript } from '../directHosters'
import { DirectPageEngines } from '../directPageEngines'

jest.mock('../ankerNavigation', () => ({ evaluateAnkerPage: jest.fn() }))
jest.mock('../sourceSettings', () => ({
  sourceDomains: () => [],
  isSourceUrl: (_id: string, url: string) => new URL(url).hostname === 'ankergames.net'
}))

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

function fixture(overrides: Partial<ConstructorParameters<typeof BrowserDownloadAutomation>[0]> = {}) {
  jest.useFakeTimers()
  let current = 'https://ankergames.net/game/graveyard-keeper-2'
  let visible = false
  const shownPages: string[] = []
  const window = {
    webContents: { id: 1, getURL: () => current },
    isDestroyed: () => false, isVisible: () => visible,
    show: jest.fn(() => { visible = true; shownPages.push(current) }), hide: jest.fn(() => { visible = false }),
    loadURL: jest.fn(async url => { current = url })
  } as unknown as BrowserWindow
  const fail = jest.fn()
  const wait = jest.fn()
  const automation = new BrowserDownloadAutomation({ window, family: new Set([window]), sourceId: 'anker',
    sourceName: 'AnkerGames', manifest: directDownloadManifest(false), done: () => false, fail, wait,
    gamePage: current, ...overrides })
  return { window, automation, fail, wait, shownPages }
}

it('continues from the Anker portal to FileKeeper and operates the hosting button without showing a window', async () => {
  const { window, automation } = fixture()
  jest.mocked(evaluateAnkerPage).mockImplementation(async member => {
    if (member.webContents.getURL().includes('/game/')) return { candidates: [{ url: 'https://ankergames.net/download/keeper2' }] }
    if (member.webContents.getURL().includes('/download/')) return { candidates: [{ url: 'https://filekeeper.net/keeper2' }] }
    return { clicked: true }
  })
  automation.start()
  await jest.advanceTimersByTimeAsync(3000)
  expect(window.loadURL).toHaveBeenCalledWith('https://filekeeper.net/keeper2', expect.any(Object))
  expect(window.show).not.toHaveBeenCalled()
  automation.stop()
  expect(jest.getTimerCount()).toBe(0)
})

it('uses engine links only as a fallback and keeps a successful download attempt hidden', async () => {
  const { window, automation } = fixture()
  jest.spyOn(DirectPageEngines.prototype, 'poll').mockReturnValue({ links: [{ url: 'https://filekeeper.net/engine-test', title: 'Download' }], entries: [] })
  jest.mocked(evaluateAnkerPage).mockImplementation(async member => member.webContents.getURL().includes('ankergames.net') ? { manual: true } : { clicked: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(3000)
  expect(window.loadURL).toHaveBeenCalledWith('https://filekeeper.net/engine-test', expect.any(Object))
  expect(window.show).not.toHaveBeenCalled()
  automation.stop()
})

it('does not let a pending optional engine prevent the manual window at the automatic deadline', async () => {
  const { window, automation } = fixture()
  jest.spyOn(DirectPageEngines.prototype, 'poll').mockReturnValue(undefined)
  jest.spyOn(DirectPageEngines.prototype, 'pending').mockReturnValue(true)
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ manual: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(20000)
  expect(window.show).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(25000)
  expect(window.show).toHaveBeenCalledTimes(1)
  automation.stop()
})

it('offers manual confirmation before switching to the next observed mirror', async () => {
  const { window, automation, fail } = fixture()
  jest.mocked(evaluateAnkerPage).mockImplementation(async member => member.webContents.getURL().includes('ankergames.net')
    ? { candidates: [{ url: 'https://filekeeper.net/keeper2' }, { url: 'https://gofile.io/d/keeper2' }] }
    : { clicked: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(45000)
  expect(window.show).toHaveBeenCalledTimes(1)
  expect(jest.mocked(window.loadURL).mock.calls.map(call => call[0])).toEqual(['https://filekeeper.net/keeper2'])
  await jest.advanceTimersByTimeAsync(120000)
  expect(jest.mocked(window.loadURL).mock.calls.map(call => call[0])).toEqual(['https://filekeeper.net/keeper2', 'https://gofile.io/d/keeper2'])
  expect(window.show).toHaveBeenCalledTimes(1)
  expect(fail).not.toHaveBeenCalled()
  automation.stop()
})

it('opens a manual window after a no-op click and reports both deadlines to the card', async () => {
  const { window, automation, fail, wait } = fixture()
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ clicked: true })
  const initial = Date.now()
  automation.start()
  expect(wait).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'automatic', deadline: initial + 45000 }))
  await jest.advanceTimersByTimeAsync(44000)
  expect(window.show).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(1000)
  expect(window.show).toHaveBeenCalledTimes(1)
  expect(wait).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'manual', deadline: initial + 165000 }))
  expect(fail).not.toHaveBeenCalled()
  automation.stop()
  expect(wait).toHaveBeenLastCalledWith(undefined)
})

it('keeps the watchdog running while a navigation promise never settles', async () => {
  const { window, automation, fail } = fixture()
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ candidates: [{ url: 'https://filekeeper.net/keeper2' }] })
  jest.mocked(window.loadURL).mockImplementation(() => new Promise(() => undefined))
  automation.start()
  await jest.advanceTimersByTimeAsync(45000)
  expect(window.show).toHaveBeenCalledTimes(1)
  expect(fail).not.toHaveBeenCalled()
  automation.stop()
})

it('reveals a navigated page when automatic actions cannot resolve its download', async () => {
  const { window, automation } = fixture()
  jest.mocked(evaluateAnkerPage).mockResolvedValueOnce({ candidates: [{ url: 'https://filekeeper.net/keeper2' }] })
    .mockResolvedValue({ manual: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(12000)
  expect(window.show).toHaveBeenCalledTimes(1)
  automation.stop()
})

it('does not open a late manual window after capture stops automation', async () => {
  const { window, automation } = fixture()
  let finish: (value: unknown) => void = () => undefined
  jest.mocked(evaluateAnkerPage).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  automation.start()
  await jest.advanceTimersByTimeAsync(1000)
  automation.stop()
  finish({ manual: true })
  await jest.advanceTimersByTimeAsync(50000)
  expect(window.show).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

it('shows the shared countdown only after persistent manual interaction is needed', async () => {
  const { window, automation } = fixture()
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ manual: true, requiresInteraction: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(10000)
  expect(window.show).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(1000)
  expect(window.show).toHaveBeenCalledTimes(1)
  expect(jest.mocked(evaluateAnkerPage).mock.calls.some(call => call[1].includes('ghost-direct-download-wait-notice'))).toBe(true)
  automation.stop()
})

it('shares verified FileKeeper and FileDitch servers with Anker, SteamRIP and every integrated ROM source', () => {
  for (const manifest of [directDownloadManifest(false), directDownloadManifest(true), ...ROM_SOURCES.map(source => romManifest(source.id))]) {
    for (const url of ['https://filekeeper.net/file', 'https://tunnel1.dlproxy.uk/file', 'https://blehpooffileditchstuff.org/file'])
      expect(NetworkGuard.validateUrl(url, manifest).allowed).toBe(true)
    expect(NetworkGuard.validateUrl('https://filekeeper.net.evil.test/file', manifest).allowed).toBe(false)
  }
})

it('does not open another mirror in the parent while its child hoster is preparing the file', async () => {
  const { window } = fixture()
  const child = { webContents: { id: 2, getURL: () => 'https://filekeeper.net/keeper2' },
    isDestroyed: () => false, isVisible: () => false } as unknown as BrowserWindow
  const automation = new BrowserDownloadAutomation({ window, family: new Set([window, child]), sourceId: 'anker',
    sourceName: 'AnkerGames', manifest: directDownloadManifest(false), done: () => false, fail: jest.fn() })
  jest.mocked(evaluateAnkerPage).mockImplementation(async member => member === child
    ? { clicked: true } : { candidates: [{ url: 'https://gofile.io/d/other-mirror' }] })
  automation.start()
  await jest.advanceTimersByTimeAsync(1000)
  expect(window.loadURL).not.toHaveBeenCalled()
  expect(jest.mocked(evaluateAnkerPage).mock.calls.every(call => call[0] === child)).toBe(true)
  automation.stop()
})

it('recognizes Continue to FileKeeper and excludes Copy Direct, donations, torrents and report links', () => {
  const anchor = (href: string, textContent: string) => ({ href, textContent, getAttribute: () => href })
  const result: unknown = runInNewContext(sourceDownloadScript(['ankergames.net', 'filekeeper.net']), {
    URL, location: { href: 'https://ankergames.net/download/keeper2', origin: 'https://ankergames.net' },
    document: { querySelectorAll: (selector: string) => selector.startsWith('main') ? [
      anchor('https://filekeeper.net/keeper2', 'Continue to FileKeeper'),
      anchor('https://ankergames.net/donate', 'Donate'),
      anchor('https://ankergames.net/torrent', 'Download Torrent'),
      anchor('https://abuse.filekeeper.net/file', 'Download'),
      anchor('https://tracker.test/file', 'Download Now')
    ] : [] }
  })
  expect(result).toEqual({ candidates: [{ url: 'https://filekeeper.net/keeper2', label: 'Continue to FileKeeper' }] })
})

it('infers a FileKeeper archive filename and clicks the real POST button', () => {
  const click = jest.fn()
  const filename = { getAttribute: () => null, textContent: 'Graveyard.Keeper.2.zip' }
  const button = { getAttribute: () => null, hasAttribute: () => false, textContent: 'Download', id: 'download-button',
    dataset: {}, click, getClientRects: () => [{}], closest: () => null, form: { action: 'https://filekeeper.net/keeper2' } }
  const result: unknown = runInNewContext(directHosterScript(), {
    URL, location: { hostname: 'filekeeper.net', origin: 'https://filekeeper.net' },
    document: { body: { textContent: 'Graveyard.Keeper.2.zip' }, querySelector: () => null,
      querySelectorAll: (selector: string) => selector.startsWith('#dl-filename') ? [filename] : selector === '#download-button' ? [button] : [] }
  })
  expect(result).toEqual({ clicked: true })
  expect(click).toHaveBeenCalledTimes(1)
})

it('clicks Anker dynamic hash links in hoster rows instead of ignoring them or reopening the main button', () => {
  const click = jest.fn()
  const node = { textContent: 'Download', disabled: false, dataset: {}, click,
    getClientRects: () => [{}], getAttribute: (name: string) => name === 'href' ? '#' : null,
    closest: () => ({ textContent: 'FileKeeperDownload' }) }
  const scope = { getClientRects: () => [{}], querySelectorAll: () => [node, { ...node, dataset: {}, closest: () => ({ textContent: 'DataNodesDownload' }) }] }
  const result: unknown = runInNewContext(sourceDownloadScript(['ankergames.net', 'filekeeper.net']), {
    URL, location: { href: 'https://ankergames.net/game/graveyard-keeper-2', origin: 'https://ankergames.net' },
    document: { querySelectorAll: (selector: string) => selector.startsWith('[role') ? [scope] : [] }
  })
  expect(result).toEqual({ clicked: true })
  expect(click).toHaveBeenCalledTimes(1)
})

it('prefers the observed Direct row and also recognizes a DataNodes-only option', () => {
  const run = (rows: string[]) => {
    const calls: string[] = []
    const controls = rows.map(row => ({ textContent: 'Download', disabled: false, dataset: {},
      click: () => calls.push(row), getClientRects: () => [{}], getAttribute: (name: string) => name === 'href' ? '#' : null,
      closest: () => ({ textContent: row + 'Download' }) }))
    const scope = { getClientRects: () => [{}], querySelectorAll: () => controls }
    runInNewContext(sourceDownloadScript(['ankergames.net']), { URL,
      location: { href: 'https://ankergames.net/game/example', origin: 'https://ankergames.net' },
      document: { querySelectorAll: (selector: string) => selector.startsWith('[role') ? [scope] : [] } })
    return calls
  }
  expect(run(['FileKeeper', 'DataNodes', 'Direct'])).toEqual(['Direct'])
  expect(run(['DataNodes'])).toEqual(['DataNodes'])
})

it('uses the DataNodes free-download POST control identified by its actual archive field', () => {
  const click = jest.fn()
  const filename = { getAttribute: (name: string) => name === 'value' ? 'Example.zip' : null, matches: () => true }
  const button = { textContent: 'Free Download', id: 'downloadbtn', dataset: {}, click,
    getAttribute: () => null, hasAttribute: () => false, getClientRects: () => [{}], closest: () => null,
    form: { action: 'https://datanodes.to/download' } }
  const result: unknown = runInNewContext(directHosterScript(), { URL,
    location: { hostname: 'datanodes.to', origin: 'https://datanodes.to' },
    document: { body: { textContent: 'Example.zip' }, querySelector: () => null,
      querySelectorAll: (selector: string) => selector.startsWith('#dl-filename') ? [filename] : selector === '#downloadbtn' ? [button] : [] }
  })
  expect(result).toEqual({ clicked: true })
  expect(click).toHaveBeenCalledTimes(1)
})

it('recognizes the reported Anker error without following Return Home or Refresh Page', () => {
  const click = jest.fn()
  const result: unknown = runInNewContext(sourceDownloadScript(['ankergames.net']), {
    document: { title: 'Ops matey no downloads here - AnkerGames', readyState: 'complete',
      body: { textContent: 'Download Unavailable Error Details Please complete the verification challenge and try again. Return Home Refresh Page' },
      querySelectorAll: () => [{ textContent: 'Download Unavailable', click }] }
  })
  expect(result).toEqual({ unavailable: true })
  expect(click).not.toHaveBeenCalled()
})

it('does not confuse an interactive challenge or game description with a terminal download error', () => {
  for (const title of ['Just a moment…', 'Graveyard Keeper 2 - AnkerGames']) {
    const result: unknown = runInNewContext(sourceDownloadStatusScript(), {
      document: { title, readyState: 'complete', body: { textContent: 'Review mentions Download Unavailable and Return Home' },
        querySelectorAll: () => [{ textContent: 'Graveyard Keeper 2' }] }
    })
    expect(result).toEqual({ unavailable: false, ready: true })
  }
})

it('returns to the original game in manual mode after the automatic signed link fails', async () => {
  const { window, automation, fail, wait, shownPages } = fixture()
  const game = window.webContents.getURL()
  let automaticClicks = 0
  jest.mocked(evaluateAnkerPage).mockImplementation(async (member, script) => {
    if (member.webContents.getURL().includes('/download-error')) return { unavailable: true, ready: true }
    if (script.includes('const domains =')) { automaticClicks++; return { candidates: [{ url: 'https://ankergames.net/download-error' }] } }
    return { unavailable: false, ready: true }
  })
  automation.start()
  await jest.advanceTimersByTimeAsync(15000)
  expect(jest.mocked(window.loadURL).mock.calls.map(call => call[0])).toEqual(['https://ankergames.net/download-error', game])
  expect(shownPages).toEqual([game])
  expect(automaticClicks).toBe(1)
  expect(wait).toHaveBeenCalledWith(expect.objectContaining({ returningToGame: true }))
  expect(wait).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'manual', confirmOnGamePage: true }))
  expect(fail).not.toHaveBeenCalled()
  automation.stop()
})

it('also recovers if the error appears after a manual click', async () => {
  const { window, automation, shownPages, fail } = fixture()
  const game = window.webContents.getURL()
  jest.mocked(evaluateAnkerPage).mockImplementation(async (member, script) => member.webContents.getURL().includes('/download-error')
    ? { unavailable: true, ready: true } : script.includes('const domains =') ? { manual: true } : { unavailable: false, ready: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(11000)
  await window.loadURL('https://ankergames.net/download-error')
  await jest.advanceTimersByTimeAsync(4000)
  expect(jest.mocked(window.loadURL).mock.calls.at(-1)?.[0]).toBe(game)
  expect(shownPages).toEqual([game, game])
  expect(fail).not.toHaveBeenCalled()
  automation.stop()
})

it('does not loop when the original game itself returns the same error', async () => {
  const { window, automation, fail, shownPages } = fixture()
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ unavailable: true, ready: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(10000)
  expect(window.loadURL).toHaveBeenCalledTimes(1)
  expect(fail).toHaveBeenCalledTimes(1)
  expect(shownPages).toEqual([])
  expect(jest.getTimerCount()).toBe(0)
})

it('keeps an old error hidden while reloading and bounds a stalled return to 30 seconds', async () => {
  const { window, automation, fail, shownPages } = fixture()
  await window.loadURL('https://ankergames.net/download-error')
  jest.mocked(window.loadURL).mockImplementation(() => new Promise(() => undefined))
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ unavailable: true, ready: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(15000)
  expect(fail).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(17000)
  expect(fail).toHaveBeenCalledTimes(1)
  expect(shownPages).toEqual([])
})

it('cancelling while the original page loads cannot reopen a window later', async () => {
  const { window, automation, shownPages } = fixture()
  let finish: () => void = () => undefined
  jest.mocked(window.loadURL).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ unavailable: true, ready: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(1000)
  automation.stop()
  finish()
  await jest.advanceTimersByTimeAsync(40000)
  expect(shownPages).toEqual([])
  expect(jest.getTimerCount()).toBe(0)
})

it('closes an error child and reopens the task game in the parent for manual confirmation', async () => {
  const { window, shownPages } = fixture()
  const game = window.webContents.getURL()
  let destroyed = false
  const child = { webContents: { id: 2, getURL: () => 'https://ankergames.net/download-error' },
    isDestroyed: () => destroyed, destroy: jest.fn(() => { destroyed = true }) } as unknown as BrowserWindow
  const fail = jest.fn()
  const automation = new BrowserDownloadAutomation({ window, family: new Set([window, child]), sourceId: 'anker',
    sourceName: 'AnkerGames', manifest: directDownloadManifest(false), done: () => false, fail, gamePage: game })
  jest.mocked(evaluateAnkerPage).mockImplementation(async member => member === child
    ? { unavailable: true, ready: true } : { unavailable: false, ready: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(4000)
  expect(child.destroy).toHaveBeenCalledTimes(1)
  expect(window.loadURL).toHaveBeenCalledWith(game)
  expect(shownPages).toEqual([game])
  expect(fail).not.toHaveBeenCalled()
  automation.stop()
})

it.each(['https://ankergames.net/', 'https://unlisted.test/game/keeper'])('refuses a recovery target outside the validated game page (%s)', async gamePage => {
  const { window, automation, fail } = fixture({ gamePage })
  jest.mocked(evaluateAnkerPage).mockResolvedValue({ unavailable: true, ready: true })
  automation.start()
  await jest.advanceTimersByTimeAsync(2000)
  expect(window.loadURL).not.toHaveBeenCalled()
  expect(fail).toHaveBeenCalledTimes(1)
})
