jest.mock('../secureDns', () => ({ secureFetch: jest.fn() }))
jest.mock('../engineProcess', () => ({ engineProcess: jest.fn() }))
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { PluginPacker } from '../pluginPacker'
import { engineProcess } from '../engineProcess'
import { secureFetch } from '../secureDns'
import {
  initializeSourceEngines,
  sourceEngineAction,
  sourceEnginesState,
  withSourceEngine
} from '../sourceEngines'
import type { EngineRelease } from 'common/types/sourceEngines'

let root: string
let bundles: string
let catalog: EngineRelease[]
async function packageVersion(version: string) {
  const bytes = PluginPacker.createZipBuffer([
    { name: 'worker.exe', content: Buffer.from(version) }
  ])
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(join(bundles, `${sha256}.zip`), bytes)
  const release: EngineRelease = {
    id: 'scrapling',
    version,
    platform: process.platform,
    arch: process.arch,
    minGhostVersion: '0.3.0-beta',
    protocol: 1,
    executable: 'worker.exe',
    sha256,
    url: `https://github.com/alazter/GhostGamesLauncher/releases/download/engines-scrapling-${version}/${sha256}.zip`
  }
  return release
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-engine-tests-'))
  bundles = join(root, 'bundles')
  await mkdir(bundles)
  catalog = [await packageVersion('0.4.15')]
  await writeFile(
    join(bundles, 'catalog.json'),
    JSON.stringify({ releases: catalog })
  )
  jest.mocked(engineProcess).mockImplementation(async (executable) =>
    JSON.stringify({
      ok: true,
      protocol: 1,
      version: await readFile(executable, 'utf8')
    })
  )
  jest
    .mocked(secureFetch)
    .mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            url.includes('catalog.json')
              ? { releases: catalog }
              : { tag_name: 'v0.4.16' }
          )
        )
    )
  await initializeSourceEngines(root, bundles, '0.3.0-beta')
  await sourceEngineAction({ type: 'automatic', enabled: false })
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('installs a verified package and restores the previous version after update', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  catalog = [await packageVersion('0.4.16')]
  await sourceEngineAction({ type: 'check' })
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  expect(sourceEnginesState().engines[0]).toMatchObject({
    installed: '0.4.16',
    previous: '0.4.15'
  })
  await sourceEngineAction({ type: 'restore', id: 'scrapling' })
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.15')
  expect(sourceEnginesState().engines[0].available).toBe('0.4.15')
})
it('keeps the working version on a bad checksum and never launches that package', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  const next = await packageVersion('0.4.16')
  await writeFile(join(bundles, `${next.sha256}.zip`), 'corrupted')
  catalog = [next]
  await sourceEngineAction({ type: 'check' })
  jest.mocked(engineProcess).mockClear()
  await expect(
    sourceEngineAction({ type: 'install', id: 'scrapling' })
  ).rejects.toThrow('integridade')
  expect(engineProcess).not.toHaveBeenCalled()
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.15')
})
it('does not activate updates while the current worker is running', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  catalog = [await packageVersion('0.4.16')]
  await sourceEngineAction({ type: 'check' })
  let finish!: () => void
  let started!: () => void
  const entered = new Promise<void>((resolve) => {
    started = resolve
  })
  const run = withSourceEngine(
    'scrapling',
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
        started()
      })
  )
  await entered
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  expect(sourceEnginesState().engines[0]).toMatchObject({
    installed: '0.4.15',
    busy: true
  })
  finish()
  await run
  // Pending activation starts only after the lease is released.
  for (let i = 0; i < 100 && sourceEnginesState().engines[0].busy; i++)
    await new Promise((resolve) => setTimeout(resolve, 10))
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.16')
})

it('automatically restores a previous worker when the installed motor fails its self-test', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  catalog = [await packageVersion('0.4.16')]
  await sourceEngineAction({ type: 'check' })
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  jest.mocked(engineProcess).mockImplementation(async (executable) => {
    const version = await readFile(executable, 'utf8')
    if (version === '0.4.16') throw new Error('Worker failed')
    return JSON.stringify({ ok: true, protocol: 1, version })
  })
  await expect(
    withSourceEngine('scrapling', async () => {
      throw new Error('Worker failed')
    })
  ).rejects.toThrow('Worker failed')
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.15')
})

it('serializes concurrent source parsing instead of dropping another catalog request', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  let count = 0
  let maximum = 0
  const parse = async () => {
    maximum = Math.max(maximum, ++count)
    await new Promise((resolve) => setTimeout(resolve, 5))
    count--
    return 'parsed'
  }
  expect(
    await Promise.all([
      withSourceEngine('scrapling', parse),
      withSourceEngine('scrapling', parse)
    ])
  ).toEqual(['parsed', 'parsed'])
  expect(maximum).toBe(1)
})
