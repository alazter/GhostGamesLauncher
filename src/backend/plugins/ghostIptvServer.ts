import http from 'node:http'
import https from 'node:https'
import fs from 'graceful-fs'
import path from 'node:path'
import { app } from 'electron'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { engineVersionGt } from './enginePolicy'

const DEFAULT_PORT = 8888
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'
const DEFAULT_REF = 'https://playerembedcanais.site'
const LOCAL_DEV_ROOT =
  'C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\Ghost IPTV'
const LOCAL_DEV_FALLBACK_ROOT =
  'C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\App Tv addon stremio e m3u'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.m3u': 'application/x-mpegurl; charset=utf-8',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.apk': 'application/vnd.android.package-archive'
}

let activeServer: http.Server | undefined
let activePort = DEFAULT_PORT
let serverStartingPromise: Promise<{ port: number; url: string }> | undefined

export function getGhostIptvServerPort(): number {
  return activePort
}

export function getGhostIptvServerUrl(): string {
  return `http://127.0.0.1:${activePort}`
}

interface CandidateWebDirInfo {
  dir: string
  version: string
  buildNumber: number
  mtimeMs: number
  size: number
}

function inspectWebDirectoryCandidate(dir: string): CandidateWebDirInfo | null {
  try {
    const htmlPath = path.join(dir, 'alazterflix_tv.html')
    if (!fs.existsSync(dir) || !fs.existsSync(htmlPath)) return null

    const stat = fs.statSync(htmlPath)
    let version = '0.0.0'
    let buildNumber = 0

    const vCandidates = [
      path.join(dir, 'version.json'),
      path.join(dir, '..', 'version.json')
    ]
    for (const vPath of vCandidates) {
      if (fs.existsSync(vPath)) {
        try {
          const parsed = JSON.parse(
            fs.readFileSync(vPath, 'utf-8').replace(/^\uFEFF/, '').trim()
          )
          if (parsed?.version) version = String(parsed.version).replace(/^v/i, '').trim()
          if (parsed?.build_number) buildNumber = Number(parsed.build_number) || 0
          break
        } catch {}
      }
    }

    // Also verify version badge directly inside alazterflix_tv.html so stale HTML is detected
    try {
      const htmlSample = fs.readFileSync(htmlPath, 'utf-8')
      const badgeMatch = htmlSample.match(
        /id=["']headerVersionBadge["'][^>]*>\s*v?([0-9]+\.[0-9]+\.[0-9]+)\s*</i
      )
      if (badgeMatch?.[1]) {
        const htmlVer = badgeMatch[1].trim()
        if (version === '0.0.0' || engineVersionGt(version, htmlVer)) {
          // If version.json claims newer than the actual HTML badge, trust the actual HTML badge
          version = htmlVer
          const parts = htmlVer.split('.').map((n) => parseInt(n, 10) || 0)
          buildNumber = parts[0] * 100 + (parts[1] || 0) * 10 + (parts[2] || 0)
        } else if (engineVersionGt(htmlVer, version)) {
          version = htmlVer
        }
      }
    } catch {}

    return {
      dir,
      version,
      buildNumber,
      mtimeMs: stat.mtimeMs || 0,
      size: stat.size || 0
    }
  } catch {
    return null
  }
}

export function resolveWebDirectory(customCandidates?: string[]): string {
  const candidates: string[] = customCandidates ? [...customCandidates] : []
  if (!customCandidates) {
    try {
      const userWeb = path.join(
        app.getPath('userData'),
        'plugins',
        'com.ghost.iptv',
        'web'
      )
      candidates.push(userWeb)
    } catch {}

    try {
      const devWeb = path.join(app.getAppPath(), 'plugins', 'ghost-iptv', 'web')
      candidates.push(devWeb)
    } catch {}

    try {
      const cwdWeb = path.join(process.cwd(), 'plugins', 'ghost-iptv', 'web')
      if (!candidates.includes(cwdWeb)) candidates.push(cwdWeb)
    } catch {}

    const localDevWeb = path.join(LOCAL_DEV_ROOT, 'web')
    candidates.push(localDevWeb)
    const fallbackDevWeb = path.join(LOCAL_DEV_FALLBACK_ROOT, 'web')
    candidates.push(fallbackDevWeb)
  }

  const valid: CandidateWebDirInfo[] = []
  for (const dir of candidates) {
    const info = inspectWebDirectoryCandidate(dir)
    if (info) valid.push(info)
  }

  if (valid.length > 0) {
    valid.sort((a, b) => {
      if (a.version !== b.version) {
        if (engineVersionGt(a.version, b.version)) return -1
        if (engineVersionGt(b.version, a.version)) return 1
      }
      if (a.buildNumber !== b.buildNumber) {
        return b.buildNumber - a.buildNumber
      }
      if (Math.abs(a.mtimeMs - b.mtimeMs) > 1000) {
        return b.mtimeMs - a.mtimeMs
      }
      return b.size - a.size
    })
    return valid[0].dir
  }

  return candidates[0] || path.resolve('plugins/ghost-iptv/web')
}

function findDataFile(webDir: string, relCandidates: string[]): string | null {
  const roots = [webDir, path.join(webDir, '..'), LOCAL_DEV_ROOT, LOCAL_DEV_FALLBACK_ROOT]
  for (const root of roots) {
    for (const rel of relCandidates) {
      const p = path.join(root, rel)
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p
      }
    }
  }
  return null
}

