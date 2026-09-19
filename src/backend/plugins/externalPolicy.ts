import { isAbsolute, relative, resolve, sep } from 'path'
import type {
  ExternalInstallation,
  GhostSearchResult
} from 'common/types/plugins'

export function inside(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate))
  return (
    rel !== '' &&
    !isAbsolute(rel) &&
    rel !== '..' &&
    !rel.startsWith(`..${sep}`)
  )
}

export function archivePathIsSafe(name: string): boolean {
  return (
    !!name &&
    !name.startsWith('/') &&
    !name.includes('\\') &&
    !name.includes(':') &&
    !name
      .split('/')
      .some(
        (part) =>
          part === '..' ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
      )
  )
}

export function replacementOperation(
  previous: ExternalInstallation,
  next: GhostSearchResult
) {
  if (
    previous.game.platform !== next.platform ||
    previous.game.platform !== 'windows'
  ) {
    throw new Error(
      'A plataforma da nova instalação deve ser Windows e igual à anterior.'
    )
  }
  if (previous.game.providerId === next.providerId) {
    if (
      previous.game.id !== next.id ||
      previous.game.edition !== next.edition
    ) {
      throw new Error(
        'A atualização precisa corresponder ao mesmo jogo e edição.'
      )
    }
    return 'update' as const
  }
  return 'switch-source' as const
}

export { isNewerRelease } from 'common/utils'
