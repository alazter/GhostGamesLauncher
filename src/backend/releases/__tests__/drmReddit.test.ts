import { parseRedditPage } from '../drmRedditParser'
import { parseCrackWatch } from '../drmParser'
import { parseCrackWatchIndex } from '../drmCommunityParser'

const url =
  'https://www.reddit.com/r/CrackWatch/comments/1x6xft4/enshroudedrune/'
const markup = (
  title = 'Enshrouded-RUNE',
  flair = 'Release',
  id = '1x6xft4',
  body = ''
) =>
  `<shreddit-post id="t3_${id}" subreddit-name="CrackWatch" permalink="/r/CrackWatch/comments/${id}/enshroudedrune/" post-title="${title}" created-timestamp="2026-10-15T20:59:09.044000+0000"><shreddit-post-flair>${flair}</shreddit-post-flair>${body}</shreddit-post>`
const sources = (html: string, title = 'Enshrouded') =>
  parseCrackWatch(
    { data: { children: [{ data: parseRedditPage(html, url).post }] } },
    title
  )

it('verifies the primary post title, flair, date and canonical link from public HTML', () => {
  expect(sources(markup())).toEqual([
    {
      name: 'CrackWatch',
      status: 'cracked',
      title: 'Enshrouded-RUNE',
      url,
      reportedAt: '2026-10-15T20:59:09.044Z'
    }
  ])
})

it.each([
  ['Enshrouded.Update-RUNE', 'Release'],
  ['Enshrouded-RUNE', 'Repack'],
  ['Enshrouded-RUNE', 'Discussion'],
  ['Enshrouded.Deluxe.Edition-RUNE', 'Release'],
  ['Denuvo removed from Enshrouded, replaced with new DRM', 'DRM Removed']
])('does not confirm %s (%s)', (title, flair) => {
  expect(sources(markup(title, flair))).toEqual([])
})

it('keeps bypass distinct from a crack', () => {
  expect(
    sources(markup('Enshrouded-HYPERVISOR', 'Hypervisor bypass'))[0].status
  ).toBe('bypassed')
})

it('rejects the wrong community, primary post, missing flair and changed/blocked HTML', () => {
  for (const html of [
    markup().replace('subreddit-name="CrackWatch"', 'subreddit-name="other"'),
    markup('Enshrouded', 'Release', 'other'),
    markup('Enshrouded', ''),
    '<h1>Access denied</h1>'
  ])
    expect(() => parseRedditPage(html, url)).toThrow()
  expect(
    sources(
      markup('Other-RUNE') + markup('Enshrouded-RUNE', 'Release', 'related')
    )
  ).toEqual([])
})

it('extracts only post title links in search units, deduplicates them and rejects off-site URLs', () => {
  const anchor = `<a data-testid="post-title" aria-label="Enshrouded-RUNE" href="${url}"></a>`
  const result = parseRedditPage(
    `<div data-testid="search-post-unit">${anchor}${anchor}<a data-testid="post-title" href="https://evil.example/">Enshrouded-RUNE</a></div><a href="${url}">comment</a>`,
    'https://www.reddit.com/r/CrackWatch/search/?q=Enshrouded'
  )
  expect(result.candidates).toEqual([{ title: 'Enshrouded-RUNE', url }])
  expect(result.post).toBeUndefined()
  expect(() =>
    parseRedditPage(
      '<h1>Blocked</h1>',
      'https://www.reddit.com/r/CrackWatch/search/'
    )
  ).toThrow()
})

it('reads explicit curated table categories and dates, without treating removal or missing dates as cracks', () => {
  const table = (heading: string, date: string) =>
    `<p><strong>${heading}</strong></p><table><thead><tr><th>Name</th><th>Released</th><th>Cracked</th><th>By</th></tr></thead><tbody><tr><td>Resident Evil Requiem (HV)<sup>x</sup></td><td>2026-02-27</td><td>${date}</td><td>voices38</td></tr></tbody></table>`
  const read = (body: string) =>
    parseCrackWatchIndex(
      {
        data: {
          children: [
            {
              data: parseRedditPage(
                markup(
                  'Games',
                  'Discussion',
                  'p9ak4n',
                  `<div property="schema:articleBody">${body}</div>`
                ),
                url.replace('1x6xft4', 'p9ak4n')
              ).post
            }
          ]
        }
      },
      'Resident Evil Requiem'
    )
  expect(
    read(table('CRACKED DENUVO GAMES (2021-present)', '2026-04-09'))[0]
  ).toMatchObject({
    status: 'cracked',
    crackDate: '2026-04-09',
    group: 'voices38'
  })
  expect(read(table('CRACKED DENUVO GAMES (2021-present)', 'TBD'))).toEqual([])
  expect(
    read(table('CRACKED DENUVO GAMES (2021-present)', '2999-01-01'))
  ).toEqual([])
  expect(read(table('DENUVO REMOVED', '2026-04-09'))).toEqual([])
})
