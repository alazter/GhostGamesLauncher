import { isSourceUrl, canonicalSourceUrl } from './sourceSettings'

export const ONLINE_FIX_SOURCE_ID = 'com.ghost.online-fix-source'
export const ONLINE_FIX_TORRENT_ID = 'online-fix-official-torrent'

export function onlineFixGameUrl(value: string): string {
  const url = new URL(value)
  if (
    !isSourceUrl(ONLINE_FIX_SOURCE_ID, value) ||
    !/^\/games\/.+\.html$/.test(url.pathname)
  ) {
    throw new Error('Página de jogo Online-Fix inválida.')
  }
  url.search = ''
  url.hash = ''
  return canonicalSourceUrl(ONLINE_FIX_SOURCE_ID, url.href)
}

export function onlineFixDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    // The official torrent directory and its files use HTTPS on port 2053.
    // Keep this exception scoped to the observed upload host.
    if (url.port) {
      return url.port === '2053' && url.hostname === 'uploads.online-fix.me'
    }
    return isSourceUrl(ONLINE_FIX_SOURCE_ID, value, true)
  } catch {
    return false
  }
}

export function isOnlineFixTorrentUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      onlineFixDownloadUrl(value) &&
      url.hostname === 'uploads.online-fix.me' &&
      /^\/torrents\/[^/]+\//.test(url.pathname) &&
      !url.hash
    )
  } catch {
    return false
  }
}
