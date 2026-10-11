import { app, BrowserWindow, session } from 'electron'
import { mkdir, writeFile } from 'fs/promises'
import { mkdirSync, appendFileSync } from 'fs'
import childProcess from 'child_process'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { join, resolve } from 'path'
import { configureSecureDns } from '../../../src/backend/plugins/secureDns'
import { initializeSourceEngines, sourceEngineAction } from '../../../src/backend/plugins/sourceEngines'
import { readAnkerManualPage, readHizManualSource, verifyHizAccess, endManualDrm } from '../../../src/backend/releases/drmManual'
import { parseDrmSiteGame } from '../../../src/backend/releases/drmSitesParser'
import { adaptiveGames } from '../../../src/backend/plugins/adaptiveSource'
import type { PluginManifest } from '../../../src/common/types/plugins'

const root = join(tmpdir(), 'ghost-drm-manual-' + randomBytes(4).toString('hex'))
const profile = join(root, 'user')
app.on('window-all-closed', () => undefined)
const originalSpawn = childProcess.spawn
childProcess.spawn = ((...args: Parameters<typeof originalSpawn>) => {
  const child = originalSpawn(...args)
  if (Array.isArray(args[1]) && args[1].includes('--self-test')) child.stderr?.on('data', data => appendFileSync(resolve('.system_generated/tasks/drm-manual/worker-stderr.log'), data))
  return child
}) as typeof originalSpawn
void (async () => {
  mkdirSync(profile, { recursive: true })
  app.setPath('userData', profile)
  app.disableHardwareAcceleration()
  await app.whenReady()
  configureSecureDns()
  const result: Record<string, unknown> = {}
  await writeFile(resolve('.system_generated/tasks/drm-manual/profile-path.txt'), root)
  try {
    await initializeSourceEngines(root, resolve('public/engine-bundles'), '0.3.0-beta')
    await sourceEngineAction({ type: 'automatic', enabled: false })
    await sourceEngineAction({ type: 'install', id: 'scrapling' })
    const parsed = await adaptiveGames('<h2 class="post-title"><a href="/game/test">Test Game</a></h2>', 'https://example.com', { id: 'com.ghost.ankergames-source', name: 'Fixture', permissions: ['network'], allowedDomains: ['example.com'] } as PluginManifest, { catalogPath: '/', gamePathPrefix: '/game/', platform: 'windows' })
    if (parsed.length !== 1) throw new Error('Original parser regression')
    result.parser = 'passed'
    const target = 'https://ankergames.net/game/minecraft-dungeons-ii'
    const html = await readAnkerManualPage(target)
    const source = html && parseDrmSiteGame(html, 'Minecraft Dungeons II', target, 'AnkerGames')
    if (!source?.availability) throw new Error('Manual Anker page not accessible')
    result.anker = { title: source.title, availability: source.availability, status: source.status || 'unknown' }
    const hiz = await readHizManualSource('Minecraft Dungeons II')
    result.hizLive = { requiresVerification: hiz.requiresVerification === true, notice: hiz.notice }
    endManualDrm()
    const browserSession = session.fromPartition('persist:ghost-drm-hiz')
    await browserSession.protocol.handle('https', () => new Response(`<!doctype html><input type="text" disabled><main></main><script>
      document.querySelector('input').addEventListener('keydown', e => { if(e.key==='Enter') { const h=document.createElement('h2'); h.textContent=e.target.value; document.querySelector('main').replaceChildren(h) } });
    </script>`, { headers: { 'content-type': 'text/html' } }))
    const blocked = await readHizManualSource('Fixture Test')
    if (!blocked.requiresVerification) throw new Error('Fixture did not require human action')
    const access = verifyHizAccess()
    await new Promise(resolve => setTimeout(resolve, 200))
    const visible = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('https://hizsearch.pages.dev/'))
    if (!visible) throw new Error('Verification window not opened')
    // Simulated human completion on a local fixture; never touches the real challenge.
    await visible.webContents.executeJavaScript('document.querySelector("input").disabled=false')
    if (!(await access)) throw new Error('Fixture verification did not enable the search')
    const listing = await readHizManualSource('Fixture Test')
    if (listing.title !== 'Fixture Test' || listing.status) throw new Error('Fixture listing/status mismatch')
    result.hizFixture = { verification: true, title: listing.title, verdict: 'unknown' }
    endManualDrm()
    result.passed = true
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    result.passed = false
  }
  await writeFile(resolve('.system_generated/tasks/drm-manual/runtime-result.json'), JSON.stringify(result, null, 2))
  app.exit(result.passed ? 0 : 1)
})()
