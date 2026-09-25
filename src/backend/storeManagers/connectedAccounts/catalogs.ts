import { z } from 'zod'
import type {
  AccountGame,
  AccountProvider
} from 'common/types/connectedAccounts'

const id = z.union([z.string().min(1), z.number()]).transform(String)
const httpsImage = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined
    try {
      return new URL(value).protocol === 'https:' ? value : undefined
    } catch {
      return undefined
    }
  })

export function uniqueGames(games: AccountGame[]): AccountGame[] {
  return [...new Map(games.map((game) => [game.id, game])).values()]
}

function requireCompleteGraphQlResponse(input: unknown): void {
  const response = z
    .object({ errors: z.array(z.unknown()).optional() })
    .parse(input)
  if (response.errors?.length) throw new Error('CATALOG_INCOMPLETE')
}

export function parseXboxCatalog(input: unknown): {
  games: AccountGame[]
  next?: string
} {
  const result = z
    .object({
      titles: z.array(
        z.object({
          titleId: id,
          name: z.string().min(1),
          type: z.string().optional(),
          displayImage: httpsImage,
          detail: z.object({ description: z.string().optional() }).optional()
        })
      ),
      pagingInfo: z
        .object({ continuationToken: z.string().nullish() })
        .optional()
    })
    .parse(input)
  return {
    games: result.titles
      .filter((game) => !game.type || game.type === 'Game')
      .map((game) => ({
        id: game.titleId,
        title: game.name,
        cover: game.displayImage,
        description: game.detail?.description,
        storeUrl: `https://www.xbox.com/search?q=${encodeURIComponent(game.name)}`
      })),
    next: result.pagingInfo?.continuationToken || undefined
  }
}

export function parseEaCatalog(input: unknown): {
  games: AccountGame[]
  next?: string
  userId: string
  totalCount?: number
} {
  requireCompleteGraphQlResponse(input)
  const result = z
    .object({
      data: z.object({
        me: z.object({
          id,
          ownedGameProducts: z.object({
            totalCount: z.number().int().nonnegative().optional(),
            next: z.string().nullish(),
            items: z.array(
              z.object({
                id,
                originOfferId: z.string().nullish(),
                product: z.object({
                  name: z.string().min(1),
                  gameSlug: z.string().nullish()
                })
              })
            )
          })
        })
      })
    })
    .parse(input).data.me
  return {
    userId: result.id,
    totalCount: result.ownedGameProducts.totalCount,
    next: result.ownedGameProducts.next || undefined,
    games: result.ownedGameProducts.items.map((game) => ({
      id: game.originOfferId || game.id,
      title: game.product.name,
      storeUrl: game.product.gameSlug
        ? `https://www.ea.com/games/${encodeURIComponent(game.product.gameSlug)}`
        : 'https://www.ea.com/ea-app'
    }))
  }
}

export function eaCatalogUrl(next = '0'): string {
  const query = new URLSearchParams({
    operationName: 'getPreloadedOwnedGames',
    variables: JSON.stringify({
      isMac: false,
      addFieldsToPreloadGames: true,
      locale: 'en',
      limit: 500,
      next,
      type: ['DIGITAL_FULL_GAME', 'PACKAGED_FULL_GAME'],
      entitlementEnabled: true,
      storefronts: ['EA', 'STEAM', 'EPIC'],
      platforms: ['PC'],
      ownershipMethods: [
        'UNKNOWN',
        'ASSOCIATION',
        'PURCHASE',
        'REDEMPTION',
        'GIFT_RECEIPT',
        'ENTITLEMENT_GRANT',
        'DIRECT_ENTITLEMENT',
        'PRE_ORDER_PURCHASE',
        'VAULT',
        'XGP_VAULT',
        'STEAM',
        'STEAM_VAULT',
        'STEAM_SUBSCRIPTION',
        'EPIC',
        'EPIC_VAULT',
        'EPIC_SUBSCRIPTION'
      ]
    }),
    extensions: JSON.stringify({
      persistedQuery: {
        version: 1,
        sha256Hash:
          '779f1cd1355699752e20c0b3877847f4e3010ef5de131c248e98f8eff84f0718'
      }
    })
  })
  return `https://service-aggregation-layer.juno.ea.com/graphql?${query}`
}

export function parseUbisoftCatalog(input: unknown): AccountGame[] {
  requireCompleteGraphQlResponse(input)
  const result = z
    .object({
      data: z.object({
        viewer: z.object({
          ownedGames: z.object({
            totalCount: z.number().int().nonnegative(),
            nodes: z.array(z.object({ id, name: z.string().min(1) }))
          })
        })
      })
    })
    .parse(input).data.viewer.ownedGames
  // Never replace a complete cache with a silently truncated remote library.
  if (result.nodes.length < result.totalCount)
    throw new Error('CATALOG_INCOMPLETE')
  return result.nodes.map((game) => ({
    id: game.id,
    title: game.name,
    storeUrl: `https://store.ubisoft.com/search?q=${encodeURIComponent(game.name)}`
  }))
}

export function parseBattleNetCatalog(
  input: unknown,
  classics: unknown
): AccountGame[] {
  const modern = z
    .object({
      gameAccounts: z.array(
        z.object({
          titleId: id,
          localizedGameName: z.string().min(1)
        })
      )
    })
    .parse(input)
  const legacy = z
    .object({
      classicGames: z.array(
        z.object({
          localizedGameName: z.string().min(1)
        })
      )
    })
    .parse(classics)
  return uniqueGames(
    [
      ...modern.gameAccounts.map((game) => ({
        id: game.titleId,
        title: game.localizedGameName
      })),
      ...legacy.classicGames.map((game) => ({
        id: `classic-${game.localizedGameName}`,
        title: game.localizedGameName
      }))
    ].map((game) => ({ ...game, storeUrl: 'https://account.battle.net/games' }))
  )
}

export function accountAppName(
  provider: AccountProvider,
  gameId: string
): string {
  return `account-${provider}-${encodeURIComponent(gameId)}`
}
