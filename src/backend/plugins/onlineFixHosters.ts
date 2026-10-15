import { directHoster as onlineFixHoster, directNonDownloadUrl as onlineFixNonDownloadUrl, type DirectHoster as OnlineFixHoster } from './directHosters'
export { directHoster as onlineFixHoster, directNonDownloadUrl as onlineFixNonDownloadUrl, directHosterScript as onlineFixHosterScript } from './directHosters'
import { Parser } from 'htmlparser2'
import { onlineFixDownloadUrl } from './onlineFixUrls'
import { archivePathIsSafe } from './externalPolicy'

export const ONLINE_FIX_DIRECT_ID = 'online-fix-hosters-direct'
export const ONLINE_FIX_PASSWORD = 'online-fix.me'
export type { DirectHoster as OnlineFixHoster } from './directHosters'
export interface OnlineFixPackage {
  name: string
  role: 'game' | 'fix'
  mirrors: Array<{ hoster: OnlineFixHoster; url: string }>
}
export interface OnlineFixDownloadedPackage {
  name: string
  role: 'game' | 'fix'
  archive: string
  bytes: number
}

export function isOnlineFixHostersUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password &&
      url.hostname === 'hosters.online-fix.me' && (!url.port || url.port === '2053')
  } catch { return false }
}

export function onlineFixDirectUrl(value: string): boolean {
  return onlineFixDownloadUrl(value) || isOnlineFixHostersUrl(value) ||
    Boolean(onlineFixHoster(value) && !onlineFixNonDownloadUrl(value))
}

export function findOnlineFixHostersPage(html: string, base: string): string | undefined {
  const links = new Set<string>()
  new Parser({ onopentag(tag, attrs) {
    if (tag !== 'a' || !attrs.href) return
    try {
      const url = new URL(attrs.href, base)
      if (isOnlineFixHostersUrl(url.href) && !['/', '/login'].includes(url.pathname) &&
          !url.pathname.startsWith('/static/')) links.add(url.href)
    } catch { /* Not a URL. */ }
  } }).end(html)
  return links.size === 1 ? [...links][0] : undefined
}

export function parseOnlineFixPackages(html: string, base: string): OnlineFixPackage[] {
  if (!isOnlineFixHostersUrl(base)) throw new Error('Catálogo de hosters Online-Fix inválido.')
  const collected: unknown[] = []
  new Parser({ onopentag(_tag, attrs) {
    if (!attrs['data-links']) return
    let entries: unknown
    try { entries = JSON.parse(attrs['data-links']) } catch { return }
    if (!Array.isArray(entries) || entries.length > 100) return
    if (collected.length + entries.length <= 200) collected.push(...entries as unknown[])
  } }).end(html)
  return onlineFixPackagesFromEntries(collected)
}

export function onlineFixPackagesFromEntries(entries: unknown[]): OnlineFixPackage[] {
  if (entries.length > 200) return []
  const packages = new Map<string, OnlineFixPackage>()
  for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !('file_name' in entry) || !('direct_link' in entry) ||
          typeof entry.file_name !== 'string' || typeof entry.direct_link !== 'string') continue
      const name = entry.file_name
      if (!archivePathIsSafe(name) || name.length > 240 || /[/\\]/.test(name) || name.startsWith('.') ||
          !/\.(?:rar|zip|7z)$/i.test(name)) continue
      const hoster = onlineFixDirectUrl(entry.direct_link) && onlineFixHoster(entry.direct_link)
      if (!hoster) continue
      const key = name.toLowerCase()
      const item: OnlineFixPackage = packages.get(key) || {
        name, role: /(?:^|[_. -])fix(?:[_. -]|$)/i.test(name) ? 'fix' : 'game', mirrors: []
      }
      if (!item.mirrors.some(mirror => mirror.url === entry.direct_link))
        item.mirrors.push({ hoster, url: entry.direct_link })
      packages.set(key, item)
  }
  const result = [...packages.values()]
  if (!result.length) return []
  const game = result.filter(item => item.role === 'game')
  const fixes = result.filter(item => item.role === 'fix')
  if (!game.length || !fixes.length)
    throw new Error('O catálogo não forneceu os pacotes do jogo e do fix. Não será instalada uma versão incompleta.')
  // Multiple editions/fixes must not be silently combined. Multipart RARs are
  // siblings of one package and retain their original filenames for 7-Zip.
  for (const group of [game, fixes]) {
    if (group.length > 1) {
      const stems = new Set(group.map(item => item.name.replace(/\.part\d+\.rar$/i, '').toLowerCase()))
      const parts = group.map(item => Number(/\.part(\d+)\.rar$/i.exec(item.name)?.[1]))
      if (stems.size !== 1 || parts.some(part => !part) ||
          [...parts].sort((a, b) => a - b).some((part, index) => part !== index + 1))
        throw new Error('O catálogo contém edições ou fixes diferentes. Escolha uma edição antes de instalar.')
    }
  }
  return result.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.role === 'game' ? -1 : 1))
}

export function onlineFixHosterDownloadUrl(url: string): string {
  const parsed = new URL(url)
  const id = parsed.hostname === 'pixeldrain.com' && /^\/u\/([a-zA-Z0-9_-]+)$/.exec(parsed.pathname)?.[1]
  return id ? `https://pixeldrain.com/api/file/${id}?download` : url
}

