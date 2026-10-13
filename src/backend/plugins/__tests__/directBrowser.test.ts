import { EventEmitter } from 'events'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { BrowserWindow, session } from 'electron'
import { AnkerAccount, directDownloadManifest } from '../ankerAccount'
import { NetworkGuard } from '../networkGuard'
import { loadAnkerPage, evaluateAnkerPage } from '../ankerNavigation'
import { resolveOnlineFixTorrentLink } from '../onlineFixTorrent'
import { ROM_SOURCES, romSource } from '../romSources'
import * as rangeTransfer from '../rangedDownload'
import {
  OnlineFixAccount,
  onlineFixGameUrl,
  onlineFixDownloadUrl
} from '../onlineFixAccount'

jest.mock('../ankerNavigation', () => ({
  loadAnkerPage: jest.fn().mockResolvedValue(undefined),
  evaluateAnkerPage: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('../onlineFixTorrent', () => ({ resolveOnlineFixTorrentLink: jest.fn() }))
jest.mock('electron', () => {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events')
  const isolated = Object.assign(new EventEmitter(), {
    setPermissionRequestHandler: jest.fn(),
    setPermissionCheckHandler: jest.fn(),
    webRequest: { onBeforeRequest: jest.fn() }
  })
  let id = 0
  const makeWindow = () => {
    let destroyed = false
    return Object.assign(new EventEmitter(), {
      webContents: Object.assign(new EventEmitter(), {
        id: ++id,
        session: isolated,
        setWindowOpenHandler: jest.fn(),
        executeJavaScript: jest.fn(),
        getURL: jest.fn()
      }),
      isDestroyed: () => destroyed,
      destroy: jest.fn(() => {
        destroyed = true
      }),
      hide: jest.fn(),
      loadURL: jest.fn()
    })
  }
  return {
    session: { fromPartition: () => isolated },
    BrowserWindow: jest.fn(),
    makeWindow
  }
})

beforeEach(() => {
  jest
    .mocked(BrowserWindow)
    .mockImplementation(jest.requireMock('electron').makeWindow)
  jest.mocked(loadAnkerPage).mockResolvedValue(undefined)
  jest.mocked(evaluateAnkerPage).mockResolvedValue(undefined)
})

it('automatically follows the Online-Fix torrent directory on port 2053 and captures its file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ghost-onlinefix-auto-'))
  const destination = join(directory, 'source.torrent')
  const controller = new AbortController()
  const constructor = jest.mocked(BrowserWindow)
  const before = constructor.mock.results.length
  const page = 'https://online-fix.me/games/strategy/18267-uno-online.html'
  const folder = 'https://uploads.online-fix.me:2053/torrents/UNO/'
  const file = `${folder}UNO.Build.12012023-OFME.torrent`
  const task = OnlineFixAccount.torrent(page, destination, controller.signal)
  const outcome = task.catch(error => error as Error)
  try {
    for (let i = 0; i < 100 && constructor.mock.results.length === before; i++)
      await new Promise(resolve => setTimeout(resolve, 5))
    const parent = constructor.mock.results[before].value as BrowserWindow
    jest.mocked(parent.webContents.getURL).mockReturnValue(page)
    jest.mocked(evaluateAnkerPage).mockResolvedValue({ url: page, html: `<a href="${folder}">Torrent</a>` })
    jest.mocked(resolveOnlineFixTorrentLink).mockResolvedValue(folder)
    parent.webContents.emit('dom-ready')
    for (let i = 0; i < 100 && !jest.mocked(parent.loadURL).mock.calls.length; i++)
      await new Promise(resolve => setTimeout(resolve, 5))
    expect(parent.loadURL).toHaveBeenCalledWith(folder, { httpReferrer: page })
    expect(parent.webContents.executeJavaScript).not.toHaveBeenCalled()
    const popup = jest.mocked(parent.webContents.setWindowOpenHandler).mock.calls[0][0]
    expect(popup({ url: folder } as Electron.HandlerDetails).action).toBe('allow')
    const gateway = 'https://loot-reward.com/t?cc=fixture'
    expect(popup({ url: gateway } as Electron.HandlerDetails).action).toBe('deny')
    const navigation = { preventDefault: jest.fn() }
    parent.webContents.emit('will-navigate', navigation, gateway)
    expect(navigation.preventDefault).toHaveBeenCalled()
    const decision = jest.fn()
    const request = jest.mocked(session.fromPartition('unused').webRequest.onBeforeRequest).mock.calls.at(-1)![0]
    expect(request).not.toBeNull()
    request!({ url: folder } as Electron.OnBeforeRequestListenerDetails, decision)
    expect(decision).toHaveBeenCalledWith({ cancel: false })
    request!({ url: gateway } as Electron.OnBeforeRequestListenerDetails, decision)
    expect(decision).toHaveBeenLastCalledWith({ cancel: true })
    const download = Object.assign(new EventEmitter(), {
      getFilename: () => 'UNO.torrent', getURL: () => page,
      getURLChain: () => [page, file], getTotalBytes: () => 100,
      getReceivedBytes: () => 100, setSavePath: jest.fn(), cancel: jest.fn()
    })
    session.fromPartition('unused').emit('will-download', {}, download, parent.webContents)
    await writeFile(destination, 'd4:infod6:lengthi1e4:name8:game.zipee')
    download.emit('done', {}, 'completed')
    expect(Buffer.isBuffer(await outcome)).toBe(true)
    expect(download.setSavePath).toHaveBeenCalledWith(destination)
  } finally {
    controller.abort()
    await outcome
    await rm(directory, { recursive: true, force: true })
  }
})

