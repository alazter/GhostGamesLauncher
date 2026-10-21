import { createReadStream, existsSync } from 'fs'
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  statfs,
  writeFile
} from 'fs/promises'
import { createHash } from 'crypto'
import { dirname, join, resolve, sep } from 'path'
import { listArchive, archiveCommand } from './archiveReader'
export { resolve7zPath } from './archiveTools'
import { resolve7zPath } from './archiveTools'
import { archivePathIsSafe, inside } from './externalPolicy'

type ExtractZipType = (
  zipPath: string,
  opts: {
    dir: string
    defaultDirMode?: number
    defaultFileMode?: number
    onEntry?: (entry: any) => void
  }
) => Promise<void>

let cachedExtractZip: ExtractZipType | null = null

async function getExtractZip(): Promise<ExtractZipType | null> {
  if (cachedExtractZip) return cachedExtractZip
  try {
    const req = typeof require !== 'undefined' ? require : null
    if (req) {
      const mod = req('extract-zip')
      cachedExtractZip = ((mod && mod.default) || mod) as ExtractZipType
      if (typeof cachedExtractZip === 'function') return cachedExtractZip
    }
  } catch {}
  try {
    const mod = await import('extract-zip')
    cachedExtractZip = ((mod as any).default || mod) as ExtractZipType
    if (typeof cachedExtractZip === 'function') return cachedExtractZip
  } catch {}
  return null
}

async function extractWithArchiveTool(file: string, destination: string, password?: string): Promise<void> {
  const { tool, entries, bytes } = await listArchive(file, password)
  const disk = await statfs(dirname(destination))
  if (bytes > disk.bavail * disk.bsize)
    throw new Error('Espaço insuficiente para extrair o pacote. A instalação anterior foi preservada.')
  for (const entry of entries) if (!inside(destination, join(destination, entry.name)))
    throw new Error('O pacote contém caminho inseguro. Extração interrompida.')
  const passwordArg = password ? `-p${password}` : '-p-'
  await archiveCommand(tool, tool.kind === '7zip'
    ? ['x', `-o${resolve(destination)}`, '-y', '-aoa', passwordArg, '--', resolve(file)]
    : ['x', '-y', '-o+', '-idq', '-cfg-', '-scu', passwordArg, '--', resolve(file), resolve(destination) + sep])
}

export async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

export async function regularFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return []
  const paths: string[] = []
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink())
        throw new Error(
          'A pasta contém um link simbólico. Selecione uma pasta de saves sem links.'
        )
      if (!inside(root, await realpath(path)))
        throw new Error('Arquivo fora da pasta selecionada.')
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) paths.push(path)
      else throw new Error('Tipo de arquivo não suportado.')
      if (paths.length > 100000)
        throw new Error('A pasta contém arquivos demais.')
    }
  }
  if ((await lstat(root)).isSymbolicLink())
    throw new Error('Links simbólicos não são permitidos.')
  await walk(root)
  return paths
}

