import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  statSync
} from 'fs'
import { join } from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import { app, shell, BrowserWindow, session } from 'electron'
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
  'C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\Ghost IPTV'
export const GHOST_IPTV_LOCAL_DEV_FALLBACK_PATH =
  'C:\\Users\\alazt\\Documents\\GitHub\\Projetos\\App Tv addon stremio e m3u'

const GHOST_IPTV_RELEASES_API =
  'https://api.github.com/repos/alazter/ghost-iptv/releases?per_page=5'
const GHOST_IPTV_CONTENTS_API_BASE =
  'https://api.github.com/repos/alazter/ghost-iptv/contents'
const GHOST_IPTV_RAW_BASE =
  'https://raw.githubusercontent.com/alazter/ghost-iptv/main'

interface StoredGhostIptvState {
  installed: string
  previous?: string
  available?: string
  upstream?: string
  installedCommit?: string
  upstreamCommit?: string
  upstreamPublishedAt?: string
  upstreamChangelog?: string
  upstreamUrl?: string
  automatic: boolean
  checkedAt?: number
  message?: string
}

let storageDir: string | undefined
let customLocalDevPath: string | null | undefined = undefined
let cachedGitHubToken: string | undefined
let state: StoredGhostIptvState = {
  installed: '2.4.6',
  available: '2.4.6',
  upstream: '2.4.6',
  automatic: true
}
let isBusy = false
let checkInterval: NodeJS.Timeout | undefined

export function setGhostIptvLocalDevPathForTest(pathOrNull?: string | null): void {
  customLocalDevPath = pathOrNull
}

function isIsolatedTestEnv(): boolean {
  if (process.env.NODE_ENV === 'test') {
    const tmp = os.tmpdir().toLowerCase()
    const currentStorage = (storageDir || '').toLowerCase()
    if (currentStorage && currentStorage.startsWith(tmp)) {
      return true
    }
  }
  return false
}

function getEffectiveLocalDevPath(): string {
  if (customLocalDevPath !== undefined) {
    return customLocalDevPath || ''
  }
  if (isIsolatedTestEnv()) {
    return ''
  }
  if (existsSync(GHOST_IPTV_LOCAL_DEV_PATH)) {
    return GHOST_IPTV_LOCAL_DEV_PATH
  }
  return GHOST_IPTV_LOCAL_DEV_FALLBACK_PATH
}

function getStateFilePath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'ghost_iptv_state.json')
}

function getTokenFilePath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'ghost_iptv_github_token.txt')
}

function getBackupDirPath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'plugin_installation_backups', 'com.ghost.iptv-backup')
}

