import type { BrowserWindow } from 'electron'
import type { DirectDownloadWait, PluginManifest } from 'common/types/plugins'
import { evaluateAnkerPage } from './ankerNavigation'
import { directHoster, directHosterScript, directNonDownloadUrl } from './directHosters'
import { sourceDownloadScript, sourceDownloadStatusScript } from './sourceDownloadScript'
import { NetworkGuard } from './networkGuard'
import { isSourceUrl } from './sourceSettings'
import type { DirectDownloadLearning } from './directDownloadLearning'
import { DIRECT_HOSTER_WAIT_MS, DIRECT_MANUAL_GRACE_MS, DIRECT_MANUAL_WAIT_MS, directWaitNoticeScript } from './directWaitNotice'
import { DirectPageEngines, directPageNavigation } from './directPageEngines'

interface Options {
  window: BrowserWindow
  family: Set<BrowserWindow>
  sourceId: string
  sourceName: string
  manifest: PluginManifest
  done: () => boolean
  fail: (error: Error) => void
  wait?: (state: DirectDownloadWait | undefined) => void
  learning?: DirectDownloadLearning
  gamePage?: string
}

export class BrowserDownloadAutomation {
  private active = true
  private running = false
  private interval?: ReturnType<typeof setInterval>
  private deadline = Date.now() + DIRECT_HOSTER_WAIT_MS
  private phase: DirectDownloadWait['phase'] = 'automatic'
  private visited = new Set<string>()
  private manualSince = new Map<number, { page: string; at: number }>()
  private queue: string[] = []
  private mirror?: string
  private attempts = 0
  private lastState = ''
  private returningToGame = false
  private returnedToGame = false
  private returnLoaded = false
  private returnVersion = 0
  private engines: DirectPageEngines
  constructor(private options: Options) {
    this.engines = new DirectPageEngines({ ...options.manifest, id: options.sourceId }, url => this.allowed(url))
  }

