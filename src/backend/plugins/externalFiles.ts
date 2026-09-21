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
import { dirname, join, resolve } from 'path'
import { execFile } from 'child_process'
import extract from 'extract-zip'
import { archivePathIsSafe, inside } from './externalPolicy'

let cached7zPath: string | null = null

export async function resolve7zPath(): Promise<string | null> {
  if (cached7zPath !== null) return cached7zPath
  const candidates = [
    '7z',
    '7z.exe',
    join(process.env.USERPROFILE || '', 'scoop', 'shims', '7z.exe'),
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    join(process.env.LOCALAPPDATA || '', 'Programs', '7-Zip', '7z.exe')
  ]
  for (const candidate of candidates) {
    try {
      if (candidate === '7z' || candidate === '7z.exe') {
        const works = await new Promise<boolean>((res) => {
          execFile(candidate, ['--help'], (err) => res(!err))
        })
        if (works) {
          cached7zPath = candidate
          return candidate
        }
        continue
      }
      if (existsSync(candidate)) {
        cached7zPath = candidate
        return candidate
      }
    } catch {
      // continue
    }
  }
  return null
}

async function extractWith7z(file: string, destination: string, password?: string): Promise<void> {
  const sevenZip = await resolve7zPath()
  if (!sevenZip) {
    throw new Error('Instale o 7-Zip para extrair arquivos RAR/7Z ou pacotes protegidos por senha.')
  }
  const passwordArgs = password ? [`-p${password}`] : []
  if (password) {
    // Inspect encrypted headers before allowing the extractor to write any files.
    const listing = await new Promise<string>((res, rej) => {
      execFile(sevenZip, ['l', '-slt', '-ba', '-sccUTF-8', ...passwordArgs, '--', resolve(file)],
        { maxBuffer: 32 * 1024 * 1024, timeout: 60000 }, (error, stdout) => {
          if (error) rej(new Error('Não foi possível abrir o pacote com a senha padrão do Online-Fix. O arquivo pode estar incompleto ou usar outra senha.'))
          else res(stdout)
        })
    })
    const disk = await statfs(dirname(destination))
    let bytes = 0
    const seen = new Set<string>()
    for (const block of listing.trim().split(/\r?\n\r?\n/)) {
      const fields = Object.fromEntries(block.split(/\r?\n/).map(line => {
        const separator = line.indexOf(' = ')
        return [line.slice(0, separator), line.slice(separator + 3)]
      }))
      const name = fields.Path?.replace(/\\/g, '/')
      if (!name || !archivePathIsSafe(name) || !inside(destination, join(destination, name)) ||
        fields['Symbolic Link'] || fields['Hard Link'] || /(?:^|\s)l[rwx-]{9}/.test(fields.Attributes || ''))
        throw new Error('O pacote contém caminho inseguro ou link. Extração interrompida.')
      const key = name.toLowerCase().replace(/\/$/, '')
      if (seen.has(key)) throw new Error('O pacote contém caminhos duplicados.')
      seen.add(key)
      const size = Number(fields.Size || 0)
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('Tamanho inválido no pacote.')
      bytes += size
      if (bytes > disk.bavail * disk.bsize || bytes > 1024 ** 4 || seen.size > 200000)
        throw new Error('Espaço insuficiente ou limite de extração excedido.')
    }
  }
  return new Promise((res, rej) => {
    execFile(sevenZip, ['x', `-o${resolve(destination)}`, '-y', '-aoa', ...passwordArgs, '--', resolve(file)], (error, _stdout, stderr) => {
      if (error) {
        if (password) return rej(new Error('Falha ao extrair o pacote Online-Fix. Confira se o arquivo está completo e usa a senha padrão online-fix.me.'))
        return rej(new Error(`Falha na extração com 7-Zip: ${error.message} (${stderr || ''})`))
      }
      res()
    })
  })
}

export async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

export async function regularFiles(root: string): Promise<string[]> {
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
    await extractWith7z(file, destination, password)
  } else {
    // Para .zip, utiliza o motor extract-zip com validação atômica de cada entrada
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
      // Fallback para 7z APENAS se o zip tiver compressão estendida não suportada pelo extract-zip
      const errMsg = String(zipErr).toLowerCase()
      const isSecurityOrSpaceErr =
        errMsg.includes('caminho') ||
        errMsg.includes('inseguro') ||
        errMsg.includes('out of bound') ||
        errMsg.includes('traversal') ||
        errMsg.includes('espaço') ||
        errMsg.includes('insuficiente') ||
        errMsg.includes('duplicado') ||
        errMsg.includes('criptografado') ||
        errMsg.includes('limite')

      const sevenZip = await resolve7zPath()
      if (password && (errMsg.includes('encrypted') || errMsg.includes('criptografado'))) {
        await extractWith7z(file, destination, password)
      } else if (sevenZip && !isSecurityOrSpaceErr && (errMsg.includes('compression') || errMsg.includes('unsupported') || errMsg.includes('method'))) {
        await extractWith7z(file, destination, password)
      } else {
        throw zipErr
      }
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