export function resolveGitHubToken(): string {
  const envToken = (
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    ''
  ).trim()
  if (envToken) return envToken

  if (cachedGitHubToken) return cachedGitHubToken

  // 1. Check .env inside local dev directory
  const localDev = getEffectiveLocalDevPath()
  if (localDev && existsSync(join(localDev, '.env'))) {
    try {
      const lines = readFileSync(join(localDev, '.env'), 'utf-8').split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (
          trimmed &&
          !trimmed.startsWith('#') &&
          (trimmed.startsWith('GITHUB_TOKEN=') ||
            trimmed.startsWith('GH_TOKEN='))
        ) {
          const val = trimmed
            .split('=', 2)[1]
            ?.trim()
            .replace(/^["']|["']$/g, '')
          if (val) {
            cachedGitHubToken = val
            return val
          }
        }
      }
    } catch {}
  }

  // 2. Check cached token file in userData
  try {
    const tokFile = getTokenFilePath()
    if (existsSync(tokFile)) {
      const saved = readFileSync(tokFile, 'utf-8').trim()
      if (saved.length > 10) {
        cachedGitHubToken = saved
        return saved
      }
    }
  } catch {}

  // 3. Query GitHub CLI (gh auth token) if available on machine
  if (!isIsolatedTestEnv()) {
    try {
      const ghToken = execFileSync('gh', ['auth', 'token'], {
        encoding: 'utf-8',
        timeout: 4000,
        windowsHide: true
      }).trim()
      if (ghToken && ghToken.length > 10) {
        cachedGitHubToken = ghToken
        try {
          writeFileSync(getTokenFilePath(), ghToken, 'utf-8')
        } catch {}
        return ghToken
      }
    } catch {}
  }

  return ''
}

function buildGitHubHeaders(
  accept = 'application/vnd.github+json'
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'GhostLauncher-GhostIptv/2.4',
    Accept: accept,
    'Cache-Control': 'no-cache'
  }
  const token = resolveGitHubToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function responseToBuffer(res: any): Promise<Buffer | null> {
  if (!res || !res.ok) return null
  if (typeof res.arrayBuffer === 'function') {
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  }
  if (typeof res.text === 'function') {
    const txt = await res.text()
    return Buffer.from(txt, 'utf-8')
  }
  if (typeof res.json === 'function') {
    const data = await res.json()
    if (typeof data === 'string') return Buffer.from(data, 'utf-8')
    if (data && typeof data === 'object') {
      if (data.content && data.encoding === 'base64') {
        return Buffer.from(String(data.content).replace(/\s+/g, ''), 'base64')
      }
      return Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
    }
  }
  return null
}

export async function fetchGitHubRawFile(
  repoPath: string
): Promise<Buffer | null> {
  const cleanPath = repoPath.replace(/^\/+/, '')

  // 1. Authenticated GitHub Contents API (supports both Private & Public repositories)
  try {
    const apiUrl = `${GHOST_IPTV_CONTENTS_API_BASE}/${cleanPath}?ref=main&t=${Date.now()}`
    const res = await secureFetch(apiUrl, {
      headers: buildGitHubHeaders('application/vnd.github.v3.raw'),
      signal: AbortSignal.timeout(20000)
    })
    const buf = await responseToBuffer(res)
    if (buf && buf.length > 0) return buf
  } catch {}

  // 2. Fallback: raw.githubusercontent.com
  try {
    const rawUrl = `${GHOST_IPTV_RAW_BASE}/${cleanPath}?t=${Date.now()}`
    const res = await secureFetch(rawUrl, {
      headers: buildGitHubHeaders('*/*'),
      signal: AbortSignal.timeout(15000)
    })
    const buf = await responseToBuffer(res)
    if (buf && buf.length > 0) return buf
  } catch {}

  // 3. Fallback: git show origin/main:<repoPath> in local repository if available
  const localDev = getEffectiveLocalDevPath()
  if (localDev && existsSync(join(localDev, '.git'))) {
    try {
      const out = execFileSync(
        'git',
        ['show', `origin/main:${cleanPath}`],
        {
          cwd: localDev,
          timeout: 8000,
          maxBuffer: 15 * 1024 * 1024,
          windowsHide: true
        }
      )
      if (out && out.length > 0) return Buffer.from(out)
    } catch {}
  }

  return null
}

export function getActivePluginDirs(): string[] {
  const dirs: string[] = []
  const addUnique = (p: string) => {
    if (p && !dirs.includes(p)) dirs.push(p)
  }

  try {
    const appPath = app.getAppPath()
    if (appPath) {
      const devPath = join(appPath, 'plugins', 'ghost-iptv')
      if (existsSync(devPath) || existsSync(join(appPath, 'plugins'))) {
        addUnique(devPath)
      }
    }
  } catch {}

  if (!isIsolatedTestEnv()) {
    try {
      const cwdPluginPath = join(process.cwd(), 'plugins', 'ghost-iptv')
      if (existsSync(cwdPluginPath)) {
        addUnique(cwdPluginPath)
      }
      const distAppPath = join(
        process.cwd(),
        'dist',
        'win-unpacked',
        'resources',
        'app'
      )
      if (existsSync(distAppPath)) {
        addUnique(join(distAppPath, 'plugins', 'ghost-iptv'))
      }
    } catch {}
  }

  try {
    const userPluginPath = join(
      storageDir || app.getPath('userData'),
      'plugins',
      'com.ghost.iptv'
    )
    addUnique(userPluginPath)
  } catch {}

  return dirs
}

function readActualDirVersion(dir: string): {
  manifestVersion?: string
  webVersion?: string
  effectiveVersion?: string
  hasWebHtml: boolean
  htmlSize: number
  htmlMtimeMs: number
} {
  let manifestVersion: string | undefined
  let webVersion: string | undefined
  let hasWebHtml = false
  let htmlSize = 0
  let htmlMtimeMs = 0

  try {
    const manifestPath = join(dir, 'plugin.json')
    if (existsSync(manifestPath)) {
      const parsed = JSON.parse(
        readFileSync(manifestPath, 'utf-8').replace(/^\uFEFF/, '').trim()
      )
      if (parsed?.version) {
        manifestVersion = String(parsed.version).replace(/^v/i, '').trim()
      }
    }
  } catch {}

  const vPaths = [join(dir, 'web', 'version.json'), join(dir, 'version.json')]
  for (const vp of vPaths) {
    if (existsSync(vp)) {
      try {
        const parsed = JSON.parse(
          readFileSync(vp, 'utf-8').replace(/^\uFEFF/, '').trim()
        )
        if (parsed?.version) {
          const v = String(parsed.version).replace(/^v/i, '').trim()
          if (!webVersion || engineVersionGt(webVersion, v)) {
            webVersion = v
          }
        }
      } catch {}
    }
  }

  const htmlPath = join(dir, 'web', 'alazterflix_tv.html')
  if (existsSync(htmlPath)) {
    try {
      const st = statSync(htmlPath)
      hasWebHtml = st.size > 0
      htmlSize = st.size
      htmlMtimeMs = st.mtimeMs || 0
      const htmlContent = readFileSync(htmlPath, 'utf-8')
      const badgeMatch = htmlContent.match(
        /id=["']headerVersionBadge["'][^>]*>\s*v?([0-9]+\.[0-9]+\.[0-9]+)\s*</i
      )
      if (badgeMatch?.[1]) {
        const badgeVer = badgeMatch[1].trim()
        if (!webVersion || engineVersionGt(webVersion, badgeVer)) {
          webVersion = badgeVer
        }
      }
    } catch {}
  }

  // If webVersion is present and lower than manifestVersion, the directory is only partially updated
  let effectiveVersion = manifestVersion
  if (webVersion) {
    if (!effectiveVersion || engineVersionGt(effectiveVersion, webVersion)) {
      effectiveVersion = webVersion
    }
  }

  return {
    manifestVersion,
    webVersion,
    effectiveVersion,
    hasWebHtml,
    htmlSize,
    htmlMtimeMs
  }
}

export function isInstalledWebOutOfSync(targetVersion?: string): boolean {
  const dirs = getActivePluginDirs().filter((d) => existsSync(d))
  if (dirs.length === 0) return false

  if (
    state.upstreamCommit &&
    state.installedCommit &&
    state.upstreamCommit !== state.installedCommit
  ) {
    return true
  }

  const localDev = getEffectiveLocalDevPath()
  const localDevHtml = localDev
    ? join(localDev, 'web', 'alazterflix_tv.html')
    : ''
  let localDevSize = 0
  let localDevMtimeMs = 0
  let localDevVer = ''
  if (localDev && existsSync(localDevHtml)) {
    try {
      const st = statSync(localDevHtml)
      localDevSize = st.size
      localDevMtimeMs = st.mtimeMs || 0
      const vPath = join(localDev, 'version.json')
      if (existsSync(vPath)) {
        const parsed = JSON.parse(
          readFileSync(vPath, 'utf-8').replace(/^\uFEFF/, '').trim()
        )
        if (parsed?.version) {
          localDevVer = String(parsed.version).replace(/^v/i, '').trim()
        }
      }
    } catch {}
  }

  let anyDirHasWebHtml = false
  for (const dir of dirs) {
    const info = readActualDirVersion(dir)
    if (info.hasWebHtml) anyDirHasWebHtml = true
    if (
      info.manifestVersion &&
      info.webVersion &&
      info.manifestVersion !== info.webVersion
    ) {
      return true
    }
    if (targetVersion && info.webVersion && engineVersionGt(targetVersion, info.webVersion)) {
      return true
    }
    if (
      localDevSize > 0 &&
      info.hasWebHtml &&
      (!targetVersion || !localDevVer || !engineVersionGt(targetVersion, localDevVer))
    ) {
      if (
        info.htmlSize !== localDevSize ||
        localDevMtimeMs > info.htmlMtimeMs + 1500
      ) {
        return true
      }
    }
  }

  if (localDevSize > 0 && !anyDirHasWebHtml) {
    return true
  }

  return false
}

export function readInstalledVersionFromManifest(): string {
  const dirs = getActivePluginDirs().filter((d) => existsSync(d))
  const versions: string[] = []

  for (const dir of dirs) {
    const info = readActualDirVersion(dir)
    if (info.effectiveVersion) {
      versions.push(info.effectiveVersion)
    }
  }

  if (versions.length > 0) {
    // Return the lowest effective version across active directories so any stale directory triggers an update
    versions.sort((a, b) => {
      if (a === b) return 0
      return engineVersionGt(a, b) ? 1 : -1
    })
    return versions[0]
  }

  const localDev = getEffectiveLocalDevPath()
  if (localDev) {
    try {
      const localVersionPath = join(localDev, 'version.json')
      if (existsSync(localVersionPath)) {
        const parsed = JSON.parse(
          readFileSync(localVersionPath, 'utf-8').replace(/^\uFEFF/, '').trim()
        )
        if (parsed.version) return String(parsed.version).replace(/^v/i, '').trim()
      }
    } catch {}
  }

  return '2.4.6'
}

function getInstalledBuildFingerprint(): string {
  for (const dir of getActivePluginDirs()) {
    const htmlPath = join(dir, 'web', 'alazterflix_tv.html')
    if (existsSync(htmlPath)) {
      try {
        const st = statSync(htmlPath)
        return `${st.size}-${Math.floor(st.mtimeMs)}`
      } catch {}
    }
  }
  return state.installed || '2.4.8'
}

function clearElectronHttpCache(): void {
  if (isIsolatedTestEnv()) return
  try {
    void session?.defaultSession?.clearCache?.()
  } catch {}
}

function persistState(): void {
  try {
    const filePath = getStateFilePath()
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

export function initializeGhostIptvUpdate(userDataPath: string): void {
  storageDir = userDataPath
  isBusy = false
  state = {
    installed: '2.4.6',
    available: '2.4.6',
    upstream: '2.4.6',
    automatic: true
  }

  const filePath = getStateFilePath()
  if (existsSync(filePath)) {
    try {
      const loaded = JSON.parse(
        readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '').trim()
      )
      state = { ...state, ...loaded }
    } catch {}
  }

  const manifestVersion = readInstalledVersionFromManifest()
  if (manifestVersion) {
    state.installed = manifestVersion
    if (!state.available) state.available = manifestVersion
  }

  // If local dev has newer or out-of-sync web files and automatic updates are enabled, sync immediately on boot
  const localDev = getEffectiveLocalDevPath()
  if (
    state.automatic &&
    localDev &&
    existsSync(join(localDev, 'web', 'alazterflix_tv.html')) &&
    isInstalledWebOutOfSync()
  ) {
    void syncGhostIptvFromLocalDev().catch(() => {})
  }

  if (!isIsolatedTestEnv()) {
    clearElectronHttpCache()
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
}

export function getPluginWebPath(): string | null {
  for (const dir of getActivePluginDirs()) {
    const htmlPath = join(dir, 'web', 'alazterflix_tv.html')
    if (existsSync(htmlPath)) return htmlPath
  }
  const localDev = getEffectiveLocalDevPath()
  if (localDev) {
    const localWebHtml = join(localDev, 'web', 'alazterflix_tv.html')
    if (existsSync(localWebHtml)) return localWebHtml
    const localHtml = join(localDev, 'alazterflix_tv.html')
    if (existsSync(localHtml)) return localHtml
  }
  return null
}

export function ghostIptvState(): GhostIptvUpdateState {
  const installed = readInstalledVersionFromManifest() || state.installed
  state.installed = installed
  const upstream = state.upstream || installed
  const normInstalled = normalizeEngineVersion(installed) || installed
  const normUpstream = normalizeEngineVersion(upstream) || upstream

  const hasNewerUpstream = Boolean(
    upstream &&
      installed &&
      (engineVersionGt(upstream, installed) ||
        (normUpstream !== normInstalled && upstream !== installed))
  )

  const outOfSync = isInstalledWebOutOfSync(upstream)

  const updateAvailable = Boolean(
    hasNewerUpstream ||
      outOfSync ||
      (state.available &&
        state.available !== installed &&
        engineVersionGt(state.available, installed))
  )

  const localDev = getEffectiveLocalDevPath()
  const localDevAvailable = Boolean(localDev && existsSync(localDev))
  const fingerprint = getInstalledBuildFingerprint()

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
    upstreamUpdateAvailable: hasNewerUpstream || outOfSync,
    automatic: state.automatic,
    checkedAt: state.checkedAt,
    busy: isBusy,
    message: state.message,
    githubRepo: GHOST_IPTV_GITHUB_REPO,
    githubUrl: GHOST_IPTV_GITHUB_URL,
    apkUrl: `${GHOST_IPTV_GITHUB_URL}/releases/latest/download/ghost-iptv.apk`,
    localDevPath: localDev || GHOST_IPTV_LOCAL_DEV_PATH,
    localDevAvailable,
    webUrl: `${getGhostIptvServerUrl()}/alazterflix_tv.html?v=${encodeURIComponent(installed)}&b=${encodeURIComponent(fingerprint)}`
  }
}

interface DiscoveredReleaseCandidate {
  version: string
  changelog: string
  publishedAt: string
  url: string
}

export async function checkGhostIptvUpdates(
  silent = false
): Promise<GhostIptvUpdateState> {
  if (isBusy) return ghostIptvState()
  isBusy = true
  state.checkedAt = Date.now()
  if (!silent) state.message = 'Consultando GitHub oficial do Ghost IPTV...'

  try {
    const candidates: DiscoveredReleaseCandidate[] = []

    // 1. Tenta API de Releases do GitHub (com suporte a token para repositório privado)
    try {
      const response = await secureFetch(GHOST_IPTV_RELEASES_API, {
        headers: buildGitHubHeaders('application/vnd.github+json'),
        signal: AbortSignal.timeout(15000)
      })

      if (response && response.ok) {
        const releases = (await response.json()) as any[]
        if (Array.isArray(releases) && releases.length > 0) {
          const latest = releases[0]
          const tag = String(latest.tag_name || '')
            .replace(/^v/i, '')
            .trim()
          if (tag) {
            candidates.push({
              version: tag,
              changelog:
                typeof latest.body === 'string'
                  ? latest.body.slice(0, 1500)
                  : '',
              publishedAt: latest.published_at || latest.created_at || '',
              url: latest.html_url || `${GHOST_IPTV_GITHUB_URL}/releases`
            })
          }
        }
      }
    } catch {}

    // 2. Consulta version.json e commit HEAD da branch main no GitHub (API autenticada ou raw fallback)
    if (!isIsolatedTestEnv() || candidates.length === 0) {
      try {
        const verBuf = await fetchGitHubRawFile('version.json')
        if (verBuf) {
          const vJson = JSON.parse(
            verBuf.toString('utf-8').replace(/^\uFEFF/, '').trim()
          )
          if (vJson && vJson.version) {
            const ver = String(vJson.version).replace(/^v/i, '').trim()
            const changelog = Array.isArray(vJson.changelog)
              ? vJson.changelog.map((c: string) => `• ${c}`).join('\n')
              : ''
            candidates.push({
              version: ver,
              changelog,
              publishedAt: vJson.release_date || '',
              url: `${GHOST_IPTV_GITHUB_URL}/releases`
            })
          }
        }
      } catch {}

      if (!isIsolatedTestEnv()) {
        try {
          const commitRes = await secureFetch(
            'https://api.github.com/repos/alazter/ghost-iptv/commits/main',
            {
              headers: buildGitHubHeaders('application/vnd.github+json'),
              signal: AbortSignal.timeout(10000)
            }
          )
          if (commitRes && commitRes.ok) {
            const commitData = (await commitRes.json()) as any
            if (commitData?.sha) {
              state.upstreamCommit = String(commitData.sha).slice(0, 12)
            }
          }
        } catch {}
      }
    }

    // 3. Verifica version.json da pasta local de desenvolvimento (se existir)
    const localDev = getEffectiveLocalDevPath()
    if (localDev && existsSync(join(localDev, 'version.json'))) {
      try {
        const localVJson = JSON.parse(
          readFileSync(join(localDev, 'version.json'), 'utf-8')
            .replace(/^\uFEFF/, '')
            .trim()
        )
        if (localVJson && localVJson.version) {
          const ver = String(localVJson.version).replace(/^v/i, '').trim()
          const changelog = Array.isArray(localVJson.changelog)
            ? localVJson.changelog.map((c: string) => `• ${c}`).join('\n')
            : ''
          candidates.push({
            version: ver,
            changelog,
            publishedAt: localVJson.release_date || '',
            url: GHOST_IPTV_GITHUB_URL
          })
        }
      } catch {}
    }

    // Seleciona o candidato com a maior versão
    candidates.sort((a, b) => {
      if (a.version === b.version) {
        return (b.changelog?.length || 0) - (a.changelog?.length || 0)
      }
      return engineVersionGt(a.version, b.version) ? -1 : 1
    })

    const best = candidates[0]
    if (best && best.version) {
      const latestTag = best.version
      state.upstream = latestTag
      state.available = latestTag
      state.upstreamPublishedAt = best.publishedAt
      state.upstreamUrl = best.url
      state.upstreamChangelog = best.changelog

      const currentInstalled = readInstalledVersionFromManifest()
      state.installed = currentInstalled

      const hasNewerVersion =
        engineVersionGt(latestTag, currentInstalled) ||
        (normalizeEngineVersion(latestTag) !==
          normalizeEngineVersion(currentInstalled) &&
          latestTag !== currentInstalled)

      const outOfSync = isInstalledWebOutOfSync(latestTag)

      if (hasNewerVersion || outOfSync) {
        state.message = hasNewerVersion
          ? `Nova versão ${latestTag} disponível no GitHub oficial do Ghost IPTV.`
          : `Sincronizando arquivos da versão ${latestTag} do Ghost IPTV...`

        if (state.automatic || (outOfSync && !hasNewerVersion)) {
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
      state.message =
        'Não foi possível consultar os lançamentos no GitHub neste momento.'
    }
  } catch (err: any) {
    state.message = `Consulta ao GitHub oficial falhou: ${err?.message || 'rede'}`
  } finally {
    isBusy = false
    persistState()
  }

  return ghostIptvState()
}

function writeUpdatedManifest(
  targetDir: string,
  targetVersion: string,
  backupDir?: string
): void {
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

  mkdirSync(targetDir, { recursive: true })
  const manifestPath = join(targetDir, 'plugin.json')
  let manifest: any = {}
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(
        readFileSync(manifestPath, 'utf-8').replace(/^\uFEFF/, '').trim()
      )
    } catch {}
  }

  manifest.id = 'com.ghost.iptv'
  manifest.name = manifest.name || 'Ghost IPTV - Alazterflix Addon'
  manifest.version = targetVersion
  manifest.homepage = GHOST_IPTV_GITHUB_URL
  manifest.repository = GHOST_IPTV_GITHUB_REPO
  manifest.description =
    manifest.description ||
    'Plugin e Addon oficial Ghost IPTV integrado ao Alazterflix e Stremio. Traz a experiência completa de TV ao Vivo para PC com conversor de Addons Stremio, EPG perpétuo e atualização automática via GitHub oficial (alazter/ghost-iptv).'
  manifest.author = manifest.author || 'Alazter & Ghost Labs'
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

  if (backupDir) {
    const indexPath = join(targetDir, 'index.js')
    if (!existsSync(indexPath) && existsSync(join(backupDir, 'index.js'))) {
      cpSync(join(backupDir, 'index.js'), indexPath)
    }
    const themePath = join(targetDir, 'theme.css')
    if (!existsSync(themePath) && existsSync(join(backupDir, 'theme.css'))) {
      cpSync(join(backupDir, 'theme.css'), themePath)
    }
  }
}

function copyLocalDevFilesToPluginDir(
  localDev: string,
  targetDir: string,
  versionOverride?: string
): void {
  mkdirSync(targetDir, { recursive: true })
  const webDest = join(targetDir, 'web')
  mkdirSync(webDest, { recursive: true })

  const webSrc = join(localDev, 'web')
  if (existsSync(webSrc)) {
    cpSync(webSrc, webDest, { recursive: true })
  }

  const assetsSrc = join(localDev, 'assets')
  const assetsDest = join(webDest, 'assets')
  if (existsSync(assetsSrc)) {
    mkdirSync(assetsDest, { recursive: true })
    cpSync(assetsSrc, assetsDest, { recursive: true })
  }

  const rootHtmlSrc = join(localDev, 'alazterflix_tv.html')
  if (
    existsSync(rootHtmlSrc) &&
    !existsSync(join(webSrc, 'alazterflix_tv.html'))
  ) {
    cpSync(rootHtmlSrc, join(webDest, 'alazterflix_tv.html'))
  }

  const epgCacheSrc = join(localDev, 'epg_cache.json')
  if (existsSync(epgCacheSrc)) {
    cpSync(epgCacheSrc, join(targetDir, 'epg_cache.json'))
    cpSync(epgCacheSrc, join(webDest, 'epg_cache.json'))
  }

  const epgXmlSrc = join(localDev, 'epg_br.xml')
  if (existsSync(epgXmlSrc)) {
    cpSync(epgXmlSrc, join(webDest, 'epg.xml'))
  }

  const vPath = join(localDev, 'version.json')
  if (existsSync(vPath)) {
    try {
      const vObj = JSON.parse(
        readFileSync(vPath, 'utf-8').replace(/^\uFEFF/, '').trim()
      )
      if (versionOverride) vObj.version = versionOverride
      const serialized = JSON.stringify(vObj, null, 2)
      writeFileSync(join(targetDir, 'version.json'), serialized, 'utf-8')
      writeFileSync(join(webDest, 'version.json'), serialized, 'utf-8')
    } catch {
      cpSync(vPath, join(targetDir, 'version.json'))
      cpSync(vPath, join(webDest, 'version.json'))
    }
  }
}

export async function syncGhostIptvFromLocalDev(): Promise<{
  success: boolean
  message: string
  state: GhostIptvUpdateState
}> {
  const localDev = getEffectiveLocalDevPath()
  if (!localDev || !existsSync(localDev)) {
    return {
      success: false,
      message: `Diretório de desenvolvimento não encontrado: ${localDev || GHOST_IPTV_LOCAL_DEV_PATH}`,
      state: ghostIptvState()
    }
  }

  try {
    let localVersion = '2.4.8'
    let localChangelog = ''
    const vPath = join(localDev, 'version.json')
    if (existsSync(vPath)) {
      try {
        const vData = JSON.parse(
          readFileSync(vPath, 'utf-8').replace(/^\uFEFF/, '').trim()
        )
        if (vData.version) {
          localVersion = String(vData.version).replace(/^v/i, '').trim()
        }
        if (Array.isArray(vData.changelog)) {
          localChangelog = vData.changelog.map((c: string) => `• ${c}`).join('\n')
        }
      } catch {}
    }

    for (const targetDir of getActivePluginDirs()) {
      copyLocalDevFilesToPluginDir(localDev, targetDir, localVersion)
      writeUpdatedManifest(targetDir, localVersion)
    }

    state.installed = localVersion
    state.available = localVersion
    state.upstream = localVersion
    if (state.upstreamCommit) state.installedCommit = state.upstreamCommit
    if (localChangelog) state.upstreamChangelog = localChangelog
    state.message = `Ghost IPTV sincronizado com sucesso do projeto local (v${localVersion}).`
    persistState()
    clearElectronHttpCache()

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
  const cleanTarget = String(targetVersion).replace(/^v/i, '').trim()
  const cleanCurrent = String(currentVersion).replace(/^v/i, '').trim()

  const backupDir = getBackupDirPath()
  mkdirSync(backupDir, { recursive: true })
  const primaryDir = getActivePluginDirs().find((d) => existsSync(d))
  if (primaryDir) {
    try {
      cpSync(primaryDir, backupDir, { recursive: true })
      if (cleanCurrent && cleanCurrent !== cleanTarget) {
        state.previous = cleanCurrent
      } else if (!state.previous) {
        state.previous = cleanCurrent
      }
    } catch {}
  }

  try {
    // 1. Check if we can pull/sync from local official repo + GitHub remote files
    const localDev = getEffectiveLocalDevPath()
    let syncedFromLocal = false

    if (localDev && existsSync(localDev)) {
      if (existsSync(join(localDev, '.git'))) {
        try {
          execFileSync(
            'git',
            ['pull', '--rebase', '--autostash', 'origin', 'main'],
            {
              cwd: localDev,
              timeout: 15000,
              windowsHide: true
            }
          )
        } catch {}
      }

      let localVer = ''
      const vPath = join(localDev, 'version.json')
      if (existsSync(vPath)) {
        try {
          const parsed = JSON.parse(
            readFileSync(vPath, 'utf-8').replace(/^\uFEFF/, '').trim()
          )
          if (parsed?.version) {
            localVer = String(parsed.version).replace(/^v/i, '').trim()
          }
        } catch {}
      }

      if (
        existsSync(join(localDev, 'web', 'alazterflix_tv.html')) &&
        (!localVer || !engineVersionGt(cleanTarget, localVer))
      ) {
        for (const dir of getActivePluginDirs()) {
          copyLocalDevFilesToPluginDir(localDev, dir, cleanTarget)
        }
        syncedFromLocal = true
      }
    }

    // 2. Fetch remote files from GitHub if not synced from local dev (or to ensure latest remote payload)
    if (!syncedFromLocal && !isIsolatedTestEnv()) {
      const [verBuf, htmlBuf, chBuf, epgBuf, crestIdxBuf] = await Promise.all([
        fetchGitHubRawFile('version.json'),
        fetchGitHubRawFile('web/alazterflix_tv.html'),
        fetchGitHubRawFile('assets/channels_cache.json'),
        fetchGitHubRawFile('epg_cache.json'),
        fetchGitHubRawFile('assets/logos/crests/crest_index.json')
      ])

      if (htmlBuf && htmlBuf.length > 512) {
        let finalHtml = htmlBuf.toString('utf-8')
        if (
          !finalHtml.includes('window.EMBEDDED_CHANNELS') &&
          chBuf &&
          chBuf.length > 2
        ) {
          const chStr = chBuf.toString('utf-8').trim()
          const epgStr = epgBuf && epgBuf.length > 2 ? epgBuf.toString('utf-8').trim() : '{}'
          const injection = `<script id="embeddedEpgData">\nwindow.EMBEDDED_CHANNELS = ${chStr};\nwindow.EMBEDDED_EPG = ${epgStr};\n</script>\n`
          if (finalHtml.includes('<script src="assets/hls.min.js">')) {
            finalHtml = finalHtml.replace(
              '<script src="assets/hls.min.js">',
              `${injection}<script src="assets/hls.min.js">`
            )
          } else {
            finalHtml = finalHtml.replace('<head>', `<head>\n${injection}`)
          }
        }

        const versionPayload =
          verBuf && verBuf.length > 2
            ? verBuf.toString('utf-8')
            : JSON.stringify(
                {
                  app_name: 'Ghost IPTV',
                  version: cleanTarget,
                  build_number:
                    cleanTarget
                      .split('.')
                      .map((n) => parseInt(n, 10) || 0)
                      .reduce((acc, v, idx) => acc + v * [100, 10, 1][idx]!, 0) ||
                    248,
                  repository: GHOST_IPTV_GITHUB_REPO,
                  private_repo: true
                },
                null,
                2
              )

        for (const dir of getActivePluginDirs()) {
          const webDir = join(dir, 'web')
          const assetsDir = join(webDir, 'assets')
          const crestsDir = join(assetsDir, 'logos', 'crests')
          mkdirSync(crestsDir, { recursive: true })

          writeFileSync(join(webDir, 'alazterflix_tv.html'), finalHtml, 'utf-8')
          writeFileSync(join(dir, 'version.json'), versionPayload, 'utf-8')
          writeFileSync(join(webDir, 'version.json'), versionPayload, 'utf-8')

          if (chBuf && chBuf.length > 2) {
            writeFileSync(join(assetsDir, 'channels_cache.json'), chBuf)
          }
          if (epgBuf && epgBuf.length > 2) {
            writeFileSync(join(dir, 'epg_cache.json'), epgBuf)
            writeFileSync(join(webDir, 'epg_cache.json'), epgBuf)
          }
          if (crestIdxBuf && crestIdxBuf.length > 2) {
            writeFileSync(join(crestsDir, 'crest_index.json'), crestIdxBuf)
          }
        }
      }
    }

    // 3. Ensure version.json and plugin.json are updated in all active plugin directories
    for (const dir of getActivePluginDirs()) {
      writeUpdatedManifest(dir, cleanTarget, backupDir)
      const webDir = join(dir, 'web')
      if (existsSync(webDir)) {
        const vFile = join(webDir, 'version.json')
        let vObj: any = {
          app_name: 'Ghost IPTV',
          version: cleanTarget,
          repository: GHOST_IPTV_GITHUB_REPO,
          private_repo: true
        }
        if (existsSync(vFile)) {
          try {
            vObj = {
              ...vObj,
              ...JSON.parse(
                readFileSync(vFile, 'utf-8').replace(/^\uFEFF/, '').trim()
              )
            }
          } catch {}
        }
        vObj.version = cleanTarget
        const serialized = JSON.stringify(vObj, null, 2)
        writeFileSync(vFile, serialized, 'utf-8')
        writeFileSync(join(dir, 'version.json'), serialized, 'utf-8')
      }
    }

    state.installed = cleanTarget
    state.available = cleanTarget
    state.upstream = cleanTarget
    if (state.upstreamCommit) state.installedCommit = state.upstreamCommit
    state.message = `Ghost IPTV atualizado com sucesso para v${cleanTarget} de acordo com o GitHub oficial.`
    persistState()
    clearElectronHttpCache()
  } catch (err: any) {
    if (state.previous && existsSync(backupDir)) {
      for (const dir of getActivePluginDirs()) {
        try {
          cpSync(backupDir, dir, { recursive: true })
        } catch {}
      }
      state.installed = state.previous
      state.message = `Falha na atualização para v${cleanTarget}. Versão anterior v${state.previous} restaurada.`
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
      writeUpdatedManifest(dir, prev)
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
    case 'set-automatic': {
      const enabled = Boolean(action.automatic)
      state.automatic = enabled
      persistState()
      if (enabled) {
        return await checkGhostIptvUpdates(true)
      }
      return ghostIptvState()
    }
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
      const targetUrl = `${getGhostIptvServerUrl()}/alazterflix_tv.html?v=${encodeURIComponent(state.installed)}`
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
      const localDev = getEffectiveLocalDevPath()
      const targetDir =
        localDev && existsSync(localDev)
          ? localDev
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
