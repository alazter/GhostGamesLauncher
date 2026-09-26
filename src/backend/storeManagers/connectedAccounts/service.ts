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
import { logInfo, logWarning } from 'backend/logger'

const providerSchema = z.enum(accountProviders)
const EA_REQUESTS = 'https://service-aggregation-layer.juno.ea.com/*'
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
    defaults: { accounts: {}, xboxClientId: '' },
    clearInvalidConfig: true,
    deserialize: (text: string) => {
      try {
        return JSON.parse(text.replace(/^\uFEFF/, '').trim())
      } catch {
        return { accounts: {}, xboxClientId: '' }
      }
    }
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
  if (/^AUTH_PAGE_ERR_[A-Z_]+$/.test(code))
    return `O navegador não conseguiu abrir a página da plataforma (${code.replace('AUTH_PAGE_', '')}).`
  if (code === 'AUTH_PAGE_FAILED')
    return 'O navegador não conseguiu concluir o carregamento da página da plataforma.'
  if (code === 'EA_IDENTITY_UNAVAILABLE')
    return 'A EA recusou a consulta que confirma a conta. O Ghost ainda não conseguiu validar esta sessão.'
  if (code === 'XBOX_CLIENT_ID_REQUIRED')
    return 'Configure o ID do aplicativo Microsoft do Ghost para conectar o Xbox.'
  if (code === 'SECURE_STORAGE_UNAVAILABLE')
    return 'O armazenamento seguro do sistema não está disponível.'
  if (error instanceof z.ZodError)
    return 'A plataforma retornou os jogos em um formato não reconhecido pelo Ghost. A biblioteca anterior foi preservada.'
  if (code === 'CATALOG_INCOMPLETE')
    return 'A plataforma retornou uma biblioteca incompleta. O catálogo anterior foi preservado.'
  if (code === 'HTTP_400')
    return 'A plataforma recusou a consulta da biblioteca (HTTP 400). A integração precisa ser revisada.'
  if (/^HTTP_5\d\d$/.test(code))
    return 'O serviço da plataforma falhou ao consultar os jogos. Tente sincronizar novamente mais tarde.'
  if (code === 'HTTP_401')
    return 'A plataforma não aceitou a autenticação desta sessão. Conecte a conta novamente.'
  if (code === 'HTTP_403')
    return 'A plataforma recusou o acesso à consulta. Isso não confirma que a sessão expirou; os jogos já importados foram preservados.'
  if (code === 'BUSY')
    return 'Já existe uma operação em andamento para esta conta.'
  if (code === 'PROVIDER_BROWSER_BLOCKED')
    return 'A Ubisoft restringiu o acesso ao navegador de login. Tente novamente mais tarde ou verifique o acesso pelo site oficial da Ubisoft. A conta não foi conectada.'
  if (code === 'AUTH_TIMEOUT')
    return 'O login não foi concluído dentro de 10 minutos.'
  return 'Não foi possível sincronizar a conta. Verifique a conexão e tente conectar novamente. O catálogo anterior foi preservado.'
}

