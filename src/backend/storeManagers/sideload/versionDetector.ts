import fs from 'fs'
import path from 'path'
import https from 'https'
import { GameInfo } from 'common/types'
import { userDataPath } from 'backend/constants/paths'
import { gameOverridesStore } from 'backend/game_overrides/electronStores'
import { libraryStore } from './electronStores'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { sendFrontendMessage } from '../../ipc'

const logPrefix: LogPrefix = 'Sideload'

export interface DetectedVersionResult {
  version: string
  source: 'override' | 'ankergames' | 'folder' | 'title' | 'manifest' | 'pe_header' | 'online_date' | 'date' | 'manual'
  rawDate?: string
  isDate?: boolean
  details?: string
}

interface VersionCacheEntry {
  version: string
  date: string
  details?: string
}

const CACHE_DIR = path.join(userDataPath, 'store_cache')
const CACHE_FILE = path.join(CACHE_DIR, 'version_lookup_cache.json')

function loadVersionCache(): Record<string, VersionCacheEntry> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    }
  } catch {
    // ignore parse error
  }
  return {}
}

function saveVersionCache(cache: Record<string, VersionCacheEntry>): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
  } catch (err) {
    logError(`Erro ao salvar cache de versões: ${err}`, logPrefix)
  }
}

/**
 * Normaliza strings de data comuns em pastas de repacks/jogos
 * Ex: '24.06.2021' -> '2021-06-24', '2024.08.21' -> '2024-08-21'
 */
function parseDatePattern(str: string): { isoDate: string; raw: string } | null {
  // Pattern 1: DD.MM.YYYY ou DD-MM-YYYY
  const dmyMatch = str.match(/\b(\d{2})[._-](\d{2})[._-](\d{4})\b/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    const year = parseInt(dmyMatch[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2030) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { isoDate: iso, raw: dmyMatch[0] }
    }
  }

  // Pattern 2: YYYY.MM.DD ou YYYY-MM-DD
  const ymdMatch = str.match(/\b(\d{4})[._-](\d{2})[._-](\d{2})\b/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10)
    const day = parseInt(ymdMatch[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2030) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { isoDate: iso, raw: ymdMatch[0] }
    }
  }

  return null
}

/**
 * Extrai versões das strings do cabeçalho PE (Resource .rsrc) de um executável Windows (.exe)
 */
function extractPeVersion(exePath: string): { version?: string; compileDate?: string } | null {
  if (!fs.existsSync(exePath)) return null

  try {
    const fd = fs.openSync(exePath, 'r')
    const stats = fs.fstatSync(fd)
    const readSize = Math.min(stats.size, 8 * 1024 * 1024)
    const buf = Buffer.alloc(readSize)
    fs.readSync(fd, buf, 0, readSize, 0)
    fs.closeSync(fd)

    let compileDate: string | undefined
    if (readSize > 0x40) {
      const peOffset = buf.readUInt32LE(0x3c)
      if (peOffset + 12 < readSize) {
        const timeDateStamp = buf.readUInt32LE(peOffset + 8)
        const dateObj = new Date(timeDateStamp * 1000)
        const year = dateObj.getUTCFullYear()
        if (year >= 2015 && year <= 2027) {
          compileDate = dateObj.toISOString().split('T')[0]
        }
      }
    }

    const extractString = (key: string): string | null => {
      const keyBuf = Buffer.from(key + '\0', 'utf16le')
      const idx = buf.indexOf(keyBuf)
      if (idx === -1) return null
      let pos = idx + keyBuf.length
      while (pos < buf.length && buf.readUInt16LE(pos) === 0) pos += 2
      if (pos >= buf.length) return null
      const chars: string[] = []
      while (pos < buf.length - 1) {
        const code = buf.readUInt16LE(pos)
        if (code === 0) break
        chars.push(String.fromCharCode(code))
        pos += 2
      }
      const val = chars.join('').trim()
      return val.length > 0 ? val : null
    }

    const prodVer = extractString('ProductVersion')
    const fileVer = extractString('FileVersion')
    const rawVer = prodVer || fileVer

    if (rawVer) {
      // Descartar versões genéricas ou placeholders de engines
      if (!/^(0\.0\.0\.0|1\.0\.0\.0)$/.test(rawVer)) {
        if (!/^(UE5|UE4|Unreal)/i.test(rawVer)) {
          return { version: rawVer, compileDate }
        }
      }
    }

    // Fallback: se o timestamp PE for ausente ou inválido (ex: 2065), usa a data de modificação do arquivo
    if (!compileDate && stats.mtime) {
      const mYear = stats.mtime.getUTCFullYear()
      if (mYear >= 2015 && mYear <= 2027) {
        compileDate = stats.mtime.toISOString().split('T')[0]
      }
    }

    return { compileDate }
  } catch {
    return null
  }
}

