import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs'
import { join } from 'path'
import { app, shell, BrowserWindow } from 'electron'
import { startGhostIptvServer, getGhostIptvServerUrl } from './ghostIptvServer'
import type {
  GhostIptvAction,
  GhostIptvUpdateState
} from 'common/types/ghostIptvUpdate'
import { engineVersionGt, normalizeEngineVersion } from './enginePolicy'
import { secureFetch } from './secureDns'

export const GHOST_IPTV_GITHUB_REPO = 'alazter/ghost-iptv'
export const GHOST_IPTV_GITHUB_URL = 'https://github.com/alazter/ghost-iptv'
export const GHOST_IPTV_LOCAL_DEV_PATH =
  'C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\App Tv addon stremio e m3u'

const GHOST_IPTV_RELEASES_API =
  'https://api.github.com/repos/alazter/ghost-iptv/releases?per_page=5'
const GHOST_IPTV_RAW_VERSION_URL =
  'https://raw.githubusercontent.com/alazter/ghost-iptv/main/version.json'

interface StoredGhostIptvState {
  installed: string
  previous?: string
  available?: string
  upstream?: string
  upstreamPublishedAt?: string
  upstreamChangelog?: string
  upstreamUrl?: string
  automatic: boolean
  checkedAt?: number
  message?: string
}

let storageDir: string | undefined
let state: StoredGhostIptvState = {
  installed: '2.4.6',
  available: '2.4.6',
  upstream: '2.4.6',
  automatic: true
}
let isBusy = false
let checkInterval: NodeJS.Timeout | undefined

function getStateFilePath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'ghost_iptv_state.json')
}

function getBackupDirPath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'plugin_installation_backups', 'com.ghost.iptv-backup')
}

function getActivePluginDirs(): string[] {
  const dirs: string[] = []
  try {
    const devPath = join(app.getAppPath(), 'plugins', 'ghost-iptv')
    if (existsSync(devPath)) dirs.push(devPath)
  } catch {}

  try {
    const userPluginPath = join(
      storageDir || app.getPath('userData'),
      'plugins',
      'com.ghost.iptv'
    )
    dirs.push(userPluginPath)
  } catch {}

  return dirs
}

function readInstalledVersionFromManifest(): string {
  for (const dir of getActivePluginDirs()) {
    try {
      const p = join(dir, 'plugin.json')
      if (existsSync(p)) {
        const parsed = JSON.parse(readFileSync(p, 'utf-8'))
        if (parsed.version) return parsed.version
      }
    } catch {}
  }

  // Fallback: tentar ler do version.json do projeto local se existir
  try {
    const localVersionPath = join(GHOST_IPTV_LOCAL_DEV_PATH, 'version.json')
    if (existsSync(localVersionPath)) {
      const parsed = JSON.parse(readFileSync(localVersionPath, 'utf-8'))
      if (parsed.version) return parsed.version
    }
  } catch {}

  return '2.4.6'
}

