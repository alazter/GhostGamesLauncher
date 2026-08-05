import { existsSync, createWriteStream, mkdirSync } from 'graceful-fs'
import { createHash } from 'crypto'
import { join } from 'path'
import axios from 'axios'
import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { appFolder } from './constants/paths'

const imagesCachePath = join(appFolder, 'images-cache')

export const initImagesCache = () => {
  if (!existsSync(imagesCachePath)) {
    mkdirSync(imagesCachePath)
  }

  protocol.handle('imagecache', (request) => {
    return getImageFromCache(request)
  })
}

const pending = new Map<string, Promise<void>>()
const activeDownloads = new Set<Promise<void>>()
const MAX_CONCURRENT_DOWNLOADS = 8
const downloadQueue: (() => void)[] = []

const processDownloadQueue = () => {
  while (activeDownloads.size < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const next = downloadQueue.shift()
    if (next) next()
  }
}

const getForwardHeaders = (request: Request): Record<string, string> => {
  const headers: Record<string, string> = {}
  if (typeof request.headers.forEach === 'function') {
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (lowerKey !== 'host' && lowerKey !== 'origin') {
        headers[key] = value
      }
    })
  } else if (request.headers) {
    for (const key of Object.keys(request.headers)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey !== 'host' && lowerKey !== 'origin') {
        headers[key] = (request.headers as any)[key]
      }
    }
  }

  if (!headers['user-agent'] && !headers['User-Agent']) {
    headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
  return headers
}

const getImageFromCache = (request: Request) => {
  const url = request.url
  let cleanUrl = url
  if (cleanUrl.startsWith('imagecache://localhost/')) {
    cleanUrl = cleanUrl.replace('imagecache://localhost/', '')
  } else if (cleanUrl.startsWith('imagecache://')) {
    cleanUrl = cleanUrl.replace('imagecache://', '')
  }
  const realUrl = decodeURIComponent(cleanUrl)

  // Local file path
  if (!realUrl.startsWith('http://') && !realUrl.startsWith('https://')) {
    if (existsSync(realUrl)) {
      return net.fetch(pathToFileURL(realUrl).toString())
    }
    return new Response('File not found', { status: 404 })
  }

  // Remote HTTP/HTTPS URL
  const digest = createHash('sha256').update(realUrl).digest('hex')
  const cachePath = join(imagesCachePath, digest)

  // Serves from local cache asynchronously via Chromium C++ thread
  if (existsSync(cachePath)) {
    return net.fetch(pathToFileURL(cachePath).toString())
  }

  // Download in background with concurrency throttling if not already downloading
  if (!pending.has(digest)) {
    const startDownload = () => {
      const downloadTask = axios({
        method: 'get',
        url: realUrl,
        responseType: 'stream',
        headers: getForwardHeaders(request),
        timeout: 15000
      })
        .then((response) => {
          const writer = createWriteStream(cachePath)
          response.data.pipe(writer)
          return new Promise<void>((resolve) => {
            writer.on('finish', () => resolve())
            writer.on('error', () => resolve())
          })
        })
        .catch(() => {})
        .finally(() => {
          pending.delete(digest)
          activeDownloads.delete(startPromise)
          processDownloadQueue()
        })

      return downloadTask
    }

    let startPromise: Promise<void>
    const runTask = () => {
      startPromise = startDownload()
      activeDownloads.add(startPromise)
    }

    if (activeDownloads.size < MAX_CONCURRENT_DOWNLOADS) {
      runTask()
    } else {
      downloadQueue.push(runTask)
    }

    pending.set(digest, Promise.resolve())
  }

  // Stream directly from remote URL using Electron net.fetch
  try {
    return net.fetch(realUrl, {
      headers: getForwardHeaders(request),
      method: request.method,
      referrer: request.referrer
    })
  } catch (err) {
    console.error('[ImagesCache] Failed to fetch remote image:', realUrl, err)
    return new Response('Remote fetch failed', { status: 500 })
  }
}
