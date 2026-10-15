import { BrowserWindow, session, type DownloadItem } from 'electron'
import type { DirectDownloadWait, PluginManifest } from 'common/types/plugins'
import { mkdir, open, realpath, rm, stat } from 'fs/promises'
import { join, resolve } from 'path'
import { setTimeout as delay } from 'timers/promises'
import { inside } from './externalPolicy'
import { onlineFixGameUrl } from './onlineFixUrls'
import { evaluateAnkerPage, loadAnkerPage } from './ankerNavigation'
import { directDownloadRecovery } from './directDownloadRecovery'
import { DIRECT_MANUAL_WAIT_MS } from './directWaitNotice'
import { DirectDownloadLearning } from './directDownloadLearning'
import { directDownloadLearningPreloadPath } from 'backend/constants/paths'
import { DIRECT_HOSTERS } from './directHosters'
import { DirectPageEngines, directPageNavigation } from './directPageEngines'
import { ONLINE_FIX_HOSTER_WAIT_MS, ONLINE_FIX_MANUAL_GRACE_MS, onlineFixWaitNoticeScript, type OnlineFixHosterAttempt } from './onlineFixWaitNotice'
import {
  findOnlineFixHostersPage, isOnlineFixHostersUrl, onlineFixDirectUrl,
  onlineFixHoster, onlineFixHosterDownloadUrl, onlineFixHosterScript,
  parseOnlineFixPackages, onlineFixPackagesFromEntries, type OnlineFixDownloadedPackage, type OnlineFixPackage
} from './onlineFixHosters'

const engineManifest: PluginManifest = {
  id: 'com.ghost.online-fix-source', name: 'Online-Fix', version: '1.0.0',
  author: 'Ghost', description: 'Leitura de links de download', type: 'game-source',
  permissions: ['network', 'game-sources'],
  allowedDomains: ['online-fix.me', 'hosters.online-fix.me', ...Object.values(DIRECT_HOSTERS).flat()]
}

async function validPackage(file: string, name: string): Promise<boolean> {
  const handle = await open(file, 'r')
  try {
    const header = Buffer.alloc(8)
    await handle.read(header, 0, 8, 0)
    return /\.rar$/i.test(name) ? header.subarray(0, 6).equals(Buffer.from('526172211a07', 'hex'))
      : /\.7z$/i.test(name) ? header.subarray(0, 6).equals(Buffer.from('377abcaf271c', 'hex'))
      : header.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'))
  } finally { await handle.close() }
}

export class OnlineFixDirect {
  private static busy = false

