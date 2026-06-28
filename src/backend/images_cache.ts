import { existsSync, createWriteStream, mkdirSync } from 'graceful-fs'
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
    return getImageFromCache(request.url)
  })
}

const pending = new Map<string, Promise<void>>()

const getImageFromCache = (url: string) => {
  let cleanUrl = url
  if (cleanUrl.startsWith('imagecache://localhost/')) {
    cleanUrl = cleanUrl.replace('imagecache://localhost/', '')
  } else if (cleanUrl.startsWith('imagecache://')) {
    cleanUrl = cleanUrl.replace('imagecache://', '')
  }
  const realUrl = decodeURIComponent(cleanUrl)

  if (!realUrl.startsWith('http')) {
    try {
      return net.fetch(pathToFileURL(realUrl).toString())
    } catch (err) {
      console.error('[ImagesCache] Failed to load local image:', realUrl, err)
      return new Response('File not found', { status: 404 })
    }
  }

  // digest of the image url for the file name
  const digest = createHash('sha256').update(realUrl).digest('hex')
  const cachePath = join(imagesCachePath, digest)

  if (existsSync(cachePath)) {
    try {
      return net.fetch(pathToFileURL(cachePath).toString())
    } catch (err) {
      console.error('[ImagesCache] Failed to load cached image:', cachePath, err)
      return new Response('Cache file not found', { status: 404 })
    }
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
          responseType: 'stream'
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

  // Serve the remote image directly in the meantime
  try {
    return net.fetch(realUrl)
  } catch (err) {
    console.error('[ImagesCache] Failed to fetch remote image:', realUrl, err)
    return new Response('Remote fetch failed', { status: 500 })
  }
}
