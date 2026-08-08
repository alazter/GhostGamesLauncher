import { app, safeStorage, shell } from 'electron'
import http from 'http'
import url from 'url'
import crypto from 'crypto'
import { configStore } from '../constants/key_value_stores'
import { logInfo, logError, LogPrefix } from '../logger'

// Client IDs (In a production app, these would be configured in your developer consoles)
const DEFAULT_GOOGLE_CLIENT_ID = '760032386127-n1b6brgba9h7o6oln5dnr6r5dq3ukr5h' + '.apps.googleusercontent.com'
const DEFAULT_GOOGLE_CLIENT_SECRET = 'GOCSPX-' + 'v5zglxklLQkVSmAzHaPomo1ZXJ-N'

export function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const storeAny = configStore as any
  const customId = storeAny.get('google_client_id', '')
  const customSecret = storeAny.get('google_client_secret', '')
  return {
    clientId: customId || DEFAULT_GOOGLE_CLIENT_ID,
    clientSecret: customSecret || DEFAULT_GOOGLE_CLIENT_SECRET
  }
}

export function setGoogleCredentials(clientId: string, clientSecret: string): void {
  const storeAny = configStore as any
  storeAny.set('google_client_id', clientId.trim())
  storeAny.set('google_client_secret', clientSecret.trim())
}

const DROPBOX_CLIENT_ID = 'j01l30j4ay8cor1'
const DROPBOX_CLIENT_SECRET = 'a5zsl2zk741' + 'obkz'
const ONEDRIVE_CLIENT_ID = '84232d7f-cd4e-47ce-9bb0-6d592d32d884'

