import { LogPrefix, logDebug, logError, logInfo } from 'backend/logger'
import {
  NileLoginData,
  NileRegisterData,
  NileUserData
} from 'common/types/nile'
import { libraryManagerMap } from '..'
import { existsSync, readFileSync } from 'graceful-fs'
import { configStore } from './electronStores'
import { clearCache } from 'backend/utils'
import { nileUserData } from './constants'
import { session } from 'electron'

function authLogSanitizer(line: string) {
  try {
    const output = JSON.parse(line)
    output.url = '<redacted>'
    output.code_verifier = '<redacted>'
    output.serial = '<redacted>'
    output.client_id = '<redacted>'
    return JSON.stringify(output) + '\n'
  } catch {
    return line
  }
}

export class NileUser {
  static async getLoginData(): Promise<NileLoginData> {
    logDebug('Getting login data from Nile', LogPrefix.Nile)
    const { stdout } = await libraryManagerMap['nile'].runRunnerCommand(
      ['auth', '--login', '--non-interactive'],
      {
        abortId: 'nile-auth',
        logSanitizer: authLogSanitizer
      }
    )
    const output: NileLoginData = JSON.parse(stdout)

    logInfo(['Register data is:', output], LogPrefix.Nile)
    return output
  }

  static async login(
    data: NileRegisterData
  ): Promise<{ status: 'done' | 'failed'; user: NileUserData | undefined }> {
    logDebug(['Got register data:', data], LogPrefix.Nile)
    const { code, code_verifier, serial, client_id } = data
    // Nile prints output to stderr
    const { stderr: output } = await libraryManagerMap['nile'].runRunnerCommand(
      [
        'register',
        '--code',
        code,
        '--code-verifier',
        code_verifier,
        '--serial',
        serial,
        '--client-id',
        client_id
      ],
      { abortId: 'nile-login' }
    )

    const successRegex = /\[AUTH_MANAGER]:.*Succesfully registered a device/
    if (!successRegex.test(output)) {
      // Authentication failed
      logError(['Authentication failed:', output], LogPrefix.Nile)
      return {
        status: 'failed',
        user: undefined
      }
    }

    logInfo('Authentication successful', LogPrefix.Nile)
    const user = await this.getUserData()
    if (!user) {
      return {
        status: 'failed',
        user: undefined
      }
    }

    return {
      status: 'done',
      user
    }
  }

  static async logout() {
    const commandParts = ['auth', '--logout']

    const res = await libraryManagerMap['nile'].runRunnerCommand(commandParts, {
      abortId: 'nile-logout'
    })

    if (res.abort) {
      logError('Failed to logout: abort by user', LogPrefix.Nile)
      return
    }

    configStore.delete('userData')
    clearCache('nile')
    const ses = session.fromPartition('persist:amazon')
    ses.clearStorageData().catch(() => {})
    ses.clearCache().catch(() => {})
    ses.clearAuthCache().catch(() => {})
  }

  static async getUserData(): Promise<NileUserData | undefined> {
    if (!existsSync(nileUserData)) {
      logError('current_user.json does not exist', LogPrefix.Nile)
      configStore.delete('userData')
      return
    }

    try {
      const user: NileUserData = JSON.parse(readFileSync(nileUserData, 'utf-8'))
      if (!Object.keys(user).length || !user.user_id) {
        logInfo('current_user.json is empty or invalid', LogPrefix.Nile)
        configStore.delete('userData')
        return
      }

      configStore.set('userData', user)
      logInfo('Saved user data to config file', LogPrefix.Nile)

      return user
    } catch (e) {
      logError(['Failed to read current_user.json:', e], LogPrefix.Nile)
      return
    }
  }

  public static isLoggedIn(): boolean {
    const user = configStore.get_nodefault('userData')
    if (user && Object.keys(user).length && user.user_id) {
      return true
    }

    if (existsSync(nileUserData)) {
      try {
        const diskUser: NileUserData = JSON.parse(readFileSync(nileUserData, 'utf-8'))
        if (diskUser && Object.keys(diskUser).length && diskUser.user_id) {
          configStore.set('userData', diskUser)
          return true
        }
      } catch {}
    }

    return false
  }
}
