import { BrowserWindow, session } from 'electron'
import { logInfo, logWarning, LogPrefix } from 'backend/logger'

const imdbCache = new Map<string, { resolvedUrl: string; expiresAt: number }>()

/**
 * Verifica se uma URL é pertencente ao ecossistema IMDb / Amazon Media CDN.
 */
export function isImdbUrl(rawUrl?: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  return (
    /https?:\/\/(?:www\.)?imdb\.com\//i.test(trimmed) ||
    /https?:\/\/m\.media-amazon\.com\/images\/M\//i.test(trimmed)
  )
}

/**
 * Verifica se a URL é uma página web do IMDb (como mediaviewer ou title) e não a imagem direta do CDN.
 */
export function isImdbWebPageUrl(rawUrl?: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  return (
    /https?:\/\/(?:www\.)?imdb\.com\//i.test(trimmed) &&
    !/https?:\/\/m\.media-amazon\.com\/images\/M\//i.test(trimmed)
  )
}

/**
 * Normaliza uma URL de imagem do CDN da Amazon/IMDb para qualidade total original sem cortes ou compressões.
 * Exemplo: ..._V1_FMjpg_UX1000_.jpg -> ..._V1_.jpg
 */
export function normalizeImdbImageUrl(imageUrl: string): string {
  if (!imageUrl.includes('m.media-amazon.com/images/M/')) {
    return imageUrl
  }

  // Remove parâmetros de corte e redimensionamento mantendo a extensão
  return imageUrl.replace(/\.?[._]V1_.*?\.(jpe?g|png|webp)/i, '._V1_.$1')
}

/**
 * Resolve um link de capa do IMDb (ex: mediaviewer, title ou link direto) retornando a URL da imagem em alta resolução.
 */
export async function resolveImdbCoverImage(
  rawUrl: string
): Promise<string | null> {
  if (!isImdbUrl(rawUrl)) return null

  const trimmedUrl = rawUrl.trim()

  // Se já for um link direto de imagem do CDN
  if (trimmedUrl.includes('m.media-amazon.com/images/M/')) {
    return normalizeImdbImageUrl(trimmedUrl)
  }

  // Verificar cache em memória (TTL: 1 hora)
  const cached = imdbCache.get(trimmedUrl)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.resolvedUrl
  }

  logInfo(
    `[ImdbResolver] Resolvendo capa da página do IMDb: ${trimmedUrl}`,
    LogPrefix.Backend
  )

  return new Promise<string | null>((resolve) => {
    let settled = false
    let timer: NodeJS.Timeout | null = null
    let pollInterval: NodeJS.Timeout | null = null
    let win: BrowserWindow | null = null

    const finish = (result: string | null) => {
      if (settled) return
      settled = true

      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }

      if (win && !win.isDestroyed()) {
        try {
          win.destroy()
        } catch {}
        win = null
      }

      if (result) {
        imdbCache.set(trimmedUrl, {
          resolvedUrl: result,
          expiresAt: Date.now() + 60 * 60 * 1000
        })
        logInfo(
          `[ImdbResolver] Capa resolvida com sucesso: ${result}`,
          LogPrefix.Backend
        )
      } else {
        logWarning(
          `[ImdbResolver] Não foi possível extrair a imagem do link IMDb: ${trimmedUrl}`,
          LogPrefix.Backend
        )
      }

      resolve(result)
    }

    // Timeout de segurança: 15 segundos
    timer = setTimeout(() => {
      finish(null)
    }, 15000)

    try {
      const imdbSession = session.fromPartition('persist:imdb-session')
      imdbSession.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      )

      // Bloqueia mídias pesadas (áudio/vídeo) para aceleração
      imdbSession.webRequest.onBeforeRequest(
        { urls: ['*://*/*'] },
        (details, callback) => {
          if (['media', 'font'].includes(details.resourceType)) {
            callback({ cancel: true })
          } else {
            callback({ cancel: false })
          }
        }
      )

      win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          session: imdbSession,
          sandbox: false,
          contextIsolation: false,
          nodeIntegration: false
        }
      })

      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

      const inspectDom = async () => {
        if (!win || win.isDestroyed() || settled) return
        try {
          const extracted: { isWaf?: boolean; url?: string } | null =
            await win.webContents.executeJavaScript(`
            (() => {
              const html = document.documentElement.outerHTML || ''
              if (html.includes('awsWafCookieDomainList') && html.length < 5000) {
                return { isWaf: true }
              }

              // 1. Tag meta og:image do IMDb
              const og = document.querySelector('meta[property="og:image"]')?.content ||
                         document.querySelector('meta[content*="media-amazon.com/images/M/"]')?.content
              if (og && og.includes('media-amazon.com/images/M/')) {
                return { url: og }
              }

              // 2. Tag img da visualização de mídia
              const imgs = Array.from(document.querySelectorAll('img'))
                .map(i => i.src)
                .filter(src => src && src.includes('m.media-amazon.com/images/M/'))
              if (imgs.length > 0) {
                return { url: imgs[0] }
              }

              // 3. Objeto de dados __NEXT_DATA__
              const nextEl = document.getElementById('__NEXT_DATA__')
              if (nextEl && nextEl.textContent) {
                const matches = nextEl.textContent.match(/https:\\/\\/m\\.media-amazon\\.com\\/images\\/M\\/[a-zA-Z0-9_.,@\\-]+/g)
                if (matches && matches.length > 0) {
                  return { url: matches[0].replace(/\\\\/g, '') }
                }
              }

              return null
            })()
          `)

          if (extracted?.url) {
            const finalImage = normalizeImdbImageUrl(extracted.url)
            finish(finalImage)
          }
        } catch {
          // Janela navegando ou script em execução
        }
      }

      win.webContents.on('did-finish-load', () => {
        void inspectDom()
      })

      pollInterval = setInterval(() => {
        void inspectDom()
      }, 800)

      win.loadURL(trimmedUrl).catch(() => finish(null))
    } catch (err) {
      logWarning(
        `[ImdbResolver] Erro ao inicializar janela de resolução IMDb: ${String(err)}`,
        LogPrefix.Backend
      )
      finish(null)
    }
  })
}
