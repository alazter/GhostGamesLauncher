import type { GhostMovie } from 'common/types/plugins'

const GENERIC_FOLDER_NAMES = new Set([
  'filmes',
  'movies',
  'series',
  'séries',
  'animes',
  'anime',
  'desenhos',
  'cartoons',
  'documentarios',
  'documentários',
  'ovas',
  'ova',
  'downloads',
  'videos',
  'vídeos',
  'multimidia',
  'multimídia',
  'alazter multimidia',
  'alazter multimídia',
  'media',
  'cinema'
])

const RELEASE_NOISE_REGEX =
  /\b(2160p|1080p|720p|480p|4k|uhd|hdr|hdr10|dv|dolby|atmos|bluray|blu-ray|bdrip|brrip|remux|web-dl|webdl|webrip|hdtv|dvdrip|x264|x265|h264|h265|hevc|av1|aac|ac3|eac3|dts|ddp5|dual|dublado|legendado|nacional|pt-br|ptbr|multi|complete|completa|extended|unrated|directors cut|director's cut|remastered|anniversary|30th anniversary|qualidade\s*\d+)\b/gi

export function extractImdbId(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const m = raw.match(/\b(tt\d{6,10})\b/i)
  return m ? m[1].toLowerCase() : null
}

export function extractYear(raw?: string | number | null): number | null {
  if (raw === undefined || raw === null) return null
  const m = String(raw).match(/\b(19\d{2}|20\d{2})\b/)
  return m ? Number(m[1]) : null
}

export function normalizeLocalMediaKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  // Strip extension if filename
  s = s.replace(/\.(mkv|mp4|avi|mov|webm|m4v|ts|wmv)$/i, '')
  // Strip bracketed tags like [imdbid-tt123456], [1080p], (1988)
  s = s.replace(/\[[^\]]*\]/g, ' ')
  s = s.replace(/\(\s*(?:19\d{2}|20\d{2})\s*\)/g, ' ')
  // Strip season/episode markers if accidentally present
  s = s.replace(/\bS\d{1,2}\s*E\d{1,3}(?:-E?\d{1,3})?\b/gi, ' ')
  s = s.replace(/\b\d{1,2}x\d{1,3}\b/gi, ' ')
  // Strip release quality/tag noise
  s = s.replace(RELEASE_NOISE_REGEX, ' ')
  // Replace separators & punctuation with spaces
  s = s.replace(/[._\-:/\\|!?,'"`~]+/g, ' ')
  // Strip trailing standalone year
  s = s.replace(/\s+(?:19\d{2}|20\d{2})\s*$/, '')
  return s.replace(/\s+/g, ' ').trim()
}

function stripLeadingArticle(normalized: string): string {
  return normalized.replace(/^(?:the|a|an|o|os|as|um|uma)\s+/i, '').trim()
}

function extractFolderTitleCandidate(filePath?: string, showDirectory?: string): string | null {
  const targetDir = showDirectory || (filePath ? filePath.replace(/[\\/][^\\/]+$/, '') : '')
  if (!targetDir) return null
  const parts = targetDir.split(/[\\/]/).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim()
    if (!part) continue
    // Skip season folders (Season 1, Temporada 02, S01, Specials)
    if (/^(?:season|temporada|temp|s)\s*\d+$/i.test(part) || /^(?:specials|especiais|extras|ovas?)$/i.test(part)) {
      continue
    }
    const norm = normalizeLocalMediaKey(part)
    if (!norm || GENERIC_FOLDER_NAMES.has(norm) || /^[a-z]:?$/i.test(part)) {
      return null
    }
    return part
  }
  return null
}

export interface LocalMediaMatch {
  movies: GhostMovie[]
  episodesCount: number
  isSeries: boolean
  bestResolution?: string
}

export interface LocalMediaIndex {
  byExternalId: Map<string, GhostMovie[]>
  byTitle: Map<string, GhostMovie[]>
  byArticlelessTitle: Map<string, GhostMovie[]>
  allMovies: GhostMovie[]
}

