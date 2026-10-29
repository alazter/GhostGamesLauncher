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
import {
  isImdbUrl,
  isImdbWebPageUrl,
  normalizeImdbImageUrl,
  resolveImdbCoverImage
} from './imdbImageResolver'

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

/**
 * Decodifica buffers de imagem em formatos modernos (como WebP VP8 sem headers estendidos,
 * AVIF ou SVG) usando o motor de renderização do Chromium quando o nativeImage do Electron
 * não consegue processar os bytes diretamente.
 */
export async function decodeImageWithChromium(
  buffer: Buffer
): Promise<Buffer | null> {
  let offscreenWindow: any = null
  try {
    const { getMainWindow } = await import('backend/main_window')
    let win = getMainWindow ? getMainWindow() : null
    if (
      !win ||
      win.isDestroyed?.() ||
      !win.webContents ||
      win.webContents.isDestroyed?.()
    ) {
      const { BrowserWindow } = await import('electron')
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows()
        win = windows.find(
          (w) =>
            !w.isDestroyed?.() &&
            w.webContents &&
            !w.webContents.isDestroyed?.()
        )
      }
    }
    if (
      !win ||
      win.isDestroyed?.() ||
      !win.webContents ||
      win.webContents.isDestroyed?.()
    ) {
      const { BrowserWindow, app } = await import('electron')
      if (
        BrowserWindow &&
        app &&
        typeof app.isReady === 'function' &&
        app.isReady()
      ) {
        offscreenWindow = new BrowserWindow({
          show: false,
          width: 200,
          height: 200,
          webPreferences: {
            offscreen: true,
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true
          }
        })
        if (typeof offscreenWindow.loadURL === 'function') {
          await offscreenWindow.loadURL('about:blank')
          win = offscreenWindow
        }
      }
    }

    if (
      !win ||
      win.isDestroyed?.() ||
      !win.webContents ||
      win.webContents.isDestroyed?.() ||
      typeof win.webContents.executeJavaScript !== 'function'
    ) {
      return null
    }

    const base64 = buffer.toString('base64')
    const script = `
      (async function() {
        try {
          let drawSource = null;
          let width = 0;
          let height = 0;
          try {
            const res = await fetch('data:application/octet-stream;base64,${base64}');
            const blob = await res.blob();
            const bmp = await createImageBitmap(blob);
            width = bmp.width;
            height = bmp.height;
            drawSource = bmp;
          } catch (_) {}

          if (!drawSource) {
            drawSource = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
              img.src = 'data:application/octet-stream;base64,${base64}';
            });
            if (drawSource) {
              width = drawSource.naturalWidth || drawSource.width;
              height = drawSource.naturalHeight || drawSource.height;
            }
          }

          if (!drawSource || !width || !height) return null;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(drawSource, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          return dataUrl.split(',')[1];
        } catch (e) {
          return null;
        }
      })()
    `
    const resultBase64 = await win.webContents.executeJavaScript(script, true)
    if (resultBase64 && typeof resultBase64 === 'string') {
      return Buffer.from(resultBase64, 'base64')
    }
  } catch (err) {
    logWarning(
      `[Alazterflix] Falha ao decodificar imagem via Chromium: ${String(err)}`,
      LogPrefix.Backend
    )
  } finally {
    if (offscreenWindow && !offscreenWindow.isDestroyed?.()) {
      try {
        offscreenWindow.destroy()
      } catch {}
    }
  }
  return null
}

export const imageDecoder = {
  decodeWithChromium: decodeImageWithChromium
}

function extractImageFromHtml(html: string, baseUrl: string): string | undefined {
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i) ||
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i) ||
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)
  if (ogMatch && ogMatch[1]) {
    try {
      return new URL(ogMatch[1], baseUrl).href
    } catch {}
  }
  return undefined
}

