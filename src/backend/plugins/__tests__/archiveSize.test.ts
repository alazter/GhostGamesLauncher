import { archiveSize } from '../archiveSize'
import { open } from 'yauzl'
import { execFile } from 'child_process'
import { resolve7zPath } from '../archiveTools'

jest.mock('yauzl', () => ({ open: jest.fn() }))
jest.mock('child_process', () => ({ execFile: jest.fn() }))
jest.mock('../archiveTools', () => ({
  resolve7zPath: jest.fn(),
  resolveUnrarPath: jest.fn()
}))

beforeEach(() => {
  jest
    .mocked(open)
    .mockImplementation(((_file: unknown, _opts: unknown, cb: Function) =>
      cb(new Error('unsupported ZIP'))) as never)
  jest.mocked(resolve7zPath).mockResolvedValue('7z.exe')
})

it('uses 7-Zip metadata when an update ZIP is unsupported by the primary reader', async () => {
  jest
    .mocked(open)
    .mockImplementation(((_file: unknown, _opts: unknown, cb: Function) =>
      cb(new Error('unsupported ZIP'))) as never)
  jest.mocked(resolve7zPath).mockResolvedValue('7z.exe')
  jest.mocked(execFile).mockImplementation(((...args: unknown[]) => {
    ;(args[args.length - 1] as Function)(
      null,
      Buffer.from(
        'Path = game.exe\r\nSize = 100\r\n\r\nPath = data.bin\r\nSize = 900\r\n'
      )
    )
    return { stdin: { end: jest.fn() } }
  }) as never)
  await expect(archiveSize('package.zip')).resolves.toBe(1000)
  expect(execFile).toHaveBeenCalled()
})

it('does not assume sufficient space when neither reader can inspect the package', async () => {
  jest.mocked(execFile).mockImplementation(((...args: unknown[]) => {
    ;(args[args.length - 1] as Function)(new Error('invalid archive'), '')
    return { stdin: { end: jest.fn() } }
  }) as never)
  await expect(archiveSize('package.zip')).rejects.toThrow(
    'Não foi possível ler o pacote'
  )
})
