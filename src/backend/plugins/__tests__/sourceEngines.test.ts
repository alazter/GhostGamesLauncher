jest.mock('../secureDns', () => ({ secureFetch: jest.fn() }))
jest.mock('../engineProcess', () => ({ engineProcess: jest.fn() }))
jest.mock('../obscuraRelease', () => ({
  ...jest.requireActual('../obscuraRelease'),
  testObscuraCompatibility: jest.fn()
}))
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { PluginPacker } from '../pluginPacker'
import { engineProcess } from '../engineProcess'
import { testObscuraCompatibility } from '../obscuraRelease'
import { secureFetch } from '../secureDns'
import {
  initializeSourceEngines,
  exportSourceEngine,
  importSourceEngine,
  sourceEngineAction,
  sourceEnginesState,
  withSourceEngine
} from '../sourceEngines'
import type { EngineRelease } from 'common/types/sourceEngines'
import {
  createSourceEnginePackage,
  readSourceEnginePackage,
  isSourceEnginePackage
} from '../sourceEnginePackage'

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
  jest.mocked(testObscuraCompatibility).mockResolvedValue(undefined)
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

it.each([true, false])(
  'requires the learning capability for integration revision 6: present=%s',
  async (present) => {
    catalog = [await packageVersion('0.4.15', 'scrapling', 6)]
    await writeFile(
      join(bundles, 'catalog.json'),
      JSON.stringify({ releases: catalog })
    )
    await initializeSourceEngines(root, bundles, '0.3.0-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    jest
      .mocked(engineProcess)
      .mockResolvedValue(
        JSON.stringify({
          ok: true,
          protocol: 1,
          version: '0.4.15',
          capabilities: [
            'online-fix-torrent-links-v1',
            'direct-download-page-v1',
            'release-page-v1',
            ...(present ? ['direct-download-learning-v1'] : [])
          ]
        })
      )
    const bytes = await readFile(join(bundles, `${catalog[0].sha256}.zip`))
    const install = importSourceEngine(
      createSourceEnginePackage(catalog[0], bytes)
    )
    if (present) await expect(install).resolves.toBeDefined()
    else await expect(install).rejects.toThrow('teste do Scrapling')
  }
)

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

it('activates revision 4 only when the worker declares direct-download support', async () => {
  catalog = [await packageVersion('0.4.15', 'scrapling', 4)]
  await sourceEngineAction({ type: 'check' })
  jest.mocked(engineProcess).mockResolvedValue(
    JSON.stringify({
      ok: true,
      protocol: 1,
      version: '0.4.15',
      capabilities: ['online-fix-torrent-links-v1']
    })
  )
  await expect(
    sourceEngineAction({ type: 'install', id: 'scrapling' })
  ).rejects.toThrow('teste do Scrapling')
  expect(sourceEnginesState().engines[0].installed).toBeUndefined()
  jest.mocked(engineProcess).mockResolvedValue(
    JSON.stringify({
      ok: true,
      protocol: 1,
      version: '0.4.15',
      capabilities: ['online-fix-torrent-links-v1', 'direct-download-page-v1']
    })
  )
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.15')
})

it('activates revision 5 only when the worker declares public Releases collection', async () => {
  catalog = [await packageVersion('0.4.15', 'scrapling', 5)]
  await sourceEngineAction({ type: 'check' })
  const capabilities = [
    'online-fix-torrent-links-v1',
    'direct-download-page-v1'
  ]
  jest
    .mocked(engineProcess)
    .mockResolvedValue(
      JSON.stringify({ ok: true, protocol: 1, version: '0.4.15', capabilities })
    )
  await expect(
    sourceEngineAction({ type: 'install', id: 'scrapling' })
  ).rejects.toThrow('teste do Scrapling')
  expect(sourceEnginesState().engines[0].installed).toBeUndefined()
  jest.mocked(engineProcess).mockResolvedValue(
    JSON.stringify({
      ok: true,
      protocol: 1,
      version: '0.4.15',
      capabilities: [...capabilities, 'release-page-v1']
    })
  )
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.15')
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

it('loads startup metadata without spawning engines, then verifies once before first use', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  jest.mocked(engineProcess).mockClear()
  await initializeSourceEngines(root, bundles, '0.3.0-beta', {
    deferVerification: true
  })
  expect(engineProcess).not.toHaveBeenCalled()
  const run = jest.fn(async () => 'ready')
  expect(await withSourceEngine('scrapling', run)).toBe('ready')
  expect(engineProcess).toHaveBeenCalledTimes(1)
  expect(engineProcess).toHaveBeenCalledWith(expect.any(String), [
    '--self-test'
  ])
  await withSourceEngine('scrapling', run)
  expect(engineProcess).toHaveBeenCalledTimes(1)
})

it('does not execute an unverified worker that fails its first deferred smoke test', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  await initializeSourceEngines(root, bundles, '0.3.0-beta', {
    deferVerification: true
  })
  jest.mocked(engineProcess).mockRejectedValue(new Error('damaged worker'))
  const run = jest.fn(async () => 'unexpected')
  await expect(withSourceEngine('scrapling', run)).rejects.toThrow(
    'damaged worker'
  )
  expect(run).not.toHaveBeenCalled()
  expect(sourceEnginesState().engines[0].enabled).toBe(false)
})

it.each(['scrapling', 'obscura'] as const)(
  'shares %s and installs, enables and runs it offline in a fresh profile',
  async (id) => {
    const release = await packageVersion('0.4.15', id)
    catalog = [release]
    await writeFile(
      join(bundles, 'catalog.json'),
      JSON.stringify({ releases: catalog })
    )
    await initializeSourceEngines(root, bundles, '0.3.0-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    await sourceEngineAction({ type: 'install', id })
    const data = join(root, 'source-engines', id, 'data')
    await mkdir(data, { recursive: true })
    await writeFile(join(data, 'private.json'), 'private session')
    const file = join(root, `${id}.ghost`)
    await exportSourceEngine(id, file)
    const bytes = await readFile(file)
    expect(isSourceEnginePackage(bytes)).toBe(true)
    expect(
      readSourceEnginePackage(bytes).archive.equals(
        await readFile(join(bundles, `${release.sha256}.zip`))
      )
    ).toBe(true)

    const friend = join(root, 'friend')
    const metadataOnly = join(root, 'metadata-only')
    await mkdir(metadataOnly)
    await writeFile(
      join(metadataOnly, 'catalog.json'),
      JSON.stringify({ releases: catalog })
    )
    await initializeSourceEngines(friend, metadataOnly, '0.3.0-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    jest.mocked(secureFetch).mockClear()
    await importSourceEngine(bytes)
    expect(secureFetch).not.toHaveBeenCalled()
    expect(
      sourceEnginesState().engines.find((engine) => engine.id === id)
    ).toMatchObject({ installed: release.version, enabled: true })
    expect(
      await withSourceEngine(id, async (executable) =>
        readFile(executable, 'utf8')
      )
    ).toBe(release.version)
    await expect(
      readFile(join(friend, 'source-engines', id, 'data', 'private.json'))
    ).rejects.toMatchObject({ code: 'ENOENT' })

    // Installed archive is kept for sharing/repair even without the sender's bundles.
    await initializeSourceEngines(friend, metadataOnly, '0.3.0-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    await exportSourceEngine(id, join(root, 'reshared.ghost'))
    expect((await readFile(join(root, 'reshared.ghost'))).equals(bytes)).toBe(
      true
    )
    expect(secureFetch).not.toHaveBeenCalled()
  }
)

it('rejects a corrupted or incompatible shared engine before executing it', async () => {
  const release = catalog[0]
  const bytes = await readFile(join(bundles, `${release.sha256}.zip`))
  jest.mocked(engineProcess).mockClear()
  await expect(
    importSourceEngine(
      createSourceEnginePackage(release, Buffer.from('damaged'))
    )
  ).rejects.toThrow('integridade')
  await expect(
    importSourceEngine(
      createSourceEnginePackage({ ...release, arch: 'unknown' }, bytes)
    )
  ).rejects.toThrow('incompatível')
  await expect(
    importSourceEngine(
      createSourceEnginePackage(
        { ...release, minGhostVersion: '99.0.0' },
        bytes
      )
    )
  ).rejects.toThrow('incompatível')
  await expect(
    importSourceEngine(
      createSourceEnginePackage(
        { ...release, executable: '../worker.exe' },
        bytes
      )
    )
  ).rejects.toThrow('incompatível')
  expect(engineProcess).not.toHaveBeenCalled()
  expect(sourceEnginesState().engines[0].installed).toBeUndefined()
})

it('does not let a shared file self-approve its executable or checksum', async () => {
  const release = catalog[0]
  const bytes = await readFile(join(bundles, `${release.sha256}.zip`))
  jest.mocked(engineProcess).mockClear()
  await expect(
    importSourceEngine(
      createSourceEnginePackage(
        { ...release, executable: 'another.exe' },
        bytes
      )
    )
  ).rejects.toThrow('catálogo aprovado')
  expect(engineProcess).not.toHaveBeenCalled()
  expect(sourceEnginesState().engines[0].installed).toBeUndefined()
})

it('confirms an unfamiliar release with the official catalog and preserves a working motor if its self-test fails', async () => {
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  await sourceEngineAction({ type: 'enable', id: 'scrapling', enabled: false })
  const newer = await packageVersion('0.4.16')
  catalog = [newer]
  const bytes = createSourceEnginePackage(
    newer,
    await readFile(join(bundles, `${newer.sha256}.zip`))
  )
  jest.mocked(engineProcess).mockRejectedValue(new Error('test failed'))
  await expect(importSourceEngine(bytes)).rejects.toThrow('test failed')
  expect(sourceEnginesState().engines[0]).toMatchObject({
    installed: '0.4.15',
    enabled: false
  })
  expect(secureFetch).toHaveBeenCalledWith(
    expect.stringContaining('engines-stable/catalog.json'),
    expect.anything()
  )
})

it('installs an unfamiliar but officially approved release and rejects a downgrade', async () => {
  const newer = await packageVersion('0.4.16')
  catalog = [newer]
  await importSourceEngine(
    createSourceEnginePackage(
      newer,
      await readFile(join(bundles, `${newer.sha256}.zip`))
    )
  )
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.16')
  const old = await packageVersion('0.4.15')
  await expect(
    importSourceEngine(
      createSourceEnginePackage(
        old,
        await readFile(join(bundles, `${old.sha256}.zip`))
      )
    )
  ).rejects.toThrow('mais recente')
  expect(sourceEnginesState().engines[0].installed).toBe('0.4.16')
})

it('does not export a missing engine or replace the previous file when the installed worker is broken', async () => {
  const file = join(root, 'keep.ghost')
  await expect(exportSourceEngine('scrapling', file)).rejects.toThrow(
    'Instale o motor'
  )
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  await writeFile(file, 'keep previous file')
  jest.mocked(engineProcess).mockRejectedValue(new Error('broken'))
  await expect(exportSourceEngine('scrapling', file)).rejects.toThrow('broken')
  expect(await readFile(file, 'utf8')).toBe('keep previous file')
})

it('refuses truncated engine envelopes and invalid metadata', () => {
  const bytes = createSourceEnginePackage(catalog[0], Buffer.from('archive'))
  expect(() => readSourceEnginePackage(bytes.subarray(0, 15))).toThrow('válido')
  expect(() => readSourceEnginePackage(bytes.subarray(0, 20))).toThrow(
    'incompleto'
  )
  const invalid = Buffer.from(bytes)
  invalid[Buffer.byteLength('GHOST-ENGINE/1\n') + 4] = 0
  expect(() => readSourceEnginePackage(invalid)).toThrow('inválidos')
})

it('repairs a damaged worker using the bundled archive when the sharing cache is corrupted', async () => {
  const release = catalog[0]
  await sourceEngineAction({ type: 'install', id: 'scrapling' })
  await writeFile(
    join(root, 'source-engines', 'packages', `${release.sha256}.zip`),
    'interrupted write'
  )
  const executable = join(
    root,
    'source-engines',
    release.id,
    `${release.version}-${release.sha256.slice(0, 12)}`,
    release.executable
  )
  await writeFile(executable, 'broken')
  await sourceEngineAction({ type: 'verify', id: 'scrapling' })
  expect(await readFile(executable, 'utf8')).toBe(release.version)
  expect(
    await readFile(
      join(root, 'source-engines', 'packages', `${release.sha256}.zip`)
    )
  ).toEqual(await readFile(join(bundles, `${release.sha256}.zip`)))
})

const windowsTest =
  process.platform === 'win32' && process.arch === 'x64' ? it : it.skip
async function officialPackage(version: string) {
  const bytes = PluginPacker.createZipBuffer([
    { name: 'obscura.exe', content: Buffer.from(version) }
  ])
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(join(bundles, `${sha256}.zip`), bytes)
  return {
    bytes,
    sha256,
    metadata: {
      tag_name: `v${version}`,
      draft: false,
      prerelease: false,
      assets: [
        {
          name: 'obscura-x86_64-windows.zip',
          size: bytes.length,
          digest: `sha256:${sha256}`,
          browser_download_url: `https://github.com/h4ckf0r0day/obscura/releases/download/v${version}/obscura-x86_64-windows.zip`
        }
      ]
    }
  }
}
windowsTest(
  'offers and manually installs the official Obscura update with a 404 Ghost catalog, preserving disabled preference and data',
  async () => {
    catalog = [await packageVersion('0.2.4', 'obscura')]
    await writeFile(
      join(bundles, 'catalog.json'),
      JSON.stringify({ releases: catalog })
    )
    await initializeSourceEngines(root, bundles, '0.3.7-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    await sourceEngineAction({ type: 'install', id: 'obscura' })
    const personal = join(root, 'source-engines', 'obscura', 'data')
    await mkdir(personal, { recursive: true })
    await writeFile(join(personal, 'preferences.json'), 'private data')
    const latest = await officialPackage('0.2.5')
    jest.mocked(secureFetch).mockImplementation(async (url) => {
      if (url.includes('catalog.json'))
        return new Response('missing', { status: 404 })
      return new Response(
        JSON.stringify(
          url.includes('obscura') ? latest.metadata : { tag_name: 'v0.4.16' }
        )
      )
    })
    await sourceEngineAction({ type: 'check' })
    expect(sourceEnginesState().engines[1]).toMatchObject({
      installed: '0.2.4',
      available: '0.2.5',
      updateAvailable: true,
      enabled: false
    })
    await sourceEngineAction({ type: 'verify', id: 'obscura' })
    expect(sourceEnginesState().engines[1].installed).toBe('0.2.4')
    await sourceEngineAction({ type: 'install', id: 'obscura' })
    expect(testObscuraCompatibility).toHaveBeenCalledWith(
      expect.stringContaining('obscura.exe')
    )
    expect(sourceEnginesState().engines[1]).toMatchObject({
      installed: '0.2.5',
      previous: '0.2.4',
      enabled: false,
      updateAvailable: false
    })
    expect(await readFile(join(personal, 'preferences.json'), 'utf8')).toBe(
      'private data'
    )
    await initializeSourceEngines(root, bundles, '0.3.7-beta')
    expect(sourceEnginesState().engines[1]).toMatchObject({
      installed: '0.2.5',
      available: '0.2.5',
      enabled: false
    })
  }
)
windowsTest(
  'does not activate an official Obscura update if its browser compatibility check fails',
  async () => {
    const latest = await officialPackage('0.2.5')
    jest
      .mocked(secureFetch)
      .mockImplementation(
        async (url) =>
          new Response(
            JSON.stringify(
              url.includes('catalog.json')
                ? { releases: [] }
                : url.includes('obscura')
                  ? latest.metadata
                  : { tag_name: 'v0.4.16' }
            )
          )
      )
    await sourceEngineAction({ type: 'check' })
    jest
      .mocked(testObscuraCompatibility)
      .mockRejectedValue(new Error('Incompatible browser'))
    await expect(
      sourceEngineAction({ type: 'install', id: 'obscura' })
    ).rejects.toThrow('Incompatible browser')
    expect(sourceEnginesState().engines[1].installed).toBeUndefined()
  }
)
windowsTest(
  'confirms a shared Obscura archive against its official release when the Ghost catalog is unavailable',
  async () => {
    const latest = await officialPackage('0.2.5')
    const release = {
      id: 'obscura',
      version: '0.2.5',
      executable: 'obscura.exe',
      platform: process.platform,
      arch: process.arch,
      protocol: 1,
      minGhostVersion: '0.3.0-beta',
      sha256: latest.sha256,
      url: latest.metadata.assets[0].browser_download_url
    } as EngineRelease
    jest
      .mocked(secureFetch)
      .mockImplementation(async (url) =>
        url.includes('catalog.json')
          ? new Response('missing', { status: 404 })
          : new Response(JSON.stringify(latest.metadata))
      )
    await importSourceEngine(createSourceEnginePackage(release, latest.bytes))
    expect(sourceEnginesState().engines[1]).toMatchObject({
      installed: '0.2.5',
      enabled: true
    })
  }
)
