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
  reserved: string[] = []
): Promise<{ directory: string; candidates: string[] }> {
  let name = gameDirectoryName(title)
  let nextCandidates = candidates
  // Keep the package's root as the installation directory, not as a second wrapper.
  let entries = await readdir(stage, { withFileTypes: true })
  if (
    entries.length === 1 &&
    entries[0].isDirectory() &&
    !entries[0].isSymbolicLink()
  ) {
    let root = join(stage, entries[0].name)
    // TorBox's inner archive is extracted into this internal staging directory.
    if (entries[0].name === '.ghost-content') {
      entries = await readdir(root, { withFileTypes: true })
      if (
        entries.length === 1 &&
        entries[0].isDirectory() &&
        !entries[0].isSymbolicLink()
      )
        root = join(root, entries[0].name)
    }
    if (basename(root) !== '.ghost-content')
      name = gameDirectoryName(basename(root))
    if (!candidates.every((file) => inside(root, file)))
      throw new Error('Executável fora da raiz do pacote.')
    const relativeCandidates = candidates.map((file) => relative(root, file))
    const children = await readdir(root)
    let temporary: string
    do {
      temporary = join(stage, `.ghost-unpack-${randomUUID()}`)
    } while (existsSync(temporary) || children.includes(basename(temporary)))
    await rename(root, temporary)
    const wrapper = join(stage, '.ghost-content')
    if (root !== wrapper && existsSync(wrapper)) await rmdir(wrapper)
    for (const child of children)
      await rename(join(temporary, child), join(stage, child))
    await rmdir(temporary)
    nextCandidates = relativeCandidates.map((file) => join(stage, file))
  }
  let directory = join(parent, name)
  let suffix = 2
  while (
    existsSync(directory) ||
    reserved.some((path) => path.toLowerCase() === directory.toLowerCase())
  ) {
    directory = join(parent, `${name} (${suffix++})`)
  }
  if (!inside(parent, directory))
    throw new Error('Pasta de instalação inválida.')
  return { directory, candidates: nextCandidates }
}
