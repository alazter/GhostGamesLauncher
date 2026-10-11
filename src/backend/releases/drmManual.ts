import { BrowserWindow, session } from 'electron'
import { join } from 'path'
import type { PluginManifest } from 'common/types/plugins'
import type { ReleaseDrmSource } from 'common/releaseDrm'
import { normalizeDrmTitle, safeDrmSourceUrl } from 'common/releaseDrm'
import { engineProcess } from '../plugins/engineProcess'
import { engineProxy } from '../plugins/engineProxy'
import { withSourceEngine } from '../plugins/sourceEngines'
import { drmPageUnavailable } from './drmSitesParser'

const HIZ = 'https://hizsearch.pages.dev/'
const hizHosts = new Set([
  'hizsearch.pages.dev',
  'hizapi.onrender.com',
  'challenges.cloudflare.com'
])
function allowedHizUrl(raw: string) {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      hizHosts.has(url.hostname)
    )
  } catch {
    return false
  }
}

// These queues own browser profiles. Ordinary DRM reads never enter either queue.
let ankerQueue: Promise<unknown> = Promise.resolve()
let hizQueue: Promise<unknown> = Promise.resolve()
const capabilities = new Map<string, Promise<boolean>>()
function workerResult(output: string): Record<string, unknown> {
  const value: unknown = JSON.parse(output)
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Resposta inválida do motor.')
  return value as Record<string, unknown>
}
export function readAnkerManualPage(url: string): Promise<string | undefined> {
  if (!safeDrmSourceUrl(url) || new URL(url).hostname !== 'ankergames.net')
    return Promise.reject(new Error('Endereço de fonte inválido.'))
  const result = ankerQueue
    .catch(() => undefined)
    .then(async () => {
      const response = await withSourceEngine(
        'scrapling',
        async (executable, data) => {
          if (!capabilities.has(executable))
            capabilities.set(
              executable,
              engineProcess(executable, ['--self-test'])
                .then((output) => {
                  const supported = workerResult(output).capabilities
                  return (
                    Array.isArray(supported) &&
                    supported.includes('manual-drm-page-v1')
                  )
                })
                .catch((error) => {
                  capabilities.delete(executable)
                  throw error
                })
            )
          if (!(await capabilities.get(executable)))
            throw new Error(
              'Atualize o Scrapling em Plugins para consultar esta fonte.'
            )
          const manifest = {
            id: 'com.ghost.manual-drm',
            name: 'Consulta manual de DRM',
            permissions: ['network'],
            allowedDomains: ['ankergames.net', 'challenges.cloudflare.com']
          } as PluginManifest
          const proxy = await engineProxy(manifest)
          try {
            const output = workerResult(
              await engineProcess(
                executable,
                [],
                JSON.stringify({
                  protocol: 1,
                  operation: 'manual-drm-page-v1',
                  url,
                  storage: join(data, 'drm-anker'),
                  proxy: proxy.url
                }),
                65000
              )
            )
            if (output.error || typeof output.html !== 'string')
              throw new Error(
                typeof output.error === 'string'
                  ? output.error.slice(0, 1000)
                  : 'Fonte indisponível.'
              )
            if (output.status === 404) return { html: undefined }
            if (
              output.status !== 200 ||
              typeof output.url !== 'string' ||
              !safeDrmSourceUrl(output.url) ||
              new URL(output.url).hostname !== 'ankergames.net'
            )
              throw new Error('A fonte não forneceu uma página válida.')
            if (Buffer.byteLength(output.html, 'utf8') > 2 * 1024 * 1024)
              throw new Error('Página da fonte muito grande.')
            const notice = drmPageUnavailable(output.html)
            if (notice) throw new Error(notice)
            return { html: output.html }
          } finally {
            proxy.close()
          }
        }
      )
      if (!response)
        throw new Error('Scrapling indisponível. Verifique o motor em Plugins.')
      return response.html
    })
  ankerQueue = result
  return result
}

let hizWindow: BrowserWindow | undefined
let hizLoaded: Promise<void> | undefined
let verification: Promise<boolean> | undefined
let hizBlocked = false
let hizLoadFailed = false
let hizSessionPrepared = false
/** Keep persisted cookies; stop site scripts when the user-requested batch ends. */
export function endManualDrm() {
  if (!verification && hizWindow && !hizWindow.isDestroyed())
    hizWindow.destroy()
}
const inputSelector =
  'input[type="text"],input[type="search"],input:not([type])'
