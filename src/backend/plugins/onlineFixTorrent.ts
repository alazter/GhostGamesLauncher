import { Parser } from 'htmlparser2'
import { createHash } from 'crypto'
import { withSourceEngine } from './sourceEngines'
import { engineProcess } from './engineProcess'
import { experimentalPage } from './adaptiveSource'
import { sourceDomains } from './sourceSettings'
import {
  isOnlineFixTorrentUrl,
  onlineFixGameUrl,
  ONLINE_FIX_SOURCE_ID
} from './onlineFixUrls'

interface TorrentLink {
  url: string
  title: string
}

function parseLinks(html: string, base: string): TorrentLink[] {
  const links: TorrentLink[] = []
  let current: TorrentLink | undefined
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name !== 'a' || !attributes.href || links.length >= 200) return
        try {
          current = { url: new URL(attributes.href, base).href, title: '' }
        } catch {
          current = undefined
        }
      },
      ontext(text) {
        if (current) current.title += text.slice(0, 200)
      },
      onclosetag(name) {
        if (name === 'a' && current) {
          links.push(current)
          current = undefined
        }
      }
    },
    { decodeEntities: true }
  )
  parser.end(html)
  return links
}

function torrentCandidates(links: TorrentLink[], base: string): string[] {
  const directory = isOnlineFixTorrentUrl(base) ? new URL(base) : undefined
  const candidates = [
    ...new Set(
      links.flatMap(({ url }) => {
        if (!isOnlineFixTorrentUrl(url)) return []
        const target = new URL(url)
        if (
          directory &&
          (target.origin !== directory.origin ||
            !target.pathname.startsWith(directory.pathname))
        )
          return []
        if (
          !directory &&
          !target.pathname.endsWith('/') &&
          !/\.torrent$/i.test(target.pathname)
        )
          return []
        if (directory && !/\.torrent$/i.test(target.pathname)) return []
        return [target.href]
      })
    )
  ]
  return candidates
}

export function selectOnlineFixTorrentLink(
  links: TorrentLink[],
  base: string
): string | undefined {
  const candidates = torrentCandidates(links, base)
  // Multiple files/editions require the user's choice; never guess a torrent.
  return candidates.length === 1 ? candidates[0] : undefined
}

export async function resolveOnlineFixTorrentLink(
  html: string,
  base: string
): Promise<string | undefined> {
  if (html.length > 8 * 1024 * 1024) return undefined
  try {
    onlineFixGameUrl(base)
  } catch {
    if (!isOnlineFixTorrentUrl(base)) return undefined
  }
  const candidates = torrentCandidates(parseLinks(html, base), base)
  if (candidates.length > 1) return undefined
  const native = candidates[0]
  try {
    const adaptive = await withSourceEngine(
      'scrapling',
      async (executable, storage) => {
        const output = await engineProcess(
          executable,
          [],
          JSON.stringify({
            protocol: 1,
            operation: 'online-fix-torrent-links-v1',
            html,
            base,
            storage,
            provider: ONLINE_FIX_SOURCE_ID,
            scope: createHash('sha256')
              .update(`${ONLINE_FIX_SOURCE_ID}:torrents`)
              .digest('hex')
          })
        )
        const links: unknown = JSON.parse(output)
        if (!Array.isArray(links) || links.length > 200) return undefined
        return selectOnlineFixTorrentLink(
          links.filter((link: unknown): link is TorrentLink =>
            Boolean(
              link &&
              typeof link === 'object' &&
              'url' in link &&
              typeof link.url === 'string' &&
              'title' in link &&
              typeof link.title === 'string'
            )
          ),
          base
        )
      }
    )
    if (native) return native
    if (adaptive) return adaptive
  } catch {
    // A failed/older optional engine must not disable the native resolver.
    if (native) return native
  }
  if (isOnlineFixTorrentUrl(base)) return undefined
  // Obscura reads only the public game page. Login and torrent downloads keep
  // the existing Electron session; no cookies or credentials leave it.
  try {
    const rendered = await experimentalPage(base, {
      id: ONLINE_FIX_SOURCE_ID,
      name: 'Online-Fix',
      version: '1.0.0',
      author: 'Ghost',
      description: 'Página pública de torrents',
      type: 'game-source',
      permissions: ['network', 'game-sources'],
      allowedDomains: sourceDomains(ONLINE_FIX_SOURCE_ID)
    })
    return rendered
      ? selectOnlineFixTorrentLink(parseLinks(rendered, base), base)
      : undefined
  } catch {
    return undefined
  }
}
