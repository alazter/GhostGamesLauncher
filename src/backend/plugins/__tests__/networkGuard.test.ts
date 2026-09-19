import { NetworkGuard, isPublicDownloadAddress } from '../networkGuard'
import type { PluginManifest } from 'common/types/plugins'
import { TORBOX_DOWNLOAD_DOMAINS } from '../torboxDomains'

const manifest = {
  id: 'test',
  name: 'Test',
  permissions: ['network'],
  allowedDomains: ['example.com']
} as PluginManifest

it.each(TORBOX_DOWNLOAD_DOMAINS)('permits the TorBox transfer and redirect domain %s only for its scoped manifest', domain => {
  const url = `https://nexus.region.${domain}/file.zip`
  expect(NetworkGuard.validateUrl(url, { ...manifest, allowedDomains: [...TORBOX_DOWNLOAD_DOMAINS] }).allowed).toBe(true)
  expect(NetworkGuard.validateUrl(url, manifest).allowed).toBe(false)
  expect(NetworkGuard.validateUrl(`https://${domain}.evil.test/file.zip`, { ...manifest, allowedDomains: [...TORBOX_DOWNLOAD_DOMAINS] }).allowed).toBe(false)
})

it.each([
  '127.0.0.1',
  '10.2.3.4',
  '169.254.169.254',
  '100.64.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'fc00::1',
  'fe80::1'
])('rejects non-public download address %s', (address) => {
  expect(isPublicDownloadAddress(address)).toBe(false)
})

it('revalidates redirect destinations and does not request a disallowed host', async () => {
  const fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/secrets' }
      })
    )
  await expect(
    NetworkGuard.fetchResponse(
      'https://example.com/archive',
      manifest,
      new AbortController().signal
    )
  ).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fetchMock.mockRestore()
})

it('drops credentials when following a redirect to another approved origin', async () => {
  const fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://cdn.example.com/archive' }
      })
    )
    .mockResolvedValueOnce(new Response('file'))
  await NetworkGuard.fetchResponse(
    'https://example.com/archive',
    manifest,
    new AbortController().signal,
    { Authorization: 'secret', Cookie: 'session=private' }
  )
  expect(fetchMock.mock.calls[1][1]?.headers).toEqual({})
  fetchMock.mockRestore()
})

describe('TRUSTED_GAME_MIRROR_DOMAINS', () => {
  const gameSourceManifest = {
    id: 'steamrip',
    name: 'SteamRIP',
    permissions: ['network', 'game-sources'],
    allowedDomains: ['steamrip.com']
  } as PluginManifest

  it('allows trusted mirror domains for plugins with game-sources permission', () => {
    expect(
      NetworkGuard.validateUrl(
        'https://fileditchfiles.st/balpha16/38047795a819d25339da/inZOI-SteamRIP.com.rar',
        gameSourceManifest
      ).allowed
    ).toBe(true)

    expect(
      NetworkGuard.validateUrl(
        'https://bzzhr.to/d/12345/archive.zip',
        gameSourceManifest
      ).allowed
    ).toBe(true)

    expect(
      NetworkGuard.validateUrl(
        'https://buzzheavier.com/f/12345',
        gameSourceManifest
      ).allowed
    ).toBe(true)

    expect(
      NetworkGuard.validateUrl(
        'https://pixeldrain.com/api/file/abcde',
        gameSourceManifest
      ).allowed
    ).toBe(true)
  })

  it('still blocks untrusted external domains even with game-sources permission', () => {
    expect(
      NetworkGuard.validateUrl(
        'https://malicious-random-host.xyz/file.zip',
        gameSourceManifest
      ).allowed
    ).toBe(false)
  })

  it('still strictly blocks local network and loopback even with game-sources permission', () => {
    expect(
      NetworkGuard.validateUrl(
        'http://127.0.0.1:8080/secret.zip',
        gameSourceManifest
      ).allowed
    ).toBe(false)

    expect(
      NetworkGuard.validateUrl(
        'http://192.168.1.100/download.zip',
        gameSourceManifest
      ).allowed
    ).toBe(false)
  })
})
