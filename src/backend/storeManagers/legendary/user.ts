import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from 'graceful-fs'
import { dirname, join } from 'path'
import { homedir, userInfo as user } from 'os'
import { session } from 'electron'

import { UserInfo } from 'common/types'
import { clearCache } from '../../utils'
import { logError, logInfo, LogPrefix, logWarning } from 'backend/logger'
import { libraryManagerMap } from '..'
import { LegendaryCommand } from './commands'
import { NonEmptyString } from './commands/base'
import { configStore } from 'backend/constants/key_value_stores'
import { legendaryUserInfo } from './constants'
import { callAbortController } from 'backend/utils/aborthandler/aborthandler'

const fallbackDefaultLegendaryUserInfo = join(
  homedir(),
  '.config',
  'legendary',
  'user.json'
)

export class LegendaryUser {
  private static isLoggingOut = false
  private static isLoggingIn = false

  public static isAuthTransitioning(): boolean {
    return this.isLoggingOut || this.isLoggingIn
  }

  public static hasValidCredentialsFile(filePath: string): boolean {
    if (!filePath || !existsSync(filePath)) {
      return false
    }
    try {
      const content = readFileSync(filePath, 'utf-8').trim()
      if (!content) return false
      const parsed = JSON.parse(content)
      return Boolean(
        parsed &&
          typeof parsed === 'object' &&
          typeof parsed.access_token === 'string' &&
          parsed.access_token.trim().length > 0 &&
          typeof parsed.account_id === 'string' &&
          parsed.account_id.trim().length > 0
      )
    } catch {
      return false
    }
  }

