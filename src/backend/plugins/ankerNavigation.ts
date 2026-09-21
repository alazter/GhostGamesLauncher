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
export function loadAnkerPage(
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
    const ready = () => {
      if (window.isDestroyed()) return
      void window.webContents
        .executeJavaScript(
          `location.origin === ${JSON.stringify(origin)} && Boolean(document.body) && document.readyState !== 'loading'`
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
