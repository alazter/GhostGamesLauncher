import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'graceful-fs'
import { basename, dirname, join, resolve, sep } from 'path'
import { readPluginInstallations } from '../plugins/pluginInstallations'

export const ALAZTERFLIX_PLUGIN_IDS = new Set([
  'com.ghost.alazterflix',
  'com.ghost.cinema'
])
export const GHOST_IPTV_PLUGIN_ID = 'com.ghost.iptv'
export const BUILTIN_IPTV_SOURCE_ID = 'org.meufutebol'

const MAX_CUSTOM_M3U_FILE_BYTES = 5 * 1024 * 1024 // 5 MB por arquivo M3U
const MAX_CUSTOM_M3U_TOTAL_BYTES = 15 * 1024 * 1024 // 15 MB globais para arquivos M3U customizados

export interface GhostIptvAddonEntry {
  id: string
  name?: string
  manifest_url?: string
  resolved_url?: string
  enabled?: boolean
  group_override?: string
  source_type?: string
  username?: string
  password?: string
  channels_count?: number
  last_sync?: string
  last_error?: string
  [key: string]: unknown
}

export interface GhostIptvBackupData {
  version: 1
  addons: GhostIptvAddonEntry[]
  customM3uFiles?: Record<string, string>
  nativePlaylists?: unknown[]
  nativeEpgSources?: unknown[]
}

export interface RestoreGhostIptvResult {
  restored: boolean
  reason?: 'plugins_not_installed' | 'no_sources'
  addonsCount: number
  customM3uCount: number
  nativePlaylistsCount: number
}

export function getGhostIptvUserDir(baseUserDataPath: string): string {
  return join(baseUserDataPath, 'plugins', GHOST_IPTV_PLUGIN_ID)
}

export function getGhostIptvCanonicalAddonsPath(
  baseUserDataPath: string
): string {
  return join(getGhostIptvUserDir(baseUserDataPath), 'addons.json')
}

export function getGhostIptvCustomM3uDir(baseUserDataPath: string): string {
  return join(getGhostIptvUserDir(baseUserDataPath), 'custom_m3u')
}

export function sanitizeM3uEntryId(rawId: string): string {
  return basename(String(rawId || ''))
    .replace(/\.m3u8?$/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
}

function writeAtomicJson(targetPath: string, payload: unknown): void {
  mkdirSync(dirname(targetPath), { recursive: true })
  const tmpPath = `${targetPath}.tmp`
  const content = JSON.stringify(payload, null, 2)
  try {
    writeFileSync(tmpPath, content, 'utf8')
    renameSync(tmpPath, targetPath)
  } catch {
    writeFileSync(targetPath, content, 'utf8')
  }
}

function writeAtomicText(targetPath: string, content: string): void {
  mkdirSync(dirname(targetPath), { recursive: true })
  const tmpPath = `${targetPath}.tmp`
  try {
    writeFileSync(tmpPath, content, 'utf8')
    renameSync(tmpPath, targetPath)
  } catch {
    writeFileSync(targetPath, content, 'utf8')
  }
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath) || !lstatSync(filePath).isFile()) return null
    const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim()
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Verifica se TANTO o plugin Alazterflix (com.ghost.alazterflix / com.ghost.cinema)
 * QUANTO o addon Ghost IPTV (com.ghost.iptv) estão instalados na pasta de plugins do usuário.
 */
export function areAlazterflixAndGhostIptvInstalled(
  baseUserDataPath: string
): boolean {
  const pluginsRoot = join(baseUserDataPath, 'plugins')
  if (!existsSync(pluginsRoot)) return false

  let hasAlazterflix = false
  let hasGhostIptv = false

  try {
    const installations = readPluginInstallations(pluginsRoot)
    for (const inst of installations) {
      if (ALAZTERFLIX_PLUGIN_IDS.has(inst.manifest.id)) {
        hasAlazterflix = true
      }
      if (inst.manifest.id === GHOST_IPTV_PLUGIN_ID) {
        hasGhostIptv = true
      }
    }
  } catch {}

  // Fallback leve caso algum plugin.json tenha campos extras não validados pelo schema estrito
  if (!hasAlazterflix || !hasGhostIptv) {
    try {
      for (const entry of readdirSync(pluginsRoot)) {
        if (entry === '__temp_unpacking__') continue
        const folderPath = join(pluginsRoot, entry)
        const manifestPath = join(folderPath, 'plugin.json')
        const manifest = readJsonSafe<{ id?: string }>(manifestPath)
        const id = String(manifest?.id || '').trim()
        if (ALAZTERFLIX_PLUGIN_IDS.has(id)) hasAlazterflix = true
        if (id === GHOST_IPTV_PLUGIN_ID) hasGhostIptv = true
      }
    } catch {}
  }

  return hasAlazterflix && hasGhostIptv
}

