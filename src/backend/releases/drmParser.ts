import type { ReleaseDrmSource, ReleaseDrmStatus } from 'common/releaseDrm'
import { normalizeDrmTitle, safeDrmSourceUrl } from 'common/releaseDrm'
import { exactDate } from './parser'

const statusMap: Record<string, ReleaseDrmStatus> = {
  cracked: 'cracked',
  uncracked: 'uncracked',
  unreleased: 'unreleased',
  hypervisor: 'bypassed',
  bypassed: 'bypassed',
  'drm free': 'drm-free',
  'drm removed': 'drm-free',
  'early access': 'early-access'
}
export function parseIsItCracked(
  value: unknown,
  title: string,
  url: string
): ReleaseDrmSource | undefined {
  const data = value as Record<string, unknown>
  if (
    !data ||
    !normalizeDrmTitle(title) ||
    typeof data.title !== 'string' ||
    normalizeDrmTitle(data.title) !== normalizeDrmTitle(title) ||
    typeof data.status !== 'string' ||
    !safeDrmSourceUrl(url)
  )
    return undefined
  const status = statusMap[data.status.toLowerCase().trim()]
  if (!status) return undefined
  const field = (key: string) => {
    const value = data[key]
    return typeof value === 'string' &&
      value.length <= 150 &&
      !/^(TBD|TBA|N\/A|Unknown)$/i.test(value.trim())
      ? value.trim()
      : undefined
  }
  return {
    name: 'IsItCracked',
    url,
    title: data.title,
    status,
    protection: field('protection'),
    crackDate: exactDate(field('crackDate') || '') || field('crackDate'),
    group: field('group')
  }
}

/** Discussion, repack/update announcements and similar game names are not proof of a base-game release. */
export function parseCrackWatch(
  value: unknown,
  title: string
): ReleaseDrmSource[] {
  if (!normalizeDrmTitle(title)) return []
  const data = value as {
    data?: { children?: { data?: Record<string, unknown> }[] }
  }
  if (!Array.isArray(data?.data?.children)) return []
  const results: ReleaseDrmSource[] = []
  for (const child of data.data.children.slice(0, 25)) {
    const post = child?.data
    if (
      !post ||
      String(post.subreddit).toLowerCase() !== 'crackwatch' ||
      typeof post.title !== 'string' ||
      post.title.length > 300 ||
      typeof post.link_flair_text !== 'string' ||
      typeof post.permalink !== 'string' ||
      /\b(update|hotfix|crackfix|repack|dlc|rumou?r|question)\b/i.test(
        post.title
      )
    )
      continue
    const game = post.title
      .replace(
        /-(?:voices38|rune|codex|tenoke|skidrow|cpy|empress|razor1911|p2p|reloaded|flt|goldberg|artifact|hypervisor)\b.*$/i,
        ''
      )
      .replace(/\s*\(C-S\)\s*$/i, '')
    if (normalizeDrmTitle(game) !== normalizeDrmTitle(title)) continue
    const flair = post.link_flair_text.toLowerCase()
    const status: ReleaseDrmStatus | undefined = /hypervisor|bypass/.test(flair)
      ? 'bypassed'
      : /drm removed/.test(flair)
        ? 'drm-free'
        : /^(denuvo release|release)$/.test(flair.trim())
          ? 'cracked'
          : undefined
    const url = safeDrmSourceUrl('https://www.reddit.com' + post.permalink)
    if (
      !status ||
      !url ||
      typeof post.created_utc !== 'number' ||
      !Number.isFinite(post.created_utc) ||
      post.created_utc < 0 ||
      post.created_utc * 1000 > Date.now() + 86400000
    )
      continue
    results.push({
      name: 'CrackWatch',
      url,
      status,
      title: post.title,
      reportedAt: new Date(post.created_utc * 1000).toISOString()
    })
  }
  return results
    .sort((a, b) => b.reportedAt!.localeCompare(a.reportedAt!))
    .slice(0, 3)
}
