import { statfs } from 'fs/promises'
import { planInstallSpace, sizeBytes, spaceReserve } from '../installSpace'

jest.mock('fs/promises', () => ({ statfs: jest.fn() }))
const GiB = 1024 ** 3
const disk = (bytes: number) =>
  ({ bavail: bytes, bsize: 1 }) as Awaited<ReturnType<typeof statfs>>

it('parses explicit units and declines ambiguous or missing sizes', () => {
  expect(sizeBytes('1,5 GB')).toBe(1.5 * GiB)
  expect(sizeBytes('20 MiB')).toBe(20 * 1024 ** 2)
  expect(sizeBytes('Unknown')).toBe(0)
  expect(sizeBytes('10')).toBe(0)
})

it('needs both the archive and installed files when using the original disk', async () => {
  jest.mocked(statfs).mockResolvedValue(disk(8 * GiB))
  const result = await planInstallSpace(
    'C:\\Games',
    'test',
    3 * GiB,
    6 * GiB,
    false,
    []
  )
  expect(result.requiredOriginal).toBe(9 * GiB + spaceReserve)
  expect(result.missingOriginal).toBe(GiB + spaceReserve)
  expect(result.missingDestination).toBe(0)
})

it('offers another disk only when the installed game fits at its destination', async () => {
  jest
    .mocked(statfs)
    .mockImplementation(async (path) =>
      disk(String(path).startsWith('D:') ? 10 * GiB : 8 * GiB)
    )
  const result = await planInstallSpace(
    'C:\\Games',
    'test',
    3 * GiB,
    6 * GiB,
    false,
    ['D:\\']
  )
  expect(result.temporaryDirectory).toContain('.ghost-download-test')
  const blocked = await planInstallSpace(
    'C:\\Games',
    'test',
    3 * GiB,
    9 * GiB,
    false,
    ['D:\\']
  )
  expect(blocked.missingDestination).toBe(GiB + spaceReserve)
  expect(blocked.temporaryDirectory).toBeUndefined()
})
