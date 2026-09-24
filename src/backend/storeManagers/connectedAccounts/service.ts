import {
  BrowserWindow,
  safeStorage,
  session,
  shell,
  type Session
} from 'electron'
import Store from 'electron-store'
import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'
import { libraryStore } from '../sideload/electronStores'
import { sendFrontendMessage } from 'backend/ipc'
import {
  accountProviders,
  accountProviderNames,
  type AccountProvider,
  type AccountResult,
  type ConnectedAccountStatus,
  type AccountGame
} from 'common/types/connectedAccounts'
import {
  accountAppName,
  eaCatalogUrl,
  parseEaCatalog,
  parseXboxCatalog,
  parseUbisoftCatalog,
  parseBattleNetCatalog,
  uniqueGames
} from './catalogs'
import {
  getApiKey,
  fetchCoverFromSteamGridDB
} from '../sideload/steamgridHelper'
import { logWarning } from 'backend/logger'

const providerSchema = z.enum(accountProviders)
const EA_GRAPHQL = 'https://service-aggregation-layer.juno.ea.com/graphql'
const UBI_APP = 'b8fde481-327d-4031-85ce-7c10a202a700'
const XBOX_REDIRECT = 'https://login.live.com/oauth20_desktop.srf'
const XBOX_SCOPE = 'Xboxlive.signin Xboxlive.offline_access'
const loginUrls: Record<AccountProvider, string> = {
  xbox: 'https://login.live.com/',
  ea: 'https://www.ea.com/login',
  ubisoft: `https://connect.ubisoft.com/login?appId=${UBI_APP}&genomeId=fbd6791c-a6c6-4206-a75e-77234080b87b&lang=pt-BR&nextUrl=https%3A%2F%2Fconnect.ubisoft.com%2Fready`,
  battlenet: 'https://account.battle.net/oauth2/authorization/account-settings'
}

interface Credentials {
  token?: string
  refreshToken?: string
  userId?: string
  sessionId?: string
}
interface Catalog {
  games: AccountGame[]
  username: string
}
interface SavedAccount {
  status: ConnectedAccountStatus
  secret?: string
}
interface AccountStore {
  accounts: Partial<Record<AccountProvider, SavedAccount>>
  xboxClientId: string
}
let storage: Store<AccountStore> | undefined
const running = new Set<AccountProvider>()
const windows = new Map<AccountProvider, BrowserWindow>()
const enriching = new Set<AccountProvider>()

async function enrichCovers(provider: AccountProvider): Promise<void> {
  if (enriching.has(provider)) return
  const key = getApiKey()
  if (!key) return
  enriching.add(provider)
  try {
    const pending = libraryStore
      .get('games', [])
      .filter((game) => game.accountProvider === provider && !game.art_cover)
    for (let offset = 0; offset < pending.length; offset += 3) {
      if (!store().get('accounts')[provider]?.status.connected) break
      const covers = await Promise.all(
        pending.slice(offset, offset + 3).map(async (game) => ({
          appName: game.app_name,
          art: await fetchCoverFromSteamGridDB(key, game.title)
        }))
      )
      const valid = new Map(
        covers
          .filter((entry) => entry.art)
          .map((entry) => [entry.appName, entry.art!])
      )
      if (!valid.size) continue
      // Merge into the latest store so concurrent synchronization/disconnection is never undone.
      libraryStore.set(
        'games',
        libraryStore.get('games', []).map((game) => {
          const art = valid.get(game.app_name)
          return game.accountProvider === provider && !game.art_cover && art
            ? { ...game, ...art }
            : game
        })
      )
      sendFrontendMessage('refreshLibrary', 'sideload')
    }
  } finally {
    enriching.delete(provider)
  }
}

