import type { BrowserWindow } from 'electron'
import type { PluginManifest } from 'common/types/plugins'
import { Parser } from 'htmlparser2'
import { builtinGameSources } from 'common/builtinGameSources'
import { withSourceEngine } from './sourceEngines'
import { engineProcess } from './engineProcess'
import { experimentalPage, isAdaptiveGamePath } from './adaptiveSource'
import { evaluateAnkerPage } from './ankerNavigation'
import { isSourceUrl, sourceDomains } from './sourceSettings'
import { directNonDownloadUrl } from './directHosters'

export interface DirectPageData {
  links: Array<{ url: string; title: string }>
  entries: unknown[]
}
const operation = 'direct-download-page-v1'
const empty = (): DirectPageData => ({ links: [], entries: [] })
const excluded =
  /torrent|magnet|report|abuse|denunciar|donat|premium|download manager|soundtrack|update only|fix only|crack only|extension|install browser/i
const downloadLabel =
  /^(?:download|baixar|continue to|continuar para|direct\b|filekeeper|fileditch|pixeldrain|gofile|vikingfile|megadb|buzzheavier|datanodes)/i

/** Data only. Form bodies, scripts, credentials and cookies stay in Electron. */
export function directPageSnapshotScript() {
  return `(() => {
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll('script, style, iframe, input, textarea, meta, link, [contenteditable]').forEach(node => node.remove());
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of [...node.attributes])
      if (!['href','title','aria-label','alt','download','data-links'].includes(attr.name)) node.removeAttribute(attr.name);
    const html = copy.outerHTML;
    return html.length <= 2097152 ? { url: location.href, html } : null;
  })()`
}

function publicLinks(html: string, base: string): DirectPageData {
  const result = empty()
  let current: { url: string; title: string } | undefined
  new Parser({
    onopentag(tag, attrs) {
      if (attrs['data-links'] && result.entries.length < 200) {
        try {
          const entries: unknown = JSON.parse(attrs['data-links'])
          if (Array.isArray(entries))
            result.entries.push(
              ...(entries as unknown[]).slice(0, 200 - result.entries.length)
            )
        } catch {
          /* Invalid metadata. */
        }
      }
      if (tag === 'a' && attrs.href) {
        try {
          current = {
            url: new URL(attrs.href, base).href,
            title: attrs['aria-label'] || attrs.title || attrs.download || ''
          }
        } catch {
          current = undefined
        }
      }
      if (tag === 'img' && current && !current.title)
        current.title = attrs.alt || ''
    },
    ontext(value) {
      if (current) current.title += ` ${value.slice(0, 300)}`
    },
    onclosetag(tag) {
      if (tag === 'a' && current) {
        if (result.links.length < 200) result.links.push(current)
        current = undefined
      }
    }
  }).end(html)
  return result
}

export function validateDirectPageData(
  value: unknown,
  base: string,
  allowed: (url: string) => boolean
): DirectPageData {
  if (
    !value ||
    typeof value !== 'object' ||
    !('capability' in value) ||
    value.capability !== operation ||
    !('links' in value) ||
    !Array.isArray(value.links) ||
    value.links.length > 200 ||
    !('entries' in value) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 200
  )
    return empty()
  const links: DirectPageData['links'] = []
  for (const item of value.links as unknown[]) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('url' in item) ||
      !('title' in item) ||
      typeof item.url !== 'string' ||
      typeof item.title !== 'string' ||
      item.title.length > 500
    )
      continue
    try {
      const target = new URL(item.url, base)
      const title = item.title
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^[^\p{L}\p{N}]+/u, '')
      if (
        target.protocol !== 'https:' ||
        target.username ||
        target.password ||
        target.hash ||
        target.href === base ||
        directNonDownloadUrl(target.href) ||
        !allowed(target.href) ||
        excluded.test(title)
      )
        continue
      // Online-Fix's dedicated hosters directory is also a download control.
      const hosters =
        target.hostname === 'hosters.online-fix.me' &&
        !/^\/(?:login|static|$)/i.test(target.pathname)
      if (
        !hosters &&
        !downloadLabel.test(title) &&
        !/\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)$/i.test(title)
      )
        continue
      if (!links.some((link) => link.url === target.href))
        links.push({ url: target.href, title })
    } catch {
      /* Untrusted worker URL. */
    }
  }
  // Package entries are validated by Online-Fix's existing game/fix parser.
  return { links, entries: value.entries }
}

