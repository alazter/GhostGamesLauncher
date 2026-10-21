import { externalTitleGroupKey, externalTitleKey } from './externalTitle'
import type { GhostSearchResult } from './types/plugins'

export interface ExternalCoverRequest {
  title: string
  platform?: 'windows' | 'switch'
  sources?: GhostSearchResult[]
  excludedUrls?: string[]
}
export interface ExternalCoverResult {
  url: string
  provider: 'ankergames' | 'google' | 'steamgriddb'
}

export function externalCoverTitle(title: string) {
  return externalTitleKey(title.replace(/\bB\s*\d{5,}\b/gi, ' '))
}

export function isPublicCoverUrl(value?: string): value is string {
  if (!value || value.length > 4096) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.includes('.') &&
      !url.hostname.includes(':') &&
      !/^[\d.]+$/.test(url.hostname) &&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)
    )
  } catch {
    return false
  }
}

/** Covers for a sequel or another platform must never win through response order. */
export function matchingAnkerCovers(request: ExternalCoverRequest): string[] {
  const key = externalTitleGroupKey(
    externalCoverTitle(request.title),
    request.platform || 'windows'
  )
  const excluded = new Set(request.excludedUrls || [])
  return [
    ...new Set(
      (request.sources || [])
        .filter(
          (game) =>
            /anker/i.test(game.providerId) &&
            externalTitleGroupKey(
              externalCoverTitle(game.title),
              game.platform || 'windows'
            ) === key
        )
        .map((game) => game.coverUrl)
        .filter(
          (url): url is string => isPublicCoverUrl(url) && !excluded.has(url)
        )
    )
  ]
}
