import { existsSync, readFileSync } from 'graceful-fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { configStore, libraryStore } from './electronStores'
import { isWindows, isMac } from 'backend/constants/environment'
import { homedir } from 'os'
import { sendFrontendMessage } from 'backend/ipc'

const execAsync = promisify(exec)

export interface DetectedSteamAccount {
  steamId64: string
  steamId32: string
  accountName: string
  personaName: string
  avatar?: string
  steamPath: string
}

export class SteamUser {
  private static cachedSteamPath: string | null = null

  public static async getSteamPath(): Promise<string | null> {
    if (this.cachedSteamPath && existsSync(this.cachedSteamPath)) {
      return this.cachedSteamPath
    }

    if (isWindows) {
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "(Get-ItemProperty -Path HKCU:\\Software\\Valve\\Steam).SteamPath"'
        )
        const regPath = stdout.trim().replace(/\//g, '\\')
        if (regPath && existsSync(regPath)) {
          this.cachedSteamPath = regPath
          return regPath
        }
      } catch {}

      const fallbacks = [
        'N:\\Steam',
        'C:\\Program Files (x86)\\Steam',
        'C:\\Program Files\\Steam',
        'D:\\Steam',
        'E:\\Steam'
      ]
      for (const p of fallbacks) {
        if (existsSync(p)) {
          this.cachedSteamPath = p
          return p
        }
      }
    } else if (isMac) {
      const macPath = join(homedir(), 'Library', 'Application Support', 'Steam')
      if (existsSync(macPath)) {
        this.cachedSteamPath = macPath
        return macPath
      }
    } else {
      // Linux
      const linuxPaths = [
        join(homedir(), '.steam', 'steam'),
        join(homedir(), '.local', 'share', 'Steam'),
        join(homedir(), '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam')
      ]
      for (const p of linuxPaths) {
        if (existsSync(p)) {
          this.cachedSteamPath = p
          return p
        }
      }
    }

    return null
  }

  public static async getDetectedAccount(): Promise<DetectedSteamAccount | null> {
    const steamPath = await this.getSteamPath()
    if (!steamPath) return null

    const loginUsersPath = join(steamPath, 'config', 'loginusers.vdf')
    if (!existsSync(loginUsersPath)) return null

    try {
      const content = readFileSync(loginUsersPath, 'utf8')
      // Parse users block
      const userMatches = [
        ...content.matchAll(
          /"(\d{17})"\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g
        )
      ]

      let bestUser: {
        steamId64: string
        personaName: string
        accountName: string
        timestamp: number
        mostRecent: boolean
      } | null = null

      for (const match of userMatches) {
        const steamId64 = match[1]
        const block = match[2]

        const personaMatch = block.match(/"PersonaName"\s+"([^"]+)"/i)
        const accountMatch = block.match(/"AccountName"\s+"([^"]+)"/i)
        const mostRecentMatch = block.match(/"MostRecent"\s+"([^"]+)"/i)
        const autoLoginMatch = block.match(/"AutoLogin"\s+"([^"]+)"/i)
        const timestampMatch = block.match(/"Timestamp"\s+"([^"]+)"/i)

        const personaName = personaMatch ? personaMatch[1] : 'Steam User'
        const accountName = accountMatch ? accountMatch[1] : ''
        const mostRecent = mostRecentMatch ? mostRecentMatch[1] === '1' : false
        const autoLogin = autoLoginMatch ? autoLoginMatch[1] === '1' : false
        const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : 0

        if (
          !bestUser ||
          mostRecent ||
          autoLogin ||
          timestamp > bestUser.timestamp
        ) {
          bestUser = {
            steamId64,
            personaName,
            accountName,
            timestamp,
            mostRecent
          }
          if (mostRecent || autoLogin) break
        }
      }

      if (!bestUser) return null

      // Convert SteamID64 to SteamID32: steamId64 - 76561197960265728
      const steamId64Big = BigInt(bestUser.steamId64)
      const baseBig = BigInt('76561197960265728')
      const steamId32 = (steamId64Big - baseBig).toString()

      return {
        steamId64: bestUser.steamId64,
        steamId32,
        accountName: bestUser.accountName,
        personaName: bestUser.personaName,
        steamPath
      }
    } catch (err) {
      logError(['Failed to parse loginusers.vdf', err], LogPrefix.Steam)
      return null
    }
  }

  public static async isLoggedIn(): Promise<boolean> {
    if (configStore.has('sessionCookie') || configStore.has('apiKey')) {
      configStore.set('isLoggedIn', true)
      return true
    }

    if (configStore.has('isLoggedIn')) {
      const val = configStore.get('isLoggedIn', false)
      if (val) return true
    }

    // Auto-detect if Steam is installed on the machine
    const account = await this.getDetectedAccount()
    if (account) {
      configStore.set('isLoggedIn', true)
      configStore.set('username', account.personaName)
      configStore.set('steamId', account.steamId64)
      configStore.set('steamId32', account.steamId32)
      return true
    }

    return false
  }

  public static async getUserDetails(): Promise<{
    username: string
    steamId: string
    steamId32: string
    isLoggedIn: boolean
  }> {
    const loggedIn = await this.isLoggedIn()
    if (!loggedIn) {
      return { username: '', steamId: '', steamId32: '', isLoggedIn: false }
    }

    let username = configStore.get('username', '') as string
    let steamId = configStore.get('steamId', '') as string
    let steamId32 = configStore.get('steamId32', '') as string

    if (!username || !steamId) {
      const account = await this.getDetectedAccount()
      if (account) {
        username = account.personaName
        steamId = account.steamId64
        steamId32 = account.steamId32
        configStore.set('username', username)
        configStore.set('steamId', steamId)
        configStore.set('steamId32', steamId32)
      }
    }

    return {
      username,
      steamId,
      steamId32,
      isLoggedIn: true
    }
  }

  public static async login(): Promise<boolean> {
    const account = await this.getDetectedAccount()
    if (account) {
      configStore.set('isLoggedIn', true)
      configStore.set('username', account.personaName)
      configStore.set('steamId', account.steamId64)
      configStore.set('steamId32', account.steamId32)
      logInfo(
        `Steam account connected: ${account.personaName} (${account.steamId64})`,
        LogPrefix.Steam
      )
      sendFrontendMessage('refreshLibrary', 'steam')
      return true
    }
    return false
  }

  public static async logout(): Promise<void> {
    configStore.set('isLoggedIn', false)
    configStore.delete('username')
    configStore.delete('steamId')
    configStore.delete('steamId32')
    libraryStore.clear()
    libraryStore.set('games', [])
    logInfo('Steam account disconnected', LogPrefix.Steam)
    sendFrontendMessage('refreshLibrary', 'steam')
  }
}
