import fs from 'graceful-fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PluginManager } from '../pluginManager'
import { PluginPacker } from '../pluginPacker'
import { PluginHost } from '../pluginHost'
import { readPluginInstallations } from '../pluginInstallations'

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: jest.fn(),
    getVersion: () => '0.3.1-beta'
  },
  dialog: {},
  shell: {}
}))
jest.mock('backend/constants/paths', () => ({ userDataPath: '' }))
jest.mock('backend/logger', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
  logInfo: jest.fn(),
  LogPrefix: { Backend: 'backend' }
}))
jest.mock('backend/ipc', () => ({ sendFrontendMessage: jest.fn() }))
jest.mock('backend/main_window', () => ({ getMainWindow: jest.fn() }))
jest.mock('backend/config', () => ({ GlobalConfig: {} }))
jest.mock('../pluginHost', () => ({ PluginHost: jest.fn() }))
jest.mock('../sourceSettings', () => ({
  initializeSourceSettings: jest.fn(),
  sourceDomains: () => []
}))
jest.mock('../sourceEngines', () => ({ initializeSourceEngines: jest.fn() }))
jest.mock('../externalGames', () => ({
  ExternalGames: { getInstance: jest.fn() }
}))
jest.mock('../externalVersion', () => ({ refreshExternalRelease: jest.fn() }))
jest.mock('../ankerAccount', () => ({}))
jest.mock('../onlineFixAccount', () => ({}))
jest.mock('../networkGuard', () => ({}))
jest.mock('../piratasSaveKnowledge', () => ({}))
jest.mock('../torboxClient', () => ({}))

const id = 'com.ghost.test-source'
let root: string
let profile: string
let bundled: string
let manager: PluginManager
const started = jest.fn<void, [string, string]>()
const disposed = jest.fn<void, []>()

function install(parent: string, folder: string, version: string) {
  const path = join(parent, folder)
  fs.mkdirSync(path, { recursive: true })
  fs.writeFileSync(
    join(path, 'plugin.json'),
    JSON.stringify({
      id,
      name: 'Test source',
      version,
      type: 'game-source',
      permissions: []
    })
  )
  fs.writeFileSync(join(path, 'index.js'), `version ${version}`)
  return path
}

beforeEach(() => {
  jest.useFakeTimers()
  root = fs.mkdtempSync(join(tmpdir(), 'ghost-plugin-manager-'))
  profile = join(root, 'profile')
  bundled = join(root, 'app', 'plugins')
  fs.mkdirSync(join(profile, 'plugins'), { recursive: true })
  fs.mkdirSync(bundled, { recursive: true })
  const paths = jest.requireMock<{
    userDataPath: string
  }>('backend/constants/paths')
  paths.userDataPath = profile
  const electron = jest.requireMock<{
    app: { getAppPath: jest.Mock<string, []> }
  }>('electron')
  electron.app.getAppPath.mockReturnValue(join(root, 'app'))
  jest.mocked(PluginHost).mockImplementation(
    (info) =>
      ({
        start: () => {
          started(info.id, info.version)
          return Promise.resolve()
        },
        dispose: disposed,
        getDynamicCSS: () => ''
      }) as unknown as PluginHost
  )
  Reflect.set(PluginManager, 'instance', undefined)
  manager = PluginManager.getInstance()
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  fs.rmSync(root, { recursive: true, force: true })
})

it('starts one host at the newest version, preserves disabled state and does not re-create legacy folders', async () => {
  install(join(profile, 'plugins'), id, '1.1.0')
  install(join(profile, 'plugins'), 'test-source', '1.2.0')
  install(bundled, 'test-source', '1.2.0')
  await manager.init()
  expect(started.mock.calls).toEqual([[id, '1.2.0']])
  expect(manager.getPlugins()).toHaveLength(1)
  expect(fs.readdirSync(join(profile, 'plugins'))).toEqual([id])
  await manager.togglePlugin(id, false)
  started.mockClear()
  Reflect.set(PluginManager, 'instance', undefined)
  manager = PluginManager.getInstance()
  await manager.init()
  expect(manager.getPlugins()[0].isEnabled).toBe(false)
  expect(started).not.toHaveBeenCalled()
  expect(fs.readdirSync(join(profile, 'plugins'))).toEqual([id])
})