  static async download(
    page: string,
    directory: string,
    signal: AbortSignal,
    progress: (bytes: number, total: number) => void,
    completed: (files: OnlineFixDownloadedPackage[]) => void,
    previous: OnlineFixDownloadedPackage[] = [],
    wait: (state: DirectDownloadWait | undefined) => void = () => undefined
  ): Promise<OnlineFixDownloadedPackage[]> {
    const url = onlineFixGameUrl(page)
    if (this.busy) throw new Error('Aguarde o download direto Online-Fix em andamento.')
    signal.throwIfAborted()
    this.busy = true
    const isolated = session.fromPartition('persist:ghost-online-fix-direct')
    const family = new Set<BrowserWindow>()
    const groups = new WeakMap<BrowserWindow, Set<BrowserWindow>>()
    isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    isolated.setPermissionCheckHandler(() => false)
    isolated.webRequest.onBeforeRequest((details, callback) => callback({
      cancel: !onlineFixDirectUrl(details.url) && !details.url.startsWith('https://challenges.cloudflare.com/')
    }))
    const createWindow = () => {
      const preferences = { session: isolated, sandbox: true, contextIsolation: true,
        nodeIntegration: false, webviewTag: false, backgroundThrottling: false, preload: directDownloadLearningPreloadPath }
      const window = new BrowserWindow({ show: false, width: 1000, height: 760,
        title: 'Ghost — Download Online-Fix', autoHideMenuBar: true, webPreferences: preferences })
      const group = new Set<BrowserWindow>()
      groups.set(window, group)
      const configure = (member: BrowserWindow) => {
        family.add(member)
        group.add(member)
        member.webContents.setWindowOpenHandler(({ url: target }) => onlineFixDirectUrl(target)
          ? { action: 'allow', overrideBrowserWindowOptions: { show: false, webPreferences: preferences } }
          : { action: 'deny' })
        const guard = (event: Electron.Event, target: string) => {
          if (!onlineFixDirectUrl(target)) event.preventDefault()
        }
        member.webContents.on('will-navigate', guard)
        member.webContents.on('will-redirect', guard)
        member.webContents.on('did-create-window', child => configure(child))
      }
      configure(window)
      return window
    }
    try {
      await mkdir(directory, { recursive: true })
      const catalogWindow = createWindow()
      const abortDiscovery = () => { if (!catalogWindow.isDestroyed()) catalogWindow.destroy() }
      signal.addEventListener('abort', abortDiscovery, { once: true })
      const discoveryEngines = new DirectPageEngines(engineManifest, onlineFixDirectUrl)
      let packages: OnlineFixPackage[] = []
      try {
        await loadAnkerPage(catalogWindow, url, new URL(url).origin, 'Online-Fix')
        const deadline = Date.now() + 180000
        const manualAt = Date.now() + ONLINE_FIX_MANUAL_GRACE_MS
        wait({ phase: 'automatic', deadline: manualAt, hoster: 'Online-Fix', attempt: 1, attempts: 1 })
        let discoveryShown = false
        let navigated = false
        while (Date.now() < deadline && !packages.length) {
          signal.throwIfAborted()
          if (catalogWindow.isDestroyed()) throw new Error('A obtenção dos links Online-Fix foi interrompida.')
          const snapshot = await evaluateAnkerPage(catalogWindow,
            '({ url: location.href, html: document.documentElement.outerHTML.slice(0, 8388608) })')
          if (snapshot && typeof snapshot === 'object' && 'html' in snapshot && typeof snapshot.html === 'string' &&
              'url' in snapshot && typeof snapshot.url === 'string' && onlineFixDirectUrl(snapshot.url)) {
            if (isOnlineFixHostersUrl(snapshot.url)) packages = parseOnlineFixPackages(snapshot.html, snapshot.url)
            else if (!navigated) {
              const hosters = findOnlineFixHostersPage(snapshot.html, snapshot.url)
              if (hosters) {
                navigated = true
                await loadAnkerPage(catalogWindow, hosters, new URL(hosters).origin, 'Online-Fix Hosters')
                continue
              }
            }
            if (!packages.length) {
              const assisted = discoveryEngines.poll(catalogWindow)
              if (isOnlineFixHostersUrl(snapshot.url) && assisted?.entries.length)
                packages = onlineFixPackagesFromEntries(assisted.entries)
              else if (!navigated && assisted) {
                const links = assisted.links.filter(link => isOnlineFixHostersUrl(link.url))
                if (links.length === 1) {
                  navigated = true
                  await loadAnkerPage(catalogWindow, links[0].url, new URL(links[0].url).origin, 'Online-Fix Hosters')
                  continue
                }
              }
            }
          }
          if (!packages.length) {
            const automaticUntil = discoveryEngines.pending(catalogWindow) ? manualAt + 35000 : manualAt
            if (!discoveryShown) wait({ phase: 'automatic', deadline: automaticUntil, hoster: 'Online-Fix', attempt: 1, attempts: 1 })
            if (!discoveryShown && Date.now() >= automaticUntil) {
              discoveryShown = true
              catalogWindow.show()
              wait({ phase: 'manual', deadline, hoster: 'Online-Fix', attempt: 1, attempts: 1 })
            }
            await delay(1000, undefined, { signal })
          }
        }
        if (!packages.length) throw new Error('O Online-Fix não forneceu os arquivos a tempo. Use Retomar para tentar novamente.')
      } finally {
        discoveryEngines.stop()
        signal.removeEventListener('abort', abortDiscovery)
        for (const member of groups.get(catalogWindow)!) if (!member.isDestroyed()) member.destroy()
      }
      const files: OnlineFixDownloadedPackage[] = []
      for (const item of packages) {
        signal.throwIfAborted()
        const saved = previous.find(file => file.name === item.name && file.role === item.role)
        let reused = false
        if (saved && resolve(saved.archive) === resolve(directory, item.name)) {
          try {
            const info = await stat(saved.archive)
            reused = info.isFile() && info.size > 0 && info.size === saved.bytes &&
              inside(await realpath(directory), await realpath(saved.archive)) && await validPackage(saved.archive, item.name)
          } catch { /* Obtain this package again. */ }
        }
        const baseBytes = files.reduce((sum, file) => sum + file.bytes, 0)
        if (saved && reused) files.push(saved)
        else {
          let obtained: OnlineFixDownloadedPackage | undefined
          for (const [index, mirror] of item.mirrors.entries()) {
            signal.throwIfAborted()
            const member = createWindow()
            try {
              const file = await this.receive(member, groups.get(member)!, mirror.url, item, directory, signal,
                bytes => progress(baseBytes + bytes, 0), {
                  hoster: mirror.hoster, next: item.mirrors[index + 1]?.hoster,
                  attempt: index + 1, attempts: item.mirrors.length
                }, wait)
              obtained = { name: item.name, role: item.role, archive: file, bytes: (await stat(file)).size }
              break
            } catch {
              signal.throwIfAborted()
              progress(baseBytes, 0)
            } finally {
              for (const child of groups.get(member)!) {
                if (!child.isDestroyed()) child.destroy()
                family.delete(child)
              }
            }
          }
          if (!obtained) throw new Error(`Nenhum hoster entregou ${item.name}. Os arquivos já concluídos foram preservados; use Retomar.`)
          files.push(obtained)
        }
        completed([...files])
        progress(files.reduce((sum, file) => sum + file.bytes, 0), 0)
      }
      const bytes = files.reduce((sum, file) => sum + file.bytes, 0)
      progress(bytes, bytes)
      return files
    } finally {
      wait(undefined)
      for (const member of family) if (!member.isDestroyed()) member.destroy()
      this.busy = false
    }
  }

