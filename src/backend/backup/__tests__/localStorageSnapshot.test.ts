import { validateLocalStorageSnapshot } from '../localStorageSnapshot'

describe('backup preference boundary', () => {
  it('includes native monitoring and preferences without copying website sessions or transient counts', () => {
    const tracking = JSON.stringify({ version: 1, items: [{ id: 'a-game' }] })
    expect(
      validateLocalStorageSnapshot({
        heroic_custom_bg: 'background.png',
        ghost_release_tracking_v1: tracking,
        ghost_releases_region: 'uk',
        ghost_alazterflix_card_preferences: '{"style":"clean"}',
        ghost_alazterflix_favorites: '["film"]',
        ghost_alazterflix_cover_size: '0',
        ghost_alazterflix_cover_sizes: '{"all":4,"anime":0}',
        ghost_releases_badge_count: '4',
        auth_token: 'private-website-token',
        release_catalog_cache: 'large-remote-response'
      })
    ).toEqual({
      heroic_custom_bg: 'background.png',
      ghost_release_tracking_v1: tracking,
      ghost_releases_region: 'uk',
      ghost_alazterflix_card_preferences: '{"style":"clean"}',
      ghost_alazterflix_favorites: '["film"]',
      ghost_alazterflix_cover_size: '0',
      ghost_alazterflix_cover_sizes: '{"all":4,"anime":0}'
    })
  })

  it('fails on invalid data instead of recording a falsely successful backup', () => {
    expect(() => validateLocalStorageSnapshot(null)).toThrow()
    expect(() => validateLocalStorageSnapshot([])).toThrow()
    expect(() =>
      validateLocalStorageSnapshot({ ghost_release_tracking_v1: {} })
    ).toThrow()
    expect(() =>
      validateLocalStorageSnapshot({
        heroic_custom_bg: 'x'.repeat(20 * 1024 * 1024)
      })
    ).toThrow()
  })
})