const readyScript = `(() => {
  if (location.origin !== 'https://hizsearch.pages.dev') return false;
  return Array.from(document.querySelectorAll(${JSON.stringify(inputSelector)})).some(e => !e.disabled && e.getBoundingClientRect().width > 0);
})()`
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))
async function windowForHiz() {
  if (!hizWindow || hizWindow.isDestroyed()) {
    const browserSession = session.fromPartition('persist:ghost-drm-hiz')
    if (!hizSessionPrepared) {
      browserSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false)
      )
      browserSession.setPermissionCheckHandler(() => false)
      browserSession.webRequest.onBeforeRequest((details, callback) =>
        callback({ cancel: !allowedHizUrl(details.url) })
      )
      browserSession.on('will-download', (event) => event.preventDefault())
      hizSessionPrepared = true
    }
    const window = new BrowserWindow({
      width: 1050,
      height: 760,
      show: false,
      title: 'Ghost · Liberar acesso ao HizSearch',
      autoHideMenuBar: true,
      webPreferences: {
        session: browserSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
      }
    })
    window.webContents.setAudioMuted(true)
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== new URL(HIZ).origin) event.preventDefault()
    })
    window.webContents.on('will-attach-webview', (event) =>
      event.preventDefault()
    )
    window.on('closed', () => {
      if (hizWindow === window) {
        hizWindow = undefined
        hizLoaded = undefined
        hizBlocked = false
      }
    })
    hizWindow = window
    hizLoadFailed = false
    hizLoaded = window.loadURL(HIZ).catch(() => {
      hizLoadFailed = true
    })
  }
  const current = hizWindow
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    hizLoaded,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 12000)
    })
  ]).finally(() => clearTimeout(timer))
  if (hizLoadFailed) throw new Error('HizSearch indisponível.')
  return current
}
async function ready(window: BrowserWindow) {
  if (window.isDestroyed()) return false
  const value: unknown = await window.webContents
    .executeJavaScript(readyScript)
    .catch(() => false)
  return value === true
}

/** Only the explicit Liberar acesso action shows a window; other games keep running. */
export function verifyHizAccess(): Promise<boolean> {
  if (verification) return verification
  const result = (async () => {
    const window = await windowForHiz()
    if (window.isDestroyed()) return false
    window.show()
    window.focus()
    const deadline = Date.now() + 3 * 60000
    while (!window.isDestroyed() && Date.now() < deadline) {
      if (await ready(window)) {
        hizBlocked = false
        window.hide()
        return true
      }
      await wait(500)
    }
    if (!window.isDestroyed()) window.hide()
    return false
  })()
  verification = result
  void result
    .finally(() => {
      verification = undefined
    })
    .catch(() => undefined)
  return result
}

export function readHizManualSource(title: string): Promise<ReleaseDrmSource> {
  const result = hizQueue
    .catch(() => undefined)
    .then(async (): Promise<ReleaseDrmSource> => {
      const base: ReleaseDrmSource = { name: 'HizSearch', url: HIZ }
      try {
        if (hizBlocked && !verification)
          return {
            ...base,
            requiresVerification: true,
            notice:
              'Clique em Liberar acesso ao HizSearch para confirmar a verificação no site.'
          }
        const window = await windowForHiz()
        if (!(await ready(window))) {
          hizBlocked = true
          return {
            ...base,
            requiresVerification: true,
            notice:
              'Clique em Liberar acesso ao HizSearch para confirmar a verificação no site.'
          }
        }
        // Drive the site's own search form. No API key, token, or cookie is exported.
        const submitted: unknown = await window.webContents
          .executeJavaScript(`(() => {
        if (location.origin !== 'https://hizsearch.pages.dev') return false;
        const input = Array.from(document.querySelectorAll(${JSON.stringify(inputSelector)})).find(e => !e.disabled && e.getBoundingClientRect().width > 0);
        if (!input) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(title)});
        input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
        if (input.form) input.form.requestSubmit();
        else input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',code:'Enter',bubbles:true}));
        return true;
      })()`)
        if (submitted !== true)
          throw new Error('O campo de busca não está disponível.')
        await wait(1500)
        // Extract title and public result labels, never credentials or download targets.
        const rows: unknown = await window.webContents
          .executeJavaScript(`(() => {
        if (location.origin !== 'https://hizsearch.pages.dev') return [];
        return Array.from(document.querySelectorAll('h2,h3,h4,[data-title],.game-title,.result-title')).slice(0,200).map(e => ({ title:(e.getAttribute('data-title') || e.textContent || '').trim().slice(0,300), text:(e.closest('article,li,[data-result],.result,.game-card')?.innerText || '').slice(0,1000) }));
      })()`)
        if (!(await ready(window))) {
          hizBlocked = true
          return {
            ...base,
            requiresVerification: true,
            notice:
              'A verificação do HizSearch expirou. Clique em Liberar acesso.'
          }
        }
        const row =
          Array.isArray(rows) &&
          rows
            .slice(0, 200)
            .find((item: unknown): item is { title: string } => {
              if (
                !item ||
                typeof item !== 'object' ||
                !('title' in item) ||
                typeof item.title !== 'string'
              )
                return false
              return (
                item.title.length <= 300 &&
                normalizeDrmTitle(item.title) === normalizeDrmTitle(title)
              )
            })
        if (!row)
          return {
            ...base,
            notice: 'Título ou status não confirmado nesta fonte.'
          }
        // Search indexes confirm a listing only. A result label cannot establish a crack.
        return {
          ...base,
          title: row.title,
          availability: 'listed',
          observedAt: new Date().toISOString(),
          notice:
            'Título encontrado no HizSearch; a listagem não confirma quebra de DRM.'
        }
      } catch {
        return {
          ...base,
          notice: 'HizSearch indisponível; consulte o link da fonte.'
        }
      }
    })
  hizQueue = result
  return result
}