  start() {
    this.report()
    this.interval = setInterval(() => { void this.tick() }, 1000)
  }
  stop() {
    if (!this.active) return
    this.active = false
    this.engines.stop()
    clearInterval(this.interval)
    this.options.wait?.(undefined)
  }
  private allowed(url: string) {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.port && !parsed.username && !parsed.password &&
      !directNonDownloadUrl(url) && NetworkGuard.validateUrl(url, this.options.manifest).allowed }
    catch { return false }
  }
  private current() {
    return [...this.options.family].reverse().find(member => !member.isDestroyed() && this.allowed(member.webContents.getURL()))
  }
  private context(): DirectDownloadWait {
    return { phase: this.phase, deadline: this.deadline,
      ...(this.returningToGame ? { returningToGame: true } : {}),
      ...(this.returnedToGame && this.isGamePage(this.current()?.webContents.getURL() || '') ? { confirmOnGamePage: true } : {}),
      hoster: this.mirror ? directHoster(this.mirror) || new URL(this.mirror).hostname : this.options.sourceName,
      next: this.queue[0] ? directHoster(this.queue[0]) || new URL(this.queue[0]).hostname : undefined,
      attempt: this.attempts || 1, attempts: (this.attempts || 1) + this.queue.length }
  }
  private report() {
    if (!this.active || this.options.done()) return
    const state = this.context()
    const serialized = JSON.stringify(state)
    if (serialized !== this.lastState) {
      this.lastState = serialized
      this.options.wait?.(state)
    }
  }
  private async reveal(member: BrowserWindow) {
    if (!this.active || this.options.done() || member.isDestroyed() || !this.allowed(member.webContents.getURL())) return false
    if (isSourceUrl(this.options.sourceId, member.webContents.getURL(), true)) {
      const page = member.webContents.getURL()
      const status = await evaluateAnkerPage(member, sourceDownloadStatusScript())
      if (!this.active || this.options.done() || member.isDestroyed() || page !== member.webContents.getURL()) return false
      if (status && typeof status === 'object' && 'unavailable' in status && status.unavailable === true) {
        this.returnToGame()
        return false
      }
    }
    if (!this.active || this.options.done()) return false
    if (this.phase !== 'manual') {
      this.phase = 'manual'
      this.deadline = Date.now() + DIRECT_MANUAL_WAIT_MS
      this.options.learning?.setManual(true)
    }
    // Showing must not depend on a successful script in an unresponsive page.
    if (!member.isVisible()) member.show()
    this.report()
    await evaluateAnkerPage(member, directWaitNoticeScript(this.deadline, this.context()))
    return true
  }
  private isGamePage(page: string) {
    try { return Boolean(this.options.gamePage) && isSourceUrl(this.options.sourceId, page, true) &&
      new URL(page).pathname === new URL(this.options.gamePage!).pathname }
    catch { return false }
  }
  private recoveryFailed() {
    if (!this.active || this.options.done()) return
    this.stop()
    this.options.fail(new Error('Não foi possível reabrir a página deste jogo para confirmação. Verifique sua conexão e use Retomar em Downloads.'))
  }
  private returnToGame() {
    if (!this.active || this.options.done() || this.returningToGame) return
    const page = this.options.gamePage
    if (!page || !this.allowed(page) || !isSourceUrl(this.options.sourceId, page, true) ||
        new URL(page).pathname === '/' || this.options.window.isDestroyed()) {
      this.recoveryFailed()
      return
    }
    this.returningToGame = true
    this.engines.stop()
    this.returnLoaded = false
    const version = ++this.returnVersion
    this.returnedToGame = false
    this.phase = 'manual'
    this.deadline = Date.now() + 30000
    this.mirror = undefined
    this.queue = [] // Signed alternatives from the failed page may be stale too.
    this.manualSince.clear()
    this.options.learning?.setManual(false)
    for (const child of this.options.family) if (!child.isDestroyed() && child !== this.options.window) child.destroy()
    this.options.window.hide()
    this.report()
    // Always use the task's validated original URL, never Return Home/search
    // links from the error document. Manual mode prevents retrying that action.
    void this.options.window.loadURL(page).then(() => {
      if (this.active && this.returningToGame && version === this.returnVersion) this.returnLoaded = true
    }).catch((error: unknown) => {
      const pending = error && typeof error === 'object' && 'code' in error && ['ERR_ABORTED', 'ERR_FAILED'].includes(String(error.code))
      if (!pending && version === this.returnVersion) this.recoveryFailed()
    })
  }
  private async finishReturnToGame() {
    const window = this.options.window
    if (window.isDestroyed() || Date.now() >= this.deadline) { this.recoveryFailed(); return }
    const page = window.webContents.getURL()
    const status = await evaluateAnkerPage(window, sourceDownloadStatusScript())
    if (!this.active || this.options.done() || window.isDestroyed() || page !== window.webContents.getURL()) return
    if (status && typeof status === 'object' && 'unavailable' in status && status.unavailable === true) {
      if (this.returnLoaded) this.recoveryFailed() // Original page failed too: no redirect loop.
      return
    }
    if (!this.isGamePage(page) || !status || typeof status !== 'object' || !('ready' in status) || status.ready !== true) return
    this.returningToGame = false
    this.returnedToGame = true
    this.deadline = Date.now() + DIRECT_MANUAL_WAIT_MS
    this.options.learning?.setManual(true)
    await this.reveal(window)
  }
  navigationFailed() {
    // Offer the validated page instead of destroying the hidden browser.
    if (this.active && !this.options.done() && this.phase === 'automatic') this.deadline = Date.now()
  }
  private navigate(window: BrowserWindow, url: string, mirror: boolean) {
    if (!this.active || this.options.done() || window.isDestroyed() || !this.allowed(url)) return
    if (mirror) {
      if (!this.mirror || !isSourceUrl(this.options.sourceId, this.mirror, true)) this.attempts++
      this.mirror = url
    }
    this.queue = this.queue.filter(queued => queued !== url)
    this.visited.add(url)
    this.manualSince.delete(window.webContents.id)
    this.report()
    // A pending hoster navigation must not hold the watchdog lock.
    void window.loadURL(url, { httpReferrer: window.webContents.getURL() }).catch((error: unknown) => {
      const pending = error && typeof error === 'object' && 'code' in error && ['ERR_ABORTED', 'ERR_FAILED'].includes(String(error.code))
      if (!pending && !window.isDestroyed() && window.webContents.getURL() === url) this.navigationFailed()
    })
  }
  private async tick() {
    if (!this.active || this.running || this.options.done()) return
    this.running = true
    try {
      if (this.returningToGame) { await this.finishReturnToGame(); return }
      const member = this.current()
      if (Date.now() >= this.deadline) {
        if (this.phase === 'automatic' && member) {
          await this.reveal(member)
        } else {
          const next = this.queue.shift()
          if (next) {
            for (const child of this.options.family) if (!child.isDestroyed() && child !== this.options.window) child.destroy()
            this.options.window.hide()
            this.phase = 'automatic'
            this.options.learning?.setManual(false)
            this.deadline = Date.now() + DIRECT_HOSTER_WAIT_MS
            this.navigate(this.options.window, next, true)
          } else if (this.phase === 'manual' && member && member !== this.options.window &&
              !this.options.window.isDestroyed() && isSourceUrl(this.options.sourceId, this.options.window.webContents.getURL(), true)) {
            // Preserve the source's dynamic hoster list and its attempted rows.
            for (const child of this.options.family) if (!child.isDestroyed() && child !== this.options.window) child.destroy()
            this.options.window.hide()
            this.phase = 'automatic'
            this.options.learning?.setManual(false)
            this.deadline = Date.now() + DIRECT_HOSTER_WAIT_MS
            this.mirror = undefined
            this.report()
          } else {
            this.stop()
            this.options.fail(new Error(member
              ? 'O download não iniciou após a tentativa automática e o prazo para confirmação manual. Use Retomar em Downloads.'
              : 'Não foi possível carregar uma página de download permitida. Verifique sua conexão e use Retomar em Downloads.'))
          }
        }
        return
      }
      if (!member) return
      const page = member.webContents.getURL()
      const source = isSourceUrl(this.options.sourceId, page, true)
      if (!source && (!this.mirror || isSourceUrl(this.options.sourceId, this.mirror, true))) {
        if (!this.mirror) this.attempts++
        this.mirror = page
      }
      this.report()
      if (this.phase === 'manual') {
        await this.reveal(member)
        return // Manual controls belong to the user; DownloadItem is still captured.
      }
      if (await this.options.learning?.replay(member)) return
      if (!this.active || this.options.done() || member.isDestroyed() || page !== member.webContents.getURL()) return
      let result = await evaluateAnkerPage(member, source
        ? sourceDownloadScript(this.options.manifest.allowedDomains || [])
        : directHosterScript(undefined, this.options.manifest.allowedDomains || []))
      if (!this.active || this.options.done() || member.isDestroyed() || page !== member.webContents.getURL()) return
      if (result && typeof result === 'object' && 'manual' in result && !('requiresInteraction' in result && result.requiresInteraction)) {
        const links = directPageNavigation(this.engines.poll(member), source)
          .filter(url => this.allowed(url) && !this.visited.has(url))
        if (links.length) result = source ? { candidates: links.map(url => ({ url })) } : { url: links[0] }
      }
      if (source && result && typeof result === 'object' && 'unavailable' in result && result.unavailable === true) {
        this.returnToGame()
      } else if (result && typeof result === 'object' && 'candidates' in result && Array.isArray(result.candidates)) {
        const urls = (result.candidates as unknown[]).flatMap(item => item && typeof item === 'object' && 'url' in item &&
          typeof item.url === 'string' && this.allowed(item.url) && !this.visited.has(item.url) ? [item.url] : [])
        const [next, ...others] = [...new Set(urls)]
        for (const url of others) if (!this.queue.includes(url)) this.queue.push(url)
        if (next) this.navigate(member, next, !isSourceUrl(this.options.sourceId, next, true))
        this.report()
      } else if (result && typeof result === 'object' && 'url' in result && typeof result.url === 'string' &&
          this.allowed(result.url) && !this.visited.has(result.url)) {
        this.navigate(member, result.url, false)
      } else if (result && typeof result === 'object' && 'manual' in result) {
        const previous = this.manualSince.get(member.webContents.id)
        if (!previous || previous.page !== page) {
          this.manualSince.set(member.webContents.id, { page, at: Date.now() })
          if (!this.engines.pending(member)) this.deadline = Math.min(this.deadline, Date.now() + DIRECT_MANUAL_GRACE_MS)
          this.report()
        }
        else if (Date.now() - previous.at >= DIRECT_MANUAL_GRACE_MS && !this.engines.pending(member)) await this.reveal(member)
      } else {
        this.manualSince.delete(member.webContents.id)
      }
    } catch { /* The watchdog still offers manual confirmation after DOM errors. */ }
    finally { this.running = false }
  }
}
