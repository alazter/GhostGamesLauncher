import { groupGamesByTitle } from 'common/externalGameGroups'
import type { GhostSearchResult } from 'common/types/plugins'

function game(provider: string, platform: 'windows' | 'switch', version: string): GhostSearchResult {
  return { id: `https://${provider}.example/ball-x-pit/`, title: 'BALL x PIT',
    providerId: provider, providerName: provider, platform, version }
}

it('opens the PC results even when a Switch source responds first, keeping each platform selectable', () => {
  const groups = groupGamesByTitle([
    game('nswgf', 'switch', 'v1.0'), game('anker', 'windows', 'v1.2'),
    game('steamrip', 'windows', 'v1.3'), game('nxbrew', 'switch', 'v2.0')
  ])
  expect(groups).toHaveLength(2)
  expect(groups[0].platform).toBe('windows')
  expect(groups[0].allSources.map(source => source.providerId)).toEqual(['anker', 'steamrip'])
  expect(groups[1].allSources.map(source => source.providerId)).toEqual(['nswgf', 'nxbrew'])
  expect(groups[0].key).not.toBe(groups[1].key)
  // This is the same key comparison the UI uses to show other results.
  expect(groups.filter(group => group.key !== groups[0].key)).toEqual([groups[1]])
  expect(groups.find(group => group.key === groups[1].key)?.platform).toBe('switch')
})

it('keeps HELLCARD from both PC providers in one selectable result', () => {
  const groups = groupGamesByTitle([
    { ...game('steamrip', 'windows', 'v1.0'), title: 'HELLCARD Free Download' },
    { ...game('anker', 'windows', 'v1.1'), title: 'Hellcard (v1.1)' }
  ])
  expect(groups).toHaveLength(1)
  expect(groups[0].allSources).toHaveLength(2)
})