function store() {
  return (storage ??= new Store<AccountStore>({
    name: 'connected-accounts',
    defaults: { accounts: {}, xboxClientId: '' }
  }))
}
function providerSession(provider: AccountProvider): Session {
  return session.fromPartition(`persist:ghost-account-${provider}`)
}
function save(provider: AccountProvider, value: SavedAccount) {
  store().set('accounts', { ...store().get('accounts'), [provider]: value })
}
function readCredentials(provider: AccountProvider): Credentials {
  const secret = store().get('accounts')[provider]?.secret
  if (!secret) return {}
  return JSON.parse(
    safeStorage.decryptString(Buffer.from(secret, 'base64'))
  ) as Credentials
}
function encrypt(credentials: Credentials): string {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === 'linux' &&
      safeStorage.getSelectedStorageBackend() === 'basic_text')
  ) {
    throw new Error('SECURE_STORAGE_UNAVAILABLE')
  }
  return safeStorage
    .encryptString(JSON.stringify(credentials))
    .toString('base64')
}
function errorText(error: unknown): string {
  // Do not return provider responses, request headers, tokens or URLs to the renderer/logs.
  const code = error instanceof Error ? error.message : ''
  if (code === 'XBOX_CLIENT_ID_REQUIRED')
    return 'Configure o ID do aplicativo Microsoft do Ghost para conectar o Xbox.'
  if (code === 'SECURE_STORAGE_UNAVAILABLE')
    return 'O armazenamento seguro do sistema não está disponível.'
  if (code === 'CATALOG_INCOMPLETE')
    return 'A plataforma retornou uma biblioteca incompleta. O catálogo anterior foi preservado.'
  if (code === 'HTTP_401' || code === 'HTTP_403')
    return 'A sessão expirou ou o acesso foi recusado. Conecte a conta novamente.'
  if (code === 'BUSY')
    return 'Já existe uma operação em andamento para esta conta.'
  if (code === 'AUTH_TIMEOUT')
    return 'O login não foi concluído dentro de 10 minutos.'
  return 'Não foi possível sincronizar a conta. Verifique a conexão e tente conectar novamente. O catálogo anterior foi preservado.'
}

async function json(
  ses: Session,
  url: string,
  options: RequestInit = {}
): Promise<unknown> {
  const response = await ses.fetch(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`HTTP_${response.status}`)
  return response.json()
}

async function renewEaSession(): Promise<string> {
  const ses = providerSession('ea')
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      session: ses,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const preventNavigation = (event: Electron.Event, url: string) => {
    if (!allowedNavigation('ea', url)) event.preventDefault()
  }
  win.webContents.on('will-navigate', preventNavigation)
  win.webContents.on('will-redirect', preventNavigation)
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('HTTP_401')), 20000)
      ses.webRequest.onBeforeSendHeaders(
        { urls: [`${EA_GRAPHQL}*`] },
        (details, callback) => {
          const token = Object.entries(details.requestHeaders).find(
            ([key]) => key.toLowerCase() === 'authorization'
          )?.[1]
          callback({ requestHeaders: details.requestHeaders })
          if (token?.startsWith('Bearer ')) resolve(token)
        }
      )
      void win
        .loadURL('https://www.ea.com/sales/deals')
        .catch(() => reject(new Error('HTTP_401')))
    })
  } finally {
    if (timeout) clearTimeout(timeout)
    ses.webRequest.onBeforeSendHeaders(null)
    if (!win.isDestroyed()) win.destroy()
  }
}

export function getAccountStatuses(): ConnectedAccountStatus[] {
  return accountProviders.map(
    (provider) =>
      store().get('accounts')[provider]?.status ?? {
        provider,
        connected: false,
        gameCount: 0
      }
  )
}
export function getXboxClientId(): string {
  return store().get('xboxClientId')
}
export function setXboxClientId(value: string): void {
  if (running.has('xbox')) throw new Error('BUSY')
  const clientId = z.string().trim().uuid().parse(value)
  if (
    getAccountStatuses().some(
      (account) => account.provider === 'xbox' && account.connected
    )
  ) {
    throw new Error('Disconnect Xbox before changing its client ID')
  }
  store().set('xboxClientId', clientId)
}

