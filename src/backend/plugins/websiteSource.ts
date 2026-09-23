import sanitizeHtml from 'sanitize-html'
import type {
  GhostDownloadSource,
  GhostSearchResult,
  PluginManifest,
  WebsiteSourceConfig
} from 'common/types/plugins'
import type { SourceProvider } from './pluginHost'
import { NetworkGuard } from './networkGuard'

function plain(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanGameTitle(raw: string): string {
  return raw
    .replace(/\b(?:free download|download game free|baixar grátis)\b/gi, '')
    .replace(/\s+по\s+сети(?:\b|[^\p{L}\p{N}]|$)/gui, '')
    .replace(/\s+скачать\s+торрент(?:\b|[^\p{L}\p{N}]|$)/gui, '')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractVersionFromText(text: string): string | undefined {
  if (!text) return undefined
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  // 1. Versão explícita com build: "v1.2.3 | Build 24832302", "v 1.3.0 | Build 123"
  const vBuild = clean.match(/\bv?\s*(\d+(?:\.\d+)+[a-z]?)\s*\|\s*Build\s*(\d+)\b/i)
  if (vBuild) {
    return `v${vBuild[1]} (Build ${vBuild[2]})`
  }

  // 2. Palavra-chave multilíngue seguida de versão (EN, PT, RU): "до версии 1.3.0", "Версия игры: 1.3.0", "Version: v1.2.3"
  const keywordMatch = clean.match(/(?:^|[^\p{L}\p{N}])(?:version|versão|версия|версии|версию|ver\.?)\s*(?:игры)?\s*[:：\s_-]*\s*(?:v\s*)?(\d+(?:\.\d+)+[a-z]?)/iu)
  if (keywordMatch) {
    return `v${keywordMatch[1]}`
  }

  // 3. Switch update ID padrão: v131072, [v65536]
  const switchMatch = clean.match(/\[\s*v?(\d{5,})\s*\]|\bv(\d{5,})\b/)
  if (switchMatch) {
    return `v${switchMatch[1] || switchMatch[2]}`
  }

  // 4. Build explícito: Build 14321, Build.13682455, [Build 12345]
  const buildMatch = clean.match(/\bBuild[.:\s_-]+(\d+)\b/i)
  if (buildMatch) {
    return `Build ${buildMatch[1]}`
  }

  // 5. Padrão Update: Update v1.0.3, Update 4
  const updateMatch = clean.match(/\bUpdate\s*[:\s_-]?\s*(?:v\s*)?(\d+(?:\.\d+)*[a-z]?)\b/i)
  if (updateMatch) {
    return `Update ${updateMatch[1]}`
  }

  // 6. SemVer / Dot version em parênteses ou colchetes: (v1.12.3), [v 1.0.4], (1.0.5)
  const bracketVerMatch = clean.match(/[\(\[]\s*v?\s*(\d+(?:\.\d+)+[a-z]?)\s*[\)\]]/i)
  if (bracketVerMatch) {
    return `v${bracketVerMatch[1]}`
  }

  // 7. Prefixo 'v' ou 'V' solto com número: v1.0.4, V 1.3.0, v4.1.1.3764840
  const vMatch = clean.match(/\b[vV]\s*(\d+(?:\.\d+)+[a-z]?)\b/)
  if (vMatch) {
    return `v${vMatch[1]}`
  }

  return undefined
}

export function normalizeAcronyms(str: string): string {
  return str
    .replace(/([a-zA-Z0-9])\.(?=[a-zA-Z0-9])/g, '$1')
    .replace(/\.([a-zA-Z0-9])/g, '$1')
    .replace(/([a-zA-Z0-9])\.(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export const KNOWN_GAME_ACRONYMS: Record<string, string> = {
  stalker: 's.t.a.l.k.e.r.',
  fear: 'f.e.a.r.',
  hawx: 'h.a.w.x.',
  tmnt: 't.m.n.t.',
  cod: 'call of duty',
  gta: 'grand theft auto',
  rdr: 'red dead redemption',
  nfs: 'need for speed',
  kof: 'the king of fighters',
  re: 'resident evil'
}

export const REVERSE_GAME_ACRONYMS: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_GAME_ACRONYMS).map(([k, v]) => [v, k])
)

export function generateSearchQueryVariants(query: string): string[] {
  const variants = new Set<string>()
  const trimmed = query.trim()
  if (!trimmed) return []

  variants.add(trimmed)

  // 1. Dotted to undotted (ex: s.t.a.l.k.e.r. 2 -> stalker 2)
  const undotted = normalizeAcronyms(trimmed)
  if (undotted && undotted.toLowerCase() !== trimmed.toLowerCase()) {
    variants.add(undotted)
  }

  // 2. Known acronyms expansion (ex: stalker 2 -> s.t.a.l.k.e.r. 2)
  for (const [shortForm, longForm] of Object.entries(KNOWN_GAME_ACRONYMS)) {
    const wordRegex = new RegExp(`\\b${shortForm}\\b`, 'gi')
    if (wordRegex.test(trimmed)) {
      variants.add(trimmed.replace(wordRegex, longForm))
      variants.add(trimmed.replace(wordRegex, longForm.replace(/\.$/, '')))
    }
  }

  // 3. Reverse known acronyms
  for (const [longForm, shortForm] of Object.entries(REVERSE_GAME_ACRONYMS)) {
    const escaped = longForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    if (regex.test(trimmed)) {
      variants.add(trimmed.replace(regex, shortForm))
    }
  }

  // 4. Roman numerals <-> numbers for sequels (ex: stalker ii <-> stalker 2)
  const romanToArab: Record<string, string> = { ' i': ' 1', ' ii': ' 2', ' iii': ' 3', ' iv': ' 4', ' v': ' 5', ' vi': ' 6', ' vii': ' 7', ' viii': ' 8' }
  const arabToRoman: Record<string, string> = { ' 1': ' i', ' 2': ' ii', ' 3': ' iii', ' 4': ' iv', ' 5': ' v', ' 6': ' vi', ' 7': ' vii', ' 8': ' viii' }

  for (const v of Array.from(variants)) {
    for (const [r, a] of Object.entries(romanToArab)) {
      const rx = new RegExp(`${r}\\b`, 'gi')
      if (rx.test(v)) variants.add(v.replace(rx, a))
    }
    for (const [a, r] of Object.entries(arabToRoman)) {
      const rx = new RegExp(`${a}\\b`, 'gi')
      if (rx.test(v)) variants.add(v.replace(rx, r))
    }
  }

  return Array.from(variants)
}

export function matchesQuery(title: string, query: string): boolean {
  if (!query || !query.trim()) return true
  if (!title || !title.trim()) return false

  const normT = normalizeAcronyms(title)
  const normQ = normalizeAcronyms(query)

  const cleanT = normT.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  const cleanQ = normQ.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

  if (!cleanT || cleanT.length < 2) return false
  if (!cleanQ) return true

  // Match direto
  if (cleanT.includes(cleanQ)) return true
  if (cleanQ.includes(cleanT) && cleanT.length >= 3 && cleanT.length >= cleanQ.length * 0.75) return true

  // Match sem espaços
  const noSpaceT = cleanT.replace(/\s+/g, '')
  const noSpaceQ = cleanQ.replace(/\s+/g, '')
  if (noSpaceT.includes(noSpaceQ)) return true
  if (noSpaceQ.includes(noSpaceT) && noSpaceT.length >= 3 && noSpaceT.length >= noSpaceQ.length * 0.75) return true

  // Match palavra por palavra
  const qWords = cleanQ.split(/\s+/).filter((w) => w.length > 1)
  if (qWords.length === 0) return true
  const matchedWords = qWords.filter((w) => cleanT.includes(w) || noSpaceT.includes(w))
  if (matchedWords.length === qWords.length || (qWords.length >= 2 && matchedWords.length / qWords.length >= 0.6)) return true

  // Acrônimos (ex: GTA -> Grand Theft Auto, RDR -> Red Dead Redemption)
  if (cleanQ.length >= 2 && cleanQ.length <= 5) {
    const titleAcronym = title
      .split(/[\s:-]+/)
      .map((w) => w[0]?.toLowerCase())
      .filter(Boolean)
      .join('')
    if (titleAcronym === noSpaceQ || titleAcronym.includes(noSpaceQ)) return true
  }

  return false
}

export interface ExtractedGameMetadata {
  releaseDate?: string
  uploadDate?: string
  cracker?: string
  uploader?: string
  size?: string
  installedSize?: string
  mode?: string
  genre?: string
  developer?: string
  publisher?: string
  deckCompatibility?: string
  controllerSupport?: string
  rating?: string
  recommendPercent?: string
  description?: string
}

export function extractGameMetadataFromHtml(
  html: string,
  providerId = '',
  surrounding = ''
): ExtractedGameMetadata {
  const content = `${html || ''} ${surrounding || ''}`
  // Remove seções de jogos relacionados, comentários e rodapé para não vazar dados de outros jogos
  const cleanContent = content
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<div\b[^>]*id=["'](?:comments|respond)["'][\s\S]*$/i, '')
    .replace(/<div\b[^>]*class=["'][^"']*(?:yarpp-related|related-posts|similar-games)[^"']*[\s\S]*$/i, '')

  let releaseDate: string | undefined = undefined
  let uploadDate: string | undefined = undefined
  let cracker: string | undefined = undefined
  let uploader: string | undefined = undefined
  let size: string | undefined = undefined
  let installedSize: string | undefined = undefined
  let mode: string | undefined = undefined
  let genre: string | undefined = undefined
  let developer: string | undefined = undefined
  let publisher: string | undefined = undefined
  let deckCompatibility: string | undefined = undefined
  let controllerSupport: string | undefined = undefined
  let rating: string | undefined = undefined
  let recommendPercent: string | undefined = undefined
  let description: string | undefined = undefined

  // 1. Cracker / Release Group (suporta "Release Group / OFME", "Released by: RUNE", etc.)
  const strongCrackMatch =
    cleanContent.match(/<li>\s*<strong>(?:Released By|Release Group|Crack(?:ed)? By)[:\s]*<\/strong>\s*([^<\n]+)<\/li>/i)?.[1] ||
    cleanContent.match(/(?:Released By|Release Group|Crack(?:ed)? By)[:\s]*<\/strong>\s*([^<\n]+)/i)?.[1]

  const crackMatch =
    strongCrackMatch ||
    cleanContent.match(/(?:release group|released by|crack(?:ed)? by|cracker|scene group|group)[:\s/]*<[^>]*>([^<]+)<\/[^>]*>/i)?.[1] ||
    cleanContent.match(/title=["']Release Group:\s*([^"']+)["']/i)?.[1] ||
    cleanContent.match(/(?:release group|released by|crack(?:ed)? by|cracker|scene group)[:\s/]+([a-zA-Z0-9_\- .]+?)(?:<|\n|$)/i)?.[1] ||
    cleanContent.match(/\b(OFME|RUNE|TENOKE|GOLDBERG|SKIDROW|FLT|CODEX|Razor1911|Clean Steam Files|Own CSF|ElAmigos|FitGirl|DODI)\b/i)?.[1]

  if (crackMatch) {
    cracker = crackMatch.replace(/<[^>]+>/g, '').trim()
  } else if (/online-?fix/i.test(providerId)) {
    cracker = 'Online-Fix'
  }

  // 2. Uploader
  const uploaderMatch =
    cleanContent.match(/Updated by\s+([a-zA-Z0-9_-]+)/i) ||
    cleanContent.match(/Uploaded by\s+([a-zA-Z0-9_-]+)/i) ||
    cleanContent.match(/Updated Version\s+([a-zA-Z0-9_-]+)/i) ||
    cleanContent.match(/class=["']author-name[^"']*["'][^>]*>([^<]+)<\/a>/i) ||
    cleanContent.match(/rel=["']author["'][^>]*>([^<]+)<\/a>/i)

  if (uploaderMatch) {
    uploader = uploaderMatch[1].trim()
  } else if (/steamrip/i.test(providerId)) {
    uploader = 'SteamRIP'
  } else if (/online-?fix/i.test(providerId)) {
    uploader = 'Online-Fix'
  }

  // 3. Official Release Date (Lançamento Oficial do Jogo)
  const relDateMatch =
    cleanContent.match(/(?:Released|Release Date|Data de Lançamento)[:\s/]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    cleanContent.match(/(?:Released|Release Date|Data de Lançamento)[:\s/]+(\d{1,2}\s+[a-zA-Z]+,?\s+\d{4}|[a-zA-Z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i)

  if (relDateMatch) {
    releaseDate = relDateMatch[1].replace(/<[^>]+>/g, '').trim()
  }

  // 4. Date (Data de publicação ou update na loja/site)
  const dateMatch =
    cleanContent.match(/(?:Updated by|Last Updated)[^(]*\(([^)]+)\)/i) ||
    cleanContent.match(/Last Updated\s*-\s*[^(]*\(([^)]+)\)/i) ||
    cleanContent.match(/<[^>]*class=["'][^"']*date[^"']*["'][^>]*>[\s\S]*?([a-zA-Z]+ \d{1,2},? \d{4})<\/[^>]*>/i) ||
    cleanContent.match(/<[^>]*class=["'][^"']*svchk__date[^"']*["'][^>]*>([^<,]+)/i) ||
    cleanContent.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i) ||
    cleanContent.match(/<time\b[^>]*>([^<]+)<\/time>/i) ||
    cleanContent.match(/(?:posted on|published on|updated on|data|date)[:\s]*([a-zA-Z]+ \d{1,2},? \d{4}|\d{1,2} [a-zA-Z]+ \d{4}|\d{1,2}[-./]\d{1,2}[-./]\d{4})/i)

  if (dateMatch) {
    uploadDate = dateMatch[1].replace(/at\s+\d+:\d+.*$/i, '').trim()
  }

  // 5. Size (Tamanho do Download)
  const jsonLdFileSize = content.match(/"fileSize"\s*:\s*"([^"]+)"/i)?.[1]
  const headerBadgeSize = cleanContent.match(/<span>(?:PC|Windows)<\/span>\s*<span>([\d.]+\s*(?:GB|MB|TB))<\/span>/i)?.[1]
  const strongSizeMatch =
    cleanContent.match(/<li>\s*<strong>(?:Game Size|File Size)[:\s]*<\/strong>\s*([\d.]+\s*(?:GB|MB|TB))\s*<\/li>/i)?.[1] ||
    cleanContent.match(/<strong>\s*(?:Game Size|File Size|Size)[:\s]*<\/strong>\s*([\d.]+\s*(?:GB|MB|TB))/i)?.[1] ||
    cleanContent.match(/(?:Game Size|File Size)[:\s]*<\/strong>\s*([\d.]+\s*(?:GB|MB|TB))/i)?.[1]
  const explicitSizeMatch =
    cleanContent.match(/(?:game size|download size|tamanho do download)[:\s]*<[^>]*>([^<]+)<\/[^>]*>/i)?.[1] ||
    cleanContent.match(/(?:game size|download size|tamanho do download)[:\s]*([\d.]+\s*(?:GB|MB|TB|ГБ|МБ))/i)?.[1] ||
    cleanContent.match(/<span class=["']game-meta-line["']>[^<]*?([\d.]+\s*(?:GB|MB|TB))<\/span>/i)?.[1] ||
    cleanContent.match(/<span class=["']truncate["']>([\d.]+\s*(?:GB|MB|TB))<\/span>/i)?.[1]

  if (jsonLdFileSize) {
    size = jsonLdFileSize.trim()
  } else if (headerBadgeSize) {
    size = headerBadgeSize.trim()
  } else if (strongSizeMatch) {
    size = strongSizeMatch.trim()
  } else if (explicitSizeMatch) {
    size = explicitSizeMatch.replace(/<[^>]+>/g, '').trim()
  }

  // 5.1 Installed Size / Storage (Tamanho Instalado / Espaço em Disco Necessário)
  const jsonLdStorage = content.match(/"storageRequirements"\s*:\s*"([^"]+)"/i)?.[1]?.match(/([\d.]+\s*(?:GB|MB|TB|ГБ|МБ))/i)?.[1]
  const strongStorageMatch =
    cleanContent.match(/<li>\s*<strong>(?:Storage|Armazenamento|Espaço em disco)[:\s]*<\/strong>\s*([^<\n]+)<\/li>/i)?.[1]?.match(/([\d.]+\s*(?:GB|MB|TB|ГБ|МБ))/i)?.[1] ||
    cleanContent.match(/<strong>\s*(?:Storage|Armazenamento|Espaço em disco)[:\s]*<\/strong>\s*([^<\n]+)/i)?.[1]?.match(/([\d.]+\s*(?:GB|MB|TB|ГБ|МБ))/i)?.[1]
  const storageMatch =
    cleanContent.match(/(?:storage|armazenamento|espaço em disco|available space|disk space|hard drive|hd space)[:\s]*<[^>]*>([^<]+)<\/[^>]*>/i)?.[1]?.match(/([\d.]+\s*(?:GB|MB|TB|ГБ|МБ))/i)?.[1] ||
    cleanContent.match(/(?:storage|armazenamento|espaço em disco|available space|disk space|hard drive|hd space)[:\s]*([\d.]+\s*(?:GB|MB|TB|ГБ|МБ))/i)?.[1]

  if (jsonLdStorage) {
    installedSize = jsonLdStorage.trim()
  } else if (strongStorageMatch) {
    installedSize = strongStorageMatch.trim()
  } else if (storageMatch) {
    installedSize = storageMatch.trim()
  }

  // 6. Mode (Multiplayer / Co-op vs Singleplayer)
  if (
    /online-?fix/i.test(providerId) ||
    /\b(multiplayer|online co-op|co-op|coop|pvp|по сети)\b/i.test(content)
  ) {
    mode = 'Multiplayer / Co-op'
  } else {
    mode = 'Singleplayer'
  }

  // 7. Genre
  const genreMatch =
    content.match(/(?:genre|genres|gênero|gêneros|жанр)[:\s]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    content.match(/title=["'](Action|Adventure|Fighting|RPG|Simulation|Strategy|Horror|Casual|Early Access|Sports|Racing)["']/i) ||
    content.match(/(?:genre|genres|gênero|gêneros|жанр)[:\s]*([a-zA-Z0-9,\- ]+?)(?:<|\n|$)/i)

  if (genreMatch) {
    genre = genreMatch[1].replace(/<[^>]+>/g, '').trim()
  }

  // 8. Developer
  const devMatch =
    content.match(/(?:Developer|Desenvolvedor|Desenvolvimento)[:\s/]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    content.match(/(?:Developer|Desenvolvedor)[:\s/]+([a-zA-Z0-9_\- .&]+?)(?:<|\n|$)/i)
  if (devMatch) {
    developer = devMatch[1].replace(/<[^>]+>/g, '').trim()
  }

  // 9. Publisher
  const pubMatch =
    content.match(/(?:Publisher|Publicadora|Distribuidora)[:\s/]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    content.match(/(?:Publisher|Publicadora|Distribuidora)[:\s/]+([a-zA-Z0-9_\- .&]+?)(?:<|\n|$)/i)
  if (pubMatch) {
    publisher = pubMatch[1].replace(/<[^>]+>/g, '').trim()
  }

  // 10. Steam Deck Compatibility
  const deckMatch =
    content.match(/(?:Deck|Steam Deck)[:\s/]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    content.match(/(?:Deck|Steam Deck)[:\s/]+(Unsupported|Playable|Verified|Unknown)/i)
  if (deckMatch) {
    deckCompatibility = deckMatch[1].replace(/<[^>]+>/g, '').trim()
  }

  // 11. Controller Support
  const ctrlMatch =
    content.match(/(?:Controller|Controle)[:\s/]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    content.match(/(?:Controller|Controle)[:\s/]+(Full|Partial|Total|Parcial)/i)
  if (ctrlMatch) {
    const raw = ctrlMatch[1].replace(/<[^>]+>/g, '').trim()
    controllerSupport = /full|total/i.test(raw) ? 'Total' : 'Parcial'
  }

  // 12. Rating & Recommendation (AnkerGames / WordPress)
  const ratingMatch = content.match(/(\d+(?:\.\d+)?)\s*\/\s*5/)
  if (ratingMatch) {
    rating = `${ratingMatch[1]}/5`
  }
  const recMatch = content.match(/(\d{1,3}%)\s*(?:recommend|recomendam)/i)
  if (recMatch) {
    recommendPercent = recMatch[1]
  }

  // 13. Description / Synopsis
  const descMatch =
    content.match(/<div\b[^>]*class=["'][^"']*(?:game-description|synopsis|entry-content|post-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
    content.match(/<p\b[^>]*class=["'][^"']*(?:description|lead)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
  if (descMatch) {
    const cleanDesc = plain(descMatch[1])
    if (cleanDesc.length > 20 && !/^(download|view details|click here)/i.test(cleanDesc)) {
      description = cleanDesc.slice(0, 600)
    }
  }

  return {
    releaseDate,
    uploadDate,
    cracker,
    uploader,
    size,
    installedSize,
    mode,
    genre,
    developer,
    publisher,
    deckCompatibility,
    controllerSupport,
    rating,
    recommendPercent,
    description
  }
}

export function parseWebsiteGames(
  rawHtml: string,
  base: string,
  config: WebsiteSourceConfig,
  manifest: PluginManifest
): GhostSearchResult[] {
  const results = new Map<string, GhostSearchResult>()

  // Isola o conteúdo principal removendo widgets secundários de sidebar, comentários e rodapé
  const html = rawHtml
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')

  // 1. ESTRATÉGIA A: Tags <article> atômicas (AnkerGames, NXBrew, NSWGF, WordPress blogs)
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)]
  if (articles.length > 0) {
    for (const a of articles) {
      const artHtml = a[0]

      // URL do jogo
      let url: URL | undefined = undefined
      const xDataMatch = /x-data=["']uiPostCard\(['"]([^'"]+)['"]\)/i.exec(artHtml)
      const postTitleLink = /<h[1-6]\b[^>]*class=["'][^"']*post-title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["']/i.exec(artHtml)

      if (xDataMatch) {
        try { url = new URL(xDataMatch[1].replace(/\\/g, ''), base) } catch {}
      } else if (postTitleLink) {
        try { url = new URL(postTitleLink[1].replace(/&amp;/g, '&'), base) } catch {}
      } else {
        for (const m of artHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
          try {
            const candidate = new URL(m[1].replace(/&amp;/g, '&'), base)
            if (candidate.origin === new URL(base).origin && candidate.pathname !== '/' &&
                !/^\/(?:category|tag|author|page|feed|wp-|contact|about|privacy|dmca|faq|search|comments)\b/i.test(candidate.pathname)) {
              if (!config.gamePathPrefix || candidate.pathname.startsWith(config.gamePathPrefix)) {
                url = candidate
                break
              }
            }
          } catch {}
        }
      }

      if (!url) continue

      // Título
      let title = ''
      const hTitle = /<h[1-6]\b[^>]*class=["'][^"']*post-title[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(artHtml) ||
                     /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(artHtml)
      const aTitleAttr = /\btitle=["']([^"']+)["']/i.exec(artHtml)
      const altAttr = /\balt=["']([^"']+)["']/i.exec(artHtml)
      const srOnly = /<span class="sr-only">([\s\S]*?)<\/span>/i.exec(artHtml)

      if (hTitle) {
        title = plain(hTitle[1])
      } else if (aTitleAttr && aTitleAttr[1].length > 2 && !/^(view details|download|post|read)/i.test(aTitleAttr[1])) {
        title = plain(aTitleAttr[1])
      } else if (srOnly && srOnly[1].length > 2) {
        title = plain(srOnly[1])
      } else if (altAttr && altAttr[1].trim().length > 2) {
        title = plain(altAttr[1])
      }

      title = cleanGameTitle(title)
      if (title.length < 2 || /^(download|details|read more|скачать|baixar)/i.test(title)) continue

      // Capa
      let coverUrl: string | undefined = undefined
      const picSource = /<picture\b[\s\S]*?<source\b[^>]*srcset=["']([^"'\s,]+)/i.exec(artHtml)
      const imgTag = /<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i.exec(artHtml)
      const imgSrc = picSource ? picSource[1] : (imgTag ? imgTag[1] : undefined)
      if (imgSrc) {
        try {
          const resolved = new URL(imgSrc.replace(/&amp;/g, '&'), base).href
          if (/^https?:\/\//i.test(resolved)) coverUrl = resolved
        } catch {}
      }

      // Versão
      const versionMatch = /<span\b[^>]*title=["'](V\s*[\d.]+)["']/i.exec(artHtml) ||
                           /V\s*(\d+(?:\.\d+)+)/i.exec(artHtml) ||
                           /\[(v\d+)\]/i.exec(title)
      const version = versionMatch
        ? (versionMatch[1].startsWith('v') || versionMatch[1].startsWith('V') ? versionMatch[1] : `v${versionMatch[1]}`)
        : (extractVersionFromText(title) || extractVersionFromText(artHtml))

      const meta = extractGameMetadataFromHtml(artHtml, manifest.id)

      results.set(url.href, {
        id: url.href,
        pageUrl: url.href,
        title,
        version,
        coverUrl,
        providerId: manifest.id,
        providerName: manifest.name,
        platform: config.platform,
        size: meta.size,
        installedSize: meta.installedSize,
        uploadDate: meta.uploadDate,
        releaseDate: meta.releaseDate,
        cracker: meta.cracker,
        uploader: meta.uploader,
        mode: meta.mode,
        genre: meta.genre,
        developer: meta.developer,
        publisher: meta.publisher,
        deckCompatibility: meta.deckCompatibility,
        controllerSupport: meta.controllerSupport,
        rating: meta.rating,
        recommendPercent: meta.recommendPercent,
        description: meta.description
      })
    }
  }

  // 2. ESTRATÉGIA B: Links <a> avulsos com contexto circundante (SteamRIP, Online-Fix, etc.)
  if (results.size === 0) {
    for (const match of html.matchAll(
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    )) {
      let url: URL
      try {
        url = new URL(match[1].replace(/&amp;/g, '&'), base)
      } catch {
        continue
      }
      if (
        url.origin !== new URL(base).origin ||
        url.pathname === '/'
      )
        continue

      // Rejeita hashes de comentários ou fragmentos internos
      if (url.hash && /comment|comm-|reply/i.test(url.hash)) continue
      // Rejeita páginas de paginação de comentários DLE (ex: /page,1,7,...)
      if (/\/page,\d+/i.test(url.pathname)) continue

      // Ignora páginas de navegação do sistema
      if (/^\/(?:category|tag|author|page|feed|wp-|contact|about|privacy|dmca|faq|search|comments|guides_upd|terms-of-use|partners)\b/i.test(url.pathname)) {
        continue
      }

      if (config.gamePathPrefix && !url.pathname.startsWith(config.gamePathPrefix)) {
        continue
      }

      if (
        !config.gamePathPrefix &&
        !/\.html$|download|\/game\/|\/\?p=|\/[a-z0-9-]+-free-download\/|\/[a-z0-9-]+-switch|\/[a-z0-9-]+-nsp|\/[a-z0-9-]+-xci|\/[a-z0-9-]+-eshop|\/[a-z0-9-]{3,}\/$/i.test(url.pathname)
      )
        continue

      // 1. Extração e limpeza do título
      let rawTitle = ''
      const aTagFull = match[0]
      const aTitleAttr = /\btitle=["']([^"']+)["']/i.exec(aTagFull)?.[1]
      const heading = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(match[2])
      const alt = /\balt=["']([^"']+)["']/i.exec(match[2])?.[1]

      if (aTitleAttr && aTitleAttr.length > 2 && !/^(view details|download|post|read)/i.test(aTitleAttr)) {
        rawTitle = plain(aTitleAttr)
      } else if (heading) {
        rawTitle = plain(heading[1])
      } else if (alt && alt.trim().length > 2) {
        rawTitle = plain(alt)
      } else {
        const stripped = match[2].replace(/<p\b[\s\S]*$/i, '')
        rawTitle = plain(stripped)
      }

      rawTitle = cleanGameTitle(rawTitle)

      if (
        rawTitle.length < 2 ||
        /^(download|details|read more|скачать|baixar)/i.test(rawTitle)
      )
        continue

      // 2. Extração multi-camada de Capa / Imagem e Versão circundante
      let imageSrc: string | undefined = undefined

      // 2a. Busca direta dentro da tag <a>
      const innerImg = /<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i.exec(match[2])
      const innerPicture = /<source\b[^>]*srcset=["']([^"'\s,]+)/i.exec(match[2])
      if (innerImg) {
        imageSrc = innerImg[1]
      } else if (innerPicture) {
        imageSrc = innerPicture[1]
      }

      // 2b. Contexto ao redor (±1500 caracteres) para capa e versão (SteamRIP tagmetafield, Online-Fix .edit)
      let surrounding = ''
      if (match.index !== undefined) {
        const startContext = Math.max(0, match.index - 1500)
        const endContext = Math.min(html.length, match.index + match[0].length + 1500)
        surrounding = html.substring(startContext, endContext)

        if (!imageSrc) {
          // Suporte a SteamRIP (.slide data-back / data-back-webp)
          const backMatch = /data-back(?:-webp)?=["']([^"']+)["']/i.exec(surrounding)
          // Suporte a AnkerGames (data-game-image)
          const gameImageMatch = /data-game-image=["']([^"']+)["']/i.exec(surrounding)
          // Suporte a tags img lazyload no container
          const lazyImg = /<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i.exec(surrounding)
          // Suporte a background-image inline CSS
          const bgMatch = /background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/i.exec(surrounding)

          if (backMatch) imageSrc = backMatch[1]
          else if (gameImageMatch) imageSrc = gameImageMatch[1]
          else if (lazyImg) imageSrc = lazyImg[1]
          else if (bgMatch) imageSrc = bgMatch[1]
        }
      }

      let coverUrl: string | undefined = undefined
      if (imageSrc) {
        try {
          const resolved = new URL(imageSrc.replace(/&amp;/g, '&'), base).href
          if (/^https?:\/\//i.test(resolved)) {
            coverUrl = resolved
          }
        } catch {}
      }

      const version = extractVersionFromText(match[2]) || extractVersionFromText(rawTitle) || (surrounding ? extractVersionFromText(surrounding) : undefined)
      const meta = extractGameMetadataFromHtml(match[2], manifest.id, surrounding)

      const existing = results.get(url.href)
      if (!existing || (!existing.coverUrl && coverUrl) || (!existing.version && version)) {
        results.set(url.href, {
          id: url.href,
          pageUrl: url.href,
          title: rawTitle,
          version: version || existing?.version,
          coverUrl: coverUrl || existing?.coverUrl,
          providerId: manifest.id,
          providerName: manifest.name,
          platform: config.platform,
          size: meta.size || existing?.size,
          installedSize: meta.installedSize || existing?.installedSize,
          uploadDate: meta.uploadDate || existing?.uploadDate,
          releaseDate: meta.releaseDate || existing?.releaseDate,
          cracker: meta.cracker || existing?.cracker,
          uploader: meta.uploader || existing?.uploader,
          mode: meta.mode || existing?.mode,
          genre: meta.genre || existing?.genre,
          developer: meta.developer || existing?.developer,
          publisher: meta.publisher || existing?.publisher,
          deckCompatibility: meta.deckCompatibility || existing?.deckCompatibility,
          controllerSupport: meta.controllerSupport || existing?.controllerSupport,
          rating: meta.rating || existing?.rating,
          recommendPercent: meta.recommendPercent || existing?.recommendPercent,
          description: meta.description || existing?.description
        })
      }
    }
  }

  return [...results.values()]
}

export function websiteSource(
  manifest: PluginManifest,
  config: WebsiteSourceConfig
): SourceProvider {
  const base = manifest.homepage
  if (!base) throw new Error('A fonte precisa declarar sua página inicial.')
  async function page(url: string) {
    const response = await NetworkGuard.fetchResponse(
      url,
      manifest,
      AbortSignal.timeout(20000)
    )
    if (!response.ok)
      throw new Error(
        `A fonte exige interação no navegador ou está indisponível (HTTP ${response.status}).`
      )
    const reader = response.body?.getReader()
    if (!reader) throw new Error('A fonte não retornou conteúdo.')
    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > 8 * 1024 * 1024) {
        await reader.cancel()
        throw new Error('O catálogo excedeu o tamanho permitido.')
      }
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks)
    const contentType = response.headers.get('content-type') || ''
    let html: string
    if (/windows-1251|cp1251/i.test(contentType) || /online-fix\.me/i.test(url)) {
      try {
        html = new TextDecoder('windows-1251').decode(buffer)
      } catch {
        html = buffer.toString('utf8')
      }
    } else {
      const sample = buffer.subarray(0, 2048).toString('latin1')
      if (/charset=["']?(?:windows-1251|cp1251)/i.test(sample)) {
        try {
          html = new TextDecoder('windows-1251').decode(buffer)
        } catch {
          html = buffer.toString('utf8')
        }
      } else {
        html = buffer.toString('utf8')
      }
    }
    if (/Just a moment|cf-chl-|Checking your browser/i.test(html))
      throw new Error(
        'Esta fonte exige verificação no navegador. Abra o site e vincule a página do jogo.'
      )
    return html
  }
  return {
    id: manifest.id,
    name: manifest.name,
    async search(query) {
      // 1. Gera variantes inteligentes da consulta (ex: stalker 2 -> stalker 2, s.t.a.l.k.e.r. 2, stalker ii)
      const variants = generateSearchQueryVariants(query).slice(0, 4)
      const gamesMap = new Map<string, GhostSearchResult>()

      for (const v of variants) {
        const searchTargets: string[] = []
        if (/ankergames\.net/i.test(base)) {
          searchTargets.push(new URL(`/search/${encodeURIComponent(v)}`, base).href)
          searchTargets.push(new URL(`/games-list?q=${encodeURIComponent(v)}`, base).href)
        } else if (/online-fix\.me/i.test(base)) {
          searchTargets.push(new URL(`/index.php?do=search&subaction=search&story=${encodeURIComponent(v)}`, base).href)
        } else if (/steamrip\.com|nxbrew\.net|nswgf\.com|romslab\.com/i.test(base)) {
          searchTargets.push(new URL(`/?s=${encodeURIComponent(v)}`, base).href)
        }

        for (const target of searchTargets) {
          try {
            const html = await page(target)
            const parsed = parseWebsiteGames(html, base, config, manifest)
            if (parsed.length) {
              for (const g of parsed) {
                if (!gamesMap.has(g.id)) {
                  gamesMap.set(g.id, g)
                }
              }
              break
            }
          } catch {
            // Continua para o próximo alvo
          }
        }
      }

      // Se nenhum alvo de busca encontrou jogos, tenta o catálogo geral como fallback
      if (gamesMap.size === 0) {
        try {
          const html = await page(new URL(config.catalogPath, base).href)
          const parsed = parseWebsiteGames(html, base, config, manifest)
          for (const g of parsed) {
            if (!gamesMap.has(g.id)) {
              gamesMap.set(g.id, g)
            }
          }
        } catch {
          // ignore
        }
      }

      if (gamesMap.size === 0)
        throw new Error(
          'Não foi possível ler o catálogo desta fonte. Abra o site e vincule a página do jogo.'
        )

      const allFound = Array.from(gamesMap.values())
      return allFound
        .filter((game) => matchesQuery(game.title, query))
        .slice(0, 100)
    },
    async getDetails(id) {
      const html = await page(id)
      const rawTitle = cleanGameTitle(plain(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || ''))
      if (!rawTitle)
        throw new Error('Não foi possível identificar este jogo na fonte.')

      // 1. Extração no título
      let version = extractVersionFromText(rawTitle)

      // 2. Extração no corpo completo da página
      if (!version) {
        version = extractVersionFromText(html)
      }

      const meta = extractGameMetadataFromHtml(html, manifest.id)

      let coverUrl: string | undefined = undefined
      const ogMatch =
        html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
        html.match(/"image":\s*\[?"([^"\]]+)"/i)
      if (ogMatch?.[1]) {
        try {
          coverUrl = new URL(ogMatch[1].replace(/&amp;/g, '&'), id).href
        } catch {
          // ignore
        }
      }

      return {
        id,
        pageUrl: id,
        title: rawTitle,
        version,
        coverUrl,
        platform: config.platform,
        providerId: manifest.id,
        providerName: manifest.name,
        size: meta.size,
        installedSize: meta.installedSize,
        uploadDate: meta.uploadDate,
        releaseDate: meta.releaseDate,
        cracker: meta.cracker,
        uploader: meta.uploader,
        mode: meta.mode,
        genre: meta.genre,
        developer: meta.developer,
        publisher: meta.publisher,
        deckCompatibility: meta.deckCompatibility,
        controllerSupport: meta.controllerSupport,
        rating: meta.rating,
        recommendPercent: meta.recommendPercent,
        description: meta.description
      }
    },
    async getSources(id) {
      const check = NetworkGuard.validateUrl(id, manifest)
      if (!check.allowed) throw new Error(check.reason)
      const sources: GhostDownloadSource[] = []
      try {
        const html = await page(id)
        for (const match of html.matchAll(
          /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>(?:([\s\S]*?)<\/a>)?/gi
        )) {
          let url: URL
          const rawHref = match[2].replace(/&amp;/g, '&').trim()
          const rawText = match[4] ? match[4].replace(/<[^>]+>/g, '').trim() : ''
          try {
            url = new URL(rawHref, id)
          } catch {
            continue
          }

          // Resolução direta de mirrors PixelDrain
          const pdMatch = url.href.match(/pixeldrain\.com\/u\/([a-zA-Z0-9_-]+)/i)
          if (pdMatch) {
            const apiUrl = `https://pixeldrain.com/api/file/${pdMatch[1]}`
            if (NetworkGuard.validateUrl(apiUrl, manifest).allowed) {
              if (!sources.some((source) => source.url === apiUrl)) {
                sources.push({
                  id: apiUrl,
                  name: `📥 Baixar Direto · PixelDrain`,
                  type: 'direct',
                  archive: 'zip',
                  url: apiUrl
                })
              }
              continue
            }
          }

          // Resolução direta de mirrors Buzzheavier
          const bhMatch = url.href.match(/(?:buzzheavier\.com|bzzhr\.to)\/(?:f|download|d)?\/?([a-zA-Z0-9_-]+)/i)
          if (bhMatch) {
            if (NetworkGuard.validateUrl(url.href, manifest).allowed) {
              if (!sources.some((source) => source.url === url.href)) {
                sources.push({
                  id: url.href,
                  name: `📥 Baixar Direto · Buzzheavier`,
                  type: 'direct',
                  archive: 'zip',
                  url: url.href
                })
              }
              continue
            }
          }

          // Detecção de links diretos de pacotes (.zip, .rar, .7z, .tar, .iso)
          const extMatch = url.pathname.match(/\.(zip|rar|7z|tar|iso)$/i)
          if (extMatch) {
            if (!NetworkGuard.validateUrl(url.href, manifest).allowed) continue
            if (sources.some((source) => source.url === url.href)) continue
            const rawExt = extMatch[1].toLowerCase()
            const ext: 'zip' | 'rar' | '7z' | 'tar' = rawExt === 'iso' ? 'zip' : (rawExt as 'zip' | 'rar' | '7z' | 'tar')
            const label = rawText && rawText.length < 50 ? rawText : url.hostname
            sources.push({
              id: url.href,
              name: `Baixar ${rawExt.toUpperCase()} · ${label}`,
              type: 'direct',
              archive: ext,
              url: url.href
            })
            continue
          }

          // Links Magnet / Torrent
          if (url.protocol === 'magnet:' || /\.torrent$/i.test(url.pathname)) {
            if (!sources.some((source) => source.url === url.href)) {
              sources.push({
                id: url.href,
                name: `🧲 Torrent / Magnet · ${rawText || url.hostname}`,
                type: 'magnet',
                url: url.href
              })
            }
          }
        }
      } catch (error) {
        // A blocked catalog is an interactive download, never a fabricated file URL.
        sources.push({
          id: 'website',
          name: `Abrir site · ${error instanceof Error ? error.message : 'Download assistido'}`,
          type: 'external',
          url: id
        })
        return sources
      }
      return [
        ...sources,
        {
          id: 'website',
          name: 'Baixar pelo site e importar arquivo',
          type: 'external',
          url: id
        }
      ]
    }
  }
}