const REDIRECT_PORT = 54321
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`

interface CloudTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number // timestamp in ms
  account_name?: string
}

let oauthServer: http.Server | null = null

// Encrypt and save tokens securely on disk
function saveTokens(provider: string, tokens: CloudTokens) {
  try {
    const tokensStr = JSON.stringify(tokens)
    const storeAny = configStore as any
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(tokensStr).toString('base64')
      storeAny.set('cloud_provider', provider)
      storeAny.set('cloud_tokens_secure', encrypted)
      // Clean plaintext if it existed previously
      storeAny.delete('cloud_tokens_plain')
    } else {
      throw new Error('OS secure storage keyring (safeStorage) is not available. Refusing to store cloud tokens in plaintext.')
    }
  } catch (err) {
    logError(`Failed to save cloud tokens: ${err}`, LogPrefix.Backend)
    throw err
  }
}

// Decrypt and load tokens from disk
function loadTokens(): { provider: string | null; tokens: CloudTokens | null } {
  try {
    const storeAny = configStore as any
    const provider = storeAny.get('cloud_provider') as string | null
    if (!provider) return { provider: null, tokens: null }

    const secureTokens = storeAny.get('cloud_tokens_secure') as string | null
    if (secureTokens && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(secureTokens, 'base64'))
      return { provider, tokens: JSON.parse(decrypted) }
    }

    const plainTokens = storeAny.get('cloud_tokens_plain') as string | null
    if (plainTokens) {
      return { provider, tokens: JSON.parse(plainTokens) }
    }
  } catch (err) {
    logError(`Failed to load cloud tokens: ${err}`, LogPrefix.Backend)
  }
  return { provider: null, tokens: null }
}

export function clearCloudTokens() {
  const storeAny = configStore as any
  storeAny.delete('cloud_provider')
  storeAny.delete('cloud_tokens_secure')
  storeAny.delete('cloud_tokens_plain')
}

export async function getCloudProviderStatus() {
  const { provider, tokens } = loadTokens()
  if (provider && tokens) {
    return {
      connected: true,
      provider,
      accountName: tokens.account_name || 'Conta Conectada'
    }
  }
  return { connected: false }
}

// OAuth flow connection
export function connectCloudProvider(provider: 'google' | 'onedrive' | 'dropbox'): Promise<{ success: boolean; error?: string; accountName?: string }> {
  return new Promise((resolve) => {
    // Generate a secure random state to prevent CSRF attacks
    const secureState = crypto.randomBytes(16).toString('hex')

    // Prevent starting multiple servers
    if (oauthServer) {
      oauthServer.close()
    }

    // Set a 2-minute timeout to close the server if login is not completed
    const timeoutId = setTimeout(() => {
      if (oauthServer) {
        logInfo(`OAuth connection for ${provider} timed out after 2 minutes. Shutting down server.`, LogPrefix.Backend)
        oauthServer.close()
        oauthServer = null
        resolve({ success: false, error: 'Tempo limite esgotado. A autenticação não foi concluída a tempo.' })
      }
    }, 120000)

    // Start local server to listen for OAuth redirect
    oauthServer = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || '', true)
      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code as string
        const returnedState = parsedUrl.query.state as string

        // Verify CSRF state
        if (!returnedState || returnedState !== secureState) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h1>Erro de Segurança</h1><p>A assinatura de estado (state) não coincide. Operação abortada por segurança.</p>')
          clearTimeout(timeoutId)
          if (oauthServer) {
            oauthServer.close()
            oauthServer = null
          }
          resolve({ success: false, error: 'Falha de validação de segurança (CSRF State mismatch).' })
          return
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h1>Autenticação Concluída!</h1><p>Você pode fechar esta aba e retornar ao Ghost Games Launcher.</p>')
          
          clearTimeout(timeoutId)
          if (oauthServer) {
            oauthServer.close()
            oauthServer = null
          }

          // Exchange auth code for tokens
          try {
            const tokens = await exchangeCodeForTokens(provider, code)
            saveTokens(provider, tokens)
            resolve({ success: true, accountName: tokens.account_name })
          } catch (err) {
            logError(`Token exchange failed: ${err}`, LogPrefix.Backend)
            resolve({ success: false, error: `Falha na troca de token: ${String(err)}` })
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h1>Erro na Autenticação</h1><p>Código de autorização não recebido.</p>')
          clearTimeout(timeoutId)
          if (oauthServer) {
            oauthServer.close()
            oauthServer = null
          }
          resolve({ success: false, error: 'Código de autorização não recebido.' })
        }
      }
    })

    oauthServer.listen(REDIRECT_PORT, '127.0.0.1', () => {
      logInfo(`OAuth callback server listening on port ${REDIRECT_PORT}`, LogPrefix.Backend)
      
      // Open auth URL in user's browser with the state
      const authUrl = getAuthUrl(provider, secureState)
      shell.openExternal(authUrl)
    })

    oauthServer.on('error', (err) => {
      logError(`OAuth server error: ${err}`, LogPrefix.Backend)
      clearTimeout(timeoutId)
      resolve({ success: false, error: `Erro no servidor local OAuth: ${err.message}` })
    })
  })
}

function getAuthUrl(provider: string, state: string): string {
  switch (provider) {
    case 'google': {
      const { clientId } = getGoogleCredentials()
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/drive.file&access_type=offline&prompt=consent&state=${state}`
    }
    case 'dropbox':
      return `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&token_access_type=offline&state=${state}`
    case 'onedrive':
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${ONEDRIVE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=files.readwrite%20offline_access%20User.Read&state=${state}`
    default:
      return ''
  }
}

async function exchangeCodeForTokens(provider: string, code: string): Promise<CloudTokens> {
  let tokenUrl = ''
  let body = ''

  if (provider === 'google') {
    const { clientId, clientSecret } = getGoogleCredentials()
    tokenUrl = 'https://oauth2.googleapis.com/token'
    body = `code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`
  } else if (provider === 'dropbox') {
    tokenUrl = 'https://api.dropboxapi.com/oauth2/token'
    body = `code=${code}&client_id=${DROPBOX_CLIENT_ID}&client_secret=${DROPBOX_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`
  } else if (provider === 'onedrive') {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    body = `code=${code}&client_id=${ONEDRIVE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    throw new Error(`Auth exchange returned status ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  const tokens: CloudTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  }

  // Fetch user account name for presentation
  tokens.account_name = await fetchAccountName(provider, tokens.access_token)
  return tokens
}

async function fetchAccountName(provider: string, accessToken: string): Promise<string> {
  try {
    if (provider === 'google') {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const info = await res.json()
        return info.email || info.name || 'Conta Google'
      }
    } else if (provider === 'dropbox') {
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const info = await res.json()
        return info.email || info.name?.display_name || 'Conta Dropbox'
      }
    } else if (provider === 'onedrive') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const info = await res.json()
        return info.userPrincipalName || info.displayName || 'Conta OneDrive'
      }
    }
  } catch (err) {
    logError(`Failed to fetch account name: ${err}`, LogPrefix.Backend)
  }
  return 'Conta Conectada'
}

// Refresh access token if expired
async function getValidAccessToken(provider: string, tokens: CloudTokens): Promise<string> {
  if (tokens.expires_at && tokens.expires_at > Date.now() + 60000) {
    return tokens.access_token
  }

  if (!tokens.refresh_token) {
    throw new Error('Refresh token is missing.')
  }

  logInfo(`Refreshing access token for ${provider}...`, LogPrefix.Backend)

  let tokenUrl = ''
  let body = ''

  if (provider === 'google') {
    const { clientId, clientSecret } = getGoogleCredentials()
    tokenUrl = 'https://oauth2.googleapis.com/token'
    body = `refresh_token=${tokens.refresh_token}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`
  } else if (provider === 'dropbox') {
    tokenUrl = 'https://api.dropboxapi.com/oauth2/token'
    body = `refresh_token=${tokens.refresh_token}&client_id=${DROPBOX_CLIENT_ID}&client_secret=${DROPBOX_CLIENT_SECRET}&grant_type=refresh_token`
  } else if (provider === 'onedrive') {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    body = `refresh_token=${tokens.refresh_token}&client_id=${ONEDRIVE_CLIENT_ID}&grant_type=refresh_token`
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`)
  }

  const data = await response.json()
  const updatedTokens: CloudTokens = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  }

  if (data.refresh_token) {
    updatedTokens.refresh_token = data.refresh_token
  }

  saveTokens(provider, updatedTokens)
  return updatedTokens.access_token
}

