import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => tmpdir()),
    isPackaged: false
  },
  session: {
    fromPartition: jest.fn(() => ({
      clearStorageData: jest.fn(),
      clearCache: jest.fn(),
      clearAuthCache: jest.fn(),
      clearHostResolverCache: jest.fn(),
      clearData: jest.fn()
    }))
  }
}))

jest.mock('../logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarning: jest.fn(),
  logDebug: jest.fn(),
  LogPrefix: { Legendary: 'Legendary', Backend: 'Backend' }
}))

jest.mock('../constants/key_value_stores', () => ({
  configStore: {
    get_nodefault: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  }
}))

jest.mock('../utils', () => ({
  clearCache: jest.fn()
}))

jest.mock('../storeManagers', () => ({
  libraryManagerMap: {
    legendary: {
      runRunnerCommand: jest.fn()
    }
  }
}))

import { LegendaryUser } from '../storeManagers/legendary/user'

describe('LegendaryUser credentials validation and self-healing', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ghost-legendary-test-'))
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  it('rejects missing, empty, or corrupted user.json files', () => {
    const missingFile = join(tempDir, 'missing.json')
    expect(LegendaryUser.hasValidCredentialsFile(missingFile)).toBe(false)

    const emptyFile = join(tempDir, 'empty.json')
    writeFileSync(emptyFile, '{}', 'utf-8')
    expect(LegendaryUser.hasValidCredentialsFile(emptyFile)).toBe(false)

    const corruptedFile = join(tempDir, 'corrupted.json')
    writeFileSync(corruptedFile, '{not-valid-json', 'utf-8')
    expect(LegendaryUser.hasValidCredentialsFile(corruptedFile)).toBe(false)
  })

  it('accepts valid user.json with access_token and account_id', () => {
    const validFile = join(tempDir, 'user.json')
    writeFileSync(
      validFile,
      JSON.stringify({
        access_token: 'eg1~valid_token_here',
        account_id: 'acc_123456',
        displayName: 'bushido_777',
        expires_at: '2026-10-24T16:24:35.830Z'
      }),
      'utf-8'
    )
    expect(LegendaryUser.hasValidCredentialsFile(validFile)).toBe(true)
  })
})
