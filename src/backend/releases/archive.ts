import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import type { ReleaseCatalog, ReleaseProduct } from 'common/types/releases'
import { isReleaseCatalog, isReleaseProduct } from 'common/releaseValidation'
import { CalendarYearCache, replaceCalendarFile } from './calendarCache'

type Kind = 'catalog' | 'product'
type Value = ReleaseCatalog | ReleaseProduct
interface Revision {
  at: number
  value: Value
}
interface RecordEntry {
  kind: Kind
  key: string
  revisions: Revision[]
}
export interface ReleaseArchiveData {
  version: 1
  records: RecordEntry[]
}
const LIMIT = 16 * 1024 * 1024
const valid = (kind: Kind, value: unknown) =>
  kind === 'catalog' ? isReleaseCatalog(value) : isReleaseProduct(value)

export function validateReleaseArchive(
  value: unknown,
  knownByteLength?: number
): ReleaseArchiveData {
  const data = value as ReleaseArchiveData
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.records) ||
    data.records.length > 120 ||
    (knownByteLength ?? JSON.stringify(data).length) > LIMIT
  )
    throw new Error('Arquivo de proteção de lançamentos inválido.')
  for (const row of data.records) {
    if (
      !row ||
      !['catalog', 'product'].includes(row.kind) ||
      !/^[a-f0-9]{64}$/.test(row.key) ||
      !Array.isArray(row.revisions) ||
      !row.revisions.length ||
      row.revisions.length > 3 ||
      row.revisions.some(
        (revision) =>
          !revision ||
          !Number.isFinite(revision.at) ||
          revision.at <= 0 ||
          !valid(row.kind, revision.value)
      )
    )
      throw new Error('Histórico de lançamentos inválido.')
  }
  return data
}

/** One serialized writer, atomic replacement and a separately recoverable previous file. */
export class ReleaseArchive {
  private pending: Promise<unknown> = Promise.resolve()
  private memoryCache?: {
    mtimeMs: number
    size: number
    data: ReleaseArchiveData
  }
  readonly calendar: CalendarYearCache
  constructor(private directory: string) {
    this.calendar = new CalendarYearCache(directory)
  }
  private key(kind: Kind, key: string) {
    return createHash('sha256').update(`${kind}:${key}`).digest('hex')
  }
  private async read(): Promise<ReleaseArchiveData> {
    const primaryPath = join(this.directory, 'archive.json')
    if (this.memoryCache) {
      try {
        const st = await stat(primaryPath)
        if (
          st.mtimeMs === this.memoryCache.mtimeMs &&
          st.size === this.memoryCache.size
        ) {
          return structuredClone(this.memoryCache.data)
        }
      } catch {
        this.memoryCache = undefined
      }
    }
    let failure: unknown
    for (const name of ['archive.json', 'archive.previous.json']) {
      try {
        const filePath = join(this.directory, name)
        const raw = await readFile(filePath, 'utf8')
        const parsed = validateReleaseArchive(JSON.parse(raw), raw.length)
        if (name === 'archive.json') {
          const st = await stat(filePath).catch(() => null)
          if (st) {
            this.memoryCache = {
              mtimeMs: st.mtimeMs,
              size: st.size,
              data: structuredClone(parsed)
            }
          }
        }
        return parsed
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') failure = error
      }
    }
    if (failure)
      throw new Error(
        'Não foi possível ler o histórico de lançamentos. Os arquivos originais foram preservados.'
      )
    return { version: 1, records: [] }
  }
  private async write(data: ReleaseArchiveData, previousSnapshot?: ReleaseArchiveData) {
    data.records.sort((a, b) => b.revisions[0].at - a.revisions[0].at)
    data.records = data.records.slice(0, 120)
    let serialized = JSON.stringify(data)
    while (serialized.length > LIMIT && data.records.length > 1) {
      data.records.pop()
      serialized = JSON.stringify(data)
    }
    validateReleaseArchive(data, serialized.length)
    await mkdir(this.directory, { recursive: true })
    const current = previousSnapshot ?? (await this.read())
    await writeFile(
      join(this.directory, 'previous.tmp'),
      current.records.length ? JSON.stringify(current) : serialized,
      'utf8'
    )
    await replaceCalendarFile(
      join(this.directory, 'previous.tmp'),
      join(this.directory, 'archive.previous.json')
    )
    await writeFile(
      join(this.directory, 'archive.tmp'),
      serialized,
      'utf8'
    )
    await replaceCalendarFile(
      join(this.directory, 'archive.tmp'),
      join(this.directory, 'archive.json')
    )
    const st = await stat(join(this.directory, 'archive.json')).catch(
      () => null
    )
    if (st) {
      this.memoryCache = {
        mtimeMs: st.mtimeMs,
        size: st.size,
        data: structuredClone(data)
      }
    } else {
      this.memoryCache = undefined
    }
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.pending.catch(() => undefined).then(operation)
    this.pending = next
    return next
  }
  async get<T extends Value>(
    kind: Kind,
    key: string
  ): Promise<{ at: number; value: T } | undefined> {
    await this.pending.catch(() => undefined)
    return (await this.read()).records.find(
      (row) => row.kind === kind && row.key === this.key(kind, key)
    )?.revisions[0] as { at: number; value: T } | undefined
  }
  put(kind: Kind, key: string, value: Value): Promise<void> {
    if (!valid(kind, value))
      return Promise.reject(
        new Error(
          'Dados incompletos não podem substituir o arquivo de proteção.'
        )
      )
    return this.serialize(async () => {
      const data = await this.read()
      const previousSnapshot = structuredClone(data)
      const hash = this.key(kind, key)
      let row = data.records.find(
        (row) => row.key === hash && row.kind === kind
      )
      if (!row) {
        row = { kind, key: hash, revisions: [] }
        data.records.push(row)
      }
      const clean = JSON.parse(JSON.stringify(value)) as Value
      const same =
        row.revisions[0] &&
        JSON.stringify(row.revisions[0].value) === JSON.stringify(clean)
      if (same) row.revisions[0].at = Date.now()
      else
        row.revisions = [
          { at: Date.now(), value: clean },
          ...row.revisions
        ].slice(0, 3)
      await this.write(data, previousSnapshot)
    })
  }
  async export(): Promise<ReleaseArchiveData> {
    await this.pending.catch(() => undefined)
    return this.read()
  }
  async merge(incoming: unknown): Promise<void> {
    const restored = validateReleaseArchive(incoming)
    return this.serialize(async () => {
      const current = await this.read()
      const previousSnapshot = structuredClone(current)
      for (const row of restored.records) {
        const existing = current.records.find(
          (item) => item.kind === row.kind && item.key === row.key
        )
        if (!existing) current.records.push(row)
        else {
          const seen = new Set<string>()
          existing.revisions = [...existing.revisions, ...row.revisions]
            .sort((a, b) => b.at - a.at)
            .filter((revision) => {
              const key = JSON.stringify(revision.value)
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
            .slice(0, 3)
        }
      }
      await this.write(current, previousSnapshot)
    })
  }
}

let archive: ReleaseArchive | undefined
export async function getReleaseArchive() {
  if (!archive) {
    const { app } = await import('electron')
    archive = new ReleaseArchive(join(app.getPath('userData'), 'releases'))
  }
  return archive
}
