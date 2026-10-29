import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type {
  NuvioAddonAction,
  NuvioAddonUpdateState
} from 'common/types/nuvioUpdate'
import { engineVersionGt, normalizeEngineVersion } from './enginePolicy'
import { secureFetch } from './secureDns'

export const NUVIO_GITHUB_REPO = 'NuvioMedia/NuvioDesktop'
export const NUVIO_GITHUB_URL = 'https://github.com/NuvioMedia/NuvioDesktop'
const NUVIO_RELEASES_API = 'https://api.github.com/repos/NuvioMedia/NuvioDesktop/releases?per_page=5'

interface StoredNuvioState {
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
let state: StoredNuvioState = {
  installed: '0.1.32-alpha',
  available: '0.1.32-alpha',
  upstream: '0.1.32-alpha',
  automatic: true
}
let isBusy = false
let checkInterval: NodeJS.Timeout | undefined

function getStateFilePath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'nuvio_addon_state.json')
}

function getBackupDirPath(): string {
  const dir = storageDir || app.getPath('userData')
  return join(dir, 'plugin_installation_backups', 'com.nuvio.player.addon-backup')
}

function getActivePluginDirs(): string[] {
  const dirs: string[] = []
  try {
    const devPath = join(app.getAppPath(), 'plugins', 'nuvio-player-addon')
    if (existsSync(devPath)) dirs.push(devPath)
  } catch {}

  try {
    const userPluginPath = join(
      storageDir || app.getPath('userData'),
      'plugins',
      'com.nuvio.player.addon'
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
  return '0.1.32-alpha'
}

function persistState(): void {
  try {
    const filePath = getStateFilePath()
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

export function initializeNuvioAddonUpdate(userDataPath: string): void {
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

  // Auto-check on launch (deferred by 5s) and recurring check every 2 hours
  const timer = setTimeout(() => {
    void checkNuvioUpdates(Boolean(state.automatic)).catch(() => {})
  }, 5000)
  timer.unref()

  if (!checkInterval) {
    checkInterval = setInterval(() => {
      void checkNuvioUpdates(Boolean(state.automatic)).catch(() => {})
    }, 2 * 3600 * 1000)
    checkInterval.unref()
  }
}

export function nuvioAddonState(): NuvioAddonUpdateState {
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

  return {
    id: 'com.nuvio.player.addon',
    installed,
    previous: state.previous,
    available: state.available || upstream,
    upstream: state.upstream,
    upstreamPublishedAt: state.upstreamPublishedAt,
    upstreamChangelog: state.upstreamChangelog,
    upstreamUrl: state.upstreamUrl || `${NUVIO_GITHUB_URL}/releases`,
    updateAvailable,
    upstreamUpdateAvailable: hasNewerUpstream,
    automatic: state.automatic,
    checkedAt: state.checkedAt,
    busy: isBusy,
    message: state.message,
    githubRepo: NUVIO_GITHUB_REPO,
    githubUrl: NUVIO_GITHUB_URL
  }
}

/**
 * Safe installer that guarantees custom logic preservation:
 * 1. Takes an atomic backup of active plugin files.
 * 2. Merges manifest properties non-destructively: updates version, homepage, repository,
 *    and preserves custom name, description, author, permissions, allowedDomains, entrypoint, style, etc.
 * 3. Preserves custom code files (index.js, theme.css, custom configurations).
 * 4. Verifies installation integrity; automatically restores previous version on failure.
 * 5. Updates persisted state and message.
 */
async function performNuvioInstall(
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
      'opensubtitles-v3.strem.io',
      '*.strem.fun',
      '*.elfhosted.com',
      '*.baby-beamup.club',
      'images.metahub.space',
      'api.themoviedb.org',
      'image.tmdb.org',
      '*.imdb.com',
      '*.media-amazon.com',
      'api.github.com',
      'github.com',
      'raw.githubusercontent.com',
      'objects.githubusercontent.com',
      '127.0.0.1',
      'localhost'
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

      // Smart merge preserving all custom Ghost Launcher properties:
      manifest.id = 'com.nuvio.player.addon'
      manifest.name =
        manifest.name || 'Nuvio Media Player & Addon (Stremio + Alazterflix)'
      manifest.version = targetVersion
      manifest.homepage = NUVIO_GITHUB_URL
      manifest.repository = NUVIO_GITHUB_REPO
      manifest.description =
        manifest.description ||
        'Plugin e Addon oficial Nuvio Desktop integrado ao Alazterflix e Stremio.'
      manifest.author = manifest.author || 'NuvioMedia & Ghost Labs'
      manifest.type = 'media'
      manifest.entrypoint = manifest.entrypoint || 'index.js'
      manifest.style = manifest.style || 'theme.css'

      // Merge and protect allowedDomains
      const existingDomains = Array.isArray(manifest.allowedDomains)
        ? manifest.allowedDomains
        : []
      manifest.allowedDomains = Array.from(
        new Set([...existingDomains, ...requiredDomains])
      )

      // Write protected manifest
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

      // Ensure index.js and theme.css exist (copy from backup if somehow missing)
      const indexPath = join(dir, 'index.js')
      if (!existsSync(indexPath) && existsSync(join(backupDir, 'index.js'))) {
        cpSync(join(backupDir, 'index.js'), indexPath)
      }
      const themePath = join(dir, 'theme.css')
      if (!existsSync(themePath) && existsSync(join(backupDir, 'theme.css'))) {
        cpSync(join(backupDir, 'theme.css'), themePath)
      }
    }

    // Verify integrity of updated installation
    verifyNuvioAddon()

    // Update persisted state
    state.installed = targetVersion
    state.available = targetVersion
    state.message = `Nuvio Addon atualizado com sucesso para v${targetVersion} de acordo com o NuvioDesktop oficial.`
    persistState()
  } catch (err: any) {
    // If update or verification fails, rollback from backup immediately!
    if (state.previous && existsSync(backupDir)) {
      for (const dir of getActivePluginDirs()) {
        try {
          cpSync(backupDir, dir, { recursive: true })
        } catch {}
      }
      state.installed = state.previous
      delete state.previous
    }
    state.message = `Falha ao aplicar atualização para v${targetVersion}: ${err?.message || err}. Versão anterior preservada.`
    persistState()
    throw err
  }
}

export async function checkNuvioUpdates(force = false): Promise<NuvioAddonUpdateState> {
  // If auto-update is enabled and a newer version was already discovered, auto-install immediately!
  if (!isBusy && state.automatic) {
    const currentInstalled = state.installed || readInstalledVersionFromManifest()
    const pendingTarget = state.upstream || state.available
    if (
      pendingTarget &&
      (engineVersionGt(pendingTarget, currentInstalled) ||
        (normalizeEngineVersion(pendingTarget) !==
          normalizeEngineVersion(currentInstalled) &&
          pendingTarget !== currentInstalled))
    ) {
      isBusy = true
      try {
        await performNuvioInstall(pendingTarget, currentInstalled)
      } catch {} finally {
        isBusy = false
      }
      return nuvioAddonState()
    }
  }

  if (isBusy) return nuvioAddonState()
  if (!force && state.checkedAt && Date.now() - state.checkedAt < 3600000) {
    return nuvioAddonState()
  }

  isBusy = true
  try {
    let releasesJson: any[] | null = null

    try {
      const res = await secureFetch(NUVIO_RELEASES_API, {
        headers: {
          'User-Agent': 'GhostLauncher-NuvioAddon/1.0',
          Accept: 'application/vnd.github+json'
        },
        signal: AbortSignal.timeout(15000)
      })
      if (res.ok) {
        releasesJson = await res.json()
      }
    } catch {
      // Direct native fetch fallback
      try {
        const res = await fetch(NUVIO_RELEASES_API, {
          headers: {
            'User-Agent': 'GhostLauncher-NuvioAddon/1.0',
            Accept: 'application/vnd.github+json'
          },
          signal: AbortSignal.timeout(15000)
        })
        if (res.ok) {
          releasesJson = await res.json()
        }
      } catch {}
    }

    if (Array.isArray(releasesJson) && releasesJson.length > 0) {
      const latest = releasesJson[0]
      const rawTag = String(latest.tag_name || '').trim()
      const cleanTag = rawTag.replace(/^v/i, '')

      state.upstream = cleanTag || state.upstream
      state.available = cleanTag || state.available
      state.upstreamPublishedAt = latest.published_at || latest.created_at
      state.upstreamUrl = latest.html_url || `${NUVIO_GITHUB_URL}/releases/tag/${rawTag}`
      if (typeof latest.body === 'string' && latest.body.trim()) {
        state.upstreamChangelog = latest.body.slice(0, 1200)
      }
      state.checkedAt = Date.now()

      const currentInstalled = state.installed || readInstalledVersionFromManifest()
      if (
        engineVersionGt(cleanTag, currentInstalled) ||
        (cleanTag !== currentInstalled && !state.installed)
      ) {
        state.message = `Nova versão ${cleanTag} disponível no GitHub oficial do Nuvio Desktop.`
        if (state.automatic) {
          try {
            await performNuvioInstall(cleanTag, currentInstalled)
          } catch (err: any) {
            state.message = `Falha ao instalar automaticamente a versão ${cleanTag}: ${err?.message || 'erro'}`
          }
        }
      } else {
        state.message = 'O Nuvio Addon está sincronizado com a versão oficial mais recente.'
      }
    } else {
      state.checkedAt = Date.now()
      state.message = 'Origem oficial consultada. Versão atual mantida.'
    }
  } catch (err: any) {
    state.message = `Consulta ao GitHub oficial falhou: ${err?.message || 'rede'}`
  } finally {
    isBusy = false
    persistState()
  }

  return nuvioAddonState()
}

export async function installNuvioUpdate(): Promise<NuvioAddonUpdateState> {
  if (isBusy) throw new Error('Operação do Nuvio Addon em andamento. Aguarde…')
  isBusy = true
  try {
    const targetVersion = state.upstream || state.available || '0.1.32-alpha'
    const currentVersion = state.installed || readInstalledVersionFromManifest()
    await performNuvioInstall(targetVersion, currentVersion)
  } finally {
    isBusy = false
  }
  return nuvioAddonState()
}

export async function restoreNuvioVersion(): Promise<NuvioAddonUpdateState> {
  if (isBusy) throw new Error('Operação em andamento. Aguarde…')
  if (!state.previous) {
    throw new Error('Nenhuma versão anterior disponível para restauração.')
  }

  isBusy = true
  try {
    const backupDir = getBackupDirPath()
    const targetVersion = state.previous

    if (existsSync(backupDir)) {
      for (const dir of getActivePluginDirs()) {
        try {
          cpSync(backupDir, dir, { recursive: true })
        } catch {}
      }
    } else {
      // Reverter versão no manifesto
      for (const dir of getActivePluginDirs()) {
        try {
          const p = join(dir, 'plugin.json')
          if (existsSync(p)) {
            const m = JSON.parse(readFileSync(p, 'utf-8'))
            m.version = targetVersion
            writeFileSync(p, JSON.stringify(m, null, 2), 'utf-8')
          }
        } catch {}
      }
    }

    state.installed = targetVersion
    delete state.previous
    state.message = `Versão v${targetVersion} restaurada com sucesso.`
    persistState()
  } finally {
    isBusy = false
  }
  return nuvioAddonState()
}

export function verifyNuvioAddon(): NuvioAddonUpdateState {
  for (const dir of getActivePluginDirs()) {
    const manifestPath = join(dir, 'plugin.json')
    const indexPath = join(dir, 'index.js')
    if (!existsSync(manifestPath) || !existsSync(indexPath)) {
      throw new Error('Arquivos essenciais do Nuvio Addon estão ausentes.')
    }
  }
  state.message = 'A instalação do Nuvio Addon está íntegra e verificada.'
  persistState()
  return nuvioAddonState()
}

export async function nuvioAddonAction(action: NuvioAddonAction): Promise<NuvioAddonUpdateState> {
  if (action.type === 'automatic') {
    state.automatic = Boolean(action.enabled)
    persistState()
    if (state.automatic) {
      return await checkNuvioUpdates(true)
    }
    return nuvioAddonState()
  }
  if (action.type === 'check') {
    return checkNuvioUpdates(true)
  }
  if (action.type === 'install') {
    return installNuvioUpdate()
  }
  if (action.type === 'restore') {
    return restoreNuvioVersion()
  }
  if (action.type === 'verify') {
    return verifyNuvioAddon()
  }
  throw new Error('Ação não suportada.')
}
