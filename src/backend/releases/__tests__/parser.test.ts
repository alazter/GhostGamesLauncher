import { exactDate, parseReleaseCatalog, parseReleaseProduct } from '../parser'
import { safeReleaseMedia } from 'common/releaseMedia'

describe('release source parsing', () => {
  it('realigns a retained modern cursor to the displayed historical boundary without losing filters', () => {
    const html = `<div class="RWP-Calendar-Group" data-calendarcode="2001-oct-7" data-atprimarytext="Oct 7th, 2001"><article class="RWPCC-CalendarItems-CardControl"><a class="RWPCC-CalendarItems-CardControl-Name" href="/p/blade-of-darkness">Blade of Darkness</a><span class="RWPCC-CalendarItems-TypeAndVersionsControl-Version">PC</span><button data-regionid="us"></button></article></div><div class="RWPCC-InfinityUp-InfinityUpTypes" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-M9-D30&amp;Category=games&amp;F=v%3APC&amp;Direction=Backward"></div><div class="RWPCC-InfinityDown-InfinityDownControl" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=Y2006-M9-D1&amp;Category=games&amp;F=v%3APC&amp;Direction=Forward"></div>`
    const page = parseReleaseCatalog(
      html,
      { category: 'games', region: 'us' },
      'https://www.releases.com/calendar/games?at=2001-jan-1'
    )
    const cursor = new URL(page.previousCursor!, 'https://www.releases.com')
    expect(cursor.searchParams.get('Code')).toBe('Y2001-M10-D7')
    expect(cursor.searchParams.getAll('F')).toEqual(['v:PC'])
    expect(page.nextCursor).toContain('Code=Y2006-M9-D1')
  })
  it('keeps estimated, invalid and unknown dates out of exact-day notifications', () => {
    expect(exactDate('2026-oct-3')).toBe('2026-10-03')
    expect(exactDate('October 3rd, 2026')).toBe('2026-10-03')
    for (const label of [
      'Q4 2026',
      'October 2026',
      '2026-02-30',
      'Oct 3, 2026 *',
      'TBA'
    ])
      expect(exactDate(label)).toBeUndefined()
  })

  it('reads nested type icons, real regional dates and pagination while merging duplicate cards', () => {
    const card = (
      platform: string
    ) => `<article class="RWPCC-CalendarItems-CardControl">
      <a class="RWPCC-CalendarItems-CardControl-Name" href="/p/example">Example &amp; friends</a>
      <div class="RWPCC-CalendarItems-TypeAndVersionsControl"><span class="icon-movies"></span>
      <span class="RWPCC-CalendarItems-TypeAndVersionsControl-Version">${platform}</span></div>
      <button data-regionid="uk"></button><img class="RWPCC-CalendarItems-CardControl-Img" src="javascript:alert(1)">
      </article>`
    const result = parseReleaseCatalog(
      `<div class="RWP-Calendar-Group" data-calendarcode="2026-oct-3" data-atprimarytext="Oct 3rd">${card('Cinema')}${card('VOD')}</div><div class="RWPCC-InfinityDown-InfinityDownControl" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=next"></div>`,
      { region: 'uk' },
      'https://www.releases.com/calendar'
    )
    expect(result.products).toHaveLength(1)
    expect(result.products[0]).toMatchObject({
      title: 'Example & friends',
      category: 'movies',
      region: 'uk',
      releaseDate: '2026-10-03',
      platforms: ['Cinema', 'VOD']
    })
    expect(result.products[0].image).toBeUndefined()
    expect(result.products[0].releases).toHaveLength(2)
    expect(result.hasMore).toBe(true)
  })

  it('reads past and future pagination even if the source changes their layout classes', () => {
    const page = parseReleaseCatalog(
      `<div class="RWP-Calendar-Header"></div><div class="new-past-layout" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=before&amp;Direction=Backward"></div><div class="new-future-layout" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=after&amp;Direction=Forward"></div>`,
      {},
      'https://www.releases.com/calendar/games'
    )
    expect(page.previousCursor).toContain('Code=before&Direction=Backward')
    expect(page.nextCursor).toContain('Code=after&Direction=Forward')
    expect(page.hasMore).toBe(true)
  })

  it('orders past quarter estimates without inventing an exact release date', () => {
    const page = parseReleaseCatalog(
      `<div class="RWP-Calendar-Group" data-calendarcode="2026-q3-est" data-atprimarytext="Estimated Q3"><article class="RWPCC-CalendarItems-CardControl"><a class="RWPCC-CalendarItems-CardControl-Name" href="/p/estimated-game">Estimated game</a><span class="RWPCC-CalendarItems-TypeAndVersionsControl-Version">PC</span><button data-regionid="us"></button></article></div>`,
      { category: 'games', region: 'us' },
      'https://www.releases.com/calendar/games'
    )
    expect(page.products[0]).toMatchObject({
      calendarOrder: '2026-09-30',
      dateLabel: 'Estimated Q3 2026'
    })
    expect(page.products[0].releaseDate).toBeUndefined()
    expect(page.products[0].releases[0]).toMatchObject({
      estimated: true,
      calendarOrder: '2026-09-30'
    })
    expect(page.products[0].releases[0].date).toBeUndefined()
  })

  it('rejects challenge/error pages instead of presenting an empty successful catalog', () => {
    expect(() =>
      parseReleaseCatalog('<h1>Just a moment</h1>', {}, '')
    ).toThrow()
    expect(
      parseReleaseCatalog(
        '<div class="RWP-Search-SearchResultView">No results</div>',
        {},
        ''
      ).products
    ).toEqual([])
  })

  it('recognizes an explicitly empty historical quarter and keeps its backward cursor', () => {
    const html =
      '<div class="RWP-Calendar-Group" data-calendarcode="2026-q3-est" data-atprimarytext="Estimated Q3"><div class="RWP-Calendar-Group-List"></div></div><div class="RWPCC-InfinityUp-InfinityUpTypes" data-ui-url="/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-M9-D30&amp;Direction=Backward"></div>'
    const page = parseReleaseCatalog(
      html,
      { category: 'games', region: 'us' },
      'https://www.releases.com/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-Q3'
    )
    expect(page.products).toEqual([])
    expect(page.previousCursor).toContain('Code=Y2026-M9-D30')
    expect(() =>
      parseReleaseCatalog(html.replace('2026-q3-est', 'unknown'), {}, '')
    ).toThrow('reconhecido')
    expect(() =>
      parseReleaseCatalog(
        html.replace(
          '<div class="RWP-Calendar-Group-List"></div>',
          '<a href="/p/lost-card">Lost card</a>'
        ),
        {},
        ''
      )
    ).toThrow('estrutura mudou')
  })

  it('preserves different regional/platform dates and uncertain labels in details', () => {
    const row = (platform: string, region: string, label: string) =>
      `<div class="RWP-Product-ReleaseInfoView-DateListItem" data-regionid="${region}"><span class="RWP-Product-ReleaseInfoView-Item">${platform}</span><span class="RWP-Product-ReleaseInfoView-ItemReleaseDate">${label}</span></div>`
    const product = parseReleaseProduct(
      `<h1 class="RWP-Product-MainInfoView-Name">Example</h1>${row('PC', 'us', 'Oct 3, 2026')}${row('PC', 'uk', 'Q4 2026')}`,
      'example',
      'uk'
    )
    expect(product.releaseDate).toBeUndefined()
    expect(product.releases[0]).toMatchObject({
      date: '2026-10-03',
      estimated: false,
      region: 'us'
    })
    expect(product.releases[1]).toMatchObject({
      dateLabel: 'Q4 2026',
      estimated: true,
      region: 'uk'
    })
  })

  it('only accepts media URLs from the source and its video providers', () => {
    expect(safeReleaseMedia('https://cdn.releases.com/img/a.jpg')).toBe(
      'https://cdn.releases.com/img/a.jpg'
    )
    for (const url of [
      'file:///private',
      'javascript:alert(1)',
      'https://www.releases.com.evil.test/a',
      'https://user:pass@www.youtube.com/'
    ])
      expect(safeReleaseMedia(url)).toBeUndefined()
  })
})
