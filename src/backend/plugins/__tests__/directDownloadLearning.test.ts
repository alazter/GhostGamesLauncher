import { EventEmitter } from 'events'
import { mkdtemp, readFile, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
// eslint-disable-next-line no-restricted-imports -- Exercise the private channel's sender validation and disposal.
import { ipcMain } from 'electron'
import { runInNewContext } from 'vm'
import {
  DirectDownloadLearning,
  DirectDownloadRuleStore,
  confirmDirectDownloadLearning,
  downloadLearningRoute,
  learnedDownloadScript,
  validDownloadAction
} from '../directDownloadLearning'
import {
  DIRECT_LEARNING_CLICK,
  type DownloadAction
} from 'common/directDownloadLearning'
import { evaluateAnkerPage } from '../ankerNavigation'
import { PluginPacker } from '../pluginPacker'
import { DownloadEngineMemory } from '../downloadEngineMemory'

jest.mock('electron', () => ({
  ipcMain: new (jest.requireActual<typeof import('events')>(
    'events'
  ).EventEmitter)()
}))
jest.mock('backend/constants/paths', () => ({ userDataPath: '/unused' }))
jest.mock('../ankerNavigation', () => ({ evaluateAnkerPage: jest.fn() }))

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-learning-'))
})
afterEach(async () => {
  ipcMain.removeAllListeners()
  await rm(root, { recursive: true, force: true })
})

const action: DownloadAction = {
  tag: 'BUTTON',
  label: 'obter pacote',
  id: 'get-file'
}
function fixture() {
  const store = new DirectDownloadRuleStore(join(root, 'rules.json'), [])
  const learning = new DirectDownloadLearning(
    'anker',
    (url) => new URL(url).hostname === 'filekeeper.net',
    ['filekeeper.net'],
    store
  )
  const window = {
    webContents: Object.assign(new EventEmitter(), {
      id: 7,
      getURL: () => 'https://filekeeper.net/new-id/Game.zip',
      send: jest.fn()
    }),
    isDestroyed: () => false
  } as unknown as BrowserWindow
  learning.watch(window)
  const click = (overrides: object = {}) =>
    ipcMain.emit(
      DIRECT_LEARNING_CLICK,
      { sender: { id: 7 } },
      {
        page: 'https://filekeeper.net/old-id/Example.zip',
        action: { ...action, signedUrl: 'secret-token', ...overrides }
      }
    )
  return { store, learning, window, click }
}

it.each(['scrapling', 'obscura'] as const)(
  'promotes %s knowledge only after a valid complete archive, shared with manual controls',
  async (engine) => {
    const { learning, click } = fixture()
    const page = 'https://filekeeper.net/file/test?session=secret'
    learning.setManual(true)
    click()
    learning.observeEngine(engine, page, [action])
    const file = join(root, 'valid.zip')
    const bytes = PluginPacker.createZipBuffer([
      { name: 'setup.exe', content: Buffer.from('fixture') }
    ])
    await writeFile(file, bytes)
    const memory = () =>
      new DownloadEngineMemory(join(root, 'download-engine-learning.json'))
    expect(memory().controls('anker', page)).toEqual([])
    await learning.complete(file, bytes.length)
    expect(memory().controls('anker', page)).toEqual([action])
    expect(
      memory().controls('anker', 'https://filekeeper.net/other/Game.zip')
    ).toEqual([action])
    const saved = await readFile(
      join(root, 'download-engine-learning.json'),
      'utf8'
    )
    expect(saved).not.toMatch(/session|secret|test\?/)
    expect(
      (
        JSON.parse(saved) as {
          pages: Array<{ engines: Record<string, { successes: number }> }>
        }
      ).pages.some(
        (page: { engines: Record<string, { successes: number }> }) =>
          page.engines[engine].successes === 1
      )
    ).toBe(true)
    learning.dispose(false)
  }
)

it.each(['truncated', 'html', 'reset', 'cancelled'])(
  'does not teach engines from a %s operation',
  async (state) => {
    const { learning } = fixture()
    const page = 'https://filekeeper.net/file/test'
    learning.observeEngine('obscura', page, [action])
    const file = join(root, 'incomplete.zip')
    const bytes =
      state === 'html'
        ? Buffer.from('<html>error</html>')
        : PluginPacker.createZipBuffer([
            { name: 'game.exe', content: Buffer.from('fixture') }
          ])
    await writeFile(file, bytes)
    if (state === 'reset') learning.resetAttempt()
    if (state !== 'cancelled')
      await learning.complete(
        file,
        state === 'truncated' ? bytes.length + 1 : bytes.length
      )
    learning.dispose(false)
    const memory = new DownloadEngineMemory(
      join(root, 'download-engine-learning.json')
    )
    expect(memory.order('anker', page)[0]).toBe('scrapling')
    expect(memory.controls('anker', page)).toEqual([])
  }
)

