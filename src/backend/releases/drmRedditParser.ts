import { load } from 'cheerio'
import { safeDrmSourceUrl } from 'common/releaseDrm'
import { exactDate } from './parser'

export interface RedditPage {
  candidates: { title: string; url: string }[]
  post?: Record<string, unknown>
}

export function redditPostId(url: string): string | undefined {
  if (!safeDrmSourceUrl(url)) return undefined
  const parsed = new URL(url)
  if (parsed.origin !== 'https://www.reddit.com') return undefined
  return /^\/r\/CrackWatch\/comments\/([a-z0-9]+)\/[^/]+\/$/.exec(
    parsed.pathname
  )?.[1]
}

/** Read only the requested post, never comments, related posts or arbitrary page text. */
export function parseRedditPage(html: string, url: string): RedditPage {
  if (html.length > 8 * 1024 * 1024)
    throw new Error('Página do Reddit muito grande.')
  const $ = load(html)
  const candidates: RedditPage['candidates'] = []
  if (new URL(url).pathname === '/r/CrackWatch/search/') {
    if (
      !$(
        '[data-testid="search-results-filter-spacer"], [data-testid="search-post-unit"], search-results-page'
      ).length
    )
      throw new Error('Reddit: busca indisponível ou formato alterado.')
    $('[data-testid="search-post-unit"] [data-testid="post-title"]').each(
      (_i, node) => {
        const anchor = $(node)
        const href = anchor.attr('href') || ''
        const target = new URL(href, 'https://www.reddit.com').href
        const title = (anchor.attr('aria-label') || anchor.text()).trim()
        if (
          redditPostId(target) &&
          title &&
          title.length <= 300 &&
          !candidates.some((item) => item.url === target)
        )
          candidates.push({ title, url: target })
      }
    )
    return { candidates: candidates.slice(0, 100) }
  }
  const id = redditPostId(url)
  if (!id) throw new Error('Endereço do post do Reddit inválido.')
  const node = $('shreddit-post')
    .filter((_i, element) => $(element).attr('id') === `t3_${id}`)
    .first()
  if (
    node.attr('subreddit-name')?.toLowerCase() !== 'crackwatch' ||
    redditPostId(
      new URL(node.attr('permalink') || '/', 'https://www.reddit.com').href
    ) !== id
  )
    throw new Error('Reddit: publicação indisponível ou formato alterado.')
  const post: Record<string, unknown> = {
    id,
    subreddit: node.attr('subreddit-name'),
    title: node.attr('post-title'),
    permalink: node.attr('permalink'),
    created_utc: Date.parse(node.attr('created-timestamp') || '') / 1000,
    link_flair_text: node.find('shreddit-post-flair').first().text().trim()
  }
  if (
    !post.title ||
    !post.link_flair_text ||
    !Number.isFinite(post.created_utc)
  )
    throw new Error('Reddit: título, classificação ou data do post ausentes.')
  if (id === 'p9ak4n') {
    const body = node.find('[property="schema:articleBody"]').first()
    if (!body.find('table').length)
      throw new Error('Reddit: lista de jogos ausente ou formato alterado.')
    const lines = ['Name | Status | Crack date | Group | DRM']
    body.find('table').each((_i, table) => {
      const heading = $(table)
        .prevAll('p')
        .filter((_j, p) => $(p).find('strong').length > 0)
        .first()
        .text()
        .trim()
      const headers = $(table)
        .find('thead tr')
        .first()
        .find('th')
        .map((_j, th) => $(th).text().trim().toLowerCase())
        .get()
      if (headers[0] !== 'name') return
      const cracked = /^(?:OLDER )?CRACKED DENUVO GAMES\b/.test(heading)
      const uncracked = /^UNCRACKED(?:\/UNBYPASSED)? DENUVO GAMES$/.test(
        heading
      )
      const bypassed = headers.includes('bypassed by') && /BYPASS/.test(heading)
      if (!cracked && !uncracked && !bypassed) return
      $(table)
        .find('tbody tr')
        .each((_j, row) => {
          const cells = $(row)
            .find('td')
            .map((_k, td) => {
              const copy = $(td).clone()
              copy.find('sup').remove()
              return copy.text().trim().replace(/\s+/g, ' ')
            })
            .get()
          const get = (name: string) => cells[headers.indexOf(name)] || ''
          const date = exactDate(get('cracked'))
          // A heading alone cannot turn an ambiguous/missing crack date into evidence.
          if (
            cracked &&
            (!date || date > new Date().toISOString().slice(0, 10))
          )
            return
          const status = bypassed
            ? 'bypassed'
            : cracked
              ? 'cracked'
              : 'uncracked'
          const fields = [
            cells[0]?.replace(/\s+\(HV\)$/i, ''),
            status,
            date || '',
            get(bypassed ? 'bypassed by' : 'by'),
            'Denuvo'
          ]
          if (
            fields.every(
              (value) =>
                typeof value === 'string' &&
                value.length <= 300 &&
                !value.includes('|')
            )
          )
            lines.push(fields.join(' | '))
        })
    })
    post.selftext = lines.join('\n')
  }
  return { candidates, post }
}
