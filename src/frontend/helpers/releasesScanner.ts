export async function checkTodayReleases(): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0]
  const lastClearedDate = localStorage.getItem('ghost_releases_last_cleared_date')

  // If user already cleared today's releases, keep count at 0
  if (lastClearedDate === todayStr && localStorage.getItem('ghost_releases_badge_count') === '0') {
    return 0
  }

  try {
    const url = 'https://www.releases.com/calendar/products?f=t%3AGame&f=v%3APC&f=v%3APC%20%28Early%20Access%29'
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    })

    if (!res.ok) return 0

    const html = await res.text()
    
    // Parse date groups or today's entries in HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Find date group headers matching today's date or current month/day
    const now = new Date()
    const day = now.getDate()
    const monthShort = now.toLocaleString('en-US', { month: 'short' })
    const monthLong = now.toLocaleString('en-US', { month: 'long' })
    const monthPt = now.toLocaleString('pt-BR', { month: 'short' })

    let releaseCount = 0

    // Search for items matching today's date container
    const items = doc.querySelectorAll('.RWP-Calendar-ProductCard, [class*="ProductCard"], [class*="product-card"], article, .card')
    items.forEach((item) => {
      const text = item.textContent || ''
      if (
        text.includes(`${day} ${monthShort}`) ||
        text.includes(`${monthShort} ${day}`) ||
        text.includes(`${day} ${monthLong}`) ||
        text.includes(`${day} ${monthPt}`) ||
        text.toLowerCase().includes('today') ||
        text.toLowerCase().includes('hoje')
      ) {
        releaseCount++
      }
    })

    const finalCount = Math.max(releaseCount, 0)

    if (finalCount > 0) {
      localStorage.setItem('ghost_releases_badge_count', finalCount.toString())
      window.dispatchEvent(new Event('ghostReleasesBadgeChanged'))
    }

    return finalCount
  } catch (err) {
    console.error('Error scanning today releases:', err)
    return 0
  }
}