function pushToMap(map: Map<string, GhostMovie[]>, key: string, movie: GhostMovie): void {
  if (!key) return
  const list = map.get(key)
  if (!list) {
    map.set(key, [movie])
  } else if (!list.some((m) => m.id === movie.id)) {
    list.push(movie)
  }
}

export function buildLocalMediaIndex(localMovies: GhostMovie[]): LocalMediaIndex {
  const byExternalId = new Map<string, GhostMovie[]>()
  const byTitle = new Map<string, GhostMovie[]>()
  const byArticlelessTitle = new Map<string, GhostMovie[]>()
  const validMovies = (localMovies || []).filter(
    (m) => m && !m.isLiveStream && Boolean(m.filePath)
  )

  for (const movie of validMovies) {
    // 1. Index by IMDb / Metadata IDs
    const idCandidates = new Set<string>()
    if (movie.imdbId) idCandidates.add(movie.imdbId.trim().toLowerCase())
    if (movie.metadataId) idCandidates.add(movie.metadataId.trim().toLowerCase())
    const fromPath = extractImdbId(movie.filePath)
    if (fromPath) idCandidates.add(fromPath)
    const fromName = extractImdbId(movie.fileName)
    if (fromName) idCandidates.add(fromName)

    for (const extId of idCandidates) {
      pushToMap(byExternalId, extId, movie)
    }

    // 2. Index by Title Variants (including show title, original title, custom title, folder name)
    const rawTitles: Array<string | undefined | null> = [
      movie.customShowTitle,
      movie.showTitle,
      movie.originalTitle,
      movie.customTitle,
      movie.cleanTitle,
      movie.title,
      extractFolderTitleCandidate(movie.filePath, movie.showDirectory)
    ]

    for (const rawTitle of rawTitles) {
      const norm = normalizeLocalMediaKey(rawTitle)
      if (!norm || norm.length < 2) continue
      pushToMap(byTitle, norm, movie)
      const noArticle = stripLeadingArticle(norm)
      if (noArticle && noArticle !== norm && noArticle.length >= 2) {
        pushToMap(byArticlelessTitle, noArticle, movie)
      }
    }
  }

  return {
    byExternalId,
    byTitle,
    byArticlelessTitle,
    allMovies: validMovies
  }
}

function resolveBestResolution(movies: GhostMovie[]): string | undefined {
  const rank = (r?: string): number => {
    const v = (r || '').toLowerCase()
    if (v.includes('4k') || v.includes('2160')) return 4
    if (v.includes('1080')) return 3
    if (v.includes('720')) return 2
    return v ? 1 : 0
  }
  let best: string | undefined
  let bestRank = 0
  for (const m of movies) {
    const r = rank(m.resolution)
    if (r > bestRank) {
      bestRank = r
      best = m.resolution
    }
  }
  return best
}

function filterByYearCompatibility(movies: GhostMovie[], targetYear: number | null): GhostMovie[] {
  if (!targetYear || movies.length === 0) return movies
  const compatible = movies.filter(
    (m) => !m.year || Math.abs(Number(m.year) - targetYear) <= 2
  )
  return compatible.length > 0 ? compatible : movies
}