/**
 * Identifica se uma entrada do addons.json é uma fonte/lista cadastrada pelo usuário
 * (desconsiderando a fonte padrão nativa embutida org.meufutebol).
 */
export function isUserRegisteredGhostIptvAddon(
  entry: unknown
): entry is GhostIptvAddonEntry {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
  const obj = entry as GhostIptvAddonEntry
  const id = String(obj.id || '').trim()
  if (!id) return false
  if (id === BUILTIN_IPTV_SOURCE_ID || obj.source_type === 'builtin') {
    return false
  }
  const hasUrl = Boolean(
    String(obj.manifest_url || '').trim() ||
      String(obj.resolved_url || '').trim()
  )
  const hasName = Boolean(String(obj.name || '').trim())
  return hasUrl || hasName
}

export function readGhostIptvAddons(
  baseUserDataPath: string,
  extraCandidatePaths: string[] = []
): { filePath: string | null; addons: GhostIptvAddonEntry[] } {
  const candidates = [
    getGhostIptvCanonicalAddonsPath(baseUserDataPath),
    join(getGhostIptvUserDir(baseUserDataPath), 'web', 'addons.json'),
    ...extraCandidatePaths
  ]

  const visited = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate) continue
    const normalized = resolve(candidate)
    if (visited.has(normalized)) continue
    visited.add(normalized)
    const parsed = readJsonSafe<unknown>(normalized)
    if (Array.isArray(parsed)) {
      return {
        filePath: normalized,
        addons: parsed.filter(
          (item): item is GhostIptvAddonEntry =>
            Boolean(item && typeof item === 'object' && !Array.isArray(item))
        )
      }
    }
  }

  return { filePath: null, addons: [] }
}

function readCustomM3uFiles(baseUserDataPath: string): Record<string, string> {
  const result: Record<string, string> = {}
  const customM3uDir = getGhostIptvCustomM3uDir(baseUserDataPath)
  if (!existsSync(customM3uDir)) return result

  let totalBytes = 0
  try {
    for (const fileName of readdirSync(customM3uDir).sort()) {
      if (!/\.m3u8?$/i.test(fileName)) continue
      const fullPath = join(customM3uDir, fileName)
      try {
        const stat = lstatSync(fullPath)
        if (!stat.isFile() || stat.isSymbolicLink()) continue
        if (
          stat.size <= 0 ||
          stat.size > MAX_CUSTOM_M3U_FILE_BYTES ||
          totalBytes + stat.size > MAX_CUSTOM_M3U_TOTAL_BYTES
        ) {
          continue
        }
        const safeId = sanitizeM3uEntryId(fileName)
        if (!safeId) continue
        const text = readFileSync(fullPath, 'utf8')
        if (!text.trim()) continue
        totalBytes += stat.size
        result[safeId] = text
      } catch {}
    }
  } catch {}

  return result
}

/**
 * Coleta as Fontes & Listas Cadastradas do Ghost IPTV (dentro do Alazterflix) para o backup.
 * Regra condicional estrita:
 * - Somente coleta se TANTO o plugin Alazterflix QUANTO o addon Ghost IPTV estiverem instalados.
 * - Somente coleta se houver pelo menos 1 fonte/lista cadastrada pelo usuário.
 * - Caso contrário, retorna `undefined` (o backup ignora totalmente esta seção).
 */