  private static async receive(
    window: BrowserWindow, family: Set<BrowserWindow>, url: string, item: OnlineFixPackage,
    directory: string, signal: AbortSignal, progress: (bytes: number) => void,
    context: OnlineFixHosterAttempt = { hoster: onlineFixHoster(url)!, attempt: 1, attempts: 1 },
    wait: (state: DirectDownloadWait | undefined) => void = () => undefined
  ): Promise<string> {
    const isolated = window.webContents.session
    const engines = new DirectPageEngines(engineManifest, onlineFixDirectUrl)
    const learning = new DirectDownloadLearning('com.ghost.online-fix-source', onlineFixDirectUrl, Object.values(DIRECT_HOSTERS).flat())
    learning.watch(window)
    const destination = join(directory, item.name)
    let download: DownloadItem | undefined
    let recovery: ReturnType<typeof directDownloadRecovery> | undefined
    let verified = false
    let running = false
    let active = true
    let followCount = 0
    const followed = new Set<string>()
    const manualSince = new Map<number, { url: string; at: number }>()
    let deadline = Date.now() + ONLINE_FIX_HOSTER_WAIT_MS
    let phase: DirectDownloadWait['phase'] = 'automatic'
    let lastWait = ''
    const reportWait = (until = deadline) => {
      const state = { ...context, phase, deadline: until }
      const serialized = JSON.stringify(state)
      if (serialized !== lastWait) { lastWait = serialized; wait(state) }
    }
    let rejectOperation: (error: Error) => void = () => undefined
    const abort = () => rejectOperation(new Error('Download direto Online-Fix interrompido.'))
    let timeout: ReturnType<typeof setTimeout> | undefined
    const reveal = async (member: BrowserWindow) => {
      if (!active || download || signal.aborted || member.isDestroyed() || !onlineFixDirectUrl(member.webContents.getURL())) return
      if (phase !== 'manual') {
        phase = 'manual'
        deadline = Date.now() + DIRECT_MANUAL_WAIT_MS
        clearTimeout(timeout)
        timeout = setTimeout(() => rejectOperation(new Error('O download não iniciou após a confirmação manual. Tentando outro espelho.')), DIRECT_MANUAL_WAIT_MS)
        reportWait()
        learning.setManual(true)
      }
      if (!member.isVisible()) member.show()
      await evaluateAnkerPage(member, onlineFixWaitNoticeScript(deadline, { ...context, phase }))
    }
    const navigation = (_event: Electron.Event, _url: string, status: number) => {
      if (!download && status >= 400) void reveal(window)
    }
    let onDownload: (_event: Electron.Event, file: DownloadItem, contents: Electron.WebContents) => void = () => undefined
    const poll = setInterval(() => { void automate() }, 1000)
    const automate = async () => {
      if (!active || running || download || window.isDestroyed() || signal.aborted) return
      running = true
      try {
        for (const member of [...family].reverse()) {
          if (member.isDestroyed() || !onlineFixHoster(member.webContents.getURL())) continue
          if (phase === 'manual') { await reveal(member); break }
          if (await learning.replay(member)) break
          if (!active || download || signal.aborted || member.isDestroyed()) return
          if (member.isVisible())
            await evaluateAnkerPage(member, onlineFixWaitNoticeScript(deadline, context))
          let result = await evaluateAnkerPage(member, onlineFixHosterScript(item.name))
          if (!active || download || signal.aborted || member.isDestroyed()) return
          if (result && typeof result === 'object' && 'manual' in result && !('requiresInteraction' in result && result.requiresInteraction)) {
            const links = directPageNavigation(engines.poll(member), false, item.name)
            if (links.length) result = { url: links[0] }
          }
          if (result && typeof result === 'object' && 'url' in result && typeof result.url === 'string' &&
              onlineFixHoster(result.url) && onlineFixDirectUrl(result.url) && !followed.has(result.url) && followCount < 5) {
            followed.add(result.url)
            followCount++
            manualSince.delete(member.webContents.id)
            void member.loadURL(result.url, { httpReferrer: member.webContents.getURL() }).catch(() => undefined)
          } else if (result && typeof result === 'object' && 'clicked' in result) {
            manualSince.delete(member.webContents.id)
            reportWait()
          } else if (result && typeof result === 'object' && 'manual' in result && !member.isVisible()) {
            const currentUrl = member.webContents.getURL()
            const previous = manualSince.get(member.webContents.id)
            if (!previous || previous.url !== currentUrl) {
              manualSince.set(member.webContents.id, { url: currentUrl, at: Date.now() })
              reportWait(engines.pending(member) ? deadline : Math.min(deadline, Date.now() + ONLINE_FIX_MANUAL_GRACE_MS))
            }
            else if (Date.now() - previous.at >= ONLINE_FIX_MANUAL_GRACE_MS && !engines.pending(member)) {
              await reveal(member)
            }
          } else if (result && typeof result === 'object' && 'waiting' in result) {
            manualSince.delete(member.webContents.id)
            reportWait()
          }
          break
        }
      } catch { /* The document may navigate while its DOM is being read. */ }
      finally { running = false }
    }
    try {
      await new Promise<void>((resolveTask, reject) => {
        rejectOperation = reject
        reportWait()
        timeout = setTimeout(() => {
          const current = [...family].reverse().find(member => !member.isDestroyed() && onlineFixDirectUrl(member.webContents.getURL()))
          if (current) void reveal(current)
          else reject(new Error('Não foi possível carregar a hospedagem. Tentando outro espelho.'))
        }, ONLINE_FIX_HOSTER_WAIT_MS)
        onDownload = (_event, file, contents) => {
          if (!contents || ![...family].some(member => !member.isDestroyed() && member.webContents.id === contents.id)) return
          const target = file.getURLChain?.().at(-1) || file.getURL()
          if (download || file.getFilename().toLowerCase() !== item.name.toLowerCase() ||
              !onlineFixHoster(target) || !onlineFixDirectUrl(target)) {
            file.cancel()
            return
          }
          download = file
          wait(undefined)
          clearTimeout(timeout)
          file.setSavePath(destination)
          for (const member of family) if (!member.isDestroyed()) member.hide()
          recovery = directDownloadRecovery(file, reject, () => undefined)
          const report = () => progress(file.getReceivedBytes())
          report()
          file.on('updated', (_event, state) => { report(); recovery?.updated(state) })
          file.once('done', (_event, state) => {
            recovery?.done(state)
            if (state === 'completed') { report(); resolveTask() }
            else reject(new Error('A hospedagem interrompeu o arquivo. Tentando outro espelho.'))
          })
        }
        isolated.on('will-download', onDownload)
        signal.addEventListener('abort', abort, { once: true })
        window.once('closed', abort)
        window.webContents.on('did-navigate', navigation)
        if (signal.aborted) { abort(); return }
        void window.loadURL(onlineFixHosterDownloadUrl(url)).catch((error: unknown) => {
          // Chromium can reject a navigation before emitting will-download.
          // Both codes occur on download responses; keep the bounded wait alive.
          const pendingDownload = error && typeof error === 'object' && 'code' in error &&
            (error.code === 'ERR_ABORTED' || error.code === 'ERR_FAILED')
          if (!download && !pendingDownload) void reveal(window)
        })
      })
      signal.throwIfAborted()
      const info = await stat(destination)
      if (!info.isFile() || !info.size || (download?.getTotalBytes() && info.size !== download.getTotalBytes()) ||
          !await validPackage(destination, item.name)) throw new Error('A hospedagem entregou um arquivo inválido ou incompleto.')
      verified = true
      await learning.complete(destination, download?.getTotalBytes() || info.size)
      return destination
    } finally {
      active = false
      engines.stop()
      learning.dispose(!signal.aborted && !download)
      clearInterval(poll)
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      window.removeListener('closed', abort)
      window.webContents.removeListener('did-navigate', navigation)
      isolated.removeListener('will-download', onDownload)
      recovery?.stop()
      if (!verified) {
        download?.cancel()
        await rm(destination, { force: true }).catch(() => undefined)
      }
    }
  }
}
