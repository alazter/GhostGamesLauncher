const { mkdir, readFile, writeFile } = require('node:fs/promises')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

module.exports = async function prepareEngineResources(context) {
  if (context.electronPlatformName !== 'win32') return
  const directory = join(
    context.packager.projectDir,
    'public',
    'engine-bundles'
  )
  await mkdir(directory, { recursive: true })
  // Other architectures retain the existing browser until a compatible bundle exists.
  if (context.arch !== 1) return
  async function download(url, limit) {
    for (let redirects = 0; redirects < 6; redirects++) {
      const parsed = new URL(url)
      if (
        parsed.protocol !== 'https:' ||
        ![
          'github.com',
          'release-assets.githubusercontent.com',
          'objects.githubusercontent.com'
        ].includes(parsed.hostname)
      )
        throw new Error('Servidor de motores não autorizado')
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(180000)
      })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new Error('Redirecionamento inválido')
        url = new URL(location, url).href
        continue
      }
      if (!response.ok)
        throw new Error(
          `Catálogo de motores indisponível (HTTP ${response.status}). Execute scripts/engines/prepare_engines.py ou publique o workflow source-engines primeiro.`
        )
      const chunks = []
      let size = 0
      for await (const part of response.body) {
        size += part.length
        if (size > limit) throw new Error('Pacote excede limite')
        chunks.push(part)
      }
      return Buffer.concat(chunks)
    }
    throw new Error('Redirecionamentos demais')
  }
  let catalog
  try {
    catalog = JSON.parse(
      await readFile(join(directory, 'catalog.json'), 'utf8')
    )
  } catch {
    catalog = JSON.parse(
      (
        await download(
          'https://github.com/alazter/GhostGamesLauncher/releases/download/engines-stable/catalog.json',
          1024 * 1024
        )
      ).toString()
    )
  }
  for (const release of catalog.releases) {
    if (
      !['obscura', 'scrapling'].includes(release.id) ||
      release.platform !== 'win32' ||
      release.arch !== 'x64' ||
      !/^[a-f0-9]{64}$/.test(release.sha256)
    )
      throw new Error('Catálogo inválido')
    const file = join(directory, `${release.sha256}.zip`)
    let buffer
    try {
      buffer = await readFile(file)
    } catch {
      buffer = await download(release.url, 250 * 1024 * 1024)
    }
    if (createHash('sha256').update(buffer).digest('hex') !== release.sha256)
      throw new Error('Integridade do motor não confirmada')
    await writeFile(file, buffer)
  }
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify(catalog, null, 2)
  )
}
