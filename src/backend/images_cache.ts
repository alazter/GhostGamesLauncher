import { promises as fsPromises, existsSync, writeFile, mkdirSync, readdirSync } from 'graceful-fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { protocol, net, ipcMain } from 'electron'
import { appFolder } from './constants/paths'

const imagesCachePath = join(appFolder, 'images-cache')
const cachedHashes = new Set<string>()
const failedUrls = new Set<string>()

export const clearImageCacheNegative = () => {
  failedUrls.clear()
}

interface MemoryCacheEntry {
  buffer: Buffer
  mime: string
}

const memoryCache = new Map<string, MemoryCacheEntry>()
const MAX_MEMORY_CACHE = 500

const setMemoryCache = (key: string, entry: MemoryCacheEntry) => {
  if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const oldest = memoryCache.keys().next().value
    if (oldest) memoryCache.delete(oldest)
  }
  memoryCache.set(key, entry)
}

export const initImagesCache = () => {
  if (!existsSync(imagesCachePath)) {
    mkdirSync(imagesCachePath, { recursive: true })
  } else {
    try {
      const files = readdirSync(imagesCachePath)
      for (const file of files) {
        cachedHashes.add(file)
      }
    } catch (err) {
      console.error('[ImagesCache] Error indexing cache directory:', err)
    }
  }

  protocol.handle('imagecache', async (request) => {
    return getImageFromCache(request)
  })

  ipcMain.handle('clearImageCacheNegative', () => {
    failedUrls.clear()
    return true
  })
}

const detectMimeType = (url: string, buffer?: Buffer): string => {
  if (buffer && buffer.length >= 8) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png'
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg'
    }
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
      return 'image/webp'
    }
    if (buffer.subarray(0, 4).toString('utf8') === '<svg' || buffer.subarray(0, 5).toString('utf8') === '<?xml') {
      return 'image/svg+xml'
    }
  }

  const lower = url.toLowerCase().split('?')[0]
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.ico')) return 'image/x-icon'

  return 'image/png'
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

const getImageFromCache = async (request: Request): Promise<Response> => {
  const url = request.url
  let cleanUrl = url
  if (cleanUrl.startsWith('imagecache://localhost/')) {
    cleanUrl = cleanUrl.replace('imagecache://localhost/', '')
  } else if (cleanUrl.startsWith('imagecache://')) {
    cleanUrl = cleanUrl.replace('imagecache://', '')
  }
  const rawUrl = decodeURIComponent(cleanUrl)
  // Strip any ?reconnect=N or &reconnect=N query params added by the reconnect engine
  const realUrl = rawUrl.replace(/[?&]reconnect=\d+/, '').replace(/\?$/, '')

  // 1. Instant negative cache check (0ms for known 404s)
  if (failedUrls.has(realUrl)) {
    return new Response('File not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=86400' }
    })
  }

  // 2. Check ultra-fast in-memory RAM cache (0ms latency)
  const memHit = memoryCache.get(realUrl)
  if (memHit) {
    const headers = new Headers()
    headers.set('Content-Type', memHit.mime)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new Response(memHit.buffer, {
      status: 200,
      headers
    })
  }

  // 3. Local file path on disk
  if (!realUrl.startsWith('http://') && !realUrl.startsWith('https://')) {
    let localPath = realUrl
    if (localPath.startsWith('file:///')) {
      localPath = decodeURIComponent(localPath.slice(8))
    } else if (localPath.startsWith('file://')) {
      localPath = decodeURIComponent(localPath.slice(7))
    }

    let resolvedPath = localPath
    if (!existsSync(resolvedPath)) {
      const winPath = resolvedPath.replace(/\//g, '\\')
      if (existsSync(winPath)) {
        resolvedPath = winPath
      }
    }

    if (existsSync(resolvedPath)) {
      try {
        const buffer = await fsPromises.readFile(resolvedPath)
        const mime = detectMimeType(resolvedPath, buffer)
        setMemoryCache(realUrl, { buffer, mime })

        const headers = new Headers()
        headers.set('Content-Type', mime)
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')
        return new Response(buffer, {
          status: 200,
          headers
        })
      } catch (err) {
        return new Response('File read error', { status: 500 })
      }
    }
    failedUrls.add(realUrl)
    return new Response('File not found', { status: 404 })
  }

  // 4. Remote HTTP/HTTPS URL
  const digest = createHash('sha256').update(realUrl).digest('hex')
  const cachePath = join(imagesCachePath, digest)

  // 4.1 Check memory cache by digest
  const digestMemHit = memoryCache.get(digest)
  if (digestMemHit) {
    const headers = new Headers()
    headers.set('Content-Type', digestMemHit.mime)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new Response(digestMemHit.buffer, {
      status: 200,
      headers
    })
  }

  // 4.2 Hit from disk cache (asynchronous non-blocking read + populate memory cache)
  if (cachedHashes.has(digest) || existsSync(cachePath)) {
    cachedHashes.add(digest)
    try {
      const buffer = await fsPromises.readFile(cachePath)
      const mime = detectMimeType(realUrl, buffer)
      setMemoryCache(digest, { buffer, mime })

      const headers = new Headers()
      headers.set('Content-Type', mime)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(buffer, {
        status: 200,
        headers
      })
    } catch {
      // If reading cache failed, proceed to fetch
    }
  }

  // 4.3 Remote download with 15s network timeout and safe negative caching
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await net.fetch(realUrl, {
      headers: getForwardHeaders(request),
      method: request.method,
      referrer: request.referrer,
      signal: controller.signal
    }).finally(() => clearTimeout(timeout))

    if (response.ok) {
      const arrayBuf = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuf)
      const mime = detectMimeType(realUrl, buffer)
      setMemoryCache(digest, { buffer, mime })

      // Save to disk cache asynchronously without blocking
      writeFile(cachePath, buffer, (err) => {
        if (!err) {
          cachedHashes.add(digest)
        }
      })

      const headers = new Headers()
      headers.set('Content-Type', mime)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')

      return new Response(buffer, {
        status: 200,
        headers
      })
    }

    // Only cache genuine 404 so subsequent requests respond in 0ms!
    if (response.status === 404) {
      failedUrls.add(realUrl)
    }
    return new Response('Not found', {
      status: response.status || 404,
      headers: { 'Cache-Control': response.status === 404 ? 'public, max-age=86400' : 'no-cache' }
    })
  } catch (err) {
    // DO NOT blacklist transient timeouts or network interruptions in failedUrls!
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-cache' }
    })
  }
}
