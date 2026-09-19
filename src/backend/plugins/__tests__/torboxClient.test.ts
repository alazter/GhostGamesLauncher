import { createHash } from 'crypto'
import { torrentInfoHash } from '../torrentMetadata'
import { TorboxClient } from '../torboxClient'
import { ankerGameUrl } from '../ankerAccount'
import { TORBOX_DOWNLOAD_DOMAINS } from '../torboxDomains'

jest.mock('electron', () => ({}))
jest.mock('backend/constants/paths', () => ({ userDataPath: '' }))
const originalFetch = global.fetch

it.each(TORBOX_DOWNLOAD_DOMAINS)(
  'accepts the official CDN %s',
  async (domain) => {
    const url = `https://nexus.region.${domain}/file.zip?token=test`
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: url }))
      )
    await expect(
      new TorboxClient('test-secret').link(42, new AbortController().signal)
    ).resolves.toBe(url)
  }
)

it.each([
  'https://tb-cdn.io.evil.test/file.zip',
  'https://eviltb-cdn.io/file.zip',
  'http://nexus.tb-cdn.io/file.zip',
  'https://user:pass@nexus.tb-cdn.io/file.zip',
  'https://127.0.0.1/file.zip'
])('rejects a spoofed or unsafe CDN URL: %s', async (url) => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: url }))
    )
  await expect(
    new TorboxClient('test-secret').link(42, new AbortController().signal)
  ).rejects.toThrow('não reconhecido')
})

it('queries the saved torrent directly and normalizes numeric identifiers', async () => {
  const mock = jest.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: {
          id: '42',
          hash: 'abc',
          files: [{ id: '7', name: 'game.zip' }]
        }
      })
    )
  )
  global.fetch = mock
  const rows = await new TorboxClient('test-secret').list(undefined, 42)
  expect(rows[0].id).toBe(42)
  expect(rows[0].files[0].id).toBe(7)
  expect(mock.mock.calls[0][0]).toBe(
    'https://api.torbox.app/v1/api/torrents/mylist?bypass_cache=true&id=42'
  )
})

it('allows a temporarily absent torrent in the targeted response', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: null }))
    )
  await expect(
    new TorboxClient('test-secret').list(undefined, 42)
  ).resolves.toEqual([])
})
afterEach(() => {
  global.fetch = originalFetch
})

it('hashes original info bytes and rejects HTML, truncation and duplicate keys', () => {
  const info = 'd6:lengthi1e4:name8:game.zipe'
  expect(torrentInfoHash(Buffer.from(`d4:info${info}e`))).toBe(
    createHash('sha1').update(info).digest('hex')
  )
  for (const input of [
    '<html>Login</html>',
    'd4:info',
    'd4:infoi1ee',
    `d4:info${info}4:info${info}e`,
    `d4:info${info}eextra`
  ])
    expect(() => torrentInfoHash(Buffer.from(input))).toThrow()
})

it('restricts official game pages to AnkerGames HTTPS', () => {
  expect(ankerGameUrl('https://ankergames.net/game/inzoi?foo=bar')).toBe(
    'https://ankergames.net/game/inzoi'
  )
  for (const url of [
    'https://ankergames.net.evil.test/game/inzoi',
    'http://ankergames.net/game/inzoi',
    'https://user:pass@ankergames.net/game/inzoi',
    'https://ankergames.net/login'
  ])
    expect(() => ankerGameUrl(url)).toThrow()
})

it('uploads the torrent as multipart with authorization only on the fixed API', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { torrent_id: 42 } }))
    )
  global.fetch = fetchMock
  const torrent = Buffer.from('d4:infod4:name4:gameee')
  expect(
    await new TorboxClient('test-secret').create(
      torrent,
      new AbortController().signal
    )
  ).toBe(42)
  const [url, request] = fetchMock.mock.calls[0]
  expect(url).toBe('https://api.torbox.app/v1/api/torrents/createtorrent')
  expect(request.redirect).toBe('error')
  expect(request.headers.Authorization).toBe('Bearer test-secret')
  expect(Buffer.from(await request.body.get('file').arrayBuffer())).toEqual(
    torrent
  )
})

it('does not leak server details containing credentials', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, detail: 'token=test-secret' })
      )
    )
  await expect(new TorboxClient('test-secret').test()).rejects.toThrow(
    'recusou'
  )
})

it('rejects untrusted download servers and requests JSON instead of redirecting the key', async () => {
  const mock = jest
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: 'https://evil.test/file.zip' })
      )
    )
  global.fetch = mock
  await expect(
    new TorboxClient('test-secret').link(4, new AbortController().signal)
  ).rejects.toThrow('não reconhecido')
  const url = new URL(mock.mock.calls[0][0])
  expect(url.searchParams.get('zip_link')).toBe('true')
  expect(url.searchParams.get('redirect')).toBe('false')
})

it('selects a file link when the torrent contains one supported archive', async () => {
  const mock = jest.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: 'https://cdn.torbox.app/file.zip'
      })
    )
  )
  global.fetch = mock
  expect(
    await new TorboxClient('test-secret').link(
      4,
      new AbortController().signal,
      8
    )
  ).toBe('https://cdn.torbox.app/file.zip')
  expect(new URL(mock.mock.calls[0][0]).searchParams.get('file_id')).toBe('8')
})
