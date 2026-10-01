import { satisfies, valid } from 'semver'
import type { EngineRelease } from 'common/types/sourceEngines'

export function validateEngineRelease(
  value: EngineRelease,
  ghostVersion: string,
  platform: string,
  arch: string
): EngineRelease {
  if (
    !value ||
    !['scrapling', 'obscura'].includes(value.id) ||
    !valid(value.version) ||
    value.protocol !== 1 ||
    value.platform !== platform ||
    value.arch !== arch ||
    !valid(value.minGhostVersion) ||
    !satisfies(ghostVersion, `>=${value.minGhostVersion}`, {
      includePrerelease: true
    }) ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    !/^[a-zA-Z0-9_./-]+$/.test(value.executable) ||
    value.executable.startsWith('/') ||
    value.executable.split('/').includes('..')
  )
    throw new Error('Pacote incompatível com esta versão do Ghost.')
  const url = new URL(value.url)
  const allowed =
    url.hostname === 'github.com' &&
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    !url.port &&
    (url.pathname.startsWith(
      '/alazter/GhostGamesLauncher/releases/download/engines-'
    ) ||
      (value.id === 'obscura' &&
        url.pathname.startsWith('/h4ckf0r0day/obscura/releases/download/')))
  if (!allowed) throw new Error('Origem do pacote não autorizada.')
  return value
}