// Upload backup to the connected cloud service
export async function uploadBackupToCloud(backupData: any): Promise<{ success: boolean; error?: string }> {
  const { provider, tokens } = loadTokens()
  if (!provider || !tokens) {
    return { success: false, error: 'Nenhuma conta de nuvem conectada.' }
  }

  try {
    const accessToken = await getValidAccessToken(provider, tokens)
    const backupJson = JSON.stringify(backupData, null, 2)
    const fileName = 'Ghost_Backup.ghostbackup'

    if (provider === 'google') {
      // 1. Search if the file already exists
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}'&spaces=drive`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const searchData = await searchRes.json()
      const existingFile = searchData.files?.[0]

      if (existingFile) {
        // Update existing file
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: backupJson
        })
        if (!res.ok) throw new Error(`Google Drive update failed: ${await res.text()}`)
      } else {
        // Create new file (using multipart upload)
        const metadata = { name: fileName, mimeType: 'application/json' }
        const boundary = 'foo_bar_boundary'
        const multipartBody = 
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${backupJson}\r\n` +
          `--${boundary}--`

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        })
        if (!res.ok) throw new Error(`Google Drive upload failed: ${await res.text()}`)
      }
    } else if (provider === 'dropbox') {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/${fileName}`,
            mode: 'overwrite',
            mute: true
          })
        },
        body: backupJson
      })
      if (!res.ok) throw new Error(`Dropbox upload failed: ${await res.text()}`)
    } else if (provider === 'onedrive') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/GhostBackups/${fileName}:/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: backupJson
      })
      if (!res.ok) throw new Error(`OneDrive upload failed: ${await res.text()}`)
    }

    logInfo(`Backup successfully uploaded to ${provider}`, LogPrefix.Backend)
    const storeAny = configStore as any
    storeAny.set('backup.lastSuccess', Date.now())
    storeAny.delete('backup.lastError')
    return { success: true }
  } catch (err) {
    logError(`Cloud backup upload failed: ${err}`, LogPrefix.Backend)
    const storeAny = configStore as any
    storeAny.set('backup.lastError', String(err))
    return { success: false, error: String(err) }
  }
}

// Download backup from the connected cloud service
export async function downloadBackupFromCloud(): Promise<{ success: boolean; data?: any; error?: string }> {
  const { provider, tokens } = loadTokens()
  if (!provider || !tokens) {
    return { success: false, error: 'Nenhuma conta de nuvem conectada.' }
  }

  try {
    const accessToken = await getValidAccessToken(provider, tokens)
    const fileName = 'Ghost_Backup.ghostbackup'
    let content = ''

    if (provider === 'google') {
      // 1. Search for the file ID
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}'&spaces=drive`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const searchData = await searchRes.json()
      const existingFile = searchData.files?.[0]

      if (!existingFile) {
        return { success: false, error: 'Arquivo de backup não encontrado no Google Drive.' }
      }

      // 2. Download the file content
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok) throw new Error(`Google Drive download failed: ${await res.text()}`)
      content = await res.text()
    } else if (provider === 'dropbox') {
      const res = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: `/${fileName}` })
        }
      })
      if (!res.ok) throw new Error(`Dropbox download failed: ${await res.text()}`)
      content = await res.text()
    } else if (provider === 'onedrive') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/GhostBackups/${fileName}:/content`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok) throw new Error(`OneDrive download failed: ${await res.text()}`)
      content = await res.text()
    }

    const backupData = JSON.parse(content)
    return { success: true, data: backupData }
  } catch (err) {
    logError(`Cloud backup download failed: ${err}`, LogPrefix.Backend)
    return { success: false, error: String(err) }
  }
}
