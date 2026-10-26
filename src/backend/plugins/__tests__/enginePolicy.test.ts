import {
  validateEngineRelease,
  normalizeEngineVersion,
  engineVersionGt
} from '../enginePolicy'
import { validateSourceRules } from '../sourceRules'
import { isAdaptiveGamePath } from '../adaptiveSource'
import type { EngineRelease } from 'common/types/sourceEngines'

const release: EngineRelease = {
  id: 'obscura',
  version: '0.2.3',
  platform: 'win32',
  arch: 'x64',
  protocol: 1,
  minGhostVersion: '0.3.0-beta',
  sha256: 'a'.repeat(64),
  executable: 'obscura.exe',
  url: 'https://github.com/h4ckf0r0day/obscura/releases/download/v0.2.3/obscura.zip'
}
it('accepts the approved platform and version', () => {
  expect(validateEngineRelease(release, '0.3.0-beta', 'win32', 'x64')).toEqual(
    release
  )
  const scraplingTwoPart: EngineRelease = {
    ...release,
    id: 'scrapling',
    version: '0.5',
    executable: 'ghost-scrapling.exe',
    url: 'https://github.com/alazter/GhostGamesLauncher/releases/download/engines-scrapling-0.5/scrapling.zip'
  }
  expect(
    validateEngineRelease(scraplingTwoPart, '0.3.0-beta', 'win32', 'x64')
  ).toEqual(scraplingTwoPart)
  expect(normalizeEngineVersion('0.5')).toBe('0.5.0')
  expect(engineVersionGt('0.5', '0.4.15')).toBe(true)
  expect(engineVersionGt('0.4.15', '0.5')).toBe(false)
})
it.each([
  { executable: '../outside.exe' },
  { executable: 'C:/outside.exe' },
  { url: 'https://evil.test/payload.zip' },
  { sha256: 'unknown' },
  { minGhostVersion: '9.0.0' },
  { platform: 'linux' },
  { protocol: 2 }
])('rejects unsafe or incompatible package %j', (change) =>
  expect(() =>
    validateEngineRelease(
      { ...release, ...change } as EngineRelease,
      '0.3.0-beta',
      'win32',
      'x64'
    )
  ).toThrow()
)
it('rejects arbitrary rule code, domains and duplicate providers', () => {
  const rule = {
    id: 'com.ghost.ankergames-source',
    version: 1,
    catalogPath: '/games-list',
    selector: '.post-title a'
  }
  expect(validateSourceRules([rule])).toHaveLength(1)
  expect(() =>
    validateSourceRules([{ ...rule, catalogPath: '//evil.test' }])
  ).toThrow()
  expect(() =>
    validateSourceRules([{ ...rule, selector: 'process.exit()' }])
  ).toThrow()
  expect(() => validateSourceRules([rule, rule])).toThrow()
})

it.each([
  ['com.ghost.ankergames-source', '/game/test'],
  ['com.ghost.online-fix-source', '/games/test.html'],
  ['com.ghost.steamrip-source', '/test-free-download/'],
  ['com.ghost.nxbrew-source', '/test-switch/'],
  ['com.ghost.nswgf-source', '/test-switch/'],
  ['com.ghost.romslab-source', '/test-switch/']
])('validates adaptive results for %s', (id, path) => {
  expect(isAdaptiveGamePath(id, path)).toBe(true)
  for (const invalid of [
    '/',
    '/account',
    '/category/action',
    '/file.zip',
    '/file.torrent'
  ])
    expect(isAdaptiveGamePath(id, invalid)).toBe(false)
})
