export async function checkTodayReleases(): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0]
  const lastClearedDate = localStorage.getItem('ghost_releases_last_cleared_date')

  // If user already cleared today's releases, keep count at 0
  if (lastClearedDate === todayStr && localStorage.getItem('ghost_releases_badge_count') === '0') {
    return 0
  }

  try {
    const result = await window.api.checkTodayTrackedReleases()
    const count = result?.count || 0

    if (lastClearedDate !== todayStr) {
      localStorage.setItem('ghost_releases_badge_count', count.toString())
      window.dispatchEvent(new Event('ghostReleasesBadgeChanged'))
    }

    return count
  } catch (err) {
    console.error('Error scanning today tracked releases:', err)
    return 0
  }
}
