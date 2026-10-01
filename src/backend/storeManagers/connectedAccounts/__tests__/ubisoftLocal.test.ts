import { open } from 'fs/promises'
import { join } from 'path'
import {
  parseUbisoftLocalCache,
  readUbisoftLocalCatalog
} from '../ubisoftLocal'

jest.mock('fs/promises', () => ({ open: jest.fn() }))

function varint(value: number): Buffer {
  const bytes: number[] = []
  do {
    const byte = value % 128
    value = Math.floor(value / 128)
    bytes.push(byte | (value ? 0x80 : 0))
  } while (value)
  return Buffer.from(bytes)
}

function bytes(field: number, value: Buffer | string): Buffer {
  const buffer = typeof value === 'string' ? Buffer.from(value) : value
  return Buffer.concat([varint(field * 8 + 2), varint(buffer.length), buffer])
}

function product(id: number, yaml?: string | Buffer, extra?: Buffer): Buffer {
  return bytes(
    1,
    Buffer.concat([
      Buffer.from([8]),
      varint(id),
      Buffer.from([16]),
      varint(id),
      ...(yaml === undefined ? [] : [bytes(3, yaml)]),
      ...(extra ? [extra] : [])
    ])
  )
}

const gameInfo = 'root:\n  name: Game\n  start_game: {}\n'
const assetBase =
  'https://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/'

