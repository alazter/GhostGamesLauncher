// eslint-disable-next-line no-restricted-imports -- Private hoster channel needs per-operation sender validation and listener disposal.
import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'fs'
import { open, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { userDataPath } from 'backend/constants/paths'
import {
  DIRECT_LEARNING_CLICK,
  DIRECT_LEARNING_MODE,
  describeDownloadAction,
  type DownloadAction
} from 'common/directDownloadLearning'
import { directNonDownloadUrl } from './directHosters'
import { evaluateAnkerPage } from './ankerNavigation'
import { archiveSize } from './archiveSize'
import {
  defaultDownloadRecipes,
  type DownloadRecipe
} from './directDownloadDefaults'
import {
  DownloadEngineMemory,
  type DownloadEngine,
  type EngineObservation
} from './downloadEngineMemory'

interface Rule {
  source: string
  origin: string
  route: string
  steps: DownloadAction[]
  updated: number
  failures: number
}

const pending = new Map<
  string,
  {
    store: DirectDownloadRuleStore
    rules: Rule[]
    at: number
    engines: DownloadEngineMemory
    observations: Array<EngineObservation & { source: string }>
  }
>()

/** Called after complete archive metadata validation or successful extraction. */
export function confirmDirectDownloadLearning(...files: string[]) {
  for (const file of files) {
    const key = resolve(file),
      entry = pending.get(key)
    pending.delete(key)
    if (entry && Date.now() - entry.at < 3600000) {
      for (const rule of entry.rules)
        entry.store.put({ ...rule, updated: Date.now(), failures: 0 })
      for (const rule of entry.rules)
        entry.engines.manual(rule.source, rule.origin + rule.route, rule.steps)
      for (const observation of entry.observations)
        entry.engines.success(observation.source, observation)
    }
  }
}

export function downloadLearningRoute(page: string): string {
  return new URL(page).pathname
    .split('/')
    .map((segment) => {
      if (
        !segment ||
        /^(?:game|file|files|download|download-file|d|dl|free|start|view|link)$/i.test(
          segment
        )
      )
        return segment
      return /\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)$/i.test(segment)
        ? `*.${segment.split('.').at(-1)!.toLowerCase()}`
        : '*'
    })
    .join('/')
}

export function validDownloadAction(value: unknown): value is DownloadAction {
  if (!value || typeof value !== 'object') return false
  const item = value as DownloadAction
  const forbidden =
    /report|abuse|denunc|delete|remove|exclu|captcha|verif|human|login|sign.?in|senha|password|donat|premium|subscribe|purchase|\bbuy\b|\bpay\b|checkout|upgrade|install|extension|torrent|magnet|copy|clipboard|copiar|upload|enviar|https?:|[?=&]/i
  const word = (field: unknown) =>
    typeof field === 'string' &&
    field.length <= 80 &&
    !forbidden.test(field) &&
    [...field].every((char) => char.charCodeAt(0) >= 32)
  return (
    ['A', 'BUTTON', 'INPUT'].includes(item.tag) &&
    word(item.label) &&
    [item.id, item.name, item.testId, item.row].every(
      (field) => field === undefined || word(field)
    ) &&
    Boolean(item.label || item.id || item.name || item.testId) &&
    /download|baixar|obter|arquivo|package|continue|continuar|gerar|generate|create|retrieve|receber|fetch|pegar|direct|free|slow|\bget\b|<arquivo>/i.test(
      [item.label, item.id, item.name, item.testId].join(' ')
    ) &&
    (!item.form ||
      (['get', 'post'].includes(item.form.method) &&
        Array.isArray(item.form.fields) &&
        item.form.fields.length <= 20 &&
        item.form.fields.every(
          (field) =>
            typeof field === 'string' &&
            /^[a-z][a-z0-9_-]{0,47}$/i.test(field) &&
            !/password|captcha|email|message|payment|card|cvv/i.test(field)
        )))
  )
}

