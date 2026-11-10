import { useEffect, useMemo, useState } from 'react'
import { matchingAnkerCovers, isPublicCoverUrl } from 'common/externalGameCover'
import type {
  ExternalCoverRequest,
  ExternalCoverResult
} from 'common/externalGameCover'
import type { GhostSearchResult } from 'common/types/plugins'

const pending = new Map<string, Promise<ExternalCoverResult | null>>()
function resolve(request: ExternalCoverRequest) {
  if (!window.api.pluginsResolveGameCover) return Promise.resolve(null)
  const key = JSON.stringify(request)
  const previous = pending.get(key)
  if (previous) return previous
  const promise = window.api.pluginsResolveGameCover(request).catch(() => null)
  pending.set(key, promise)
  void promise.finally(() => pending.delete(key))
  return promise
}

export function useExternalGameCover(
  game?: GhostSearchResult | null,
  sources?: GhostSearchResult[],
  enabled = true
) {
  const signature = JSON.stringify({
    title: game?.title || '',
    platform: game?.platform || 'windows',
    sources: (sources?.length ? sources : game ? [game] : []).map((source) => ({
      id: source.id,
      title: source.title,
      platform: source.platform,
      providerId: source.providerId,
      providerName: source.providerName,
      coverUrl: source.coverUrl
    }))
  })
  const base = useMemo<ExternalCoverRequest>(
    () => JSON.parse(signature) as ExternalCoverRequest,
    [signature]
  )
  const [failed, setFailed] = useState<{ key: string; urls: string[] }>({
    key: '',
    urls: []
  })
  const [resolved, setResolved] = useState<{ key: string; url?: string }>({
    key: ''
  })
  const excludedKey =
    failed.key === signature ? JSON.stringify(failed.urls) : '[]'
  const excludedUrls = useMemo(
    () => JSON.parse(excludedKey) as string[],
    [excludedKey]
  )
  const requestKey = JSON.stringify([signature, excludedUrls])

  // 1. Prioridade máxima: Capa curada da AnkerGames (se disponível)
  // 2. Prioridade de fallback imediato: Capa válida da própria fonte/jogo (SteamRIP, Online-Fix, NXBrew, IGDB, etc.)
  const sourceFallbackCover = useMemo(() => {
    if (game?.coverUrl && isPublicCoverUrl(game.coverUrl) && !excludedUrls.includes(game.coverUrl)) {
      return game.coverUrl
    }
    const matchedSource = (sources || []).find(
      (s) => s.coverUrl && isPublicCoverUrl(s.coverUrl) && !excludedUrls.includes(s.coverUrl)
    )
    return matchedSource?.coverUrl
  }, [game?.coverUrl, sources, excludedUrls])

  const immediate = matchingAnkerCovers({ ...base, excludedUrls })[0] || sourceFallbackCover
  const cover =
    immediate || (resolved.key === requestKey ? resolved.url : undefined)

  useEffect(() => {
    if (!enabled || !base.title || immediate) return
    let current = true
    void resolve({ ...base, excludedUrls }).then((result) => {
      if (current) setResolved({ key: requestKey, url: result?.url })
    })
    return () => {
      current = false
    }
  }, [enabled, base, immediate, requestKey, excludedUrls])

  function rejectCover() {
    if (!cover) return
    setFailed((previous) => ({
      key: signature,
      urls: [
        ...new Set([
          ...(previous.key === signature ? previous.urls : []),
          cover
        ])
      ].slice(-30)
    }))
  }
  return { cover, rejectCover }
}
