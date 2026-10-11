import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync
} from 'graceful-fs'
import { basename, dirname, extname, join, relative, resolve } from 'path'
import { randomUUID } from 'crypto'
import { nativeImage } from 'electron'
import type { PluginManifest } from 'common/types/plugins'
import { NetworkGuard } from './networkGuard'
import { invalidateLocalImage } from '../images_cache'
import { logWarning, LogPrefix } from 'backend/logger'

const VIDEO =
  /\.(mp4|mkv|webm|avi|mov|m4v|ts|wmv|flv|rmvb|vob|divx|ogv|mpg|mpeg|m2ts)$/i
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const CATEGORIES = new Set([
  'filmes',
  'movies',
  'series',
  'shows',
  'animes',
  'anime',
  'desenhos',
  'cartoons',
  'documentarios',
  'documentaries'
])
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export interface LocalMediaArtwork {
  poster?: string
  backdrop?: string
}

/** Cache directory inventories for one scan, instead of reading them for every episode. */
export function createArtworkFinder() {
  const inventories = new Map<string, Map<string, string>>()
  const inventory = (directory: string) => {
    let entries = inventories.get(directory)
    if (!entries) {
      entries = new Map(
        readdirSync(directory, { withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => [e.name.toLowerCase(), e.name])
      )
      inventories.set(directory, entries)
    }
    return entries
  }
  const find = (directory: string, names: string[]) => {
    const entries = inventory(directory)
    for (const name of names)
      for (const extension of EXTENSIONS) {
        const actual = entries.get((name + extension).toLowerCase())
        if (actual) return join(directory, actual)
      }
    return undefined
  }
  return (filePath: string, showDir?: string): LocalMediaArtwork => {
    const directory = dirname(filePath)
    const stem = basename(filePath, extname(filePath))
    const result: LocalMediaArtwork = {
      poster: find(directory, [`${stem}-poster`, stem]),
      backdrop: find(directory, [`${stem}-backdrop`, `${stem}-fanart`])
    }
    // Generic posters in shared movie folders would give every film the same cover.
    const parts = filePath.split(/[\\/]/).map(normalize)
    const episodic =
      parts.some(
        (p) =>
          [
            'series',
            'shows',
            'animes',
            'anime',
            'desenhos',
            'cartoons'
          ].includes(p) || /^series?\s+/.test(p)
      ) || /s\d+e\d+|\d+x\d+|(?:season|temporada)\s*\d+/i.test(filePath)
    const shared =
      Array.from(inventory(directory).keys()).filter((n) => VIDEO.test(n))
        .length > 1
    if ((!episodic && shared) || CATEGORIES.has(normalize(basename(directory))))
      return result
    let current = directory
    const boundary = showDir ? resolve(showDir) : undefined
    for (let level = 0; level <= 4; level++) {
      if (CATEGORIES.has(normalize(basename(current)))) break
      result.poster ||= find(current, ['poster', 'cover', 'folder'])
      result.backdrop ||= find(current, ['backdrop', 'fanart', 'background'])
      if (
        (result.poster && result.backdrop) ||
        (boundary && resolve(current) === boundary)
      )
        break
      const parent = dirname(current)
      if (parent === current) break
      // Without a declared root, only ascend through season/quality/extra folders.
      if (
        !boundary &&
        !/^(?:season|temporada|temp|s)\s*\d+|^(?:specials?|especiais|extras?|ovas?|1080p|720p|2160p|4k)$/i.test(
          basename(current)
        )
      )
        break
      if (boundary && relative(boundary, parent).startsWith('..')) break
      current = parent
    }
    return result
  }
}

function localImagePath(source: string): string | undefined {
  if (source.startsWith('imagecache://localhost/'))
    return decodeURIComponent(
      source.slice('imagecache://localhost/'.length).split('?')[0]
    )
  if (
    source.startsWith('http://127.0.0.1:') &&
    new URL(source).pathname === '/stream'
  )
    return new URL(source).searchParams.get('file') || undefined
  return existsSync(source) ? source : undefined
}

export async function saveMediaArtwork(
  manifest: PluginManifest,
  filePath: string,
  source: string,
  type: 'poster' | 'backdrop',
  showDir?: string,
  singleItem = false
): Promise<{ localPath: string; streamUrl: string }> {
  if (!['poster', 'backdrop'].includes(type))
    throw new Error('Tipo de imagem inválido.')
  if (
    !existsSync(filePath) ||
    !statSync(filePath).isFile() ||
    !VIDEO.test(filePath)
  )
    throw new Error('O vídeo de destino não está disponível.')
  const directory = dirname(filePath)
  let targetDirectory = directory
  if (showDir && !singleItem) {
    const relation = relative(resolve(showDir), resolve(directory))
    if (
      relation.startsWith('..') ||
      /^[A-Za-z]:/.test(relation) ||
      !statSync(showDir).isDirectory()
    )
      throw new Error('A pasta da obra deve conter o vídeo.')
    targetDirectory = showDir
  }
  let buffer: Buffer
  const local = localImagePath(source)
  if (local) {
    if (statSync(local).size > MAX_IMAGE_BYTES)
      throw new Error('A imagem deve ter até 20 MB.')
    buffer = readFileSync(local)
  } else if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(source)) {
    if (source.length > MAX_IMAGE_BYTES * 1.4)
      throw new Error('A imagem deve ter até 20 MB.')
    buffer = Buffer.from(source.slice(source.indexOf(',') + 1), 'base64')
  } else {
    const check = NetworkGuard.validateUrl(source, manifest)
    if (!check.allowed) throw new Error(check.reason)
    // Redirects and DNS are checked by the same guard used by plugin requests.
    const response = await NetworkGuard.fetchResponse(
      source,
      manifest,
      AbortSignal.timeout(15000),
      {},
      true
    )
    if (!response.ok)
      throw new Error(
        `Não foi possível baixar a imagem (HTTP ${response.status}).`
      )
    if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
      await response.body?.cancel()
      throw new Error('A imagem deve ter até 20 MB.')
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('A resposta não contém uma imagem.')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.length
        if (size > MAX_IMAGE_BYTES)
          throw new Error('A imagem deve ter até 20 MB.')
        chunks.push(chunk.value)
      }
    } finally {
      await reader.cancel()
    }
    buffer = Buffer.concat(chunks)
  }
  if (buffer.length > MAX_IMAGE_BYTES)
    throw new Error('A imagem deve ter até 20 MB.')
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty())
    throw new Error('O arquivo escolhido não é uma imagem válida.')
  if (type === 'backdrop' && !local && /^https?:\/\//i.test(source)) {
    const { width, height } = image.getSize()
    if (width <= height)
      throw new Error('A imagem de fundo recebida precisa ser horizontal.')
  }
  const jpeg = image.toJPEG(92)
  const shared =
    readdirSync(targetDirectory).filter((name) => VIDEO.test(name)).length > 1
  const stem = basename(filePath, extname(filePath))
  const specific = singleItem || (!showDir && shared)
  const path = join(
    targetDirectory,
    specific ? `${stem}-${type}.jpg` : `${type}.jpg`
  )
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, jpeg)
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
  invalidateLocalImage(path)
  if (!specific) {
    const mirror = join(
      targetDirectory,
      type === 'poster' ? 'cover.jpg' : 'fanart.jpg'
    )
    const mirrorTemporary = `${mirror}.${randomUUID()}.tmp`
    try {
      writeFileSync(mirrorTemporary, jpeg)
      renameSync(mirrorTemporary, mirror)
      invalidateLocalImage(mirror)
    } catch (error) {
      logWarning(
        `[Alazterflix] A imagem principal foi salva; não foi possível criar a cópia ${mirror}: ${String(error)}`,
        LogPrefix.Backend
      )
    } finally {
      if (existsSync(mirrorTemporary)) unlinkSync(mirrorTemporary)
    }
  }
  return {
    localPath: path,
    streamUrl: `imagecache://localhost/${encodeURIComponent(path)}?v=${Date.now()}`
  }
}
