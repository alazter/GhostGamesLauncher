import { findAlternativeExecutableCandidate } from '../launcher'
import * as gracefulFs from 'graceful-fs'
import { join } from 'path'

jest.mock('graceful-fs', () => {
  const original = jest.requireActual('graceful-fs')
  return {
    ...original,
    existsSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn()
  }
})

describe('findAlternativeExecutableCandidate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null if target directory does not exist', () => {
    ;(graceFs.existsSync as jest.Mock).mockReturnValue(false)
    const result = findAlternativeExecutableCandidate('C:\\Games\\nonexistent\\app.exe')
    expect(result).toBeNull()
  })

  it('matches exact case-insensitive executable name if directory exists', () => {
    const dir = 'C:\\Games\\DLSS'
    ;(graceFs.existsSync as jest.Mock).mockImplementation((p: string) => p === dir)
    ;(graceFs.readdirSync as jest.Mock).mockReturnValue([
      'DLSS5OneClick.exe',
      'other.txt'
    ])
    ;(graceFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: 1000 })

    const result = findAlternativeExecutableCandidate(join(dir, 'dlss5oneclick.exe'))
    expect(result).toBe(join(dir, 'DLSS5OneClick.exe'))
  })

  it('resolves newer portable/versioned executable candidate matching terms', () => {
    const dir = 'T:\\Downloads\\Programs'
    ;(graceFs.existsSync as jest.Mock).mockImplementation((p: string) => p === dir)
    ;(graceFs.readdirSync as jest.Mock).mockReturnValue([
      'DLSS5-Swapper-2.2.4-portable.exe',
      'DLSS5-Swapper-2.2.5-portable.exe',
      'random_program.exe'
    ])
    ;(graceFs.statSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes('2.2.5')) return { mtimeMs: 2000 }
      if (p.includes('2.2.4')) return { mtimeMs: 1000 }
      return { mtimeMs: 500 }
    })

    const result = findAlternativeExecutableCandidate(join(dir, 'dlss5oneclick.exe'))
    expect(result).toBe(join(dir, 'DLSS5-Swapper-2.2.5-portable.exe'))
  })

  it('returns null if no executable in directory matches terms', () => {
    const dir = 'C:\\Games\\Tools'
    ;(graceFs.existsSync as jest.Mock).mockImplementation((p: string) => p === dir)
    ;(graceFs.readdirSync as jest.Mock).mockReturnValue([
      'calculator.exe',
      'notepad.exe'
    ])
    ;(graceFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: 1000 })

    const result = findAlternativeExecutableCandidate(join(dir, 'dlss5oneclick.exe'))
    expect(result).toBeNull()
  })
})
const graceFs = gracefulFs
