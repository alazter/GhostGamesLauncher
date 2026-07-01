import { existsSync, createWriteStream, mkdirSync, readFileSync } from 'graceful-fs'
import { createHash } from 'crypto'
import { join } from 'path'
import axios from 'axios'
import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { appFolder } from './constants/paths'

const imagesCachePath = join(appFolder, 'images-cache')

export const initImagesCache = () => {
  // make sure we have a folder to store the cache
  if (!existsSync(imagesCachePath)) {
    mkdirSync(imagesCachePath)
  }

  // use a fake protocol for images we want to cache
  protocol.handle('imagecache', (request) => {
    return getImageFromCache(request)
  })
}

const pending = new Map<string, Promise<void>>()

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
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

  const getMimeType = (pathOrUrl: string) => {
    const ext = pathOrUrl.split('?')[0].split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'webp': return 'image/webp'
      case 'png': return 'image/png'
      case 'jpg':
      case 'jpeg': return 'image/jpeg'
      case 'gif': return 'image/gif'
      case 'svg': return 'image/svg+xml'
      case 'webm': return 'video/webm'
      case 'mp4': return 'video/mp4'
      default: return 'application/octet-stream'
    }
  }

  const serveLocalFile = (filePath: string, originalUrl?: string) => {
    try {
      const data = readFileSync(filePath)
      const mime = getMimeType(originalUrl || filePath)
      
      const rangeHeader = typeof request.headers.get === 'function'
        ? request.headers.get('range')
        : (request.headers as any)['range']

      let responseStatus = 200
      let responseHeaders: Record<string, string> = {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes'
      }
      let responseBody: BodyInit = data

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : data.length - 1
        const chunksize = end - start + 1
        
        responseBody = data.subarray(start, end + 1)
        responseStatus = 206
        responseHeaders['Content-Range'] = `bytes ${start}-${end}/${data.length}`
        responseHeaders['Content-Length'] = chunksize.toString()
      } else {
        responseHeaders['Content-Length'] = data.length.toString()
      }

      return new Response(responseBody, {
        status: responseStatus,
        headers: responseHeaders
      })
    } catch (err) {
      console.error('[ImagesCache] Failed to load local file:', filePath, err)
      return new Response('File not found', { status: 404 })
    }
  }

  if (!realUrl.startsWith('http')) {
    return serveLocalFile(realUrl)
  }

  // digest of the image url for the file name
  const digest = createHash('sha256').update(realUrl).digest('hex')
  const cachePath = join(imagesCachePath, digest)

  if (existsSync(cachePath)) {
    return serveLocalFile(cachePath, realUrl)
  }

  if (
    realUrl.startsWith('http') &&
    !pending.has(digest)
  ) {
    // if not found, download in the background
    pending.set(
      digest,
      new Promise<void>((res) => {
        axios({
          method: 'get',
          url: realUrl,
          responseType: 'stream',
          headers: getForwardHeaders(request)
        })
          .then((response) => {
            const writer = createWriteStream(cachePath)
            response.data.pipe(writer)
            writer.on('finish', () => res())
            writer.on('error', () => res())
          })
          .catch(() => {
            res()
          })
          .finally(() => {
            pending.delete(digest)
          })
      })
    )
  }

  // Serve the remote image directly in the meantime, forwarding original request headers
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