it('drops engine preference after failed automatic attempts, while cancellation preserves it', () => {
  const page = 'https://filekeeper.net/file/test'
  const first = fixture()
  first.learning.engines.success('anker', {
    engine: 'obscura',
    page,
    controls: [action]
  })
  first.learning.observeEngine('obscura', page, [action])
  first.learning.dispose(false)
  expect(first.store.engineMemory().order('anker', page)[0]).toBe('obscura')
  for (let i = 0; i < 2; i++) {
    const next = fixture()
    next.learning.observeEngine('obscura', page, [action])
    next.learning.dispose(true)
  }
  expect(first.store.engineMemory().order('anker', page)[0]).toBe('scrapling')
})

it('promotes trusted-preload manual actions only after a complete archive and reuses them after restart', async () => {
  const { store, learning, window, click } = fixture()
  learning.setManual(true)
  click()
  expect(store.read()).toEqual([])
  const file = join(root, 'game.zip'),
    bytes = PluginPacker.createZipBuffer([
      { name: 'game.exe', content: Buffer.from('fixture') }
    ])
  await writeFile(file, bytes)
  await learning.complete(file, bytes.length)
  expect(store.read()).toHaveLength(1) // Valid archive metadata confirms download independently of installation.
  PluginPacker.extractZipBuffer(bytes, join(root, 'extracted'))
  confirmDirectDownloadLearning(file)
  learning.dispose()
  expect(store.read()).toHaveLength(1)
  expect(await readFile(join(root, 'rules.json'), 'utf8')).not.toMatch(
    /secret-token|old-id|Example|signedUrl/
  )
  const next = new DirectDownloadLearning(
    'anker',
    () => true,
    ['filekeeper.net'],
    new DirectDownloadRuleStore(join(root, 'rules.json'), [])
  )
  jest.mocked(evaluateAnkerPage).mockResolvedValue(true)
  expect(await next.replay(window)).toBe(true)
  expect(jest.mocked(evaluateAnkerPage).mock.calls.at(-1)?.[1]).toContain(
    'obter pacote'
  )
  next.dispose(false)
})

it.each(['unfinished', 'html', 'truncated'])(
  'does not learn from %s downloads',
  async (state) => {
    const { store, learning, click } = fixture()
    learning.setManual(true)
    click()
    const file = join(root, 'bad.zip')
    await writeFile(
      file,
      state === 'html'
        ? '<html>error</html>'
        : Buffer.from('504b030401020304', 'hex')
    )
    if (state !== 'unfinished')
      await learning.complete(file, state === 'truncated' ? 100 : 0)
    learning.dispose()
    expect(store.read()).toEqual([])
  }
)

it('rejects actions outside manual mode, other windows, other hosts, report and captcha', async () => {
  const { store, learning, click } = fixture()
  click()
  learning.setManual(true)
  click({ label: 'report abuse' })
  click({ form: { method: 'post', fields: ['g-recaptcha-response'] } })
  ipcMain.emit(
    DIRECT_LEARNING_CLICK,
    { sender: { id: 9 } },
    { page: 'https://filekeeper.net/file', action }
  )
  ipcMain.emit(
    DIRECT_LEARNING_CLICK,
    { sender: { id: 7 } },
    { page: 'https://unknown.test/file', action }
  )
  const file = join(root, 'good.zip')
  await writeFile(file, Buffer.from('504b030401020304', 'hex'))
  await learning.complete(file, 8)
  learning.dispose()
  confirmDirectDownloadLearning(file)
  expect(store.read()).toEqual([])
  expect(ipcMain.listenerCount(DIRECT_LEARNING_CLICK)).toBe(0)
})

it('disables a recipe after two unsuccessful replays', async () => {
  const { store, learning, window } = fixture()
  learning.dispose()
  store.put({
    source: 'anker',
    origin: 'https://filekeeper.net',
    route: '/*/*.zip',
    steps: [action],
    failures: 0,
    updated: Date.now()
  })
  for (let i = 0; i < 2; i++) {
    const next = new DirectDownloadLearning(
      'anker',
      () => true,
      ['filekeeper.net'],
      store
    )
    jest.mocked(evaluateAnkerPage).mockResolvedValue(true)
    expect(await next.replay(window)).toBe(true)
    next.dispose()
  }
  expect(store.read()).toEqual([])
})

