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

const KNOWN_RELEASE_GROUPS =
  'RUNE|CODEX|SKIDROW|RELOADED|TENOKE|FLT|RAZOR1911|voices38|P2P|0xdeadcode|0xdeadc0de|GOG|EMPRESS|CPY|PLAZA|HOODLUM|DARKSiDERS|I_KnoW|TiNYiSO|DOGE|CHRONOS|DELUSIONAL|GOLDBERG|INSANERAMZES|DINOByTES|SiMPLEX|FCKDRM|bADkARMA'
const TRAILING_GROUP_RE = new RegExp(`[-–](${KNOWN_RELEASE_GROUPS})\\s*$`, 'i')
const VERSION_SUFFIX_RE =
  /\s+(?:v\d+(?:\.\d+)*(?:\.[a-z0-9]+|[a-z])?(?:\s+(?:build\s*)?\d+)?|build\s*\d+)\s*$/i
const EARLY_ACCESS_SUFFIX_RE = /\s+early\s+access\s*$/i

function matchingTitle(value: string, title: string, releaseName = false) {
  let clean = value.trim()
  if (releaseName) {
    clean = clean.replace(TRAILING_GROUP_RE, '').trim()
    // Strip version/build/early-access suffixes (e.g. v1.17.2, v20261119, v2.5.HF, Build 26681065, Early Access)
    // only when not part of edition/update/repack noise.
    if (!/\b(update|hotfix|repack|dlc|demo|bypass|hypervisor)\b/i.test(clean)) {
      for (let i = 0; i < 2; i++) {
        const next = clean
          .replace(EARLY_ACCESS_SUFFIX_RE, '')
          .replace(VERSION_SUFFIX_RE, '')
          .trim()
        if (next === clean) break
        clean = next
      }
    }
  }
  return !!title.trim() && normalizeDrmTitle(clean) === normalizeDrmTitle(title)
}

function normalizeUrlForCompare(raw: string): string {
  return raw.trim().replace(/\/+$/, '').toLowerCase()
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
  if (!canonical || normalizeUrlForCompare(canonical) !== normalizeUrlForCompare(url))
    return undefined
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
  const headingText = text(heading)
  const group = headingText.match(TRAILING_GROUP_RE)?.[1]
  const isEarlyAccessRelease = EARLY_ACCESS_SUFFIX_RE.test(headingText)
  const isBuildOrVersionRelease = VERSION_SUFFIX_RE.test(headingText)
  if (
    (!group && !isEarlyAccessRelease && !isBuildOrVersionRelease) ||
    /\b(update|hotfix|repack|dlc|demo|bypass|hypervisor)\b/i.test(headingText)
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
  const hasFullGameCategory =
    categories.includes('PC GAMES') || categories.includes('REQUEST ACCEPTED')
  if (
    !hasFullGameCategory ||
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
  const metadata = paragraphs.find((value) => /^Title:\s*/i.test(value))
  const game = metadata?.match(/^Title:\s*([^\r\n]+)/i)?.[1]
  const releaseLabel = metadata?.match(/Release Date:\s*([^\r\n]+)/i)?.[1] || ''
  const releaseDate = exactDate(
    releaseLabel.replace(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/, '$2 $1, $3')
  )
  const headingLower = headingText.toLowerCase()
  const hasReleaseSize = paragraphs.some((value) => {
    const firstLine = value.split(/\r?\n/)[0]?.trim().toLowerCase() || ''
    return (
      (value.toLowerCase().startsWith(headingLower + '\n') ||
        value.toLowerCase().startsWith(headingLower + '\r\n') ||
        (firstLine.length > 0 &&
          normalizeDrmTitle(firstLine) === normalizeDrmTitle(headingText))) &&
      /\bSize:\s*\d/i.test(value)
    )
  })
  if (
    !game ||
    !matchingTitle(game, title) ||
    !releaseDate ||
    releaseDate > posted ||
    !hasReleaseSize
  )
    return undefined
  const isGogDrmFree = !!group && /^gog$/i.test(group)
  const formattedDate = posted.split('-').reverse().join('/')
  return {
    name: 'SkidrowReloaded',
    url,
    title: headingText,
    status: isGogDrmFree ? 'drm-free' : 'cracked',
    ...(group ? { group } : {}),
    availability: 'listed',
    observedAt: new Date().toISOString(),
    category: isGogDrmFree
      ? `Release GOG (sem DRM) publicado em ${formattedDate}.`
      : group
        ? `Anúncio do grupo publicado em ${formattedDate}; quebra relatada pela fonte.`
        : isEarlyAccessRelease
          ? `Release Early Access publicado em ${formattedDate}; quebra relatada pela fonte.`
          : `Release P2P publicado em ${formattedDate}; quebra relatada pela fonte.`
  }
}

/** Search results only identify candidate pages; they never supply a DRM verdict. */
export function findDrmSiteGames(
  html: string,
  title: string,
  name: 'AnkerGames' | 'SkidrowReloaded'
): string[] {
  const base =
    name === 'AnkerGames'
      ? 'https://ankergames.net'
      : 'https://www.skidrowreloaded.com'
  const root = parseDocument(html)
  const allLinks = DomUtils.findAll(
    (element) =>
      element.name === 'a' && !!element.attribs.href && !excluded(element),
    root.children
  )

  // On SkidrowReloaded, prioritize main search result headings (h2 > a) over sidebar links
  const orderedLinks =
    name === 'SkidrowReloaded'
      ? [
          ...allLinks.filter(
            (el) => el.parent && DomUtils.isTag(el.parent) && el.parent.name === 'h2'
          ),
          ...allLinks.filter(
            (el) => !(el.parent && DomUtils.isTag(el.parent) && el.parent.name === 'h2')
          )
        ]
      : allLinks

  const groupedMatches: string[] = []
  const otherMatches: string[] = []
  for (const link of orderedLinks) {
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
    if (
      name === 'SkidrowReloaded' &&
      /\b(update|hotfix|repack|dlc|demo|bypass|hypervisor)\b/i.test(label)
    )
      continue
    if (matchingTitle(label, title, name === 'SkidrowReloaded')) {
      const bucket =
        name === 'SkidrowReloaded' && TRAILING_GROUP_RE.test(label)
          ? groupedMatches
          : otherMatches
      if (!groupedMatches.includes(url) && !otherMatches.includes(url))
        bucket.push(url)
    }
  }
  return [...groupedMatches, ...otherMatches].slice(0, 4)
}

/** Search results only identify a page; they never supply a DRM verdict. */
export function findDrmSiteGame(
  html: string,
  title: string,
  name: 'AnkerGames' | 'SkidrowReloaded'
) {
  return findDrmSiteGames(html, title, name)[0]
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