export function matchStremioItemToLocal(
  index: LocalMediaIndex,
  item: {
    id?: string
    type?: string
    name?: string
    year?: string | number
    releaseInfo?: string
    aliases?: string[]
  }
): LocalMediaMatch | null {
  if (!index || index.allMovies.length === 0) return null

  let matched: GhostMovie[] = []

  // Priority 1: Exact external ID match (tt..., kitsu:..., tmdb:...)
  if (item.id) {
    const cleanId = item.id.trim().toLowerCase()
    const baseId = cleanId.split(':')[0] === 'tt' ? cleanId : cleanId
    const direct = index.byExternalId.get(baseId)
    if (direct && direct.length > 0) {
      matched = direct
    } else {
      const imdb = extractImdbId(item.id)
      if (imdb) {
        const byImdb = index.byExternalId.get(imdb)
        if (byImdb && byImdb.length > 0) matched = byImdb
      }
    }
  }

  // Priority 2: Title & Alias match
  if (matched.length === 0) {
    const targetYear = extractYear(item.year) ?? extractYear(item.releaseInfo)
    const names = [item.name, ...(item.aliases || [])].filter(
      (n): n is string => Boolean(n && n.trim())
    )

    for (const rawName of names) {
      const norm = normalizeLocalMediaKey(rawName)
      if (!norm) continue
      const exactTitle = index.byTitle.get(norm)
      if (exactTitle && exactTitle.length > 0) {
        matched = filterByYearCompatibility(exactTitle, targetYear)
        break
      }
      const noArticle = stripLeadingArticle(norm)
      if (noArticle) {
        const alt = index.byTitle.get(noArticle) || index.byArticlelessTitle.get(noArticle)
        if (alt && alt.length > 0) {
          matched = filterByYearCompatibility(alt, targetYear)
          break
        }
      }
    }
  }

  if (matched.length === 0) return null

  // If searching specifically for a movie vs series, prefer matching kind when mixed
  const t = (item.type || '').toLowerCase()
  const wantsSeries = t === 'series' || t === 'anime' || t === 'tv'
  const wantsMovie = t === 'movie'

  if (wantsSeries) {
    const seriesOnly = matched.filter(
      (m) =>
        m.customIsSeries === true ||
        m.isSeries === true ||
        m.season !== undefined ||
        m.episode !== undefined ||
        ['series', 'anime', 'cartoon'].includes(m.mediaCategory || '')
    )
    if (seriesOnly.length > 0) matched = seriesOnly
  } else if (wantsMovie) {
    const moviesOnly = matched.filter(
      (m) =>
        m.customIsSeries === false ||
        (!m.isSeries && m.season === undefined && m.episode === undefined)
    )
    if (moviesOnly.length > 0) matched = moviesOnly
  }

  const isSeries =
    wantsSeries ||
    matched.some((m) => m.isSeries || m.season !== undefined || m.episode !== undefined)

  return {
    movies: matched,
    episodesCount: matched.length,
    isSeries,
    bestResolution: resolveBestResolution(matched)
  }
}

export function findLocalFilesForEpisode(
  matchedMovies: GhostMovie[],
  season: number,
  episode: number
): GhostMovie[] {
  if (!matchedMovies || matchedMovies.length === 0) return []

  // 1. Exact season + episode match
  const exact = matchedMovies.filter((m) => {
    const mSeason =
      m.customSeason !== undefined && m.customSeason !== null
        ? Number(m.customSeason)
        : m.season !== undefined
          ? Number(m.season)
          : 1
    const mEpisode =
      m.customEpisode !== undefined && m.customEpisode !== null
        ? Number(m.customEpisode)
        : m.episode !== undefined
          ? Number(m.episode)
          : undefined
    return mSeason === season && mEpisode === episode
  })

  if (exact.length > 0) return exact

  // 2. Fallback: parse SxxExx / Exx from fileName if movie metadata lacked season/episode
  const sPad = String(season).padStart(2, '0')
  const ePad = String(episode).padStart(2, '0')
  const seRegex = new RegExp(`(?:S0?${season}[\\s._-]*E0?${episode}\\b|\\b${season}x0?${episode}\\b|S${sPad}E${ePad})`, 'i')
  const byFileName = matchedMovies.filter((m) => seRegex.test(m.fileName || '') || seRegex.test(m.title || ''))
  if (byFileName.length > 0) return byFileName

  // 3. Fallback for single-season anime files numbered simply as " - 05 " or "Ep 05" when season === 1
  if (season === 1 && episode > 0) {
    const epOnlyRegex = new RegExp(`(?:\\b(?:ep|episode|episodio|e)[\\s._-]*0?${episode}\\b|[\\s._-]0?${episode}(?:\\s|\\.|\\[|\\(|$))`, 'i')
    return matchedMovies.filter(
      (m) =>
        m.episode === undefined &&
        m.season === undefined &&
        epOnlyRegex.test(m.fileName || '')
    )
  }

  return []
}
