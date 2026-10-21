import type { BrowserWindow } from 'electron'
import type { PluginManifest } from 'common/types/plugins'
import { Parser, parseDocument, DomUtils } from 'htmlparser2'
import {
  describeDownloadAction,
  type DownloadAction
} from 'common/directDownloadLearning'
import {
  DownloadEngineMemory,
  downloadEngineMemory,
  sameEngineControl,
  validEngineControl,
  engineControlLabel,
  enginePageKey,
  type DownloadEngine
} from './downloadEngineMemory'
import type { DirectDownloadLearning } from './directDownloadLearning'
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
  actions?: DownloadAction[]
}
const provenance = new WeakMap<
  DirectPageData,
  { engine: DownloadEngine; page: string }
>()
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
      if (!['href','title','aria-label','aria-disabled','aria-hidden','alt','download','data-links','id','name','data-testid','type','disabled','hidden'].includes(attr.name)) node.removeAttribute(attr.name);
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

/** Obscura supplies HTML; Ghost matches only previously validated semantics.
 * Execution still checks the live Electron DOM and destination before clicking. */
export function engineActionsFromHtml(
  html: string,
  references: DownloadAction[]
): DownloadAction[] {
  if (!references.length || html.length > 2 * 1024 * 1024) return []
  const nodes = DomUtils.findAll(
    (node) => ['a', 'button', 'input'].includes(node.name),
    parseDocument(html).children
  ).slice(0, 200)
  const actions = nodes.flatMap((node) => {
    let parent = node.parent
    let row: string | undefined
    while (parent) {
      if ('name' in parent && 'attribs' in parent) {
        if (
          parent.name === 'form' ||
          parent.attribs.hidden !== undefined ||
          parent.attribs['aria-hidden'] === 'true'
        )
          return []
        if (!row && parent.name === 'li') row = DomUtils.textContent(parent)
      }
      parent = parent.parent
    }
    if (
      node.attribs.form ||
      node.attribs.hidden !== undefined ||
      node.attribs['aria-hidden'] === 'true'
    )
      return []
    const candidate = describeDownloadAction({
      tagName: node.name.toUpperCase(),
      id: node.attribs.id || '',
      textContent: DomUtils.textContent(node),
      getAttribute: (name: string) => node.attribs[name] ?? null,
      hasAttribute: (name: string) => node.attribs[name] !== undefined,
      getClientRects: () => [{}],
      closest: (selector: string) =>
        selector === 'li' && row ? { textContent: row } : null
    } as unknown as Element)
    return candidate &&
      validEngineControl(candidate) &&
      references.some((reference) => sameEngineControl(candidate, reference))
      ? [candidate]
      : []
  })
  // Similarity is not identity: ambiguous controls remain manual.
  return actions
    .filter(
      (action) =>
        actions.filter((other) => sameEngineControl(action, other)).length === 1
    )
    .slice(0, 12)
}

export function validateDirectPageData(
  value: unknown,
  base: string,
  allowed: (url: string) => boolean,
  references: DownloadAction[] = []
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
  const actions =
    'actions' in value &&
    Array.isArray(value.actions) &&
    value.actions.length <= 12
      ? (value.actions as unknown[])
          .filter(validEngineControl)
          .filter((action) =>
            references.some((reference) => sameEngineControl(action, reference))
          )
      : []
  const unique = actions.filter(
    (action) =>
      actions.filter((other) => sameEngineControl(action, other)).length === 1
  )
  return {
    links,
    entries: value.entries,
    ...(unique.length ? { actions: unique } : {})
  }
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
  current: () => boolean = () => true,
  knowledge?: DownloadEngineMemory
): Promise<DirectPageData> {
  if (
    !current() ||
    html.length > 2 * 1024 * 1024 ||
    !allowed(base) ||
    !builtinGameSources.some((source) => source.id === manifest.id)
  )
    return empty()
  try {
    enginePageKey(manifest.id, base)
  } catch {
    return empty()
  }
  const memory = knowledge || (await downloadEngineMemory(validEngineControl))
  const references = memory.controls(manifest.id, base)
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
  for (const engine of memory.order(manifest.id, base)) {
    if (!current()) return empty()
    try {
      let data: DirectPageData | undefined
      if (engine === 'scrapling') {
        data = await withSourceEngine('scrapling', async (executable) => {
          if (!current()) return empty()
          const raw: unknown = JSON.parse(
            await engineProcess(
              executable,
              [],
              JSON.stringify({
                protocol: 1,
                operation,
                html,
                base,
                learnedControls: references
              }),
              4000
            )
          )
          return validateDirectPageData(raw, base, allowed, references)
        })
      } else if (publicPage) {
        const rendered = await experimentalPage(base, {
          ...manifest,
          allowedDomains: [
            ...sourceDomains(manifest.id),
            'challenges.cloudflare.com'
          ]
        })
        if (rendered && rendered.length <= 2 * 1024 * 1024)
          data = validateDirectPageData(
            {
              capability: operation,
              ...publicLinks(rendered, base),
              actions: engineActionsFromHtml(rendered, references)
            },
            base,
            allowed,
            references
          )
      }
      if (!current()) return empty()
      if (
        data &&
        (data.links.length || data.entries.length || data.actions?.length)
      ) {
        provenance.set(data, { engine, page: base })
        return data
      }
      if (data) memory.failure(manifest.id, base, engine)
    } catch {
      /* An unavailable engine does not erase successful knowledge. */
    }
  }
  return empty()
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
    private allowed: (url: string) => boolean,
    private learning?: DirectDownloadLearning
  ) {}
  private acted = new Set<string>()
  observe(member: BrowserWindow, data: DirectPageData) {
    const observation = provenance.get(data)
    if (!observation || !this.active || member.isDestroyed()) return
    const controls =
      data.actions ||
      data.links
        .map((link) => ({
          tag: 'A' as const,
          label: engineControlLabel(link.title)
        }))
        .filter(validEngineControl)
    this.learning?.observeEngine(observation.engine, observation.page, controls)
  }
  async act(
    member: BrowserWindow,
    data: DirectPageData | undefined
  ): Promise<boolean> {
    if (
      !data?.actions ||
      data.actions.length !== 1 ||
      !this.active ||
      member.isDestroyed()
    )
      return false
    const page = member.webContents.getURL()
    const key = page + JSON.stringify(data.actions[0])
    if (!this.allowed(page) || this.acted.has(key) || this.acted.size >= 128)
      return false
    const { learnedDownloadScript } = await import('./directDownloadLearning')
    if (
      !this.active ||
      member.isDestroyed() ||
      member.webContents.getURL() !== page
    )
      return false
    const clicked = await evaluateAnkerPage(
      member,
      learnedDownloadScript(data.actions[0], this.manifest.allowedDomains || [])
    )
    if (clicked !== true || !this.active) return false
    this.acted.add(key)
    this.observe(member, data)
    this.pages.delete(member.webContents.id)
    return true
  }
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
            this.pages.get(member.webContents.id) === state,
          this.learning?.engines
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
