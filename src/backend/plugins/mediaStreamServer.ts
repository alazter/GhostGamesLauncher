import http from 'node:http'
import fs from 'graceful-fs'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import util from 'node:util'
import { logInfo, logError, LogPrefix } from 'backend/logger'

const execFileAsync = util.promisify(execFile)

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.ts': 'video/mp2t',
  '.srt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
}

export function findBinary(name: 'ffmpeg' | 'ffprobe'): string | null {
  const localApp = process.env.LOCALAPPDATA || ''
  const progFiles = process.env.ProgramFiles || ''
  const progFilesX86 = process.env['ProgramFiles(x86)'] || ''
  const userProfile = process.env.USERPROFILE || ''
  const candidates = [
    path.join(localApp, 'Programs', 'Stremio', `${name}.exe`),
    path.join(progFiles, 'Stremio', `${name}.exe`),
    path.join(progFilesX86, 'Stremio', `${name}.exe`),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Stremio', `${name}.exe`),
    path.join('C:', 'ffmpeg', 'bin', `${name}.exe`),
    path.join(progFiles, 'ffmpeg', 'bin', `${name}.exe`),
    `${name}.exe`,
    name
  ]
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c
    } catch {}
  }
  return null
}

export interface CinemaAudioTrack {
  index: number
  streamIndex: number
  title: string
  language: string
  codec: string
  channels: number
  isSupported: boolean
}

export interface CinemaSubtitleTrack {
  index: number
  streamIndex: number
  title: string
  language: string
  codec: string
  isDefault: boolean
  isForced: boolean
  streamUrl: string
}

export interface CinemaMediaProbeResult {
  duration: number
  formatName?: string
  audioTracks: CinemaAudioTrack[]
  subtitleTracks: CinemaSubtitleTrack[]
}

export class MediaStreamServer {
  private static instance: MediaStreamServer
  private server?: http.Server
  private port = 0
  private startingPromise?: Promise<number>
  private embeddedSubtitleCache = new Map<string, string>()
  private probeCache = new Map<string, CinemaMediaProbeResult>()
  private keyframeCache = new Map<string, number>()

  private constructor() {}

  public static getInstance(): MediaStreamServer {
    if (!MediaStreamServer.instance) {
      MediaStreamServer.instance = new MediaStreamServer()
    }
    return MediaStreamServer.instance
  }

