import { open, type Entry } from 'yauzl'
import {
  listArchive,
  validateArchiveEntries,
  type ArchiveEntry
} from './archiveReader'

/** Read archive metadata before allocating extracted files. */
export async function archiveSize(
  file: string,
  password?: string
): Promise<number> {
  if (/\.zip$/i.test(file)) {
    try {
      return await new Promise<number>((resolveSize, reject) => {
        open(file, { lazyEntries: true }, (error, zip) => {
          if (error || !zip) {
            reject(error || new Error('Pacote inválido.'))
            return
          }
          const entries: ArchiveEntry[] = []
          zip.on('error', reject)
          zip.on('entry', (entry: Entry) => {
            const type = (entry.externalFileAttributes >>> 16) & 0o170000
            entries.push({
              name: entry.fileName,
              size: entry.uncompressedSize,
              link: Boolean(type && type !== 0o100000 && type !== 0o040000)
            })
            if (entries.length > 200000) {
              zip.close()
              reject(new Error('Limite de extração excedido.'))
            } else zip.readEntry()
          })
          zip.on('end', () => {
            try {
              resolveSize(validateArchiveEntries(entries))
            } catch (error) {
              reject(
                error instanceof Error
                  ? error
                  : new Error('Não foi possível validar o pacote ZIP.')
              )
            }
          })
          zip.readEntry()
        })
      })
    } catch {
      // Updates must support the same ZIP formats as initial installation.
      // The extractor still validates entries before writing any game files.
    }
  }
  return (await listArchive(file, password)).bytes
}