export function directPageNavigation(
  data: DirectPageData | undefined,
  source: boolean,
  expected?: string
): string[] {
  if (!data) return []
  if (source) return data.links.map((link) => link.url)
  const files = data.links.flatMap((link) => {
    try {
      const filename = decodeURIComponent(
        new URL(link.url).pathname.split('/').pop() || ''
      )
      return (
        expected
          ? filename.toLowerCase() === expected.toLowerCase()
          : /\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)$/i.test(filename)
      )
        ? [link.url]
        : []
    } catch {
      return []
    }
  })
  // A hoster can offer several files. Keep ambiguous choices and POST controls
  // in the existing filename-aware browser/manual flow.
  return files.length === 1 ? files : []
}

export async function readDirectPage(
  html: string,
  base: string,
  manifest: PluginManifest,
  allowed: (url: string) => boolean,
  current: () => boolean = () => true
): Promise<DirectPageData> {
  if (
    !current() ||
    html.length > 2 * 1024 * 1024 ||
    !allowed(base) ||
    !builtinGameSources.some((source) => source.id === manifest.id)
  )
    return empty()
  try {
    const adaptive = await withSourceEngine('scrapling', async (executable) => {
      if (!current()) return empty()
      // Old workers may treat an unknown operation as a catalog request. Never
      // interpret that output as a download instruction or roll back that worker.
      try {
        const raw: unknown = JSON.parse(
          await engineProcess(
            executable,
            [],
            JSON.stringify({ protocol: 1, operation, html, base }),
            4000
          )
        )
        return validateDirectPageData(raw, base, allowed)
      } catch {
        return empty()
      }
    })
    if (!current()) return empty()
    if (adaptive && (adaptive.links.length || adaptive.entries.length))
      return adaptive
  } catch {
    /* Optional engine; native controls remain available. */
  }
  // Only an original, public source page may be rendered separately. Signed
  // redirects, hoster forms and authenticated package directories keep their session.
  let publicPage = false
  try {
    const url = new URL(base)
    publicPage =
      !url.search &&
      !url.port &&
      isSourceUrl(manifest.id, base) &&
      isAdaptiveGamePath(manifest.id, url.pathname) &&
      !/\/(?:download|login|account)(?:\/|$)/i.test(url.pathname)
  } catch {
    /* Invalid base. */
  }
  if (!publicPage || !current()) return empty()
  try {
    const rendered = await experimentalPage(base, {
      ...manifest,
      allowedDomains: [
        ...sourceDomains(manifest.id),
        'challenges.cloudflare.com'
      ]
    })
    if (!current() || !rendered || rendered.length > 2 * 1024 * 1024)
      return empty()
    return validateDirectPageData(
      { capability: operation, ...publicLinks(rendered, base) },
      base,
      allowed
    )
  } catch {
    return empty()
  }
}

/** Background reader: optional engine latency never holds the manual watchdog. */
export class DirectPageEngines {
  private active = true
  private pages = new Map<
    number,
    { url: string; pending: boolean; data?: DirectPageData }
  >()
  constructor(
    private manifest: PluginManifest,
    private allowed: (url: string) => boolean
  ) {}
  stop() {
    this.active = false
    this.pages.clear()
  }
  pending(member: BrowserWindow) {
    const page = this.pages.get(member.webContents.id)
    return page?.url === member.webContents.getURL() && page.pending
  }
  poll(member: BrowserWindow): DirectPageData | undefined {
    if (!this.active || member.isDestroyed()) return undefined
    const url = member.webContents.getURL()
    const previous = this.pages.get(member.webContents.id)
    if (previous?.url === url) return previous.data
    if (!this.allowed(url) || this.pages.size >= 40) return undefined
    const state = {
      url,
      pending: true,
      data: undefined as DirectPageData | undefined
    }
    this.pages.set(member.webContents.id, state)
    void (async () => {
      try {
        const snapshot = await evaluateAnkerPage(
          member,
          directPageSnapshotScript()
        )
        if (
          !this.active ||
          member.isDestroyed() ||
          member.webContents.getURL() !== url ||
          !snapshot ||
          typeof snapshot !== 'object' ||
          !('url' in snapshot) ||
          snapshot.url !== url ||
          !('html' in snapshot) ||
          typeof snapshot.html !== 'string'
        )
          return
        const data = await readDirectPage(
          snapshot.html,
          url,
          this.manifest,
          this.allowed,
          () =>
            this.active &&
            !member.isDestroyed() &&
            member.webContents.getURL() === url &&
            this.pages.get(member.webContents.id) === state
        )
        if (
          this.active &&
          !member.isDestroyed() &&
          member.webContents.getURL() === url &&
          this.pages.get(member.webContents.id) === state
        )
          state.data = data
      } finally {
        state.pending = false
      }
    })().catch(() => {
      state.pending = false
    })
    return undefined
  }
}
