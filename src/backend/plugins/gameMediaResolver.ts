import https from 'node:https'

const log = (msg: string) => console.log(`[GameMediaResolver]: ${msg}`)
const warn = (msg: string, err?: unknown) => console.warn(`[GameMediaResolver]: ${msg}`, err || '')

const descriptionCache = new Map<string, string>()
const trailerCache = new Map<string, string>()

function fetchJson<T = any>(url: string, timeoutMs = 3500): Promise<T | null> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T)
          } catch {
            resolve(null)
          }
        })
      }
    )

    req.on('error', () => resolve(null))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(null)
    })
  })
}

function fetchText(url: string, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      }
    )

    req.on('error', () => resolve(''))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve('')
    })
  })
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function isPortugueseText(text?: string): boolean {
  if (!text || text.length < 20) return false
  const lower = text.toLowerCase()
  const ptMarkers = [
    ' de ',
    ' do ',
    ' da ',
    ' em ',
    ' para ',
    ' com ',
    ' um ',
    ' uma ',
    ' não ',
    ' jogo ',
    ' combate ',
    ' equipe ',
    ' história '
  ]
  let matchCount = 0
  for (const m of ptMarkers) {
    if (lower.includes(m)) matchCount++
  }
  return matchCount >= 2 || /[áéíóúãõçêâ]/i.test(text)
}

/**
 * Resolve a descrição oficial em Português do Brasil para um jogo.
 * Camada 1: Retorna se o texto bruto já for português.
 * Camada 2: Steam Store API oficial em português brasileiro (l=brazilian).
 * Camada 3: Tradução neural via MyMemory.
 * Camada 4: Modelo padrão localizado GhostShield.
 */
export async function resolvePortugueseDescription(
  canonicalTitle: string,
  rawEnglishDesc?: string
): Promise<string> {
  const cacheKey = canonicalTitle.trim().toLowerCase()
  const cached = descriptionCache.get(cacheKey)
  if (cached) return cached

  if (rawEnglishDesc && isPortugueseText(rawEnglishDesc)) {
    descriptionCache.set(cacheKey, rawEnglishDesc)
    return rawEnglishDesc
  }

  // Camada 2: Busca oficial na Steam Store em Português do Brasil
  try {
    const cleanSearch = canonicalTitle
      .replace(/[:_–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      cleanSearch
    )}&l=brazilian&cc=BR`
    const searchRes = await fetchJson<{ items?: Array<{ id: number; name: string }> }>(
      searchUrl,
      2500
    )

    if (searchRes?.items && searchRes.items.length > 0) {
      const topApp = searchRes.items[0]
      const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${topApp.id}&l=brazilian&cc=BR`
      const detailsRes = await fetchJson<Record<string, { data?: { short_description?: string } }>>(
        detailsUrl,
        2500
      )
      const desc = detailsRes?.[topApp.id]?.data?.short_description
      if (desc && desc.length > 20) {
        const clean = decodeHtmlEntities(desc)
        descriptionCache.set(cacheKey, clean)
        log(`Descrição oficial obtida da Steam para "${canonicalTitle}"`)
        return clean
      }
    }
  } catch (err) {
    warn(`Falha ao consultar Steam para "${canonicalTitle}":`, err)
  }

  // Camada 3: Tradução da descrição em inglês via MyMemory
  if (rawEnglishDesc && rawEnglishDesc.length > 20) {
    try {
      const snippet = rawEnglishDesc.slice(0, 450)
      const trUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        snippet
      )}&langpair=en|pt-BR`
      const trRes = await fetchJson<{ responseData?: { translatedText?: string } }>(trUrl, 3000)
      const translated = trRes?.responseData?.translatedText
      if (translated && translated.length > 20 && !translated.toLowerCase().includes('quota exceeded')) {
        const clean = decodeHtmlEntities(translated)
        descriptionCache.set(cacheKey, clean)
        log(`Descrição traduzida via MyMemory para "${canonicalTitle}"`)
        return clean
      }
    } catch (err) {
      warn(`Falha na tradução MyMemory para "${canonicalTitle}":`, err)
    }
  }

  // Camada 4: Fallback padrão localizado GhostShield
  const fallback = `Explore e jogue ${canonicalTitle} com download automatizado e verificação de integridade de arquivos. Todas as atualizações e backups de saves são protegidos pela tecnologia GhostShield.`
  descriptionCache.set(cacheKey, fallback)
  return fallback
}

/**
 * Extrai o ID oficial do primeiro trailer/gameplay relevante do YouTube.
 * Permite renderização imediata do iframe com https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1
 * sem erro de "Vídeo indisponível".
 */
export async function resolveYouTubeTrailerId(canonicalTitle: string): Promise<string | null> {
  const cacheKey = canonicalTitle.trim().toLowerCase()
  const cached = trailerCache.get(cacheKey)
  if (cached) return cached

  try {
    const cleanSearch = canonicalTitle
      .replace(/[:_–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      cleanSearch + ' trailer gameplay'
    )}`
    const html = await fetchText(searchUrl, 3500)

    const matches = Array.from(html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g))
    const ids = matches.map((m) => m[1]).filter((id) => id && id.length === 11)

    if (ids.length > 0) {
      const selectedId = ids[0]
      trailerCache.set(cacheKey, selectedId)
      log(`YouTube Trailer ID encontrado para "${canonicalTitle}": ${selectedId}`)
      return selectedId
    }
  } catch (err) {
    warn(`Erro ao buscar trailer no YouTube para "${canonicalTitle}":`, err)
  }

  return null
}
