import { existsSync, readFileSync, writeFileSync } from 'graceful-fs'
import { join, dirname, resolve } from 'path'

export const GHOST_MANIFEST_FILENAME = '.ghost-manifest.json'
export const GHOST_SIGNATURE = 'GHOST-VERIFIED-V1' as const

export interface GhostGameManifest {
  schemaVersion: 1
  ghostAppId: string
  title: string
  version: string
  storeId?: string
  storeName?: string
  storePageUrl?: string
  executableRelPath?: string
  installedAt: string
  lastUpdateAt?: string
  downloadSource?: string
  transport?: string
  ghostSignature: typeof GHOST_SIGNATURE
  coverUrl?: string
  saveBackupId?: string
  originalInstallPath?: string
}

/**
 * Grava o manifesto oficial no diretório de instalação do jogo ou pasta de saves
 */
export function writeGhostManifest(
  targetDir: string,
  manifest: Omit<GhostGameManifest, 'schemaVersion' | 'ghostSignature'> & {
    schemaVersion?: 1
    ghostSignature?: typeof GHOST_SIGNATURE
  }
): boolean {
  try {
    if (!targetDir || !existsSync(targetDir)) return false
    const fullManifest: GhostGameManifest = {
      schemaVersion: 1,
      ghostSignature: GHOST_SIGNATURE,
      storeId: manifest.storeId || 'sideload',
      storeName: manifest.storeName || 'Sideload / Piratas',
      ...manifest
    }
    const manifestPath = join(targetDir, GHOST_MANIFEST_FILENAME)
    writeFileSync(manifestPath, JSON.stringify(fullManifest, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error(`[GhostManifest]: Erro ao gravar manifesto em "${targetDir}":`, err)
    return false
  }
}

/**
 * Lê e valida o manifesto Ghost a partir de um diretório
 */
export function readGhostManifest(dir: string): GhostGameManifest | null {
  try {
    if (!dir || !existsSync(dir)) return null
    const manifestPath = join(dir, GHOST_MANIFEST_FILENAME)
    if (!existsSync(manifestPath)) return null

    const raw = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '').trim()
    const parsed = JSON.parse(raw) as GhostGameManifest

    if (
      parsed &&
      parsed.schemaVersion === 1 &&
      parsed.ghostSignature === GHOST_SIGNATURE &&
      parsed.title &&
      parsed.version
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Procura o manifesto a partir do caminho de um executável ou diretório,
 * subindo até 4 níveis de diretórios pai (ex: Game/Binaries/Win64/game.exe -> Game/.ghost-manifest.json)
 */
export function findManifestForExecutable(
  executableOrDir: string
): { manifest: GhostGameManifest; manifestDir: string } | null {
  try {
    if (!executableOrDir) return null
    let currentDir = existsSync(executableOrDir) && !executableOrDir.toLowerCase().endsWith('.exe')
      ? resolve(executableOrDir)
      : dirname(resolve(executableOrDir))

    for (let depth = 0; depth < 5; depth++) {
      const manifest = readGhostManifest(currentDir)
      if (manifest) {
        return { manifest, manifestDir: currentDir }
      }
      const parent = dirname(currentDir)
      if (!parent || parent === currentDir) break
      currentDir = parent
    }
    return null
  } catch {
    return null
  }
}