describe('Ubisoft local cache parser', () => {
  it('resolves default localization, retains title editions, and strips only trademarks', () => {
    const games = parseUbisoftLocalCache(
      product(
        42,
        'root:\n  name: GAMENAME\n  thumb_image: THUMBIMAGE\n  start_game: {}\n' +
          'localizations:\n  default:\n    GAMENAME: "Game®™ 2.0 [Gold Edition]"\n' +
          '    THUMBIMAGE: image.jpg\n  pt-BR:\n    GAMENAME: Other name\n'
      )
    )
    expect(games).toEqual([
      {
        id: '42',
        title: 'Game 2.0 [Gold Edition]',
        cover: `${assetBase}image.jpg`,
        storeUrl:
          'https://store.ubisoft.com/search?q=Game%202.0%20%5BGold%20Edition%5D'
      }
    ])
  })

  it('excludes add-ons even before parents, ULC, third-party entries and nonlaunchable records', () => {
    const games = parseUbisoftLocalCache(
      Buffer.concat([
        product(2, gameInfo),
        product(1, `${gameInfo}  addons:\n    - id: 2\n`),
        product(3, `${gameInfo}  is_ulc: true\n`),
        product(4, `${gameInfo}  is_ulc: yes\n`),
        product(5, `${gameInfo}  third_party_platform: {}\n`),
        product(6, 'root:\n  name: null\n'),
        product(7, `${gameInfo}  is_ulc: no\n`)
      ])
    )
    expect(games.map((game) => game.id)).toEqual(['1', '7'])
  })

  it('collects add-ons from filtered parents and permits a valid filtered empty library', () => {
    expect(
      parseUbisoftLocalCache(
        Buffer.concat([
          product(2, gameInfo),
          product(1, 'root:\n  addons:\n    - id: 2\n')
        ])
      )
    ).toEqual([])
  })

  it('ignores client placeholders and never claims an executable or installation', () => {
    const games = parseUbisoftLocalCache(
      Buffer.concat([
        product(1),
        product(2, ''),
        product(3, `${gameInfo}  executable: C:\\Game.exe\n`)
      ])
    )
    expect(games.map((game) => game.id)).toEqual(['3'])
    expect(games[0]).not.toHaveProperty('executable')
    expect(games[0]).not.toHaveProperty('installId')
    expect(games[0]).not.toHaveProperty('is_installed')
  })

  it('skips all valid unknown wire types, including uint64s and matching groups', () => {
    const unknown = Buffer.concat([
      Buffer.from([32]),
      Buffer.from([255, 255, 255, 255, 255, 255, 255, 255, 255, 1]),
      Buffer.from([41]),
      Buffer.alloc(8),
      bytes(6, 'extra metadata'),
      Buffer.from([59, 64, 1, 60]),
      Buffer.from([77]),
      Buffer.alloc(4)
    ])
    expect(
      parseUbisoftLocalCache(
        Buffer.concat([unknown, product(42, gameInfo, unknown)])
      ).map((game) => game.id)
    ).toEqual(['42'])
  })

  it.each([
    '',
    'root: []',
    'root: [',
    'unexpected: format',
    'root:\n  name: Game\n  start_game: {}\nlocalizations: []',
    'root:\n  name: Game\n  start_game: {}\n  addons: [4]',
    'root:\n  name: Game\n  start_game: {}\n  addons: [{id: invalid}]',
    'root:\n  name: 42\n  start_game: {}',
    'root:\n  name: Game\n  start_game: unexpected',
    'root:\n  name: Game\n  start_game: {}\n  is_ulc: unexpected',
    'root:\n  name: &title Game\n  start_game: {}\ncopy: *title',
    'root: !unexpected {}'
  ])(
    'rejects malformed or unrecognized YAML without a partial import: %p',
    (yaml) => {
      const buffer =
        yaml === ''
          ? Buffer.from([10, 0])
          : Buffer.concat([product(1, gameInfo), product(2, yaml)])
      expect(() => parseUbisoftLocalCache(buffer)).toThrow(
        'UBISOFT_CACHE_INVALID'
      )
    }
  )

  it.each([
    Buffer.alloc(0),
    Buffer.from([0]),
    Buffer.from([10, 128]),
    Buffer.from([10, 8, 8, 1]),
    Buffer.from([10, 1, 8]),
    Buffer.from([14]),
    Buffer.from([33, 0]),
    Buffer.from([45, 0]),
    Buffer.from([35, 44]),
    Buffer.from([35]),
    Buffer.from([36]),
    Buffer.from([32, ...Array(10).fill(255)]),
    Buffer.from([32, ...Array(9).fill(255), 2]),
    bytes(1, Buffer.from([10, 0])),
    product(0, gameInfo),
    product(1, Buffer.from([0xc3, 0x28])),
    product(1, gameInfo, Buffer.from([8, 2]))
  ])('rejects invalid, truncated or ambiguous protobuf: %p', (buffer) => {
    expect(() => parseUbisoftLocalCache(buffer)).toThrow(
      'UBISOFT_CACHE_INVALID'
    )
  })

  it('rejects oversized caches and messages before parsing contents', () => {
    expect(() =>
      parseUbisoftLocalCache(Buffer.alloc(32 * 1024 * 1024 + 1))
    ).toThrow('UBISOFT_CACHE_INVALID')
    expect(() =>
      parseUbisoftLocalCache(bytes(1, Buffer.alloc(2 * 1024 * 1024 + 1)))
    ).toThrow('UBISOFT_CACHE_INVALID')
  })

  it.each([
    'file:///C:/secret.png',
    'javascript:alert(1)',
    'http://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/image.jpg',
    'https://example.com/image.jpg',
    '//example.com/image.jpg',
    '../image.jpg',
    'https://user:pass@ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/image.jpg'
  ])('omits unsafe or foreign cover assets: %s', (asset) => {
    const games = parseUbisoftLocalCache(
      product(1, `${gameInfo}  thumb_image: '${asset}'\n`)
    )
    expect(games[0].cover).toBeUndefined()
    expect(new URL(games[0].storeUrl).protocol).toBe('https:')
  })
})

