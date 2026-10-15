import { EventEmitter } from 'events'
import { mkdtemp, writeFile, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { BrowserWindow, session } from 'electron'
import { OnlineFixDirect } from '../onlineFixDirect'
jest.mock('backend/constants/paths', () => ({ userDataPath: require('path').join(require('os').tmpdir(), 'ghost-onlinefix-learning-unit'), directDownloadLearningPreloadPath: '/isolated/directDownloadLearning.js' }))
import { evaluateAnkerPage, loadAnkerPage } from '../ankerNavigation'
import { PluginPacker } from '../pluginPacker'
import { ONLINE_FIX_HOSTER_WAIT_MS, ONLINE_FIX_MANUAL_GRACE_MS } from '../onlineFixWaitNotice'

jest.mock('../ankerNavigation', () => ({ loadAnkerPage: jest.fn(), evaluateAnkerPage: jest.fn() }))
jest.mock('electron', () => {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events')
  const isolated = Object.assign(new EventEmitter(), {
    setPermissionRequestHandler: jest.fn(), setPermissionCheckHandler: jest.fn(),
    webRequest: { onBeforeRequest: jest.fn() }
  })
  let id = 0
  return { session: { fromPartition: () => isolated }, BrowserWindow: jest.fn(), makeWindow: () => {
    let destroyed = false
    let visible = false
    return Object.assign(new EventEmitter(), {
      webContents: Object.assign(new EventEmitter(), { id: ++id, session: isolated,
        getURL: jest.fn(), setWindowOpenHandler: jest.fn() }),
      isDestroyed: () => destroyed, destroy: jest.fn(() => { destroyed = true }),
      isVisible: () => visible, show: jest.fn(() => { visible = true }), hide: jest.fn(() => { visible = false }),
      loadURL: jest.fn()
    })
  } }
})

const page = 'https://online-fix.me/games/test.html'
const catalogPage = 'https://hosters.online-fix.me:2053/Test'
const names = ['Game.zip', 'Game_Fix.zip']
const catalog = `<div data-links='${JSON.stringify(names.map(file_name => ({
  file_name, direct_link: `https://fileditchfiles.st/files/${file_name}`
})))}'></div><div data-links='${JSON.stringify(names.map(file_name => ({
  file_name, direct_link: `https://pixeldrain.com/files/${file_name}`
})))}'></div>`

let root: string
const nativeItems: Array<{ cancel: jest.Mock }> = []
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-onlinefix-direct-'))
  nativeItems.length = 0
  jest.mocked(loadAnkerPage).mockImplementation(async (window, url) => {
    jest.mocked(window.webContents.getURL).mockReturnValue(url)
  })
  jest.mocked(evaluateAnkerPage).mockImplementation(async window => ({
    url: window.webContents.getURL(), html: window.webContents.getURL() === page
      ? `<a href="${catalogPage}">Hosters</a>` : catalog
  }))
  jest.mocked(BrowserWindow).mockImplementation(jest.requireMock('electron').makeWindow)
})
afterEach(async () => { jest.useRealTimers(); jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })

function deliver(window: BrowserWindow, url: string, data: Buffer, filename: string) {
  const item = Object.assign(new EventEmitter(), {
    getFilename: () => filename, getURL: () => url, getTotalBytes: () => data.length,
    getReceivedBytes: () => data.length, canResume: () => true,
    setSavePath: jest.fn(), cancel: jest.fn()
  })
  nativeItems.push(item)
  session.fromPartition('test').emit('will-download', {}, item, window.webContents)
  const file = item.setSavePath.mock.calls[0]?.[0]
  if (file) void writeFile(file, data).then(() => item.emit('done', {}, 'completed'))
}

function transfers(load: (window: BrowserWindow, url: string) => Promise<void>) {
  jest.mocked(BrowserWindow).mockImplementation(() => {
    const window = jest.requireMock('electron').makeWindow() as BrowserWindow
    jest.mocked(window.loadURL).mockImplementation(url => load(window, url))
    return window
  })
}

