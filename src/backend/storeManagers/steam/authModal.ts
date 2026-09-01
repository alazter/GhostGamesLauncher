import { BrowserWindow, session } from 'electron'
import { logInfo, logError, LogPrefix } from 'backend/logger'
import { configStore } from './electronStores'
import { SteamUser } from './user'

export class SteamAuthModal {
  private static authWindow: BrowserWindow | null = null

  public static async openLoginModal(): Promise<boolean> {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.focus()
      return true
    }

    logInfo('Opening Steam Community secure login modal', LogPrefix.Steam)

    return new Promise((resolve) => {
      this.authWindow = new BrowserWindow({
        width: 1024,
        height: 720,
        title: 'Conectar com a Steam',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      const steamSession = this.authWindow.webContents.session

      const checkAuthCookies = async () => {
        try {
          const cookies = await steamSession.cookies.get({
            domain: 'steamcommunity.com'
          })
          const loginSecure = cookies.find(
            (c) => c.name === 'steamLoginSecure'
          )
          if (loginSecure && loginSecure.value) {
            logInfo('Steam login session cookie captured successfully', LogPrefix.Steam)
            configStore.set('sessionCookie', loginSecure.value)
            configStore.set('syncMode', 'webView')
            configStore.set('isLoggedIn', true)
            const account = await SteamUser.getDetectedAccount()
            if (account) {
              configStore.set('username', account.personaName)
              configStore.set('steamId', account.steamId64)
              configStore.set('steamId32', account.steamId32)
            }
            if (this.authWindow && !this.authWindow.isDestroyed()) {
              this.authWindow.close()
            }
            resolve(true)
            return true
          }
        } catch (err) {
          logError(['Error reading Steam auth cookies', err], LogPrefix.Steam)
        }
        return false
      }

      this.authWindow.webContents.on('did-navigate', async () => {
        await checkAuthCookies()
      })

      this.authWindow.webContents.on('did-navigate-in-page', async () => {
        await checkAuthCookies()
      })

      this.authWindow.on('closed', async () => {
        this.authWindow = null
        const isAuthed = await checkAuthCookies()
        resolve(isAuthed)
      })

      void this.authWindow.loadURL(
        'https://steamcommunity.com/login/home/?goto=%2Fmy%2Fgames%2F'
      )
    })
  }

  public static async logout(): Promise<void> {
    configStore.delete('sessionCookie')
    configStore.delete('apiKey')
    configStore.set('syncMode', 'all')
    const steamSession = session.defaultSession
    await steamSession.clearStorageData({
      origin: 'https://steamcommunity.com',
      storages: ['cookies', 'localstorage']
    })
    logInfo('Steam web session cleared', LogPrefix.Steam)
  }
}
