import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import http from 'http'
import https from 'https'
import { userDataPath } from 'backend/constants/paths'
import { logInfo, logError, LogPrefix } from 'backend/logger'

export interface CinemaDownloadDirectories {
  moviesDir?: string
  seriesDir?: string
  animesDir?: string
  autoOrganize?: boolean
}

export interface CinemaDownloadTask {
  id: string
  title: string
  targetPath: string
  bytesDownloaded: number
  totalBytes: number
  progressPercent: number
  status: 'downloading' | 'completed' | 'error' | 'canceled'
  speedBytesPerSec?: number
  startTime: number
  error?: string
}

export interface SaveMediaPayload {
  streamUrl: string
  magnetUrl?: string
  type: 'movie' | 'series' | 'anime'
  title: string
  year?: string
  season?: number
  episode?: number
  episodeTitle?: string
  posterUrl?: string
  backdropUrl?: string
  overview?: string
  rating?: number
  genres?: string[]
  targetDir?: string
}

const CONFIG_FILE = join(userDataPath, 'cinema_download_directories.json')

export function getCinemaDownloadDirectories(): CinemaDownloadDirectories {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    logError(LogPrefix.General, `Erro ao carregar diretórios de download do Cinema: ${err}`)
  }
  return {
    autoOrganize: true
  }
}

export function setCinemaDownloadDirectories(
  dirs: Partial<CinemaDownloadDirectories>
): CinemaDownloadDirectories {
  const current = getCinemaDownloadDirectories()
  const updated = { ...current, ...dirs }
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  } catch (err) {
    logError(LogPrefix.General, `Erro ao salvar diretórios de download do Cinema: ${err}`)
  }
  return updated
}

const activeTasks = new Map<string, CinemaDownloadTask>()
const abortControllers = new Map<string, AbortController>()

export function getActiveCinemaDownloads(): CinemaDownloadTask[] {
  return Array.from(activeTasks.values())
}

export function cancelCinemaDownload(id: string): boolean {
  const controller = abortControllers.get(id)
  if (controller) {
    controller.abort()
    abortControllers.delete(id)
    const task = activeTasks.get(id)
    if (task) {
      task.status = 'canceled'
    }
    return true
  }
  return false
}

function sanitizePathPart(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').trim()
}

/**
 * Builds the canonical organized folder and file structure on the user's hard drive
 */