async function json(
  ses: Session,
  url: string,
  options: RequestInit = {}
): Promise<unknown> {
  options.signal?.throwIfAborted()
  const response = await ses.fetch(url, {
    ...options,
    redirect: 'error',
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`HTTP_${response.status}`)
  return response.json()
}

function navigationErrorCode(error: unknown): string | undefined {
  // Electron errors can originate in another V8 context, so instanceof Error is unreliable.
  const parsed = z
    .object({
      code: z.unknown().optional(),
      errno: z.unknown().optional(),
      message: z.unknown().optional()
    })
    .safeParse(error)
  if (!parsed.success) return undefined
  if (parsed.data.errno === -3) return 'ERR_ABORTED'
  for (const value of [parsed.data.code, parsed.data.message]) {
    if (typeof value !== 'string') continue
    const code = value.match(/\bERR_[A-Z_]+\b/)?.[0]
    if (code) return code
  }
  return undefined
}

async function loadAuthPage(win: BrowserWindow, url: string): Promise<void> {
  try {
    await win.loadURL(url)
  } catch (error) {
    const code = navigationErrorCode(error)
    // A redirect/new navigation cancels loadURL; it is not an authentication failure.
    if (code !== 'ERR_ABORTED')
      throw new Error(code ? `AUTH_PAGE_${code}` : 'AUTH_PAGE_FAILED')
  }
}

async function verifyEaIdentity(
  ses: Session,
  token: string,
  signal: AbortSignal
): Promise<string> {
  let response: unknown
  try {
    // Use the provider's supported persisted operation instead of a custom query.
    response = await json(ses, eaCatalogUrl(), {
      signal,
      headers: { Authorization: token }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'HTTP_401')
      throw new Error('AUTH_PENDING')
    throw error
  }
  const graphQlErrors = z
    .object({
      errors: z
        .array(
          z.object({
            extensions: z.object({ code: z.string().optional() }).optional()
          })
        )
        .optional()
    })
    .parse(response).errors
  if (graphQlErrors?.length) {
    if (
      graphQlErrors.every((entry) =>
        ['UNAUTHENTICATED', 'UNAUTHORIZED'].includes(
          entry.extensions?.code || ''
        )
      )
    )
      throw new Error('AUTH_PENDING')
    throw new Error('EA_IDENTITY_UNAVAILABLE')
  }
  const parsed = z
    .object({
      data: z
        .object({
          me: z
            .object({
              id: z.union([z.string().min(1), z.number()]).transform(String)
            })
            .nullable()
        })
        .optional()
    })
    .parse(response)
  if (!parsed.data?.me) throw new Error('AUTH_PENDING')
  return parsed.data.me.id
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
        { urls: [EA_REQUESTS] },
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
const profileChecks = new Map<AccountProvider, number>()

function savedDisplayName(provider: AccountProvider): string {
  const name = store().get('accounts')[provider]?.status.username
  return name && !/^EA · \d+$/.test(name)
    ? name
    : accountProviderNames[provider]
}

export async function getAccountStatusesWithProfiles(): Promise<
  ConnectedAccountStatus[]
> {
  await Promise.all(
    (['ea', 'battlenet'] as const).map(async (provider) => {
      const saved = store().get('accounts')[provider]
      if (!saved?.status.connected) return
      if (savedDisplayName(provider) !== accountProviderNames[provider]) return
      if (Date.now() - (profileChecks.get(provider) ?? 0) < 60000) return
      profileChecks.set(provider, Date.now())
      try {
        const data = await json(
          providerSession(provider),
          provider === 'ea'
            ? 'https://www.ea.com/user-data'
            : 'https://account.battle.net/api/user',
          { signal: AbortSignal.timeout(5000) }
        )
        const name =
          provider === 'ea'
            ? z
                .object({
                  authenticated: z.literal(true),
                  originName: z.string().trim().min(1)
                })
                .parse(data).originName
            : z
                .object({
                  battleTag: z.object({ name: z.string().trim().min(1) })
                })
                .parse(data).battleTag.name
        const current = store().get('accounts')[provider]
        // A delayed profile response must not restore a disconnected/replaced account.
        if (
          !current?.status.connected ||
          current.secret !== saved.secret ||
          current.status.lastSync !== saved.status.lastSync
        )
          return
        save(provider, {
          ...current,
          status: { ...current.status, username: name }
        })
      } catch {
        // Display-name lookup must never invalidate an authenticated account or its games.
      }
    })
  )
  return getAccountStatuses()
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
  data: Record<string, string>,
  signal?: AbortSignal
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
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
    )
  return { token: result.access_token, refreshToken: result.refresh_token }
}

async function readCatalog(
  provider: AccountProvider,
  credentials: Credentials,
  signal?: AbortSignal
): Promise<Catalog> {
  const ses = providerSession(provider)
  const request = (
    requestSession: Session,
    url: string,
    options: RequestInit = {}
  ) => json(requestSession, url, { ...options, signal })
  if (provider === 'battlenet') {
    let status: unknown
    try {
      status = await request(ses, 'https://account.battle.net/api/', {
        method: 'POST'
      })
    } catch (error) {
      if (signal && error instanceof Error && error.message === 'HTTP_401')
        throw new Error('AUTH_PENDING')
      throw error
    }
    const authenticated = z.object({ authenticated: z.boolean() }).parse(status)
    if (!authenticated.authenticated)
      throw new Error(signal ? 'AUTH_PENDING' : 'HTTP_401')
    const [modern, classic] = await Promise.all([
      request(ses, 'https://account.battle.net/api/games-and-subs'),
      request(ses, 'https://account.battle.net/api/classic-games')
    ])
    return {
      games: parseBattleNetCatalog(modern, classic),
      username: savedDisplayName('battlenet')
    }
  }
  if (provider === 'ea') {
    if (!credentials.token) throw new Error('HTTP_401')
    let next: string | undefined = '0'
    const seen = new Set<string>()
    const games: AccountGame[] = []
    const username = savedDisplayName('ea')
    let totalCount: number | undefined
    let userId: string | undefined
    while (next !== undefined) {
      if (seen.has(next) || seen.size >= 200)
        throw new Error('CATALOG_INCOMPLETE')
      seen.add(next)
      const page = parseEaCatalog(
        await request(ses, eaCatalogUrl(next), {
          headers: { Authorization: credentials.token }
        })
      )
      if (credentials.userId && page.userId !== credentials.userId)
        throw new Error('HTTP_401')
      if (userId !== undefined && page.userId !== userId)
        throw new Error('CATALOG_INCOMPLETE')
      totalCount = page.totalCount
      userId = page.userId

      games.push(...page.games)
      next = page.next
    }
    // The provider's next cursor determines completion. Its advertised total can
    // differ from the records exposed by this filtered catalog operation.
    if (totalCount !== undefined && games.length !== totalCount) {
      logWarning(
        `[ConnectedAccounts] ea: pagination-completed; pages=${seen.size}; records=${games.length}; reportedTotal=${totalCount}`
      )
      // Do not clear an existing library on a contradictory empty response.
      if (!games.length && totalCount > 0) throw new Error('CATALOG_INCOMPLETE')
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
          await request(
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
    const result = await request(
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
      await xboxTokens(
        ses,
        {
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken
        },
        signal
      )
    )
  if (!credentials.token) throw new Error('HTTP_401')
  const tokenSchema = z.object({ Token: z.string() })
  const user = tokenSchema.parse(
    await request(ses, 'https://user.auth.xboxlive.com/user/authenticate', {
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
      await request(ses, 'https://xsts.auth.xboxlive.com/xsts/authorize', {
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
      await request(ses, url.toString(), {
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
  const authPopups = new Set<BrowserWindow>()
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
    let phase = 'opening-login'
    logInfo(`[ConnectedAccounts] ${provider}: login-started`)
    let eaStoreOpened = false
    let verifiedEaUser: string | undefined
    const controller = new AbortController()
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
        { urls: [EA_REQUESTS] },
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
        controller.abort()
        if (!result.success && !result.cancelled) {
          const previous = store().get('accounts')[provider]
          try {
            save(provider, {
              ...previous,
              status: {
                ...(previous?.status ?? {
                  provider,
                  connected: false,
                  gameCount: 0
                }),
                error: previous?.status.error?.startsWith('Login confirmado')
                  ? previous.status.error
                  : result.error
              }
            })
          } catch {
            /* Do not prevent completion if storage is unavailable. */
          }
          logWarning(
            `[ConnectedAccounts] ${provider}: ${phase}; ${result.error}`
          )
        }
        logInfo(
          `[ConnectedAccounts] ${provider}: ${result.success ? 'completed' : result.cancelled ? 'window-closed-or-cancelled' : 'failed'}; phase=${phase}; tokenObserved=${Boolean(credentials.token)}`
        )
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
      const configurePopups = (parent: BrowserWindow) => {
        parent.webContents.setWindowOpenHandler(({ url }) => {
          if (!allowedNavigation(provider, url)) return { action: 'deny' }
          // OAuth popups need their opener to complete postMessage-based sign-in.
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              autoHideMenuBar: true,
              webPreferences: {
                session: ses,
                sandbox: true,
                nodeIntegration: false,
                contextIsolation: true
              }
            }
          }
        })
        parent.webContents.on('did-create-window', (popup) => {
          authPopups.add(popup)
          popup.webContents.on('will-navigate', navigate)
          popup.webContents.on('will-redirect', navigate)
          configurePopups(popup)
          popup.on('closed', () => authPopups.delete(popup))
        })
      }
      configurePopups(win)
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
            credentials = await xboxTokens(
              ses,
              {
                grant_type: 'authorization_code',
                code: authCode,
                code_verifier: verifier
              },
              controller.signal
            )
            authCode = undefined
          } else if (provider === 'ubisoft') {
            if (!allowedNavigation(provider, currentUrl.href)) return
            phase = 'checking-ubisoft-page'
            const blocked = await Promise.all(
              win.webContents.mainFrame.framesInSubtree.map(async (frame) => {
                try {
                  return (
                    (await frame.executeJavaScript(`(() => {
                  const text = document.body?.innerText || '';
                  return /O acesso está temporariamente restrito|Access (?:is )?temporarily restricted|Access denied/i.test(text);
                })()`)) === true
                  )
                } catch {
                  return false
                }
              })
            )
            if (blocked.some(Boolean))
              throw new Error('PROVIDER_BROWSER_BLOCKED')
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
            // An authenticated service request is stronger evidence than the page URL.
            if (!credentials.token) {
              if (
                currentUrl.origin === 'https://www.ea.com' &&
                !/\/(?:login|login_check|logout)(?:\/|$)/i.test(
                  currentUrl.pathname
                ) &&
                !eaStoreOpened
              ) {
                eaStoreOpened = true
                phase = 'opening-ea-catalog'
                try {
                  await loadAuthPage(win, 'https://www.ea.com/sales/deals')
                } catch (error) {
                  // The page may fail after emitting the authenticated Juno request.
                  // The token must still be verified by the API before importing.
                  if (!credentials.token) throw error
                }
              }
              return
            }
          } else {
            // Account pages can include locale prefixes and new dashboard routes.
            // The account API below still verifies authentication before importing.
            if (
              currentUrl.origin !== 'https://account.battle.net' ||
              /\/logout(?:\/|$)/i.test(currentUrl.pathname)
            )
              return
          }
          if (settled) return
          if (provider === 'ea') {
            phase = 'verifying-ea-session'
            verifiedEaUser = await verifyEaIdentity(
              ses,
              credentials.token!,
              controller.signal
            )
            credentials.userId = verifiedEaUser
          }
          if (settled) return
          phase = 'importing-library'
          const catalog = await readCatalog(
            provider,
            credentials,
            controller.signal
          )
          if (settled) return
          finish({
            success: true,
            status: commitCatalog(provider, catalog, credentials)
          })
        } catch (error) {
          if (error instanceof Error && error.message === 'AUTH_PENDING') return
          // Only import after authentication verification. Errors remain visible;
          // closing this window must never be interpreted as successful authentication.
          if (settled) return
          const message = errorText(error)
          if (provider === 'ea' && verifiedEaUser) {
            const previous = store().get('accounts').ea?.status
            save('ea', {
              secret: encrypt(credentials),
              status: {
                provider: 'ea',
                connected: true,
                username: savedDisplayName('ea'),
                gameCount: libraryStore
                  .get('games', [])
                  .filter((game) => game.accountProvider === 'ea').length,
                lastSync: previous?.lastSync,
                error: `Login confirmado, mas a importação falhou. ${message} Use Sincronizar para tentar novamente.`
              }
            })
          }
          finish({ success: false, error: message })
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
      void loadAuthPage(win, startUrl).catch(() =>
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
    for (const popup of authPopups) {
      if (!popup.isDestroyed()) popup.destroy()
    }
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