function localImagePath(source: string): string | undefined {
  if (!source || typeof source !== 'string') return undefined
  let cleaned = source.trim()
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  if (cleaned.startsWith('imagecache://localhost/')) {
    const raw = cleaned.slice('imagecache://localhost/'.length).split('?')[0]
    const decoded = decodeURIComponent(raw)
    return existsSync(decoded) ? decoded : undefined
  }
  if (
    cleaned.startsWith('http://127.0.0.1:') &&
    cleaned.includes('/stream')
  ) {
    try {
      const url = new URL(cleaned)
      const fileParam = url.searchParams.get('file')
      if (fileParam && existsSync(fileParam)) return fileParam
    } catch {}
  }
  if (/^file:\/\//i.test(cleaned)) {
    try {
      const decoded = decodeURIComponent(
        cleaned
          .replace(/^file:\/\/\/?([a-zA-Z]:)/i, '$1')
          .replace(/^file:\/\//i, '')
      )
      if (existsSync(decoded)) return decoded
    } catch {}
  }
  return existsSync(cleaned) ? cleaned : undefined
}

/**
 * Exclui de forma segura um arquivo de imagem de capa ou fundo antigo do disco.
 * Garante que apenas extensões de imagem legítimas sejam apagadas e NUNCA arquivos de vídeo.
 */
export function deleteMediaArtwork(targetPath: string): boolean {
  try {
    if (!targetPath || !existsSync(targetPath)) return false
    if (!statSync(targetPath).isFile()) return false
    if (VIDEO.test(targetPath)) return false
    const ext = extname(targetPath).toLowerCase()
    if (!EXTENSIONS.includes(ext)) return false
    unlinkSync(targetPath)
    invalidateLocalImage(targetPath)
    return true
  } catch (err) {
    logWarning(
      `[Alazterflix] Falha ao excluir imagem antiga "${targetPath}": ${String(err)}`,
      LogPrefix.Backend
    )
    return false
  }
}

export async function saveMediaArtwork(
  manifest: PluginManifest,
  filePath: string,
  source: string,
  type: 'poster' | 'backdrop',
  showDir?: string,
  singleItem = false,
  deleteOld = true,
  oldArtworkPath?: string
): Promise<{ localPath: string; streamUrl: string }> {
  if (!['poster', 'backdrop'].includes(type))
    throw new Error('Tipo de imagem inválido.')

  let effectiveSource = source.trim()
  if (isImdbUrl(effectiveSource)) {
    if (isImdbWebPageUrl(effectiveSource)) {
      const resolved = await resolveImdbCoverImage(effectiveSource)
      if (!resolved) {
        throw new Error(
          'Não foi possível extrair a imagem do link do IMDb informado. Verifique o link e tente novamente.'
        )
      }
      effectiveSource = resolved
    } else {
      effectiveSource = normalizeImdbImageUrl(effectiveSource)
    }
  }

  // Se for link de busca do Google Imagens (/imgres?imgurl=...), extrai a URL direta da imagem
  try {
    const parsed = new URL(effectiveSource)
    if (
      (parsed.hostname.includes('google.') || parsed.hostname === 'google.com') &&
      parsed.pathname.includes('/imgres') &&
      parsed.searchParams.has('imgurl')
    ) {
      const directImg = parsed.searchParams.get('imgurl')
      if (directImg) effectiveSource = directImg
    }
  } catch {}

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
  const local = localImagePath(effectiveSource)
  const dataUriMatch = effectiveSource.match(
    /^data:image\/([a-zA-Z0-9.+-]+)(?:;charset=[^;]+)?(?:;(base64))?,/i
  )
  if (local) {
    if (statSync(local).size > MAX_IMAGE_BYTES)
      throw new Error('A imagem deve ter até 20 MB.')
    buffer = readFileSync(local)
  } else if (dataUriMatch) {
    if (effectiveSource.length > MAX_IMAGE_BYTES * 1.4)
      throw new Error('A imagem deve ter até 20 MB.')
    const commaIndex = effectiveSource.indexOf(',')
    const isBase64 = dataUriMatch[2] === 'base64'
    const rawData = effectiveSource.slice(commaIndex + 1)
    buffer = isBase64
      ? Buffer.from(rawData, 'base64')
      : Buffer.from(decodeURIComponent(rawData), 'utf8')
  } else {
    const check = NetworkGuard.validateUrl(effectiveSource, manifest)
    if (!check.allowed) throw new Error(check.reason)
    // Redirects and DNS are checked by the same guard used by plugin requests.
    const response = await NetworkGuard.fetchResponse(
      effectiveSource,
      manifest,
      AbortSignal.timeout(15000),
      {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      false
    )
    if (!response.ok)
      throw new Error(
        `Não foi possível baixar a imagem (HTTP ${response.status}).`
      )
    if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
      await response.body?.cancel()
      throw new Error('A imagem deve ter até 20 MB.')
    }
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      const htmlText = await response.text()
      const extractedUrl = extractImageFromHtml(htmlText, effectiveSource)
      if (extractedUrl) {
        return saveMediaArtwork(
          manifest,
          filePath,
          extractedUrl,
          type,
          showDir,
          singleItem,
          deleteOld,
          oldArtworkPath
        )
      }
      throw new Error(
        'O link informado aponta para uma página web e não para um arquivo de imagem.'
      )
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

  // Se o buffer for HTML disfarçado (sem header content-type adequado), tenta extrair imagem de metadados
  const headerCheck = buffer.subarray(0, 100).toString('utf8').trim().toLowerCase()
  if (headerCheck.startsWith('<!doctype html') || headerCheck.startsWith('<html')) {
    const htmlText = buffer.toString('utf8')
    const extractedUrl = extractImageFromHtml(htmlText, effectiveSource)
    if (extractedUrl) {
      return saveMediaArtwork(
        manifest,
        filePath,
        extractedUrl,
        type,
        showDir,
        singleItem,
        deleteOld,
        oldArtworkPath
      )
    }
    throw new Error(
      'O link informado aponta para uma página web e não para um arquivo de imagem.'
    )
  }

  let image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) {
    // Fallback poderoso: decodifica formatos avançados (WebP VP8, AVIF, SVG) via Chromium
    const decoded = await imageDecoder.decodeWithChromium(buffer)
    if (decoded && decoded.length > 0) {
      image = nativeImage.createFromBuffer(decoded)
    }
  }
  if (image.isEmpty())
    throw new Error('O arquivo escolhido não é uma imagem válida ou compatível.')
  if (type === 'backdrop' && !local && /^https?:\/\//i.test(effectiveSource)) {
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
  let mirror: string | undefined = undefined
  if (!specific) {
    mirror = join(
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

  // Se a opção de excluir a imagem antiga estiver ativa, deletar arquivos anteriores
  if (deleteOld) {
    const protectedPaths = new Set<string>()
    protectedPaths.add(resolve(path).toLowerCase())
    if (mirror) protectedPaths.add(resolve(mirror).toLowerCase())
    protectedPaths.add(resolve(filePath).toLowerCase())

    // 1. Excluir caminho explicitamente informado como artwork anterior
    if (oldArtworkPath && existsSync(oldArtworkPath)) {
      try {
        const resolvedOld = resolve(oldArtworkPath).toLowerCase()
        if (
          !protectedPaths.has(resolvedOld) &&
          statSync(oldArtworkPath).isFile() &&
          !VIDEO.test(oldArtworkPath) &&
          EXTENSIONS.includes(extname(oldArtworkPath).toLowerCase())
        ) {
          unlinkSync(oldArtworkPath)
          invalidateLocalImage(oldArtworkPath)
        }
      } catch (err) {
        logWarning(
          `[Alazterflix] Falha ao excluir imagem antiga "${oldArtworkPath}": ${String(err)}`,
          LogPrefix.Backend
        )
      }
    }

    // 2. Limpar arquivos de imagem legados do mesmo tipo na pasta (outras extensões como .png, .webp ou nomes legados)
    try {
      const candidateNames: string[] = []
      if (type === 'poster') {
        if (specific) {
          candidateNames.push(`${stem}-poster`, stem)
        } else {
          candidateNames.push('poster', 'cover', 'folder')
        }
      } else if (type === 'backdrop') {
        if (specific) {
          candidateNames.push(`${stem}-backdrop`, `${stem}-fanart`)
        } else {
          candidateNames.push('backdrop', 'fanart', 'background')
        }
      }

      for (const name of candidateNames) {
        for (const ext of EXTENSIONS) {
          const candidatePath = join(targetDirectory, `${name}${ext}`)
          if (existsSync(candidatePath)) {
            try {
              const resolvedCand = resolve(candidatePath).toLowerCase()
              if (
                !protectedPaths.has(resolvedCand) &&
                statSync(candidatePath).isFile() &&
                !VIDEO.test(candidatePath)
              ) {
                unlinkSync(candidatePath)
                invalidateLocalImage(candidatePath)
              }
            } catch (err) {
              logWarning(
                `[Alazterflix] Falha ao excluir arquivo de imagem legado "${candidatePath}": ${String(err)}`,
                LogPrefix.Backend
              )
            }
          }
        }
      }
    } catch {}
  }

  return {
    localPath: path,
    streamUrl: `imagecache://localhost/${encodeURIComponent(path)}?v=${Date.now()}`
  }
}
