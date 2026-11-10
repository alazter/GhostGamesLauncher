import { net } from 'electron'
import { externalTitleGroupKey, externalTitleKey } from 'common/externalTitle'
import {
  matchingAnkerCovers,
  externalCoverTitle
} from 'common/externalGameCover'
import type {
  ExternalCoverRequest,
  ExternalCoverResult
} from 'common/externalGameCover'
import type { GhostSearchResult } from 'common/types/plugins'
import { getApiKey } from 'backend/storeManagers/sideload/steamgridHelper'
import * as SteamGridDB from 'backend/steamgrid/utils'
import {
  createExternalCoverResolver,
  googleCoverCandidates
} from './externalCoverResolver'

const cache = new Map<string, { at: number; value: Promise<string[]> }>()
let queue = Promise.resolve()
let googleUnavailableUntil = 0

/** Shared bounded caches avoid repeated network searches when opening the download dialog. */
function cached(
  tier: string,
  request: ExternalCoverRequest,
  load: () => Promise<string[]>
) {
  const key = `${tier}:${externalTitleGroupKey(request.title, request.platform || 'windows')}`
  const previous = cache.get(key)
  if (previous && Date.now() - previous.at < 60_000) return previous.value
  if (cache.size >= 256) cache.delete(cache.keys().next().value!)
  const value = load().catch(() => [])
  cache.set(key, { at: Date.now(), value })
  return value
}

/** Lightweight HTTP cover resolution via Steam Store Search API and direct HTTP fallback (ZERO BrowserWindow overhead). */
async function fetchGameCoverCandidates(request: ExternalCoverRequest): Promise<string[]> {
  const cleanTitle = request.title
    .replace(/\b(?:v\d+(?:\.\d+)*|build\s*\d+|repack|edition|deluxe|complete|online\s*fix)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // 1. Steam Store Search API (capa vertical oficial 600x900 da biblioteca Steam via HTTP JSON, 0% CPU, sem janelas nem captchas)
  try {
    const steamTarget = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitle || request.title)}&l=portuguese&cc=BR`
    const res = await net.fetch(steamTarget, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = (await res.json()) as { total?: number; items?: Array<{ id: number; name: string }> }
      if (data.items && data.items.length > 0) {
        const reqKey = externalTitleKey(cleanTitle || request.title)
        const match =
          data.items.find((item) => {
            const itemKey = externalTitleKey(item.name)
            return itemKey === reqKey || itemKey.startsWith(reqKey) || reqKey.startsWith(itemKey)
          }) || data.items[0]

        if (match) {
          return [
            `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${match.id}/library_600x900.jpg`,
            `https://cdn.cloudflare.steamstatic.com/steam/apps/${match.id}/library_600x900.jpg`,
            `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${match.id}/header.jpg`
          ]
        }
      }
    }
  } catch {
    /* Fallback para HTTP direto */
  }

  // 2. HTTP direto net.fetch para Google Images (texto simples HTTP, ZERO BrowserWindow)
  if (Date.now() >= googleUnavailableUntil) {
    try {
      const target = new URL('https://www.google.com/search')
      target.search = new URLSearchParams({
        udm: '2',
        hl: 'pt-BR',
        q: `"${cleanTitle || request.title}" ${request.platform === 'switch' ? 'Nintendo Switch' : 'PC'} game cover 600x900`
      }).toString()

      const res = await net.fetch(target.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(3500)
      })
      if (!res.ok) {
        if (res.status === 429) googleUnavailableUntil = Date.now() + 10 * 60_000
        return []
      }
      const html = await res.text()
      if (/unusual traffic|\/sorry\/|g-recaptcha/i.test(html)) {
        googleUnavailableUntil = Date.now() + 10 * 60_000
        return []
      }
      return googleCoverCandidates(html)
    } catch {
      /* Retorna vazio em caso de falha de rede */
    }
  }

  return []
}

function googleImages(request: ExternalCoverRequest): Promise<string[]> {
  const queuedAt = Date.now()
  const task = queue.then(async () => {
    if (Date.now() - queuedAt > 6000) return []
    return await fetchGameCoverCandidates(request)
  })
  queue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}

export function resolveExternalGameCover(
  request: ExternalCoverRequest,
  findAnker: () => Promise<GhostSearchResult[]>
): Promise<ExternalCoverResult | null> {
  const resolver = createExternalCoverResolver({
    anker: (query) =>
      cached('anker', query, async () =>
        matchingAnkerCovers({
          ...query,
          excludedUrls: [],
          sources: await findAnker()
        })
      ),
    google: (query) => cached('google', query, () => googleImages(query)),
    steamgrid: (query) =>
      cached('steamgrid', query, async () => {
        const key = getApiKey()
        if (!key) return []
        const matches = await SteamGridDB.searchGame(key, query.title)
        const game = matches.find(
          (item) =>
            externalTitleKey(item.name) === externalTitleKey(query.title)
        )
        if (!game) return []
        const grids = await SteamGridDB.getGrids(key, {
          gameId: game.id,
          dimensions: ['600x900'],
          types: ['static'],
          nsfw: 'false'
        })
        return grids.map((grid) => grid.url)
      })
  })
  return resolver({ ...request, title: externalCoverTitle(request.title) })
}
