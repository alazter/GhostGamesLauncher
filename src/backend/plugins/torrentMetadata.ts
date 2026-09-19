import { createHash } from 'crypto'

// Hash the original bencoded info bytes, not a decoded/re-encoded dictionary.
export function torrentInfoHash(data: Buffer): string {
  if (!data.length || data.length > 16 * 1024 * 1024 || data[0] !== 100)
    throw new Error('O AnkerGames não retornou um arquivo torrent válido.')
  let cursor = 0
  let info: Buffer | undefined
  function string(): Buffer {
    const colon = data.indexOf(58, cursor)
    if (colon < 0 || colon - cursor > 9) throw new Error('Torrent inválido.')
    const size = data.subarray(cursor, colon).toString('ascii')
    if (!/^(0|[1-9]\d*)$/.test(size)) throw new Error('Torrent inválido.')
    cursor = colon + 1
    const end = cursor + Number(size)
    if (end > data.length) throw new Error('Torrent incompleto.')
    const value = data.subarray(cursor, end)
    cursor = end
    return value
  }
  function value(depth: number): void {
    if (depth > 64 || cursor >= data.length)
      throw new Error('Torrent inválido.')
    const type = data[cursor]
    if (type === 100 || type === 108) {
      cursor++
      const keys = new Set<string>()
      while (data[cursor] !== 101) {
        let key: string | undefined
        if (type === 100) {
          key = string().toString('hex')
          if (keys.has(key)) throw new Error('Torrent com chaves duplicadas.')
          keys.add(key)
        }
        const start = cursor
        value(depth + 1)
        if (depth === 0 && key === '696e666f') {
          if (data[start] !== 100)
            throw new Error('Torrent sem metadados válidos.')
          info = data.subarray(start, cursor)
        }
      }
      cursor++
    } else if (type === 105) {
      const end = data.indexOf(101, ++cursor)
      if (
        end < 0 ||
        !/^(0|-?[1-9]\d*)$/.test(data.subarray(cursor, end).toString())
      )
        throw new Error('Torrent inválido.')
      cursor = end + 1
    } else string()
  }
  value(0)
  if (!info || cursor !== data.length)
    throw new Error('Torrent incompleto ou inválido.')
  return createHash('sha1').update(info).digest('hex')
}
