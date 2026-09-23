import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  gameDirectoryName,
  prepareNewInstallDirectory
} from '../installDirectory'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-directory-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('uses the package root once, preserving the inner game directory', async () => {
  const stage = join(root, '.ghost-stage-test')
  const folder = 'Assassins-Creed-Black-Flag-Resynced'
  const inner = 'Assassins Creed Black Flag Resynced'
  const executable = join(stage, folder, inner, 'ACBlackFlag.exe')
  await mkdir(join(stage, folder, inner), { recursive: true })
  await writeFile(executable, 'game')
  const result = await prepareNewInstallDirectory(stage, root, 'Game Title', [
    executable
  ])
  expect(result.directory).toBe(join(root, folder))
  expect(result.candidates).toEqual([join(stage, inner, 'ACBlackFlag.exe')])
  expect(await readFile(result.candidates[0], 'utf8')).toBe('game')
})

it('handles repeated folder names and avoids an existing destination', async () => {
  const stage = join(root, '.ghost-stage-test')
  await mkdir(join(stage, 'Game', 'Game'), { recursive: true })
  await mkdir(join(root, 'Game'))
  await writeFile(join(root, 'Game', 'keep.txt'), 'existing')
  const executable = join(stage, 'Game', 'Game', 'game.exe')
  await writeFile(executable, 'new')
  const result = await prepareNewInstallDirectory(stage, root, 'Game', [
    executable
  ])
  expect(result.directory).toBe(join(root, 'Game (2)'))
  expect(await readFile(result.candidates[0], 'utf8')).toBe('new')
  expect(await readFile(join(root, 'Game', 'keep.txt'), 'utf8')).toBe(
    'existing'
  )
})

it('names a flat package after the game and excludes unsafe names', async () => {
  const stage = join(root, '.ghost-stage-test')
  await mkdir(stage)
  await writeFile(join(stage, 'game.exe'), 'new')
  const result = await prepareNewInstallDirectory(stage, root, 'Game: Title', [
    join(stage, 'game.exe')
  ])
  expect(result.directory).toBe(join(root, 'Game- Title'))
  for (const name of ['..', 'CON', '.ghost-install.json'])
    expect(gameDirectoryName(name)).toBe('Jogo')
})