function allowedNavigation(provider: AccountProvider, value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const domains: Record<AccountProvider, string[]> = {
      xbox: ['live.com', 'microsoft.com', 'microsoftonline.com', 'xbox.com'],
      ea: ['ea.com'],
      ubisoft: ['ubisoft.com', 'ubi.com'],
      battlenet: ['battle.net', 'blizzard.com']
    }
    return domains[provider].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

async function xboxTokens(
  ses: Session,
  data: Record<string, string>
): Promise<Credentials> {
  const body = new URLSearchParams({
    ...data,
    client_id: getXboxClientId(),
    redirect_uri: XBOX_REDIRECT,
    scope: XBOX_SCOPE
  })
  const result = z
    .object({ access_token: z.string(), refresh_token: z.string() })
    .parse(
      await json(ses, 'https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
    )
  return { token: result.access_token, refreshToken: result.refresh_token }
}

async function readCatalog(
  provider: AccountProvider,
  credentials: Credentials
): Promise<Catalog> {
  const ses = providerSession(provider)
  if (provider === 'battlenet') {
    const status = z
      .object({ authenticated: z.literal(true) })
      .parse(await json(ses, 'https://account.battle.net/api/'))
    if (!status.authenticated) throw new Error('HTTP_401')
    const [modern, classic] = await Promise.all([
      json(ses, 'https://account.battle.net/api/games-and-subs'),
      json(ses, 'https://account.battle.net/api/classic-games')
    ])
    return {
      games: parseBattleNetCatalog(modern, classic),
      username: 'Battle.net'
    }
  }
  if (provider === 'ea') {
    if (!credentials.token) throw new Error('HTTP_401')
    let next: string | undefined = '0'
    const seen = new Set<string>()
    const games: AccountGame[] = []
    let username = 'EA'
    while (next !== undefined) {
      if (seen.has(next) || seen.size >= 200)
        throw new Error('CATALOG_INCOMPLETE')
      seen.add(next)
      const page = parseEaCatalog(
        await json(ses, eaCatalogUrl(next), {
          headers: { Authorization: credentials.token }
        })
      )
      username = `EA · ${page.userId}`
      games.push(...page.games)
      next = page.next
    }
    return { games: uniqueGames(games), username }
  }
  if (provider === 'ubisoft') {
    if (!credentials.token || !credentials.userId) throw new Error('HTTP_401')
    if (credentials.refreshToken) {
      const refreshed = z
        .object({
          ticket: z.string(),
          sessionId: z.string(),
          userId: z.string(),
          rememberMeTicket: z.string().optional()
        })
        .parse(
          await json(
            ses,
            'https://public-ubiservices.ubi.com/v3/profiles/sessions',
            {
              method: 'POST',
              headers: {
                Authorization: `rm_v1 t=${credentials.refreshToken}`,
                'Ubi-AppId': UBI_APP,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ rememberMe: true })
            }
          )
        )
      credentials.token = refreshed.ticket
      credentials.sessionId = refreshed.sessionId
      credentials.userId = refreshed.userId
      credentials.refreshToken =
        refreshed.rememberMeTicket || credentials.refreshToken
    }
    const result = await json(
      ses,
      'https://public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql',
      {
        method: 'POST',
        headers: {
          Authorization: `Ubi_v1 t=${credentials.token}`,
          'Ubi-AppId': UBI_APP,
          'Ubi-SessionId': credentials.sessionId || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query:
            'query { viewer { ownedGames: games(filterBy: {isOwned: true}) { totalCount nodes { id name } } } }'
        })
      }
    )
    return {
      games: parseUbisoftCatalog(result),
      username: `Ubisoft · ${credentials.userId}`
    }
  }
  if (credentials.refreshToken)
    Object.assign(
      credentials,
      await xboxTokens(ses, {
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken
      })
    )
  if (!credentials.token) throw new Error('HTTP_401')
  const tokenSchema = z.object({ Token: z.string() })
  const user = tokenSchema.parse(
    await json(ses, 'https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xbl-contract-version': '1'
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${credentials.token}`
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      })
    })
  )
  const xsts = tokenSchema
    .extend({
      DisplayClaims: z.object({
        xui: z
          .array(
            z.object({
              xid: z.string().regex(/^\d+$/),
              uhs: z.string(),
              gtg: z.string().optional()
            })
          )
          .nonempty()
      })
    })
    .parse(
      await json(ses, 'https://xsts.auth.xboxlive.com/xsts/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Properties: { SandboxId: 'RETAIL', UserTokens: [user.Token] },
          RelyingParty: 'http://xboxlive.com',
          TokenType: 'JWT'
        })
      })
    )
  const claim = xsts.DisplayClaims.xui[0]
  const games: AccountGame[] = []
  let next: string | undefined
  const seen = new Set<string>()
  do {
    if ((next && seen.has(next)) || seen.size >= 200)
      throw new Error('CATALOG_INCOMPLETE')
    if (next) seen.add(next)
    const url = new URL(
      `https://titlehub.xboxlive.com/users/xuid(${claim.xid})/titles/titlehistory/decoration/detail`
    )
    if (next) url.searchParams.set('continuationToken', next)
    const page = parseXboxCatalog(
      await json(ses, url.toString(), {
        headers: {
          Authorization: `XBL3.0 x=${claim.uhs};${xsts.Token}`,
          'x-xbl-contract-version': '2'
        }
      })
    )
    games.push(...page.games)
    next = page.next
  } while (next)
  return {
    games: uniqueGames(games),
    username: claim.gtg || `Xbox · ${claim.xid}`
  }
}