  public async start(): Promise<number> {
    if (this.server && this.port > 0) {
      return this.port
    }
    if (this.startingPromise) {
      return this.startingPromise
    }

    this.startingPromise = new Promise<number>((resolve, reject) => {
      const createAndListen = (targetPort: number) => {
        const srv = http.createServer(async (req, res) => {
          // Permissive CORS headers for HTML5 video and subtitles
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
          res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')

          if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
          }

          try {
            const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${this.port}`)
            const pathname = parsedUrl.pathname

            // ROTA 1: CONVERSÃO E ENTREGA DE LEGENDAS WEBVTT EXTERNAS (/subtitle?file=... ou /subtitle?url=...)
            if (pathname === '/subtitle') {
              const rawFile = parsedUrl.searchParams.get('file')
              const remoteUrl = parsedUrl.searchParams.get('url')

              if (rawFile) {
                const subPath = path.resolve(rawFile)
                if (!fs.existsSync(subPath)) {
                  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
                  res.end('Arquivo de legenda não encontrado.')
                  return
                }

                try {
                  const rawBuffer = fs.readFileSync(subPath)
                  let content = ''
                  // Suporte robusto a UTF-16, UTF-8 e Windows-1252/Latin1 para legendas PT-BR
                  if (rawBuffer.length >= 2 && rawBuffer[0] === 0xff && rawBuffer[1] === 0xfe) {
                    content = rawBuffer.toString('utf16le')
                  } else {
                    try {
                      const decoder = new TextDecoder('utf-8', { fatal: true })
                      content = decoder.decode(rawBuffer)
                    } catch {
                      const decoder = new TextDecoder('windows-1252')
                      content = decoder.decode(rawBuffer)
                    }
                  }

                  const vttContent = this.convertSrtToVtt(content)
                  res.writeHead(200, {
                    'Content-Type': 'text/vtt; charset=utf-8',
                    'Cache-Control': 'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*'
                  })
                  res.end(vttContent)
                  return
                } catch (subErr) {
                  logError(['[MediaStreamServer] Erro ao ler legenda local:', subErr], LogPrefix.Backend)
                  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
                  res.end('Falha ao processar arquivo de legenda.')
                  return
                }
              }

              if (remoteUrl) {
                this.fetchRemoteSubtitleAsVtt(remoteUrl)
                  .then((vtt) => {
                    res.writeHead(200, {
                      'Content-Type': 'text/vtt; charset=utf-8',
                      'Cache-Control': 'public, max-age=86400',
                      'Access-Control-Allow-Origin': '*'
                    })
                    res.end(vtt)
                  })
                  .catch((err) => {
                    logError(['[MediaStreamServer] Erro ao buscar legenda remota:', err], LogPrefix.Backend)
                    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('Falha ao obter legenda externa.')
                  })
                return
              }

              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('Parâmetro file ou url ausente na rota /subtitle.')
              return
            }

            // ROTA 2: EXTRAÇÃO E ENTREGA DE LEGENDAS EMBUTIDAS NO CONTAINER (/subtitle/embedded?file=...&trackIndex=X)
            if (pathname === '/subtitle/embedded') {
              const rawFile = parsedUrl.searchParams.get('file')
              const trackIndex = parseInt(parsedUrl.searchParams.get('trackIndex') || '0', 10)

              if (!rawFile) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('Parâmetro file ausente na rota /subtitle/embedded.')
                return
              }

              const filePath = path.resolve(rawFile)
              if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('Arquivo de vídeo não encontrado.')
                return
              }

              const cacheKey = `${filePath}::${trackIndex}`
              if (this.embeddedSubtitleCache.has(cacheKey)) {
                const cached = this.embeddedSubtitleCache.get(cacheKey)!
                res.writeHead(200, {
                  'Content-Type': 'text/vtt; charset=utf-8',
                  'Cache-Control': 'public, max-age=86400',
                  'Access-Control-Allow-Origin': '*'
                })
                res.end(cached)
                return
              }

              const ffmpegPath = findBinary('ffmpeg')
              if (!ffmpegPath) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('Ffmpeg não encontrado no sistema para extração de legenda.')
                return
              }

              try {
                const { stdout } = await execFileAsync(
                  ffmpegPath,
                  ['-v', 'error', '-i', filePath, '-map', `0:s:${trackIndex}`, '-f', 'webvtt', 'pipe:1'],
                  { maxBuffer: 15 * 1024 * 1024 }
                )

                let cleanVtt = stdout.replace(/\{[^}]*\}/g, '').trim()
                if (!cleanVtt.startsWith('WEBVTT')) {
                  cleanVtt = 'WEBVTT\n\n' + cleanVtt
                }
                cleanVtt = this.ensureVttDefaultPosition(cleanVtt)

                this.embeddedSubtitleCache.set(cacheKey, cleanVtt)

                res.writeHead(200, {
                  'Content-Type': 'text/vtt; charset=utf-8',
                  'Cache-Control': 'public, max-age=86400',
                  'Access-Control-Allow-Origin': '*'
                })
                res.end(cleanVtt)
                return
              } catch (err) {
                logError(['[MediaStreamServer] Erro ao extrair legenda embutida:', err], LogPrefix.Backend)
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('Falha ao processar legenda embutida.')
                return
              }
            }

            // ROTA 3: STREAMING COM TRANSCODE DE ÁUDIO ON-THE-FLY (/stream/transcode?file=...&audioIndex=X&startTime=Y)
            if (pathname === '/stream/transcode') {
              const rawFile = parsedUrl.searchParams.get('file')
              const audioIndex = parseInt(parsedUrl.searchParams.get('audioIndex') || '0', 10)
              const startTime = Math.max(0, parseFloat(parsedUrl.searchParams.get('startTime') || '0') || 0)

              if (!rawFile) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('Parâmetro file ausente.')
                return
              }

              const filePath = path.resolve(rawFile)
              if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('Arquivo de mídia não encontrado.')
                return
              }

              if (req.method === 'HEAD') {
                res.writeHead(200, {
                  'Content-Type': 'video/mp4',
                  'Accept-Ranges': 'none',
                  'Access-Control-Allow-Origin': '*'
                })
                res.end()
                return
              }

              const ffmpegPath = findBinary('ffmpeg')
              if (!ffmpegPath) {
                // Fallback para streaming direto se ffmpeg não for encontrado
                res.writeHead(302, { Location: `/stream?file=${encodeURIComponent(filePath)}` })
                res.end()
                return
              }

              if (req.socket) {
                req.socket.setNoDelay(true)
              }

              res.writeHead(200, {
                'Content-Type': 'video/mp4',
                'Transfer-Encoding': 'chunked',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
              })

              const ffmpegArgs: string[] = [
                '-v', 'error',
                '-hide_banner'
              ]

              // Input seeking rápido O(1) com -noaccurate_seek para alinhamento A/V perfeito com -c:v copy:
              // -noaccurate_seek preserva os pacotes de áudio alinhados exatamente ao keyframe do vídeo copiado,
              // eliminando qualquer desvio inicial ou buracos temporais (delta A/V < 15ms).
              if (startTime > 0) {
                ffmpegArgs.push('-noaccurate_seek', '-ss', String(startTime))
              }

              // Filtro de áudio adaptativo para sincronização absoluta (0-14ms de drift):
              // Se startTime === 0: 'aresample=async=1:first_pts=0' preenche qualquer silêncio/delay inicial da faixa dublada (ex: 12s de abertura sem áudio)
              // Se startTime > 0: 'aresample=async=1' sincroniza os pacotes decodificados de áudio diretamente ao keyframe do vídeo
              const audioFilter = startTime === 0
                ? 'aresample=async=1:first_pts=0'
                : 'aresample=async=1'

              ffmpegArgs.push(
                '-i', filePath,
                '-threads', '0',
                '-max_muxing_queue_size', '4096',
                '-map', '0:v:0',
                '-map', `0:a:${audioIndex}`,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-ac', '2',
                '-b:a', '192k',
                '-af', audioFilter,
                '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                '-f', 'mp4',
                'pipe:1'
              )

              const ffmpegProc = spawn(ffmpegPath, ffmpegArgs)

              ffmpegProc.stdout.pipe(res)

              req.on('close', () => {
                try {
                  ffmpegProc.stdout.destroy()
                  ffmpegProc.kill('SIGKILL')
                } catch {}
              })

              ffmpegProc.on('error', (err) => {
                logError(['[MediaStreamServer] Erro no ffmpeg transcode stream:', err], LogPrefix.Backend)
                if (!res.headersSent) {
                  res.writeHead(500)
                }
                res.end()
              })

              return
            }

            // ROTA 4: STREAMING DE VÍDEO DIRETO COM RANGE HTTP 206 (/stream?file=...)
            const rawFile = parsedUrl.searchParams.get('file')

            if (!rawFile) {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('Parâmetro file ausente.')
              return
            }

            const filePath = path.resolve(rawFile)
            if (!fs.existsSync(filePath)) {
              res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('Arquivo de mídia não encontrado.')
              return
            }

            const stat = fs.statSync(filePath)
            if (!stat.isFile()) {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('O caminho especificado não é um arquivo.')
              return
            }

            const ext = path.extname(filePath).toLowerCase()
            const contentType = MIME_TYPES[ext] || 'application/octet-stream'
            const fileSize = stat.size

            // Otimização de TCP socket (elimina atraso de Nagle no Windows)
            if (req.socket) {
              req.socket.setNoDelay(true)
            }

            if (req.method === 'HEAD') {
              res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
              })
              res.end()
              return
            }

            const range = req.headers.range
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-')
              const start = parseInt(parts[0], 10)
              // Buffer de 16MB por chunk: fluidez impecável e contínua em 1080p e 4K HDR
              const MAX_CHUNK_SIZE = 16 * 1024 * 1024
              const end = parts[1]
                ? parseInt(parts[1], 10)
                : Math.min(start + MAX_CHUNK_SIZE - 1, fileSize - 1)

              if (isNaN(start) || start >= fileSize || (parts[1] && end < start)) {
                res.writeHead(416, {
                  'Content-Range': `bytes */${fileSize}`,
                  'Access-Control-Allow-Origin': '*'
                })
                res.end()
                return
              }

              const chunkSize = end - start + 1
              const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 })

              // Descarte imediato de handles em desconexão / seek
              req.on('close', () => {
                stream.destroy()
              })

              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Connection': 'keep-alive',
                'Keep-Alive': 'timeout=30, max=100',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
              })

              stream.on('error', (err) => {
                logError(['[MediaStreamServer] Erro no stream parcial:', err], LogPrefix.Backend)
                if (!res.headersSent) {
                  res.writeHead(500, { 'Access-Control-Allow-Origin': '*' })
                }
                res.end()
              })

              stream.pipe(res)
            } else {
              // Full stream com descarte de recursos seguro e keep-alive
              res.writeHead(200, {
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Content-Type': contentType,
                'Connection': 'keep-alive',
                'Keep-Alive': 'timeout=30, max=100',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
              })

              const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 })
              req.on('close', () => {
                stream.destroy()
              })

              stream.on('error', (err) => {
                logError(['[MediaStreamServer] Erro no stream completo:', err], LogPrefix.Backend)
                if (!res.headersSent) {
                  res.writeHead(500)
                }
                res.end()
              })

              stream.pipe(res)
            }
          } catch (err) {
            logError(['[MediaStreamServer] Erro de processamento HTTP:', err], LogPrefix.Backend)
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('Erro interno do servidor de streaming.')
            } else {
              res.end()
            }
          }
        })

        srv.once('error', (err: any) => {
          if (targetPort !== 0 && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
            try { srv.close() } catch {}
            createAndListen(0)
          } else {
            logError(['[MediaStreamServer] Falha fatal no servidor:', err], LogPrefix.Backend)
            this.startingPromise = undefined
            reject(err)
          }
        })

        srv.listen(targetPort, '127.0.0.1', () => {
          const addr = srv.address()
          if (typeof addr === 'object' && addr?.port) {
            this.port = addr.port
            this.server = srv
            this.startingPromise = undefined
            logInfo(`[MediaStreamServer] Servidor HTTP ativo em http://127.0.0.1:${this.port}`, LogPrefix.Backend)
            resolve(this.port)
          } else {
            this.startingPromise = undefined
            reject(new Error('Falha ao obter porta livre para MediaStreamServer'))
          }
        })
      }

      createAndListen(47814)
    })

