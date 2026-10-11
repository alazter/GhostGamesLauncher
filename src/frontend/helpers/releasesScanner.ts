import {
  getTrackedReleases,
  getReleasesDueOn,
  localReleaseDay,
  refreshTrackedProducts
} from './releaseTracking'

let running: Promise<number> | undefined
const lastChecked = new Map<string, number>()

export function checkTodayReleases(force = false): Promise<number> {
  if (force) lastChecked.clear()
  updateBadge()
  if (running) return running
  running = scan().finally(() => {
    running = undefined
  })
  return running
}

function updateBadge(): number {
  const due = getReleasesDueOn(getTrackedReleases(), localReleaseDay())
  const count = new Set(due.map((entry) => entry.product.id)).size
  localStorage.setItem('ghost_releases_badge_count', String(count))
  window.dispatchEvent(new Event('ghostReleasesBadgeChanged'))
  return count
}

async function scan(): Promise<number> {
  try {
    const unique = new Map(
      getTrackedReleases().map((entry) => [
        `${entry.region}:${entry.product.id}`,
        entry
      ])
    )
    for (const key of lastChecked.keys())
      if (!unique.has(key)) lastChecked.delete(key)
    const pending = [...unique.entries()].filter(
      ([key]) => Date.now() - (lastChecked.get(key) || 0) > 30 * 60 * 1000
    )
    for (let index = 0; index < pending.length; index += 3) {
      const results = await Promise.allSettled(
        pending.slice(index, index + 3).map(async ([key, entry]) => {
          lastChecked.set(key, Date.now())
          return window.api
            .releasesProduct(entry.product.id, entry.region)
            .catch((error) => ({
              ...entry.product,
              stale: true,
              warning: `Não foi possível confirmar as datas. ${String(error).replace(/^Error: /, '')}`
            }))
        })
      )
      refreshTrackedProducts(
        results.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        )
      )
    }
    const due = getReleasesDueOn(getTrackedReleases(), localReleaseDay())
    const count = updateBadge()
    await window.api.releasesNotifyToday(
      due
        .filter(
          (entry) =>
            entry.notify && !entry.updateWarning && !entry.metadataPaused
        )
        .map((entry) => ({ id: entry.id, title: entry.product.title }))
    )
    return count
  } catch (err) {
    console.error('Error scanning today tracked releases:', err)
    return Number(localStorage.getItem('ghost_releases_badge_count') || 0)
  }
}
