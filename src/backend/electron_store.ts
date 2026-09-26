import Store from 'electron-store'

import {
  StoreStructure,
  TypeCheckedStore,
  UnknownGuard,
  ValidStoreName
} from 'common/types/electron_store'
import { Get } from 'type-fest'

const safeDeserialize = (text: string) => {
  if (typeof text !== 'string') return {}
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return {}
  try {
    return JSON.parse(clean)
  } catch (err) {
    const firstBrace = clean.indexOf('{')
    const firstBracket = clean.indexOf('[')
    const startIdx =
      firstBrace !== -1 && firstBracket !== -1
        ? Math.min(firstBrace, firstBracket)
        : firstBrace !== -1
          ? firstBrace
          : firstBracket

    const lastBrace = clean.lastIndexOf('}')
    const lastBracket = clean.lastIndexOf(']')
    const endIdx = Math.max(lastBrace, lastBracket)

    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        const sliced = clean.slice(startIdx, endIdx + 1)
        return JSON.parse(sliced)
      } catch {}
    }
    return {}
  }
}

export class TypeCheckedStoreBackend<
  Name extends ValidStoreName
> implements TypeCheckedStore<Name> {
  private store: Store

  constructor(name: Name, options: Store.Options<StoreStructure[Name]>) {
    const safeOptions: Store.Options<StoreStructure[Name]> = {
      clearInvalidConfig: true,
      ...options,
      deserialize: (options.deserialize as any) || safeDeserialize
    }
    try {
      // @ts-expect-error This looks like a bug in electron-store's type definitions
      this.store = new Store(safeOptions)
    } catch {
      // @ts-expect-error This looks like a bug in electron-store's type definitions
      this.store = new Store({ ...safeOptions, clearInvalidConfig: true })
    }
  }

  public has(key: string) {
    return this.store.has(key)
  }

  public get<KeyType extends string>(
    key: KeyType,
    defaultValue: NonNullable<UnknownGuard<Get<StoreStructure[Name], KeyType>>>
  ) {
    return this.store.get(key, defaultValue) as NonNullable<
      UnknownGuard<Get<StoreStructure[Name], KeyType>>
    >
  }

  public get_nodefault<KeyType extends string>(key: KeyType) {
    return this.store.get(key) as UnknownGuard<
      Get<StoreStructure[Name], KeyType> | undefined
    >
  }

  public set<KeyType extends string>(
    key: KeyType,
    value: UnknownGuard<Get<StoreStructure[Name], KeyType>>
  ) {
    this.store.set(key, value)
  }

  public delete<KeyType extends string>(key: KeyType) {
    this.store.delete(key)
  }

  public clear() {
    this.store.clear()
  }

  public get raw_store() {
    return this.store.store as StoreStructure[Name]
  }
}