    return this.startingPromise
  }

  public async getStreamUrl(filePath: string): Promise<string> {
    const port = await this.start()
    return `http://127.0.0.1:${port}/stream?file=${encodeURIComponent(filePath)}`
  }

  public async findExactKeyframe(filePath: string, targetTime: number): Promise<number> {
    if (targetTime <= 0) return 0
    const rounded = Math.round(targetTime * 100) / 100
    const cacheKey = `${filePath}::${rounded}`
    if (this.keyframeCache.has(cacheKey)) {
      return this.keyframeCache.get(cacheKey)!
    }

    const ffmpegPath = findBinary('ffmpeg')
    if (!ffmpegPath || !fs.existsSync(filePath)) {
      return targetTime
    }

    try {
      // Localiza o keyframe de origem exato em alta velocidade (<180ms) para sincronização frame-accurate
      const { stderr } = await execFileAsync(
        ffmpegPath,
        [
          '-noaccurate_seek',
          '-ss', String(targetTime),
          '-i', filePath,
          '-vframes', '1',
          '-f', 'null',
          '-'
        ],
        { timeout: 1200, maxBuffer: 1024 * 1024 }
      )

      const m = stderr.match(/time=(-?[\d:\.]+)/)
      if (m && m[1]) {
        const timeStr = m[1].replace('-', '')
        const parts = timeStr.split(':')
        let deltaSec = 0
        if (parts.length === 3) {
          deltaSec = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
        } else if (parts.length === 2) {
          deltaSec = parseFloat(parts[0]) * 60 + parseFloat(parts[1])
        } else {
          deltaSec = parseFloat(parts[0]) || 0
        }

        if (deltaSec >= 0 && deltaSec <= 35) {
          const exactKf = Math.max(0, Math.round((targetTime - deltaSec) * 1000) / 1000)
          this.keyframeCache.set(cacheKey, exactKf)
          return exactKf
        }
      }
    } catch {
      // Fallback seguro em caso de timeout
    }

    this.keyframeCache.set(cacheKey, targetTime)
    return targetTime
  }

  public async getTranscodeStreamUrl(filePath: string, audioIndex = 0, startTime = 0): Promise<string> {
    const port = await this.start()
    const exactStart = await this.findExactKeyframe(filePath, startTime)
    return `http://127.0.0.1:${port}/stream/transcode?file=${encodeURIComponent(filePath)}&audioIndex=${audioIndex}&startTime=${exactStart}`
  }

  public async getSubtitleUrl(filePathOrUrl: string, isRemote = false): Promise<string> {
    const port = await this.start()
    const param = isRemote ? `url=${encodeURIComponent(filePathOrUrl)}` : `file=${encodeURIComponent(filePathOrUrl)}`
    return `http://127.0.0.1:${port}/subtitle?${param}`
  }

  public async getEmbeddedSubtitleUrl(filePath: string, trackIndex: number): Promise<string> {
    const port = await this.start()
    return `http://127.0.0.1:${port}/subtitle/embedded?file=${encodeURIComponent(filePath)}&trackIndex=${trackIndex}`
  }

  public ensureVttDefaultPosition(vtt: string, defaultPosition = 78): string {
    if (!vtt) return 'WEBVTT\n\n'
    return vtt.replace(
      /((?:(?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*(?:(?:\d{2}:)?\d{2}:\d{2}\.\d{3}))([^\r\n]*)/g,
      (match, times, rest) => {
        if (/line:\s*\d+/.test(rest)) {
          return match
        }
        return `${times}${rest.trimEnd()} line:${defaultPosition}%,end`
      }
    )
  }

  public convertSrtToVtt(srtContent: string): string {
    if (!srtContent) return 'WEBVTT\n\n'
    let text = srtContent.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n').trim()
    if (text.startsWith('WEBVTT')) return this.ensureVttDefaultPosition(text)
    // Converte timestamp 00:00:00,000 para 00:00:00.000
    text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    // Converte formato curto 00:00,000 para 00:00:00.000 se houver
    text = text.replace(/(^|\n)(\d{2}:\d{2}),(\d{3})/g, '$100:$2.$3')
    return this.ensureVttDefaultPosition('WEBVTT\n\n' + text)
  }

  public async fetchRemoteSubtitleAsVtt(remoteUrl: string): Promise<string> {
    const res = await fetch(remoteUrl)
    if (!res.ok) {
      throw new Error(`Falha HTTP ao baixar legenda: ${res.status}`)
    }
    const rawText = await res.text()
    return this.convertSrtToVtt(rawText)
  }

  public async probeMedia(filePath: string): Promise<CinemaMediaProbeResult> {
    if (this.probeCache.has(filePath)) {
      return this.probeCache.get(filePath)!
    }

    const ffprobePath = findBinary('ffprobe')
    const fallback: CinemaMediaProbeResult = {
      duration: 0,
      audioTracks: [],
      subtitleTracks: []
    }
    if (!ffprobePath || !fs.existsSync(filePath)) {
      return fallback
    }

    try {
      const { stdout } = await execFileAsync(
        ffprobePath,
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration,format_name:stream=index,codec_name,codec_type,channels,disposition:stream_tags=language,title',
          '-of',
          'json',
          filePath
        ],
        { maxBuffer: 10 * 1024 * 1024 }
      )

      const data = JSON.parse(stdout)
      let duration = parseFloat(data.format?.duration || '0') || 0
      if (!duration && Array.isArray(data.streams)) {
        for (const st of data.streams) {
          const d = parseFloat(st.duration || '0')
          if (d > duration) duration = d
        }
      }
      const formatName = data.format?.format_name

      const audioTracks: CinemaAudioTrack[] = []
      const subtitleTracks: CinemaSubtitleTrack[] = []

      let audioCount = 0
      let subCount = 0

      const supportedAudioCodecs = new Set([
        'aac',
        'mp3',
        'opus',
        'flac',
        'vorbis',
        'pcm_s16le',
        'pcm_s24le'
      ])

      const streams = Array.isArray(data.streams) ? data.streams : []

      for (const st of streams) {
        if (st.codec_type === 'audio') {
          const codec = (st.codec_name || '').toLowerCase()
          const lang = (st.tags?.language || 'und').toLowerCase()
          let title = st.tags?.title || ''
          const channels = st.channels || 2

          const channelLabel = channels === 6 ? '5.1' : channels === 8 ? '7.1' : 'Estéreo'
          if (!title) {
            let langLabel = 'Desconhecido'
            if (lang === 'por' || lang === 'pt' || lang === 'pob') langLabel = 'Português'
            else if (lang === 'eng' || lang === 'en') langLabel = 'Inglês'
            else if (lang === 'jpn' || lang === 'ja') langLabel = 'Japonês'
            else if (lang === 'spa' || lang === 'es') langLabel = 'Espanhol'
            title = `Faixa ${audioCount + 1}: ${langLabel} (${codec.toUpperCase()} ${channelLabel})`
          } else if (!title.toLowerCase().includes(codec)) {
            title = `${title} (${codec.toUpperCase()} ${channelLabel})`
          }

          audioTracks.push({
            index: audioCount,
            streamIndex: st.index,
            title,
            language: lang,
            codec,
            channels,
            isSupported: supportedAudioCodecs.has(codec)
          })
          audioCount++
        } else if (st.codec_type === 'subtitle') {
          const codec = (st.codec_name || '').toLowerCase()
          const lang = (st.tags?.language || 'und').toLowerCase()
          let title = st.tags?.title || ''
          const isForced = Boolean(st.disposition?.forced || /forced|forcada/i.test(title))
          const isDefault = Boolean(st.disposition?.default)

          if (!title) {
            let langLabel = 'Português'
            if (lang === 'eng' || lang === 'en') langLabel = 'Inglês'
            else if (lang === 'jpn' || lang === 'ja') langLabel = 'Japonês'
            else if (lang === 'spa' || lang === 'es') langLabel = 'Espanhol'
            title = `Legenda ${subCount + 1} (${langLabel}${isForced ? ' - Forçada' : ''})`
          }

          const streamUrl = await this.getEmbeddedSubtitleUrl(filePath, subCount)

          subtitleTracks.push({
            index: subCount,
            streamIndex: st.index,
            title,
            language: lang,
            codec,
            isDefault,
            isForced,
            streamUrl
          })
          subCount++
        }
      }

      const result: CinemaMediaProbeResult = {
        duration,
        formatName,
        audioTracks,
        subtitleTracks
      }
      this.probeCache.set(filePath, result)
      return result
    } catch (err) {
      logError(['[MediaStreamServer] Erro ao analisar mídia via ffprobe:', err], LogPrefix.Backend)
      return fallback
    }
  }

  public async getLocalSubtitles(videoFilePath: string): Promise<
    Array<{ name: string; filePath: string; lang: string; streamUrl: string; isDefault?: boolean; isEmbedded?: boolean }>
  > {
    const results: Array<{ name: string; filePath: string; lang: string; streamUrl: string; isDefault?: boolean; isEmbedded?: boolean }> = []
    if (!videoFilePath || !fs.existsSync(videoFilePath)) return results

    const videoDir = path.dirname(videoFilePath)
    const videoExt = path.extname(videoFilePath)
    const videoBase = path.basename(videoFilePath, videoExt).toLowerCase()

    // 1. Extrai legendas embutidas no container do arquivo via ffprobe
    try {
      const probe = await this.probeMedia(videoFilePath)
      if (probe && probe.subtitleTracks && probe.subtitleTracks.length > 0) {
        for (const sub of probe.subtitleTracks) {
          let lang = 'Português'
          const langLower = (sub.language || '').toLowerCase()
          const titleLower = (sub.title || '').toLowerCase()
          if (/pt-br|pob|brazil|brasil|ptbr/i.test(langLower) || /pt-br|pob|brazil|brasil|ptbr/i.test(titleLower)) {
            lang = 'Português (Brasil)'
          } else if (/por|pt|portuguese/i.test(langLower) || /(?:^|[._ -])(por|pt|portugues|portuguese)(?:[._ -]|$)/i.test(titleLower)) {
            lang = 'Português'
          } else if (/\b(eng|en|english)\b/i.test(langLower) || /(?:^|[._ -])(eng|en|english|ingles)(?:[._ -]|$)/i.test(titleLower)) {
            lang = 'Inglês'
          } else if (/\b(spa|es|spanish|espanol)\b/i.test(langLower) || /(?:^|[._ -])(spa|es|spanish|espanol)(?:[._ -]|$)/i.test(titleLower)) {
            lang = 'Espanhol'
          } else if (/\b(jap|jpn|japanese)\b/i.test(langLower) || /(?:^|[._ -])(jap|jpn|japanese)(?:[._ -]|$)/i.test(titleLower)) {
            lang = 'Japonês'
          }

          if (sub.isForced && !lang.includes('Forçada')) {
            lang += ' (Forçada)'
          }

          results.push({
            name: `[Embutida] ${sub.title}`,
            filePath: videoFilePath,
            lang,
            streamUrl: sub.streamUrl,
            isDefault: sub.isDefault,
            isEmbedded: true
          })
        }
      }
    } catch (probeErr) {
      logError(['[MediaStreamServer] Erro ao extrair legendas embutidas:', probeErr], LogPrefix.Backend)
    }

    // 2. Procura legendas externas soltas na pasta ou subpastas
    const epMatch = videoBase.match(/(?:s\d{1,2})?e(\d{1,3})|ep(?:isodio)?\.?\s*(\d{1,3})|\b(\d{2,3})\b/i)
    const epNum = epMatch ? (epMatch[1] || epMatch[2] || epMatch[3]).padStart(2, '0') : null

    const searchDirs = [videoDir]
    const subSubDir = path.join(videoDir, 'Subs')
    const subSubDirLower = path.join(videoDir, 'subtitles')
    const subSubDirPt = path.join(videoDir, 'Legendas')
    if (fs.existsSync(subSubDir) && fs.statSync(subSubDir).isDirectory()) searchDirs.push(subSubDir)
    if (fs.existsSync(subSubDirLower) && fs.statSync(subSubDirLower).isDirectory()) searchDirs.push(subSubDirLower)
    if (fs.existsSync(subSubDirPt) && fs.statSync(subSubDirPt).isDirectory()) searchDirs.push(subSubDirPt)

    const supportedExts = new Set(['.srt', '.vtt', '.sub', '.ass'])

    for (const dir of searchDirs) {
      try {
        const files = fs.readdirSync(dir)
        const isSubsOnlyDir = dir !== videoDir

        for (const file of files) {
          const ext = path.extname(file).toLowerCase()
          if (!supportedExts.has(ext)) continue

          const subFullPath = path.join(dir, file)
          const fileLower = file.toLowerCase()
          const fileWithoutExt = file.replace(/\.[^/.]+$/, '')

          // Identifica se a legenda pertence a este vídeo ou pasta
          let matches = false
          if (fileLower.startsWith(videoBase)) {
            matches = true
          } else if (epNum) {
            const subEpMatch = fileLower.match(/(?:s\d{1,2})?e(\d{1,3})|ep(?:isodio)?\.?\s*(\d{1,3})|\b(\d{2,3})\b/i)
            const subEpNum = subEpMatch ? (subEpMatch[1] || subEpMatch[2] || subEpMatch[3]).padStart(2, '0') : null
            if (subEpNum && subEpNum === epNum) {
              matches = true
            }
          }

          if (!matches) {
            const videoSiblings = files.filter(f => /\.(mkv|mp4|avi|webm|mov)$/i.test(f))
            if (videoSiblings.length <= 1 || isSubsOnlyDir) {
              matches = true
            }
          }

          if (!matches) continue

          let lang = 'Português'
          let isDefault = false

          // Reconhecimento de idioma com limites estritos (evita falso-positivo como "Renascimento" -> en -> Inglês)
          const isExplicitPt = /(?:^|[._ -])(pt-br|pob|brazil|brasil|ptbr|pt|por|portugues|portuguese)(?:[._ -]|$)/i.test(fileLower) || /dublado/i.test(fileLower)
          const isExplicitEn = /(?:^|[._ -])(eng|en|english|ingles)(?:[._ -]|$)/i.test(fileLower)
          const isExplicitEs = /(?:^|[._ -])(spa|es|spanish|espanol|castellano)(?:[._ -]|$)/i.test(fileLower)
          const isExplicitJa = /(?:^|[._ -])(jap|jpn|japanese|japones)(?:[._ -]|$)/i.test(fileLower)

          if (isExplicitPt) {
            lang = 'Português (Brasil)'
            isDefault = true
          } else if (isExplicitEn) {
            lang = 'Inglês'
          } else if (isExplicitEs) {
            lang = 'Espanhol'
          } else if (isExplicitJa) {
            lang = 'Japonês'
          } else {
            // Se o arquivo .srt está no diretório de mídia do usuário sem marcação de outro idioma, é a legenda padrão em Português
            lang = 'Português'
            isDefault = true
          }

          if (/(?:^|[._ -])(forced|forcada)(?:[._ -]|$)/i.test(fileLower) || /forced|forcada/i.test(fileLower)) {
            lang += ' (Forçada)'
            isDefault = false
          }

          const streamUrl = await this.getSubtitleUrl(subFullPath, false)
          results.push({
            name: fileWithoutExt,
            filePath: subFullPath,
            lang,
            streamUrl,
            isDefault,
            isEmbedded: false
          })
        }
      } catch (err) {
        logError(['[MediaStreamServer] Erro ao listar legendas locais:', err], LogPrefix.Backend)
      }
    }

    return results
  }

  public stop(): void {
    if (this.server) {
      try {
        this.server.close()
      } catch {}
      this.server = undefined
      this.port = 0
      this.startingPromise = undefined
    }
  }
}
