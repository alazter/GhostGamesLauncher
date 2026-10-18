import type { EngineRelease } from 'common/types/sourceEngines'

// A portable engine keeps the original ZIP unchanged, so its approved hash still applies.
const magic = Buffer.from('GHOST-ENGINE/1\n')
export const engineArchiveLimit = 250 * 1024 * 1024
const metadataLimit = 16 * 1024

export function isSourceEnginePackage(buffer: Buffer): boolean {
  return buffer.subarray(0, magic.length).equals(magic)
}

export function createSourceEnginePackage(
  release: EngineRelease,
  archive: Buffer
): Buffer {
  const metadata = Buffer.from(JSON.stringify(release), 'utf8')
  if (metadata.length > metadataLimit || archive.length > engineArchiveLimit)
    throw new Error('O pacote do motor excede o tamanho permitido.')
  const length = Buffer.alloc(4)
  length.writeUInt32LE(metadata.length)
  return Buffer.concat([magic, length, metadata, archive])
}

export function readSourceEnginePackage(buffer: Buffer): {
  release: EngineRelease
  archive: Buffer
} {
  if (!isSourceEnginePackage(buffer) || buffer.length < magic.length + 4)
    throw new Error('O arquivo não é um pacote de motor .ghost válido.')
  const length = buffer.readUInt32LE(magic.length)
  const offset = magic.length + 4 + length
  if (
    !length ||
    length > metadataLimit ||
    offset >= buffer.length ||
    buffer.length - offset > engineArchiveLimit
  )
    throw new Error(
      'O pacote do motor está incompleto ou excede o tamanho permitido.'
    )
  let release: EngineRelease
  try {
    release = JSON.parse(
      buffer.subarray(magic.length + 4, offset).toString('utf8')
    )
  } catch {
    throw new Error('Os dados do pacote do motor são inválidos.')
  }
  return { release, archive: buffer.subarray(offset) }
}