function commitCatalog(
  provider: AccountProvider,
  catalog: Catalog,
  credentials: Credentials
): ConnectedAccountStatus {
  const secret = provider === 'battlenet' ? undefined : encrypt(credentials)
  const current = libraryStore.get('games', [])
  const previous = new Map(
    current
      .filter((game) => game.accountProvider === provider)
      .map((game) => [game.app_name, game])
  )
  const imported = uniqueGames(catalog.games).map((game) => {
    const appName = accountAppName(provider, game.id)
    const old = previous.get(appName)
    return {
      runner: 'sideload' as const,
      accountProvider: provider,
      accountGameId: game.id,
      app_name: appName,
      title: game.title,
      art_cover: game.cover || old?.art_cover || '',
      art_square: game.cover || old?.art_square || '',
      store_url: game.storeUrl,
      description:
        provider === 'xbox'
          ? `Histórico Xbox: este registro não comprova uma licença ativa. Jogos de console podem não estar disponíveis no PC.\n${game.description || ''}`
          : game.description,
      install: {},
      is_installed: false,
      installable: false,
      canRunOffline: false
    }
  })
  const status: ConnectedAccountStatus = {
    provider,
    connected: true,
    username: catalog.username,
    lastSync: Date.now(),
    gameCount: imported.length
  }
  libraryStore.set('games', [
    ...current.filter((game) => game.accountProvider !== provider),
    ...imported
  ])
  save(provider, { status, secret })
  sendFrontendMessage('refreshLibrary', 'sideload')
  void enrichCovers(provider).catch(() =>
    logWarning('Não foi possível buscar capas para a biblioteca conectada.')
  )
  return status
}

export async function syncAccount(
  value: AccountProvider
): Promise<AccountResult> {
  const provider = providerSchema.parse(value)
  if (running.has(provider))
    return { success: false, error: errorText(new Error('BUSY')) }
  running.add(provider)
  let credentials: Credentials | undefined
  try {
    if (!store().get('accounts')[provider]?.status.connected)
      throw new Error('HTTP_401')
    credentials = readCredentials(provider)
    let catalog: Catalog
    try {
      catalog = await readCatalog(provider, credentials)
    } catch (error) {
      if (provider !== 'ea') throw error
      credentials.token = await renewEaSession()
      catalog = await readCatalog(provider, credentials)
    }
    return {
      success: true,
      status: commitCatalog(provider, catalog, credentials)
    }
  } catch (error) {
    const saved = store().get('accounts')[provider]
    if (saved) {
      // Persist rotated refresh tokens even if fetching the catalog failed afterwards.
      let secret = saved.secret
      if (credentials && provider !== 'battlenet') {
        try {
          secret = encrypt(credentials)
        } catch {
          logWarning(
            'Não foi possível atualizar a sessão no armazenamento seguro.'
          )
        }
      }
      save(provider, {
        secret,
        status: { ...saved.status, error: errorText(error) }
      })
    }
    return { success: false, error: errorText(error) }
  } finally {
    running.delete(provider)
  }
}