it('obtains both packages silently, cancels fake installer downloads and reports aggregate bytes', async () => {
  const data = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('game') }])
  transfers(async (window, url) => {
    deliver(window, url, data, 'setup.exe')
    deliver(window, `https://fileditchfiles.st/report${new URL(url).pathname}`, data, new URL(url).pathname.split('/').pop()!)
    deliver(window, url, data, new URL(url).pathname.split('/').pop()!)
  })
  const complete = jest.fn()
  const progress = jest.fn()
  const files = await OnlineFixDirect.download(page, root, new AbortController().signal, progress, complete)
  expect(files.map(file => file.role)).toEqual(['game', 'fix'])
  expect(progress).toHaveBeenLastCalledWith(data.length * 2, data.length * 2)
  expect(complete).toHaveBeenCalledTimes(2)
  expect(nativeItems.filter(item => item.cancel.mock.calls.length)).toHaveLength(4)
  const reportUrl = 'https://fileditchfiles.st/report/files/Game.zip'
  for (const call of jest.mocked(BrowserWindow).mock.results) {
    const window = call.value as BrowserWindow
    expect(window.show).not.toHaveBeenCalled()
    const popup = jest.mocked(window.webContents.setWindowOpenHandler).mock.calls[0][0]
    expect(popup({ url: reportUrl } as Electron.HandlerDetails).action).toBe('deny')
    const navigation = { preventDefault: jest.fn() }
    window.webContents.emit('will-navigate', navigation, reportUrl)
    expect(navigation.preventDefault).toHaveBeenCalled()
  }
  const request = jest.mocked(session.fromPartition('test').webRequest.onBeforeRequest).mock.calls.at(-1)![0]
  const decision = jest.fn()
  request!({ url: reportUrl } as Electron.OnBeforeRequestListenerDetails, decision)
  expect(decision).toHaveBeenCalledWith({ cancel: true })
  expect(session.fromPartition('test').listenerCount('will-download')).toBe(0)
})

it('switches mirror after a fake archive, keeping the already verified game package', async () => {
  const data = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('game') }])
  const loads: string[] = []
  transfers(async (window, url) => {
    loads.push(url)
    const filename = new URL(url).pathname.split('/').pop()!
    deliver(window, url, filename === 'Game_Fix.zip' && url.includes('fileditch') ? Buffer.from('<html>not an archive</html>') : data, filename)
  })
  const files = await OnlineFixDirect.download(page, root, new AbortController().signal, jest.fn(), jest.fn())
  expect(loads).toHaveLength(3)
  expect(loads.filter(url => url.endsWith('/Game.zip'))).toHaveLength(1)
  expect(await readFile(files[1].archive)).toEqual(data)
})

it('reuses a completed package on resume and downloads only the missing fix', async () => {
  const data = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('game') }])
  const archive = join(root, 'Game.zip')
  await writeFile(archive, data)
  const loads: string[] = []
  transfers(async (window, url) => {
    loads.push(url)
    deliver(window, url, data, new URL(url).pathname.split('/').pop()!)
  })
  const files = await OnlineFixDirect.download(page, root, new AbortController().signal, jest.fn(), jest.fn(),
    [{ name: 'Game.zip', role: 'game', archive, bytes: data.length }])
  expect(files).toHaveLength(2)
  expect(loads).toEqual(['https://fileditchfiles.st/files/Game_Fix.zip'])
})

it.each(['ERR_FAILED', 'ERR_ABORTED'])('accepts the download arriving after Chromium rejects navigation with %s', async code => {
  const data = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('game') }])
  transfers(async (window, url) => {
    setImmediate(() => deliver(window, url, data, new URL(url).pathname.split('/').pop()!))
    throw Object.assign(new Error('Navigation became a download'), { code })
  })
  const files = await OnlineFixDirect.download(page, root, new AbortController().signal, jest.fn(), jest.fn())
  expect(files).toHaveLength(2)
  expect(nativeItems.every(item => !item.cancel.mock.calls.length)).toBe(true)
})

it('abort cancels the active transfer, preserves completed packages and removes session listeners', async () => {
  const controller = new AbortController()
  const data = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('game') }])
  const completed = jest.fn()
  transfers(async (window, url) => {
    if (url.endsWith('/Game.zip')) deliver(window, url, data, 'Game.zip')
    else controller.abort()
  })
  await expect(OnlineFixDirect.download(page, root, controller.signal, jest.fn(), completed)).rejects.toThrow()
  expect(await readFile(join(root, 'Game.zip'))).toEqual(data)
  expect(completed).toHaveBeenCalledTimes(1)
  expect(session.fromPartition('test').listenerCount('will-download')).toBe(0)
})

