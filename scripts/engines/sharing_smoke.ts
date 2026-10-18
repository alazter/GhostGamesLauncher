// Bundle with esbuild and run with Electron. Only disposable sender/recipient profiles.
import { app } from 'electron'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises'
import { appendFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import {
  initializeSourceEngines,
  sourceEngineAction,
  sourceEnginesState,
  exportSourceEngine,
  importSourceEngine,
  withSourceEngine
} from '../../src/backend/plugins/sourceEngines'
import { adaptiveGames } from '../../src/backend/plugins/adaptiveSource'
import { engineProcess } from '../../src/backend/plugins/engineProcess'
import type { PluginManifest } from '../../src/common/types/plugins'

const reportFile = resolve('.system_generated/tasks/engine-sharing/runtime.log')
const report = (message: string) => appendFileSync(reportFile, message + '\n')
void (async () => {
  const taskRoot = await mkdtemp(join(tmpdir(), 'ghost-engine-sharing-'))
  const sender = join(taskRoot, 'sender')
  const recipient = join(taskRoot, 'recipient')
  const catalogOnly = join(taskRoot, 'catalog-only')
  await mkdir(sender)
  await mkdir(catalogOnly)
  app.setPath('userData', sender)
  try {
    await app.whenReady()
    const version = '0.3.7-beta'
    const bundles = resolve('public/engine-bundles')
    await writeFile(
      join(catalogOnly, 'catalog.json'),
      await readFile(join(bundles, 'catalog.json'))
    )
    await initializeSourceEngines(sender, bundles, version)
    await sourceEngineAction({ type: 'automatic', enabled: false })
    for (const id of ['scrapling', 'obscura'] as const) {
      await sourceEngineAction({ type: 'install', id })
      await mkdir(join(sender, 'source-engines', id, 'data'), {
        recursive: true
      })
      await writeFile(
        join(sender, 'source-engines', id, 'data', 'private.txt'),
        'sender-private'
      )
      await exportSourceEngine(id, join(taskRoot, `${id}.ghost`))
      report(`${id}: exported .ghost with original binary package`)
    }
    await initializeSourceEngines(recipient, catalogOnly, version)
    await sourceEngineAction({ type: 'automatic', enabled: false })
    for (const id of ['scrapling', 'obscura'] as const) {
      await importSourceEngine(await readFile(join(taskRoot, `${id}.ghost`)))
      const status = sourceEnginesState().engines.find(
        (engine) => engine.id === id
      )
      if (!status?.installed || !status.enabled)
        throw new Error(`${id}: not activated`)
      try {
        await readFile(
          join(recipient, 'source-engines', id, 'data', 'private.txt')
        )
        throw new Error(`${id}: copied private data`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      report(`${id}: imported, self-tested, enabled; no sender data`)
    }
    await initializeSourceEngines(recipient, catalogOnly, version, {
      deferVerification: true
    })
    await sourceEngineAction({ type: 'automatic', enabled: false })
    const manifest = {
      id: 'com.ghost.ankergames-source',
      name: 'Sharing smoke',
      permissions: ['network'],
      allowedDomains: ['example.com']
    } as PluginManifest
    const games = await adaptiveGames(
      '<h2 class="post-title"><a href="/game/engine-sharing">Portable Engine</a></h2>',
      'https://example.com',
      manifest,
      {
        catalogPath: '/games-list',
        gamePathPrefix: '/game/',
        platform: 'windows'
      }
    )
    if (games.length !== 1 || games[0].title !== 'Portable Engine')
      throw new Error('Scrapling did not parse through Ghost after restart')
    report(
      'scrapling: real catalog parsing through Ghost after recipient restart: OK'
    )
    const obscura = await withSourceEngine('obscura', (executable) =>
      engineProcess(executable, ['--version'])
    )
    const obscuraVersion = sourceEnginesState().engines.find(
      (engine) => engine.id === 'obscura'
    )?.installed
    if (!obscuraVersion || !obscura?.includes(obscuraVersion))
      throw new Error('Obscura did not run through Ghost after restart')
    report('obscura: real executable through Ghost after recipient restart: OK')
    for (const id of ['scrapling', 'obscura'] as const) {
      await exportSourceEngine(id, join(taskRoot, `${id}-reshared.ghost`))
      const first = await readFile(join(taskRoot, `${id}.ghost`))
      if (!first.equals(await readFile(join(taskRoot, `${id}-reshared.ghost`))))
        throw new Error(`${id}: re-export differs`)
      report(`${id}: offline re-export from recipient cache: OK`)
    }
    report(
      'PASS: native engine sharing/import/use; profiles were temporary; no game downloads or personal profiles'
    )
    // Electron still holds its userData files. Remove the native test packages here;
    // the caller can remove the small diagnostic profile after Electron has exited.
    await rm(join(sender, 'source-engines'), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 300
    })
    await rm(recipient, { recursive: true, force: true })
    for (const id of ['scrapling', 'obscura']) {
      await rm(join(taskRoot, `${id}.ghost`), { force: true })
      await rm(join(taskRoot, `${id}-reshared.ghost`), { force: true })
    }
    report(`Disposable profile for caller cleanup: ${taskRoot}`)
    app.exit(0)
  } catch (error) {
    report(
      error instanceof Error ? error.stack || error.message : String(error)
    )
    report(`Temporary diagnostic profile preserved: ${taskRoot}`)
    app.exit(1)
  }
})()