it('restricts Online-Fix pages and torrent hosts', () => {
  expect(
    onlineFixGameUrl('https://online-fix.me/games/test.html?token=abc')
  ).toBe('https://online-fix.me/games/test.html')
  expect(
    onlineFixDownloadUrl('https://uploads.online-fix.me/game.torrent')
  ).toBe(true)
  for (const url of [
    'https://online-fix.me.evil.test/game.torrent',
    'http://online-fix.me/game.torrent',
    'https://user:pass@online-fix.me/game.torrent'
  ]) {
    expect(onlineFixDownloadUrl(url)).toBe(false)
    expect(() => onlineFixGameUrl(url)).toThrow()
  }
})

it.each([true, false])(
  'validates Online-Fix torrent contents from a child window (valid=%s)',
  async (valid) => {
    const directory = await mkdtemp(join(tmpdir(), 'ghost-onlinefix-test-'))
    const destination = join(directory, 'game.torrent')
    const controller = new AbortController()
    const constructor = jest.mocked(BrowserWindow)
    const before = constructor.mock.results.length
    const task = OnlineFixAccount.torrent(
      'https://online-fix.me/games/test.html',
      destination,
      controller.signal
    )
    const outcome = task.then(
      (value) => ({ value, error: undefined }),
      (error) => ({ value: undefined, error })
    )
    try {
      for (
        let attempt = 0;
        attempt < 100 && constructor.mock.results.length === before;
        attempt++
      )
        await new Promise((resolve) => setTimeout(resolve, 5))
      const parent = constructor.mock.results[before].value as BrowserWindow
      const child = new BrowserWindow()
      parent.webContents.emit('did-create-window', child)
      const download = Object.assign(new EventEmitter(), {
        getFilename: () => 'game.torrent',
        getURL: () => 'https://uploads.online-fix.me:2053/torrents/Test/game.torrent',
        getTotalBytes: () => 100,
        getReceivedBytes: () => 100,
        setSavePath: jest.fn(),
        cancel: jest.fn()
      })
      session
        .fromPartition('unused')
        .emit('will-download', {}, download, child.webContents)
      expect(download.setSavePath).toHaveBeenCalledWith(destination)
      await writeFile(
        destination,
        valid ? 'd4:infod6:lengthi1e4:name8:game.zipee' : '<html>login</html>'
      )
      download.emit('done', {}, 'completed')
      const result = await outcome
      if (valid) expect(Buffer.isBuffer(result.value)).toBe(true)
      else expect(result.error).toBeInstanceOf(Error)
      expect(child.destroy).toHaveBeenCalled()
      expect(parent.destroy).toHaveBeenCalled()
      expect(
        session.fromPartition('unused').listenerCount('will-download')
      ).toBe(0)
    } finally {
      controller.abort()
      await outcome
      await rm(directory, { recursive: true, force: true })
    }
  }
)

