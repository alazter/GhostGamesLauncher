import { EventEmitter } from 'events'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { BrowserWindow, session } from 'electron'
import { AnkerAccount, directDownloadManifest } from '../ankerAccount'
import { NetworkGuard } from '../networkGuard'
import { loadAnkerPage } from '../ankerNavigation'
import { ROM_SOURCES, romSource } from '../romSources'
import {
  OnlineFixAccount,
  onlineFixGameUrl,
  onlineFixDownloadUrl
} from '../onlineFixAccount'

jest.mock('../ankerNavigation', () => ({
  loadAnkerPage: jest.fn().mockResolvedValue(undefined)
}))
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
        setWindowOpenHandler: jest.fn()
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
        getURL: () => 'https://uploads.online-fix.me/game.torrent',
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

it.each(['anker', 'steamrip', ...ROM_SOURCES.map(source => source.id)])(
  'captures a %s file from a permitted child window without replacing POST navigation',
  async (provider) => {
    const directory = await mkdtemp(join(tmpdir(), 'ghost-direct-test-'))
    const controller = new AbortController()
    const constructor = jest.mocked(BrowserWindow)
    const before = constructor.mock.results.length
    const progress = jest.fn()
    const rom = romSource(provider)
    const extension = rom ? 'nsp' : 'zip'
    const task = AnkerAccount.direct(
      rom ? `https://${rom.domain}/test-game/` : provider === 'anker'
        ? 'https://ankergames.net/game/test'
        : 'https://steamrip.com/test/',
      directory,
      controller.signal,
      progress,
      provider
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
