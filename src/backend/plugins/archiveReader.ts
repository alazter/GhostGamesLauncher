import { execFile } from 'child_process'
import { resolve } from 'path'
import { archivePathIsSafe } from './externalPolicy'
import {
  resolve7zPath,
  resolveUnrarPath,
  type ArchiveTool
} from './archiveTools'

export interface ArchiveEntry {
  name: string
  size: number
  link?: boolean
}

export async function archiveCommand(
  tool: ArchiveTool,
  args: string[],
  listing = false
): Promise<string> {
  return new Promise((done, fail) => {
    const child = execFile(
      tool.path,
      args,
      {
        encoding: 'buffer',
        windowsHide: true,
        maxBuffer: listing ? 32 * 1024 * 1024 : 2 * 1024 * 1024,
        ...(listing ? { timeout: 60000 } : {})
      },
      (error, stdout) => {
        if (error) {
          // Never include the command line: it may contain the archive password.
          const code = 'code' in error ? String(error.code) : ''
          fail(
            new Error(
              code === 'ENOSPC'
                ? 'Espaço insuficiente para extrair o pacote.'
                : `Não foi possível ${listing ? 'ler' : 'extrair'} o pacote com ${tool.kind === '7zip' ? '7-Zip' : 'WinRAR'}. Confira se o arquivo está completo, se todas as partes estão juntas e se a senha está correta.${code ? ` Código: ${code}.` : ''}`
            )
          )
        } else
          done(
            tool.kind === 'winrar'
              ? stdout.toString('utf16le').replace(/^\uFEFF/, '')
              : stdout.toString('utf8')
          )
      }
    )
    child.stdin?.end()
  })
}

export function parseArchiveListing(
  output: string,
  kind: ArchiveTool['kind']
): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  for (const block of output.trim().split(/\r?\n\s*\r?\n/)) {
    const fields = Object.fromEntries(
      block.split(/\r?\n/).flatMap((line) => {
        const separator =
          kind === '7zip' ? line.indexOf(' = ') : line.indexOf(':')
        return separator < 0
          ? []
          : [
              [
                line.slice(0, separator).trim(),
                line.slice(separator + (kind === '7zip' ? 3 : 1)).trim()
              ]
            ]
      })
    )
    const raw = kind === '7zip' ? fields.Path : (fields.Name ?? fields.Nome)
    if (raw === undefined) {
      if (kind === '7zip' && block.trim())
        throw new Error(
          'Não foi possível interpretar a lista de arquivos do pacote.'
        )
      continue // UnRAR's localized archive header is not a file entry.
    }
    const type = fields.Type ?? fields.Tipo ?? ''
    const knownRarType = /^(?:File|Directory|Arquivo|Diretório|Pasta)$/i.test(
      type
    )
    const size = kind === '7zip' ? fields.Size : (fields.Size ?? fields.Tamanho)
    if (
      kind === 'winrar' &&
      (!knownRarType ||
        (size === undefined && !/Directory|Diretório|Pasta/i.test(type)))
    )
      throw new Error(
        'O pacote contém um link ou uma entrada que o WinRAR não pôde validar. Tente com o 7-Zip atualizado.'
      )
    entries.push({
      name: raw.replace(/\\/g, '/'),
      size: Number(size || 0),
      link: Boolean(
        fields['Symbolic Link'] ||
        fields['Hard Link'] ||
        (kind === 'winrar' &&
          Object.keys(fields).some((key) =>
            /link|redire|refer[eê]ncia|target|alvo/i.test(key)
          )) ||
        /(?:^|\s)l[rwx-]{9}/.test(fields.Attributes || '')
      )
    })
  }
  validateArchiveEntries(entries)
  return entries
}

export function validateArchiveEntries(entries: ArchiveEntry[]): number {
  let total = 0
  const seen = new Set<string>()
  for (const entry of entries) {
    if (
      !archivePathIsSafe(entry.name) ||
      /[\r\n\0]/.test(entry.name) ||
      entry.link
    )
      throw new Error(
        'O pacote contém caminho inseguro ou link. Extração interrompida.'
      )
    const key = entry.name.toLowerCase().replace(/\/$/, '')
    if (seen.has(key)) throw new Error('O pacote contém caminhos duplicados.')
    seen.add(key)
    if (!Number.isSafeInteger(entry.size) || entry.size < 0)
      throw new Error('Tamanho inválido no pacote.')
    total += entry.size
    if (!Number.isSafeInteger(total) || total > 1024 ** 4 || seen.size > 200000)
      throw new Error('Limite de extração excedido.')
  }
  if (!entries.length)
    throw new Error(
      'O pacote está vazio ou sua lista de arquivos não pôde ser validada.'
    )
  return total
}

export async function listArchive(file: string, password?: string) {
  const sevenZip = await resolve7zPath()
  const unrar =
    !sevenZip && /\.rar$/i.test(file) ? await resolveUnrarPath() : null
  const tool: ArchiveTool | undefined = sevenZip
    ? { kind: '7zip', path: sevenZip }
    : unrar
      ? { kind: 'winrar', path: unrar }
      : undefined
  if (!tool)
    throw new Error(
      /\.rar$/i.test(file)
        ? 'Instale o 7-Zip ou o WinRAR para extrair este arquivo RAR. O Ghost não encontrou o descompactador.'
        : 'Instale o 7-Zip para extrair arquivos 7Z e pacotes ZIP protegidos ou com compressão especial. O Ghost não encontrou o descompactador.'
    )
  const passwordArg = password ? `-p${password}` : '-p-'
  const args =
    tool.kind === '7zip'
      ? ['l', '-slt', '-ba', '-sccUTF-8', passwordArg, '--', resolve(file)]
      : ['lt', '-c-', '-cfg-', '-scu', passwordArg, '--', resolve(file)]
  const entries = parseArchiveListing(
    await archiveCommand(tool, args, true),
    tool.kind
  )
  return { tool, entries, bytes: validateArchiveEntries(entries) }
}