it('scopes the observed Download Now relay to Anker without trusting lookalike hosts', () => {
  const relay = 'https://tunnel5.dlproxy.uk/file.zip'
  expect(
    NetworkGuard.validateUrl(relay, directDownloadManifest(false)).allowed
  ).toBe(true)
  expect(
    NetworkGuard.validateUrl(relay, directDownloadManifest(true)).allowed
  ).toBe(false)
  for (const url of [
    'https://tunnel5.dlproxy.uk.evil.test/file.zip',
    'https://unobserved.dlproxy.uk/file.zip'
  ])
    expect(
      NetworkGuard.validateUrl(url, directDownloadManifest(false)).allowed
    ).toBe(false)
})

it('permits the observed FileDitch relay only in the SteamRIP download manifest', () => {
  const file = 'https://blehpooffileditch.org/balpha4/fixture/Ball-x-Pit-SteamRIP.com.rar'
  expect(NetworkGuard.validateUrl(file, directDownloadManifest(true)).allowed).toBe(true)
  expect(NetworkGuard.validateUrl(file, directDownloadManifest(false)).allowed).toBe(false)
  expect(NetworkGuard.validateUrl('https://blehpooffileditch.org.evil.test/game.rar',
    directDownloadManifest(true)).allowed).toBe(false)
})

it('permits the observed MegaDB file server only in the SteamRIP download manifest', () => {
  const file = 'https://fs4.megadb.xyz/files/fixture/iRacing-Arcade.rar'
  expect(
    NetworkGuard.validateUrl(file, directDownloadManifest(true)).allowed
  ).toBe(true)
  expect(
    NetworkGuard.validateUrl(file, directDownloadManifest(false)).allowed
  ).toBe(false)
  for (const url of [
    'https://fs4.megadb.xyz.evil.test/game.rar',
    'https://fs5.megadb.xyz/game.rar',
    'https://megadb.xyz/game.rar'
  ]) {
    expect(
      NetworkGuard.validateUrl(url, directDownloadManifest(true)).allowed
    ).toBe(false)
  }
})

