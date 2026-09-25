import {
  accountAppName,
  eaCatalogUrl,
  parseBattleNetCatalog,
  parseEaCatalog,
  parseUbisoftCatalog,
  parseXboxCatalog,
  uniqueGames
} from '../catalogs'

describe('account catalogs', () => {
  it('rejects GraphQL partial success responses from EA and Ubisoft', () => {
    expect(() =>
      parseEaCatalog({
        errors: [{ message: 'Partial failure' }],
        data: {
          me: { id: 'user', ownedGameProducts: { items: [], totalCount: 0 } }
        }
      })
    ).toThrow('CATALOG_INCOMPLETE')
    expect(() =>
      parseUbisoftCatalog({
        errors: [{ message: 'Partial failure' }],
        data: {
          viewer: { ownedGames: { totalCount: 0, nodes: [] } }
        }
      })
    ).toThrow('CATALOG_INCOMPLETE')
  })
  it('imports Xbox history without interpreting it as ownership and excludes apps', () => {
    const page = parseXboxCatalog({
      titles: [
        {
          titleId: '1',
          name: 'Game',
          type: 'Game',
          displayImage: 'https://example.com/cover.png'
        },
        { titleId: '2', name: 'App', type: 'App' }
      ],
      pagingInfo: { continuationToken: 'next' }
    })
    expect(page.games.map((game) => game.id)).toEqual(['1'])
    expect(page.next).toBe('next')
    expect(page.games[0]).not.toHaveProperty('is_installed')
  })
  it('rejects malformed provider responses instead of clearing the library', () => {
    expect(() => parseXboxCatalog({ error: 'unauthorized' })).toThrow()
    expect(() => parseEaCatalog({ data: { me: null } })).toThrow()
    expect(() => parseBattleNetCatalog({}, { classicGames: [] })).toThrow()
  })
  it('keeps valid empty libraries distinct from failed responses', () => {
    expect(parseXboxCatalog({ titles: [] }).games).toEqual([])
    expect(
      parseBattleNetCatalog({ gameAccounts: [] }, { classicGames: [] })
    ).toEqual([])
  })
  it('preserves EA pagination and offer identity', () => {
    const page = parseEaCatalog({
      data: {
        me: {
          id: 'user',
          ownedGameProducts: {
            next: '500',
            items: [
              {
                id: 'record',
                originOfferId: 'OFB-EAST:123',
                product: { name: 'Game', gameSlug: 'game' }
              }
            ]
          }
        }
      }
    })
    expect(page.next).toBe('500')
    expect(page.games[0].id).toBe('OFB-EAST:123')
    expect(
      new URL(eaCatalogUrl('500')).searchParams.get('variables')
    ).toContain('"next":"500"')
  })
  it('rejects a truncated Ubisoft response', () => {
    expect(() =>
      parseUbisoftCatalog({
        data: {
          viewer: {
            ownedGames: { totalCount: 2, nodes: [{ id: '1', name: 'Game' }] }
          }
        }
      })
    ).toThrow('CATALOG_INCOMPLETE')
  })
  it('deduplicates Battle.net regional accounts and never includes classic license keys', () => {
    const games = parseBattleNetCatalog(
      {
        gameAccounts: [
          { titleId: 1, localizedGameName: 'Game', gameAccountRegion: 'EU' },
          { titleId: 1, localizedGameName: 'Game', gameAccountRegion: 'US' }
        ]
      },
      {
        classicGames: [
          { localizedGameName: 'Classic', cdKeys: ['PRIVATE-LICENSE'] }
        ]
      }
    )
    expect(games).toHaveLength(2)
    expect(JSON.stringify(games)).not.toContain('PRIVATE-LICENSE')
  })
  it('separates provider IDs and encodes unsafe identifier characters', () => {
    expect(accountAppName('ea', '1')).not.toBe(accountAppName('ubisoft', '1'))
    expect(accountAppName('ea', '../test')).toBe('account-ea-..%2Ftest')
  })
  it('does not accept local-file or executable image URLs from providers', () => {
    expect(
      parseXboxCatalog({
        titles: [{ titleId: '1', name: 'Game', displayImage: 'file:///secret' }]
      }).games[0].cover
    ).toBeUndefined()
  })
  it('deduplicates paginated catalogs by ID, not title', () => {
    expect(
      uniqueGames([
        { id: '1', title: 'Game', storeUrl: 'https://example.com' },
        { id: '1', title: 'Game', storeUrl: 'https://example.com' },
        { id: '2', title: 'Game', storeUrl: 'https://example.com' }
      ])
    ).toHaveLength(2)
  })
})
