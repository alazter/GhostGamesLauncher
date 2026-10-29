export interface RecommendedStremioAddon {
  id: string
  aliases?: string[]
  name: string
  version: string
  description: string
  manifestUrl: string
  icon: string
  category: 'official' | 'catalog' | 'subtitles' | 'streams'
  types: string[]
  resources: string[]
  badge?: string
  configureUrl?: string
  guideTips?: string
}

export const RECOMMENDED_STREMIO_ADDONS: RecommendedStremioAddon[] = [
  {
    id: 'com.linvo.cinemeta',
    aliases: ['org.stremio.cinemeta', 'com.linvo.cinemeta'],
    name: 'Cinemeta (Oficial Stremio)',
    version: '3.0.13',
    description:
      'O addon oficial do Stremio para metadados e catálogos globais de filmes e séries (IMDb, Populares, Destaques e Ano).',
    manifestUrl: 'https://v3-cinemeta.strem.io/manifest.json',
    icon: 'https://dl.strem.io/logo-small.png',
    category: 'official',
    types: ['movie', 'series'],
    resources: ['catalog', 'meta'],
    badge: 'Oficial'
  },
  {
    id: 'com.nuvio.player.addon',
    aliases: ['com.nuvio.player.addon', 'com.nuvio.desktop.player'],
    name: 'Nuvio Media Player & Engine (Addon)',
    version: '1.0.0',
    description:
      'Addon oficial Nuvio Desktop integrado ao Alazterflix & Stremio: reprodutor de vídeo Nuvio completo (Pause Metadata Overlay, Opening Overlay, Trilho Triplo de Legendas + Auto-Sync, Hold-to-Speed 2x, Volume Boost 200% e Skip Intro/Recap/Outro).',
    manifestUrl: 'https://nuvio-player.strem.io/manifest.json',
    icon: 'https://dl.strem.io/logo-small.png',
    category: 'official',
    types: ['movie', 'series', 'anime'],
    resources: ['stream', 'subtitles', 'meta'],
    badge: 'Player Nuvio'
  },
  {
    id: 'aiostreams',
    aliases: ['aiostreams', 'com.aiostreams.addon', 'aiostreams.elfhosted.com', 'com.aiostreams'],
    name: 'AIOStreams (v2.36.0 - RemuxDB + Áudio & Legendas)',
    version: '2.36.0',
    description:
      'Super-addon agregador Stremio com integração RemuxDB. Permite filtrar e ordenar streams por idioma de áudio e legendas (PT-BR/PT), Debrid Cached, resolução e qualidade com formatador avançado.',
    manifestUrl: 'https://aiostreams.elfhosted.com/manifest.json',
    configureUrl: 'https://aiostreams.elfhosted.com/configure',
    icon: 'https://aiostreams.elfhosted.com/static/logo.png',
    category: 'streams',
    types: ['movie', 'series', 'anime'],
    resources: ['stream'],
    badge: 'RemuxDB v2.36.0',
    guideTips: 'Filters > Language e Subtitle (adicione PT-BR e PT) | Sorting: Cached > Resolution > Quality > Language > Subtitle'
  },
  {
    id: 'submaker',
    aliases: ['submaker', 'com.submaker.addon', 'stremio-submaker', 'submaker.elfhosted.com'],
    name: 'SubMaker (Legendas IA & Auto-Sync)',
    version: '1.2.0',
    description:
      'Agregador de legendas multi-provedor (OpenSubtitles, SubDL, SubSource, Wyzie) com auto-tradução instantânea por IA (Gemini, OpenAI, Claude, DeepSeek) e sincronização contínua de legendas.',
    manifestUrl: 'https://submaker.elfhosted.com/manifest.json',
    configureUrl: 'https://submaker.elfhosted.com',
    icon: 'https://opensubtitles-v3.strem.io/logo.png',
    category: 'subtitles',
    types: ['movie', 'series', 'anime'],
    resources: ['subtitles'],
    badge: 'Legendas IA',
    guideTips: 'Legendas traduzidas automaticamente com suporte a PT-BR e sincronização automática compatível com Nuvio Reshaped.'
  },
  {
    id: 'org.stremio.opensubtitlesv3',
    aliases: ['org.stremio.opensubtitlesv3', 'com.stremio.opensubtitles'],
    name: 'OpenSubtitles v3 (Oficial)',
    version: '1.0.0',
    description:
      'Legendas oficiais automáticas em Português (PT-BR / PT) e dezenas de idiomas para filmes e episódios de séries.',
    manifestUrl: 'https://opensubtitles-v3.strem.io/manifest.json',
    icon: 'https://opensubtitles-v3.strem.io/logo.png',
    category: 'subtitles',
    types: ['movie', 'series'],
    resources: ['subtitles'],
    badge: 'Legendas'
  },
  {
    id: 'org.stremio.watchhub',
    name: 'WatchHub',
    version: '1.0.0',
    description:
      'Descubra onde assistir filmes e séries em plataformas de streaming oficiais ao redor do mundo.',
    manifestUrl: 'https://watchhub.strem.io/manifest.json',
    icon: 'https://watchhub.strem.io/logo.png',
    category: 'official',
    types: ['movie', 'series'],
    resources: ['stream'],
    badge: 'Oficial'
  },
  {
    id: 'org.stremio.publicdomainmovies',
    name: 'Public Domain Movies',
    version: '1.0.0',
    description:
      'Catálogo e streams diretos de filmes clássicos em domínio público gratuitos para assistir instantaneamente.',
    manifestUrl: 'https://publicdomainmovies.strem.io/manifest.json',
    icon: 'https://dl.strem.io/logo-small.png',
    category: 'streams',
    types: ['movie'],
    resources: ['catalog', 'meta', 'stream'],
    badge: 'Domínio Público'
  },
  {
    id: 'io.stremio.kitsu',
    aliases: ['anime.kitsu.strem.io', 'io.stremio.kitsu'],
    name: 'Anime Kitsu',
    version: '0.0.10',
    description:
      'Catálogo completo de Animes (Populares, Mais Bem Avaliados, Em Lançamento) com sinopses e episódios via Kitsu.',
    manifestUrl: 'https://anime-kitsu.strem.fun/manifest.json',
    icon: 'https://anime-kitsu.strem.fun/Static/kitsu_logo.png',
    category: 'catalog',
    types: ['anime', 'series', 'movie'],
    resources: ['catalog', 'meta'],
    badge: 'Animes'
  },
  {
    id: 'tmdb-addon',
    name: 'The Movie Database Addon (TMDB)',
    version: '3.0.0',
    description:
      'Catálogos e metadados ricos baseados no TMDB (Tendências, Populares, Top Rated e sinopses detalhadas).',
    manifestUrl: 'https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json',
    icon: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
    category: 'catalog',
    types: ['movie', 'series'],
    resources: ['catalog', 'meta'],
    badge: 'Catálogo'
  },
  {
    id: 'cyberflix.catalog',
    name: 'CyberFlix Catalog',
    version: '1.5.0',
    description:
      'Catálogos organizados por serviços de streaming (Netflix, Prime Video, Disney+, Max, Apple TV+, Crunchyroll).',
    manifestUrl: 'https://cyberflix.elfhosted.com/manifest.json',
    icon: 'https://cyberflix.elfhosted.com/static/logo.png',
    category: 'catalog',
    types: ['movie', 'series', 'anime'],
    resources: ['catalog', 'meta'],
    badge: 'Catálogo'
  },
  {
    id: 'com.stremio.torrentio.addon',
    name: 'Torrentio',
    version: '0.0.15',
    description:
      'Provedor comunitário de streams multi-fontes (YTS, EZTV, RARBG, 1337x, ThePirateBay, KickassTorrents, Nyaa).',
    manifestUrl: 'https://torrentio.strem.fun/manifest.json',
    icon: 'https://torrentio.strem.fun/images/logo_v1.png',
    category: 'streams',
    types: ['movie', 'series', 'anime'],
    resources: ['stream'],
    badge: 'Comunidade'
  }
]