it.each(['anker', 'steamrip', 'steamrip-fileditch', 'steamrip-megadb', ...ROM_SOURCES.map(source => source.id)])(
  'captures a %s file from a permitted child window without replacing POST navigation',
  async (provider) => {
    const actualProvider = provider.startsWith('steamrip-') ? 'steamrip' : provider
    const directory = await mkdtemp(join(tmpdir(), 'ghost-direct-test-'))
    const controller = new AbortController()
    const constructor = jest.mocked(BrowserWindow)
    const before = constructor.mock.results.length
    const progress = jest.fn()
    const rom = romSource(provider)
    const extension = rom ? 'nsp' : provider.startsWith('steamrip-') ? 'rar' : 'zip'
    const task = AnkerAccount.direct(
      rom ? `https://${rom.domain}/test-game/` : provider === 'anker'
        ? 'https://ankergames.net/game/test'
        : 'https://steamrip.com/test/',
      directory,
      controller.signal,
      progress,
      actualProvider
    )
    try {
      for (
        let attempt = 0;
        attempt < 100 && constructor.mock.results.length === before;
        attempt++
      )
        await new Promise((resolve) => setTimeout(resolve, 5))
      const parent = constructor.mock.results[before].value as BrowserWindow
      const handler = jest.mocked(parent.webContents.setWindowOpenHandler).mock
        .calls[0][0]
      const fileUrl =
        provider === 'anker'
          ? 'https://tunnel5.dlproxy.uk/game.zip'
          : provider === 'steamrip-fileditch'
            ? 'https://blehpooffileditch.org/balpha4/fixture/Ball-x-Pit-SteamRIP.com.rar'
            : provider === 'steamrip-megadb'
              ? 'https://fs4.megadb.xyz/files/fixture/iRacing-Arcade.rar'
              : 'https://store1.gofile.io/game.zip'
      const options = handler({
        url: fileUrl,
        postBody: { data: [] }
      } as unknown as Electron.HandlerDetails)
      expect(options.action).toBe('allow')
      const requestGuard = jest
        .mocked(session.fromPartition('unused').webRequest.onBeforeRequest)
        .mock.calls.at(-1)![0] as unknown as (
        details: object,
        callback: (result: object) => void
      ) => void
      const decision = jest.fn()
      requestGuard({ url: fileUrl, resourceType: 'mainFrame' }, decision)
      expect(decision).toHaveBeenCalledWith({ cancel: false })
      if (provider === 'steamrip-megadb') {
        const navigation = { preventDefault: jest.fn() }
        parent.webContents.emit('will-navigate', navigation, fileUrl)
        parent.webContents.emit('will-redirect', navigation, fileUrl)
        expect(navigation.preventDefault).not.toHaveBeenCalled()
        const httpUrl = fileUrl.replace('https:', 'http:')
        expect(handler({ url: httpUrl } as Electron.HandlerDetails).action).toBe(
          'deny'
        )
        requestGuard({ url: httpUrl, resourceType: 'mainFrame' }, decision)
        expect(decision).toHaveBeenLastCalledWith({ cancel: true })
      }
      expect(parent.loadURL).not.toHaveBeenCalled()
      expect(
        handler({
          url: 'https://untrusted.test/file'
        } as Electron.HandlerDetails).action
      ).toBe('deny')
      const child = new BrowserWindow()
      parent.webContents.emit('did-create-window', child)
      const download = Object.assign(new EventEmitter(), {
        getFilename: () => `game.${extension}`,
        canResume: () => false,
        getState: () => 'completed',
        getURL: () => fileUrl,
        getReceivedBytes: () => 123,
        getTotalBytes: () => 123,
        setSavePath: jest.fn(),
        cancel: jest.fn()
      })
      session
        .fromPartition('unused')
        .emit('will-download', {}, download, child.webContents)
      expect(download.setSavePath).toHaveBeenCalledWith(
        expect.stringContaining(`package.${extension}`)
      )
      download.emit('done', {}, 'completed')
      await expect(task).resolves.toContain(`package.${extension}`)
      expect(progress).toHaveBeenCalledWith(123, 123, expect.any(String))
      expect(child.destroy).toHaveBeenCalled()
      expect(parent.destroy).toHaveBeenCalled()
      expect(
        session.fromPartition('unused').listenerCount('will-download')
      ).toBe(0)
    } finally {
      controller.abort()
      await task.catch(() => undefined)
      await rm(directory, { recursive: true, force: true })
    }
  }
)