it('matches a unique visible control and refuses changed, duplicated or untrusted destinations', () => {
  const click = jest.fn()
  const button = {
    tagName: 'BUTTON',
    id: 'get-file',
    textContent: 'Obter pacote',
    dataset: {},
    click,
    getClientRects: () => [{}],
    hasAttribute: () => false,
    getAttribute: () => null,
    closest: () => null
  }
  const run = (nodes: object[]) =>
    runInNewContext(learnedDownloadScript(action, ['filekeeper.net']), {
      URL,
      location: {
        href: 'https://filekeeper.net/file',
        origin: 'https://filekeeper.net'
      },
      document: { querySelectorAll: () => nodes }
    }) as unknown
  expect(run([button])).toBe(true)
  expect(click).toHaveBeenCalledTimes(1)
  expect(run([button, button])).toBe(false)
  expect(run([{ ...button, textContent: 'Denunciar' }])).toBe(false)
  expect(
    run([
      {
        ...button,
        tagName: 'A',
        href: 'https://unlisted.test/file',
        getAttribute: (name: string) =>
          name === 'href' ? 'https://unlisted.test/file' : null
      }
    ])
  ).toBe(false)
})

it('normalizes dynamic routes without storing IDs/query strings and validates only data instructions', async () => {
  expect(
    downloadLearningRoute('https://filekeeper.net/token/file.zip?secret=abc')
  ).toBe('/*/*.zip')
  expect(validDownloadAction({ ...action, label: 'Baixar?token=abc' })).toBe(
    false
  )
  const store = new DirectDownloadRuleStore(join(root, 'corrupt.json'), [])
  await writeFile(join(root, 'corrupt.json'), '{invalid')
  expect(store.read()).toEqual([])
})

it('detaches from a child closed during fallback without reading its destroyed BrowserWindow again', () => {
  const { learning, window } = fixture()
  let destroyed = false
  const contents = Object.assign(new EventEmitter(), { id: 8, send: jest.fn() })
  const child = { isDestroyed: () => destroyed } as BrowserWindow
  Object.defineProperty(child, 'webContents', {
    get: () => {
      if (destroyed) throw new Error('BrowserWindow disposed')
      return contents
    }
  })
  window.webContents.emit('did-create-window', child)
  destroyed = true
  expect(() => learning.dispose(false)).not.toThrow()
  expect(contents.listenerCount('dom-ready')).toBe(0)
  expect(contents.listenerCount('did-create-window')).toBe(0)
})

it('ships Anker recipes in a clean profile and preserves a disabled default across restarts', () => {
  const file = join(root, 'clean.json')
  const store = new DirectDownloadRuleStore(file)
  const defaults = store.read()
  expect(defaults).toHaveLength(2)
  expect(defaults.map((rule) => rule.route)).toEqual([
    '/game/*',
    '/download/*/*'
  ])
  expect(JSON.stringify(defaults)).not.toMatch(
    /token|cookie|password|alazt|24561262/i
  )
  store.failed(defaults[0])
  store.failed(store.read().find((rule) => rule.route === '/game/*')!)
  expect(
    new DirectDownloadRuleStore(file).read().map((rule) => rule.route)
  ).toEqual(['/download/*/*'])
  // A validated new manual recipe replaces the disabled default.
  store.put({
    ...defaults[0],
    steps: [action],
    updated: Date.now(),
    failures: 0
  })
  expect(
    new DirectDownloadRuleStore(file)
      .read()
      .find((rule) => rule.route === '/game/*')?.steps
  ).toEqual([action])
})

it('keeps a successful recipe until it fails rather than expiring stable controls after 30 days', () => {
  const store = new DirectDownloadRuleStore(join(root, 'old.json'), [])
  store.put({
    source: 'anker',
    origin: 'https://filekeeper.net',
    route: '/file/*',
    steps: [action],
    failures: 0,
    updated: Date.now() - 90 * 86400000
  })
  expect(store.read()).toHaveLength(1)
})

it('learns a changed manual method, persists it without installer confirmation and replays after restart', async () => {
  const { store, learning, window, click } = fixture()
  store.put({
    source: 'anker',
    origin: 'https://filekeeper.net',
    route: '/*/*.zip',
    steps: [action],
    updated: Date.now(),
    failures: 0
  })
  jest.mocked(evaluateAnkerPage).mockResolvedValue(false) // The old control no longer exists.
  expect(await learning.replay(window)).toBe(false)
  learning.setManual(true)
  click({ label: 'receber arquivo', id: 'new-button' })
  const file = join(root, 'valid.zip')
  const bytes = PluginPacker.createZipBuffer([
    { name: 'setup.exe', content: Buffer.from('fixture') }
  ])
  await writeFile(file, bytes)
  await learning.complete(file, bytes.length)
  learning.dispose(false)
  expect(store.read()[0].steps).toEqual([
    { tag: 'BUTTON', label: 'receber arquivo', id: 'new-button' }
  ])
  const restarted = new DirectDownloadLearning(
    'anker',
    () => true,
    ['filekeeper.net'],
    new DirectDownloadRuleStore(join(root, 'rules.json'), [])
  )
  jest.mocked(evaluateAnkerPage).mockResolvedValue(true)
  expect(await restarted.replay(window)).toBe(true)
  expect(jest.mocked(evaluateAnkerPage).mock.calls.at(-1)?.[1]).toContain(
    'new-button'
  )
  restarted.dispose(false)
})