/**
 * Normaliza qualquer formato de link de addon do Stremio:
 * - Manifesto tradicional: https://v3-cinemeta.strem.io/manifest.json
 * - Protocolo stremio://: stremio://v3-cinemeta.strem.io/manifest.json
 * - Link Share Addon: https://web.stremio.com/#/addons?addon=https%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json
 * - Link App Stremio: https://app.strem.io/shell-v4.4/#/addons?addon=...
 * - Link /configure: https://.../configure -> https://.../manifest.json
 * - Domínio base: https://v3-cinemeta.strem.io -> https://v3-cinemeta.strem.io/manifest.json
 */
export function normalizeStremioAddonUrl(rawInput: string, depth = 0): string {
  if (!rawInput || typeof rawInput !== 'string') return ''
  if (depth > 4) return rawInput.trim()

  let url = rawInput.trim()
  if (!url) return ''

  // Se o usuário colou um texto com várias palavras contendo um link (stremio:// ou http(s)://), extrair o link
  if (/\s/.test(url)) {
    const match = url.match(/(?:stremio|https?):\/\/[^\s"'<>]+/i)
    if (match && match[0]) {
      url = match[0].replace(/[.,;!?)]+$/, '')
    }
  }

  // Verificar parâmetros de Share Addon (?addon=..., &addon=..., ?manifest=..., ?transportUrl=...)
  // Suporta tanto query string normal quanto dentro de hash (#/addons?addon=...)
  const shareParamMatch = url.match(/[?&#](?:addon|manifest|transportUrl|addonUrl)=([^&#\s]+)/i)
  if (shareParamMatch && shareParamMatch[1]) {
    try {
      const decoded = decodeURIComponent(shareParamMatch[1])
      if (decoded && decoded !== url) {
        return normalizeStremioAddonUrl(decoded, depth + 1)
      }
    } catch {
      // Fallback caso decodeURIComponent falhe
    }
  }

  // Converter protocolo stremio:// para https://
  if (/^stremio:\/\//i.test(url)) {
    url = url.replace(/^stremio:\/\//i, 'https://')
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    // Caso o usuário tenha colado sem protocolo (ex: v3-cinemeta.strem.io/manifest.json)
    url = 'https://' + url.replace(/^\/+/, '')
  }

  try {
    const parsed = new URL(url)

    // Verificar também searchParams ou hash query caso exista
    for (const key of ['addon', 'manifest', 'transportUrl', 'addonUrl']) {
      const paramVal = parsed.searchParams.get(key)
      if (paramVal && paramVal !== url) {
        return normalizeStremioAddonUrl(paramVal, depth + 1)
      }
    }

    if (parsed.hash && parsed.hash.includes('?')) {
      const hashQuery = parsed.hash.slice(parsed.hash.indexOf('?'))
      const hashParams = new URLSearchParams(hashQuery)
      for (const key of ['addon', 'manifest', 'transportUrl', 'addonUrl']) {
        const paramVal = hashParams.get(key)
        if (paramVal && paramVal !== url) {
          return normalizeStremioAddonUrl(paramVal, depth + 1)
        }
      }
    }

    // Limpar hash residual
    parsed.hash = ''

    // Normalizar pathname:
    // - Se terminar em /configure ou /configure.html, trocar por /manifest.json
    // - Se terminar em /manifest.json, manter
    // - Caso contrário, adicionar /manifest.json
    let pathname = parsed.pathname.replace(/\/+$/, '')
    if (/\/configure(\.html)?$/i.test(pathname)) {
      pathname = pathname.replace(/\/configure(\.html)?$/i, '/manifest.json')
    } else if (!/\/manifest\.json$/i.test(pathname)) {
      pathname = (pathname ? pathname : '') + '/manifest.json'
    }
    parsed.pathname = pathname

    return parsed.toString()
  } catch {
    // Fallback por manipulação de string caso URL falhe
    let clean = url.split('#')[0]
    let query = ''
    const qIdx = clean.indexOf('?')
    if (qIdx !== -1) {
      query = clean.slice(qIdx)
      clean = clean.slice(0, qIdx)
    }
    clean = clean.replace(/\/+$/, '')
    if (/\/configure(\.html)?$/i.test(clean)) {
      clean = clean.replace(/\/configure(\.html)?$/i, '/manifest.json')
    } else if (!/\/manifest\.json$/i.test(clean)) {
      clean = clean + '/manifest.json'
    }
    return clean + query
  }
}

export function generateStremioShareLinks(manifestUrl: string): {
  manifestUrl: string
  stremioProtocolUrl: string
  webShareUrl: string
} {
  const normalized = normalizeStremioAddonUrl(manifestUrl)
  const stremioProtocolUrl = normalized.replace(/^https?:\/\//i, 'stremio://')
  const webShareUrl = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(normalized)}`
  return {
    manifestUrl: normalized,
    stremioProtocolUrl,
    webShareUrl
  }
}

export function isSameStremioAddon(
  addonA: { id?: string; url?: string },
  addonB: { id?: string; url?: string; aliases?: string[]; manifestUrl?: string }
): boolean {
  const normUrlA = addonA.url ? normalizeStremioAddonUrl(addonA.url).toLowerCase() : ''
  const rawUrlB = addonB.url || addonB.manifestUrl || ''
  const normUrlB = rawUrlB ? normalizeStremioAddonUrl(rawUrlB).toLowerCase() : ''

  if (normUrlA && normUrlB && normUrlA === normUrlB) {
    return true
  }

  const cinemetaIds = new Set(['org.stremio.cinemeta', 'com.linvo.cinemeta'])
  if (addonA.id && addonB.id && cinemetaIds.has(addonA.id) && cinemetaIds.has(addonB.id)) {
    return true
  }

  if (addonA.id && addonB.id && addonA.id === addonB.id) {
    return true
  }

  if (addonA.id && Array.isArray(addonB.aliases) && addonB.aliases.includes(addonA.id)) {
    return true
  }

  return false
}

export interface ParsedStremioStream {
  addonName: string
  provider: string
  quality: string
  title: string
  rawDetails: string
  size?: string
  seeds?: number
  tracker?: string
  flags: string[]
  languagesLine?: string
  isOfficial?: boolean
}

export const REGIONAL_FLAG_REGEX = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/g

const SPECIAL_LANG_TO_FLAG: Record<string, string> = {
  EN: '🇬🇧',
  ENG: '🇬🇧',
  UK: '🇬🇧',
  GB: '🇬🇧',
  US: '🇺🇸',
  USA: '🇺🇸',
  PT: '🇵🇹',
  POR: '🇵🇹',
  BR: '🇧🇷',
  BRA: '🇧🇷',
  ES: '🇪🇸',
  ESP: '🇪🇸',
  SPA: '🇪🇸',
  MX: '🇲🇽',
  MEX: '🇲🇽',
  LAT: '🇲🇽',
  FR: '🇫🇷',
  FRA: '🇫🇷',
  FRE: '🇫🇷',
  DE: '🇩🇪',
  DEU: '🇩🇪',
  GER: '🇩🇪',
  IT: '🇮🇹',
  ITA: '🇮🇹',
  RU: '🇷🇺',
  RUS: '🇷🇺',
  JP: '🇯🇵',
  JPN: '🇯🇵',
  JA: '🇯🇵',
  KR: '🇰🇷',
  KOR: '🇰🇷',
  KO: '🇰🇷',
  CN: '🇨🇳',
  CHN: '🇨🇳',
  ZH: '🇨🇳',
  IN: '🇮🇳',
  IND: '🇮🇳',
  HI: '🇮🇳',
  TR: '🇹🇷',
  TUR: '🇹🇷',
  NL: '🇳🇱',
  NLD: '🇳🇱',
  DUT: '🇳🇱',
  PL: '🇵🇱',
  POL: '🇵🇱',
  SE: '🇸🇪',
  SWE: '🇸🇪',
  SV: '🇸🇪',
  NO: '🇳🇴',
  NOR: '🇳🇴',
  DK: '🇩🇰',
  DNK: '🇩🇰',
  DA: '🇩🇰',
  FI: '🇫🇮',
  FIN: '🇫🇮',
  GR: '🇬🇷',
  GRE: '🇬🇷',
  EL: '🇬🇷',
  CZ: '🇨🇿',
  CZE: '🇨🇿',
  CS: '🇨🇿',
  RO: '🇷🇴',
  ROU: '🇷🇴',
  HU: '🇭🇺',
  HUN: '🇭🇺',
  UA: '🇺🇦',
  UKR: '🇺🇦',
  AR: '🇦🇷',
  ARG: '🇦🇷',
  CL: '🇨🇱',
  CO: '🇨🇴',
  PE: '🇵🇪',
  AU: '🇦🇺',
  CA: '🇨🇦',
  TH: '🇹🇭',
  THA: '🇹🇭',
  VN: '🇻🇳',
  VIE: '🇻🇳',
  VI: '🇻🇳',
  ID: '🇮🇩',
  IL: '🇮🇱',
  ISR: '🇮🇱',
  HE: '🇮🇱',
  SA: '🇸🇦',
  ARA: '🇸🇦'
}

const VIDEO_CODE_EXCLUSIONS = new Set([
  'HD', 'SD', 'BD', 'DL', 'TS', 'TV', 'DD', 'AC', 'HQ', 'LQ', 'WE', 'RI', 'AV', 'DV', 'RE', 'MB', 'GB', 'KB', 'TB'
])

export function countryCodeToFlag(code: string): string | null {
  if (!code || typeof code !== 'string') return null
  const upper = code.toUpperCase().trim()

  // Prioridade 1: Sigla de idioma ou exceções mapeadas
  if (SPECIAL_LANG_TO_FLAG[upper]) {
    // Evitar colisão entre 'GB' (Gigabyte vs Great Britain):
    // Se o código for 'GB' precedido por número (tamanho do arquivo), não é bandeira
    return SPECIAL_LANG_TO_FLAG[upper]
  }

  // Se for código ISO 2 letras válido (A-Z)
  if (/^[A-Z]{2}$/.test(upper)) {
    if (VIDEO_CODE_EXCLUSIONS.has(upper)) return null
    return String.fromCodePoint(
      0x1f1e6 + upper.charCodeAt(0) - 65,
      0x1f1e6 + upper.charCodeAt(1) - 65
    )
  }
  return null
}

export function formatStreamLanguagesWithFlags(line: string): {
  formattedLine: string
  extractedFlags: string[]
} {
  if (!line || typeof line !== 'string') {
    return { formattedLine: '', extractedFlags: [] }
  }

  const extractedFlags: string[] = []

  // 1. Extrair bandeiras Unicode já existentes
  const existingFlags = line.match(REGIONAL_FLAG_REGEX)
  if (existingFlags) {
    for (const f of existingFlags) {
      if (!extractedFlags.includes(f)) extractedFlags.push(f)
    }
  }

  // 2. Substituir códigos de país ou siglas como GB / RU / PT / ES / MX / FR / DE / PT-BR
  const formattedLine = line.replace(
    /\b([A-Za-z]{2,3}(?:-[A-Za-z]{2})?)\b/g,
    (match, p1, offset, fullStr) => {
      // Ignorar se 'GB', 'MB', 'KB' for sufixo de tamanho de arquivo (ex: '2.5 GB' ou '700 MB')
      if (/^(?:GB|MB|KB|TB)$/i.test(match)) {
        const preceding = fullStr.slice(Math.max(0, offset - 8), offset)
        if (/\d+\s*$/.test(preceding)) {
          return match
        }
      }

      // Se for algo composto como pt-br ou PT-BR
      const parts = match.split('-')
      if (parts.length === 2) {
        const subCode = parts[1].toUpperCase()
        const flag = countryCodeToFlag(subCode)
        if (flag) {
          if (!extractedFlags.includes(flag)) extractedFlags.push(flag)
          return flag
        }
      }

      const flag = countryCodeToFlag(match)
      if (flag) {
        if (!extractedFlags.includes(flag)) extractedFlags.push(flag)
        return flag
      }

      return match
    }
  )

  return { formattedLine, extractedFlags }
}

export function parseStremioStreamDetails(stream: any): ParsedStremioStream {
  const rawName = String(stream?.name || stream?.addonName || 'Stremio').trim()
  const rawDetails = String(stream?.details || stream?.title || stream?.description || '').trim()

  // Provider & Quality
  let quality = stream?.quality || 'HD'
  const combinedText = `${rawName} ${rawDetails}`
  if (/4k|2160p|uhd/i.test(combinedText)) quality = '4K'
  else if (/1080p|fhd/i.test(combinedText)) quality = '1080p'
  else if (/720p/i.test(combinedText)) quality = '720p'
  else if (/480p|sd/i.test(combinedText)) quality = '480p'

  const lines = rawDetails.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let title = lines[0] || rawName

  // Provider label (e.g. "Torrentio 1080p", "Netflix", "Crunchyroll")
  let provider = rawName.replace(/\n+/g, ' ').trim()
  if (!provider.toLowerCase().includes(quality.toLowerCase()) && quality !== 'HD') {
    provider = `${provider} ${quality}`
  }

  const isOfficial = /netflix|amazon|crunchyroll|disney|apple|hbo|paramount/i.test(rawName) ||
    /subscription|alugar|comprar/i.test(rawDetails)

  // Size
  let size: string | undefined
  const sizeMatch = rawDetails.match(/(?:💾|\b)(\d+(?:\.\d+)?\s*(?:GB|MB|GiB|MiB|KB|B))\b/i)
  if (sizeMatch) {
    size = sizeMatch[1].trim()
  } else if (stream?.behaviorHints?.videoSize) {
    const bytes = Number(stream.behaviorHints.videoSize)
    if (!isNaN(bytes) && bytes > 0) {
      size = bytes > 1024 * 1024 * 1024
        ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
  }

  // Seeds
  let seeds: number | undefined
  const seedMatch = rawDetails.match(/(?:👤|\bseeds?:|\bpeers?:)\s*(\d+)/i)
  if (seedMatch) {
    seeds = parseInt(seedMatch[1], 10)
  }

  // Tracker / Source
  let tracker: string | undefined
  const trackerMatch = rawDetails.match(/⚙\s*([^\r\n/|]+)/)
  if (trackerMatch) {
    tracker = trackerMatch[1].trim()
  }

  // Flag extraction (Unicode flags + Text replacement)
  const flags: string[] = []
  const flagMatches = rawDetails.match(REGIONAL_FLAG_REGEX)
  if (flagMatches) {
    for (const f of flagMatches) {
      if (!flags.includes(f)) flags.push(f)
    }
  }

  // Text-based fallback language flag detection if no emoji flag
  const lowerDetails = rawDetails.toLowerCase()
  if (/pt-br|dublado|portugu[eê]s|brazil|brasil/.test(lowerDetails) && !flags.includes('🇧🇷')) {
    flags.push('🇧🇷')
  }
  if (/pt-pt|portugal/.test(lowerDetails) && !flags.includes('🇵🇹')) {
    flags.push('🇵🇹')
  }
  if (/\b(?:eng|english|ingl[eê]s)\b/.test(lowerDetails) && !flags.includes('🇬🇧')) {
    flags.push('🇬🇧')
  }
  if (/\b(?:jap|japanese|japon[eê]s)\b/.test(lowerDetails) && !flags.includes('🇯🇵')) {
    flags.push('🇯🇵')
  }
  if (/\b(?:spa|spanish|espanhol|latino)\b/.test(lowerDetails) && !flags.includes('🇪🇸')) {
    flags.push('🇪🇸')
  }
  if (/\b(?:fre|french|franc[eê]s)\b/.test(lowerDetails) && !flags.includes('🇫🇷')) {
    flags.push('🇫🇷')
  }
  if (/\b(?:ger|german|alem[aã]o)\b/.test(lowerDetails) && !flags.includes('🇩🇪')) {
    flags.push('🇩🇪')
  }
  if (/\b(?:ita|italian|italiano)\b/.test(lowerDetails) && !flags.includes('🇮🇹')) {
    flags.push('🇮🇹')
  }

  // Languages / Subs formatted line with flag replacement
  let languagesLine: string | undefined
  // Look for line with flags first, or subsequent line with Multi Subs / Dubbed / Audio
  const candidateWithFlags = lines.find((l) => REGIONAL_FLAG_REGEX.test(l))
  const candidateOther = lines.slice(1).find((l) =>
    /multi\s*subs?|dual\s*audio|dubbed|dublado|legendado|audio/i.test(l)
  )
  const langLineCandidate = candidateWithFlags || candidateOther

  if (langLineCandidate) {
    const { formattedLine, extractedFlags } = formatStreamLanguagesWithFlags(langLineCandidate)
    languagesLine = formattedLine.trim()
    for (const f of extractedFlags) {
      if (!flags.includes(f)) flags.push(f)
    }
  } else if (flags.length > 0) {
    const isMulti = flags.length > 1 || /multi/i.test(lowerDetails)
    const isDub = /dublado|dubbed|dual/i.test(lowerDetails)
    const prefix = isDub ? (isMulti ? 'Dual Audio' : 'Dublado') : (isMulti ? 'Multi Subs' : 'Legendas')
    languagesLine = `${prefix} / ${flags.join(' / ')}`
  }

  // Se nenhuma linha foi capturada mas existem siglas no corpo de rawDetails, buscar flags adicionais
  if (flags.length === 0) {
    const { extractedFlags } = formatStreamLanguagesWithFlags(rawDetails)
    for (const f of extractedFlags) {
      if (!flags.includes(f)) flags.push(f)
    }
  }

  return {
    addonName: stream?.addonName || rawName,
    provider,
    quality,
    title,
    rawDetails,
    size,
    seeds,
    tracker,
    flags,
    languagesLine,
    isOfficial
  }
}

/**
 * Ordena streams Stremio aplicando a hierarquia recomendada pelo ecossistema AIOStreams / RemuxDB:
 * 1. Cached (Debrid / Real-Debrid / TorBox / AllDebrid / ⚡ / [RD+] / [TB+])
 * 2. Idioma PT-BR / Áudio Dublado ou Dual Áudio (se prioritizePtBr for true)
 * 3. Resolução (4K / 2160p > 1080p > 720p > 480p)
 * 4. Qualidade / Fonte (Remux > BluRay > WEB-DL > HDTV > CAM/TS)
 * 5. Legendas PT-BR nativas / embutidas
 * 6. Número de Seeders (para torrents P2P)
 */
export function sortStremioStreamsByRemuxPreference<T = any>(
  streams: T[],
  prioritizePtBr = true
): T[] {
  if (!Array.isArray(streams) || streams.length <= 1) return streams || []

  const computeScore = (stream: any): number => {
    if (!stream) return 0
    let score = 0
    const rawName = stream.name || ''
    const rawTitle = stream.title || ''
    const rawDesc = stream.description || ''
    const combined = `${rawName} ${rawTitle} ${rawDesc}`.toLowerCase()

    // 1. Cached / Debrid status (+1.000.000 pts)
    const isCached =
      stream.behaviorHints?.cached === true ||
      /(?:\[(?:rd\+|tb\+|ad\+|pm\+|ed\+)\]|⚡|\b(?:cached|debrid|realdebrid|torbox|alldebrid|premiumize)\b)/i.test(
        combined
      )
    if (isCached) {
      score += 1_000_000
    }

    // 2. Detecção de Áudio e Idioma
    const hasPtAudio =
      /(?:🇧🇷|pt-br|brazilian|dublado|dual[\s-]?[aá]udio|audio[\s:]*pt|portugu[eê]s)/i.test(
        combined
      )
    const hasPtPtAudio = /(?:🇵🇹|pt-pt)/i.test(combined)
    const hasPtSubs =
      /(?:multi[\s-]?subs?|legendas?[\s:]*pt|legendado|pt-br[\s-]?subs?|subtitles?[\s:]*pt)/i.test(
        combined
      )

    if (prioritizePtBr) {
      if (hasPtAudio) score += 300_000
      else if (hasPtPtAudio) score += 150_000

      if (hasPtSubs) score += 100_000
    } else {
      if (hasPtAudio) score += 10_000
      else if (hasPtPtAudio) score += 5_000
      if (hasPtSubs) score += 3_000
    }

    // 3. Resolução
    if (/4k|2160p|uhd/i.test(combined)) {
      score += 40_000
    } else if (/1080p|fhd/i.test(combined)) {
      score += 30_000
    } else if (/720p|hd/i.test(combined)) {
      score += 20_000
    } else if (/480p|sd/i.test(combined)) {
      score += 10_000
    }

    // 4. Qualidade / Encoding (RemuxDB style)
    if (/remux|bd[\s-]?remux/i.test(combined)) {
      score += 8_000
    } else if (/bluray|bdrip|brrip/i.test(combined)) {
      score += 6_000
    } else if (/web[\s-]?dl|webrip/i.test(combined)) {
      score += 4_000
    } else if (/hdtv/i.test(combined)) {
      score += 2_000
    } else if (/cam|ts|telesync|hdcam|screener/i.test(combined)) {
      score -= 50_000
    }

    // HDR / Dolby Vision bonus
    if (/hdr10\+|dolby[\s-]?vision|\bdv\b|hdr/i.test(combined)) {
      score += 1_500
    }

    // 5. Seeds count (se houver)
    const seedMatch = combined.match(/(?:👤|\bseeds?:|\bpeers?:)\s*(\d+)/i)
    if (seedMatch) {
      const s = parseInt(seedMatch[1], 10)
      if (!isNaN(s)) {
        score += Math.min(s, 500)
      }
    }

    return score
  }

  return [...streams].sort((a, b) => computeScore(b) - computeScore(a))
}