export function collectGhostIptvBackupData(options: {
  userDataPath: string
  extraAddonsCandidatePaths?: string[]
  pluginsData?: Record<string, any>
}): GhostIptvBackupData | undefined {
  const {
    userDataPath: baseUserDataPath,
    extraAddonsCandidatePaths = [],
    pluginsData
  } = options

  if (!areAlazterflixAndGhostIptvInstalled(baseUserDataPath)) {
    return undefined
  }

  const { addons } = readGhostIptvAddons(
    baseUserDataPath,
    extraAddonsCandidatePaths
  )
  const userAddons = addons.filter(isUserRegisteredGhostIptvAddon)
  const customM3uFiles = readCustomM3uFiles(baseUserDataPath)

  const alazterflixData =
    pluginsData?.['com.ghost.alazterflix'] ||
    pluginsData?.['com.ghost.cinema'] ||
    readJsonSafe<Record<string, any>>(
      join(baseUserDataPath, 'plugins_data', 'com.ghost.alazterflix.json')
    ) ||
    {}

  const nativePlaylists = Array.isArray(alazterflixData.tv_playlists)
    ? alazterflixData.tv_playlists.filter(Boolean)
    : []
  const nativeEpgSources = Array.isArray(alazterflixData.tv_epg_sources)
    ? alazterflixData.tv_epg_sources.filter(Boolean)
    : []

  const hasCustomAddons = userAddons.length > 0
  const hasCustomM3uFiles = Object.keys(customM3uFiles).length > 0
  const hasNativeLists =
    nativePlaylists.length > 0 || nativeEpgSources.length > 0

  if (!hasCustomAddons && !hasCustomM3uFiles && !hasNativeLists) {
    return undefined
  }

  const payload: GhostIptvBackupData = {
    version: 1,
    addons
  }

  if (hasCustomM3uFiles) {
    payload.customM3uFiles = customM3uFiles
  }
  if (nativePlaylists.length > 0) {
    payload.nativePlaylists = nativePlaylists
  }
  if (nativeEpgSources.length > 0) {
    payload.nativeEpgSources = nativeEpgSources
  }

  return payload
}

/**
 * Restaura as Fontes & Listas Cadastradas do Ghost IPTV a partir de um backup.
 * - Ignora se Alazterflix ou Ghost IPTV não estiverem instalados no destino.
 * - Ignora se o backup não contiver nenhuma fonte/lista cadastrada pelo usuário.
 * - Grava atomicamente no caminho canônico (`plugins/com.ghost.iptv/addons.json` e `custom_m3u/`)
 *   para que as listas M3U fiquem imediatamente instaladas e funcionais ao abrir o Ghost IPTV.
 */
