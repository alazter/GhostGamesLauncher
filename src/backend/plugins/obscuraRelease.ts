import { createServer } from 'http'
import { randomUUID } from 'crypto'
import { valid } from 'semver'
import type { EngineRelease } from 'common/types/sourceEngines'
import { validateEngineRelease } from './enginePolicy'
import { engineProcess } from './engineProcess'

export function officialObscuraRelease(
  value: unknown,
  ghostVersion: string,
  platform = process.platform,
  arch = process.arch
): EngineRelease | undefined {
  if (
    platform !== 'win32' ||
    arch !== 'x64' ||
    !value ||
    typeof value !== 'object'
  )
    return
  const metadata = value as Record<string, unknown>
  if (
    metadata.draft !== false ||
    metadata.prerelease !== false ||
    typeof metadata.tag_name !== 'string'
  )
    return
  const version = metadata.tag_name.replace(/^v/, '')
  if (
    !valid(version) ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !Array.isArray(metadata.assets)
  )
    return
  const name = 'obscura-x86_64-windows.zip'
  const url = `https://github.com/h4ckf0r0day/obscura/releases/download/${metadata.tag_name}/${name}`
  const asset = metadata.assets.find((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Record<string, unknown>
    return (
      candidate.name === name &&
      candidate.browser_download_url === url &&
      typeof candidate.size === 'number' &&
      candidate.size > 0 &&
      candidate.size <= 250 * 1024 * 1024 &&
      typeof candidate.digest === 'string' &&
      /^sha256:[a-f0-9]{64}$/.test(candidate.digest)
    )
  }) as { digest: string } | undefined
  if (!asset) return
  return validateEngineRelease(
    {
      id: 'obscura',
      version,
      platform,
      arch,
      protocol: 1,
      minGhostVersion: '0.3.0-beta',
      executable: 'obscura.exe',
      sha256: asset.digest.slice(7),
      url
    },
    ghostVersion,
    platform,
    arch
  )
}

export async function testObscuraCompatibility(executable: string) {
  const marker = `GHOST_ENGINE_${randomUUID().replace(/-/g, '')}`
  const html = `<html><body><div id="result"></div><script>document.getElementById('result').textContent='GHOST_ENGINE_'+'${marker.slice(13)}'</script></body></html>`
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end(html)
  })
  server.on('connection', (socket) =>
    socket.setTimeout(15000, () => socket.destroy())
  )
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Não foi possível testar o Obscura.')
    const output = await engineProcess(
      executable,
      [
        'fetch',
        `http://127.0.0.1:${address.port}/compatibility`,
        '--allow-private-network',
        '--timeout',
        '10',
        '--dump',
        'html'
      ],
      undefined,
      20000
    )
    if (!output.includes(marker))
      throw new Error(
        'O Obscura não passou no teste de compatibilidade de navegação e JavaScript. A versão anterior foi preservada.'
      )
  } finally {
    server.closeAllConnections()
    if (server.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
