import { EventEmitter } from 'events'
import { mkdtemp, readFile, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { runInNewContext } from 'vm'
import { DirectDownloadLearning, DirectDownloadRuleStore, confirmDirectDownloadLearning, downloadLearningRoute, learnedDownloadScript, validDownloadAction } from '../directDownloadLearning'
import { DIRECT_LEARNING_CLICK, type DownloadAction } from 'common/directDownloadLearning'
import { evaluateAnkerPage } from '../ankerNavigation'
import { PluginPacker } from '../pluginPacker'

jest.mock('electron', () => ({ ipcMain: new (jest.requireActual<typeof import('events')>('events').EventEmitter)() }))
jest.mock('backend/constants/paths', () => ({ userDataPath: '/unused' }))
jest.mock('../ankerNavigation', () => ({ evaluateAnkerPage: jest.fn() }))

let root: string
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ghost-learning-')) })
afterEach(async () => { ipcMain.removeAllListeners(); await rm(root, { recursive: true, force: true }) })

const action: DownloadAction = { tag: 'BUTTON', label: 'obter pacote', id: 'get-file' }
function fixture() {
  const store = new DirectDownloadRuleStore(join(root, 'rules.json'))
  const learning = new DirectDownloadLearning('anker', url => new URL(url).hostname === 'filekeeper.net', ['filekeeper.net'], store)
  const window = { webContents: Object.assign(new EventEmitter(), { id: 7, getURL: () => 'https://filekeeper.net/new-id/Game.zip', send: jest.fn() }),
    isDestroyed: () => false } as unknown as BrowserWindow
  learning.watch(window)
  const click = (overrides: object = {}) => ipcMain.emit(DIRECT_LEARNING_CLICK, { sender: { id: 7 } },
    { page: 'https://filekeeper.net/old-id/Example.zip', action: { ...action, signedUrl: 'secret-token', ...overrides } })
  return { store, learning, window, click }
}

it('promotes trusted-preload manual actions only after a complete archive and reuses them after restart', async () => {
  const { store, learning, window, click } = fixture()
  learning.setManual(true)
  click()
  expect(store.read()).toEqual([])
  const file = join(root, 'game.zip'), bytes = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('fixture') }])
  await writeFile(file, bytes)
  await learning.complete(file, bytes.length)
  expect(store.read()).toEqual([]) // Receiving bytes alone is insufficient.
  PluginPacker.extractZipBuffer(bytes, join(root, 'extracted'))
  confirmDirectDownloadLearning(file)
  learning.dispose()
  expect(store.read()).toHaveLength(1)
  expect(await readFile(join(root, 'rules.json'), 'utf8')).not.toMatch(/secret-token|old-id|Example|signedUrl/)
  const next = new DirectDownloadLearning('anker', () => true, ['filekeeper.net'], new DirectDownloadRuleStore(join(root, 'rules.json')))
  jest.mocked(evaluateAnkerPage).mockResolvedValue(true)
  expect(await next.replay(window)).toBe(true)
  expect(jest.mocked(evaluateAnkerPage).mock.calls.at(-1)?.[1]).toContain('obter pacote')
  next.dispose(false)
})

it.each(['unfinished', 'html', 'truncated'])('does not learn from %s downloads', async state => {
  const { store, learning, click } = fixture()
  learning.setManual(true); click()
  const file = join(root, 'bad.zip')
  await writeFile(file, state === 'html' ? '<html>error</html>' : Buffer.from('504b030401020304', 'hex'))
  if (state !== 'unfinished') await learning.complete(file, state === 'truncated' ? 100 : 0)
  learning.dispose()
  expect(store.read()).toEqual([])
})

it('rejects actions outside manual mode, other windows, other hosts, report and captcha', async () => {
  const { store, learning, click } = fixture()
  click()
  learning.setManual(true)
  click({ label: 'report abuse' }); click({ form: { method: 'post', fields: ['g-recaptcha-response'] } })
  ipcMain.emit(DIRECT_LEARNING_CLICK, { sender: { id: 9 } }, { page: 'https://filekeeper.net/file', action })
  ipcMain.emit(DIRECT_LEARNING_CLICK, { sender: { id: 7 } }, { page: 'https://unknown.test/file', action })
  const file = join(root, 'good.zip'); await writeFile(file, Buffer.from('504b030401020304', 'hex'))
  await learning.complete(file, 8); learning.dispose()
  confirmDirectDownloadLearning(file)
  expect(store.read()).toEqual([])
  expect(ipcMain.listenerCount(DIRECT_LEARNING_CLICK)).toBe(0)
})

it('disables a recipe after two unsuccessful replays', async () => {
  const { store, learning, window } = fixture()
  learning.dispose()
  store.put({ source: 'anker', origin: 'https://filekeeper.net', route: '/*/*.zip', steps: [action], failures: 0, updated: Date.now() })
  for (let i = 0; i < 2; i++) {
    const next = new DirectDownloadLearning('anker', () => true, ['filekeeper.net'], store)
    jest.mocked(evaluateAnkerPage).mockResolvedValue(true)
    expect(await next.replay(window)).toBe(true)
    next.dispose()
  }
  expect(store.read()).toEqual([])
})

it('matches a unique visible control and refuses changed, duplicated or untrusted destinations', () => {
  const click = jest.fn()
  const button = { tagName: 'BUTTON', id: 'get-file', textContent: 'Obter pacote', dataset: {}, click,
    getClientRects: () => [{}], hasAttribute: () => false, getAttribute: () => null, closest: () => null }
  const run = (nodes: object[]) => runInNewContext(learnedDownloadScript(action, ['filekeeper.net']), {
    URL, location: { href: 'https://filekeeper.net/file', origin: 'https://filekeeper.net' }, document: { querySelectorAll: () => nodes }
  }) as unknown
  expect(run([button])).toBe(true)
  expect(click).toHaveBeenCalledTimes(1)
  expect(run([button, button])).toBe(false)
  expect(run([{ ...button, textContent: 'Denunciar' }])).toBe(false)
  expect(run([{ ...button, tagName: 'A', href: 'https://unlisted.test/file', getAttribute: (name: string) => name === 'href' ? 'https://unlisted.test/file' : null }])).toBe(false)
})

it('normalizes dynamic routes without storing IDs/query strings and validates only data instructions', async () => {
  expect(downloadLearningRoute('https://filekeeper.net/token/file.zip?secret=abc')).toBe('/*/*.zip')
  expect(validDownloadAction({ ...action, label: 'Baixar?token=abc' })).toBe(false)
  const store = new DirectDownloadRuleStore(join(root, 'corrupt.json'))
  await writeFile(join(root, 'corrupt.json'), '{invalid')
  expect(store.read()).toEqual([])
})

it('detaches from a child closed during fallback without reading its destroyed BrowserWindow again', () => {
  const { learning, window } = fixture()
  let destroyed = false
  const contents = Object.assign(new EventEmitter(), { id: 8, send: jest.fn() })
  const child = { isDestroyed: () => destroyed } as BrowserWindow
  Object.defineProperty(child, 'webContents', { get: () => { if (destroyed) throw new Error('BrowserWindow disposed'); return contents } })
  window.webContents.emit('did-create-window', child)
  destroyed = true
  expect(() => learning.dispose(false)).not.toThrow()
  expect(contents.listenerCount('dom-ready')).toBe(0)
  expect(contents.listenerCount('did-create-window')).toBe(0)
})
