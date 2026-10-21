import { matchingAnkerCovers, isPublicCoverUrl } from 'common/externalGameCover'
import type {
  ExternalCoverRequest,
  ExternalCoverResult
} from 'common/externalGameCover'

interface Providers {
  anker: (request: ExternalCoverRequest) => Promise<string[]>
  google: (request: ExternalCoverRequest) => Promise<string[]>
  steamgrid: (request: ExternalCoverRequest) => Promise<string[]>
}

/** Each tier is tried only after the previous tier has no usable candidate. */
export function createExternalCoverResolver(providers: Providers) {
  return async (
    request: ExternalCoverRequest
  ): Promise<ExternalCoverResult | null> => {
    if (!request.title?.trim() || request.title.length > 300) return null
    const excluded = new Set((request.excludedUrls || []).slice(0, 30))
    const select = (
      urls: string[],
      provider: ExternalCoverResult['provider']
    ) => {
      const url = urls.find(
        (candidate) => isPublicCoverUrl(candidate) && !excluded.has(candidate)
      )
      return url ? { url, provider } : null
    }
    const known = select(matchingAnkerCovers(request), 'ankergames')
    if (known) return known
    for (const [name, load] of [
      ['ankergames', providers.anker],
      ['google', providers.google],
      ['steamgriddb', providers.steamgrid]
    ] as const) {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const urls = await Promise.race([
          load(request),
          new Promise<string[]>((resolve) => {
            timer = setTimeout(() => resolve([]), 8000)
          })
        ])
        const result = select(urls, name)
        if (result) return result
      } catch {
        /* An unavailable image source must not block game details. */
      } finally {
        clearTimeout(timer)
      }
    }
    return null
  }
}

/** Read only original portrait images, never Google thumbnails or landscape trailers. */
export function googleCoverCandidates(html: string): string[] {
  if (/unusual traffic|\/sorry\/|g-recaptcha/i.test(html)) return []
  const candidates: string[] = []
  for (const match of html.matchAll(/\["(https?:[^"\r\n]+)",(\d+),(\d+)\]/g)) {
    try {
      const decoded: unknown = JSON.parse(
        `"${match[1].replace(/\\x([a-f\d]{2})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))}"`
      )
      if (typeof decoded !== 'string') continue
      const url = decoded
      // Google metadata stores [url, height, width].
      const height = Number(match[2]),
        width = Number(match[3])
      if (
        width < 300 ||
        height < 450 ||
        width / height < 0.55 ||
        width / height > 0.8
      )
        continue
      if (
        !isPublicCoverUrl(url) ||
        /(?:gstatic|googleusercontent|youtube)\./i.test(new URL(url).hostname)
      )
        continue
      if (!/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url)) continue
      candidates.push(url)
    } catch {
      /* Ignore unrelated or malformed script data. */
    }
  }
  return [...new Set(candidates)].slice(0, 8)
}
