import { builtinGameSources } from 'common/builtinGameSources'
import { sourceCandidates, isSourceUrl, markSourceAvailable, sourceOrigins } from './sourceSettings'
import type { BrowserWindow } from 'electron'

export async function evaluateAnkerPage(
  window: BrowserWindow,
  script: string
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      window.webContents.executeJavaScript(script),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), 3000)
      })
    ])
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

// A redirect can reject loadURL with ERR_ABORTED even as its replacement
// document loads successfully. Wait for that document, not all subresources.
export async function loadAnkerPage(
  window: BrowserWindow, url: string, origin = new URL(url).origin, providerName = 'AnkerGames'
): Promise<void> {
  const source = builtinGameSources.find(item => isSourceUrl(item.id, url))
  let failure: unknown
  for (const candidate of source ? sourceCandidates(source.id, url) : [url]) {
    if (window.isDestroyed()) break
    try {
      await loadSinglePage(window, candidate, source ? new URL(candidate).origin : origin, providerName)
      if (source) markSourceAvailable(source.id, candidate)
      return
    } catch (error) { failure = error }
  }
  throw failure || new Error('A janela foi fechada.')
}

function loadSinglePage(
  window: BrowserWindow,
  url: string,
  origin = 'https://ankergames.net',
  providerName = 'AnkerGames'
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      window.webContents.removeListener('dom-ready', ready)
      window.removeListener('closed', closed)
      if (error) reject(error)
      else resolve()
    }
    const source = builtinGameSources.find(item => isSourceUrl(item.id, url))
    const acceptedOrigins = source ? sourceOrigins(source.id).flatMap(value => [value, new URL(value).hostname.startsWith('www.') ? value : value.replace('https://', 'https://www.')]) : [origin]
    const ready = () => {
      if (window.isDestroyed()) return
      void window.webContents
        .executeJavaScript(
          `${JSON.stringify(acceptedOrigins)}.includes(location.origin) && Boolean(document.body) && document.readyState !== 'loading'`
        )
        .then((valid: unknown) => {
          if (valid === true) finish()
        })
        .catch(() => undefined)
    }
    const closed = () =>
      finish(
        new Error(`A janela do ${providerName} foi fechada. Tente novamente.`)
      )
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            `O ${providerName} demorou para carregar a página. Tente novamente; sua sessão foi preservada.`
          )
        ),
      30000
    )
    window.webContents.on('dom-ready', ready)
    window.on('closed', closed)
    void window
      .loadURL(url)
      .then(ready)
      .catch((error: unknown) => {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : ''
        if (code === 'ERR_ABORTED') {
          ready()
          return
        }
        // Only a bounded Chromium error code may be displayed, never the URL.
        const diagnostic = /^ERR_[A-Z_]{1,64}$/.test(code) ? ` (${code})` : ''
        finish(
          new Error(
            `Falha ao carregar a página do ${providerName}${diagnostic}. Tente novamente; esse erro não confirma perda do login.`
          )
        )
      })
  })
}
