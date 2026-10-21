import {
  archiveCommand,
  listArchive,
  parseArchiveListing
} from '../archiveReader'
import {
  archiveToolCandidates,
  resolve7zPath,
  resolveUnrarPath
} from '../archiveTools'
import { execFile } from 'child_process'

jest.mock('../archiveTools', () => ({
  ...jest.requireActual('../archiveTools'),
  resolve7zPath: jest.fn(),
  resolveUnrarPath: jest.fn()
}))
jest.mock('child_process', () => ({ execFile: jest.fn() }))

function commandResult(text: string, encoding: BufferEncoding = 'utf8') {
  jest.mocked(execFile).mockImplementation(((...args: unknown[]) => {
    ;(args.at(-1) as Function)(null, Buffer.from(text, encoding))
    return { stdin: { end: jest.fn() } }
  }) as never)
}

it('uses the WinRAR console reader for RAR when 7-Zip is absent and validates Portuguese metadata', async () => {
  jest.mocked(resolve7zPath).mockResolvedValue(null)
  jest.mocked(resolveUnrarPath).mockResolvedValue('UnRAR.exe')
  commandResult(
    'Arquivo: game.rar\r\nDetalhes: RAR 5\r\n\r\n Nome: game.exe\r\n Tipo: Arquivo\r\n Tamanho: 123\r\n\r\n',
    'utf16le'
  )
  expect(await listArchive('game.rar')).toMatchObject({
    tool: { kind: 'winrar' },
    bytes: 123
  })
  expect(jest.mocked(execFile).mock.calls[0][1]).toEqual(
    expect.arrayContaining(['-cfg-', '-p-', '-scu'])
  )
})

it('prefers 7-Zip for 7Z and does not pretend the RAR console can read 7Z', async () => {
  jest.mocked(resolve7zPath).mockResolvedValue('7z.exe')
  commandResult('Path = game.exe\r\nSize = 7\r\n')
  expect(await listArchive('game.7z')).toMatchObject({
    tool: { kind: '7zip' },
    bytes: 7
  })
  expect(resolveUnrarPath).not.toHaveBeenCalled()
  jest.mocked(resolve7zPath).mockResolvedValue(null)
  await expect(listArchive('game.7z')).rejects.toThrow('Instale o 7-Zip')
})

it.each([
  'Name: ../escape.exe\nType: File\nSize: 1',
  'Name: game.exe\nType: Symbolic link\nSize: 1',
  'Name: game.exe\nType: File\nSize: -1',
  'Name: game.exe\nType: File\nSize: 1\n\nName: GAME.exe\nType: File\nSize: 1',
  'Nom: game.exe\nType: Fichier\nTaille: 1'
])(
  'rejects an unsafe or unrecognized WinRAR listing before extraction',
  (listing) => {
    expect(() => parseArchiveListing(listing, 'winrar')).toThrow()
  }
)

it('does not leak archive passwords in command failures', async () => {
  jest.mocked(execFile).mockImplementation(((...args: unknown[]) => {
    ;(args.at(-1) as Function)(
      Object.assign(Error('command -psecret-password'), { code: 2 }),
      Buffer.alloc(0)
    )
    return { stdin: { end: jest.fn() } }
  }) as never)
  await expect(
    archiveCommand({ kind: 'winrar', path: 'UnRAR.exe' }, [
      'x',
      '-psecret-password'
    ])
  ).rejects.not.toThrow('secret-password')
})

it('discovers configured Program Files rather than assuming the C drive', () => {
  const original = process.env.ProgramFiles
  process.env.ProgramFiles = 'D:\\Applications'
  try {
    expect(
      archiveToolCandidates('7zip').some((path) =>
        /D:.*Applications.*7-Zip.*7z\.exe/.test(path)
      )
    ).toBe(true)
    expect(
      archiveToolCandidates('winrar').some((path) =>
        /D:.*Applications.*WinRAR.*UnRAR\.exe/.test(path)
      )
    ).toBe(true)
  } finally {
    if (original === undefined) delete process.env.ProgramFiles
    else process.env.ProgramFiles = original
  }
})
