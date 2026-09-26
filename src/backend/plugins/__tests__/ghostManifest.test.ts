import { mkdirSync, rmSync, writeFileSync } from 'graceful-fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import {
  writeGhostManifest,
  readGhostManifest,
  findManifestForExecutable,
  GHOST_MANIFEST_FILENAME,
  GHOST_SIGNATURE
} from '../ghostManifest'

describe('Ghost Game Manifest - Integridade e Identificador Único Universal', () => {
  let testBaseDir: string

  beforeEach(() => {
    testBaseDir = join(tmpdir(), `ghost-manifest-test-${randomUUID()}`)
    mkdirSync(testBaseDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testBaseDir, { recursive: true, force: true })
    } catch {}
  })

  test('grava e lê manifesto oficial com assinatura GHOST-VERIFIED-V1', () => {
    const success = writeGhostManifest(testBaseDir, {
      ghostAppId: 'external-test-123',
      title: 'Assassin\'s Creed Black Flag',
      version: 'v1.0.4',
      storeId: 'ankergames',
      storeName: 'AnkerGames',
      storePageUrl: 'https://ankergames.net/game/ac-black-flag',
      installedAt: '2026-09-26T00:00:00.000Z',
      coverUrl: 'https://images.ghost.io/covers/ac-black-flag.jpg',
      saveBackupId: 'backup-uuid-456'
    })

    expect(success).toBe(true)

    const manifest = readGhostManifest(testBaseDir)
    expect(manifest).not.toBeNull()
    expect(manifest?.schemaVersion).toBe(1)
    expect(manifest?.ghostSignature).toBe(GHOST_SIGNATURE)
    expect(manifest?.title).toBe('Assassin\'s Creed Black Flag')
    expect(manifest?.version).toBe('v1.0.4')
    expect(manifest?.storeId).toBe('ankergames')
    expect(manifest?.storeName).toBe('AnkerGames')
    expect(manifest?.storePageUrl).toBe('https://ankergames.net/game/ac-black-flag')
    expect(manifest?.coverUrl).toBe('https://images.ghost.io/covers/ac-black-flag.jpg')
    expect(manifest?.saveBackupId).toBe('backup-uuid-456')
  })

  test('desserializa seguramente mesmo com prefixo UTF-8 BOM (\\uFEFF)', () => {
    const manifestPath = join(testBaseDir, GHOST_MANIFEST_FILENAME)
    const validJson = JSON.stringify({
      schemaVersion: 1,
      ghostSignature: GHOST_SIGNATURE,
      ghostAppId: 'sideload-bom-game',
      title: 'Game with BOM',
      version: '1.2.3',
      storeId: 'steamrip',
      storeName: 'SteamRIP',
      installedAt: new Date().toISOString()
    })

    // Escreve com UTF-8 BOM
    writeFileSync(manifestPath, '\uFEFF' + validJson, 'utf8')

    const manifest = readGhostManifest(testBaseDir)
    expect(manifest).not.toBeNull()
    expect(manifest?.title).toBe('Game with BOM')
    expect(manifest?.version).toBe('1.2.3')
    expect(manifest?.storeName).toBe('SteamRIP')
  })

  test('rejeita manifestos sem assinatura oficial do Ghost', () => {
    const manifestPath = join(testBaseDir, GHOST_MANIFEST_FILENAME)
    const invalidJson = JSON.stringify({
      schemaVersion: 1,
      ghostSignature: 'UNVERIFIED-FAKE-SIGNATURE',
      ghostAppId: 'fake-game',
      title: 'Fake Game',
      version: '1.0',
      storeId: 'unknown',
      storeName: 'Unknown'
    })

    writeFileSync(manifestPath, invalidJson, 'utf8')

    const manifest = readGhostManifest(testBaseDir)
    expect(manifest).toBeNull()
  })

  test('findManifestForExecutable encontra manifesto em estrutura profunda (Binaries/Win64/game.exe)', () => {
    // Cria estrutura: testBaseDir / GameRoot / Binaries / Win64 / game.exe
    const gameRootDir = join(testBaseDir, 'AC_BlackFlag')
    const deepSubDir = join(gameRootDir, 'Binaries', 'Win64')
    mkdirSync(deepSubDir, { recursive: true })

    const fakeExe = join(deepSubDir, 'BlackFlag.exe')
    writeFileSync(fakeExe, 'binary content')

    // Grava o manifesto na raiz do jogo
    writeGhostManifest(gameRootDir, {
      ghostAppId: 'ac-black-flag-manifest',
      title: 'Assassin\'s Creed IV Black Flag',
      version: 'v1.0.4',
      storeId: 'ankergames',
      storeName: 'AnkerGames',
      installedAt: new Date().toISOString()
    })

    // Localiza a partir do executável aninhado
    const found = findManifestForExecutable(fakeExe)
    expect(found).not.toBeNull()
    expect(found?.manifest.title).toBe('Assassin\'s Creed IV Black Flag')
    expect(found?.manifest.version).toBe('v1.0.4')
    expect(found?.manifest.storeId).toBe('ankergames')
    expect(found?.manifestDir.toLowerCase()).toBe(gameRootDir.toLowerCase())
  })

  test('findManifestForExecutable retorna null se nenhum manifesto existir na hierarquia', () => {
    const deepSubDir = join(testBaseDir, 'MyGame', 'Binaries')
    mkdirSync(deepSubDir, { recursive: true })
    const fakeExe = join(deepSubDir, 'game.exe')
    writeFileSync(fakeExe, 'binary content')

    const found = findManifestForExecutable(fakeExe)
    expect(found).toBeNull()
  })
})
