const TECHNICAL_SUBFOLDER_RE =
  /^(?:bin|binaries|pc|win64|win32|x64|x86|x64_86|client_pc|root|launcher|original launcher|exe|windows_content|retail|shipping|stable|beta|release|public|downloaded|engine|game|data|build|_commonredist|redist|v\d+(?:\.\d+)*)$/i

/**
 * Pastas-mãe de bibliotecas de jogos onde cada pasta filha direta (1º nível abaixo do container)
 * é garantidamente a pasta raiz individual de um jogo (ex.: `N:\Alazter Games\Gran Turismo 7`).
 */
export const GAMES_LIBRARY_CONTAINER_NAMES = new Set([
  'alazter games',
  'jogos',
  'games',
  'gog',
  'gog games',
  'epic games',
  'steamfix',
  'origin backups',
  'decompiladores',
  'emuladores',
  'rom',
  'roms'
])

export const PROTECTED_CONTAINER_NAMES = new Set([
  ...GAMES_LIBRARY_CONTAINER_NAMES,
  'desktop',
  'downloads',
  'documents',
  'documentos',
  'appdata',
  'local',
  'locallow',
  'roaming',
  'windows',
  'system32',
  'program files',
  'program files (x86)',
  'programdata',
  'users',
  'usuarios',
  'heroic',
  'ghost',
  'steam',
  'steamlibrary',
  'steamapps',
  'common',
  'programas',
  'softwares'
])

