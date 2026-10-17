import { parseDocument, DomUtils } from 'htmlparser2'
import type { ReleaseDrmSource, ReleaseDrmStatus } from 'common/releaseDrm'
import { normalizeDrmTitle, safeDrmSourceUrl } from 'common/releaseDrm'
import { exactDate } from './parser'

type Element = ReturnType<typeof DomUtils.findAll>[number]
const text = (element: Element) => DomUtils.textContent(element).trim()
const excluded = (element: Element): boolean =>
  /comment|install|instruction|download|related|recommend/i.test(
    `${element.attribs.id || ''} ${element.attribs.class || ''}`
  ) ||
  (!!element.parent &&
    DomUtils.isTag(element.parent) &&
    excluded(element.parent))

export function drmPageUnavailable(html: string) {
  const root = parseDocument(html)
  const headings = DomUtils.findAll(
    (element) => ['title', 'h1', 'h2'].includes(element.name),
    root.children
  )
    .map(text)
    .join(' ')
  if (/under maintenance|undergoing maintenance/i.test(headings))
    return 'Site em manutenção; consulte o link da fonte mais tarde.'
  if (
    /rate limited|too many requests|error 1015/i.test(
      DomUtils.textContent(root)
    )
  )
    return 'Consulta indisponível: limite temporário de consultas atingido; aguarde antes de tentar novamente.'
  if (/access denied/i.test(headings))
    return 'A fonte restringiu o acesso nesta conexão; consulte o link mais tarde.'
  if (
    /just a moment|verify.*human|verification required|attention required/i.test(
      headings
    ) ||
    /id=["'](?:challenge-form|cf-chl-widget)/i.test(html)
  )
    return 'O site exige verificação; consulte o link da fonte.'
  return undefined
}

function matchingTitle(value: string, title: string, releaseName = false) {
  const clean = releaseName
    ? value
        .replace(
          /[-–](?:RUNE|CODEX|SKIDROW|RELOADED|TENOKE|FLT|RAZOR1911|voices38)\s*$/i,
          ''
        )
        .replace(/\s+v\d+(?:\.\d+)+(?:\s+(?:build\s*)?\d+)?$/i, '')
    : value
  return !!title.trim() && normalizeDrmTitle(clean) === normalizeDrmTitle(title)
}

/** A complete scene-release announcement, not a download link or a bare scene tag. */
function skidrowAnnouncement(
  html: string,
  title: string,
  url: string
): ReleaseDrmSource | undefined {
  const root = parseDocument(html)
  const canonical = DomUtils.findAll(
    (e) => e.name === 'link' && e.attribs.rel === 'canonical',
    root.children
  )[0]?.attribs.href
  if (canonical !== url) return undefined
  const post = DomUtils.findAll(
    (e) =>
      /(?:^|\s)post-extended(?:\s|$)/.test(e.attribs.class || '') &&
      !excluded(e),
    root.children
  )[0]
  if (!post) return undefined
  const heading = post.children.find(
    (e) => DomUtils.isTag(e) && e.name === 'h2'
  )
  if (
    !heading ||
    !DomUtils.isTag(heading) ||
    !matchingTitle(text(heading), title, true)
  )
    return undefined
  const group = text(heading).match(
    /-(RUNE|CODEX|SKIDROW|RELOADED|TENOKE|FLT|RAZOR1911|voices38)$/i
  )?.[1]
  if (
    !group ||
    /\b(update|hotfix|repack|dlc|demo|bypass|hypervisor)\b/i.test(text(heading))
  )
    return undefined
  const meta = DomUtils.findAll(
    (e) => /(?:^|\s)meta(?:\s|$)/.test(e.attribs.class || '') && !excluded(e),
    post.children
  )[0]
  if (!meta) return undefined
  const categories = DomUtils.findAll(
    (e) => e.name === 'a' && /category/.test(e.attribs.rel || ''),
    meta.children
  ).map(text)
  if (
    !categories.includes('PC GAMES') ||
    categories.some((category) => /UPDATE|REPACK/i.test(category))
  )
    return undefined
  const posted = exactDate(
    text(meta).match(/^Posted\s+(.+?)\s+in\b/i)?.[1] || ''
  )
  if (!posted || posted > new Date().toISOString().slice(0, 10))
    return undefined
  const paragraphs = DomUtils.findAll(
    (e) => e.name === 'p' && !excluded(e),
    post.children
  ).map(text)
  const metadata = paragraphs.find((value) => /^Title:\s*/.test(value))
  const game = metadata?.match(/^Title:\s*([^\r\n]+)/)?.[1]
  const releaseLabel = metadata?.match(/Release Date:\s*([^\r\n]+)/)?.[1] || ''
  const releaseDate = exactDate(
    releaseLabel.replace(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/, '$2 $1, $3')
  )
  if (
    !game ||
    !matchingTitle(game, title) ||
    !releaseDate ||
    releaseDate > posted ||
    !paragraphs.some(
      (value) =>
        value.startsWith(text(heading) + '\n') && /\bSize:\s*\d/.test(value)
    )
  )
    return undefined
  return {
    name: 'SkidrowReloaded',
    url,
    title: text(heading),
    status: 'cracked',
    group,
    availability: 'listed',
    observedAt: new Date().toISOString(),
    category: `Anúncio do grupo publicado em ${posted.split('-').reverse().join('/')}; quebra relatada pela fonte.`
  }
}

/** Search results only identify a page; they never supply a DRM verdict. */
export function findDrmSiteGame(
  html: string,
  title: string,
  name: 'AnkerGames' | 'SkidrowReloaded'
) {
  const base =
    name === 'AnkerGames'
      ? 'https://ankergames.net'
      : 'https://www.skidrowreloaded.com'
  const root = parseDocument(html)
  for (const link of DomUtils.findAll(
    (element) =>
      element.name === 'a' && !!element.attribs.href && !excluded(element),
    root.children
  )) {
    let url: string | undefined
    try {
      url = safeDrmSourceUrl(new URL(link.attribs.href, base).href)
    } catch {
      continue
    }
    if (!url || new URL(url).hostname !== new URL(base).hostname) continue
    if (name === 'AnkerGames' && !new URL(url).pathname.startsWith('/game/'))
      continue
    if (name === 'SkidrowReloaded' && new URL(url).pathname === '/') continue
    const label =
      text(link) ||
      link.attribs.title ||
      DomUtils.findAll((e) => e.name === 'img', link.children)[0]?.attribs
        .alt ||
      ''
    if (matchingTitle(label, title, name === 'SkidrowReloaded')) return url
  }
  return undefined
}

export function parseDrmSiteGame(
  html: string,
  title: string,
  url: string,
  name: 'AnkerGames' | 'SkidrowReloaded'
): ReleaseDrmSource | undefined {
  const safe = safeDrmSourceUrl(url)
  if (!safe || drmPageUnavailable(html)) return undefined
  const parsedUrl = new URL(safe)
  if (
    name === 'AnkerGames'
      ? parsedUrl.hostname !== 'ankergames.net' ||
        !parsedUrl.pathname.startsWith('/game/')
      : parsedUrl.hostname !== 'www.skidrowreloaded.com' ||
        parsedUrl.pathname === '/'
  )
    return undefined
  if (name === 'SkidrowReloaded') {
    const announcement = skidrowAnnouncement(html, title, safe)
    if (announcement) return announcement
  }
  const root = parseDocument(html)
  const heading = DomUtils.findAll(
    (e) =>
      (e.name === 'h1' || (name === 'SkidrowReloaded' && e.name === 'h2')) &&
      !excluded(e),
    root.children
  ).find((e) => matchingTitle(text(e), title, name === 'SkidrowReloaded'))
  if (!heading) return undefined
  // Read explicit metadata/NFO only. Comments and installation instructions are excluded.
  let scope: Element = heading
  for (let parent = heading.parent; parent; parent = parent.parent) {
    if (DomUtils.isTag(parent) && ['article', 'main'].includes(parent.name)) {
      scope = parent
      break
    }
  }
  if (scope === heading && heading.parent && DomUtils.isTag(heading.parent))
    scope = heading.parent
  const blocks = DomUtils.findAll(
    (e) =>
      !excluded(e) &&
      (['pre', 'dl'].includes(e.name) ||
        /^(?:drm-status|game-metadata|release-info)$/.test(
          e.attribs.class || ''
        )),
    scope.children
  )
    .map(text)
    .join('\n')
  const statusLine = blocks.match(
    /(?:DRM\s+status|crack\s+status)\s*[:：]\s*(DRM[- ]free|DRM removed|uncracked|cracked|bypassed|hypervisor)\b([^\n\r]*)/i
  )
  const state = statusLine?.[1]?.toLowerCase()
  const partialRemoval =
    state === 'drm removed' && /Denuvo/i.test(statusLine?.[2] || '')
  let status: ReleaseDrmStatus | undefined
  if (state === 'cracked' || state === 'uncracked') status = state
  else if (state === 'bypassed' || state === 'hypervisor') status = 'bypassed'
  else if (state && !partialRemoval) status = 'drm-free'
  const credited = blocks
    .match(
      /(?:cracked\s+by|crack)\s*[:：]\s*([a-z0-9][a-z0-9 ._-]{0,60})/i
    )?.[1]
    ?.trim()
  if (
    !status &&
    credited &&
    /^(?:RUNE|CODEX|SKIDROW|RELOADED|TENOKE|FLT|RAZOR1911|voices38|included)$/i.test(
      credited
    )
  )
    status = 'cracked'
  const group = credited && !/included/i.test(credited) ? credited : undefined
  const protection = blocks
    .match(/(?:protection|DRM protection)\s*[:：]\s*([^\n\r]{1,100})/i)?.[1]
    ?.trim()
  return {
    name,
    url: safe,
    title: text(heading).slice(0, 300),
    availability: 'listed',
    observedAt: new Date().toISOString(),
    ...(status ? { status } : {}),
    ...(group ? { group } : {}),
    ...(protection ? { protection } : {}),
    ...(partialRemoval
      ? {
          category:
            'Remoção de Denuvo informada; demais proteções não confirmadas.'
        }
      : {})
  }
}
