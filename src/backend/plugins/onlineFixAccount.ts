import { BrowserWindow, session, type DownloadItem } from 'electron'
import { mkdir, readFile, rm } from 'fs/promises'
import { dirname } from 'path'
import { torrentInfoHash } from './torrentMetadata'
import { loadAnkerPage, evaluateAnkerPage } from './ankerNavigation'
import { onlineFixGameUrl, onlineFixDownloadUrl, isOnlineFixTorrentUrl } from './onlineFixUrls'
import { resolveOnlineFixTorrentLink } from './onlineFixTorrent'
export { ONLINE_FIX_SOURCE_ID, ONLINE_FIX_TORRENT_ID, onlineFixGameUrl, onlineFixDownloadUrl } from './onlineFixUrls'

export class OnlineFixAccount {
  private static busy = false
  static async torrent(
    page: string,
    destination: string,
    signal: AbortSignal
  ): Promise<Buffer> {
    const url = onlineFixGameUrl(page)
    if (this.busy)
      throw new Error('Conclua a janela Online-Fix aberta antes de continuar.')
    await mkdir(dirname(destination), { recursive: true })
    const isolated = session.fromPartition('persist:ghost-online-fix')
    isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    isolated.setPermissionCheckHandler(() => false)
    isolated.webRequest.onBeforeRequest((details, callback) => {
      callback({
        cancel:
          !onlineFixDownloadUrl(details.url) &&
          !details.url.startsWith('https://challenges.cloudflare.com/')
      })
    })
    const window = new BrowserWindow({
      show: true,
      width: 1000,
      height: 760,
      title: 'Ghost — Torrent Online-Fix',
      autoHideMenuBar: true,
      webPreferences: {
        session: isolated,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        backgroundThrottling: false
      }
    })
    this.busy = true
    const family = new Set<BrowserWindow>([window])
    let item: DownloadItem | undefined
    let active = true
    const resolving = new Set<number>()
    const followed = new Set<string>()
    const automate = async (member: BrowserWindow) => {
      if (!active || item || member.isDestroyed() || resolving.has(member.webContents.id)) return
      resolving.add(member.webContents.id)
      let navigated = false
      try {
        const snapshot = await evaluateAnkerPage(member,
          `({ url: location.href, html: document.documentElement.outerHTML.slice(0, 8388608) })`)
        if (!snapshot || typeof snapshot !== 'object' ||
            !('url' in snapshot) || typeof snapshot.url !== 'string' ||
            !('html' in snapshot) || typeof snapshot.html !== 'string') return
        const target = await resolveOnlineFixTorrentLink(snapshot.html, snapshot.url)
        if (!target || !active || item || member.isDestroyed() || signal.aborted ||
            followed.has(target) || followed.size >= 3) return
        if (member.webContents.getURL() !== snapshot.url) return
        followed.add(target)
        // Navigate to the observed official href. A site's click handler can
        // replace an otherwise valid anchor with an advertising/task gateway.
        // Preserve the existing session and referrer without executing it.
        await member.loadURL(target, { httpReferrer: snapshot.url })
        navigated = true
      } catch {
        // Keep the official window usable for login or an ambiguous choice.
      } finally {
        resolving.delete(member.webContents.id)
        // dom-ready can fire while loadURL is still pending. Resolve the newly
        // loaded directory after releasing the per-window operation lock.
        if (navigated && active && !item && !member.isDestroyed() && !signal.aborted) {
          void automate(member)
        }
      }
    }
    const configure = (member: BrowserWindow) => {
      member.webContents.on('dom-ready', () => { void automate(member) })
      member.webContents.on('did-finish-load', () => { void automate(member) })
      member.webContents.setWindowOpenHandler(({ url: target }) =>
        onlineFixDownloadUrl(target)
          ? {
              action: 'allow',
              overrideBrowserWindowOptions: {
                webPreferences: {
                  session: isolated,
                  sandbox: true,
                  contextIsolation: true,
                  nodeIntegration: false,
                  webviewTag: false
                }
              }
            }
          : { action: 'deny' }
      )
      const guard = (event: Electron.Event, target: string) => {
        if (!onlineFixDownloadUrl(target)) event.preventDefault()
      }
      member.webContents.on('will-navigate', guard)
      member.webContents.on('will-redirect', guard)
      member.webContents.on('did-create-window', (child) => {
        family.add(child)
        configure(child)
      })
    }
    configure(window)
    let verified = false
    let rejectTask: (error: Error) => void = () => undefined
    const abort = () =>
      rejectTask(new Error('Obtenção do torrent Online-Fix interrompida.'))
    const closed = () => {
      if (!item) abort()
    }
    const timer = setTimeout(
      () =>
        rejectTask(
          new Error(
            'O Online-Fix não entregou o torrent a tempo. Use Retomar e escolha Torrent na janela do site.'
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
      await new Promise<void>((resolve, reject) => {
        rejectTask = reject
        onDownload = (_event, download, contents) => {
          if (
            !contents ||
            ![...family].some(
              (member) =>
                !member.isDestroyed() && member.webContents.id === contents.id
            )
          )
            return
          if (
            item ||
            !isOnlineFixTorrentUrl(download.getURLChain?.().at(-1) || download.getURL()) ||
            !/\.torrent$/i.test(download.getFilename()) ||
            download.getTotalBytes() > 16 * 1024 * 1024
          ) {
            download.cancel()
            if (!item)
              reject(
                new Error(
                  'Escolha o arquivo .torrent do jogo no Online-Fix (limite de 16 MB).'
                )
              )
            return
          }
          item = download
          download.setSavePath(destination)
          download.on('updated', (_event, state) => {
            if (
              download.getReceivedBytes() > 16 * 1024 * 1024 ||
              state === 'interrupted'
            ) {
              download.cancel()
              reject(
                new Error(
                  'O download do torrent Online-Fix foi interrompido ou excedeu o limite.'
                )
              )
            }
          })
          download.once('done', (_event, state) =>
            state === 'completed'
              ? resolve()
              : reject(
                  new Error(
                    'O download do torrent Online-Fix foi interrompido.'
                  )
                )
          )
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
          'https://online-fix.me',
          'Online-Fix'
        ).catch(reject)
      })
      signal.throwIfAborted()
      const file = await readFile(destination)
      torrentInfoHash(file)
      verified = true
      return file
    } finally {
      active = false
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      isolated.removeListener('will-download', onDownload)
      window.removeListener('closed', closed)
      if (!verified) item?.cancel()
      for (const member of family) if (!member.isDestroyed()) member.destroy()
      this.busy = false
      if (!verified)
        await rm(destination, { force: true }).catch(() => undefined)
    }
  }
}
