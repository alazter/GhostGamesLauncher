/**
 * Gerenciador de Congelamento de Capas Animadas em Segundo Plano (Ghost Games Launcher)
 *
 * Quando a janela do Ghost perde foco (outro software focado ou sobreposto) ou fica oculta/minimizada:
 * - Consulta o cabeçalho `X-Ghost-Animated` em cache (0ms via RAM no protocolo `imagecache://`)
 * - Somente para imagens realmente animadas (WebP animado, GIF ou APNG), captura 1 frame estático
 *   em um <canvas> offscreen e troca o `src` para um `blob:` estático (preservando transparência e dimensões)
 * - Para imagens estáticas (JPG, PNG estático, WebP estático, SVG), não faz NENHUM trabalho extra
 * - Ao retornar o foco para a janela do Ghost, restaura instantaneamente o `src` original animado.
 */

type ActivityListener = (active: boolean) => void

const listeners = new Set<ActivityListener>()
let windowActive =
  typeof document !== 'undefined'
    ? !document.hidden && document.hasFocus()
    : true
let initialized = false

function notifyIfChanged(nextActive: boolean): void {
  if (nextActive === windowActive) return
  windowActive = nextActive
  listeners.forEach((cb) => {
    try {
      cb(windowActive)
    } catch {}
  })
}

function recomputeActivity(): void {
  if (typeof document === 'undefined') return
  const active = !document.hidden && document.hasFocus()
  notifyIfChanged(active)
}

function ensureWindowActivityListeners(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  initialized = true
  windowActive = !document.hidden && document.hasFocus()

  window.addEventListener('blur', () => notifyIfChanged(false))
  window.addEventListener('focus', () => {
    notifyIfChanged(!document.hidden)
  })
  document.addEventListener('visibilitychange', recomputeActivity)
}

export function isGhostWindowActive(): boolean {
  ensureWindowActivityListeners()
  return windowActive
}

export function subscribeWindowActivity(listener: ActivityListener): () => void {
  ensureWindowActivityListeners()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const MAX_STATUS_CACHE = 2000
const animatedStatusCache = new Map<string, boolean>()
const inFlightChecks = new Map<string, Promise<boolean>>()

const MAX_FROZEN_CACHE = 150
const frozenFrameCache = new Map<string, string>()

let sharedCanvas: HTMLCanvasElement | null = null

function rememberAnimatedStatus(src: string, isAnimated: boolean): boolean {
  if (animatedStatusCache.size >= MAX_STATUS_CACHE) {
    const oldest = animatedStatusCache.keys().next().value
    if (oldest !== undefined) animatedStatusCache.delete(oldest)
  }
  animatedStatusCache.set(src, isAnimated)
  return isAnimated
}

function storeFrozenBlobUrl(src: string, blobUrl: string): string {
  const existing = frozenFrameCache.get(src)
  if (existing) {
    frozenFrameCache.delete(src)
    if (existing !== blobUrl && existing.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existing)
      } catch {}
    }
  }
  while (frozenFrameCache.size >= MAX_FROZEN_CACHE) {
    const oldestKey = frozenFrameCache.keys().next().value
    if (oldestKey === undefined) break
    const oldestUrl = frozenFrameCache.get(oldestKey)
    frozenFrameCache.delete(oldestKey)
    if (oldestUrl && oldestUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(oldestUrl)
      } catch {}
    }
  }
  frozenFrameCache.set(src, blobUrl)
  return blobUrl
}

function extractUnderlyingUrl(src: string): string {
  if (src.startsWith('imagecache://localhost/')) {
    try {
      return decodeURIComponent(src.slice('imagecache://localhost/'.length).split('?')[0])
    } catch {
      return src
    }
  }
  if (src.startsWith('imagecache://')) {
    try {
      return decodeURIComponent(src.slice('imagecache://'.length).split('?')[0])
    } catch {
      return src
    }
  }
  return src
}

export function canUrlBeAnimated(src: string): boolean {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false
  const inner = extractUnderlyingUrl(src).toLowerCase().split('?')[0]
  if (
    inner.endsWith('.jpg') ||
    inner.endsWith('.jpeg') ||
    inner.endsWith('.svg') ||
    inner.endsWith('.ico') ||
    inner.endsWith('.bmp')
  ) {
    return false
  }
  return true
}

export function getCachedFrozenFrame(src: string): string | null {
  return frozenFrameCache.get(src) || null
}

/**
 * Consulta se uma URL é realmente animada (WebP animado, GIF ou APNG).
 * Para URLs `imagecache://`, faz um HEAD ultra-rápido (~0.1ms em RAM) lendo `X-Ghost-Animated`.
 */
export async function checkIsAnimatedImage(src: string): Promise<boolean> {
  if (!canUrlBeAnimated(src)) return false

  const cached = animatedStatusCache.get(src)
  if (cached !== undefined) return cached

  const pending = inFlightChecks.get(src)
  if (pending) return pending

  if (!src.startsWith('imagecache://')) {
    const lower = src.toLowerCase().split('?')[0]
    const guess =
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.apng')
    return rememberAnimatedStatus(src, guess)
  }

  const probe = fetch(src, { method: 'HEAD' })
    .then((res) => {
      const animated = res.headers.get('X-Ghost-Animated') === '1'
      return rememberAnimatedStatus(src, animated)
    })
    .catch(() => rememberAnimatedStatus(src, false))
    .finally(() => {
      inFlightChecks.delete(src)
    })

  inFlightChecks.set(src, probe)
  return probe
}

/**
 * Captura um único frame estático do elemento <img> carregado em formato WebP estático (com alpha)
 * e armazena em cache LRU limitado de `blob:` URLs.
 */
export async function captureStaticFrame(
  src: string,
  imgEl: HTMLImageElement
): Promise<string | null> {
  const cached = frozenFrameCache.get(src)
  if (cached) return cached

  if (!imgEl || !imgEl.complete || imgEl.naturalWidth <= 0 || imgEl.naturalHeight <= 0) {
    return null
  }

  try {
    const maxDim = 600
    const scale = Math.min(1, maxDim / Math.max(imgEl.naturalWidth, imgEl.naturalHeight))
    const width = Math.max(1, Math.round(imgEl.naturalWidth * scale))
    const height = Math.max(1, Math.round(imgEl.naturalHeight * scale))

    if (!sharedCanvas) {
      sharedCanvas = document.createElement('canvas')
    }
    sharedCanvas.width = width
    sharedCanvas.height = height
    const ctx = sharedCanvas.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(imgEl, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        sharedCanvas!.toBlob((b) => resolve(b), 'image/webp', 0.88)
      } catch {
        resolve(null)
      }
    })

    if (blob) {
      const blobUrl = URL.createObjectURL(blob)
      return storeFrozenBlobUrl(src, blobUrl)
    }

    const dataUrl = sharedCanvas.toDataURL('image/png')
    return storeFrozenBlobUrl(src, dataUrl)
  } catch {
    // Canvas tainted por origem externa sem CORS — ignora com segurança
    return null
  }
}
