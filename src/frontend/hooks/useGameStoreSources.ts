import { useEffect, useMemo, useRef, useState } from 'react'
import { externalTitleGroupKey } from 'common/externalTitle'
import { getCanonicalGameTitle } from 'common/externalGameGroups'
import type {
  GhostSearchResult,
  SourceSearchResponse
} from 'common/types/plugins'

/** Discover the selected game's stores independently of the search/store filter. */
export function useGameStoreSources(
  game: GhostSearchResult | undefined,
  known: GhostSearchResult[],
  enabledProviders: string[]
) {
  const group = game
    ? externalTitleGroupKey(game.title, game.platform || 'windows')
    : ''
  const title = game ? getCanonicalGameTitle(game.title) : ''
  const providers = JSON.stringify([...new Set(enabledProviders)].sort())
  const key = JSON.stringify([group, providers])
  const cache = useRef(new Map<string, Promise<SourceSearchResponse>>())
  const [result, setResult] = useState<{
    key: string
    sources: GhostSearchResult[]
    failed?: boolean
  }>()

  useEffect(() => {
    if (!group || !title || providers === '[]') return
    let current = true
    let pending = cache.current.get(key)
    if (!pending) {
      pending = window.api.externalGamesSearch(title)
      cache.current.set(key, pending)
      if (cache.current.size > 12)
        cache.current.delete(cache.current.keys().next().value!)
    }
    void pending
      .then((response) => {
        const failed = response.errors.length > 0
        if (failed) cache.current.delete(key)
        if (current) setResult({ key, sources: response.games, failed })
      })
      .catch(() => {
        cache.current.delete(key)
        if (current) setResult({ key, sources: [], failed: true })
      })
    return () => {
      current = false
    }
  }, [group, title, providers, key])

  const current = result?.key === key ? result : undefined
  const sources = useMemo(() => {
    const enabled = new Set(JSON.parse(providers) as string[])
    const discovered = (current?.sources || []).filter(
      (source) =>
        enabled.has(source.providerId) &&
        externalTitleGroupKey(source.title, source.platform || 'windows') ===
          group
    )
    // Fresh details already on the page take precedence over catalog summaries.
    const identity = (source: GhostSearchResult) =>
      `${source.providerId}:${source.pageUrl || source.id}`
    const merged = new Map(known.map((source) => [identity(source), source]))
    for (const source of discovered)
      if (!merged.has(identity(source))) merged.set(identity(source), source)
    if (game) merged.set(identity(game), game)
    return [...merged.values()]
  }, [current, known, game, providers, group])
  return {
    sources,
    loading: Boolean(group && providers !== '[]' && !current),
    failed: Boolean(current?.failed)
  }
}