function resolveChannelStreamFromCache(
  webDir: string,
  rawId: string
): { url: string; ua?: string; referer?: string; origin?: string } | null {
  const chFile = findDataFile(webDir, [
    path.join('assets', 'channels_cache.json'),
    'channels_cache.json'
  ])
  if (!chFile) return null

  try {
    const list = JSON.parse(fs.readFileSync(chFile, 'utf-8').replace(/^\uFEFF/, '').trim())
    if (!Array.isArray(list)) return null
    const cleanTarget = rawId.toLowerCase().replace(/^meufutebol:/, '').trim()

    for (const item of list) {
      const id = String(item?.id || '')
        .toLowerCase()
        .replace(/^meufutebol:/, '')
        .trim()
      const rId = String(item?.raw_id || '')
        .toLowerCase()
        .replace(/^meufutebol:/, '')
        .trim()
      if ((id === cleanTarget || rId === cleanTarget) && item?.stream_url) {
        return {
          url: String(item.stream_url).trim(),
          ua: item?.headers?.['User-Agent'] || item?.user_agent || DEFAULT_UA,
          referer: item?.headers?.Referer || item?.referer || DEFAULT_REF,
          origin: item?.headers?.Origin || item?.origin || DEFAULT_REF
        }
      }
    }
  } catch {}
  return null
}