it('records blocked host dependencies and navigation failures without recording private URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ghost-direct-diagnostics-'))
  const controller = new AbortController()
  const constructor = jest.mocked(BrowserWindow)
  const before = constructor.mock.results.length
  const diagnostic = jest.fn()
  const task = AnkerAccount.direct('https://steamrip.com/test/', directory,
    controller.signal, jest.fn(), 'steamrip', diagnostic).catch(error => error)
  try {
    for (let i = 0; i < 100 && constructor.mock.results.length === before; i++)
      await new Promise(resolve => setTimeout(resolve, 5))
    const parent = constructor.mock.results[before].value as BrowserWindow
    const requestGuard = jest.mocked(session.fromPartition('unused').webRequest.onBeforeRequest)
      .mock.calls.at(-1)![0] as unknown as (details: object, callback: (result: object) => void) => void
    const decision = jest.fn()
    const blocked = { url: 'https://blocked.test/script.js?token=private', resourceType: 'script' }
    requestGuard(blocked, decision)
    requestGuard(blocked, decision)
    expect(decision).toHaveBeenLastCalledWith({ cancel: true })
    expect(diagnostic).toHaveBeenCalledTimes(1)
    expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({
      event: 'request-blocked-script', host: 'blocked.test'
    }))
    requestGuard({ url: 'https://megadb.net/file', resourceType: 'mainFrame' }, decision)
    expect(decision).toHaveBeenLastCalledWith({ cancel: false })
    parent.webContents.emit('did-fail-load', {}, -3, 'aborted', 'https://megadb.net/file', true)
    expect(diagnostic).toHaveBeenCalledTimes(1)
    parent.webContents.emit('did-fail-load', {}, -105, 'private description', 'https://megadb.net/file?secret=private', true)
    expect(diagnostic).toHaveBeenLastCalledWith(expect.objectContaining({
      event: 'navigation-failed-main--105', host: 'megadb.net'
    }))
    expect(JSON.stringify(diagnostic.mock.calls)).not.toMatch(/private|secret|token|https:/)
    diagnostic.mockImplementation(() => { throw new Error('logger failed') })
    expect(() => requestGuard({ url: 'https://other.test/file', resourceType: 'xhr' }, decision)).not.toThrow()
    expect(decision).toHaveBeenLastCalledWith({ cancel: true })
    controller.abort()
    await task
    const calls = diagnostic.mock.calls.length
    requestGuard({ url: 'https://late.test/file', resourceType: 'script' }, decision)
    expect(diagnostic).toHaveBeenCalledTimes(calls)
  } finally {
    controller.abort()
    await task
    await rm(directory, { recursive: true, force: true })
  }
})

it.each([true, false, 'error'])('preserves the native download until the range attempt succeeds (%s)', async (supported) => {
  const directory = await mkdtemp(join(tmpdir(), 'ghost-direct-range-test-'))
  const controller = new AbortController()
  const constructor = jest.mocked(BrowserWindow)
  const before = constructor.mock.results.length
  const ranged = jest.spyOn(rangeTransfer, 'rangedDownload').mockImplementation(async options => {
    if (supported === 'error') throw new Error('Connection interrupted')
    if (!supported) return false
    await writeFile(options.destination, 'segmented fixture')
    options.progress(options.total)
    return true
  })
  const task = AnkerAccount.direct('https://ankergames.net/game/test', directory, controller.signal, jest.fn())
  try {
    for (let i = 0; i < 100 && constructor.mock.results.length === before; i++)
      await new Promise(resolve => setTimeout(resolve, 5))
    const parent = constructor.mock.results[before].value as BrowserWindow
    const item = Object.assign(new EventEmitter(), {
      getFilename: () => 'game.zip', getURL: () => 'https://tunnel5.dlproxy.uk/game.zip',
      getTotalBytes: () => 32 * 1024 * 1024, getReceivedBytes: () => 0,
      getETag: () => '"fixture"', canResume: () => true,
      setSavePath: jest.fn(), pause: jest.fn(),
      cancel: jest.fn((): void => { item.emit('done', {}, 'cancelled') }),
      resume: jest.fn((): void => { item.emit('done', {}, 'completed') })
    })
    session.fromPartition('unused').emit('will-download', {}, item, parent.webContents)
    const path = await task
    expect(item.pause).toHaveBeenCalledTimes(1)
    if (supported === true) {
      expect(path).toContain('package-ranged.zip')
      expect(item.cancel).toHaveBeenCalledTimes(1)
      expect(item.resume).not.toHaveBeenCalled()
    } else {
      expect(path).toContain('package.zip')
      expect(item.cancel).not.toHaveBeenCalled()
      expect(item.resume).toHaveBeenCalledTimes(1)
    }
  } finally {
    controller.abort()
    await task.catch(() => undefined)
    ranged.mockRestore()
    await rm(directory, { recursive: true, force: true })
  }
})
