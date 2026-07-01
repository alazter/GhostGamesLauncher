import { GlobalConfig } from 'backend/config'
import { addHandler } from 'backend/ipc'
import { logError, LogPrefix } from 'backend/logger'
import * as SteamGridDB from './utils'
import { encryptApiKey, decryptApiKey, isEncryptedValue } from './secureKey'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, readdirSync, unlinkSync } from 'graceful-fs'
import axios from 'axios'
import { appFolder } from '../constants/paths'

function readStoredApiKey(): string {
  const stored: string = GlobalConfig.get().getSettings().steamGridDbApiKey
  return stored ?? ''
}

function getDecryptedApiKey(): string {
  const stored = readStoredApiKey()
  if (!stored) return ''

  // Migrate legacy plaintext values on first read.
  if (!isEncryptedValue(stored)) {
    const reEncrypted = encryptApiKey(stored)
    if (isEncryptedValue(reEncrypted)) {
      GlobalConfig.get().setSetting('steamGridDbApiKey', reEncrypted)
    }
    return stored
  }

  return decryptApiKey(stored)
}

addHandler('steamgriddb.hasApiKey', () => !!readStoredApiKey())

addHandler('steamgriddb.setApiKey', (event, key) => {
  const trimmed = key.trim()
  const stored = trimmed ? encryptApiKey(trimmed) : ''
  GlobalConfig.get().setSetting('steamGridDbApiKey', stored)
})

addHandler('steamgriddb.searchGame', async (event, query) => {
  const apiKey = getDecryptedApiKey()
  if (!apiKey) {
    return []
  }

  try {
    const results = await SteamGridDB.searchGame(apiKey, query)
    return results.map((game) => ({
      id: game.id,
      name: game.name
    }))
  } catch (error) {
    logError(['SteamGridDB search failed:', error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.getGrids', async (event, args) => {
  const apiKey = getDecryptedApiKey()
  if (!apiKey) {
    return []
  }

  const nsfwSetting = GlobalConfig.get().getSettings().steamGridDbNsfw ? 'any' : 'false'

  try {
    const results = await SteamGridDB.getGrids(apiKey, {
      gameId: args.gameId,
      dimensions: args.dimensions,
      styles: args.styles,
      types: args.types,
      nsfw: args.nsfw ?? nsfwSetting,
      page: args.page
    })
    return results.map((grid) => ({
      id: grid.id,
      url: grid.url,
      thumb: grid.thumb
    }))
  } catch (error) {
    logError([`SteamGridDB getGrids failed:`, error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.getHeroes', async (event, args) => {
  const apiKey = getDecryptedApiKey()
  if (!apiKey) {
    return []
  }

  const nsfwSetting = GlobalConfig.get().getSettings().steamGridDbNsfw ? 'any' : 'false'

  try {
    const results = await SteamGridDB.getHeroes(apiKey, {
      gameId: args.gameId,
      dimensions: args.dimensions,
      styles: args.styles,
      types: args.types,
      nsfw: args.nsfw ?? nsfwSetting,
      page: args.page
    })
    return results.map((grid) => ({
      id: grid.id,
      url: grid.url,
      thumb: grid.thumb
    }))
  } catch (error) {
    logError([`SteamGridDB getHeroes failed:`, error], LogPrefix.Backend)
    throw error
  }
})

addHandler('steamgriddb.downloadCover', async (event, args) => {
  const customCoversPath = join(appFolder, 'custom-covers')
  if (!existsSync(customCoversPath)) {
    mkdirSync(customCoversPath)
  }

  // Delete any existing cover files for this app and target type (e.g. diff extensions) to save disk space
  try {
    const files = readdirSync(customCoversPath)
    const prefix = `${args.appName}_${args.targetType}.`
    for (const file of files) {
      if (file.startsWith(prefix)) {
        try {
          unlinkSync(join(customCoversPath, file))
        } catch {}
      }
    }
  } catch {}

  const ext = args.url.split('?')[0].split('.').pop()?.toLowerCase() || 'webp'
  const destPath = join(customCoversPath, `${args.appName}_${args.targetType}.${ext}`)

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  try {
    const response = await axios({
      method: 'get',
      url: args.url,
      responseType: 'stream',
      headers
    })

    const writer = createWriteStream(destPath)
    response.data.pipe(writer)

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })

    return destPath
  } catch (error) {
    logError([`Failed to download SteamGridDB cover:`, error], LogPrefix.Backend)
    throw error
  }
})