export function restoreGhostIptvBackupData(options: {
  userDataPath: string
  backupData: {
    ghostIptvSources?: GhostIptvBackupData
    ghostIptvAddons?: unknown
  }
  serverPort?: number
}): RestoreGhostIptvResult {
  const { userDataPath: baseUserDataPath, backupData, serverPort = 8888 } =
    options

  if (!areAlazterflixAndGhostIptvInstalled(baseUserDataPath)) {
    return {
      restored: false,
      reason: 'plugins_not_installed',
      addonsCount: 0,
      customM3uCount: 0,
      nativePlaylistsCount: 0
    }
  }

  const sources = backupData?.ghostIptvSources
  const rawAddons: unknown[] = Array.isArray(sources?.addons)
    ? sources.addons
    : Array.isArray(backupData?.ghostIptvAddons)
      ? backupData.ghostIptvAddons
      : []

  const validAddons = rawAddons.filter(
    (item): item is GhostIptvAddonEntry =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
  )
  const userAddons = validAddons.filter(isUserRegisteredGhostIptvAddon)

  const rawCustomM3u =
    sources?.customM3uFiles &&
    typeof sources.customM3uFiles === 'object' &&
    !Array.isArray(sources.customM3uFiles)
      ? sources.customM3uFiles
      : {}

  const nativePlaylists = Array.isArray(sources?.nativePlaylists)
    ? sources.nativePlaylists.filter(Boolean)
    : []
  const nativeEpgSources = Array.isArray(sources?.nativeEpgSources)
    ? sources.nativeEpgSources.filter(Boolean)
    : []

  const customM3uEntries = Object.entries(rawCustomM3u).filter(
    ([id, content]) =>
      Boolean(sanitizeM3uEntryId(id)) &&
      typeof content === 'string' &&
      content.trim().length > 0
  )

  if (
    userAddons.length === 0 &&
    customM3uEntries.length === 0 &&
    nativePlaylists.length === 0 &&
    nativeEpgSources.length === 0
  ) {
    return {
      restored: false,
      reason: 'no_sources',
      addonsCount: 0,
      customM3uCount: 0,
      nativePlaylistsCount: 0
    }
  }

  // 1. Restaurar arquivos M3U customizados/enviados pelo usuário com trava anti-path-traversal
  let customM3uCount = 0
  if (customM3uEntries.length > 0) {
    const customM3uDir = resolve(getGhostIptvCustomM3uDir(baseUserDataPath))
    mkdirSync(customM3uDir, { recursive: true })
    let restoredBytes = 0
    for (const [rawId, content] of customM3uEntries) {
      const safeId = sanitizeM3uEntryId(rawId)
      if (!safeId) continue
      const byteLen = Buffer.byteLength(content, 'utf8')
      if (
        byteLen > MAX_CUSTOM_M3U_FILE_BYTES ||
        restoredBytes + byteLen > MAX_CUSTOM_M3U_TOTAL_BYTES
      ) {
        continue
      }
      const targetFile = resolve(customM3uDir, `${safeId}.m3u`)
      if (!targetFile.startsWith(customM3uDir + sep)) continue
      writeAtomicText(targetFile, content)
      restoredBytes += byteLen
      customM3uCount += 1
    }
  }

  // 2. Restaurar addons.json no caminho canônico usado pelo GhostIptvServer
  let addonsCount = 0
  if (validAddons.length > 0) {
    const normalizedAddons = validAddons.map((entry) => {
      const copy: GhostIptvAddonEntry = { ...entry }
      // Garante que URLs de arquivos M3U locais apontem para a porta ativa do Ghost IPTV
      const rewriteLocalM3uUrl = (rawUrl?: string): string | undefined => {
        if (!rawUrl) return rawUrl
        const m = String(rawUrl).match(
          /^https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/api\/addons\/m3u\/([a-zA-Z0-9._-]+\.m3u8?)$/i
        )
        if (m?.[1]) {
          return `http://127.0.0.1:${serverPort}/api/addons/m3u/${m[1]}`
        }
        return rawUrl
      }
      if (copy.manifest_url) {
        copy.manifest_url = rewriteLocalM3uUrl(copy.manifest_url)
      }
      if (copy.resolved_url) {
        copy.resolved_url = rewriteLocalM3uUrl(copy.resolved_url)
      }
      return copy
    })

    const canonicalAddonsPath = getGhostIptvCanonicalAddonsPath(baseUserDataPath)
    writeAtomicJson(canonicalAddonsPath, normalizedAddons)
    addonsCount = userAddons.length
  }

  // 3. Garantir playlists/EPG nativas no storage do Alazterflix (caso backup parcial ou legado)
  let nativePlaylistsCount = 0
  if (nativePlaylists.length > 0 || nativeEpgSources.length > 0) {
    const alazterflixFile = join(
      baseUserDataPath,
      'plugins_data',
      'com.ghost.alazterflix.json'
    )
    const current = readJsonSafe<Record<string, any>>(alazterflixFile) || {}
    let changed = false
    if (
      nativePlaylists.length > 0 &&
      (!Array.isArray(current.tv_playlists) ||
        current.tv_playlists.length === 0)
    ) {
      current.tv_playlists = nativePlaylists
      changed = true
    }
    if (
      nativeEpgSources.length > 0 &&
      (!Array.isArray(current.tv_epg_sources) ||
        current.tv_epg_sources.length === 0)
    ) {
      current.tv_epg_sources = nativeEpgSources
      changed = true
    }
    if (changed) {
      writeAtomicJson(alazterflixFile, current)
    }
    nativePlaylistsCount = nativePlaylists.length
  }

  return {
    restored: true,
    addonsCount,
    customM3uCount,
    nativePlaylistsCount
  }
}
