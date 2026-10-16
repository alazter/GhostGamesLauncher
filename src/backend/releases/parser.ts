import { safeReleaseMedia } from 'common/releaseMedia'
import { parseDocument, DomUtils } from 'htmlparser2'
import type {
  ReleaseCatalog,
  ReleaseDate,
  ReleaseProduct,
  ReleaseQuery,
  ReleaseRegion
} from 'common/types/releases'
import { RELEASE_CATEGORIES } from 'common/types/releases'
type Element = ReturnType<typeof DomUtils.findAll>[number]

const cls = (element: Element, name: string) =>
  (element.attribs.class || '').split(/\s+/).includes(name)
const nodes = (
  root: ReturnType<typeof parseDocument> | Element,
  name: string
) => DomUtils.findAll((e) => cls(e, name), root.children)
const text = (element?: Element) =>
  element ? DomUtils.textContent(element).replace(/\s+/g, ' ').trim() : ''
const first = (
  root: ReturnType<typeof parseDocument> | Element,
  name: string
) => nodes(root, name)[0]
const months = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec'
]

export function exactDate(value: string): string | undefined {
  let result: string | undefined
  const code = value.toLowerCase().match(/^(\d{4})-([a-z]{3})-(\d{1,2})$/)
  const label = value.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/
  )
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) result = value
  if (code && months.includes(code[2]))
    result = `${code[1]}-${String(months.indexOf(code[2]) + 1).padStart(2, '0')}-${code[3].padStart(2, '0')}`
  if (label && months.includes(label[1].slice(0, 3).toLowerCase()))
    result = `${label[3]}-${String(months.indexOf(label[1].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}-${label[2].padStart(2, '0')}`
  if (!result) return undefined
  const date = new Date(`${result}T12:00:00Z`)
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === result
    ? result
    : undefined
}

function productId(href: string): string | undefined {
  const match = href.match(/^\/p\/([a-z0-9][a-z0-9._~-]*)\/?(?:\?.*)?$/i)
  return match?.[1]
}

function categoryOf(card: Element, fallback = 'all'): string {
  const type = DomUtils.findAll(
    (e) =>
      /\bicon-(?:game|movies?|film|tvseries|tv|series)\b/.test(
        e.attribs.class || ''
      ),
    card.children
  )[0]
  const icon = type?.attribs.class || ''
  if (/icon-game\b/.test(icon)) return 'games'
  if (/icon-(?:movies?|film)\b/.test(icon)) return 'movies'
  if (/icon-(?:tvseries|tv|series)\b/.test(icon)) return 'tv-series'
  return fallback
}

