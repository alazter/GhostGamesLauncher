import type { GhostSearchResult } from './types/plugins'

export function sameExternalGameIdentity(left: GhostSearchResult, right: GhostSearchResult): boolean {
  if (left.platform !== right.platform) return false
  return Boolean(
    (left.id && left.id === right.id && left.providerId === right.providerId) ||
    (left.pageUrl && right.pageUrl && left.pageUrl === right.pageUrl)
  )
}