function receiveForTest(window: BrowserWindow, signal: AbortSignal) {
  jest.mocked(window.loadURL).mockResolvedValue(undefined)
  const receive = OnlineFixDirect as unknown as { receive: (
    window: BrowserWindow, family: Set<BrowserWindow>, url: string,
    item: { name: string; role: 'game'; mirrors: [] }, directory: string,
    signal: AbortSignal, progress: (bytes: number) => void,
    context: { hoster: 'FileDitch'; next: 'FileKeeper'; attempt: number; attempts: number }
  ) => Promise<string> }
  return receive.receive(window, new Set([window]), 'https://fileditchfiles.st/files/Game.zip',
    { name: 'Game.zip', role: 'game', mirrors: [] }, root, signal, jest.fn(),
    { hoster: 'FileDitch', next: 'FileKeeper', attempt: 1, attempts: 2 }).catch(error => error as Error)
}

it('keeps unresolved pages hidden initially, then shows a countdown before trying another hoster', async () => {
  jest.useFakeTimers()
  const window = new BrowserWindow({ show: false })
  jest.mocked(window.webContents.getURL).mockReturnValue('https://fileditchfiles.st/files/Game.zip')
  jest.mocked(evaluateAnkerPage).mockImplementation(async (_window, script) =>
    script.includes('ghost-online-fix-wait-notice') ? true : { manual: true })
  const task = receiveForTest(window, new AbortController().signal)
  await jest.advanceTimersByTimeAsync(ONLINE_FIX_MANUAL_GRACE_MS)
  expect(window.show).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(1000)
  expect(window.show).toHaveBeenCalledTimes(1)
  const notices = jest.mocked(evaluateAnkerPage).mock.calls.filter(call => call[1].includes('ghost-online-fix-wait-notice'))
  expect(notices.length).toBeGreaterThan(0)
  expect(notices[0][1]).toContain('FileKeeper')
  expect(notices[0][1]).toContain('Mantenha esta janela aberta e aguarde')
  await jest.advanceTimersByTimeAsync(120000)
  expect(await task).toBeInstanceOf(Error)
  expect(jest.getTimerCount()).toBe(0)
  expect(session.fromPartition('test').listenerCount('will-download')).toBe(0)
})

it('offers manual confirmation when an automatic click does not start a transfer', async () => {
  jest.useFakeTimers()
  const window = new BrowserWindow({ show: false })
  jest.mocked(window.webContents.getURL).mockReturnValue('https://fileditchfiles.st/files/Game.zip')
  jest.mocked(evaluateAnkerPage).mockResolvedValueOnce({ clicked: true }).mockResolvedValue({ manual: true })
  const task = receiveForTest(window, new AbortController().signal)
  await jest.advanceTimersByTimeAsync(ONLINE_FIX_HOSTER_WAIT_MS)
  expect(window.show).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(120000)
  expect(await task).toBeInstanceOf(Error)
  expect(window.show).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('can reveal a genuine challenge after an automatic click, with the hoster countdown', async () => {
  jest.useFakeTimers()
  const window = new BrowserWindow({ show: false })
  jest.mocked(window.webContents.getURL).mockReturnValue('https://fileditchfiles.st/files/Game.zip')
  jest.mocked(evaluateAnkerPage).mockImplementation(async (_window, script) =>
    script.includes('ghost-online-fix-wait-notice') ? true : { manual: true, requiresInteraction: true })
  jest.mocked(evaluateAnkerPage).mockResolvedValueOnce({ clicked: true })
  const controller = new AbortController()
  const task = receiveForTest(window, controller.signal)
  await jest.advanceTimersByTimeAsync(ONLINE_FIX_MANUAL_GRACE_MS + 2000)
  expect(window.show).toHaveBeenCalledTimes(1)
  controller.abort()
  expect(await task).toBeInstanceOf(Error)
  expect(jest.getTimerCount()).toBe(0)
})

it('does not reveal a stale manual window if the attempt ends while its DOM is being read', async () => {
  jest.useFakeTimers()
  const window = new BrowserWindow({ show: false })
  jest.mocked(window.webContents.getURL).mockReturnValue('https://fileditchfiles.st/files/Game.zip')
  let completeNotice: (value: boolean) => void = () => undefined
  jest.mocked(evaluateAnkerPage).mockImplementation(async (_window, script) =>
    script.includes('ghost-online-fix-wait-notice')
      ? true : new Promise<boolean>(resolve => { completeNotice = resolve }))
  const controller = new AbortController()
  const task = receiveForTest(window, controller.signal)
  await jest.advanceTimersByTimeAsync(ONLINE_FIX_MANUAL_GRACE_MS + 1000)
  controller.abort()
  completeNotice(true)
  expect(await task).toBeInstanceOf(Error)
  expect(window.show).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})
