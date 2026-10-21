import { BrowserWindow, session } from 'electron'
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

/** Use an isolated ordinary browser session. Challenges/consent are treated as unavailable. */
function googleImages(request: ExternalCoverRequest): Promise<string[]> {
  if (Date.now() < googleUnavailableUntil) return Promise.resolve([])
  const queuedAt = Date.now()
  const task = queue.then(async () => {
    if (Date.now() - queuedAt > 6000 || Date.now() < googleUnavailableUntil)
      return []
    const imageSession = session.fromPartition('ghost-public-cover-search')
    imageSession.setPermissionRequestHandler(
      (_contents, _permission, respond) => respond(false)
    )
    imageSession.webRequest.onBeforeRequest((details, respond) =>
      respond({
        cancel: ['image', 'media', 'font'].includes(details.resourceType)
      })
    )
    const window = new BrowserWindow({
      show: false,
      width: 1000,
      height: 700,
      webPreferences: {
        session: imageSession,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    const target = new URL('https://www.google.com/search')
    target.search = new URLSearchParams({
      udm: '2',
      hl: 'pt-BR',
      q: `"${request.title}" ${request.platform === 'switch' ? 'Nintendo Switch' : 'PC'} game cover 600x900`
    }).toString()
    return new Promise<string[]>((resolve) => {
      let settled = false
      const finish = (urls: string[]) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (!window.isDestroyed()) window.destroy()
        resolve(urls)
      }
      const timer = setTimeout(() => finish([]), 6000)
      window.webContents.on('will-navigate', (event, url) => {
        if (!/^https:\/\/(?:www\.)?google\.com\/(?:search|sorry\/)/.test(url)) {
          event.preventDefault()
          finish([])
        }
      })
      window.webContents.on('did-navigate', (_event, url) => {
        if (url.includes('/sorry/') || url.includes('consent.google.')) {
          googleUnavailableUntil = Date.now() + 10 * 60_000
          finish([])
        }
      })
      window.webContents.on('did-finish-load', () => {
        void window.webContents
          .executeJavaScript('document.documentElement.outerHTML')
          .then((html: unknown) => {
            if (
              typeof html === 'string' &&
              /unusual traffic|\/sorry\/|g-recaptcha/i.test(html)
            )
              googleUnavailableUntil = Date.now() + 10 * 60_000
            finish(typeof html === 'string' ? googleCoverCandidates(html) : [])
          })
          .catch(() => finish([]))
      })
      window.on('closed', () => finish([]))
      void window.loadURL(target.toString()).catch((error: unknown) => {
        if (
          !(
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ERR_ABORTED'
          )
        )
          finish([])
      })
    })
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
