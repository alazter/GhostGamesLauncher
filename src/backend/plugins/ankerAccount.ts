import { isSourceUrl, sourceDomains, canonicalSourceUrl } from './sourceSettings'
import { BrowserWindow, session, type DownloadItem } from 'electron'
import { mkdir, readFile, rm } from 'fs/promises'
import { dirname } from 'path'
import { setTimeout as delay } from 'timers/promises'
import { torrentInfoHash } from './torrentMetadata'
import { loadAnkerPage, evaluateAnkerPage } from './ankerNavigation'
import { TRUSTED_GAME_MIRROR_DOMAINS, NetworkGuard } from './networkGuard'
import type { PluginManifest } from 'common/types/plugins'
import { romSource, romPageUrl, romManifest } from './romSources'
import { directDownloadRecovery, type DirectDownloadDiagnostic } from './directDownloadRecovery'
import { rangedDownload } from './rangedDownload'

export const ANKER_SOURCE_ID = 'com.ghost.ankergames-source'
export const ANKER_TORRENT_ID = 'anker-official-torrent'
export const ANKER_DIRECT_ID = 'anker-browser-direct'
export const STEAMRIP_SOURCE_ID = 'com.ghost.steamrip-source'
export const STEAMRIP_DIRECT_ID = 'steamrip-browser-direct'
export function steamripGameUrl(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    !isSourceUrl(STEAMRIP_SOURCE_ID, value) ||
    url.username ||
    url.password ||
    url.pathname === '/'
  )
    throw new Error('Página de jogo SteamRIP inválida.')
  url.search = ''
  url.hash = ''
  return canonicalSourceUrl(STEAMRIP_SOURCE_ID, url.href)
}
const baseDirectManifest = {
  permissions: ['network', 'game-sources'],
  allowedDomains: [
    'ankergames.net',
    'steamrip.com',
    'challenges.cloudflare.com',
    ...TRUSTED_GAME_MIRROR_DOMAINS
  ]
} as PluginManifest
export function directDownloadManifest(steamrip: boolean): PluginManifest {
  return {
    ...baseDirectManifest,
    // Observed in the user's Download Now navigation on 2026-09-19.
    // Scope the exact relay host to Anker; do not trust all of dlproxy.uk.
    allowedDomains: [
      ...baseDirectManifest.allowedDomains!,
      ...sourceDomains(steamrip ? STEAMRIP_SOURCE_ID : ANKER_SOURCE_ID),
      ...(steamrip ? [] : ['tunnel5.dlproxy.uk'])
    ]
  }
}
export function ankerGameUrl(value: string): string {
  const url = new URL(value)
  if (
    !isSourceUrl(ANKER_SOURCE_ID, value) ||
    !/^\/game\/[^/]+\/?$/.test(url.pathname) ||
    url.username ||
    url.password
  )
    throw new Error('Página de jogo AnkerGames inválida.')
  url.hash = ''
  url.search = ''
  return canonicalSourceUrl(ANKER_SOURCE_ID, url.href)
}

