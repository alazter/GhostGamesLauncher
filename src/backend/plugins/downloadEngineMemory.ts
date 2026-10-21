import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'
import type { DownloadAction } from 'common/directDownloadLearning'
import { defaultDownloadRecipes } from './directDownloadDefaults'

export type DownloadEngine = 'scrapling' | 'obscura'
export interface EngineObservation {
  engine: DownloadEngine
  page: string
  controls: DownloadAction[]
}
interface Outcome {
  successes: number
  failures: number
}
interface Memory {
  source: string
  origin: string
  route: string
  controls: DownloadAction[]
  engines: Record<DownloadEngine, Outcome>
  updated: number
}

export function enginePageKey(source: string, page: string) {
  const url = new URL(page)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port &&
      !(
        url.port === '2053' &&
        /^(?:hosters|uploads)\.online-fix\.me$/.test(url.hostname)
      ))
  )
    throw Error('Página inválida.')
  const route = url.pathname
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
  return { source, origin: url.origin, route }
}

export function engineControlLabel(raw: string) {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\S+\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)\b/gi, '<arquivo>')
    .replace(/^\P{L}+|[^\p{L}\p{N}>]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sameEngineControl(a: DownloadAction, b: DownloadAction) {
  return (
    a.tag === b.tag &&
    a.label === b.label &&
    a.row === b.row &&
    !a.form &&
    !b.form
  )
}
export function validEngineControl(value: unknown): value is DownloadAction {
  if (!value || typeof value !== 'object') return false
  const item = value as DownloadAction
  const forbidden =
    /report|abuse|denunc|delete|remove|exclu|captcha|verif|human|login|sign.?in|entrar|senha|password|donat|premium|subscribe|purchase|comprar|\bbuy\b|\bpay\b|checkout|upgrade|install|extension|torrent|magnet|copy|clipboard|copiar|upload|enviar|https?:|[?=&]/i
  return (
    ['A', 'BUTTON', 'INPUT'].includes(item.tag) &&
    typeof item.label === 'string' &&
    item.label.length <= 80 &&
    !item.form &&
    [item.label, item.id, item.name, item.testId, item.row].every(
      (field) =>
        field === undefined ||
        (typeof field === 'string' &&
          field.length <= 80 &&
          !forbidden.test(field) &&
          [...field].every((char) => char.charCodeAt(0) >= 32))
    ) &&
    /download|baixar|obter|arquivo|package|continue|continuar|gerar|generate|create|retrieve|receber|fetch|pegar|direct|free|slow|\bget\b/i.test(
      [item.label, item.id, item.name, item.testId].join(' ')
    )
  )
}

/** Bounded semantic controls and outcomes only. Never HTML, URLs, cookies or selectors containing tokens. */
export class DownloadEngineMemory {
  constructor(
    private file: string | undefined,
    private valid: (
      value: unknown
    ) => value is DownloadAction = validEngineControl
  ) {}
  private read(): Memory[] {
    try {
      if (
        !this.file ||
        !existsSync(this.file) ||
        statSync(this.file).size > 128 * 1024
      )
        return []
      const data: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      if (
        !data ||
        typeof data !== 'object' ||
        !('revision' in data) ||
        data.revision !== 1 ||
        !('pages' in data) ||
        !Array.isArray(data.pages)
      )
        return []
      return (data.pages as Memory[])
        .filter((item) => {
          try {
            return (
              typeof item.source === 'string' &&
              item.source.length < 120 &&
              new URL(item.origin).origin === item.origin &&
              new URL(item.origin).protocol === 'https:' &&
              /^\/[a-z0-9/*._-]{0,239}$/i.test(item.route) &&
              Array.isArray(item.controls) &&
              item.controls.length <= 12 &&
              item.controls.every(this.valid) &&
              ['scrapling', 'obscura'].every((id) => {
                const metric = item.engines[id as DownloadEngine]
                return (
                  metric &&
                  [metric.successes, metric.failures].every(
                    (value) =>
                      Number.isSafeInteger(value) &&
                      value >= 0 &&
                      value <= 100000
                  )
                )
              }) &&
              Number.isFinite(item.updated) &&
              item.updated <= Date.now()
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
  private page(source: string, page: string): Memory {
    const key = enginePageKey(source, page)
    return (
      this.read().find(
        (item) =>
          item.source === source &&
          item.origin === key.origin &&
          item.route === key.route
      ) || {
        ...key,
        controls: [],
        engines: {
          scrapling: { successes: 0, failures: 0 },
          obscura: { successes: 0, failures: 0 }
        },
        updated: Date.now()
      }
    )
  }
  private save(item: Memory) {
    if (!this.file) return
    try {
      const pages = this.read().filter(
        (other) =>
          other.source !== item.source ||
          other.origin !== item.origin ||
          other.route !== item.route
      )
      mkdirSync(dirname(this.file), { recursive: true })
      const bounded = [...pages, { ...item, updated: Date.now() }].slice(-128)
      while (
        Buffer.byteLength(JSON.stringify({ revision: 1, pages: bounded })) >
        128 * 1024
      )
        bounded.shift()
      writeFileSync(
        this.file + '.tmp',
        JSON.stringify({ revision: 1, pages: bounded })
      )
      renameSync(this.file + '.tmp', this.file)
    } catch {
      /* Optional knowledge cannot interrupt a transfer. */
    }
  }
  controls(source: string, page: string): DownloadAction[] {
    const item = this.page(source, page)
    if (item.controls.length) return item.controls
    return (
      defaultDownloadRecipes.find(
        (recipe) =>
          recipe.source === source &&
          recipe.origin === item.origin &&
          recipe.route === item.route
      )?.steps || []
    )
  }
  order(source: string, page: string): DownloadEngine[] {
    const item = this.page(source, page)
    const score = (engine: DownloadEngine) =>
      item.engines[engine].successes > 0 && item.engines[engine].failures < 2
        ? 1
        : 0
    return score('obscura') > score('scrapling')
      ? ['obscura', 'scrapling']
      : ['scrapling', 'obscura']
  }
  manual(source: string, page: string, controls: DownloadAction[]) {
    const item = this.page(source, page)
    item.controls = controls
      .filter(this.valid)
      .filter((control) => !control.form)
      .slice(-12)
      .map(this.project)
    for (const metric of Object.values(item.engines)) metric.failures = 0
    this.save(item)
  }
  success(source: string, observation: EngineObservation) {
    const item = this.page(source, observation.page)
    const metric = item.engines[observation.engine]
    metric.successes = Math.min(100000, metric.successes + 1)
    metric.failures = 0
    const controls = [
      ...item.controls,
      ...observation.controls
        .filter(this.valid)
        .filter((control) => !control.form)
        .map(this.project)
    ]
    item.controls = controls
      .filter(
        (control, index) =>
          controls.findIndex(
            (other) => JSON.stringify(other) === JSON.stringify(control)
          ) === index
      )
      .slice(-12)
    this.save(item)
  }
  failure(source: string, page: string, engine: DownloadEngine) {
    const item = this.page(source, page)
    if (!item.engines[engine].successes) return
    item.engines[engine].failures = Math.min(
      100000,
      item.engines[engine].failures + 1
    )
    this.save(item)
  }
  private project(this: void, control: DownloadAction): DownloadAction {
    const { tag, label, id, name, testId, row } = control
    const stable = (value?: string) =>
      value &&
      /^[a-z][a-z0-9_-]{0,47}$/i.test(value) &&
      !/\d{4}|[a-f0-9]{16}/i.test(value)
        ? value
        : undefined
    return {
      tag,
      label,
      ...(stable(id) ? { id } : {}),
      ...(stable(name) ? { name } : {}),
      ...(stable(testId) ? { testId } : {}),
      ...(row ? { row } : {})
    }
  }
}

/** Lazy import keeps optional readers usable without Electron in tests/tools. */
export async function downloadEngineMemory(
  valid: (value: unknown) => value is DownloadAction
) {
  try {
    const { userDataPath } = await import('backend/constants/paths')
    return new DownloadEngineMemory(
      join(userDataPath, 'external-games', 'download-engine-learning.json'),
      valid
    )
  } catch {
    return new DownloadEngineMemory(undefined, valid)
  }
}
