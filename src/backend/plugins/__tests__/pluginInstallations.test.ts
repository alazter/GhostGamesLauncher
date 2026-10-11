import fs from 'graceful-fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import {
  archivePluginInstallation,
  pluginInstallPath,
  preferredPluginInstallations,
  readPluginInstallations,
  reconcilePluginInstallations
} from '../pluginInstallations'

let root: string
let plugins: string
let backups: string
const id = 'com.ghost.test-source'

function install(folder: string, version: string, pluginId = id) {
  const path = join(plugins, folder)
  fs.mkdirSync(path, { recursive: true })
  fs.writeFileSync(
    join(path, 'plugin.json'),
    JSON.stringify({
      id: pluginId,
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
  root = fs.mkdtempSync(join(tmpdir(), 'ghost-plugin-installations-'))
  plugins = join(root, 'plugins')
  backups = join(root, 'backups')
  fs.mkdirSync(plugins)
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

it('selects one ID and the highest semantic version regardless of folder enumeration', () => {
  install(id, '1.9.0')
  const newest = install('test-source', '1.10.0')
  install('preview', '1.10.0-beta.1')
  install('other', '2.0.0', 'com.ghost.other')
  const files = readPluginInstallations(plugins)
  for (const entries of [files, [...files].reverse()]) {
    const selected = preferredPluginInstallations(entries)
    expect(selected).toHaveLength(2)
    expect(
      selected.find((item) => item.manifest.id === id)?.installedPath
    ).toBe(newest)
  }
  expect(readPluginInstallations(plugins)).toHaveLength(4)
})

it('prefers the canonical folder when versions tie, including unknown versions', () => {
  install('test-source', 'custom')
  const canonical = install(id, 'custom')
  const files = readPluginInstallations(plugins)
  for (const entries of [files, [...files].reverse()]) {
    expect(preferredPluginInstallations(entries)[0].installedPath).toBe(
      canonical
    )
  }
})

it('migrates the newest legacy copy, preserves old files in backups and is idempotent', () => {
  install(id, '1.1.0')
  install('test-source', '1.2.0')
  const state = join(root, 'plugins_state.json')
  const data = join(root, 'plugins_data', id, 'storage.json')
  fs.mkdirSync(join(root, 'plugins_data', id), { recursive: true })
  fs.writeFileSync(state, JSON.stringify({ [id]: { enabled: false } }))
  fs.writeFileSync(data, 'personal data')
  const result = reconcilePluginInstallations(plugins, backups)
  expect(
    readPluginInstallations(plugins).map((item) => [
      item.manifest.id,
      item.manifest.version
    ])
  ).toEqual([[id, '1.2.0']])
  expect(fs.readFileSync(join(plugins, id, 'index.js'), 'utf8')).toBe(
    'version 1.2.0'
  )
  expect(result.archived).toHaveLength(1)
  expect(fs.readFileSync(join(result.archived[0], 'index.js'), 'utf8')).toBe(
    'version 1.1.0'
  )
  expect(fs.readFileSync(state, 'utf8')).toBe(
    JSON.stringify({ [id]: { enabled: false } })
  )
  expect(fs.readFileSync(data, 'utf8')).toBe('personal data')
  expect(reconcilePluginInstallations(plugins, backups)).toEqual({
    archived: [],
    migrated: []
  })
})

it('archives duplicate legacy folders even when the canonical installation is already newer', () => {
  install(id, '1.3.0')
  install('test-source', '1.2.0')
  install('test-source-old', '1.1.0')
  const result = reconcilePluginInstallations(plugins, backups)
  expect(result.archived).toHaveLength(2)
  expect(result.migrated).toHaveLength(0)
  expect(readPluginInstallations(plugins)[0].manifest.version).toBe('1.3.0')
})

it('ignores an in-progress unpack and malformed manifests', () => {
  install(id, '1.0.0')
  install('__temp_unpacking__', '9.0.0')
  fs.mkdirSync(join(plugins, 'broken'))
  fs.writeFileSync(join(plugins, 'broken', 'plugin.json'), '{')
  const invalid = jest.fn()
  expect(readPluginInstallations(plugins, invalid)).toHaveLength(1)
  expect(invalid).toHaveBeenCalledTimes(1)
})

it.each(['..', '.', '../outside', 'C:/outside', 'folder/subfolder'])(
  'rejects an unsafe installation ID %s',
  (unsafe) => {
    expect(() => pluginInstallPath(plugins, unsafe)).toThrow()
  }
)

it('refuses moves outside the installation root or backups inside active plugins', () => {
  const source = install('test-source', '1.0.0')
  expect(() =>
    archivePluginInstallation(plugins, join(plugins, '..backup'), source)
  ).toThrow()
  expect(() => archivePluginInstallation(plugins, backups, root)).toThrow()
  expect(fs.existsSync(source)).toBe(true)
  expect(pluginInstallPath(plugins, id)).toBe(resolve(plugins, id))
})
