import type { ReleaseProduct } from 'common/types/releases'
import type { ReleaseDrmReport, ManualDrmStatus } from 'common/releaseDrm'
import { isConfirmedDrmReport, displayedDrmStatus } from 'common/releaseDrm'

type Game = Pick<ReleaseProduct, 'id' | 'title'>
const keyOf = (game: Game) => game.id + ':' + game.title
const cache = new Map<
  string,
  {
    at: number
    promise: Promise<ReleaseDrmReport>
    resolved: boolean
    confirmed: boolean
  }
>()
const listeners = new Map<string, Set<(report: ReleaseDrmReport) => void>>()

export function requestReleaseDrm(
  game: Game,
  refresh = false,
  priority = false,
  manual?: 'general' | 'hiz'
) {
  const key = keyOf(game)
  const previous = cache.get(key)
  if (
    previous &&
    !refresh &&
    (!priority || previous.resolved) &&
    (previous.confirmed || Date.now() - previous.at < 15 * 60000)
  )
    return previous.promise
  const promise: Promise<ReleaseDrmReport> = window.api
    .releasesDrm({
      id: game.id,
      title: game.title,
      refresh,
      priority,
      ...(manual ? { manual } : {})
    })
    .then((report) => {
      const entry = cache.get(key)
      if (entry && entry.promise !== promise && entry.resolved)
        return entry.promise
      if (entry?.promise === promise) {
        entry.resolved = true
        entry.confirmed = isConfirmedDrmReport(report)
        entry.at = Date.now()
        listeners.get(key)?.forEach((listener) => listener(report))
      }
      return report
    })
  cache.set(key, { at: Date.now(), promise, resolved: false, confirmed: false })
  if (cache.size > 500) cache.delete(cache.keys().next().value!)
  void promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key)
  })
  return promise
}

export function publishReleaseDrm(report: ReleaseDrmReport) {
  const key = keyOf(report)
  cache.set(key, {
    at: Date.now(),
    promise: Promise.resolve(report),
    resolved: true,
    confirmed: isConfirmedDrmReport(report)
  })
  listeners.get(key)?.forEach((listener) => listener(report))
  return report
}

export function setManualReleaseDrm(
  game: Game,
  status: ManualDrmStatus | null
) {
  return window.api
    .releasesDrmSetManual({ id: game.id, title: game.title, status })
    .then(publishReleaseDrm)
}

export const hasSavedDrmConfirmation = (game: Game) =>
  cache.get(keyOf(game))?.confirmed || false
export function subscribeReleaseDrm(
  game: Game,
  listener: (report: ReleaseDrmReport) => void
) {
  const key = keyOf(game)
  const subscribers = listeners.get(key) || new Set()
  subscribers.add(listener)
  listeners.set(key, subscribers)
  return () => {
    subscribers.delete(listener)
    if (!subscribers.size) listeners.delete(key)
  }
}

export interface DrmBatchProgress {
  total: number
  completed: number
  failed: number
  unconfirmed: number
  hizVerification: boolean
}
export function drmBatchGames(products: ReleaseProduct[]) {
  return [
    ...new Map(
      products
        .filter((product) => product.category === 'games')
        .map((product) => [
          keyOf(product),
          { id: product.id, title: product.title }
        ])
    ).values()
  ]
}

/** Keep the renderer queue bounded too; every manual request bypasses the saved verdict. */
export async function refreshReleaseDrmBatch(
  games: Game[],
  onProgress: (progress: DrmBatchProgress) => void,
  signal: AbortSignal,
  manual: 'general' | 'hiz' = 'general',
  finishSession = true
) {
  const unique = [...new Map(games.map((game) => [keyOf(game), game])).values()]
  const progress = {
    total: unique.length,
    completed: 0,
    failed: 0,
    unconfirmed: 0,
    hizVerification: false
  }
  let cursor = 0
  onProgress({ ...progress })
  try {
    await Promise.all(
      Array.from({ length: Math.min(2, unique.length) }, async () => {
        while (!signal.aborted && cursor < unique.length) {
          const game = unique[cursor++]
          try {
            const report = await requestReleaseDrm(game, true, false, manual)
            if (
              report.sources.some(
                (source) =>
                  source.name === 'HizSearch' && source.requiresVerification
              )
            )
              progress.hizVerification = true
            if (displayedDrmStatus(report) === 'unknown' || report.stale)
              progress.unconfirmed++
          } catch {
            progress.failed++
          }
          progress.completed++
          onProgress({ ...progress })
        }
      })
    )
  } finally {
    if (finishSession)
      await window.api.releasesDrmEndManual().catch(() => undefined)
  }
  return progress
}