export async function extractGame(
  file: string,
  destination: string,
  password?: string,
  platform: 'windows' | 'switch' = 'windows'
): Promise<string[]> {
  const isRarOr7z = /\.(rar|7z|tar|gz|bz2|xz|iso)$/i.test(file)

  if (isRarOr7z) {
    await extractWithArchiveTool(file, destination, password)
  } else {
    // Para .zip, tenta o motor extract-zip com validação atômica; caso indisponível, usa 7-Zip
    const extract = await getExtractZip()
    if (extract) {
      try {
        let bytes = 0
        const disk = await statfs(dirname(destination))
        const available = disk.bavail * disk.bsize
        const seen = new Set<string>()
        await extract(file, {
          dir: resolve(destination),
          onEntry: (entry) => {
            const name = entry.fileName
            const type = (entry.externalFileAttributes >>> 16) & 0o170000
            if (
              !archivePathIsSafe(name) ||
              !inside(destination, join(destination, name)) ||
              (type && type !== 0o100000 && type !== 0o040000) ||
              entry.generalPurposeBitFlag & 1
            ) {
              throw new Error(
                'ZIP contém caminho inseguro, link ou arquivo criptografado. Extraia manualmente e confira o pacote.'
              )
            }
            const key = name.toLowerCase()
            if (seen.has(key)) throw new Error('ZIP contém caminhos duplicados.')
            seen.add(key)
            bytes += entry.uncompressedSize
            if (bytes > available)
              throw new Error(
                'Espaço insuficiente para extrair o pacote. A instalação anterior foi preservada.'
              )
            if (bytes > 1024 ** 4 || seen.size > 200000)
              throw new Error('Limite de extração excedido.')
          }
        })
      } catch (zipErr) {
        // Fallback para 7z se o zip tiver compressão estendida, criptografia ou recurso não suportado pelo extract-zip
        const errMsg = String(zipErr).toLowerCase()
        const isSecurityOrSpaceErr =
          errMsg.includes('caminho') ||
          errMsg.includes('inseguro') ||
          errMsg.includes('out of bound') ||
          errMsg.includes('traversal') ||
          errMsg.includes('espaço') ||
          errMsg.includes('insuficiente') ||
          errMsg.includes('duplicado') ||
          errMsg.includes('limite')

        const sevenZip = await resolve7zPath()
        if (password && (errMsg.includes('encrypted') || errMsg.includes('criptografado'))) {
          await extractWithArchiveTool(file, destination, password)
        } else if (sevenZip && !isSecurityOrSpaceErr) {
          await extractWithArchiveTool(file, destination, password)
        } else {
          throw zipErr
        }
      }
    } else {
      // Se extract-zip não estiver disponível no runtime, utiliza o 7-Zip diretamente
      await extractWithArchiveTool(file, destination, password)
    }
  }

  const files = await regularFiles(destination)
  if (platform === 'switch') return files.filter(file => /\.(nsp|xci|nsz|xcz)$/i.test(file))
  return files.filter(
    (f) =>
      /\.exe$/i.test(f) &&
      !/(?:^|[/\\])(?:unins[^/\\]*|setup|install|vcredist[^/\\]*|dxsetup)\.exe$/i.test(
        f
      )
  )
}

export interface SaveManifest {
  files: Array<{ path: string; sha256: string; bytes: number }>
}

export async function copySaveSnapshot(
  source: string,
  destination: string
): Promise<SaveManifest> {
  if (
    inside(source, destination) ||
    inside(destination, source) ||
    resolve(source) === resolve(destination)
  ) {
    throw new Error('O backup deve ficar fora da pasta de saves.')
  }
  const files = await regularFiles(source)
  if (!files.length) {
    const manifest: SaveManifest = { files: [] }
    await writeFile(
      join(destination, '.ghost-save-manifest.json'),
      JSON.stringify(manifest)
    )
    return manifest
  }
  const manifest: SaveManifest = { files: [] }
  for (const file of files) {
    const path = file.slice(resolve(source).length + 1).replace(/\\/g, '/')
    if (!archivePathIsSafe(path)) throw new Error('Caminho de save inválido.')
    const target = join(destination, path)
    await mkdir(dirname(target), { recursive: true })
    await cp(file, target, {
      dereference: false,
      errorOnExist: true,
      force: false
    })
    const sha256 = await hashFile(file)
    if (sha256 !== (await hashFile(target)))
      throw new Error(
        'O save mudou durante o backup. Feche o jogo e tente novamente.'
      )
    manifest.files.push({ path, sha256, bytes: (await lstat(target)).size })
  }
  await writeFile(
    join(destination, '.ghost-save-manifest.json'),
    JSON.stringify(manifest)
  )
  return manifest
}

export async function restoreSaveSnapshot(
  snapshot: string,
  destination: string
): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(snapshot, '.ghost-save-manifest.json'), 'utf8')
  ) as SaveManifest
  // Validate the entire snapshot before writing any live save.
  for (const file of manifest.files) {
    if (
      !archivePathIsSafe(file.path) ||
      !inside(snapshot, join(snapshot, file.path)) ||
      (await hashFile(join(snapshot, file.path))) !== file.sha256
    )
      throw new Error('Backup inválido ou corrompido.')
  }
  await mkdir(destination, { recursive: true })
  await regularFiles(destination)
  for (const file of manifest.files) {
    const target = join(destination, file.path)
    if (!inside(destination, target))
      throw new Error('Destino de save inválido.')
    await mkdir(dirname(target), { recursive: true })
    await cp(join(snapshot, file.path), target)
  }
}
