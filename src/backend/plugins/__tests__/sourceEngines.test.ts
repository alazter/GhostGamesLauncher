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
async function packageVersion(
  version: string,
  id: EngineRelease['id'] = 'scrapling',
  revision = 0
) {
  const bytes = PluginPacker.createZipBuffer([
    { name: 'worker.exe', content: Buffer.from(version) },
    { name: 'integration.txt', content: Buffer.from(String(revision)) }
  ])
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(join(bundles, `${sha256}.zip`), bytes)
  const release: EngineRelease = {
    id,
    integrationRevision: revision,
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

it('keeps a newer bundled integration when the remote catalog still has the same upstream version with an older worker', async () => {
  const local = { ...catalog[0], integrationRevision: 1 }
  await writeFile(
    join(bundles, 'catalog.json'),
    JSON.stringify({ releases: [local] })
  )
  await initializeSourceEngines(root, bundles, '0.3.0-beta')
  await sourceEngineAction({ type: 'automatic', enabled: false })
  await sourceEngineAction({ type: 'check' })
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  const state = JSON.parse(
    await readFile(join(root, 'source-engines', 'state.json'), 'utf8')
  )
  expect(state.installed.scrapling.integrationRevision).toBe(1)
})

it.each(['scrapling', 'obscura'] as const)(
  'exposes and manually installs a compatible update for %s',
  async (id) => {
    const current = id === 'scrapling' ? '0.4.15' : '0.2.3'
    const next = id === 'scrapling' ? '0.4.16' : '0.2.4'
    catalog = [await packageVersion(current, id)]
    await writeFile(
      join(bundles, 'catalog.json'),
      JSON.stringify({ releases: catalog })
    )
    await initializeSourceEngines(root, bundles, '0.3.0-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    await sourceEngineAction({ type: 'install', id })
    catalog = [await packageVersion(next, id)]
    await sourceEngineAction({ type: 'check' })
    expect(
      sourceEnginesState().engines.find((engine) => engine.id === id)
    ).toMatchObject({
      installed: current,
      available: next,
      updateAvailable: true
    })
    await sourceEngineAction({ type: 'verify', id })
    expect(
      sourceEnginesState().engines.find((engine) => engine.id === id)?.installed
    ).toBe(current)
    await sourceEngineAction({ type: 'install', id })
    expect(
      sourceEnginesState().engines.find((engine) => engine.id === id)
    ).toMatchObject({
      installed: next,
      previous: current,
      updateAvailable: false
    })
  }
)

it('reports a newer integration package even when its upstream version is unchanged', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  catalog = [await packageVersion('0.4.15', 'scrapling', 1)]
  await sourceEngineAction({ type: 'check' })
  expect(sourceEnginesState().engines[0]).toMatchObject({
    installed: '0.4.15',
    available: '0.4.15',
    updateAvailable: true
  })
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  expect(sourceEnginesState().engines[0].updateAvailable).toBe(false)
})

it('distinguishes an upstream announcement from an installable package when the catalog fails', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  jest
    .mocked(secureFetch)
    .mockImplementation(async (url) =>
      url.includes('catalog.json')
        ? new Response('Not found', { status: 404 })
        : new Response(JSON.stringify({ tag_name: 'v0.4.16' }))
    )
  await sourceEngineAction({ type: 'check' })
  expect(sourceEnginesState().engines[0]).toMatchObject({
    available: '0.4.15',
    updateAvailable: false,
    upstreamUpdateAvailable: true
  })
  expect(sourceEnginesState().catalogError).toContain('HTTP 404')
  expect(sourceEnginesState().engines[0].message).toBe(
    'Motor atualizado e verificado.'
  )
})

it('refuses a downgrade and still verifies a newer installed worker', async () => {
  catalog = [await packageVersion('0.4.16')]
  await sourceEngineAction({ type: 'check' })
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  catalog = [await packageVersion('0.4.15')]
  await writeFile(
    join(bundles, 'catalog.json'),
    JSON.stringify({ releases: catalog })
  )
  await initializeSourceEngines(root, bundles, '0.3.0-beta')
  await expect(
    sourceEngineAction({ type: 'install', id: 'scrapling' })
  ).rejects.toThrow('mais recente')
  await sourceEngineAction({ type: 'verify', id: 'scrapling' })
  expect(sourceEnginesState().engines[0]).toMatchObject({
    installed: '0.4.16',
    updateAvailable: false
  })
})