export async function connectAccount(
  value: AccountProvider
): Promise<AccountResult> {
  const provider = providerSchema.parse(value)
  if (running.has(provider)) {
    windows.get(provider)?.focus()
    return { success: false, error: errorText(new Error('BUSY')) }
  }
  running.add(provider)
  let authWindow: BrowserWindow | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  const ses = providerSession(provider)
  const preventDownload = (event: Electron.Event) => event.preventDefault()
  try {
    if (provider === 'xbox' && !getXboxClientId())
      throw new Error('XBOX_CLIENT_ID_REQUIRED')
    if (provider !== 'battlenet') encrypt({})
    await ses.clearStorageData()
    ses.on('will-download', preventDownload)
    ses.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    ses.setPermissionCheckHandler(() => false)
    authWindow = new BrowserWindow({
      width: 1000,
      height: 740,
      autoHideMenuBar: true,
      title: `Conectar ${accountProviderNames[provider]} — Ghost`,
      webPreferences: {
        session: ses,
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    const win = authWindow
    windows.set(provider, win)
    let credentials: Credentials = {}
    let authCode: string | undefined
    let busy = false
    let settled = false
    const state = randomBytes(24).toString('hex')
    const verifier = randomBytes(32).toString('base64url')
    let startUrl = loginUrls[provider]
    if (provider === 'xbox') {
      startUrl = `https://login.live.com/oauth20_authorize.srf?${new URLSearchParams(
        {
          client_id: getXboxClientId(),
          redirect_uri: XBOX_REDIRECT,
          scope: XBOX_SCOPE,
          response_type: 'code',
          state,
          code_challenge_method: 'S256',
          code_challenge: createHash('sha256')
            .update(verifier)
            .digest('base64url'),
          prompt: 'select_account'
        }
      )}`
    }
    if (provider === 'ea') {
      ses.webRequest.onBeforeSendHeaders(
        { urls: [`${EA_GRAPHQL}*`] },
        (details, callback) => {
          const entry = Object.entries(details.requestHeaders).find(
            ([key]) => key.toLowerCase() === 'authorization'
          )
          if (entry?.[1]?.startsWith('Bearer ')) credentials.token = entry[1]
          callback({ requestHeaders: details.requestHeaders })
        }
      )
    }
    return await new Promise<AccountResult>((resolve) => {
      const finish = (result: AccountResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      const navigate = (event: Electron.Event, target: string) => {
        if (!allowedNavigation(provider, target)) {
          event.preventDefault()
          return
        }
        const url = new URL(target)
        if (
          provider === 'xbox' &&
          `${url.origin}${url.pathname}` === XBOX_REDIRECT
        ) {
          event.preventDefault()
          if (url.searchParams.get('state') !== state) return
          if (url.searchParams.has('error'))
            finish({
              success: false,
              cancelled: true,
              error: 'Login cancelado.'
            })
          authCode = url.searchParams.get('code') || undefined
        }
      }
      win.webContents.on('will-navigate', navigate)
      win.webContents.on('will-redirect', navigate)
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (allowedNavigation(provider, url))
          void win.loadURL(url).catch(() => undefined)
        return { action: 'deny' }
      })
      win.on('closed', () =>
        finish({ success: false, cancelled: true, error: 'Login cancelado.' })
      )
      const probe = async () => {
        if (busy || settled || win.isDestroyed()) return
        busy = true
        try {
          const currentUrl = new URL(win.webContents.getURL() || startUrl)
          if (provider === 'xbox') {
            if (!authCode) return
            credentials = await xboxTokens(ses, {
              grant_type: 'authorization_code',
              code: authCode,
              code_verifier: verifier
            })
            authCode = undefined
          } else if (provider === 'ubisoft') {
            if (currentUrl.origin !== 'https://connect.ubisoft.com') return
            const local: unknown = await win.webContents
              .executeJavaScript(`(() => {
              const values = ['PRODloginData', 'PRODrememberMe', 'PRODlastProfile'].map(key => {
                try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
              }); return Object.assign({}, ...values);
            })()`)
            const parsed = z
              .object({
                ticket: z.string(),
                userId: z.string(),
                sessionId: z.string(),
                rememberMeTicket: z.string().optional()
              })
              .safeParse(local)
            if (!parsed.success) return
            credentials = {
              token: parsed.data.ticket,
              userId: parsed.data.userId,
              sessionId: parsed.data.sessionId,
              refreshToken: parsed.data.rememberMeTicket
            }
          } else if (provider === 'ea') {
            if (
              currentUrl.origin !== 'https://www.ea.com' ||
              currentUrl.pathname.includes('/login')
            )
              return
            if (!credentials.token) {
              if (
                currentUrl.origin === 'https://www.ea.com' &&
                /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/.test(currentUrl.pathname)
              ) {
                await win.loadURL('https://www.ea.com/sales/deals')
              }
              return
            }
          } else if (
            currentUrl.origin !== 'https://account.battle.net' ||
            !/^\/(overview|games)?\/?$/.test(currentUrl.pathname)
          )
            return
          const catalog = await readCatalog(provider, credentials)
          if (settled) return
          finish({
            success: true,
            status: commitCatalog(provider, catalog, credentials)
          })
        } catch (error) {
          // Only start API probes after authentication evidence. Errors remain visible;
          // closing this window must never be interpreted as successful authentication.
          finish({ success: false, error: errorText(error) })
        } finally {
          busy = false
        }
      }
      timer = setInterval(() => {
        void probe()
      }, 2500)
      timeout = setTimeout(
        () =>
          finish({
            success: false,
            error: errorText(new Error('AUTH_TIMEOUT'))
          }),
        600000
      )
      void win
        .loadURL(startUrl)
        .catch(() =>
          finish({
            success: false,
            error: 'Não foi possível abrir a página de login.'
          })
        )
    })
  } catch (error) {
    return { success: false, error: errorText(error) }
  } finally {
    if (timer) clearInterval(timer)
    if (timeout) clearTimeout(timeout)
    if (provider === 'ea') ses.webRequest.onBeforeSendHeaders(null)
    ses.removeListener('will-download', preventDownload)
    if (authWindow && !authWindow.isDestroyed()) authWindow.destroy()
    windows.delete(provider)
    running.delete(provider)
  }
}

export async function disconnectAccount(
  value: AccountProvider
): Promise<AccountResult> {
  const provider = providerSchema.parse(value)
  if (running.has(provider))
    return { success: false, error: errorText(new Error('BUSY')) }
  running.add(provider)
  try {
    await providerSession(provider).clearStorageData()
    await providerSession(provider).closeAllConnections()
    const status = { provider, connected: false, gameCount: 0 }
    save(provider, { status })
    libraryStore.set(
      'games',
      libraryStore
        .get('games', [])
        .filter((game) => game.accountProvider !== provider)
    )
    sendFrontendMessage('refreshLibrary', 'sideload')
    return { success: true, status }
  } catch (error) {
    return { success: false, error: errorText(error) }
  } finally {
    running.delete(provider)
  }
}

export async function openAccountGame(appName: string): Promise<void> {
  const game = libraryStore
    .get('games', [])
    .find((entry) => entry.app_name === appName && entry.accountProvider)
  if (!game?.accountProvider || !game.store_url)
    throw new Error('Unknown account game')
  if (!allowedNavigation(game.accountProvider, game.store_url))
    throw new Error('Invalid store URL')
  await shell.openExternal(game.store_url)
}
