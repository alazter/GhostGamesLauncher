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

it('unwraps redundant nested folders matching game title (Romestead/romestead)', async () => {
  const stage = join(root, '.ghost-stage-romestead')
  await mkdir(join(stage, 'Romestead', 'romestead'), { recursive: true })
  const executable = join(stage, 'Romestead', 'romestead', 'Romestead.exe')
  await writeFile(executable, 'game-binary')
  const result = await prepareNewInstallDirectory(stage, root, 'Romestead', [
    executable
  ])
  expect(result.directory).toBe(join(root, 'Romestead'))
  // Candidate should now be directly under stage, eliminating the redundant inner 'romestead'
  expect(result.candidates).toEqual([join(stage, 'Romestead.exe')])
  expect(await readFile(result.candidates[0], 'utf8')).toBe('game-binary')
})

it('retains exact destination directory when allowExisting is true (clean replace)', async () => {
  const stage = join(root, '.ghost-stage-replace')
  await mkdir(join(stage, 'Romestead'), { recursive: true })
  await mkdir(join(root, 'Romestead'))
  await writeFile(join(root, 'Romestead', 'old.exe'), 'old-binary')
  const executable = join(stage, 'Romestead', 'Romestead.exe')
  await writeFile(executable, 'new-binary')

  const result = await prepareNewInstallDirectory(
    stage,
    root,
    'Romestead',
    [executable],
    [],
    true // allowExisting = true
  )
  // Must NOT append (2) when allowExisting is true
  expect(result.directory).toBe(join(root, 'Romestead'))
  expect(await readFile(result.candidates[0], 'utf8')).toBe('new-binary')
})

it('unwraps root folder even if cosmetic files like readme.txt are present', async () => {
  const stage = join(root, '.ghost-stage-cosmetic')
  await mkdir(join(stage, 'GameFolder'), { recursive: true })
  await writeFile(join(stage, 'readme.txt'), 'instructions')
  await writeFile(join(stage, 'AnkerGames.url'), 'shortcut')
  const executable = join(stage, 'GameFolder', 'game.exe')
  await writeFile(executable, 'binary')

  const result = await prepareNewInstallDirectory(stage, root, 'Game Title', [
    executable
  ])
  expect(result.directory).toBe(join(root, 'GameFolder'))
  expect(result.candidates).toEqual([join(stage, 'game.exe')])
})