/** Data-only recipes. Signed URLs, HTML, field values and scripts never persist. */
export class DirectDownloadRuleStore {
  constructor(
    private file = join(
      userDataPath,
      'external-games',
      'direct-download-rules.json'
    ),
    private defaults: DownloadRecipe[] = defaultDownloadRecipes
  ) {}
  engineMemory() {
    return new DownloadEngineMemory(
      join(dirname(this.file), 'download-engine-learning.json'),
      validDownloadAction
    )
  }
  private records(): Rule[] {
    try {
      if (!existsSync(this.file) || statSync(this.file).size > 128 * 1024)
        return []
      const data: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      if (
        !data ||
        typeof data !== 'object' ||
        !('revision' in data) ||
        ![1, 2].includes(Number(data.revision)) ||
        !('rules' in data) ||
        !Array.isArray(data.rules)
      )
        return []
      return (data.rules as Rule[])
        .filter((rule) => {
          try {
            return (
              typeof rule.source === 'string' &&
              rule.source.length < 120 &&
              new URL(rule.origin).origin === rule.origin &&
              new URL(rule.origin).protocol === 'https:' &&
              typeof rule.route === 'string' &&
              /^\/[a-z0-9/*._-]*$/i.test(rule.route) &&
              rule.route.length < 240 &&
              Array.isArray(rule.steps) &&
              rule.steps.length > 0 &&
              rule.steps.length <= 6 &&
              rule.steps.every(validDownloadAction) &&
              Number.isFinite(rule.updated) &&
              rule.updated >= 0 &&
              rule.updated <= Date.now() &&
              Number.isInteger(rule.failures) &&
              rule.failures >= 0 &&
              rule.failures <= 2
            )
          } catch {
            return false
          }
        })
        .slice(-128)
    } catch {
      return []
    }
  }
  private key(rule: DownloadRecipe) {
    return `${rule.source}\n${rule.origin}\n${rule.route}`
  }
  read(): Rule[] {
    const merged = new Map(
      this.defaults
        .filter((rule) => rule.steps.every(validDownloadAction))
        .map((rule) => [this.key(rule), { ...rule, updated: 0, failures: 0 }])
    )
    for (const rule of this.records()) merged.set(this.key(rule), rule)
    return [...merged.values()].filter((rule) => rule.failures < 2)
  }
  private write(rules: Rule[]) {
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const disabledDefaults = rules.filter(
        (rule) =>
          rule.failures >= 2 &&
          this.defaults.some((item) => this.key(item) === this.key(rule))
      )
      const other = rules
        .filter((rule) => !disabledDefaults.includes(rule))
        .slice(-(128 - disabledDefaults.length))
      writeFileSync(
        `${this.file}.tmp`,
        JSON.stringify({ revision: 2, rules: [...disabledDefaults, ...other] })
      )
      renameSync(`${this.file}.tmp`, this.file)
    } catch {
      /* Learning never interrupts a download. */
    }
  }
  put(rule: Rule) {
    this.write([
      ...this.records().filter((item) => this.key(item) !== this.key(rule)),
      rule
    ])
  }
  failed(rule: Rule) {
    const current = this.read().find(
      (item) =>
        this.key(item) === this.key(rule) && item.updated === rule.updated
    )
    if (current)
      this.put({ ...current, failures: Math.min(2, current.failures + 1) })
  }
}

export function learnedDownloadScript(
  action: DownloadAction,
  domains: string[]
): string {
  return `(() => {
    const describe = ${describeDownloadAction.toString()};
    const blocked = ${directNonDownloadUrl.toString()};
    const expected = ${JSON.stringify(action)};
    const domains = ${JSON.stringify(domains)};
    const safe = raw => { try { const u = new URL(raw, location.href); return u.protocol === 'https:' && !u.port && !u.username && !u.password && !blocked(u.href) && domains.some(d => u.hostname === d.replace(/^\\*\\./,'') || u.hostname.endsWith('.'+d.replace(/^\\*\\./,''))); } catch { return false; } };
    const matches = [...document.querySelectorAll('a,button,input[type="submit"],input[type="button"]')].filter(node => {
      if (JSON.stringify(describe(node)) !== JSON.stringify(expected)) return false;
      const href = node.getAttribute('href');
      if (href && !href.startsWith('#') && !safe(node.href)) return false;
      if (node.hasAttribute('formaction') && !safe(node.formAction)) return false;
      const form = node.form || node.closest('form');
      return !form || (safe(form.action) && new URL(form.action).origin === location.origin);
    });
    if (matches.length !== 1) return false;
    matches[0].dataset.ghostDownloadAttempt = '1'; matches[0].click(); return true;
  })()`
}

export class DirectDownloadLearning {
  readonly engines: DownloadEngineMemory
  private engineObservations: Array<EngineObservation & { source: string }> = []
  private members = new Map<number, BrowserWindow>()
  private unwatch: (() => void)[] = []
  private manual = false
  private closed = false
  private success = false
  private candidates = new Map<string, Rule>()
  private replayed = new Map<string, { rule: Rule; index: number }>()
  private matched: Rule[] = []
  private onClick = (event: IpcMainEvent, payload: unknown) => {
    if (
      this.closed ||
      !this.manual ||
      !this.members.has(event.sender.id) ||
      !payload ||
      typeof payload !== 'object' ||
      !('page' in payload) ||
      typeof payload.page !== 'string' ||
      payload.page.length > 4096 ||
      !('action' in payload) ||
      !validDownloadAction(payload.action)
    )
      return
    try {
      if (!this.allowed(payload.page) || directNonDownloadUrl(payload.page))
        return
      const origin = new URL(payload.page).origin,
        route = downloadLearningRoute(payload.page),
        key = origin + route
      if (
        route.length > 240 ||
        (!this.candidates.has(key) && this.candidates.size >= 16)
      )
        return
      const candidate = this.candidates.get(key) || {
        source: this.source,
        origin,
        route,
        steps: [],
        failures: 0,
        updated: Date.now()
      }
      // Project only validated fields; never save extra properties from a message.
      const { tag, label, id, name, testId, row, form } = payload.action
      if (candidate.steps.length < 6)
        candidate.steps.push({
          tag,
          label,
          ...(id ? { id } : {}),
          ...(name ? { name } : {}),
          ...(testId ? { testId } : {}),
          ...(row ? { row } : {}),
          ...(form
            ? { form: { method: form.method, fields: [...form.fields] } }
            : {})
        })
      this.candidates.set(key, candidate)
    } catch {
      /* Discard a malformed page/action. */
    }
  }
  constructor(
    private source: string,
    private allowed: (url: string) => boolean,
    private domains: string[],
    private store = new DirectDownloadRuleStore()
  ) {
    this.engines = this.store.engineMemory()
    ipcMain?.on(DIRECT_LEARNING_CLICK, this.onClick)
  }
  observeEngine(
    engine: DownloadEngine,
    page: string,
    controls: DownloadAction[]
  ) {
    if (
      this.closed ||
      !this.allowed(page) ||
      directNonDownloadUrl(page) ||
      !['scrapling', 'obscura'].includes(engine)
    )
      return
    const cleanPage = new URL(page).origin + new URL(page).pathname
    if (
      this.engineObservations.some(
        (observation) =>
          observation.engine === engine && observation.page === cleanPage
      )
    )
      return
    if (this.engineObservations.length >= 16) return
    this.engineObservations.push({
      engine,
      page: cleanPage,
      source: this.source,
      controls: controls.filter(validDownloadAction).slice(0, 12)
    })
  }
  watch(window: BrowserWindow) {
    if (this.closed || this.members.has(window.webContents.id)) return
    const contents = window.webContents
    this.members.set(contents.id, window)
    const ready = () => {
      try {
        if (!window.isDestroyed())
          window.webContents.send(DIRECT_LEARNING_MODE, this.manual)
      } catch {
        /* Navigating/closed. */
      }
    }
    const child = (member: BrowserWindow) => this.watch(member)
    contents.on('dom-ready', ready)
    contents.on('did-create-window', child)
    this.unwatch.push(() => {
      contents.removeListener('dom-ready', ready)
      contents.removeListener('did-create-window', child)
    })
  }
  setManual(value: boolean) {
    if (value && !this.manual) {
      // Preserve only steps actually executed before fallback. Otherwise a
      // successful manual correction would forget the first automatic clicks.
      for (const { rule, index } of this.replayed.values()) {
        const key = rule.origin + rule.route
        if (index && !this.candidates.has(key))
          this.candidates.set(key, {
            ...rule,
            steps: rule.steps.slice(0, index),
            failures: 0,
            updated: Date.now()
          })
      }
      for (const rule of this.matched) this.store.failed(rule)
      this.matched = []
    }
    if (!value && this.manual) {
      this.candidates.clear() // An abandoned hoster must not teach its unsuccessful clicks.
      this.engineObservations = []
    }
    this.manual = value
    for (const member of this.members.values()) {
      try {
        if (!member.isDestroyed())
          member.webContents.send(DIRECT_LEARNING_MODE, value)
      } catch {
        /* Learning is optional. */
      }
    }
  }
  resetAttempt() {
    for (const rule of this.matched) this.store.failed(rule)
    for (const observation of this.engineObservations)
      this.engines.failure(
        observation.source,
        observation.page,
        observation.engine
      )
    this.matched = []
    this.replayed.clear()
    this.candidates.clear()
    this.engineObservations = []
  }
  async replay(window: BrowserWindow): Promise<boolean> {
    if (this.closed || this.manual || window.isDestroyed()) return false
    try {
      const page = window.webContents.getURL()
      if (!this.allowed(page)) return false
      const origin = new URL(page).origin,
        route = downloadLearningRoute(page),
        key = `${window.webContents.id}:${origin}${route}`
      let current = this.replayed.get(key)
      if (!current) {
        const rule = this.store
          .read()
          .find(
            (item) =>
              item.source === this.source &&
              item.origin === origin &&
              item.route === route
          )
        if (!rule) return false
        current = { rule, index: 0 }
        this.replayed.set(key, current)
      }
      if (current.index >= current.rule.steps.length) return false
      const result = await evaluateAnkerPage(
        window,
        learnedDownloadScript(current.rule.steps[current.index], this.domains)
      )
      if (result !== true) return false
      current.index++
      if (!this.matched.includes(current.rule)) this.matched.push(current.rule)
      return true
    } catch {
      return false
    }
  }
  async complete(file: string, expectedBytes: number) {
    try {
      const info = await stat(file)
      if (
        !info.isFile() ||
        info.size < 8 ||
        (expectedBytes > 0 && expectedBytes !== info.size)
      )
        return
      const handle = await open(file, 'r')
      const header = Buffer.alloc(8)
      try {
        await handle.read(header, 0, 8, 0)
      } finally {
        await handle.close()
      }
      // ROMs/raw TARs still download normally; only recognizable archives teach.
      if (
        !header.subarray(0, 4).equals(Buffer.from('504b0304', 'hex')) &&
        !header.subarray(0, 6).equals(Buffer.from('526172211a07', 'hex')) &&
        !header.subarray(0, 6).equals(Buffer.from('377abcaf271c', 'hex'))
      )
        return
      this.success = true
      const rules = [...this.matched, ...this.candidates.values()].filter(
        (rule) => rule.steps.length && this.allowed(rule.origin)
      )
      const key = resolve(file)
      pending.delete(key)
      for (const [stale, entry] of pending)
        if (Date.now() - entry.at >= 3600000) pending.delete(stale)
      if (rules.length || this.engineObservations.length)
        pending.set(key, {
          store: this.store,
          rules,
          at: Date.now(),
          engines: this.engines,
          observations: this.engineObservations
        })
      if (pending.size > 128) pending.delete(pending.keys().next().value!)
      // Learning describes a successful download, not the installer. A valid
      // package must teach even if executable selection/installation needs help.
      try {
        await archiveSize(
          file,
          /online[-.]?fix/i.test(this.source) ? 'online-fix.me' : undefined
        )
        confirmDirectDownloadLearning(file)
      } catch {
        /* A later successful extraction may still validate the package. */
      }
    } catch {
      /* Failed/incomplete/cancelled files do not teach. */
    }
  }
  dispose(failed = true) {
    if (this.closed) return
    this.closed = true
    ipcMain?.removeListener(DIRECT_LEARNING_CLICK, this.onClick)
    for (const unwatch of this.unwatch) unwatch()
    if (failed && !this.success)
      for (const rule of this.matched) this.store.failed(rule)
    if (failed && !this.success)
      for (const observation of this.engineObservations)
        this.engines.failure(
          observation.source,
          observation.page,
          observation.engine
        )
  }
}