function serveClubCrest(
  webDir: string,
  teamName: string,
  res: http.ServerResponse
): void {
  const normStr = (teamName || 'Clube')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  const slug = normStr.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'clube'

  const idxFile = findDataFile(webDir, [
    path.join('assets', 'logos', 'crests', 'crest_index.json')
  ])
  if (idxFile) {
    try {
      const idxMap = JSON.parse(fs.readFileSync(idxFile, 'utf-8'))
      let matchEntry = idxMap[normStr]
      if (!matchEntry) {
        for (const [k, v] of Object.entries(idxMap)) {
          if (k.length >= 3 && (normStr.includes(k) || k.includes(normStr))) {
            matchEntry = v
            break
          }
        }
      }
      if (matchEntry?.crest && typeof matchEntry.crest === 'string') {
        const relCrest = matchEntry.crest.replace(/^\/+/, '')
        const crestPath = findDataFile(webDir, [relCrest])
        if (crestPath) {
          const img = fs.readFileSync(crestPath)
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
          })
          res.end(img)
          return
        }
      }
    } catch {}
  }

  const directPng = findDataFile(webDir, [
    path.join('assets', 'logos', 'crests', `${slug}.png`)
  ])
  if (directPng) {
    try {
      const img = fs.readFileSync(directPng)
      if (img.length > 300) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': img.length,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        })
        res.end(img)
        return
      }
    } catch {}
  }

  // Fallback SVG Shield
  const words = (teamName || 'FC').trim().split(/\s+/).filter(Boolean)
  let abbr = words
    .map((w) => w[0])
    .filter((c) => /[a-zA-Z0-9]/.test(c))
    .join('')
    .slice(0, 3)
    .toUpperCase()
  if (abbr.length < 2) {
    abbr =
      (teamName || 'FC')
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'FC'
  }
  const palettes: Array<[string, string]> = [
    ['#dc2626', '#111827'],
    ['#1d4ed8', '#ffffff'],
    ['#15803d', '#facc15'],
    ['#7c3aed', '#1e1b4b'],
    ['#b91c1c', '#1e3a8a'],
    ['#0f766e', '#f8fafc'],
    ['#ca8a04', '#18181b'],
    ['#0369a1', '#e0f2fe']
  ]
  const sum = Array.from(slug).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const [c1, c2] = palettes[sum % palettes.length]
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c1}"/>
      <stop offset="50.1%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <path d="M18 12 H102 V62 C102 88 84 103 60 112 C36 103 18 88 18 62 Z" fill="url(#g)" stroke="#facc15" stroke-width="5"/>
  <rect x="20" y="44" width="80" height="28" rx="5" fill="#090d16" fill-opacity="0.9" stroke="#facc15" stroke-width="2"/>
  <text x="60" y="64" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="21">${abbr}</text>
</svg>`,
    'utf-8'
  )

  res.writeHead(200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Content-Length': svg.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600'
  })
  res.end(svg)
}

function proxyM3u8(
  targetUrl: string,
  baseUrl: string,
  res: http.ServerResponse,
  customHeaders?: { ua?: string; referer?: string; origin?: string }
): void {
  try {
    if (targetUrl.includes('cdn10embed.xyz')) {
      targetUrl = targetUrl.replace(
        'd1-ywppjexvlyulasvmgzjdftfjikth2210oq80soveui6lkbi2iza2zf.cdn10embed.xyz',
        'd1-ywppjexvlyulasvmgzjdftfjikth0711oq80soveui6lkbi2iza2zf.cdn8embed.xyz'
      )
    }
    const parsed = new URL(targetUrl)
    const options: https.RequestOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': customHeaders?.ua || DEFAULT_UA,
        Referer: customHeaders?.referer || DEFAULT_REF,
        Origin: customHeaders?.origin || DEFAULT_REF
      },
      rejectUnauthorized: false
    }

    const client = parsed.protocol === 'https:' ? https : http
    const req = client.get(options, (upstreamRes) => {
      if (
        upstreamRes.statusCode &&
        [301, 302, 303, 307, 308].includes(upstreamRes.statusCode) &&
        upstreamRes.headers.location
      ) {
        const nextUrl = upstreamRes.headers.location.startsWith('http')
          ? upstreamRes.headers.location
          : new URL(upstreamRes.headers.location, targetUrl).toString()
        proxyM3u8(nextUrl, baseUrl, res, customHeaders)
        return
      }

      if (
        upstreamRes.statusCode &&
        (upstreamRes.statusCode < 200 || upstreamRes.statusCode >= 400)
      ) {
        res.writeHead(upstreamRes.statusCode || 502, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        })
        res.end(`Upstream error ${upstreamRes.statusCode}`)
        return
      }

      let m3u8Text = ''
      upstreamRes.on('data', (chunk) => {
        m3u8Text += chunk.toString()
      })

      upstreamRes.on('end', () => {
        const lastSlash = targetUrl.lastIndexOf('/')
        const baseCdn = targetUrl.substring(0, lastSlash + 1)

        const lines = m3u8Text.split(/\r?\n/)
        const rewritten: string[] = []

        for (let line of lines) {
          const s = line.trim()
          if (!s) continue
          if (s.startsWith('#')) {
            if (s.startsWith('#EXT-X-KEY:') && s.includes('URI="')) {
              const uStart = s.indexOf('URI="') + 5
              const uEnd = s.indexOf('"', uStart)
              if (uEnd !== -1) {
                const keyUrl = s.substring(uStart, uEnd)
                const absKey = keyUrl.startsWith('http')
                  ? keyUrl
                  : baseCdn + keyUrl
                const proxiedKey = `${baseUrl}/ts?url=${encodeURIComponent(absKey)}`
                line = s.substring(0, uStart) + proxiedKey + s.substring(uEnd)
              }
            }
            rewritten.push(line)
          } else {
            const absUrl = s.startsWith('http') ? s : baseCdn + s
            if (s.includes('.m3u8')) {
              rewritten.push(
                `${baseUrl}/sub.m3u8?url=${encodeURIComponent(absUrl)}`
              )
            } else {
              rewritten.push(
                `${baseUrl}/ts?url=${encodeURIComponent(absUrl)}`
              )
            }
          }
        }

        const body = Buffer.from(rewritten.join('\n') + '\n', 'utf-8')
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': body.length,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        })
        res.end(body)
      })
    })

    req.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        })
        res.end(`Proxy error: ${err.message}`)
      }
    })
  } catch (err: any) {
    if (!res.headersSent) {
      res.writeHead(400, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(`Invalid target URL: ${err?.message || err}`)
    }
  }
}

function proxyTsSegment(targetUrl: string, res: http.ServerResponse): void {
  try {
    if (targetUrl.includes('cdn10embed.xyz')) {
      targetUrl = targetUrl.replace(
        'd1-ywppjexvlyulasvmgzjdftfjikth2210oq80soveui6lkbi2iza2zf.cdn10embed.xyz',
        'd1-ywppjexvlyulasvmgzjdftfjikth0711oq80soveui6lkbi2iza2zf.cdn8embed.xyz'
      )
    }
    const parsed = new URL(targetUrl)
    const options: https.RequestOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: DEFAULT_REF,
        Origin: DEFAULT_REF
      },
      rejectUnauthorized: false
    }

    const client = parsed.protocol === 'https:' ? https : http
    const req = client.get(options, (upstreamRes) => {
      if (
        upstreamRes.statusCode &&
        [301, 302, 303, 307, 308].includes(upstreamRes.statusCode) &&
        upstreamRes.headers.location
      ) {
        const nextUrl = upstreamRes.headers.location.startsWith('http')
          ? upstreamRes.headers.location
          : new URL(upstreamRes.headers.location, targetUrl).toString()
        proxyTsSegment(nextUrl, res)
        return
      }

      if (
        upstreamRes.statusCode &&
        (upstreamRes.statusCode < 200 || upstreamRes.statusCode >= 400)
      ) {
        if (!res.headersSent) {
          res.writeHead(upstreamRes.statusCode || 502, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          })
          res.end(`Segment error: ${upstreamRes.statusCode}`)
        }
        return
      }

      const headers: Record<string, string | number> = {
        'Content-Type': 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
      if (upstreamRes.headers['content-length']) {
        headers['Content-Length'] = upstreamRes.headers['content-length']
      }

      res.writeHead(200, headers)
      upstreamRes.pipe(res)
    })

    req.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        })
        res.end(`Segment stream error: ${err.message}`)
      }
    })
  } catch (err: any) {
    if (!res.headersSent) {
      res.writeHead(400, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(`Invalid segment URL: ${err?.message || err}`)
    }
  }
}

export function startGhostIptvServer(): Promise<{ port: number; url: string }> {
  if (activeServer) {
    return Promise.resolve({
      port: activePort,
      url: getGhostIptvServerUrl()
    })
  }

  if (serverStartingPromise) {
    return serverStartingPromise
  }

  serverStartingPromise = new Promise<{ port: number; url: string }>(
    (resolve, reject) => {
      const portsToTry = [DEFAULT_PORT, 8090, 8889, 0]
      let portIndex = 0

      const tryNextPort = () => {
        if (portIndex >= portsToTry.length) {
          serverStartingPromise = undefined
          return reject(
            new Error(
              'Não foi possível iniciar servidor Ghost IPTV em nenhuma porta livre.'
            )
          )
        }

        const candidatePort = portsToTry[portIndex++]
        const srv = http.createServer((req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, DELETE, HEAD, OPTIONS'
          )
          res.setHeader('Access-Control-Allow-Headers', '*')

          if (req.method === 'OPTIONS') {
            res.writeHead(200)
            res.end()
            return
          }

          const parsedUrl = new URL(
            req.url || '/',
            `http://${req.headers.host || `127.0.0.1:${activePort}`}`
          )
          const pathname = parsedUrl.pathname
          const query = parsedUrl.searchParams
          const baseUrl = `http://${req.headers.host || `127.0.0.1:${activePort}`}`
          const webDir = resolveWebDirectory()

          // 1. PROXY HLS
          if (
            pathname === '/live' ||
            pathname === '/live.m3u8' ||
            pathname === '/sub.m3u8' ||
            pathname === '/sub_playlist' ||
            pathname === '/sub'
          ) {
            const targetUrl = query.get('url')
            if (targetUrl) {
              proxyM3u8(targetUrl, baseUrl, res)
              return
            }
          }

          if (pathname.startsWith('/live/')) {
            let rawId = pathname.substring(6)
            if (rawId.endsWith('.m3u8')) {
              rawId = rawId.substring(0, rawId.length - 5)
            }
            if (rawId.startsWith('org.meufutebol/')) {
              rawId = rawId.substring(15)
            }
            if (rawId.startsWith('meufutebol:')) {
              rawId = rawId.substring(11)
            }
            rawId = decodeURIComponent(rawId).trim()
            if (rawId.includes(':')) rawId = rawId.split(':').pop() || rawId

            const cachedChannel = resolveChannelStreamFromCache(webDir, rawId)
            const targetUrl =
              cachedChannel?.url ||
              `https://d1-ywppjexvlyulasvmgzjdftfjikth0711oq80soveui6lkbi2iza2zf.cdn8embed.xyz/${rawId}/index.m3u8`
            proxyM3u8(targetUrl, baseUrl, res, cachedChannel || undefined)
            return
          }

          if (pathname === '/ts' || pathname === '/segment') {
            const targetUrl = query.get('url')
            if (targetUrl) {
              proxyTsSegment(targetUrl, res)
              return
            }
          }

          // 2. SERVER INFO & API ROUTES
          if (pathname === '/api/server-info') {
            const body = JSON.stringify({
              status: 'online',
              port: activePort,
              url: baseUrl
            })
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            })
            res.end(body)
            return
          }

          if (pathname === '/api/channels' || pathname === '/channels.json') {
            const chFile = findDataFile(webDir, [
              path.join('assets', 'channels_cache.json'),
              'channels_cache.json'
            ])
            const data = chFile ? fs.readFileSync(chFile) : Buffer.from('[]', 'utf-8')
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': data.length,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            })
            res.end(data)
            return
          }

          if (
            pathname === '/api/epg' ||
            pathname === '/epg.json' ||
            pathname === '/epg_cache.json'
          ) {
            const epgFile = findDataFile(webDir, [
              'epg_cache.json',
              path.join('assets', 'epg_cache.json')
            ])
            const data = epgFile
              ? fs.readFileSync(epgFile)
              : Buffer.from('{}', 'utf-8')
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': data.length,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            })
            res.end(data)
            return
          }

          if (pathname === '/epg.xml' || pathname === '/epg_br.xml') {
            const xmlFile = findDataFile(webDir, ['epg.xml', 'epg_br.xml'])
            const data = xmlFile
              ? fs.readFileSync(xmlFile)
              : Buffer.from('<?xml version="1.0" encoding="UTF-8"?><tv></tv>', 'utf-8')
            res.writeHead(200, {
              'Content-Type': 'application/xml; charset=utf-8',
              'Content-Length': data.length,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            })
            res.end(data)
            return
          }

          if (pathname === '/api/crests') {
            const idxFile = findDataFile(webDir, [
              path.join('assets', 'logos', 'crests', 'crest_index.json')
            ])
            const data = idxFile
              ? fs.readFileSync(idxFile)
              : Buffer.from('{}', 'utf-8')
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': data.length,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600'
            })
            res.end(data)
            return
          }

          if (pathname === '/api/crest') {
            const team = query.get('team') || 'Clube'
            serveClubCrest(webDir, team, res)
            return
          }

          if (pathname === '/api/update/check') {
            const verFile = findDataFile(webDir, ['version.json'])
            let localVer = '2.4.8'
            let localBuild = 248
            let changelog: string[] = []
            if (verFile) {
              try {
                const vObj = JSON.parse(
                  fs.readFileSync(verFile, 'utf-8').replace(/^\uFEFF/, '').trim()
                )
                if (vObj.version) localVer = String(vObj.version)
                if (vObj.build_number) localBuild = Number(vObj.build_number) || 248
                if (Array.isArray(vObj.changelog)) changelog = vObj.changelog
              } catch {}
            }
            const body = Buffer.from(
              JSON.stringify({
                status: 'ok',
                mode: 'ghost_launcher_pc',
                update_available: false,
                local_version: localVer,
                local_build: localBuild,
                remote_version: localVer,
                remote_build: localBuild,
                changelog,
                repository: 'alazter/ghost-iptv',
                private_repo: true
              }),
              'utf-8'
            )
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': body.length,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            })
            res.end(body)
            return
          }

          if (pathname === '/api/update/apply' && req.method === 'POST') {
            import('./ghostIptvUpdate')
              .then(async (mod) => {
                const st = await mod.checkGhostIptvUpdates(false)
                if (st.updateAvailable && st.upstream) {
                  await mod.performGhostIptvInstall(st.upstream, st.installed)
                } else if (st.localDevAvailable) {
                  await mod.syncGhostIptvFromLocalDev()
                }
                const updated = mod.ghostIptvState()
                const parts = (updated.installed || '2.4.8')
                  .split('.')
                  .map((n) => parseInt(n, 10) || 0)
                const buildNum =
                  parts[0] * 100 + (parts[1] || 0) * 10 + (parts[2] || 0)
                const payload = Buffer.from(
                  JSON.stringify({
                    status: 'success',
                    version: updated.installed,
                    build_number: buildNum,
                    message:
                      updated.message ||
                      `Ghost IPTV atualizado para v${updated.installed}!`
                  }),
                  'utf-8'
                )
                res.writeHead(200, {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Content-Length': payload.length,
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'no-cache, no-store, must-revalidate'
                })
                res.end(payload)
              })
              .catch((err) => {
                const payload = Buffer.from(
                  JSON.stringify({
                    status: 'error',
                    message: err?.message || 'Erro ao atualizar Ghost IPTV'
                  }),
                  'utf-8'
                )
                res.writeHead(500, {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Content-Length': payload.length,
                  'Access-Control-Allow-Origin': '*'
                })
                res.end(payload)
              })
            return
          }

          if (pathname === '/api/addons') {
            const addonsFile =
              findDataFile(webDir, ['addons.json']) ||
              path.join(webDir, 'addons.json')
            if (req.method === 'GET') {
              const data = fs.existsSync(addonsFile)
                ? fs.readFileSync(addonsFile)
                : Buffer.from('[]', 'utf-8')
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': data.length,
                'Access-Control-Allow-Origin': '*'
              })
              res.end(data)
              return
            }
            if (req.method === 'POST') {
              let bodyStr = ''
              req.on('data', (chunk) => {
                bodyStr += chunk.toString()
              })
              req.on('end', () => {
                try {
                  const data = JSON.parse(bodyStr || '{}')
                  const existing = fs.existsSync(addonsFile)
                    ? JSON.parse(fs.readFileSync(addonsFile, 'utf-8'))
                    : []
                  const newAddon = {
                    id: `custom_${existing.length + 1}`,
                    name:
                      data.name || `Lista M3U / Addon ${existing.length + 1}`,
                    manifest_url: String(data.manifest_url || '').trim(),
                    enabled: true,
                    group_override: String(
                      data.group || 'Esportes Ao Vivo'
                    ).trim()
                  }
                  existing.push(newAddon)
                  fs.writeFileSync(
                    addonsFile,
                    JSON.stringify(existing, null, 2),
                    'utf-8'
                  )
                  const out = Buffer.from(
                    JSON.stringify({ status: 'success', addon: newAddon }),
                    'utf-8'
                  )
                  res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': out.length,
                    'Access-Control-Allow-Origin': '*'
                  })
                  res.end(out)
                } catch (err: any) {
                  res.writeHead(400, { 'Content-Type': 'text/plain' })
                  res.end(err?.message || 'Bad Request')
                }
              })
              return
            }
            if (req.method === 'DELETE') {
              const id = query.get('id') || ''
              if (fs.existsSync(addonsFile)) {
                try {
                  const existing = JSON.parse(
                    fs.readFileSync(addonsFile, 'utf-8')
                  )
                  const filtered = Array.isArray(existing)
                    ? existing.filter((a: any) => a?.id !== id)
                    : []
                  fs.writeFileSync(
                    addonsFile,
                    JSON.stringify(filtered, null, 2),
                    'utf-8'
                  )
                } catch {}
              }
              const out = Buffer.from(
                JSON.stringify({ status: 'success' }),
                'utf-8'
              )
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': out.length,
                'Access-Control-Allow-Origin': '*'
              })
              res.end(out)
              return
            }
          }

          if (pathname === '/api/refresh' && req.method === 'POST') {
            const out = Buffer.from(
              JSON.stringify({ status: 'success', channels_count: 68 }),
              'utf-8'
            )
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': out.length,
              'Access-Control-Allow-Origin': '*'
            })
            res.end(out)
            return
          }

          // 3. STATIC FILES & ASSETS
          const relPath =
            pathname === '/' ||
            pathname === '/index.html' ||
            pathname === '/app' ||
            pathname === '/tv'
              ? 'alazterflix_tv.html'
              : pathname.replace(/^\/+/, '')

          let filePath = path.join(webDir, relPath)
          if (!fs.existsSync(filePath) && relPath === 'version.json') {
            const parentVersion = path.join(webDir, '..', 'version.json')
            if (fs.existsSync(parentVersion)) filePath = parentVersion
          }

          // Fallback se procurar direto em /assets/
          if (!fs.existsSync(filePath) && pathname.startsWith('/assets/')) {
            const assetSub = pathname.substring(8)
            const candidateAsset =
              findDataFile(webDir, [
                path.join('assets', assetSub),
                assetSub
              ]) || path.join(webDir, 'assets', assetSub)
            filePath = candidateAsset
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            const contentType = MIME_TYPES[ext] || 'application/octet-stream'
            const isDynamicDoc =
              ext === '.html' ||
              ext === '.json' ||
              ext === '.xml' ||
              ext === '.m3u' ||
              ext === '.m3u8'
            res.writeHead(200, {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': isDynamicDoc
                ? 'no-cache, no-store, must-revalidate'
                : 'public, max-age=3600'
            })
            fs.createReadStream(filePath).pipe(res)
            return
          }

          res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          })
          res.end(`Not Found: ${pathname}`)
        })

        srv.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
            logInfo(
              `[GhostIptvServer] Porta ${candidatePort} ocupada, tentando próxima...`,
              LogPrefix.Backend
            )
            try {
              srv.close()
            } catch {}
            tryNextPort()
          } else {
            logError(
              ['[GhostIptvServer] Erro no servidor:', err],
              LogPrefix.Backend
            )
            serverStartingPromise = undefined
            reject(err)
          }
        })

        srv.listen(candidatePort, '127.0.0.1', () => {
          const addr = srv.address()
          if (typeof addr === 'object' && addr?.port) {
            activePort = addr.port
            activeServer = srv
            serverStartingPromise = undefined
            logInfo(
              `[GhostIptvServer] Servidor HLS e Assets ativo em http://127.0.0.1:${activePort}`,
              LogPrefix.Backend
            )
            resolve({
              port: activePort,
              url: getGhostIptvServerUrl()
            })
          } else {
            serverStartingPromise = undefined
            reject(
              new Error('Falha ao obter porta ativa para GhostIptvServer.')
            )
          }
        })
      }

      tryNextPort()
    }
  )

  return serverStartingPromise
}

export function stopGhostIptvServer(): void {
  if (activeServer) {
    try {
      activeServer.close()
    } catch {}
    activeServer = undefined
    serverStartingPromise = undefined
  }
}
