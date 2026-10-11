import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync
} from 'graceful-fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'path'
import { compare, valid } from 'semver'
import type { PluginManifest } from 'common/types/plugins'
import { PluginPacker } from './pluginPacker'

export interface PluginInstallation {
  manifest: PluginManifest
  installedPath: string
}

// Every installation uses the manifest ID, irrespective of the package folder.
export function pluginInstallPath(root: string, id: string): string {
  const target = resolve(root, id)
  if (!/^[a-zA-Z0-9._-]+$/.test(id) || dirname(target) !== resolve(root)) {
    throw new Error(`Invalid plugin installation ID: ${id}`)
  }
  return target
}

export function readPluginInstallations(
  root: string,
  onInvalid?: (folder: string, error: unknown) => void
): PluginInstallation[] {
  if (!existsSync(root)) return []
  const installations: PluginInstallation[] = []
  for (const entry of readdirSync(root).sort()) {
    if (entry === '__temp_unpacking__') continue
    const installedPath = join(root, entry)
    try {
      const stat = lstatSync(installedPath)
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue
      const manifestPath = join(installedPath, 'plugin.json')
      if (!existsSync(manifestPath)) continue
      const manifest = PluginPacker.validateManifest(
        JSON.parse(readFileSync(manifestPath, 'utf8'))
      )
      pluginInstallPath(root, manifest.id)
      installations.push({ manifest, installedPath })
    } catch (error) {
      onInvalid?.(entry, error)
    }
  }
  return installations
}

export function comparePluginVersions(left: string, right: string): number {
  const leftVersion = valid(left, { loose: true })
  const rightVersion = valid(right, { loose: true })
  // Unknown version formats do not justify replacing an existing installation.
  return leftVersion && rightVersion ? compare(leftVersion, rightVersion) : 0
}

export function preferredPluginInstallations(
  installations: PluginInstallation[]
): PluginInstallation[] {
  const selected = new Map<string, PluginInstallation>()
  for (const installation of installations) {
    const id = installation.manifest.id
    const current = selected.get(id)
    const comparison = current
      ? comparePluginVersions(
          installation.manifest.version,
          current.manifest.version
        )
      : 1
    const canonical = basename(installation.installedPath) === id
    if (
      !current ||
      comparison > 0 ||
      (comparison === 0 && canonical && basename(current.installedPath) !== id)
    ) {
      selected.set(id, installation)
    }
  }
  return [...selected.values()]
}

export function archivePluginInstallation(
  pluginsRoot: string,
  backupRoot: string,
  installationPath: string
): string {
  const source = resolve(installationPath)
  const root = resolve(pluginsRoot)
  const backup = resolve(backupRoot)
  const backupRelative = relative(root, backup)
  if (
    dirname(source) !== root ||
    !backupRelative ||
    (backupRelative !== '..' &&
      !backupRelative.startsWith(`..${sep}`) &&
      !isAbsolute(backupRelative)) ||
    !lstatSync(source).isDirectory() ||
    lstatSync(source).isSymbolicLink()
  ) {
    throw new Error(
      'Plugin archive paths must stay outside active installations.'
    )
  }
  mkdirSync(backup, { recursive: true })
  const container = mkdtempSync(join(backup, `${basename(source)}-`))
  const target = join(container, basename(source))
  renameSync(source, target)
  return target
}

export function reconcilePluginInstallations(
  pluginsRoot: string,
  backupRoot: string
): { archived: string[]; migrated: string[] } {
  const installations = readPluginInstallations(pluginsRoot)
  const selected = preferredPluginInstallations(installations)
  const archived: string[] = []
  const migrated: string[] = []
  for (const winner of selected) {
    const canonical = pluginInstallPath(pluginsRoot, winner.manifest.id)
    if (
      installations.some(
        (other) =>
          resolve(other.installedPath) === canonical &&
          other.manifest.id !== winner.manifest.id
      )
    ) {
      throw new Error(
        `Plugin ID folder belongs to a different plugin: ${canonical}`
      )
    }
    for (const other of installations) {
      if (
        other.manifest.id === winner.manifest.id &&
        other.installedPath !== winner.installedPath
      ) {
        archived.push(
          archivePluginInstallation(
            pluginsRoot,
            backupRoot,
            other.installedPath
          )
        )
      }
    }
    if (resolve(winner.installedPath) !== canonical) {
      // A malformed folder occupying the ID must also be preserved, not overwritten.
      if (existsSync(canonical)) {
        archived.push(
          archivePluginInstallation(pluginsRoot, backupRoot, canonical)
        )
      }
      renameSync(winner.installedPath, canonical)
      migrated.push(canonical)
    }
  }
  return { archived, migrated }
}
