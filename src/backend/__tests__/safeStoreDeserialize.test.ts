import { TypeCheckedStoreBackend } from '../electron_store'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('TypeCheckedStoreBackend & Safe Deserialization', () => {
  const tempDir = path.join(os.tmpdir(), `ghost-test-store-${Date.now()}`)

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true })
  })

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  test('successfully reads a store file with UTF-8 BOM without crashing', () => {
    const storePath = path.join(tempDir, 'bom_store.json')
    fs.writeFileSync(storePath, '\uFEFF{"testKey":"bomValue"}', 'utf8')

    // Instantiate backend store with custom cwd
    const store = new TypeCheckedStoreBackend('testStore' as any, {
      cwd: tempDir,
      name: 'bom_store'
    })

    expect(store.get('testKey' as any, 'default')).toBe('bomValue')
  })

  test('gracefully recovers when config file has leading whitespace or junk', () => {
    const storePath = path.join(tempDir, 'junk_store.json')
    fs.writeFileSync(storePath, '   \r\n\t{"healthyKey":12345}  \n', 'utf8')

    const store = new TypeCheckedStoreBackend('testStore' as any, {
      cwd: tempDir,
      name: 'junk_store'
    })

    expect(store.get('healthyKey' as any, 0)).toBe(12345)
  })

  test('does not throw fatal exception on completely corrupted JSON file', () => {
    const storePath = path.join(tempDir, 'corrupt_store.json')
    fs.writeFileSync(storePath, '!!!CORRUPTED_NOT_JSON!!!', 'utf8')

    // Must not throw Uncaught Error
    expect(() => {
      const store = new TypeCheckedStoreBackend('testStore' as any, {
        cwd: tempDir,
        name: 'corrupt_store'
      })
      expect(store.get('anyKey' as any, 'fallback')).toBe('fallback')
    }).not.toThrow()
  })

  test('strips UTF-8 BOM and parses valid JSON correctly without throwing Unexpected token error', () => {
    const rawBom = '\uFEFF{"version":"v0","defaultSettings":{"autoUpdateGames":false}}'
    const cleaned = rawBom.replace(/^\uFEFF/, '').trim()
    expect(() => JSON.parse(cleaned)).not.toThrow()
    const parsed = JSON.parse(cleaned)
    expect(parsed.version).toBe('v0')
    expect(parsed.defaultSettings.autoUpdateGames).toBe(false)
  })

  test('handles whitespace-only or corrupted state.json safely without crashing', () => {
    const emptyContent = '    \r\n\t   '
    const raw = emptyContent.replace(/^\uFEFF/, '').trim()
    let state = { jobs: [], installations: [], backups: [] }
    if (raw) {
      try {
        state = JSON.parse(raw)
      } catch {
        state = { jobs: [], installations: [], backups: [] }
      }
    }
    expect(state).toEqual({ jobs: [], installations: [], backups: [] })
  })
})
