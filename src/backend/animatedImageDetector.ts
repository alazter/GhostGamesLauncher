/**
 * Detector binário ultra-rápido (<0.05ms) de imagens animadas (WebP, APNG e GIF).
 * Inspeciona apenas cabeçalhos/chunks binários sem decodificar pixels.
 */

function isAnimatedWebP(buffer: Buffer): boolean {
  if (buffer.length < 21) return false
  if (
    buffer.subarray(0, 4).toString('latin1') !== 'RIFF' ||
    buffer.subarray(8, 12).toString('latin1') !== 'WEBP'
  ) {
    return false
  }

  const firstChunk = buffer.subarray(12, 16).toString('latin1')
  if (firstChunk === 'VP8X') {
    // RFC 9649 §2.7: Bit 1 (0x02) do byte de flags (offset 20) indica animação WebP
    if ((buffer[20] & 0x02) !== 0) {
      return true
    }
  }

  let offset = 12
  let chunksChecked = 0
  while (offset + 8 <= buffer.length && chunksChecked < 16) {
    const fourCC = buffer.subarray(offset, offset + 4).toString('latin1')
    if (fourCC === 'ANIM' || fourCC === 'ANMF') {
      return true
    }
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const paddedSize = chunkSize + (chunkSize & 1)
    const nextOffset = offset + 8 + paddedSize
    if (nextOffset <= offset) break
    offset = nextOffset
    chunksChecked++
  }

  return false
}

function isAnimatedPng(buffer: Buffer): boolean {
  if (buffer.length < 33) return false
  // Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return false
  }

  let offset = 8
  let chunksChecked = 0
  while (offset + 8 <= buffer.length && chunksChecked < 64) {
    const chunkLen = buffer.readUInt32BE(offset)
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('latin1')
    if (chunkType === 'acTL') {
      return true
    }
    if (chunkType === 'IDAT' || chunkType === 'IEND') {
      return false
    }
    const nextOffset = offset + 12 + chunkLen
    if (nextOffset <= offset) break
    offset = nextOffset
    chunksChecked++
  }

  return false
}

function isAnimatedGif(buffer: Buffer): boolean {
  if (buffer.length < 14) return false
  const header = buffer.subarray(0, 6).toString('latin1')
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return false
  }

  const packed = buffer[10]
  let offset = 13
  if ((packed & 0x80) !== 0) {
    const gctSize = 3 * (1 << ((packed & 0x07) + 1))
    offset += gctSize
  }

  const skipSubBlocks = (pos: number): number => {
    let p = pos
    while (p < buffer.length) {
      const blockLen = buffer[p++]
      if (blockLen === 0) return p
      p += blockLen
    }
    return buffer.length
  }

  let frameCount = 0
  let safetyCounter = 0
  while (offset < buffer.length && safetyCounter < 4096) {
    safetyCounter++
    const introducer = buffer[offset++]
    if (introducer === 0x3b) {
      // Trailer GIF
      break
    }
    if (introducer === 0x21) {
      // Extension block
      if (offset >= buffer.length) break
      offset++ // Extension label
      offset = skipSubBlocks(offset)
    } else if (introducer === 0x2c) {
      // Image Descriptor
      frameCount++
      if (frameCount >= 2) {
        return true
      }
      if (offset + 9 > buffer.length) break
      const imgPacked = buffer[offset + 8]
      offset += 9
      if ((imgPacked & 0x80) !== 0) {
        const lctSize = 3 * (1 << ((imgPacked & 0x07) + 1))
        offset += lctSize
      }
      if (offset >= buffer.length) break
      offset++ // LZW minimum code size
      offset = skipSubBlocks(offset)
    } else {
      break
    }
  }

  return false
}

export function isAnimatedImageBuffer(buffer: Buffer, mime?: string): boolean {
  if (!buffer || buffer.length < 12) return false

  if (mime === 'image/jpeg' || mime === 'image/svg+xml' || mime === 'image/x-icon') {
    return false
  }

  if (mime === 'image/webp' || buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return isAnimatedWebP(buffer)
  }

  if (mime === 'image/gif' || buffer.subarray(0, 4).toString('latin1') === 'GIF8') {
    return isAnimatedGif(buffer)
  }

  if (
    mime === 'image/png' ||
    (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
  ) {
    return isAnimatedPng(buffer)
  }

  return false
}
