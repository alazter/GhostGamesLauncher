// Bundle with esbuild (--platform=node --external:electron), then run with Electron.
// Uses a disposable profile; never opens the user's library or site accounts.
import { app } from 'electron'
import { mkdtemp, mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { appendFileSync } from 'fs'
import {
  configureSecureDns,
  resolvePublicHost,
  secureFetch
} from '../../src/backend/plugins/secureDns'
import {
  initializeSourceEngines,
  sourceEngineAction
} from '../../src/backend/plugins/sourceEngines'
import {
  adaptiveGames,
  experimentalPage
} from '../../src/backend/plugins/adaptiveSource'
import type { PluginManifest } from '../../src/common/types/plugins'

void (async () => {
  const report = (message: string) =>
    appendFileSync(
      join(tmpdir(), 'ghost-engine-runtime-result.log'),
      message + '\n'
    )
  report('Starting isolated runtime test')
  const root = await mkdtemp(join(tmpdir(), 'ghost-runtime-smoke-'))
  const profile = join(root, 'profile')
  await mkdir(profile)
  app.setPath('userData', profile)
  try {
    await app.whenReady()
    configureSecureDns()
    await resolvePublicHost('example.com')
    const response = await secureFetch('https://example.com', {
      signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) throw new Error('Quad9/backend HTTPS check failed')
    await response.body?.cancel()
    report('Quad9 + backend HTTPS: OK')
    await initializeSourceEngines(
      root,
      resolve('public/engine-bundles'),
      '0.3.0-beta'
    )
    await sourceEngineAction({ type: 'automatic', enabled: false })
    await sourceEngineAction({ type: 'install', id: 'scrapling' })
    const manifest = {
      id: 'com.ghost.ankergames-source',
      name: 'Fixture',
      permissions: ['network'],
      allowedDomains: ['example.com']
    } as PluginManifest
    const games = await adaptiveGames(
      '<h2 class="post-title"><a href="/game/test">Test Game</a></h2>',
      'https://example.com',
      manifest,
      { catalogPath: '/', gamePathPrefix: '/game/', platform: 'windows' }
    )
    if (games.length !== 1 || games[0].title !== 'Test Game')
      throw new Error('Scrapling IPC check failed')
    report('Scrapling executable + protocol: OK')
    await sourceEngineAction({ type: 'install', id: 'obscura' })
    await sourceEngineAction({ type: 'enable', id: 'obscura', enabled: true })
    const html = await experimentalPage('https://example.com', manifest)
    if (!html?.includes('Example Domain'))
      throw new Error('Obscura proxy/HTML check failed')
    report('Obscura + scoped proxy + HTML: OK')
    await rm(join(root, 'source-engines'), { recursive: true, force: true })
    app.exit(0)
  } catch (error) {
    report(
      error instanceof Error ? error.stack || error.message : String(error)
    )
    app.exit(1)
  }
})()
