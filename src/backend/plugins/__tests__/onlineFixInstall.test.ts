import { mkdtemp, mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { PluginPacker } from '../pluginPacker'
import { applyOnlineFixPackages, onlineFixPackageRoots } from '../onlineFixInstall'

let root: string
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ghost-fix-overlay-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it('keeps a meaningful x64 fix folder instead of stripping it', async () => {
  const stage = join(root, 'stage')
  await mkdir(join(stage, 'x64'), { recursive: true })
  await writeFile(join(stage, 'game.exe'), 'game')
  await writeFile(join(stage, 'x64/steam_api64.dll'), 'original')
  const archive = join(root, 'Game_Fix.zip')
  const data = PluginPacker.createZipBuffer([{ name: 'x64/steam_api64.dll', content: Buffer.from('patched') }])
  await writeFile(archive, data)
  await applyOnlineFixPackages([{ name: 'Game_Fix.zip', role: 'fix', archive, bytes: data.length }], stage, [join(stage, 'game.exe')])
  expect(await readFile(join(stage, 'x64/steam_api64.dll'), 'utf8')).toBe('patched')
  expect(await readFile(join(stage, 'game.exe'), 'utf8')).toBe('game')
})

it('rejects reserved installer metadata in a fix', async () => {
  const stage = join(root, 'stage')
  await mkdir(stage)
  await writeFile(join(stage, 'game.exe'), 'game')
  const archive = join(root, 'Game_Fix.zip')
  const data = PluginPacker.createZipBuffer([{ name: '.ghost-install.json', content: Buffer.from('{}') }])
  await writeFile(archive, data)
  await expect(applyOnlineFixPackages([{ name: 'Game_Fix.zip', role: 'fix', archive, bytes: data.length }], stage, [join(stage, 'game.exe')])).rejects.toThrow('reservado')
})

it('extracts only the first volume of each multipart package', () => {
  const files = ['Game.part01.rar', 'Game.part02.rar', 'Game_Fix.rar'].map(name => ({
    name, role: name.includes('Fix') ? 'fix' as const : 'game' as const, archive: join(root, name), bytes: 1
  }))
  expect(onlineFixPackageRoots(files).map(file => file.name)).toEqual(['Game.part01.rar', 'Game_Fix.rar'])
})
