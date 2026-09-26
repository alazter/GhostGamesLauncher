import { existsSync } from 'fs'
import { readdir, rename, rmdir } from 'fs/promises'
import { basename, join, relative } from 'path'
import { randomUUID } from 'crypto'
import { archivePathIsSafe, inside } from './externalPolicy'

export function gameDirectoryName(title: string): string {
  const name = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/g, '')
  return name && archivePathIsSafe(name) && !name.startsWith('.ghost-')
    ? name
    : 'Jogo'
}

export async function prepareNewInstallDirectory(
  stage: string,
  parent: string,
  title: string,
  candidates: string[],
  reserved: string[] = [],
  allowExisting = false
): Promise<{ directory: string; candidates: string[] }> {
  let name = gameDirectoryName(title)
  let nextCandidates = candidates

  // Keep the package's root as the installation directory, not as nested redundant wrappers.
  let outerWrapperName: string | undefined
  let unwrappedSomething = true
  while (unwrappedSomething) {
    unwrappedSomething = false
    let entries = await readdir(stage, { withFileTypes: true })

    // Helper to identify cosmetic/junk files that shouldn't prevent unwrapping a single main folder
    const isCosmeticFile = (fileName: string) => {
      const lower = fileName.toLowerCase()
      return (
        lower.endsWith('.txt') ||
        lower.endsWith('.url') ||
        lower.endsWith('.nfo') ||
        lower.endsWith('.ini') ||
        lower.endsWith('.lnk') ||
        lower.endsWith('.html') ||
        lower.endsWith('.htm') ||
        lower.startsWith('.')
      )
    }

    const nonCosmeticEntries = entries.filter((e) => !isCosmeticFile(e.name))

    let targetDir: typeof entries[0] | undefined

    if (
      entries.length === 1 &&
      entries[0].isDirectory() &&
      !entries[0].isSymbolicLink()
    ) {
      // First unwrap: package root wrapper
      targetDir = entries[0]
    } else if (
      nonCosmeticEntries.length === 1 &&
      nonCosmeticEntries[0].isDirectory() &&
      !nonCosmeticEntries[0].isSymbolicLink()
    ) {
      targetDir = nonCosmeticEntries[0]
    }

    // Only unwrap if this is the first unwrap OR if the inner directory is an exact duplicate name of the outer wrapper (e.g. Romestead/romestead)
    if (targetDir) {
      const isDuplicateInner =
        outerWrapperName &&
        targetDir.name.toLowerCase() === outerWrapperName.toLowerCase()
      if (outerWrapperName && !isDuplicateInner && targetDir.name !== '.ghost-content') {
        break
      }
      outerWrapperName = targetDir.name
      let root = join(stage, targetDir.name)
      // TorBox's inner archive is extracted into this internal staging directory.
      if (targetDir.name === '.ghost-content') {
        const subEntries = await readdir(root, { withFileTypes: true })
        if (
          subEntries.length === 1 &&
          subEntries[0].isDirectory() &&
          !subEntries[0].isSymbolicLink()
        ) {
          root = join(root, subEntries[0].name)
        }
      }
      if (basename(root) !== '.ghost-content') {
        const candidateName = gameDirectoryName(basename(root))
        if (title && gameDirectoryName(title).toLowerCase() === candidateName.toLowerCase()) {
          name = gameDirectoryName(title)
        } else if (outerWrapperName && gameDirectoryName(outerWrapperName).toLowerCase() === candidateName.toLowerCase()) {
          name = gameDirectoryName(outerWrapperName)
        } else {
          name = candidateName
        }
      }
      if (!nextCandidates.every((file) => inside(root, file))) {
        break
      }
      const relativeCandidates = nextCandidates.map((file) => relative(root, file))
      const children = await readdir(root)
      let temporary: string
      do {
        temporary = join(stage, `.ghost-unpack-${randomUUID()}`)
      } while (existsSync(temporary) || children.includes(basename(temporary)))
      await rename(root, temporary)
      const wrapper = join(stage, '.ghost-content')
      if (root !== wrapper && existsSync(wrapper)) {
        try { await rmdir(wrapper) } catch {}
      }
      for (const child of children) {
        await rename(join(temporary, child), join(stage, child))
      }
      try { await rmdir(temporary) } catch {}
      nextCandidates = relativeCandidates.map((file) => join(stage, file))
      unwrappedSomething = true
    }
  }

  let directory = join(parent, name)
  if (!allowExisting) {
    let suffix = 2
    while (
      existsSync(directory) ||
      reserved.some((path) => path.toLowerCase() === directory.toLowerCase())
    ) {
      directory = join(parent, `${name} (${suffix++})`)
    }
  } else {
    let suffix = 2
    while (
      reserved.some((path) => path.toLowerCase() === directory.toLowerCase())
    ) {
      directory = join(parent, `${name} (${suffix++})`)
    }
  }

  if (!inside(parent, directory))
    throw new Error('Pasta de instalação inválida.')
  return { directory, candidates: nextCandidates }
}
