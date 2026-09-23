import { sameExternalGameIdentity } from 'common/externalGameIdentity'
import type { GhostSearchResult } from 'common/types/plugins'

const game: GhostSearchResult = { id: 'one', title: 'First', providerId: 'source', providerName: 'Source', platform: 'windows' }
it('does not match two absent page URLs or IDs from different sources', () => {
  expect(sameExternalGameIdentity(game, { ...game, id: 'two', title: 'Second' })).toBe(false)
  expect(sameExternalGameIdentity(game, { ...game, providerId: 'other' })).toBe(false)
})
it('matches real identities on the same platform', () => {
  expect(sameExternalGameIdentity(game, game)).toBe(true)
  expect(sameExternalGameIdentity({ ...game, pageUrl: 'https://example.com/game' }, { ...game, id: 'two', pageUrl: 'https://example.com/game' })).toBe(true)
  expect(sameExternalGameIdentity(game, { ...game, platform: 'switch' })).toBe(false)
})
