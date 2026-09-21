import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  extractGame,
  copySaveSnapshot,
  restoreSaveSnapshot
} from '../externalFiles'
import { archivePathIsSafe, inside, isNewerRelease } from '../externalPolicy'
import { PluginPacker } from '../pluginPacker'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolve7zPath } from '../externalFiles'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-files-test-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it.each([
  '../escape',
  '/absolute',
  'C:/escape',
  'folder\\escape',
  'saves/../escape',
  'game.exe:stream',
  'CON.txt',
  'folder. /game'
])('rejects unsafe archive entry %s', (name) => {
  expect(archivePathIsSafe(name)).toBe(false)
})

it('does not confuse sibling directory prefixes with children', () => {
  expect(inside(join(root, 'game'), join(root, 'game-other', 'file'))).toBe(
    false
  )
  expect(inside(join(root, 'game'), join(root, 'game', 'saves'))).toBe(true)
})

it('rejects a traversal ZIP before creating its payload', async () => {
  const zip = join(root, 'bad.zip')
  await writeFile(
    zip,
    PluginPacker.createZipBuffer([
      { name: '../escaped.exe', content: Buffer.from('bad') }
    ])
  )
  await expect(extractGame(zip, join(root, 'extract'))).rejects.toThrow()
  await expect(extractGame(zip, join(root, 'with-password'), 'online-fix.me')).rejects.toThrow()
  await expect(readFile(join(root, 'escaped.exe'))).rejects.toThrow()
})

it.each(['zip', '7z'])('extracts a real password-protected %s and rejects an incorrect password', async format => {
  const sevenZip = await resolve7zPath()
  if (!sevenZip) throw new Error('Install 7-Zip to run encrypted archive integration tests.')
  const payload = join(root, 'game.exe')
  const archive = join(root, `encrypted.${format}`)
  await writeFile(payload, 'test game payload')
  await promisify(execFile)(sevenZip, ['a', `-t${format}`, '-ponline-fix.me', ...(format === '7z' ? ['-mhe=on'] : []), archive, payload])
  const output = join(root, 'unpacked')
  expect(await extractGame(archive, output, 'online-fix.me')).toEqual([join(output, 'game.exe')])
  expect(await readFile(join(output, 'game.exe'), 'utf8')).toBe('test game payload')
  await expect(extractGame(archive, join(root, 'wrong'), 'incorrect')).rejects.toThrow(/senha|Online-Fix/)
  // 7-Zip may leave an empty staging file after rejecting a ZIP password.
  // Extraction must fail; this stage must never be promoted to an installation.
  expect(await readFile(join(root, 'wrong', 'game.exe'), 'utf8').catch(() => '')).not.toBe('test game payload')
})

it('verifies all snapshot files before restoring any of them', async () => {
  const saves = join(root, 'saves'),
    backup = join(root, 'backup')
  await mkdir(saves)
  await writeFile(join(saves, 'slot1'), 'one')
  await writeFile(join(saves, 'slot2'), 'two')
  await copySaveSnapshot(saves, backup)
  await writeFile(join(saves, 'slot1'), 'live state')
  await writeFile(join(backup, 'slot2'), 'corrupted')
  await expect(restoreSaveSnapshot(backup, saves)).rejects.toThrow('corrompido')
  expect(await readFile(join(saves, 'slot1'), 'utf8')).toBe('live state')
})

it('compares numeric versions without treating unknown formats as new releases', () => {
  expect(isNewerRelease('1.9', '1.10')).toBe(true)
  expect(isNewerRelease('1.10', '1.9')).toBe(false)
  expect(isNewerRelease('Build 123', 'Build 124')).toBe(true)
  expect(isNewerRelease('1.0', 'Build 124')).toBe(false)
  expect(isNewerRelease('unknown', '2026-09-15')).toBe(false)
})