it('never downgrades an installed version when the bundled version is older', async () => {
  install(join(profile, 'plugins'), id, '2.0.0')
  const old = install(bundled, 'test-source', '1.2.0')
  fs.utimesSync(
    join(old, 'index.js'),
    new Date('2030-01-01'),
    new Date('2030-01-01')
  )
  await manager.init()
  expect(manager.getPlugins()[0].version).toBe('2.0.0')
  expect(started).toHaveBeenCalledWith(id, '2.0.0')
})

it('upgrades the canonical installation from a newer bundled version without changing its switch', async () => {
  install(join(profile, 'plugins'), id, '1.1.0')
  install(bundled, 'test-source', '1.2.0')
  fs.writeFileSync(
    join(profile, 'plugins_state.json'),
    JSON.stringify({ [id]: { enabled: false } })
  )
  await manager.init()
  expect(manager.getPlugins()[0]).toMatchObject({
    version: '1.2.0',
    isEnabled: false
  })
  expect(started).not.toHaveBeenCalled()
})

it('does not overwrite developer plugins with bundled copies', async () => {
  install(join(profile, 'plugins'), id, '1.0.0')
  install(bundled, 'test-source', '2.0.0')
  fs.writeFileSync(
    join(profile, 'plugins_state.json'),
    JSON.stringify({ [id]: { enabled: true, isDev: true } })
  )
  await manager.init()
  expect(manager.getPlugins()[0]).toMatchObject({
    version: '1.0.0',
    isDev: true
  })
})

it.each(['file', 'buffer'])(
  'package import via %s replaces duplicate installs by ID and preserves stored data',
  async (method) => {
    install(join(profile, 'plugins'), 'test-source', '1.2.0')
    install(join(profile, 'plugins'), id, '1.1.0')
    const source = install(join(root, 'source'), 'package', '1.3.0')
    const data = join(profile, 'plugins_data', id, 'storage.json')
    fs.mkdirSync(join(profile, 'plugins_data', id), { recursive: true })
    fs.writeFileSync(data, 'personal preferences')
    const packed = await PluginPacker.pack(source, join(root, 'test.ghost'))
    expect(packed.success).toBe(true)
    const result =
      method === 'file'
        ? await manager.installPlugin(packed.outputPath)
        : await manager.installFromBuffer(
            'test.ghost',
            fs.readFileSync(packed.outputPath!).toString('base64')
          )
    expect(result.success).toBe(true)
    expect(readPluginInstallations(join(profile, 'plugins'))).toHaveLength(1)
    expect(manager.getPlugins()[0].version).toBe('1.3.0')
    expect(fs.readFileSync(data, 'utf8')).toBe('personal preferences')
    expect(fs.readdirSync(join(profile, 'plugins'))).toEqual([id])
  }
)

it('loading an unpacked plugin removes its old alias and loading its own installed folder preserves files', async () => {
  install(join(profile, 'plugins'), 'test-source', '1.1.0')
  const source = install(join(root, 'source'), 'package', '1.2.0')
  expect((await manager.loadUnpacked(source)).success).toBe(true)
  expect(manager.getPlugins()).toHaveLength(1)
  const installed = join(profile, 'plugins', id)
  expect((await manager.loadUnpacked(installed)).success).toBe(true)
  expect(fs.readFileSync(join(installed, 'index.js'), 'utf8')).toBe(
    'version 1.2.0'
  )
})

it('uninstalls every alias of an ID without removing plugin data', async () => {
  install(join(profile, 'plugins'), 'test-source', '1.2.0')
  install(join(profile, 'plugins'), id, '1.1.0')
  const data = join(profile, 'plugins_data', id, 'storage.json')
  fs.mkdirSync(join(profile, 'plugins_data', id), { recursive: true })
  fs.writeFileSync(data, 'personal preferences')
  expect((await manager.uninstallPlugin(id)).success).toBe(true)
  expect(manager.getPlugins()).toEqual([])
  expect(fs.readFileSync(data, 'utf8')).toBe('personal preferences')
  expect((await manager.uninstallPlugin('../plugins_data')).success).toBe(false)
  expect(fs.readFileSync(data, 'utf8')).toBe('personal preferences')
})
