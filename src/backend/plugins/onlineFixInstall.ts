import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, rm } from 'fs/promises'
import { basename, dirname, join, relative } from 'path'
import { randomUUID } from 'crypto'
import { extractGame, regularFiles } from './externalFiles'
import { archivePathIsSafe, inside } from './externalPolicy'
import { ONLINE_FIX_PASSWORD, type OnlineFixDownloadedPackage } from './onlineFixHosters'

export function onlineFixPackageRoots(files: OnlineFixDownloadedPackage[]): OnlineFixDownloadedPackage[] {
  return files.filter(file => !/\.part\d+\.rar$/i.test(file.name) || /\.part0*1\.rar$/i.test(file.name))
}

export async function applyOnlineFixPackages(
  packages: OnlineFixDownloadedPackage[], stage: string, candidates: string[]
): Promise<string[]> {
  // Preserve a legacy package root when updating an installation that has not
  // adopted the flattened layout. Never apply a fix to the installed game.
  let gameRoot = stage
  for (;;) {
    const entries = await readdir(gameRoot, { withFileTypes: true })
    if (entries.length !== 1 || !entries[0].isDirectory() || entries[0].isSymbolicLink()) break
    const child = join(gameRoot, entries[0].name)
    if (!candidates.every(file => inside(child, file))) break
    gameRoot = child
  }
  for (const file of onlineFixPackageRoots(packages).filter(item => item.role === 'fix')) {
    const temporary = join(dirname(stage), `.ghost-fix-${randomUUID()}`)
    await mkdir(temporary)
    try {
      await extractGame(file.archive, temporary, ONLINE_FIX_PASSWORD)
      const extracted = await regularFiles(temporary)
      if (!extracted.length) throw new Error('O pacote do fix está vazio.')
      let root = temporary
      for (;;) {
        const entries = await readdir(root, { withFileTypes: true })
        if (entries.length !== 1 || !entries[0].isDirectory()) break
        // Keep meaningful folders (e.g. x64/Engine) that exist in the game.
        if (existsSync(join(gameRoot, entries[0].name))) break
        root = join(root, entries[0].name)
      }
      for (const source of extracted) {
        const path = relative(root, source).replace(/\\/g, '/')
        if (!archivePathIsSafe(path) || path.split(/[/\\]/).some(part => part.startsWith('.ghost-')))
          throw new Error('O fix contém um caminho reservado ou inválido.')
        const destination = join(gameRoot, path)
        if (!inside(stage, destination)) throw new Error('O fix contém um caminho fora da instalação temporária.')
        await mkdir(dirname(destination), { recursive: true })
        await copyFile(source, destination)
      }
    } finally { await rm(temporary, { recursive: true, force: true }) }
  }
  return (await regularFiles(stage)).filter(file => /\.exe$/i.test(file) &&
    !/^(?:unins.*|setup|installer|install|vcredist.*|dxsetup)\.exe$/i.test(basename(file)))
}