function persistState(): void {
  try {
    const filePath = getStateFilePath()
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

export function initializeGhostIptvUpdate(userDataPath: string): void {
  storageDir = userDataPath
  const filePath = getStateFilePath()
  if (existsSync(filePath)) {
    try {
      const loaded = JSON.parse(readFileSync(filePath, 'utf-8'))
      state = { ...state, ...loaded }
    } catch {}
  }

  const manifestVersion = readInstalledVersionFromManifest()
  if (manifestVersion) {
    state.installed = manifestVersion
    if (!state.available) state.available = manifestVersion
  }

  // Inicia servidor de streaming HLS e proxy de assets local (127.0.0.1:8888)
  void startGhostIptvServer().catch(() => {})

  // Auto-check on launch (deferred by 6s) and recurring check every 2 hours
  const timer = setTimeout(() => {
    void checkGhostIptvUpdates(Boolean(state.automatic)).catch(() => {})
  }, 6000)
  timer.unref()

  if (!checkInterval) {
    checkInterval = setInterval(() => {
      void checkGhostIptvUpdates(Boolean(state.automatic)).catch(() => {})
    }, 2 * 3600 * 1000)
    checkInterval.unref()
  }
}

export function getPluginWebPath(): string | null {
  for (const dir of getActivePluginDirs()) {
    const htmlPath = join(dir, 'web', 'alazterflix_tv.html')
    if (existsSync(htmlPath)) return htmlPath
  }
  const localHtml = join(GHOST_IPTV_LOCAL_DEV_PATH, 'alazterflix_tv.html')
  if (existsSync(localHtml)) return localHtml
  return null
}

export function ghostIptvState(): GhostIptvUpdateState {
  const installed = state.installed || readInstalledVersionFromManifest()
  const upstream = state.upstream || installed
  const normInstalled = normalizeEngineVersion(installed) || installed
  const normUpstream = normalizeEngineVersion(upstream) || upstream

  const hasNewerUpstream = Boolean(
    upstream &&
      installed &&
      (engineVersionGt(upstream, installed) ||
        (normUpstream !== normInstalled && upstream !== installed))
  )

  const updateAvailable = Boolean(
    hasNewerUpstream ||
      (state.available &&
        state.available !== installed &&
        engineVersionGt(state.available, installed))
  )

  const localDevAvailable = existsSync(GHOST_IPTV_LOCAL_DEV_PATH)
  const webPath = getPluginWebPath()

  return {
    id: 'com.ghost.iptv',
    installed,
    previous: state.previous,
    available: state.available || upstream,
    upstream: state.upstream,
    upstreamPublishedAt: state.upstreamPublishedAt,
    upstreamChangelog: state.upstreamChangelog,
    upstreamUrl: state.upstreamUrl || `${GHOST_IPTV_GITHUB_URL}/releases`,
    updateAvailable,
    upstreamUpdateAvailable: hasNewerUpstream,
    automatic: state.automatic,
    checkedAt: state.checkedAt,
    busy: isBusy,
    message: state.message,
    githubRepo: GHOST_IPTV_GITHUB_REPO,
    githubUrl: GHOST_IPTV_GITHUB_URL,
    apkUrl: `${GHOST_IPTV_GITHUB_URL}/releases/latest/download/ghost-iptv.apk`,
    localDevPath: GHOST_IPTV_LOCAL_DEV_PATH,
    localDevAvailable,
    webUrl: `${getGhostIptvServerUrl()}/alazterflix_tv.html`
  }
}

export async function checkGhostIptvUpdates(
  silent = false
): Promise<GhostIptvUpdateState> {
  if (isBusy) return ghostIptvState()
  isBusy = true
  state.checkedAt = Date.now()
  if (!silent) state.message = 'Consultando GitHub oficial do Ghost IPTV...'

  try {
    let latestTag = ''
    let releaseBody = ''
    let publishedAt = ''
    let releaseUrl = ''

    // 1. Tenta API de Releases do GitHub
    try {
      const response = await secureFetch(GHOST_IPTV_RELEASES_API, {
        headers: {
          'User-Agent': 'GhostLauncher-GhostIptv/1.0',
          Accept: 'application/vnd.github+json'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (response.ok) {
        const releases = (await response.json()) as any[]
        if (Array.isArray(releases) && releases.length > 0) {
          const latest = releases[0]
          latestTag = (latest.tag_name || '').replace(/^v/i, '').trim()
          releaseBody = typeof latest.body === 'string' ? latest.body.slice(0, 1500) : ''
          publishedAt = latest.published_at || latest.created_at || ''
          releaseUrl = latest.html_url || `${GHOST_IPTV_GITHUB_URL}/releases`
        }
      }
    } catch {}

    // 2. Fallback: Ler version.json do repositório remoto via raw.githubusercontent
    if (!latestTag) {
      try {
        const rawRes = await secureFetch(GHOST_IPTV_RAW_VERSION_URL, {
          headers: { 'User-Agent': 'GhostLauncher-GhostIptv/1.0' },
          signal: AbortSignal.timeout(12000)
        })
        if (rawRes.ok) {
          const vJson = (await rawRes.json()) as any
          if (vJson && vJson.version) {
            latestTag = String(vJson.version).replace(/^v/i, '').trim()
            if (Array.isArray(vJson.changelog)) {
              releaseBody = vJson.changelog.map((c: string) => `• ${c}`).join('\n')
            }
            publishedAt = vJson.release_date || ''
            releaseUrl = `${GHOST_IPTV_GITHUB_URL}`
          }
        }
      } catch {}
    }

    // 3. Fallback: Verificar version.json da pasta local de desenvolvimento
    if (!latestTag && existsSync(join(GHOST_IPTV_LOCAL_DEV_PATH, 'version.json'))) {
      try {
        const localVJson = JSON.parse(
          readFileSync(join(GHOST_IPTV_LOCAL_DEV_PATH, 'version.json'), 'utf-8')
        )
        if (localVJson && localVJson.version) {
          latestTag = String(localVJson.version).replace(/^v/i, '').trim()
          if (Array.isArray(localVJson.changelog)) {
            releaseBody = localVJson.changelog.map((c: string) => `• ${c}`).join('\n')
          }
          publishedAt = localVJson.release_date || ''
          releaseUrl = GHOST_IPTV_GITHUB_URL
        }
      } catch {}
    }

    if (latestTag) {
      state.upstream = latestTag
      state.available = latestTag
      state.upstreamPublishedAt = publishedAt
      state.upstreamUrl = releaseUrl
      state.upstreamChangelog = releaseBody

      const currentInstalled = state.installed || readInstalledVersionFromManifest()
      if (
        engineVersionGt(latestTag, currentInstalled) ||
        (normalizeEngineVersion(latestTag) !==
          normalizeEngineVersion(currentInstalled) &&
          latestTag !== currentInstalled)
      ) {
        state.message = `Nova versão ${latestTag} disponível no GitHub oficial do Ghost IPTV.`
        if (state.automatic) {
          try {
            await performGhostIptvInstall(latestTag, currentInstalled)
          } catch (autoErr: any) {
            state.message = `Atualização automática falhou: ${autoErr?.message || 'erro desconhecido'}`
          }
        }
      } else {
        state.message = `Ghost IPTV está atualizado na versão estável ${currentInstalled}.`
      }
    } else {
      state.message = 'Não foi possível consultar os lançamentos no GitHub neste momento.'
    }
  } catch (err: any) {
    state.message = `Consulta ao GitHub oficial falhou: ${err?.message || 'rede'}`
  } finally {
    isBusy = false
    persistState()
  }

  return ghostIptvState()
}

export async function syncGhostIptvFromLocalDev(): Promise<{
  success: boolean
  message: string
  state: GhostIptvUpdateState
}> {
  if (!existsSync(GHOST_IPTV_LOCAL_DEV_PATH)) {
    return {
      success: false,
      message: `Diretório de desenvolvimento não encontrado: ${GHOST_IPTV_LOCAL_DEV_PATH}`,
      state: ghostIptvState()
    }
  }

  try {
    let localVersion = '2.4.6'
    let localChangelog = ''
    const vPath = join(GHOST_IPTV_LOCAL_DEV_PATH, 'version.json')
    if (existsSync(vPath)) {
      try {
        const vData = JSON.parse(readFileSync(vPath, 'utf-8'))
        if (vData.version) localVersion = vData.version
        if (Array.isArray(vData.changelog)) {
          localChangelog = vData.changelog.map((c: string) => `• ${c}`).join('\n')
        }
      } catch {}
    }

    for (const targetDir of getActivePluginDirs()) {
      mkdirSync(targetDir, { recursive: true })

      // Sincroniza pasta web e assets
      const webSrc = join(GHOST_IPTV_LOCAL_DEV_PATH, 'web')
      const webDest = join(targetDir, 'web')
      if (existsSync(webSrc)) {
        mkdirSync(webDest, { recursive: true })
        cpSync(webSrc, webDest, { recursive: true })
      }

      // Sincroniza pasta assets (garante todos os logos de canais e hls.min.js)
      const assetsSrc = join(GHOST_IPTV_LOCAL_DEV_PATH, 'assets')
      const assetsDest = join(webDest, 'assets')
      if (existsSync(assetsSrc)) {
        mkdirSync(assetsDest, { recursive: true })
        cpSync(assetsSrc, assetsDest, { recursive: true })
      }

      // Sincroniza alazterflix_tv.html se presente na raiz
      const htmlSrc = join(GHOST_IPTV_LOCAL_DEV_PATH, 'alazterflix_tv.html')
      if (existsSync(htmlSrc)) {
        cpSync(htmlSrc, join(webDest, 'alazterflix_tv.html'))
      }

      // Sincroniza version.json
      if (existsSync(vPath)) {
        cpSync(vPath, join(targetDir, 'version.json'))
      }

      // Atualiza manifest
      const manifestPath = join(targetDir, 'plugin.json')
      let manifest: any = {}
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        } catch {}
      }
      manifest.id = 'com.ghost.iptv'
      manifest.name = 'Ghost IPTV - Alazterflix Addon'
      manifest.version = localVersion
      manifest.homepage = GHOST_IPTV_GITHUB_URL
      manifest.repository = GHOST_IPTV_GITHUB_REPO
      manifest.type = 'media'
      manifest.entrypoint = manifest.entrypoint || 'index.js'
      manifest.style = manifest.style || 'theme.css'
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    }

    state.installed = localVersion
    state.available = localVersion
    state.upstream = localVersion
    state.upstreamChangelog = localChangelog
    state.message = `Ghost IPTV sincronizado com sucesso do projeto local (v${localVersion}).`
    persistState()

    return {
      success: true,
      message: state.message,
      state: ghostIptvState()
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro na sincronização local: ${err?.message || 'falha desconhecida'}`,
      state: ghostIptvState()
    }
  }
}

export async function performGhostIptvInstall(
  targetVersion: string,
  currentVersion: string
): Promise<void> {
  const backupDir = getBackupDirPath()
  mkdirSync(backupDir, { recursive: true })
  const primaryDir = getActivePluginDirs()[0]
  if (primaryDir && existsSync(primaryDir)) {
    try {
      cpSync(primaryDir, backupDir, { recursive: true })
      state.previous = currentVersion
    } catch {}
  }

  try {
    const requiredDomains = [
      '*.strem.io',
      'v3-cinemeta.strem.io',
      '*.strem.fun',
      '*.elfhosted.com',
      '*.baby-beamup.club',
      'api.github.com',
      'github.com',
      'raw.githubusercontent.com',
      'objects.githubusercontent.com',
      '127.0.0.1',
      'localhost',
      '*.m3u8',
      '*.ts',
      '*.playerembcanais.com',
      'meufutebol.oneplayhd.com'
    ]

    for (const dir of getActivePluginDirs()) {
      mkdirSync(dir, { recursive: true })
      const manifestPath = join(dir, 'plugin.json')
      let manifest: any = {}
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        } catch {}
      }

      manifest.id = 'com.ghost.iptv'
      manifest.name = 'Ghost IPTV - Alazterflix Addon'
      manifest.version = targetVersion
      manifest.homepage = GHOST_IPTV_GITHUB_URL
      manifest.repository = GHOST_IPTV_GITHUB_REPO
      manifest.description =
        'Plugin e Addon oficial Ghost IPTV integrado ao Alazterflix e Stremio. Traz a experiência completa de TV ao Vivo para PC com conversor de Addons Stremio, EPG perpétuo e atualização automática via GitHub oficial (alazter/ghost-iptv).'
      manifest.author = 'Alazter & Ghost Labs'
      manifest.type = 'media'
      manifest.entrypoint = manifest.entrypoint || 'index.js'
      manifest.style = manifest.style || 'theme.css'

      const existingDomains = Array.isArray(manifest.allowedDomains)
        ? manifest.allowedDomains
        : []
      manifest.allowedDomains = Array.from(
        new Set([...existingDomains, ...requiredDomains])
      )

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

      // Preserva arquivos de código
      const indexPath = join(dir, 'index.js')
      if (!existsSync(indexPath) && existsSync(join(backupDir, 'index.js'))) {
        cpSync(join(backupDir, 'index.js'), indexPath)
      }
      const themePath = join(dir, 'theme.css')
      if (!existsSync(themePath) && existsSync(join(backupDir, 'theme.css'))) {
        cpSync(join(backupDir, 'theme.css'), themePath)
      }
    }

    state.installed = targetVersion
    state.available = targetVersion
    state.message = `Ghost IPTV atualizado com sucesso para v${targetVersion} de acordo com o GitHub oficial.`
    persistState()
  } catch (err: any) {
    if (state.previous && existsSync(backupDir)) {
      for (const dir of getActivePluginDirs()) {
        try {
          cpSync(backupDir, dir, { recursive: true })
        } catch {}
      }
      state.installed = state.previous
      state.message = `Falha na atualização para v${targetVersion}. Versão anterior v${state.previous} restaurada.`
      persistState()
    }
    throw err
  }
}

export async function rollbackGhostIptv(): Promise<GhostIptvUpdateState> {
  const backupDir = getBackupDirPath()
  if (!state.previous || !existsSync(backupDir)) {
    state.message = 'Nenhuma versão anterior disponível para restauração.'
    return ghostIptvState()
  }

  const prev = state.previous
  for (const dir of getActivePluginDirs()) {
    try {
      cpSync(backupDir, dir, { recursive: true })
    } catch {}
  }

  state.installed = prev
  state.previous = undefined
  state.message = `Versão anterior v${prev} do Ghost IPTV restaurada com sucesso.`
  persistState()
  return ghostIptvState()
}

export async function ghostIptvAction(
  action: GhostIptvAction
): Promise<GhostIptvUpdateState> {
  switch (action.type) {
    case 'check':
      return await checkGhostIptvUpdates(false)
    case 'update': {
      const target = action.version || state.available || state.upstream
      if (!target) throw new Error('Versão de atualização não especificada.')
      await performGhostIptvInstall(target, state.installed)
      return ghostIptvState()
    }
    case 'rollback':
      return await rollbackGhostIptv()
    case 'set-automatic':
      state.automatic = Boolean(action.automatic)
      persistState()
      return ghostIptvState()
    case 'sync-local': {
      const res = await syncGhostIptvFromLocalDev()
      return res.state
    }
    case 'open-web': {
      const htmlPath = getPluginWebPath()
      if (htmlPath) {
        shell.openPath(htmlPath)
      } else {
        shell.openExternal(GHOST_IPTV_GITHUB_URL)
      }
      return ghostIptvState()
    }
    case 'open-window': {
      const targetUrl = `${getGhostIptvServerUrl()}/alazterflix_tv.html`
      const tvWin = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'Ghost IPTV - TV ao Vivo (PC)',
        backgroundColor: '#06080d',
        autoHideMenuBar: true,
        webPreferences: {
          webSecurity: false,
          allowRunningInsecureContent: true
        }
      })
      tvWin.loadURL(targetUrl)
      return ghostIptvState()
    }
    case 'open-folder': {
      const targetDir = existsSync(GHOST_IPTV_LOCAL_DEV_PATH)
        ? GHOST_IPTV_LOCAL_DEV_PATH
        : getActivePluginDirs()[0] ||
          join(storageDir || app.getPath('userData'), 'plugins', 'com.ghost.iptv')
      shell.openPath(targetDir)
      return ghostIptvState()
    }
    case 'open-github': {
      shell.openExternal(GHOST_IPTV_GITHUB_URL)
      return ghostIptvState()
    }
    default:
      return ghostIptvState()
  }
}
