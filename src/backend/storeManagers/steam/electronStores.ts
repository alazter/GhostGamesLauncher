import { TypeCheckedStoreBackend } from '../../electron_store'
import CacheStore from '../../cache'
import { GameInfo } from 'common/types'
import { safeStorage } from 'electron'

const installedGamesStore = new TypeCheckedStoreBackend(
  'steamInstalledGamesStore',
  {
    cwd: 'steam_store',
    name: 'installed'
  }
)

const configStore = new TypeCheckedStoreBackend('steamConfigStore', {
  cwd: 'steam_store'
})

const libraryStore = new CacheStore<GameInfo[], 'games'>('steam_library', null)

export function encryptSteamSecret(plainText: string): string {
  const trimmed = plainText.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('enc:')) return trimmed
  try {
    if (
      safeStorage &&
      typeof safeStorage.isEncryptionAvailable === 'function' &&
      safeStorage.isEncryptionAvailable()
    ) {
      return `enc:${safeStorage.encryptString(trimmed).toString('base64')}`
    }
  } catch {}
  return trimmed
}

export function decryptSteamSecret(stored: string): string {
  if (!stored || typeof stored !== 'string') return ''
  if (!stored.startsWith('enc:')) return stored
  try {
    if (
      safeStorage &&
      typeof safeStorage.isEncryptionAvailable === 'function' &&
      safeStorage.isEncryptionAvailable()
    ) {
      const buf = Buffer.from(stored.slice(4), 'base64')
      return safeStorage.decryptString(buf)
    }
  } catch {}
  return ''
}

export { configStore, installedGamesStore, libraryStore }
