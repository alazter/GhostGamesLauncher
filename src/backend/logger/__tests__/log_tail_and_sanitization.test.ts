import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

jest.mock('backend/ipc', () => ({
  addListener: jest.fn(),
  addHandler: jest.fn(),
  addTestOnlyListener: jest.fn()
}))

jest.mock('../../utils', () => ({
  showItemInFolder: jest.fn()
}))

jest.mock('../paths', () => ({
  getLogFilePath: jest.fn(() => '')
}))

jest.mock('../uploader', () => ({
  uploadLogFile: jest.fn(),
  deleteUploadedLogFile: jest.fn(),
  getUploadedLogFiles: jest.fn()
}))

import { readLogFileTail } from '../ipc_handler'
import { formatSettingValueForLog } from '../index'

describe('Logger tail reader and settingChanged sanitization', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ghost-log-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('summarizes localStorageBackup and oversized objects in formatSettingValueForLog', () => {
    expect(
      formatSettingValueForLog('localStorageBackup', {
        heroic_custom_bg: 'data:image/png;base64,' + 'A'.repeat(50000),
        heroic_custom_stores: 'B'.repeat(50000)
      })
    ).toBe('[localStorageBackup: 2 keys]')

    const longString = 'X'.repeat(1200)
    const formattedStr = String(formatSettingValueForLog('customCSS', longString))
    expect(formattedStr).toContain('[truncated 1200 chars]')
    expect(formattedStr.length).toBeLessThan(300)

    expect(formatSettingValueForLog('language', 'pt_BR')).toBe('pt_BR')
  })

  it('reads only the tail of large log files and truncates oversized lines', () => {
    const logPath = join(tempDir, 'ghost.log')
    const headerLines = Array.from(
      { length: 200 },
      (_, i) => `Line ${i}: ${'A'.repeat(200)}`
    ).join('\n')
    const hugeLine = `HugeLine: ${'B'.repeat(5000)}`
    const finalLine = 'FinalLine: Settings loaded'
    writeFileSync(
      logPath,
      `${headerLines}\n${hugeLine}\n${finalLine}`,
      'utf-8'
    )

    const tail = readLogFileTail(logPath, 8192, 50, 500)
    const lines = tail.split('\n')

    expect(lines[0]).toBe('...')
    expect(lines[lines.length - 1]).toBe(finalLine)
    const truncatedHugeLine = lines.find((line) => line.startsWith('HugeLine:'))
    expect(truncatedHugeLine).toBeDefined()
    expect(truncatedHugeLine).toContain('[line truncated]')
    expect(truncatedHugeLine!.length).toBeLessThan(550)
  })

  it('returns empty string when log file does not exist', () => {
    expect(readLogFileTail(join(tempDir, 'missing.log'))).toBe('')
  })
})