export function buildMediaDestinationPath(
  baseDir: string,
  payload: SaveMediaPayload
): { folderPath: string; filePath: string } {
  const cleanTitle = sanitizePathPart(payload.title)
  const ext = '.mkv'

  if (payload.type === 'movie') {
    const folderName = payload.year ? `${cleanTitle} (${payload.year})` : cleanTitle
    const fileName = `${folderName}${ext}`
    const folderPath = join(baseDir, folderName)
    return {
      folderPath,
      filePath: join(folderPath, fileName)
    }
  }

  // Series or Anime
  const seasonNum = payload.season || 1
  const epNum = payload.episode || 1
  const sTag = String(seasonNum).padStart(2, '0')
  const eTag = String(epNum).padStart(2, '0')
  const epTitle = payload.episodeTitle ? ` - ${sanitizePathPart(payload.episodeTitle)}` : ''
  const fileName = `${cleanTitle} - S${sTag}E${eTag}${epTitle}${ext}`
  const folderPath = join(baseDir, cleanTitle, `Temporada ${seasonNum}`)

  return {
    folderPath,
    filePath: join(folderPath, fileName)
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Searches for a downloaded or local media file matching title, season, and episode on disk
 */
export function findLocalMediaFile(payload: {
  title: string
  season?: number
  episode?: number
  year?: string
  type?: 'movie' | 'series' | 'anime'
}): {
  exists: boolean
  filePath?: string
  fileName?: string
  fileSize?: string
  fileSizeBytes?: number
  resolution?: string
} {
  try {
    const dirs = getCinemaDownloadDirectories()
    const mediaType = payload.type || (payload.season !== undefined ? 'series' : 'movie')
    const candidateDirs = [
      dirs.seriesDir,
      dirs.animesDir,
      dirs.moviesDir
    ].filter((d): d is string => Boolean(d && existsSync(d)))

    if (candidateDirs.length === 0) {
      return { exists: false }
    }

    const videoExts = ['.mkv', '.mp4', '.avi', '.mov', '.ts', '.webm', '.m4v']
    const cleanTitle = sanitizePathPart(payload.title)
    const seasonNum = payload.season !== undefined ? payload.season : 1
    const epNum = payload.episode !== undefined ? payload.episode : 1
    const sTag = String(seasonNum).padStart(2, '0')
    const eTag = String(epNum).padStart(2, '0')

    for (const baseDir of candidateDirs) {
      // 1. Direct path check from buildMediaDestinationPath
      const { folderPath, filePath } = buildMediaDestinationPath(baseDir, {
        title: payload.title,
        season: payload.season,
        episode: payload.episode,
        year: payload.year,
        type: mediaType,
        streamUrl: ''
      })

      if (existsSync(filePath)) {
        const stats = statSync(filePath)
        return {
          exists: true,
          filePath,
          fileName: basename(filePath),
          fileSizeBytes: stats.size,
          fileSize: formatBytes(stats.size)
        }
      }

      // 2. Folder scan if folderPath exists
      if (existsSync(folderPath)) {
        const files = readdirSync(folderPath)
        const epPattern = new RegExp(
          `(?:s0*${seasonNum}[._-]?e0*${epNum}|s${sTag}e${eTag}|${seasonNum}x0*${epNum})`,
          'i'
        )
        for (const file of files) {
          const ext = extname(file).toLowerCase()
          if (videoExts.includes(ext)) {
            if (mediaType === 'movie' || epPattern.test(file)) {
              const full = join(folderPath, file)
              const stats = statSync(full)
              return {
                exists: true,
                filePath: full,
                fileName: file,
                fileSizeBytes: stats.size,
                fileSize: formatBytes(stats.size)
              }
            }
          }
        }
      }

      // 3. Scan series folder directly (e.g. baseDir/cleanTitle/)
      const showDir = join(baseDir, cleanTitle)
      if (existsSync(showDir)) {
        const subItems = readdirSync(showDir)
        for (const item of subItems) {
          const fullItem = join(showDir, item)
          try {
            const isDir = statSync(fullItem).isDirectory()
            if (isDir) {
              const sMatch = item.match(/(?:temporada|season|temp|s)\s*0*(\d+)/i)
              if (!sMatch || parseInt(sMatch[1], 10) === seasonNum) {
                const subFiles = readdirSync(fullItem)
                for (const sf of subFiles) {
                  const ext = extname(sf).toLowerCase()
                  if (videoExts.includes(ext)) {
                    const epMatch = sf.match(
                      new RegExp(`(?:s0*${seasonNum}[._-]?e0*${epNum}|s${sTag}e${eTag}|${seasonNum}x0*${epNum})`, 'i')
                    )
                    if (epMatch) {
                      const stats = statSync(join(fullItem, sf))
                      return {
                        exists: true,
                        filePath: join(fullItem, sf),
                        fileName: sf,
                        fileSizeBytes: stats.size,
                        fileSize: formatBytes(stats.size)
                      }
                    }
                  }
                }
              }
            } else {
              const ext = extname(item).toLowerCase()
              if (videoExts.includes(ext)) {
                const epMatch = item.match(
                  new RegExp(`(?:s0*${seasonNum}[._-]?e0*${epNum}|s${sTag}e${eTag}|${seasonNum}x0*${epNum})`, 'i')
                )
                if (epMatch || mediaType === 'movie') {
                  const stats = statSync(fullItem)
                  return {
                    exists: true,
                    filePath: fullItem,
                    fileName: item,
                    fileSizeBytes: stats.size,
                    fileSize: formatBytes(stats.size)
                  }
                }
              }
            }
          } catch {}
        }
      }
    }
  } catch {}
  return { exists: false }
}

/**
 * Saves a media stream directly to the configured HD folder and manages library cataloging
 */
export async function saveStremioMediaToLibrary(
  payload: SaveMediaPayload,
  onProgress?: (task: CinemaDownloadTask) => void
): Promise<{ success: boolean; targetPath: string; message: string }> {
  const dirs = getCinemaDownloadDirectories()

  let baseDir = payload.targetDir
  if (!baseDir) {
    if (payload.type === 'anime') {
      baseDir = dirs.animesDir || dirs.seriesDir || dirs.moviesDir
    } else if (payload.type === 'series') {
      baseDir = dirs.seriesDir || dirs.moviesDir
    } else {
      baseDir = dirs.moviesDir || dirs.seriesDir
    }
  }

  if (!baseDir) {
    throw new Error(
      'Nenhuma pasta de destino configurada para downloads do Stremio. Defina a pasta nas configurações do Alazterflix.'
    )
  }

  const { folderPath, filePath } = buildMediaDestinationPath(baseDir, payload)
  mkdirSync(folderPath, { recursive: true })

  const taskId = `${payload.title}_S${payload.season || 1}E${payload.episode || 1}_${Date.now()}`
  const controller = new AbortController()
  abortControllers.set(taskId, controller)

  const task: CinemaDownloadTask = {
    id: taskId,
    title: payload.episodeTitle ? `${payload.title} - ${payload.episodeTitle}` : payload.title,
    targetPath: filePath,
    bytesDownloaded: 0,
    totalBytes: 0,
    progressPercent: 0,
    status: 'downloading',
    startTime: Date.now()
  }
  activeTasks.set(taskId, task)

  logInfo(LogPrefix.General, `Iniciando download de mídia "${payload.title}" para ${filePath}`)

  // Start background streaming download
  const streamUrl = payload.streamUrl
  if (!streamUrl) {
    task.status = 'error'
    task.error = 'URL de stream indisponível.'
    throw new Error('URL de stream indisponível para download.')
  }

  // Asynchronously download stream to file
  const downloadPromise = new Promise<{ success: boolean; targetPath: string; message: string }>(
    (resolveDownload, rejectDownload) => {
      const fileStream = createWriteStream(filePath)
      let lastReport = Date.now()
      let lastBytes = 0

      const handleResponse = (res: http.IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          const redirectUrl = res.headers.location
          const client = redirectUrl.startsWith('https') ? https : http
          client.get(redirectUrl, { signal: controller.signal }, handleResponse).on('error', (err) => {
            fileStream.close()
            task.status = 'error'
            task.error = err.message
            rejectDownload(err)
          })
          return
        }

        const total = parseInt(res.headers['content-length'] || '0', 10)
        task.totalBytes = total

        res.on('data', (chunk: Buffer) => {
          task.bytesDownloaded += chunk.length
          const now = Date.now()
          if (now - lastReport >= 500) {
            const timeDiff = (now - lastReport) / 1000
            const bytesDiff = task.bytesDownloaded - lastBytes
            task.speedBytesPerSec = Math.round(bytesDiff / (timeDiff || 1))
            task.progressPercent = task.totalBytes > 0
              ? Math.min(100, Math.round((task.bytesDownloaded / task.totalBytes) * 100))
              : 0
            lastReport = now
            lastBytes = task.bytesDownloaded
            if (onProgress) onProgress(task)
          }
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          task.status = 'completed'
          task.progressPercent = 100
          abortControllers.delete(taskId)
          logInfo(LogPrefix.General, `Download concluído com sucesso: ${filePath}`)
          if (onProgress) onProgress(task)
          resolveDownload({
            success: true,
            targetPath: filePath,
            message: `Mídia salva com sucesso na biblioteca: ${filePath}`
          })
        })

        fileStream.on('error', (err) => {
          task.status = 'error'
          task.error = err.message
          abortControllers.delete(taskId)
          rejectDownload(err)
        })
      }

      const client = streamUrl.startsWith('https') ? https : http
      const req = client.get(streamUrl, { signal: controller.signal }, handleResponse)

      req.on('error', (err) => {
        fileStream.close()
        task.status = 'error'
        task.error = err.message
        abortControllers.delete(taskId)
        rejectDownload(err)
      })
    }
  )

  // Save posters / backdrops if provided
  if (payload.posterUrl) {
    try {
      const posterPath = join(folderPath, 'poster.jpg')
      if (!existsSync(posterPath)) {
        const client = payload.posterUrl.startsWith('https') ? https : http
        client.get(payload.posterUrl, (res) => {
          if (res.statusCode === 200) {
            const ps = createWriteStream(posterPath)
            res.pipe(ps)
          }
        }).on('error', () => {})
      }
    } catch {}
  }

  // Return immediate confirmation while download continues in background
  return {
    success: true,
    targetPath: filePath,
    message: `Salvando na biblioteca em: ${filePath}`
  }
}