export function sanitizeInstallPathString(rawPath?: string | null): string {
  if (!rawPath || typeof rawPath !== 'string') return ''
  return rawPath.replace(/["']/g, '').trim()
}

function splitPathSegments(p: string): { root: string; segments: string[]; sep: string } {
  const clean = sanitizeInstallPathString(p)
  const sep = clean.includes('\\') || /^[a-zA-Z]:/.test(clean) ? '\\' : '/'
  const normalized = clean.replace(/[\\/]+/g, sep).replace(new RegExp(`\\${sep}+$`), '')
  const driveMatch = normalized.match(/^([a-zA-Z]:)(?:\\(.*))?$/)
  if (driveMatch) {
    const rest = driveMatch[2] || ''
    return {
      root: `${driveMatch[1]}\\`,
      segments: rest ? rest.split('\\').filter(Boolean) : [],
      sep: '\\'
    }
  }
  const isAbsUnix = normalized.startsWith('/')
  const parts = normalized.split(sep).filter(Boolean)
  return {
    root: isAbsUnix ? '/' : '',
    segments: parts,
    sep
  }
}

function joinPathSegments(root: string, segments: string[], sep: string): string {
  if (segments.length === 0) return root
  if (!root) return segments.join(sep)
  if (root.endsWith(sep)) return `${root}${segments.join(sep)}`
  return `${root}${sep}${segments.join(sep)}`
}

export function getParentPathString(rawPath?: string | null): string {
  const clean = sanitizeInstallPathString(rawPath)
  if (!clean) return ''
  const { root, segments, sep } = splitPathSegments(clean)
  if (segments.length <= 1) return root
  return joinPathSegments(root, segments.slice(0, -1), sep)
}

function normalizeTitleTokens(text?: string | null): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function foldersShareGameIdentity(
  childName: string,
  parentName: string,
  gameTitle?: string
): boolean {
  const cNorm = normalizeTitleTokens(childName)
  const pNorm = normalizeTitleTokens(parentName)
  const tNorm = normalizeTitleTokens(gameTitle)
  if (!pNorm || pNorm.length < 3) return false
  if (PROTECTED_CONTAINER_NAMES.has(parentName.trim().toLowerCase())) return false

  if (cNorm && (cNorm === pNorm || cNorm.includes(pNorm) || pNorm.includes(cNorm))) {
    return true
  }
  if (tNorm && tNorm.length >= 3 && (pNorm === tNorm || pNorm.includes(tNorm) || tNorm.includes(pNorm))) {
    return true
  }
  return false
}

export function isProtectedSystemOrContainerDir(dirPath?: string | null): boolean {
  const clean = sanitizeInstallPathString(dirPath)
  if (!clean) return true
  const { segments } = splitPathSegments(clean)
  if (segments.length === 0) return true // Raiz de disco (C:\, N:\, /)
  const base = segments[segments.length - 1].trim().toLowerCase()
  if (PROTECTED_CONTAINER_NAMES.has(base)) return true
  // Diretório de usuário direto (ex.: C:\Users\alazt)
  if (
    segments.length === 2 &&
    (segments[0].toLowerCase() === 'users' || segments[0].toLowerCase() === 'usuarios')
  ) {
    return true
  }
  return false
}

/**
 * Resolve a pasta raiz real de instalação do jogo a partir de uma subpasta de executável
 * (ex.: sobe de `...\Gran Turismo 7\Launcher` para `...\Gran Turismo 7`, ou de
 * `...\Warhammer Space Marine 2\Warhammer 40,000 Space Marine 2\client_pc\root\bin\pc`
 * para `...\Warhammer Space Marine 2`), sem jamais subir para pastas-mãe protegidas
 * (`Alazter Games`, `Jogos`, `Games`, `Decompiladores`, `Program Files`, raízes de disco, etc.).
 */
export function resolveGameRootInstallDirectory(
  rawDirOrPath?: string | null,
  gameTitle?: string
): string {
  const clean = sanitizeInstallPathString(rawDirOrPath)
  if (!clean) return ''

  const { root, segments, sep } = splitPathSegments(clean)
  if (segments.length === 0) return clean

  // 1. Regra Direta de Containers de Biblioteca de Jogos:
  // Se o caminho está dentro de um container de jogos (ex.: `N:\Alazter Games\Gran Turismo 7\Launcher`,
  // `S:\Gog\Settlers 4 Gold\Exe`, `T:\Jogos\Jogos\Transport Tycoon\OpenTTD 1.4.7`,
  // `E:\SteamLibrary\steamapps\common\Skate\...`), a pasta raiz do jogo é SEMPRE a pasta filha direta
  // logo abaixo do container de jogos mais interno.
  let deepestGamesContainerIdx = -1
  for (let i = 0; i < segments.length; i++) {
    const segLower = segments[i].trim().toLowerCase()
    const prevLower = i > 0 ? segments[i - 1].trim().toLowerCase() : ''
    if (
      GAMES_LIBRARY_CONTAINER_NAMES.has(segLower) ||
      (segLower === 'common' && prevLower === 'steamapps')
    ) {
      deepestGamesContainerIdx = i
    }
  }

  if (
    deepestGamesContainerIdx >= 0 &&
    segments.length > deepestGamesContainerIdx + 1
  ) {
    const directChild = segments[deepestGamesContainerIdx + 1].trim().toLowerCase()
    if (!PROTECTED_CONTAINER_NAMES.has(directChild)) {
      return joinPathSegments(
        root,
        segments.slice(0, deepestGamesContainerIdx + 2),
        sep
      )
    }
  }

  // 2. Regra Bottom-Up para Caminhos Fora de Containers Padrão:
  // Sobe de subpastas técnicas (bin, pc, win64, launcher, exe, windows_content, stable, v3.2.0, client_pc, root, etc.)
  // e pastas-invólucro duplicadas do próprio jogo (ex.: `REPLACED\REPLACED` ou
  // `Warhammer Space Marine 2\Warhammer 40,000 Space Marine 2`), parando sempre antes de pastas-mãe protegidas.
  const working = [...segments]
  while (working.length > 1) {
    const currentBase = working[working.length - 1].trim()
    const parentBase = working[working.length - 2].trim()
    if (PROTECTED_CONTAINER_NAMES.has(parentBase.toLowerCase())) {
      break
    }
    if (
      TECHNICAL_SUBFOLDER_RE.test(currentBase) ||
      foldersShareGameIdentity(currentBase, parentBase, gameTitle)
    ) {
      working.pop()
      continue
    }
    break
  }

  return joinPathSegments(root, working, sep)
}

export function collectCandidateInstallDirectories(
  rawDirs: Array<string | null | undefined>,
  rawExecutables: Array<string | null | undefined> = [],
  gameTitle?: string
): string[] {
  const results: string[] = []
  const seen = new Set<string>()

  const pushDir = (rawDir?: string | null) => {
    const clean = sanitizeInstallPathString(rawDir)
    if (!clean) return
    const rootResolved = resolveGameRootInstallDirectory(clean, gameTitle)
    for (const candidate of [rootResolved, clean]) {
      if (!candidate) continue
      const key = candidate.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        results.push(candidate)
      }
    }
  }

  for (const dir of rawDirs) {
    pushDir(dir)
  }
  for (const exe of rawExecutables) {
    const parent = getParentPathString(exe)
    if (parent) pushDir(parent)
  }

  return results
}

/**
 * Extrai a letra do drive Windows (ex.: `"E:"`, `"N:"`, `"C:"`) a partir de um caminho de arquivo ou pasta.
 */
export function extractDriveLetterFromPath(
  rawPath?: string | null
): string | null {
  const clean = sanitizeInstallPathString(rawPath)
  if (!clean) return null
  const match = clean.match(/^([a-zA-Z]):/)
  if (!match) return null
  return `${match[1].toUpperCase()}:`
}

/**
 * Extrai a letra do drive onde um jogo está instalado a partir de `install_path`, `executable` ou `folder_name`.
 */
export function extractGameDriveLetter(game?: {
  folder_name?: string | null
  install?: {
    install_path?: string | null
    executable?: string | null
  } | null
} | null): string | null {
  if (!game) return null
  return (
    extractDriveLetterFromPath(game.install?.install_path) ||
    extractDriveLetterFromPath(game.install?.executable) ||
    extractDriveLetterFromPath(game.folder_name)
  )
}
