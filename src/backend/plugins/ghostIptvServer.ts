import http from 'node:http'
import https from 'node:https'
import fs from 'graceful-fs'
import path from 'node:path'
import { app } from 'electron'
import { logInfo, logError, LogPrefix } from 'backend/logger'

const DEFAULT_PORT = 8888
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'
const DEFAULT_REF = 'https://2910.playerembcanais.com'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
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

function resolveWebDirectory(): string {
  const candidates: string[] = []
  try {
    const devWeb = path.join(app.getAppPath(), 'plugins', 'ghost-iptv', 'web')
    candidates.push(devWeb)
  } catch {}

  try {
    const userWeb = path.join(
      app.getPath('userData'),
      'plugins',
      'com.ghost.iptv',
      'web'
    )
    candidates.push(userWeb)
  } catch {}

  const localDevWeb =
    'C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\App Tv addon stremio e m3u\\web'
  candidates.push(localDevWeb)

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'alazterflix_tv.html'))) {
      return dir
    }
  }

  return candidates[0] || path.resolve('plugins/ghost-iptv/web')
}

function proxyM3u8(
  targetUrl: string,
  baseUrl: string,
  res: http.ServerResponse
): void {
  try {
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
          return reject(new Error('Não foi possível iniciar servidor Ghost IPTV em nenhuma porta livre.'))
        }

        const candidatePort = portsToTry[portIndex++]
        const srv = http.createServer((req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
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

          // 1. PROXY HLS
          if (pathname === '/live' || pathname === '/sub.m3u8') {
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

            const targetUrl = `https://d1-ywppjexvlyulasvmgzjdftfjikth2210oq80soveui6lkbi2iza2zf.cdn10embed.xyz/${rawId}/index.m3u8`
            proxyM3u8(targetUrl, baseUrl, res)
            return
          }

          if (pathname === '/ts') {
            const targetUrl = query.get('url')
            if (targetUrl) {
              proxyTsSegment(targetUrl, res)
              return
            }
          }

          // 2. SERVER INFO
          if (pathname === '/api/server-info') {
            const body = JSON.stringify({
              status: 'online',
              port: activePort,
              url: baseUrl
            })
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            })
            res.end(body)
            return
          }

          // 3. STATIC FILES & ASSETS
          const webDir = resolveWebDirectory()
          let relPath =
            pathname === '/' || pathname === '/index.html' || pathname === '/app' || pathname === '/tv'
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
            filePath = path.join(webDir, 'assets', assetSub)
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            const contentType = MIME_TYPES[ext] || 'application/octet-stream'
            res.writeHead(200, {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600'
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
            reject(new Error('Falha ao obter porta ativa para GhostIptvServer.'))
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
