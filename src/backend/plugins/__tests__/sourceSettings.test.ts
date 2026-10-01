import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  initializeSourceSettings,
  sourceSettings,
  saveSourceSettings,
  sourceCandidates,
  canonicalSourceUrl,
  isSourceUrl,
  normalizeSourceOrigin
} from '../sourceSettings'
import { websiteSource } from '../websiteSource'
import { NetworkGuard } from '../networkGuard'
import { ankerGameUrl, directDownloadManifest } from '../ankerAccount'
import type { PluginManifest } from 'common/types/plugins'

const id = 'com.ghost.ankergames-source'
let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghost-addresses-'))
  initializeSourceSettings(root)
})
afterEach(() => {
  jest.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})
function configure() {
  return saveSourceSettings(id, {
    ...sourceSettings(id),
    additional: ['https://mirror.example'],
    preferred: 'https://mirror.example'
  })
}

it('retains original, persists alternatives and canonicalizes game identity', () => {
  configure()
  initializeSourceSettings(root)
  expect(sourceCandidates(id, 'https://ankergames.net/game/test')).toEqual([
    'https://mirror.example/game/test',
    'https://ankergames.net/game/test'
  ])
  expect(canonicalSourceUrl(id, 'https://mirror.example/game/test')).toBe(
    'https://ankergames.net/game/test'
  )
  expect(ankerGameUrl('https://mirror.example/game/test')).toBe(
    'https://ankergames.net/game/test'
  )
  expect(
    NetworkGuard.validateUrl(
      'https://mirror.example/file.zip',
      directDownloadManifest(false)
    ).allowed
  ).toBe(true)
  expect(
    NetworkGuard.validateUrl(
      'https://mirror.example/file.zip',
      directDownloadManifest(true)
    ).allowed
  ).toBe(false)
  expect(isSourceUrl(id, 'https://mirror.example.evil.test/game/test')).toBe(
    false
  )
})
it.each([
  'http://example.com',
  'https://127.0.0.1',
  'https://user:pass@example.com',
  'https://example.com/login',
  'https://example.com:8443',
  'https://server.local'
])('rejects invalid origin %s', (value) => {
  expect(() => normalizeSourceOrigin(value)).toThrow()
})
it('falls back to the original without creating mirror game IDs', async () => {
  configure()
  const fetch = jest
    .spyOn(NetworkGuard, 'fetchResponse')
    .mockImplementation(async (url) => {
      if (url.startsWith('https://mirror.example'))
        throw new Error('Unavailable')
      return new Response(
        '<a href="https://ankergames.net/game/test">Test Game</a>'
      )
    })
  const provider = websiteSource(
    {
      id,
      name: 'Anker',
      homepage: 'https://ankergames.net',
      permissions: ['network'],
      allowedDomains: ['ankergames.net']
    } as PluginManifest,
    {
      catalogPath: '/games-list',
      gamePathPrefix: '/game/',
      platform: 'windows'
    }
  )
  const games = await provider.search('Test Game')
  expect(games).toHaveLength(1)
  expect(games[0].id).toBe('https://ankergames.net/game/test')
  expect(fetch.mock.calls[0][0]).toContain('mirror.example')
  expect(fetch.mock.calls[1][0]).toContain('ankergames.net')
})
