import { parseIsItCracked, parseCrackWatch } from '../drmParser'
import {
  combinedDrmStatus,
  safeDrmSourceUrl,
  normalizeDrmTitle,
  drmTitleAliases
} from 'common/releaseDrm'

const url = 'https://isitcracked.com/game/persona-3-reload'
const post = (title: string, flair = 'Denuvo release', extra = {}) => ({
  data: {
    subreddit: 'CrackWatch',
    title,
    link_flair_text: flair,
    created_utc: 1700000000,
    permalink: '/r/CrackWatch/comments/abc123/persona_3_reload/',
    ...extra
  }
})
const listing = (...children: ReturnType<typeof post>[]) => ({
  data: { children }
})

it('matches the complete title and reads status metadata without inferring a crack from a date', () => {
  expect(
    parseIsItCracked(
      {
        title: 'PERSONA 3 Reload™',
        status: 'Uncracked',
        protection: 'Denuvo',
        crackDate: 'TBD',
        group: 'TBD'
      },
      'Persona 3 Reload',
      url
    )
  ).toMatchObject({ status: 'uncracked', protection: 'Denuvo' })
  expect(
    parseIsItCracked(
      { title: 'Persona 3 Reload Deluxe Edition', status: 'Cracked' },
      'Persona 3 Reload',
      url
    )
  ).toBeUndefined()
  expect(
    parseIsItCracked(
      { title: 'Persona 3 Reload', status: 'Coming soon' },
      'Persona 3 Reload',
      url
    )
  ).toBeUndefined()
  expect(
    parseIsItCracked(
      { title: 'Persona 3 Reload', status: 'Cracked' },
      'Persona 3 Reload',
      'https://evil.example/game/persona-3-reload'
    )
  ).toBeUndefined()
  expect(
    parseIsItCracked({ title: '', status: 'Cracked' }, '', url)
  ).toBeUndefined()
  expect(parseCrackWatch(listing(post('')), '')).toEqual([])
})
it('keeps hypervisor bypass and early access distinct from a conventional crack', () => {
  expect(
    parseIsItCracked(
      { title: 'Persona 3 Reload', status: 'Hypervisor' },
      'Persona 3 Reload',
      url
    )?.status
  ).toBe('bypassed')
  expect(
    parseIsItCracked(
      { title: 'Persona 3 Reload', status: 'Early Access' },
      'Persona 3 Reload',
      url
    )?.status
  ).toBe('early-access')
})
it('accepts a matching community release with provenance and rejects discussion and another edition', () => {
  const sources = parseCrackWatch(
    listing(
      post('Persona.3.Reload-voices38'),
      post('Persona 3 Reload', 'Discussion'),
      post('Persona.3.Reload.Deluxe.Edition-RUNE')
    ),
    'Persona 3 Reload'
  )
  expect(sources).toHaveLength(1)
  expect(sources[0]).toMatchObject({
    name: 'CrackWatch',
    status: 'cracked',
    url: 'https://www.reddit.com/r/CrackWatch/comments/abc123/persona_3_reload/'
  })
  expect(sources[0].reportedAt).toBe('2023-11-14T22:13:20.000Z')
})
it('rejects updates, other subreddits, unsafe links and future timestamps', () => {
  expect(
    parseCrackWatch(
      listing(
        post('Persona.3.Reload.Update-RUNE'),
        post('Persona.3.Reload-RUNE', 'Release', { subreddit: 'other' }),
        post('Persona.3.Reload-RUNE', 'Release', {
          permalink: '//evil.example/download'
        }),
        post('Persona.3.Reload-RUNE', 'Release', {
          created_utc: Date.now() / 1000 + 172800
        })
      ),
      'Persona 3 Reload'
    )
  ).toEqual([])
})
it('shows disagreements rather than upgrading an uncracked source to a confirmed crack', () => {
  const first = parseIsItCracked(
    { title: 'Persona 3 Reload', status: 'Uncracked' },
    'Persona 3 Reload',
    url
  )!
  const other = parseCrackWatch(
    listing(post('Persona.3.Reload-voices38')),
    'Persona 3 Reload'
  )[0]
  expect(combinedDrmStatus([first, other])).toBe('conflicting')
  expect(combinedDrmStatus([])).toBe('unknown')
  expect(combinedDrmStatus([other, { ...other, status: 'bypassed' }])).toBe(
    'cracked'
  )
})
it('allows only the requested informational sources', () => {
  expect(safeDrmSourceUrl('javascript:alert(1)')).toBeUndefined()
  expect(
    safeDrmSourceUrl('https://isitcracked.com.evil.example/game/a')
  ).toBeUndefined()
  expect(
    safeDrmSourceUrl('https://www.reddit.com/r/CrackWatch/search/?q=test')
  ).toBeDefined()
  expect(
    safeDrmSourceUrl('https://www.reddit.com/r/CrackWatch/download')
  ).toBeUndefined()
})
it('matches sequel numerals without merging editions or changing words and years', () => {
  expect(normalizeDrmTitle('Minecraft Dungeons II')).toBe(
    normalizeDrmTitle('Minecraft Dungeons 2')
  )
  expect(drmTitleAliases('Minecraft Dungeons 2')).toEqual([
    'Minecraft Dungeons 2',
    'Minecraft Dungeons II'
  ])
  expect(drmTitleAliases('V Rising 2077')).toEqual(['V Rising 2077'])
  expect(normalizeDrmTitle('Mega Man X')).not.toBe(
    normalizeDrmTitle('Mega Man 10')
  )
  expect(normalizeDrmTitle('Star Wars Episode IV')).toBe(
    normalizeDrmTitle('Star Wars Episode 4')
  )
  expect(normalizeDrmTitle('Civilization VI')).toBe(
    normalizeDrmTitle('Civilization 6')
  )
  expect(normalizeDrmTitle('Minecraft Dungeons II Deluxe')).not.toBe(
    normalizeDrmTitle('Minecraft Dungeons 2')
  )
  expect(
    parseIsItCracked(
      { title: 'Minecraft Dungeons II', status: 'Cracked', group: 'RUNE' },
      'Minecraft Dungeons 2',
      'https://isitcracked.com/game/minecraft-dungeons-ii'
    )
  ).toMatchObject({ status: 'cracked', group: 'RUNE' })
})
