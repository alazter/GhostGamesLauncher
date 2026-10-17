// Bundle with esbuild (platform=node, external:electron) and run with Electron.
// Read-only audit: no plugin entrypoints, downloads, installs or user-state writes.
import { app } from 'electron'
import { readFile, writeFile, mkdir, mkdtemp } from 'fs/promises'
import { join, dirname, resolve } from 'path'
import { tmpdir } from 'os'
import { setTimeout as delay } from 'timers/promises'
import type { ExternalInstallation, GhostSearchResult } from '../src/common/types/plugins'

async function main() {
  const inputRoot = process.argv[2]
  const reportPath = process.argv[3]
  if (!inputRoot || !reportPath) throw new Error('Usage: audit <Ghost userData> <report.json>')
  const profile = await mkdtemp(join(tmpdir(), 'ghost-release-audit-'))
  app.setPath('userData', profile)
  await app.whenReady()
  const { configureSecureDns } = await import('../src/backend/plugins/secureDns')
  const { initializeSourceSettings } = await import('../src/backend/plugins/sourceSettings')
  const { websiteSource } = await import('../src/backend/plugins/websiteSource')
  const { builtinGameSources } = await import('../src/common/builtinGameSources')
  const { isNewerGameRelease } = await import('../src/common/utils')
  const { installedReleaseCandidate } = await import('../src/common/externalReleaseInfo')
  configureSecureDns()
  initializeSourceSettings(resolve(inputRoot))
  const state = JSON.parse(await readFile(join(inputRoot, 'external-games', 'state.json'), 'utf8'))
  const installations: ExternalInstallation[] = state.installations
  const rows: Array<Record<string, unknown>> = []
  await mkdir(dirname(reportPath), { recursive: true })
  let next = 0
  let saving = Promise.resolve()
  const checkpoint = () => {
    const document = JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true,
      total: installations.length, completed: rows.length, rows: [...rows] }, null, 2)
    saving = saving.then(() => writeFile(reportPath, document))
    return saving
  }
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < installations.length) {
      const installed = installations[next++]
      const current = installedReleaseCandidate(installed.game)
      const row: Record<string, unknown> = { title: installed.game.title, installationId: installed.id,
        provider: installed.game.providerName, installedVersion: current.version,
        installedSourceDate: current.sourceDate }
      const source = builtinGameSources.find(item => item.id === installed.game.providerId)
      const target = installed.game.pageUrl || installed.game.id
      if (!source || !/^https:\/\//.test(target)) {
        row.status = 'unlinked'
        row.reason = 'Fonte ou página da release instalada não registrada; não é possível confirmar update.'
      } else {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const provider = websiteSource({ id: source.id, name: source.name, homepage: `https://${source.domain}`,
            permissions: ['network', 'game-sources'], allowedDomains: [source.domain] } as never, source.config)
          const remote = await Promise.race([
            provider.getDetails!(target), new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('A fonte excedeu o tempo da consulta.')), 30000)
            })
          ]) as GhostSearchResult
          row.pageUrl = new URL(target).origin + new URL(target).pathname
          row.remoteVersion = remote.version
          row.remoteSourceDate = remote.sourceDate
          const comparison = isNewerGameRelease(current, remote)
          row.status = comparison.isNewer ? 'update' : comparison.reason === 'unknown' ? 'unknown' : 'current'
          row.reason = comparison.reason
        } catch (error) {
          row.status = 'unavailable'
          row.reason = (error instanceof Error ? error.message : 'Falha na consulta').replace(/https?:\/\/\S+/g, '[URL]')
        } finally { if (timer) clearTimeout(timer) }
      }
      rows.push(row)
      await checkpoint()
      // Keep public-source traffic bounded instead of flooding a single host.
      await delay(500)
    }
  }))
  await saving
  console.log(JSON.stringify(rows.reduce<Record<string, number>>((counts, row) => {
    const status = String(row.status)
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})))
}
main().then(() => app.exit(0)).catch(error => { console.error(error.message); app.exit(1) })