/**
 * Motor multi-camadas de detecção de versão para jogos Sideload / Piratas / AnkerGames
 */
export function detectPirateGameVersion(game: GameInfo): DetectedVersionResult | null {
  if (!game) return null

  // Camada 1: Overrides manuais ou gravados
  try {
    const currentOverrides = (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}
    const saved = currentOverrides[game.app_name]?.version
    if (saved && typeof saved === 'string' && saved.trim()) {
      return {
        version: saved.trim(),
        source: 'override',
        details: 'Versão personalizada / AnkerGames'
      }
    }
  } catch {
    // ignore
  }

  // Camada 2: Metadado nativo do jogo (se veio pelo AnkerGames ou biblioteca)
  if (game.version && typeof game.version === 'string' && game.version.trim()) {
    return {
      version: game.version.trim(),
      source: 'ankergames',
      details: 'Registrado pelo AnkerGames'
    }
  }

  const exe = (game.install?.executable || (game as any).executable || '').trim()
  const dir = exe ? path.dirname(exe) : ''
  const parentDir = dir ? path.dirname(dir) : ''

  const candidates: Array<{
    version: string
    priority: number
    source: DetectedVersionResult['source']
    rawDate?: string
    isDate?: boolean
    details?: string
  }> = []

  const versionCache = loadVersionCache()

  // Camada 3: Análise de pastas (Diretório do executável e Diretório Pai)
  const dirNames = [path.basename(dir), path.basename(parentDir)]
  for (const d of dirNames) {
    if (!d || d === '.' || d.length < 2) continue

    // 3A: Padrão Build (ex: "Build.13682455" ou "Build 20613950")
    const buildMatch = d.match(/\bBuild[._\s]+(\d+)\b/i)
    if (buildMatch) {
      candidates.push({
        version: `Build ${buildMatch[1]}`,
        priority: 1,
        source: 'folder',
        details: `Identificado na pasta "${d}"`
      })
    }

    // 3B: Verificar se a pasta contém DATA de compilação/lançamento (ex: v24.06.2021 ou 2024.08.21)
    const dateMatch = parseDatePattern(d)
    if (dateMatch) {
      const cacheKey = `${(game.title || '').toLowerCase().trim()}:${dateMatch.isoDate}`
      if (versionCache[cacheKey]) {
        candidates.push({
          version: versionCache[cacheKey].version,
          priority: 1,
          source: 'online_date',
          rawDate: dateMatch.raw,
          details: versionCache[cacheKey].details || `Data ${dateMatch.raw} resolvida online`
        })
      } else {
        candidates.push({
          version: `Data ${dateMatch.raw}`,
          priority: 2,
          source: 'date',
          rawDate: dateMatch.raw,
          isDate: true,
          details: `Compilação de ${dateMatch.raw}`
        })
      }
    }

    // 3C: Padrão vX.X... (ex: v1.5.6.F1, v1.0.4, v0.34, v0.02)
    const vMatch = d.match(/(?:[._\s-]|^)(?:v|ver|version)[._\s-]*(\d+(?:[._]\d+)*[a-z0-9._-]*)/i)
    if (vMatch) {
      let cleanV = vMatch[1].replace(/_/g, '.')
      cleanV = cleanV.replace(/-(p2p|codex|rune|tenoke|0xdeadc0de|repack|fitgirl|dodi|flt|skidrow|cpy|plaza)$/i, '')
      if (!/^(x86|x64|win|p2p|repack)/i.test(cleanV) && !parseDatePattern(cleanV)) {
        candidates.push({
          version: `v${cleanV}`,
          priority: 1,
          source: 'folder',
          details: `Identificado na pasta "${d}"`
        })
      }
    }

    // 3D: Números avulsos no diretório (ex: "Cities Skylines 1.4.7", somente se não for data)
    if (!dateMatch) {
      const numMatch = d.match(/[._\s-](\d+\.\d+(?:\.\d+)*)[._\s-]?/i)
      if (numMatch && !parseDatePattern(numMatch[1])) {
        candidates.push({
          version: `v${numMatch[1]}`,
          priority: 2,
          source: 'folder',
          details: `Identificado na pasta "${d}"`
        })
      }
    }
  }

  // Camada 4: Título do jogo
  if (game.title) {
    const tBuild = game.title.match(/\bBuild[._\s]+(\d+)\b/i)
    if (tBuild) {
      candidates.push({
        version: `Build ${tBuild[1]}`,
        priority: 1,
        source: 'title',
        details: 'Identificado no título do jogo'
      })
    }
    const tMatch = game.title.match(/(?:[._\s-]|^)(?:v|ver|version)[._\s-]*(\d+(?:[._]\d+)*[a-z0-9._-]*)/i)
    if (tMatch && !parseDatePattern(tMatch[1])) {
      let cleanT = tMatch[1].replace(/_/g, '.')
      cleanT = cleanT.replace(/-(p2p|codex|rune|tenoke|0xdeadc0de|repack|fitgirl|dodi|flt|skidrow|cpy|plaza)$/i, '')
      candidates.push({
        version: `v${cleanT}`,
        priority: 1,
        source: 'title',
        details: 'Identificado no título do jogo'
      })
    }
  }

  // Camada 5: Manifestos de Steam emulada (appmanifest_*.acf)
  if (dir && fs.existsSync(dir)) {
    try {
      const steamDirs = [
        path.join(dir, 'steamapps'),
        path.join(dir, 'Steam', 'steamapps'),
        path.join(parentDir, 'steamapps')
      ]
      for (const sd of steamDirs) {
        if (fs.existsSync(sd)) {
          const files = fs.readdirSync(sd)
          for (const f of files) {
            if (f.startsWith('appmanifest_') && f.endsWith('.acf')) {
              try {
                const acfText = fs.readFileSync(path.join(sd, f), 'utf8')
                const bMatch = acfText.match(/"buildid"\s+"(\d+)"/i)
                if (bMatch) {
                  candidates.push({
                    version: `Build ${bMatch[1]}`,
                    priority: 2,
                    source: 'manifest',
                    details: 'Steam AppManifest buildid'
                  })
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }

      // Camada 6: Arquivos de texto e manifestos conhecidos
      const dirFiles = fs.readdirSync(dir)
      for (const f of dirFiles) {
        const lower = f.toLowerCase()
        if (lower === 'version.txt' || lower === 'build.txt' || lower === 'game_version.txt') {
          try {
            const content = fs.readFileSync(path.join(dir, f), 'utf8').trim()
            const firstLine = content.split('\n')[0].trim()
            if (firstLine && firstLine.length < 30) {
              const formatted = firstLine.startsWith('v') || firstLine.startsWith('Build') ? firstLine : `v${firstLine}`
              candidates.push({
                version: formatted,
                priority: 2,
                source: 'manifest',
                details: `Arquivo ${f}`
              })
            }
          } catch {
            // ignore
          }
        }
        if (lower.startsWith('goggame-') && lower.endsWith('.info')) {
          try {
            const gogData = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
            if (gogData.versionName || gogData.version) {
              candidates.push({
                version: `v${gogData.versionName || gogData.version}`,
                priority: 2,
                source: 'manifest',
                details: 'Manifesto GOG'
              })
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Camada 7: Cabeçalho PE do Executável (.exe)
  if (exe && fs.existsSync(exe)) {
    const peData = extractPeVersion(exe)
    if (peData?.version) {
      const isUnity = /\d{4}\.\d+\.\d+f\d+/i.test(peData.version)
      candidates.push({
        version: peData.version.startsWith('v') ? peData.version : `v${peData.version}`,
        priority: isUnity ? 5 : 3,
        source: 'pe_header',
        details: 'Cabeçalho PE (ProductVersion)'
      })
    }

    // Se o executável tem data de compilação válida e nenhuma outra versão foi encontrada ainda
    if (peData?.compileDate) {
      const cacheKey = `${(game.title || '').toLowerCase().trim()}:${peData.compileDate}`
      if (versionCache[cacheKey]) {
        candidates.push({
          version: versionCache[cacheKey].version,
          priority: 3,
          source: 'online_date',
          rawDate: peData.compileDate,
          details: versionCache[cacheKey].details || `Compilação de ${peData.compileDate} resolvida online`
        })
      } else {
        candidates.push({
          version: `Data ${peData.compileDate}`,
          priority: 4,
          source: 'date',
          rawDate: peData.compileDate,
          isDate: true,
          details: `Compilação de ${peData.compileDate}`
        })
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.priority - b.priority)
    const best = candidates[0]
    return {
      version: best.version,
      source: best.source,
      rawDate: best.rawDate,
      isDate: best.isDate,
      details: best.details
    }
  }

  return null
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'GhostGamesLauncher/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

/**
 * Consulta a internet (Steam News API / Patch Notes oficiais) para resolver uma data de compilação em versão oficial
 */
export async function resolveDateVersionOnline(
  title: string,
  dateStr: string
): Promise<DetectedVersionResult> {
  const cleanTitle = (title || '')
    .replace(/(\[.*?\]|\(.*?\))/g, '')
    .replace(/\b(repack|p2p|deluxe|edition|build|fitgirl|dodi)\b/gi, '')
    .trim()

  const parsedDate = parseDatePattern(dateStr)
  const targetIso = parsedDate ? parsedDate.isoDate : dateStr
  const targetTime = new Date(targetIso).getTime()

  const cacheKey = `${(title || '').toLowerCase().trim()}:${targetIso}`
  const cache = loadVersionCache()

  if (cache[cacheKey]) {
    return {
      version: cache[cacheKey].version,
      source: 'online_date',
      rawDate: dateStr,
      details: cache[cacheKey].details
    }
  }

  try {
    // 1. Pesquisa o app no catálogo da Steam
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitle)}&l=english&cc=US`
    const searchRes = await fetchJson<{ items?: Array<{ id: number; name: string }> }>(searchUrl)
    const app = searchRes?.items?.[0]

    if (app && app.id) {
      // 2. Busca os patch notes e notícias oficiais da Steam
      const newsUrl = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${app.id}&count=30&format=json`
      const newsRes = await fetchJson<{ appnews?: { newsitems?: Array<{ title: string; date: number }> } }>(newsUrl)
      const items = newsRes?.appnews?.newsitems || []

      // 3. Procura updates com datas próximas (janela de até 60 dias) ou com versão explícita no título
      let bestItem: { title: string; date: number; diff: number; extractedVersion?: string } | null = null

      for (const item of items) {
        const itemTime = item.date * 1000
        const diffDays = Math.abs(itemTime - targetTime) / (1000 * 60 * 60 * 24)

        // Tentar extrair padrão [v0.10.3] ou v1.5.0 ou Build 12345
        const vMatch = item.title.match(/\[?(?:v|ver|version)?\s*(\d+(?:\.\d+)+[a-z0-9._-]*)\]?/i)
        const extracted = vMatch ? `v${vMatch[1]}` : undefined

        if (diffDays <= 60 || extracted) {
          const score = diffDays + (extracted ? 0 : 30)
          if (!bestItem || score < bestItem.diff) {
            bestItem = { title: item.title, date: item.date, diff: score, extractedVersion: extracted }
          }
        }
      }

      if (bestItem) {
        const newsDateStr = new Date(bestItem.date * 1000).toISOString().split('T')[0]
        const resolvedVer = bestItem.extractedVersion || (bestItem.title.length < 25 ? bestItem.title : `Update ${newsDateStr}`)
        const details = `Mapeado via Steam Update (${newsDateStr}): ${bestItem.title}`

        cache[cacheKey] = { version: resolvedVer, date: targetIso, details }
        saveVersionCache(cache)

        return {
          version: resolvedVer,
          source: 'online_date',
          rawDate: dateStr,
          details
        }
      }
    }
  } catch (err) {
    logError(`Falha ao resolver data online para "${title}": ${err}`, logPrefix)
  }

  // Fallback se não encontrar ou sem conexão
  const fallbackVer = dateStr.startsWith('v') ? dateStr : `v${dateStr}`
  return {
    version: fallbackVer,
    source: 'date',
    rawDate: dateStr,
    details: `Data de compilação: ${dateStr}`
  }
}

/**
 * Salva a versão manualmente ou via AnkerGames
 */
export function setGameVersion(
  appName: string,
  version: string
): { success: boolean; version: string } {
  const cleanVersion = (version || '').trim()

  try {
    // 1. Atualiza nos overrides de metadados
    const currentOverrides = (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}
    currentOverrides[appName] = {
      ...currentOverrides[appName],
      version: cleanVersion,
      is_manual: true
    }
    gameOverridesStore.set('overrides', currentOverrides)

    // 2. Se for jogo Sideload / Piratas, persiste também no store da biblioteca sideload
    const sideloadGames = (libraryStore.get('games', []) as GameInfo[]) || []
    const idx = sideloadGames.findIndex((g) => g.app_name === appName)
    if (idx !== -1) {
      sideloadGames[idx].version = cleanVersion
      libraryStore.set('games', sideloadGames)
    }

    // 3. Notifica o frontend
    sendFrontendMessage('metadataChanged', currentOverrides)
    logInfo(`Versão atualizada para [${appName}]: ${cleanVersion}`, logPrefix)

    return { success: true, version: cleanVersion }
  } catch (err) {
    logError(`Erro ao salvar versão para [${appName}]: ${err}`, logPrefix)
    return { success: false, version: cleanVersion }
  }
}