  private static getCredentialsTimestamp(filePath: string): number {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
      if (parsed?.expires_at) {
        const ts = Date.parse(parsed.expires_at)
        if (!Number.isNaN(ts)) return ts
      }
    } catch {}
    return 0
  }

  private static syncFallbackUserFileIfNeeded(): void {
    if (this.isLoggingOut) return
    try {
      const primaryValid = this.hasValidCredentialsFile(legendaryUserInfo)
      const fallbackValid =
        fallbackDefaultLegendaryUserInfo !== legendaryUserInfo &&
        this.hasValidCredentialsFile(fallbackDefaultLegendaryUserInfo)

      if (fallbackValid) {
        const primaryTs = primaryValid
          ? this.getCredentialsTimestamp(legendaryUserInfo)
          : 0
        const fallbackTs = this.getCredentialsTimestamp(
          fallbackDefaultLegendaryUserInfo
        )
        if (!primaryValid || fallbackTs > primaryTs) {
          mkdirSync(dirname(legendaryUserInfo), { recursive: true })
          copyFileSync(fallbackDefaultLegendaryUserInfo, legendaryUserInfo)
          logInfo(
            [
              'Synchronized newer Epic Games credentials from fallback path to',
              legendaryUserInfo
            ],
            LogPrefix.Legendary
          )
        }
      }
    } catch (error) {
      logWarning(
        ['Failed to check/sync fallback Legendary user.json:', error],
        LogPrefix.Legendary
      )
    }
  }

  public static clearInvalidCredentials(): void {
    try {
      if (
        existsSync(legendaryUserInfo) &&
        !this.hasValidCredentialsFile(legendaryUserInfo)
      ) {
        rmSync(legendaryUserInfo, { force: true })
      }
      if (
        existsSync(fallbackDefaultLegendaryUserInfo) &&
        !this.hasValidCredentialsFile(fallbackDefaultLegendaryUserInfo)
      ) {
        rmSync(fallbackDefaultLegendaryUserInfo, { force: true })
      }
      if (!this.hasValidCredentialsFile(legendaryUserInfo)) {
        configStore.delete('userInfo')
      }
    } catch {}
  }

  public static async login(
    authorizationCode: string
  ): Promise<{ status: 'done' | 'failed'; data: UserInfo | undefined }> {
    let cleanCode = authorizationCode.trim()
    if (cleanCode.startsWith('{') && cleanCode.includes('authorizationCode')) {
      try {
        const parsed = JSON.parse(cleanCode)
        cleanCode =
          parsed.authorizationCode ||
          parsed.sid ||
          (parsed.redirectUrl
            ? new URL(parsed.redirectUrl).searchParams.get('code') || cleanCode
            : cleanCode)
      } catch {}
    } else if (
      cleanCode.startsWith('http://') ||
      cleanCode.startsWith('https://')
    ) {
      try {
        const parsedUrl = new URL(cleanCode)
        cleanCode =
          parsedUrl.searchParams.get('code') ||
          parsedUrl.searchParams.get('sid') ||
          cleanCode
      } catch {}
    }

    const command: LegendaryCommand = {
      subcommand: 'auth',
      '--code': NonEmptyString.parse(cleanCode)
    }

    const errorMessage = (
      error: string
    ): { status: 'failed'; data: undefined } => {
      logError(['Failed to login with Legendary:', error], LogPrefix.Legendary)

      return { status: 'failed', data: undefined }
    }

    this.isLoggingIn = true
    callAbortController('legendary-refresh')
    callAbortController('legendary-check-updates')

    try {
      const res = await libraryManagerMap['legendary'].runRunnerCommand(
        command,
        {
          abortId: 'legendary-login',
          logMessagePrefix: 'Logging in'
        }
      )

      if (res.stderr.includes('ERROR: Logging in ')) {
        return errorMessage(res.stderr)
      }

      if (res.error || res.abort) {
        return errorMessage(res.error ?? 'abort by user')
      }

      this.isLoggingIn = false
      const userInfo = this.getUserInfo()
      return { status: 'done', data: userInfo }
    } catch (error) {
      return errorMessage(`${error}`)
    } finally {
      this.isLoggingIn = false
    }
  }

  public static async logout() {
    this.isLoggingOut = true
    callAbortController('legendary-refresh')
    callAbortController('legendary-check-updates')

    try {
      const command: LegendaryCommand = { subcommand: 'auth', '--delete': true }

      const res = await libraryManagerMap['legendary'].runRunnerCommand(
        command,
        {
          abortId: 'legendary-logout',
          logMessagePrefix: 'Logging out'
        }
      )

      if (res.error || res.abort) {
        logError(
          ['Failed to logout:', res.error ?? 'abort by user'],
          LogPrefix.Legendary
        )
      }

      try {
        if (existsSync(legendaryUserInfo)) {
          rmSync(legendaryUserInfo, { force: true })
        }
        if (existsSync(fallbackDefaultLegendaryUserInfo)) {
          rmSync(fallbackDefaultLegendaryUserInfo, { force: true })
        }
      } catch {}

      const ses = session.fromPartition('persist:epic')
      await ses.clearStorageData()
      await ses.clearCache()
      await ses.clearAuthCache()
      await ses.clearHostResolverCache()
      await ses.clearData()
      configStore.delete('userInfo')
      clearCache('legendary')
    } finally {
      this.isLoggingOut = false
    }
  }

  public static isLoggedIn(): boolean {
    if (this.isLoggingOut || this.isLoggingIn) {
      return false
    }
    this.syncFallbackUserFileIfNeeded()
    if (!existsSync(legendaryUserInfo)) {
      return false
    }
    if (!this.hasValidCredentialsFile(legendaryUserInfo)) {
      try {
        rmSync(legendaryUserInfo, { force: true })
      } catch {}
      configStore.delete('userInfo')
      return false
    }
    return true
  }

  public static getUserInfo(): UserInfo | undefined {
    if (!LegendaryUser.isLoggedIn()) {
      configStore.delete('userInfo')
      return
    }
    try {
      const userInfoContent = readFileSync(legendaryUserInfo, 'utf-8')
      const userInfoObject = JSON.parse(userInfoContent)
      const info: UserInfo = {
        account_id: userInfoObject.account_id,
        displayName: userInfoObject.displayName,
        user: user().username
      }
      configStore.set('userInfo', info)
      return info
    } catch (error) {
      logError(
        [`User info file corrupted, check ${legendaryUserInfo}. Error:`, error],
        LogPrefix.Legendary
      )
      return
    }
  }
}
