import { BrowserWindow, session } from 'electron'
import { safeDrmSourceUrl, type ReleaseDrmSource } from 'common/releaseDrm'
import {
  drmPageUnavailable,
  parseDrmSiteGame,
  findDrmSiteGame
} from './drmSitesParser'

import { showDrmAccessWindow } from './drmAccessWindow'

let tail: Promise<unknown> = Promise.resolve()
let prepared = false
let limitedUntil = 0

/** User opens the source in the same persistent profile used by the DRM reader. */
export function openSkidrowSource(
  title: string,
  url: string
): Promise<ReleaseDrmSource> {
  if (
    !safeDrmSourceUrl(url) ||
    new URL(url).hostname !== 'www.skidrowreloaded.com' ||
    !title.trim() ||
    title.length > 300
  )
    return Promise.reject(new Error('Fonte ou jogo inválido.'))
  const result = tail
    .catch(() => undefined)
    .then(async () => {
      if (Date.now() < limitedUntil)
        throw new Error(
          'SkidrowReloaded está limitando consultas. Aguarde e tente novamente.'
        )
      const window = new BrowserWindow({
        show: false,
        width: 1050,
        height: 760,
        autoHideMenuBar: true,
        title: 'Ghost · Liberar acesso ao SkidrowReloaded',
        webPreferences: {
          session: skidrowSession(),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
          backgroundThrottling: false
        }
      })
      window.webContents.setAudioMuted(true)
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      const guard = (event: Electron.Event, target: string) => {
        if (
          !safeDrmSourceUrl(target) ||
          new URL(target).origin !== 'https://www.skidrowreloaded.com'
        )
          event.preventDefault()
      }
      window.webContents.on('will-navigate', guard)
      window.webContents.on('will-redirect', guard)
      showDrmAccessWindow(window, 'Ghost · Liberar acesso ao SkidrowReloaded')
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          (async () => {
            await window.loadURL(url)
            while (!window.isDestroyed()) {
              const html: unknown = await window.webContents.executeJavaScript(
                'document.documentElement.outerHTML.slice(0, 2 * 1024 * 1024 + 1)'
              )
              if (typeof html !== 'string' || html.length > 2 * 1024 * 1024)
                throw new Error('Resposta da fonte inválida.')
              const notice = drmPageUnavailable(html)
              if (/limite temporário|manutenção/i.test(notice || ''))
                throw new Error(notice)
              const current = window.webContents.getURL()
              const source = parseDrmSiteGame(
                html,
                title,
                current,
                'SkidrowReloaded'
              )
              if (source) return source
              if (!notice) {
                const match = findDrmSiteGame(html, title, 'SkidrowReloaded')
                if (match && match !== current) {
                  await window.loadURL(match)
                  continue
                }
              }
              await new Promise((resolve) => setTimeout(resolve, 500))
            }
            throw new Error('Verificação de acesso encerrada.')
          })(),
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(
              () =>
                reject(
                  new Error(
                    'Não foi possível confirmar o conteúdo do jogo após a verificação.'
                  )
                ),
              180000
            )
            window.once('closed', () =>
              reject(new Error('Verificação de acesso encerrada.'))
            )
          })
        ])
      } finally {
        if (deadline) clearTimeout(deadline)
        if (!window.isDestroyed()) window.destroy()
      }
    })
  tail = result
  return result
}

function skidrowSession() {
  const partition = session.fromPartition('persist:ghost-drm-skidrow-public')
  if (!prepared) {
    partition.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    partition.setPermissionCheckHandler(() => false)
    partition.on('will-download', (event) => event.preventDefault())
    partition.webRequest.onBeforeRequest((details, callback) => {
      const target = new URL(details.url)
      callback({
        cancel:
          target.protocol !== 'https:' ||
          ![
            'www.skidrowreloaded.com',
            'skidrowreloaded.com',
            'challenges.cloudflare.com'
          ].includes(target.hostname) ||
          ['image', 'media', 'font'].includes(details.resourceType)
      })
    })
    partition.webRequest.onHeadersReceived((details, callback) => {
      if (details.resourceType === 'mainFrame' && details.statusCode === 429) {
        const retry =
          Object.entries(details.responseHeaders || {}).find(
            ([key]) => key.toLowerCase() === 'retry-after'
          )?.[1]?.[0] || ''
        const until = /^\d+$/.test(retry)
          ? Date.now() + Number(retry) * 1000
          : Date.parse(retry)
        limitedUntil = Math.max(
          Date.now() + 60000,
          Number.isFinite(until) ? until : 0
        )
      }
      callback({})
    })
    prepared = true
  }
  return partition
}

/** Public page fallback used only by the explicit general DRM action. */
export function readSkidrowManualPage(
  url: string
): Promise<string | undefined> {
  if (
    !safeDrmSourceUrl(url) ||
    new URL(url).hostname !== 'www.skidrowreloaded.com'
  )
    return Promise.reject(new Error('Endereço de fonte inválido.'))
  const result = tail
    .catch(() => undefined)
    .then(async () => {
      if (Date.now() < limitedUntil)
        throw new Error(
          'Consulta indisponível: limite temporário de acesso ao SkidrowReloaded.'
        )
      const partition = skidrowSession()
      const window = new BrowserWindow({
        show: false,
        webPreferences: {
          session: partition,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
          backgroundThrottling: false
        }
      })
      window.webContents.setAudioMuted(true)
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      const guard = (event: Electron.Event, destination: string) => {
        const target = new URL(destination)
        if (
          target.origin !== 'https://www.skidrowreloaded.com' ||
          !safeDrmSourceUrl(destination)
        )
          event.preventDefault()
      }
      window.webContents.on('will-navigate', guard)
      window.webContents.on('will-redirect', guard)
      let status = 0
      window.webContents.on('did-navigate', (_event, _url, code) => {
        status = code
      })
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          (async () => {
            await window.loadURL(url)
            if (status === 404) return undefined
            if (Date.now() < limitedUntil)
              throw new Error(
                'Consulta indisponível: limite temporário de acesso ao SkidrowReloaded.'
              )
            for (let attempt = 0; attempt < 15; attempt++) {
              const html: unknown = await window.webContents
                .executeJavaScript(`(() => {
              if (!document.querySelector('.post-extended, h2 a')) return undefined;
              const html = document.documentElement.outerHTML;
              return html.length <= 2 * 1024 * 1024 ? html : '';
            })()`)
              if (typeof html === 'string') {
                const notice = drmPageUnavailable(html)
                if (notice) throw new Error(notice)
                if (!html) throw new Error('Página da fonte muito grande.')
                return html
              }
              await new Promise((resolve) => setTimeout(resolve, 400))
            }
            throw new Error(
              'SkidrowReloaded indisponível ou exigindo verificação no site.'
            )
          })(),
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(
              () =>
                reject(
                  new Error('Tempo de consulta do SkidrowReloaded esgotado.')
                ),
              22000
            )
          })
        ])
      } finally {
        if (deadline) clearTimeout(deadline)
        if (!window.isDestroyed()) window.destroy()
      }
    })
  tail = result
  return result
}
