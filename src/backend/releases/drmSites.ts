import { net } from 'electron'
import type { ReleaseDrmSource } from 'common/releaseDrm'
import {
  drmGameSlug,
  drmTitleAliases,
  safeDrmSourceUrl
} from 'common/releaseDrm'
import {
  drmPageUnavailable,
  findDrmSiteGame,
  parseDrmSiteGame
} from './drmSitesParser'

const unavailableUntil = new Map<string, number>()
const notices = new Map<string, string>()
const failedAt = new Map<string, number>()
const inFlight = new Map<string, Promise<string | undefined>>()
const rateLimitedUntil = new Map<string, number>()
class DrmSiteRateLimit extends Error {}
async function page(
  url: string,
  refresh: boolean
): Promise<string | undefined> {
  if (!safeDrmSourceUrl(url)) throw new Error('Endereço de fonte inválido.')
  const host = new URL(url).hostname
  if (Date.now() < (rateLimitedUntil.get(host) || 0))
    throw new DrmSiteRateLimit(
      'Consulta indisponível: limite temporário de acesso. Aguarde antes de tentar novamente.'
    )
  if (
    Date.now() < (unavailableUntil.get(host) || 0) &&
    (!refresh || Date.now() - (failedAt.get(host) || 0) < 60000)
  )
    throw new Error(notices.get(host) || 'Fonte temporariamente indisponível.')
  const current = inFlight.get(url)
  if (current) return current
  const read = (async () => {
    const response = await net.fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
      credentials: 'omit'
    })
    if (response.status === 404) return undefined
    if (response.status === 429) {
      const retry = response.headers.get('retry-after') || ''
      const until = /^\d+$/.test(retry)
        ? Date.now() + Number(retry) * 1000
        : Date.parse(retry)
      rateLimitedUntil.set(
        host,
        Math.max(Date.now() + 60000, Number.isFinite(until) ? until : 0)
      )
      throw new DrmSiteRateLimit(
        'Consulta indisponível (HTTP 429): limite temporário de acesso. Aguarde antes de tentar novamente.'
      )
    }
    if (!response.ok) {
      const notice = `Consulta indisponível (HTTP ${response.status}); consulte o link da fonte.`
      if ([401, 403, 429, 503].includes(response.status)) {
        unavailableUntil.set(host, Date.now() + 60 * 60000)
        notices.set(host, notice)
        failedAt.set(host, Date.now())
      }
      throw new Error(notice)
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('A fonte não forneceu uma página legível.')
    const decoder = new TextDecoder()
    let size = 0,
      html = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 2 * 1024 * 1024)
          throw new Error('Página da fonte muito grande.')
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    const notice = drmPageUnavailable(html)
    if (notice) {
      if (/limite temporário/i.test(notice)) {
        rateLimitedUntil.set(host, Date.now() + 60000)
        throw new DrmSiteRateLimit(notice)
      }
      unavailableUntil.set(host, Date.now() + 60 * 60000)
      notices.set(host, notice)
      failedAt.set(host, Date.now())
      throw new Error(notice)
    }
    return html
  })()
  inFlight.set(url, read)
  try {
    return await read
  } finally {
    inFlight.delete(url)
  }
}

async function lookup(
  title: string,
  name: 'AnkerGames' | 'SkidrowReloaded',
  refresh: boolean,
  browserPage?: (url: string) => Promise<string | undefined>
): Promise<ReleaseDrmSource> {
  const read = async (url: string) => {
    try {
      return await page(url, refresh)
    } catch (error) {
      if (!browserPage || error instanceof DrmSiteRateLimit) throw error
      return browserPage(url)
    }
  }
  const search =
    name === 'AnkerGames'
      ? `https://ankergames.net/search/${encodeURIComponent(title)}`
      : `https://www.skidrowreloaded.com/?s=${encodeURIComponent(title)}`
  try {
    if (name === 'AnkerGames') {
      for (const alias of drmTitleAliases(title)) {
        const url = 'https://ankergames.net/game/' + drmGameSlug(alias)
        const html = await read(url)
        const source = html && parseDrmSiteGame(html, title, url, name)
        if (source) return source
      }
    }
    const html = await read(search)
    const match = html && findDrmSiteGame(html, title, name)
    if (match) {
      const detail = await read(match)
      const source = detail && parseDrmSiteGame(detail, title, match, name)
      if (source) return source
    }
    return {
      name,
      url: search,
      notice: 'Título ou status não confirmado nesta fonte.'
    }
  } catch (error) {
    return {
      name,
      url: search,
      notice:
        error instanceof Error
          ? error.message
          : 'Fonte indisponível; consulte o link.'
    }
  }
}

export async function getAdditionalDrmSources(
  title: string,
  refresh = false,
  manual = false
): Promise<ReleaseDrmSource[]> {
  // Importing browser support is itself restricted to the general manual action.
  const browsers = manual ? await import('./drmManual') : undefined
  const sources = await Promise.all([
    lookup(title, 'SkidrowReloaded', refresh, browsers?.readSkidrowManualPage),
    lookup(title, 'AnkerGames', refresh, browsers?.readAnkerManualPage)
  ])
  // HizSearch requires an interactive site session. Do not borrow its API key or bypass verification.
  return [
    ...sources,
    browsers
      ? await browsers.readHizManualSource(title)
      : {
          name: 'HizSearch',
          url: `https://hizsearch.pages.dev/?q=${encodeURIComponent(title)}`,
          notice: `Pesquise “${title}” no site. A consulta exige verificação manual; uma listagem não confirma quebra de DRM.`
        }
  ]
}
