export async function checkTodayReleases(): Promise<number> {
  try {
    const result = await window.api.checkTodayTrackedReleases()
    const count = result?.count || 0

    localStorage.setItem('ghost_releases_badge_count', count.toString())
    window.dispatchEvent(new Event('ghostReleasesBadgeChanged'))

    return count
  } catch (err) {
    console.error('Error scanning today tracked releases:', err)
    return 0
  }
}