export function parseReleaseCatalog(
  html: string,
  query: ReleaseQuery,
  sourceUrl: string
): ReleaseCatalog {
  const root = parseDocument(html)
  const cards = [
    ...nodes(root, 'RWPCC-CalendarItems-CardControl'),
    ...nodes(root, 'RWP-Search-SearchResultView-Item')
  ]
  const products = new Map<string, ReleaseProduct>()
  for (const card of cards) {
    const name =
      first(card, 'RWPCC-CalendarItems-CardControl-Name') ||
      first(card, 'RWP-Search-SearchResultView-ItemName')
    const id = productId(name?.attribs.href || '')
    if (!id || !text(name))
      throw new Error('Um título do catálogo perdeu sua identificação.')
    let group = card.parent
    while (group && !('attribs' in group && cls(group, 'RWP-Calendar-Group')))
      group = group.parent
    const dateGroup = group && 'attribs' in group ? group : undefined
    let label =
      dateGroup?.attribs['data-atprimarytext'] ||
      text(first(card, 'RWPCC-CalendarItems-CardControl-Date')) ||
      text(first(card, 'RWP-Search-SearchResultView-DateDesc')) ||
      'A confirmar'
    const calendarCode = dateGroup?.attribs['data-calendarcode'] || ''
    const date = exactDate(calendarCode)
    const quarter = calendarCode.match(/^(\d{4})-q([1-4])(?:-est)?$/i)
    const periodMonth = calendarCode.match(/^(\d{4})-([a-z]{3})(?:-est)?$/i)
    const periodOnlyYear = calendarCode.match(/^(\d{4})(?:-est)?$/i)
    const monthNumber = periodMonth
      ? [
          'jan',
          'feb',
          'mar',
          'apr',
          'may',
          'jun',
          'jul',
          'aug',
          'sep',
          'oct',
          'nov',
          'dec'
        ].indexOf(periodMonth[2].toLowerCase()) + 1
      : 0
    const periodYear = Number(
      quarter?.[1] || periodMonth?.[1] || periodOnlyYear?.[1]
    )
    const periodEndMonth = quarter
      ? Number(quarter[2]) * 3
      : periodOnlyYear
        ? 12
        : monthNumber
    const calendarOrder =
      date ||
      (periodYear && periodEndMonth
        ? new Date(Date.UTC(periodYear, periodEndMonth, 0))
            .toISOString()
            .slice(0, 10)
        : undefined)
    if (!date && calendarOrder && !label.includes(String(periodYear)))
      label = `${label.trim()} ${periodYear}`
    const regionNode = DomUtils.findAll(
      (e) => !!e.attribs['data-regionid'],
      card.children
    )[0]
    if (
      !query.search &&
      !['us', 'uk'].includes(regionNode?.attribs['data-regionid'])
    )
      throw new Error('O catálogo não confirmou a região das datas.')
    const region: ReleaseRegion =
      regionNode?.attribs['data-regionid'] === 'uk'
        ? 'uk'
        : regionNode?.attribs['data-regionid'] === 'us'
          ? 'us'
          : query.region || 'us'
    const versions = [
      ...nodes(card, 'RWPCC-Trackbutton-TrackbuttonControl-versionName'),
      ...nodes(card, 'RWPCC-CalendarItems-TypeAndVersionsControl-Version'),
      ...nodes(card, 'RWP-Search-SearchResultView-ItemVersion')
    ]
    const platforms = [
      ...new Set(
        versions
          .map((n) =>
            text(n)
              .replace(/^\s*\/\s*/, '')
              .replace(/\s*\+\d+$/, '')
          )
          .filter(Boolean)
      )
    ]
    const image = safeReleaseMedia(
      (
        first(card, 'RWPCC-CalendarItems-CardControl-Img') ||
        first(card, 'RWP-Search-SearchResultView-Img')
      )?.attribs.src
    )
    const heroStyle =
      first(card, 'RWPCC-CalendarItems-CardControl-Hero')?.attribs.style || ''
    const heroImage = safeReleaseMedia(
      heroStyle.match(/url\(['"]?([^)'"\s]+)['"]?\)/)?.[1]
    )
    const releases: ReleaseDate[] =
      date || calendarOrder
        ? platforms.map((platform) => ({
            platform,
            region,
            date,
            dateLabel: label,
            estimated: !date,
            calendarOrder
          }))
        : []
    const previous = products.get(id)
    if (previous) {
      previous.releases.push(
        ...releases.filter(
          (row) =>
            !previous.releases.some(
              (old) =>
                old.platform === row.platform &&
                (old.date || old.calendarOrder) ===
                  (row.date || row.calendarOrder) &&
                old.region === row.region
            )
        )
      )
      previous.platforms = [...new Set([...previous.platforms, ...platforms])]
      continue
    }
    products.set(id, {
      id,
      title: text(name),
      url: `https://www.releases.com/p/${id}`,
      category: categoryOf(card, query.category),
      image,
      heroImage,
      platforms,
      dateLabel: label,
      releaseDate: date,
      calendarOrder,
      region,
      popularity:
        text(first(card, 'RWPCC-Trackbutton-TrackbuttonControl-count')) ||
        undefined,
      releases,
      images: [],
      videos: [],
      tags: []
    })
  }
  const explicitCalendarGroup = nodes(root, 'RWP-Calendar-Group').some(
    (group) => {
      const code = group.attribs['data-calendarcode'] || ''
      return (
        !!group.attribs['data-atprimarytext']?.trim() &&
        (exactDate(code) ||
          /^\d{4}(?:-(?:q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?(?:-est)?$/i.test(
            code
          ))
      )
    }
  )
  if (
    !cards.length &&
    !explicitCalendarGroup &&
    !nodes(root, 'RWP-Calendar-Header').length &&
    !nodes(root, 'RWP-Search-SearchResultView').length
  ) {
    throw new Error(
      'O Releases.com não retornou um catálogo reconhecido. Tente atualizar mais tarde.'
    )
  }
  if (
    !cards.length &&
    DomUtils.findAll(
      (e) => e.name === 'a' && !!productId(e.attribs.href || ''),
      root.children
    ).length
  )
    throw new Error('A página contém títulos, mas sua estrutura mudou.')
  const filters = RELEASE_CATEGORIES.map((category) => ({
    ...category,
    platforms: [...category.platforms]
  }))
  for (const link of DomUtils.findAll(
    (e) => !!e.attribs['data-category'],
    root.children
  )) {
    const code = link.attribs['data-category']
    const label = text(link)
    if (!code || !label || code.includes('_')) continue
    if (!filters.some((category) => category.id === code))
      filters.push({ id: code, label, platforms: [] })
  }
  const pagination = DomUtils.findAll(
    (element) => !!element.attribs['data-ui-url'],
    root.children
  )
  const directionalCursor = (direction: string) =>
    pagination
      .map((element) => element.attribs['data-ui-url'])
      .find((value) => {
        try {
          const url = new URL(value, 'https://www.releases.com')
          return (
            url.origin === 'https://www.releases.com' &&
            url.pathname === '/partial/Releases.Www.PL.Calendar.Group' &&
            url.searchParams.get('Direction') === direction
          )
        } catch {
          return false
        }
      })
  let nextCursor =
    first(root, 'RWPCC-InfinityDown-InfinityDownControl')?.attribs[
      'data-ui-url'
    ] || directionalCursor('Forward')
  // The source uses InfinityUpTypes for the past and InfinityDownControl for the future.
  let previousCursor =
    (
      first(root, 'RWPCC-InfinityUp-InfinityUpTypes') ||
      first(root, 'RWPCC-InfinityUp-InfinityUpControl')
    )?.attribs['data-ui-url'] || directionalCursor('Backward')
  // After a historical jump the source can retain today's "up" cursor.
  // Follow the displayed boundary, otherwise scrolling up imports modern dates forever.
  const confirmedDays = [...products.values()]
    .flatMap((product) => [
      product.releaseDate,
      ...product.releases.filter((row) => !row.estimated).map((row) => row.date)
    ])
    .filter((date): date is string => !!date)
    .sort()
  const alignCursor = (
    cursor: string | undefined,
    boundary: string | undefined,
    direction: 'Backward' | 'Forward'
  ) => {
    if (!cursor || !boundary) return cursor
    try {
      const url = new URL(cursor, 'https://www.releases.com')
      if (
        url.origin !== 'https://www.releases.com' ||
        url.pathname !== '/partial/Releases.Www.PL.Calendar.Group' ||
        url.searchParams.get('Direction') !== direction
      )
        return cursor
      const code = url.searchParams
        .get('Code')
        ?.match(/^Y(\d{4})-M(\d{1,2})-D(\d{1,2})$/)
      const day =
        code &&
        `${code[1]}-${code[2].padStart(2, '0')}-${code[3].padStart(2, '0')}`
      if (
        !day ||
        (direction === 'Backward' ? day <= boundary : day >= boundary)
      )
        return cursor
      const [year, month, date] = boundary.split('-')
      url.searchParams.set(
        'Code',
        `Y${year}-M${Number(month)}-D${Number(date)}`
      )
      return url.pathname + url.search
    } catch {
      return cursor
    }
  }
  previousCursor = alignCursor(previousCursor, confirmedDays[0], 'Backward')
  nextCursor = alignCursor(nextCursor, confirmedDays.at(-1), 'Forward')
  return {
    products: [...products.values()],
    filters,
    hasMore: !!nextCursor,
    nextCursor,
    previousCursor,
    fetchedAt: new Date().toISOString(),
    sourceUrl,
    stale: false
  }
}

export function parseReleaseProduct(
  html: string,
  id: string,
  region: ReleaseRegion
): ReleaseProduct {
  const root = parseDocument(html)
  const title = text(first(root, 'RWP-Product-MainInfoView-Name'))
  if (!title)
    throw new Error(
      'Não foi possível carregar os detalhes deste lançamento na fonte.'
    )
  const releases = nodes(root, 'RWP-Product-ReleaseInfoView-DateListItem')
    .map((row) => {
      const dateLabel = text(
        first(row, 'RWP-Product-ReleaseInfoView-ItemReleaseDate')
      )
      const date = exactDate(dateLabel)
      if (
        !dateLabel ||
        !text(first(row, 'RWP-Product-ReleaseInfoView-Item')) ||
        !['us', 'uk'].includes(row.attribs['data-regionid'])
      )
        throw new Error(
          'A fonte retornou uma data sem plataforma, região ou descrição confirmada.'
        )
      return {
        platform: text(first(row, 'RWP-Product-ReleaseInfoView-Item')),
        region:
          row.attribs['data-regionid'] === 'uk'
            ? ('uk' as const)
            : row.attribs['data-regionid'] === 'us'
              ? ('us' as const)
              : region,
        dateLabel,
        date,
        estimated: !date || /\*/.test(dateLabel)
      }
    })
    .filter((row) => row.platform)
  const type = first(root, 'RWP-Product-MainInfoView-MetaType')
  const category = type?.attribs.href?.replace(/^\/feed\//, '') || 'all'
  const image = safeReleaseMedia(
    first(root, 'RWP-Product-MainInfoView-Img')?.attribs.src
  )
  const media = DomUtils.findAll(
    (e) => /(?:Media|Gallery)/.test(e.attribs.class || ''),
    root.children
  )
  const images = new Set<string>()
  const videos = new Set<string>()
  for (const section of media) {
    for (const element of [
      section,
      ...DomUtils.findAll(() => true, section.children)
    ]) {
      for (const key of ['href', 'src', 'data-url', 'data-src']) {
        const url = safeReleaseMedia(element.attribs[key])
        if (!url) continue
        if (/youtu(?:be\.com|\.be)|vimeo\.com/.test(new URL(url).hostname))
          videos.add(url)
        else if (/\.(?:jpg|jpeg|png|webp)(?:\/|$|\?)/i.test(url))
          images.add(url)
      }
      const youtube =
        element.attribs['data-youtubeid'] || element.attribs['data-videoid']
      if (youtube && /^[\w-]{11}$/.test(youtube))
        videos.add(`https://www.youtube.com/watch?v=${youtube}`)
    }
  }
  const dates = releases.filter((row) => row.region === region)
  return {
    id,
    title,
    url: `https://www.releases.com/p/${id}`,
    category,
    image,
    platforms: [...new Set(dates.map((row) => row.platform))],
    dateLabel: dates[0]?.dateLabel || 'A confirmar',
    releaseDate: dates[0]?.date,
    region,
    description:
      text(first(root, 'RWP-Product-MainInfoView-SummaryLong')) ||
      text(first(root, 'RWP-Product-MainInfoView-Summary')),
    popularity:
      text(first(root, 'RWPCC-Trackbutton-TrackbuttonControl-count')) ||
      undefined,
    releases,
    images: [...images],
    videos: [...videos],
    tags: nodes(root, 'RWP-Product-MainInfoView-Tag').map(text)
  }
}