export class AnkerAccount {
  private static busy = false
  private static connected = false
  private static families = new WeakMap<BrowserWindow, Set<BrowserWindow>>()
  private static getSession(
    direct = false,
    steamrip = false,
    onBlocked?: (host: string) => void,
    romProvider?: string
  ) {
    const directManifest = romProvider ? romManifest(romProvider) : directDownloadManifest(steamrip)
    const isolated = session.fromPartition(
      romProvider ? `persist:ghost-${romProvider}` : steamrip ? 'persist:ghost-steamrip' : 'persist:ghost-ankergames'
    )
    isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    isolated.setPermissionCheckHandler(() => false)
    isolated.webRequest.onBeforeRequest((details, callback) => {
      try {
        const url = new URL(details.url)
        const currentSourceId = steamrip ? STEAMRIP_SOURCE_ID : romProvider || ANKER_SOURCE_ID
        const allowed =
          (url.protocol === 'blob:' &&
            isSourceUrl(currentSourceId, url.origin)) ||
          (url.protocol === 'https:' &&
            (isSourceUrl(currentSourceId, url.href, true) ||
              url.hostname === 'challenges.cloudflare.com' ||
              url.hostname.endsWith('.cloudflare.com') ||
              (direct &&
                NetworkGuard.validateUrl(url.href, directManifest).allowed)))
        if (!allowed && details.resourceType === 'mainFrame')
          onBlocked?.(url.hostname)
        callback({ cancel: !allowed })
      } catch {
        callback({ cancel: true })
      }
    })
    return isolated
  }
  private static window(
    show: boolean,
    direct = false,
    steamrip = false,
    onBlocked?: (host: string) => void,
    romProvider?: string
  ) {
    const directManifest = romProvider ? romManifest(romProvider) : directDownloadManifest(steamrip)
    const window = new BrowserWindow({
      width: 1000,
      height: 760,
      show,
      title: romProvider ? `Ghost — Download ${romSource(romProvider)!.name}` : steamrip
        ? 'Ghost — Download SteamRIP'
        : 'Ghost — Conta AnkerGames',
      autoHideMenuBar: true,
      webPreferences: {
        session: this.getSession(direct, steamrip, onBlocked, romProvider),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        backgroundThrottling: false
      }
    })
    const family = new Set<BrowserWindow>([window])
    this.families.set(window, family)
    const currentSourceId = steamrip ? STEAMRIP_SOURCE_ID : romProvider || ANKER_SOURCE_ID
    const guard = (event: Electron.Event, target: string) => {
      try {
        if (
          !isSourceUrl(currentSourceId, target) &&
          !(
            direct &&
            new URL(target).protocol === 'https:' &&
            NetworkGuard.validateUrl(target, directManifest).allowed
          )
        ) {
          onBlocked?.(new URL(target).hostname)
          event.preventDefault()
        }
      } catch {
        event.preventDefault()
      }
    }
    const configure = (member: BrowserWindow) => {
      member.webContents.setWindowOpenHandler(({ url }) => {
        if (
          direct &&
          NetworkGuard.validateUrl(url, directManifest).allowed &&
          new URL(url).protocol === 'https:'
        ) {
          // Let Chromium preserve the opener, POST body and referrer. Replacing
          // this with loadURL in the parent converts the request into a GET.
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              autoHideMenuBar: true,
              webPreferences: {
                session: window.webContents.session,
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
                webviewTag: false,
                backgroundThrottling: false
              }
            }
          }
        }
        if (direct) {
          try {
            onBlocked?.(new URL(url).hostname)
          } catch {
            /* Remains blocked. */
          }
        }
        return { action: 'deny' }
      })
      member.webContents.on('will-navigate', guard)
      member.webContents.on('will-redirect', guard)
      member.webContents.on('did-create-window', (child) => {
        family.add(child)
        configure(child)
      })
    }
    configure(window)
    return window
  }
  private static async load(window: BrowserWindow, url: string) {
    await loadAnkerPage(window, url)
  }
  private static async evaluate(
    window: BrowserWindow,
    script: string
  ): Promise<unknown> {
    return evaluateAnkerPage(window, script)
  }
  static status(): boolean {
    return this.connected
  }
  static async direct(
    page: string,
    directory: string,
    signal: AbortSignal,
    progress: (bytes: number, total: number, archive: string) => void,
    provider: string = 'anker',
    diagnostic: (value: DirectDownloadDiagnostic) => void = () => undefined
  ): Promise<string> {
    const rom = romSource(provider)
    if (!rom && !['anker', 'steamrip'].includes(provider)) throw new Error('Fonte de download inválida.')
    const directManifest = rom ? romManifest(provider) : directDownloadManifest(provider === 'steamrip')
    const url =
      rom ? romPageUrl(provider, page) : provider === 'steamrip' ? steamripGameUrl(page) : ankerGameUrl(page)
    if (this.busy)
      throw new Error('Conclua a janela de download aberta antes de continuar.')
    await mkdir(directory, { recursive: true })
    let blockedHost = ''
    const window = this.window(true, true, provider === 'steamrip', (host) => {
      // Keep waiting: rejected popups may be ads, not the chosen file host.
      if (/^[a-z0-9.-]{1,253}$/i.test(host)) blockedHost = host
    }, rom ? provider : undefined)
    this.busy = true
    const isolated = window.webContents.session
    const family = this.families.get(window)!
    let item: DownloadItem | undefined
    let archive: string | undefined
    let completed = false
    let accelerating = false
    let acceleration: Promise<void> | undefined
    const accelerationController = new AbortController()
    let recovery: ReturnType<typeof directDownloadRecovery> | undefined
    let rejectOperation: (error: Error) => void = () => undefined
    const abort = () =>
      rejectOperation(
        new Error(
          'Download direto interrompido. Use Retomar para abrir o site novamente.'
        )
      )
    const waitingError = () =>
      new Error(
        blockedHost
          ? `O arquivo não foi recebido. Uma navegação para ${blockedHost} foi bloqueada; ela pode ser uma hospedagem ou publicidade. Informe qual botão de download você escolheu.`
          : 'A janela foi fechada antes de o Ghost receber um arquivo. Escolha a hospedagem e confirme o download do pacote antes de fechar a janela.'
      )
    const closed = () => {
      if (!item) rejectOperation(waitingError())
    }
    const timer = setTimeout(
      () =>
        rejectOperation(
          blockedHost
            ? waitingError()
            : new Error(
                'Nenhum arquivo recebido em três minutos. Use Retomar e confirme o download na hospedagem.'
              )
        ),
      180000
    )
    let onDownload: (
      event: Electron.Event,
      download: DownloadItem,
      contents: Electron.WebContents
    ) => void = () => undefined
    try {
      return await new Promise<string>((resolve, reject) => {
        rejectOperation = reject
        onDownload = (_event, download, contents) => {
          if (
            !contents ||
            ![...family].some(
              (member) =>
                !member.isDestroyed() && contents.id === member.webContents.id
            )
          )
            return
          const extension = (rom ? /\.(zip|rar|7z|tar|nsp|xci|nsz|xcz)$/i : /\.(zip|rar|7z|tar)$/i)
            .exec(download.getFilename())?.[1]
            ?.toLowerCase()
          const link = download.getURLChain?.().at(-1) || download.getURL()
          if (
            item ||
            !extension ||
            !NetworkGuard.validateUrl(link, directManifest).allowed ||
            !link.startsWith('https://')
          ) {
            download.cancel()
            if (!item)
              reject(
                new Error(
                  rom ? 'Escolha uma ROM NSP/XCI/NSZ/XCZ ou um pacote ZIP/RAR/7Z/TAR. Torrents não são aceitos nesta opção.' : 'Escolha o download direto de um pacote ZIP, RAR, 7Z ou TAR; esta opção não recebe torrents.'
                )
              )
            return
          }
          item = download
          clearTimeout(timer)
          archive = `${directory}/package.${extension}`
          download.setSavePath(archive)
          const report = () =>
            progress(
              download.getReceivedBytes(),
              download.getTotalBytes(),
              archive!
            )
          report()
          recovery = directDownloadRecovery(download, reject, diagnostic)
          download.on('updated', (_event, state) => {
            if (accelerating) return
            report()
            recovery?.updated(state)
          })
          download.once('done', (_event, state) => {
            if (accelerating) return
            recovery?.done(state)
            if (state === 'completed') {
              completed = true
              report()
              resolve(archive!)
            } else
              reject(
                new Error(
                  'A transferência terminou sem concluir e não permite recuperação nesta conexão. Use Retomar para confirmar outro link no site; o download será reiniciado. O navegador não informou a causa.'
                )
              )
          })
          // Keep Chromium's authenticated transfer paused as a safe fallback.
          // Only eligible large files with a strong validator use our range path.
          if (download.getTotalBytes() >= 32 * 1024 * 1024 && /^"[^\r\n]+"$/.test(download.getETag())) {
            const nativeArchive = archive
            const segmentedArchive = `${directory}/package-ranged.${extension}`
            const transferSignal = AbortSignal.any([signal, accelerationController.signal])
            accelerating = true
            download.pause()
            acceleration = (async () => {
              try {
                const transferred = await rangedDownload({
                  destination: segmentedArchive,
                  total: download.getTotalBytes(),
                  etag: download.getETag(),
                  signal: transferSignal,
                  fetch: async (headers, requestSignal) => {
                    if (!NetworkGuard.validateUrl(link, directManifest).allowed) throw new Error('Servidor de download não permitido.')
                    return isolated.fetch(link, {
                      headers, signal: requestSignal, credentials: 'include',
                      redirect: 'error', referrer: contents.getURL(),
                      referrerPolicy: 'strict-origin-when-cross-origin'
                    })
                  },
                  progress: bytes => {
                    archive = segmentedArchive
                    progress(bytes, download.getTotalBytes(), segmentedArchive)
                  },
                  event: event => diagnostic({ event, host: new URL(link).hostname,
                    bytes: 0, total: download.getTotalBytes(), canResume: download.canResume(), attempts: 0,
                    at: new Date().toISOString() })
                })
                transferSignal.throwIfAborted()
                if (transferred) {
                  completed = true
                  archive = segmentedArchive
                  recovery?.stop()
                  // The package is complete. A disposed browser item must not
                  // send us into the fallback and start another transfer.
                  try { download.cancel() } catch { /* Already closed. */ }
                  resolve(segmentedArchive)
                  return
                }
              } catch {
                if (transferSignal.aborted) return
                diagnostic({ event: 'ranged-fallback', host: new URL(link).hostname,
                  bytes: download.getReceivedBytes(), total: download.getTotalBytes(),
                  canResume: download.canResume(), attempts: 0, at: new Date().toISOString() })
              }
              archive = nativeArchive
              accelerating = false
              report()
              download.resume()
            })().catch(reject)
          }
          for (const member of family) if (!member.isDestroyed()) member.hide()
        }
        isolated.on('will-download', onDownload)
        signal.addEventListener('abort', abort, { once: true })
        window.on('closed', closed)
        if (signal.aborted) {
          abort()
          return
        }
        void loadAnkerPage(
          window,
          url,
          new URL(url).origin,
          rom?.name || (provider === 'steamrip' ? 'SteamRIP' : 'AnkerGames')
        ).catch(reject)
      })
    } finally {
      accelerationController.abort()
      await acceleration?.catch(() => undefined)
      recovery?.stop()
      clearTimeout(timer)
      isolated.removeListener('will-download', onDownload)
      signal.removeEventListener('abort', abort)
      window.removeListener('closed', closed)
      if (!completed) item?.cancel()
      for (const member of family) if (!member.isDestroyed()) member.destroy()
      this.families.delete(window)
      this.busy = false
      if (!completed && archive)
        await rm(archive, { force: true }).catch(() => undefined)
    }
  }
  static async disconnect(): Promise<void> {
    if (this.busy)
      throw new Error(
        'Feche ou conclua a operação AnkerGames antes de desconectar.'
      )
    await this.getSession().clearStorageData()
    this.connected = false
  }
  static async connect(): Promise<void> {
    if (this.busy)
      throw new Error('Já existe uma operação de conexão com o AnkerGames.')
    const window = this.window(true)
    this.busy = true
    try {
      await this.load(window, 'https://ankergames.net/login')
      const until = Date.now() + 180000
      while (!window.isDestroyed() && Date.now() < until) {
        const authenticated = (await this.evaluate(
          window,
          `Boolean(document.querySelector('form[action*="/logout"], a[href*="/logout"]'))`
        )) as boolean
        if (authenticated) {
          this.connected = true
          return
        }
        await delay(700)
      }
      throw new Error(
        'Conexão não confirmada. Entre na conta pela janela oficial do AnkerGames.'
      )
    } finally {
      if (!window.isDestroyed()) window.destroy()
      this.busy = false
    }
  }

  static async torrent(
    page: string,
    destination: string,
    signal: AbortSignal
  ): Promise<Buffer> {
    const url = ankerGameUrl(page)
    if (this.busy)
      throw new Error('Conclua a conexão com o AnkerGames e tente novamente.')
    const window = this.window(false)
    this.busy = true
    let item: DownloadItem | undefined
    let failure: Error | undefined
    let complete = false
    let verified = false
    const abort = () => {
      item?.cancel()
      if (!window.isDestroyed()) window.destroy()
    }
    const onDownload = (
      _event: Electron.Event,
      download: DownloadItem,
      contents: Electron.WebContents
    ) => {
      if (
        !contents ||
        window.isDestroyed() ||
        contents.id !== window.webContents.id
      )
        return
      if (
        item ||
        !/\.torrent$/i.test(download.getFilename()) ||
        download.getTotalBytes() > 16 * 1024 * 1024
      ) {
        download.cancel()
        failure = new Error(
          'O botão oficial não retornou um arquivo .torrent válido.'
        )
        return
      }
      item = download
      download.setSavePath(destination)
      download.on('updated', () => {
        if (download.getReceivedBytes() > 16 * 1024 * 1024) {
          failure = new Error('Arquivo torrent excedeu o limite permitido.')
          download.cancel()
        }
      })
      download.once('done', (_e, state) => {
        if (state === 'completed') complete = true
        else failure = new Error('O download do torrent foi interrompido.')
      })
    }
    const isolated = window.webContents.session
    // Keep the automatic path, but expose pending site interaction instead of
    // leaving an invisible window until the operation times out.
    const reveal = setTimeout(() => {
      if (!complete && !window.isDestroyed()) window.show()
    }, 8000)
    isolated.on('will-download', onDownload)
    signal.addEventListener('abort', abort, { once: true })
    try {
      signal.throwIfAborted()
      await mkdir(dirname(destination), { recursive: true })
      await this.load(window, url)
      const deadline = Date.now() + 90000
      let openedAt = 0,
        clicked = false,
        fileClicked = false
      while (!complete && Date.now() < deadline) {
        signal.throwIfAborted()
        if (failure) throw failure
        if (window.isDestroyed())
          throw new Error('A janela do AnkerGames foi fechada.')
        if (!fileClicked && !item) {
          fileClicked = (await this.evaluate(
            window,
            `(() => {
            const link = [...document.querySelectorAll('a[href]')].find(el =>
              el.getClientRects().length && el.origin === location.origin &&
              el.pathname.startsWith('/torrent-file/'));
            if (!link) return false;
            link.click(); return true;
          })()`
          )) as boolean
        }
        if (!clicked) {
          const result = (await this.evaluate(
            window,
            `(() => {
            const visible = el => el.getClientRects().length > 0;
            const buttons = [...document.querySelectorAll('button, a')].filter(visible);
            const torrent = buttons.find(el => /Download\\s*\\.torrent\\s*File/i.test(el.textContent || ''));
            if (torrent) {
              const area = torrent.closest('[role="dialog"], dialog') || torrent.parentElement?.parentElement;
              if (/sign in required/i.test(area?.innerText || '') || torrent.disabled) return 'login';
              torrent.click(); return 'torrent';
            }
            if (${Date.now() - openedAt > 2000}) {
              const download = buttons.find(el => el.textContent?.trim() === 'Download');
              if (download) { download.click(); return 'opened'; }
            }
            if (/Just a moment|Verify you are human/i.test(document.title + document.body.innerText.slice(0, 600))) return 'challenge';
            if (location.pathname === '/login') return 'login';
            return 'wait';
          })()`
          )) as string
          if (result === 'login') {
            this.connected = false
            throw new Error(
              'Conecte sua conta AnkerGames em Configurações → Integrações de downloads.'
            )
          }
          if (result === 'challenge' && !window.isVisible()) window.show()
          if (result === 'opened') openedAt = Date.now()
          if (result === 'torrent') clicked = true
        }
        await delay(400, undefined, { signal })
      }
      if (!complete)
        throw new Error(
          'O AnkerGames não entregou o torrent em 90 segundos. Use Retomar e conclua o download ou a verificação na janela do site que o Ghost abrirá.'
        )
      const file = await readFile(destination)
      torrentInfoHash(file)
      verified = true
      this.connected = true
      return file
    } finally {
      clearTimeout(reveal)
      isolated.removeListener('will-download', onDownload)
      signal.removeEventListener('abort', abort)
      if (!complete) item?.cancel()
      if (!window.isDestroyed()) window.destroy()
      this.busy = false
      if (!verified)
        await rm(destination, { force: true }).catch(() => undefined)
    }
  }
}
