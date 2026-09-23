import { open } from 'yauzl'
import { execFile } from 'child_process'
import { resolve } from 'path'
import { resolve7zPath } from './externalFiles'

/** Read archive metadata before allocating extracted files. */
export async function archiveSize(
  file: string,
  password?: string
): Promise<number> {
  if (/\.zip$/i.test(file)) {
    return new Promise<number>((resolveSize, reject) => {
      open(file, { lazyEntries: true }, (error, zip) => {
        if (error || !zip) {
          reject(error || new Error('Pacote inválido.'))
          return
        }
        let total = 0
        zip.on('error', reject)
        zip.on('entry', (entry) => {
          total += entry.uncompressedSize
          if (!Number.isSafeInteger(total) || total > 1024 ** 4) {
            zip.close()
            reject(new Error('Limite de extração excedido.'))
          } else zip.readEntry()
        })
        zip.on('end', () => resolveSize(total))
        zip.readEntry()
      })
    })
  }
  const sevenZip = await resolve7zPath()
  if (!sevenZip)
    throw new Error('Instale o 7-Zip para verificar e extrair este pacote.')
  const listing = await new Promise<string>((res, rej) => {
    execFile(
      sevenZip,
      [
        'l',
        '-slt',
        '-ba',
        '-sccUTF-8',
        password ? `-p${password}` : '-p-',
        '--',
        resolve(file)
      ],
      { timeout: 60000, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout) => {
        if (error)
          rej(
            new Error(
              'Não foi possível verificar o tamanho do pacote antes da extração.'
            )
          )
        else res(stdout)
      }
    )
  })
  let total = 0
  for (const match of listing.matchAll(/^Size = (\d+)\r?$/gm))
    total += Number(match[1])
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1024 ** 4)
    throw new Error('Tamanho de extração inválido.')
  return total
}
