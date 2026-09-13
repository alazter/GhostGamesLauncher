import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'graceful-fs'
import { join, resolve, relative, dirname, basename } from 'path'
import { createHash } from 'crypto'
import { deflateRawSync, inflateRawSync } from 'zlib'
import type { PluginManifest, PluginPackResult } from 'common/types/plugins'

const ID_REGEX = /^[a-zA-Z0-9._-]+$/

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c
}

function calculateCrc32(buf: Buffer): number {
  let crc = 0 ^ -1
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

export class PluginPacker {
  static validateManifest(raw: any): PluginManifest {
    if (!raw || typeof raw !== 'object') {
      throw new Error('plugin.json is missing or not a valid JSON object.')
    }
    if (!raw.id || typeof raw.id !== 'string' || !ID_REGEX.test(raw.id)) {
      throw new Error(`Invalid plugin id "${raw.id}". Plugin ID must contain only letters, numbers, dots, dashes, and underscores.`)
    }
    if (!raw.name || typeof raw.name !== 'string') {
      throw new Error('Plugin manifest must contain a valid "name".')
    }
    if (!raw.version || typeof raw.version !== 'string') {
      throw new Error('Plugin manifest must contain a valid "version".')
    }
    const validTypes = ['ui', 'theme', 'layout', 'game-source', 'utility', 'metadata']
    if (!validTypes.includes(raw.type)) {
      throw new Error(`Invalid plugin type "${raw.type}". Valid types: ${validTypes.join(', ')}`)
    }
    if (!Array.isArray(raw.permissions)) {
      raw.permissions = []
    }

    return {
      id: raw.id,
      name: raw.name,
      version: raw.version,
      description: raw.description || '',
      author: raw.author || 'Community',
      type: raw.type,
      entrypoint: raw.entrypoint || 'index.js',
      style: raw.style,
      icon: raw.icon,
      permissions: raw.permissions,
      allowedDomains: Array.isArray(raw.allowedDomains) ? raw.allowedDomains : [],
      tier: raw.tier === 1 ? 1 : 2,
      homepage: raw.homepage,
      minGhostVersion: raw.minGhostVersion
    }
  }

  static createZipBuffer(files: Array<{ name: string; content: Buffer }>): Buffer {
    const localHeaders: Buffer[] = []
    const centralHeaders: Buffer[] = []
    let offset = 0

    for (const file of files) {
      const nameBuffer = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8')
      const content = file.content
      const compressed = deflateRawSync(content)
      const crc = calculateCrc32(content)

      // Local Header (30 bytes)
      const localHeader = Buffer.alloc(30)
      localHeader.writeUInt32LE(0x04034b50, 0)
      localHeader.writeUInt16LE(20, 4)
      localHeader.writeUInt16LE(0, 6)
      localHeader.writeUInt16LE(8, 8) // Deflate
      localHeader.writeUInt16LE(0, 10)
      localHeader.writeUInt16LE(0, 12)
      localHeader.writeUInt32LE(crc, 14)
      localHeader.writeUInt32LE(compressed.length, 18)
      localHeader.writeUInt32LE(content.length, 22)
      localHeader.writeUInt16LE(nameBuffer.length, 26)
      localHeader.writeUInt16LE(0, 28)

      localHeaders.push(localHeader, nameBuffer, compressed)

      // Central Header (46 bytes)
      const centralHeader = Buffer.alloc(46)
      centralHeader.writeUInt32LE(0x02014b50, 0)
      centralHeader.writeUInt16LE(20, 4)
      centralHeader.writeUInt16LE(20, 6)
      centralHeader.writeUInt16LE(0, 8)
      centralHeader.writeUInt16LE(8, 10)
      centralHeader.writeUInt16LE(0, 12)
      centralHeader.writeUInt16LE(0, 14)
      centralHeader.writeUInt32LE(crc, 16)
      centralHeader.writeUInt32LE(compressed.length, 20)
      centralHeader.writeUInt32LE(content.length, 24)
      centralHeader.writeUInt16LE(nameBuffer.length, 28)
      centralHeader.writeUInt16LE(0, 30)
      centralHeader.writeUInt16LE(0, 32)
      centralHeader.writeUInt16LE(0, 34)
      centralHeader.writeUInt16LE(0, 36)
      centralHeader.writeUInt32LE(0, 38)
      centralHeader.writeUInt32LE(offset, 42)

      centralHeaders.push(centralHeader, nameBuffer)
      offset += 30 + nameBuffer.length + compressed.length
    }

    const centralDirOffset = offset
    const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0)

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(0, 4)
    eocd.writeUInt16LE(0, 6)
    eocd.writeUInt16LE(files.length, 8)
    eocd.writeUInt16LE(files.length, 10)
    eocd.writeUInt32LE(centralDirSize, 12)
    eocd.writeUInt32LE(centralDirOffset, 16)
    eocd.writeUInt16LE(0, 20)

    return Buffer.concat([...localHeaders, ...centralHeaders, eocd])
  }

  static extractZipBuffer(zipBuffer: Buffer, destDir: string): void {
    let offset = 0
    const resolvedDest = resolve(destDir)
    mkdirSync(resolvedDest, { recursive: true })

    while (offset < zipBuffer.length - 4) {
      const sig = zipBuffer.readUInt32LE(offset)
      if (sig === 0x04034b50) {
        const compMethod = zipBuffer.readUInt16LE(offset + 8)
        const compSize = zipBuffer.readUInt32LE(offset + 18)
        const nameLen = zipBuffer.readUInt16LE(offset + 26)
        const extraLen = zipBuffer.readUInt16LE(offset + 28)

        const fileName = zipBuffer.toString('utf8', offset + 30, offset + 30 + nameLen)
        const dataStart = offset + 30 + nameLen + extraLen
        const dataEnd = dataStart + compSize
        const compressedData = zipBuffer.subarray(dataStart, dataEnd)

        // Zip Slip Security Protection
        const filePath = resolve(resolvedDest, fileName)
        if (!filePath.startsWith(resolvedDest)) {
          throw new Error(`[GhostShield Security Alert] Malicious path traversal detected: "${fileName}"`)
        }

        if (fileName.endsWith('/')) {
          mkdirSync(filePath, { recursive: true })
        } else {
          let uncompressedData: Buffer
          if (compMethod === 0) {
            uncompressedData = compressedData
          } else if (compMethod === 8) {
            uncompressedData = inflateRawSync(compressedData)
          } else {
            throw new Error(`Unsupported zip compression method: ${compMethod}`)
          }

          mkdirSync(dirname(filePath), { recursive: true })
          writeFileSync(filePath, uncompressedData)
        }

        offset = dataEnd
      } else {
        break
      }
    }
  }

  static async pack(sourceDir: string, outputPath?: string): Promise<PluginPackResult> {
    try {
      const manifestPath = join(sourceDir, 'plugin.json')
      if (!existsSync(manifestPath)) {
        return { success: false, error: 'Directory does not contain a "plugin.json" manifest.' }
      }

      const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const manifest = this.validateManifest(rawManifest)

      const filesToPack: Array<{ name: string; content: Buffer }> = []
      const fileChecksums: Record<string, string> = {}

      function scan(currentDir: string, baseDir: string) {
        const entries = readdirSync(currentDir)
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === '.git' || entry === 'checksum.json' || entry.endsWith('.ghost')) {
            continue
          }
          const fullPath = join(currentDir, entry)
          const relPath = relative(baseDir, fullPath).replace(/\\/g, '/')
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            scan(fullPath, baseDir)
          } else if (stat.isFile()) {
            const buf = readFileSync(fullPath)
            const hash = createHash('sha256').update(buf).digest('hex')
            fileChecksums[relPath] = hash
            filesToPack.push({ name: relPath, content: buf })
          }
        }
      }

      scan(sourceDir, sourceDir)

      // Add checksum.json
      const checksumBuf = Buffer.from(JSON.stringify(fileChecksums, null, 2), 'utf8')
      filesToPack.push({ name: 'checksum.json', content: checksumBuf })

      const zipBuf = this.createZipBuffer(filesToPack)
      const targetPath = outputPath || join(sourceDir, `${manifest.id}-v${manifest.version}.ghost`)
      mkdirSync(dirname(targetPath), { recursive: true })
      writeFileSync(targetPath, zipBuf)

      return { success: true, outputPath: targetPath }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }

  static unpack(ghostFilePath: string, destDir: string): { manifest: PluginManifest; checksum: string } {
    if (!existsSync(ghostFilePath)) {
      throw new Error(`File not found: "${ghostFilePath}"`)
    }

    const zipBuffer = readFileSync(ghostFilePath)
    return this.unpackFromBuffer(zipBuffer, destDir)
  }

  static unpackFromBuffer(zipBuffer: Buffer, destDir: string): { manifest: PluginManifest; checksum: string } {
    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true })
    }
    mkdirSync(destDir, { recursive: true })

    this.extractZipBuffer(zipBuffer, destDir)

    const manifestPath = join(destDir, 'plugin.json')
    if (!existsSync(manifestPath)) {
      throw new Error('Unpacked package does not contain a "plugin.json" manifest.')
    }

    const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const manifest = this.validateManifest(rawManifest)

    const overallHash = createHash('sha256').update(zipBuffer).digest('hex')
    return { manifest, checksum: overallHash }
  }

  static loadUnpacked(sourceDir: string, destDir: string): PluginManifest {
    const manifestPath = join(sourceDir, 'plugin.json')
    if (!existsSync(manifestPath)) {
      throw new Error('Directory does not contain a "plugin.json" manifest.')
    }

    const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const manifest = this.validateManifest(rawManifest)

    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true })
    }
    mkdirSync(destDir, { recursive: true })

    // Copy files recursively
    function copyDir(src: string, dst: string) {
      mkdirSync(dst, { recursive: true })
      for (const entry of readdirSync(src)) {
        if (entry === 'node_modules' || entry === '.git') continue
        const sPath = join(src, entry)
        const dPath = join(dst, entry)
        const stat = statSync(sPath)
        if (stat.isDirectory()) {
          copyDir(sPath, dPath)
        } else {
          copyFileSync(sPath, dPath)
        }
      }
    }

    copyDir(sourceDir, destDir)
    return manifest
  }
}
