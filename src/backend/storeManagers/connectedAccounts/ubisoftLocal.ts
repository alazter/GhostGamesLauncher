import { open } from 'fs/promises'
import { join } from 'path'
import { TextDecoder } from 'util'
import { parseDocument } from 'yaml'
import type { AccountGame } from 'common/types/connectedAccounts'

const MAX_CACHE_BYTES = 32 * 1024 * 1024
const MAX_PRODUCT_BYTES = 2 * 1024 * 1024
const MAX_PRODUCTS = 20000
const MAX_GROUP_DEPTH = 32
const UINT32_MAX = 0xffffffff
const ASSET_BASE =
  'https://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/'
const utf8 = new TextDecoder('utf-8', { fatal: true })

function invalid(): never {
  throw new Error('UBISOFT_CACHE_INVALID')
}

/** Reads only protobuf framing. Unknown fields remain forward-compatible. */
class ProtobufReader {
  private position = 0

  constructor(private readonly buffer: Buffer) {}

  get done(): boolean {
    return this.position === this.buffer.length
  }

  private byte(): number {
    if (this.position >= this.buffer.length) invalid()
    return this.buffer[this.position++]
  }

  varint(maximum = Number.MAX_SAFE_INTEGER): number {
    let value = 0
    for (let index = 0; index < 10; index++) {
      const byte = this.byte()
      if (index === 9 && byte > 1) invalid()
      value += (byte & 0x7f) * 2 ** (index * 7)
      if (value > maximum || !Number.isSafeInteger(value)) invalid()
      if (!(byte & 0x80)) return value
    }
    return invalid()
  }

  tag(): { field: number; wire: number } {
    const tag = this.varint(UINT32_MAX)
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (!field || wire > 5) invalid()
    return { field, wire }
  }

  bytes(maximum = MAX_CACHE_BYTES): Buffer {
    const length = this.varint(UINT32_MAX)
    if (length > maximum || length > this.buffer.length - this.position) {
      invalid()
    }
    const result = this.buffer.subarray(this.position, this.position + length)
    this.position += length
    return result
  }

  private advance(length: number): void {
    if (length > this.buffer.length - this.position) invalid()
    this.position += length
  }

  skip(field: number, wire: number, depth = 0): void {
    switch (wire) {
      case 0:
        // Unknown uint64 fields may exceed JS's safe integer range.
        for (let index = 0; index < 10; index++) {
          const byte = this.byte()
          if (index === 9 && byte > 1) invalid()
          if (!(byte & 0x80)) return
        }
        invalid()
        break
      case 1:
        this.advance(8)
        return
      case 2:
        this.bytes()
        return
      case 3:
        if (depth >= MAX_GROUP_DEPTH) invalid()
        while (!this.done) {
          const next = this.tag()
          if (next.wire === 4) {
            if (next.field !== field) invalid()
            return
          }
          this.skip(next.field, next.wire, depth + 1)
        }
        invalid()
        break
      case 5:
        this.advance(4)
        return
      default:
        invalid()
    }
  }
}

type Mapping = Record<string, unknown>
interface Product {
  id: string
  root: Mapping
  localization: Mapping
}

function mapping(value: unknown): value is Mapping {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function productId(value: unknown): string {
  const number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (
    typeof number !== 'number' ||
    !Number.isInteger(number) ||
    number <= 0 ||
    number > UINT32_MAX
  ) {
    invalid()
  }
  return String(number)
}

function decodeProduct(buffer: Buffer): Product | undefined {
  const reader = new ProtobufReader(buffer)
  let id: number | undefined
  let installIdSeen = false
  let info: Buffer | undefined
  while (!reader.done) {
    const { field, wire } = reader.tag()
    if (field === 1) {
      if (wire !== 0 || id !== undefined) invalid()
      id = reader.varint(UINT32_MAX)
    } else if (field === 2) {
      if (wire !== 0 || installIdSeen) invalid()
      reader.varint(UINT32_MAX)
      installIdSeen = true
    } else if (field === 3) {
      if (wire !== 2 || info !== undefined) invalid()
      info = reader.bytes(MAX_PRODUCT_BYTES)
    } else {
      reader.skip(field, wire)
    }
  }
  // The official client includes placeholder products without GameInfo.
  if (!info?.length) return undefined
  if (!id) invalid()
  const document = parseDocument(utf8.decode(info), {
    maxAliasCount: 0,
    prettyErrors: false
  })
  if (document.errors.length || document.warnings.length) invalid()
  const data: unknown = document.toJSON()
  if (!mapping(data) || !mapping(data.root)) invalid()
  if (data.root.start_game != null && !mapping(data.root.start_game)) invalid()
  if (
    data.root.is_ulc != null &&
    ![true, false, 'yes', 'no'].includes(data.root.is_ulc as boolean | string)
  ) {
    invalid()
  }
  const localizations = data.localizations
  if (localizations != null && !mapping(localizations)) invalid()
  const localization = mapping(localizations)
    ? localizations.default
    : undefined
  if (localization != null && !mapping(localization)) invalid()
  return {
    id: productId(id),
    root: data.root,
    localization: mapping(localization) ? localization : {}
  }
}

function localized(value: unknown, localization: Mapping): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') invalid()
  if (!Object.prototype.hasOwnProperty.call(localization, value)) return value
  const result = localization[value]
  if (typeof result !== 'string') invalid()
  return result || value
}

function coverUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(value, ASSET_BASE)
    const base = new URL(ASSET_BASE)
    if (
      url.protocol !== 'https:' ||
      url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname) ||
      url.username ||
      url.password
    ) {
      return undefined
    }
    return url.href
  } catch {
    return undefined
  }
}

/** Imports client catalog metadata; it does not establish login or installation. */
export function parseUbisoftLocalCache(buffer: Buffer): AccountGame[] {
  try {
    if (!buffer.length || buffer.length > MAX_CACHE_BYTES) invalid()
    const reader = new ProtobufReader(buffer)
    const products: Product[] = []
    let productCount = 0
    while (!reader.done) {
      const { field, wire } = reader.tag()
      if (field === 1) {
        if (wire !== 2 || ++productCount > MAX_PRODUCTS) invalid()
        const product = decodeProduct(reader.bytes(MAX_PRODUCT_BYTES))
        if (product) products.push(product)
      } else {
        reader.skip(field, wire)
      }
    }
    if (!products.length) invalid()

    // Collect every add-on first: a DLC can precede its parent in the cache.
    const addons = new Set<string>()
    for (const { root } of products) {
      if (root.addons == null) continue
      if (!Array.isArray(root.addons)) invalid()
      for (const addon of root.addons) {
        if (!mapping(addon)) invalid()
        addons.add(productId(addon.id))
      }
    }

    const games = new Map<string, AccountGame>()
    for (const { id, root, localization } of products) {
      if (
        addons.has(id) ||
        root.is_ulc === true ||
        root.is_ulc === 'yes' ||
        root.third_party_platform != null ||
        !root.start_game
      ) {
        continue
      }
      const title = localized(root.name, localization)
        ?.replace(/[®™]/g, '')
        .trim()
      if (!title) invalid()
      games.set(id, {
        id,
        title,
        cover: coverUrl(localized(root.thumb_image, localization)),
        storeUrl: `https://store.ubisoft.com/search?q=${encodeURIComponent(title)}`
      })
    }
    return [...games.values()]
  } catch {
    // Never return a partial library from a damaged or unfamiliar cache.
    return invalid()
  }
}

export async function readUbisoftLocalCatalog(): Promise<{
  games: AccountGame[]
  username: string
  connectionMethod: 'local'
  sourceUpdatedAt: number
}> {
  if (process.platform !== 'win32') {
    throw new Error('UBISOFT_LOCAL_UNSUPPORTED')
  }
  if (!process.env.LOCALAPPDATA) throw new Error('UBISOFT_CLIENT_REQUIRED')
  const cachePath = join(
    process.env.LOCALAPPDATA,
    'Ubisoft Game Launcher',
    'cache',
    'configuration',
    'configurations'
  )
  try {
    const file = await open(cachePath, 'r')
    try {
      const before = await file.stat()
      if (
        !before.isFile() ||
        before.size <= 0 ||
        before.size > MAX_CACHE_BYTES
      ) {
        invalid()
      }
      const buffer = Buffer.alloc(before.size)
      let offset = 0
      while (offset < buffer.length) {
        const { bytesRead } = await file.read(
          buffer,
          offset,
          buffer.length - offset,
          offset
        )
        if (!bytesRead) invalid()
        offset += bytesRead
      }
      const after = await file.stat()
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
        invalid()
      }
      const games = parseUbisoftLocalCache(buffer)
      // An unpopulated client cache must not replace a previously imported library.
      if (!games.length) invalid()
      return {
        games,
        username: 'Biblioteca local · Ubisoft Connect',
        connectionMethod: 'local',
        sourceUpdatedAt: before.mtimeMs
      }
    } finally {
      await file.close()
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      throw new Error('UBISOFT_CLIENT_REQUIRED')
    }
    return invalid()
  }
}