describe('Ubisoft local catalog reader', () => {
  const originalPlatform = process.platform
  const originalLocalAppData = process.env.LOCALAPPDATA
  const openMock = jest.mocked(open)
  let file: {
    stat: jest.Mock
    read: jest.Mock
    close: jest.Mock
  }

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.LOCALAPPDATA = join('test-profile', 'Local')
    const data = product(42, gameInfo)
    file = {
      stat: jest.fn().mockResolvedValue({
        isFile: () => true,
        size: data.length,
        mtimeMs: 1234
      }),
      read: jest.fn().mockImplementation((buffer: Buffer) => {
        data.copy(buffer)
        return Promise.resolve({ bytesRead: data.length })
      }),
      close: jest.fn().mockResolvedValue(undefined)
    }
    openMock.mockResolvedValue(
      file as unknown as Awaited<ReturnType<typeof open>>
    )
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA
    else process.env.LOCALAPPDATA = originalLocalAppData
  })

  it('reads only the current profile configuration and reports source metadata', async () => {
    const catalog = await readUbisoftLocalCatalog()
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith(
      join(
        process.env.LOCALAPPDATA!,
        'Ubisoft Game Launcher',
        'cache',
        'configuration',
        'configurations'
      ),
      'r'
    )
    expect(catalog).toMatchObject({
      games: [{ id: '42' }],
      username: 'Biblioteca local · Ubisoft Connect',
      connectionMethod: 'local',
      sourceUpdatedAt: 1234
    })
    expect(file.close).toHaveBeenCalledTimes(1)
  })

  it('reports missing cache without searching install directories or credentials', async () => {
    openMock.mockRejectedValue({ code: 'ENOENT' })
    await expect(readUbisoftLocalCatalog()).rejects.toThrow(
      'UBISOFT_CLIENT_REQUIRED'
    )
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('reports unsupported platforms and missing profile before opening files', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    await expect(readUbisoftLocalCatalog()).rejects.toThrow(
      'UBISOFT_LOCAL_UNSUPPORTED'
    )
    Object.defineProperty(process, 'platform', { value: 'win32' })
    delete process.env.LOCALAPPDATA
    await expect(readUbisoftLocalCatalog()).rejects.toThrow(
      'UBISOFT_CLIENT_REQUIRED'
    )
    expect(openMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized file before allocating or reading and closes the handle', async () => {
    file.stat.mockResolvedValue({ isFile: () => true, size: 33 * 1024 * 1024 })
    await expect(readUbisoftLocalCatalog()).rejects.toThrow(
      'UBISOFT_CACHE_INVALID'
    )
    expect(file.read).not.toHaveBeenCalled()
    expect(file.close).toHaveBeenCalledTimes(1)
  })

  it('rejects caches changed during the read', async () => {
    file.stat.mockResolvedValueOnce({
      isFile: () => true,
      size: product(42, gameInfo).length,
      mtimeMs: 999
    })
    await expect(readUbisoftLocalCatalog()).rejects.toThrow(
      'UBISOFT_CACHE_INVALID'
    )
    expect(file.close).toHaveBeenCalledTimes(1)
  })

  it('rejects a short read and closes the handle', async () => {
    file.read.mockResolvedValue({ bytesRead: 0 })
    await expect(readUbisoftLocalCatalog()).rejects.toThrow(
      'UBISOFT_CACHE_INVALID'
    )
    expect(file.close).toHaveBeenCalledTimes(1)
  })

  it.each([
    `${gameInfo}  is_ulc: true\n`,
    'root:\n  name: Client placeholder\n'
  ])(
    'rejects a valid but unpopulated cache before returning a catalog: %s',
    async (yaml) => {
      const data = product(42, yaml)
      file.stat.mockResolvedValue({
        isFile: () => true,
        size: data.length,
        mtimeMs: 1234
      })
      file.read.mockImplementation((buffer: Buffer) => {
        data.copy(buffer)
        return Promise.resolve({ bytesRead: data.length })
      })
      await expect(readUbisoftLocalCatalog()).rejects.toThrow(
        'UBISOFT_CACHE_INVALID'
      )
      expect(file.close).toHaveBeenCalledTimes(1)
    }
  )
})
