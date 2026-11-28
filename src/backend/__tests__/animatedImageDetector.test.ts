import { isAnimatedImageBuffer } from '../animatedImageDetector'

function buildPngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, crc])
}

describe('isAnimatedImageBuffer', () => {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  test('detects animated WebP via VP8X animation flag (0x02)', () => {
    const buf = Buffer.alloc(30)
    buf.write('RIFF', 0, 'latin1')
    buf.writeUInt32LE(22, 4)
    buf.write('WEBP', 8, 'latin1')
    buf.write('VP8X', 12, 'latin1')
    buf.writeUInt32LE(10, 16)
    buf[20] = 0x02 // Animation bit set
    expect(isAnimatedImageBuffer(buf, 'image/webp')).toBe(true)
  })

  test('detects static WebP (VP8X without animation flag and no ANIM chunk)', () => {
    const buf = Buffer.alloc(30)
    buf.write('RIFF', 0, 'latin1')
    buf.writeUInt32LE(22, 4)
    buf.write('WEBP', 8, 'latin1')
    buf.write('VP8X', 12, 'latin1')
    buf.writeUInt32LE(10, 16)
    buf[20] = 0x10 // Alpha bit only, no animation
    expect(isAnimatedImageBuffer(buf, 'image/webp')).toBe(false)
  })

  test('detects animated APNG via acTL chunk before IDAT', () => {
    const ihdr = buildPngChunk('IHDR', Buffer.alloc(13))
    const actl = buildPngChunk('acTL', Buffer.alloc(8))
    const idat = buildPngChunk('IDAT', Buffer.alloc(4))
    const iend = buildPngChunk('IEND', Buffer.alloc(0))
    const buf = Buffer.concat([PNG_SIG, ihdr, actl, idat, iend])
    expect(isAnimatedImageBuffer(buf, 'image/png')).toBe(true)
  })

  test('detects static PNG without acTL chunk', () => {
    const ihdr = buildPngChunk('IHDR', Buffer.alloc(13))
    const idat = buildPngChunk('IDAT', Buffer.alloc(4))
    const iend = buildPngChunk('IEND', Buffer.alloc(0))
    const buf = Buffer.concat([PNG_SIG, ihdr, idat, iend])
    expect(isAnimatedImageBuffer(buf, 'image/png')).toBe(false)
  })

  test('detects animated GIF with 2 frames vs static GIF with 1 frame', () => {
    // Minimal GIF89a header (13 bytes, no GCT) + Image Descriptor (10 bytes + LZW min + 0 terminator)
    const header = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      0x01, 0x00, 0x01, 0x00, // 1x1
      0x00, 0x00, 0x00 // no GCT
    ])
    const frame = Buffer.from([
      0x2c, // Image Descriptor
      0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // bounds + no LCT
      0x02, // LZW min code size
      0x00 // 0-length block terminator
    ])
    const trailer = Buffer.from([0x3b])

    const staticGif = Buffer.concat([header, frame, trailer])
    const animatedGif = Buffer.concat([header, frame, frame, trailer])

    expect(isAnimatedImageBuffer(staticGif, 'image/gif')).toBe(false)
    expect(isAnimatedImageBuffer(animatedGif, 'image/gif')).toBe(true)
  })

  test('returns false immediately for JPEG buffers', () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    expect(isAnimatedImageBuffer(jpg, 'image/jpeg')).toBe(false)
  })
})
