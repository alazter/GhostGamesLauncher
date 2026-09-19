import { NetworkGuard } from '../networkGuard'
import {
  cleanGameTitle,
  extractGameMetadataFromHtml,
  extractVersionFromText,
  matchesQuery,
  parseWebsiteGames,
  websiteSource
} from '../websiteSource'
import type { PluginManifest, WebsiteSourceConfig } from 'common/types/plugins'

const manifest = {
  id: 'source',
  name: 'Source',
  homepage: 'https://example.com',
  permissions: ['network', 'game-sources'],
  allowedDomains: ['example.com']
} as PluginManifest
const config: WebsiteSourceConfig = {
  catalogPath: '/games',
  gamePathPrefix: '/game/',
  platform: 'windows'
}

it('extracts only game pages from the declared website', () => {
  const games = parseWebsiteGames(
    '<a href="/game/example">Example Game</a><a href="/account">Account</a><a href="https://foreign.test/game/other">Other</a>',
    manifest.homepage!,
    config,
    manifest
  )
  expect(games.map((game) => game.id)).toEqual([
    'https://example.com/game/example'
  ])
})

it('offers actual ZIP links only on declared download domains', async () => {
  const request = jest
    .spyOn(NetworkGuard, 'fetchResponse')
    .mockResolvedValue(
      new Response(
        '<a href="/files/game.zip">Download</a><a href="https://unknown.test/file.zip">Mirror</a>'
      )
    )
  try {
    const sources = await websiteSource(manifest, config).getSources(
      'https://example.com/game/example'
    )
    expect(
      sources
        .filter((source) => source.type === 'direct')
        .map((source) => source.url)
    ).toEqual(['https://example.com/files/game.zip'])
    expect(sources.some((source) => source.type === 'external')).toBe(true)
  } finally {
    request.mockRestore()
  }
})

it('uses an explicit interactive source when the website requires verification', async () => {
  const request = jest
    .spyOn(NetworkGuard, 'fetchResponse')
    .mockResolvedValue(new Response('Just a moment', { status: 403 }))
  try {
    const sources = await websiteSource(manifest, config).getSources(
      'https://example.com/game/example'
    )
    expect(sources).toHaveLength(1)
    expect(sources[0].type).toBe('external')
  } finally {
    request.mockRestore()
  }
})

describe('cleanGameTitle and matchesQuery', () => {
  it('cleans cyrillic boilerplate and free download tags', () => {
    expect(cleanGameTitle('MARVEL Tokon Fighting Souls по сети')).toBe('MARVEL Tokon Fighting Souls')
    expect(cleanGameTitle('PAYDAY 3 скачать торрент')).toBe('PAYDAY 3')
    expect(cleanGameTitle('Super Game Free Download')).toBe('Super Game')
    expect(cleanGameTitle('Title with \uFFFD replacement chars')).toBe('Title with replacement chars')
  })

  it('matches accented characters and rejects completely unrelated games', () => {
    expect(matchesQuery('MARVEL Tōkon: Fighting Souls', 'tokon')).toBe(true)
    expect(matchesQuery('MARVEL Tokon Fighting Souls по сети', 'tokon')).toBe(true)
    expect(matchesQuery('inZOI', 'inzoi')).toBe(true)
    expect(matchesQuery('PAYDAY 3', 'tokon')).toBe(false)
    expect(matchesQuery('Bodycam', 'tokon')).toBe(false)
    expect(matchesQuery('Palworld', 'tokon')).toBe(false)
    expect(matchesQuery('\uFFFD\uFFFD\uFFFD', 'tokon')).toBe(false)
    expect(matchesQuery('', 'tokon')).toBe(false)
  })
})

describe('extractVersionFromText', () => {
  it('extracts version from SteamRIP card and detail page', () => {
    expect(extractVersionFromText('<span class="tagmetafield">Build 24832302</span>')).toBe('Build 24832302')
    expect(extractVersionFromText('<li><strong>Version</strong>: v1.2.3 | Build 24832302</li>')).toBe('v1.2.3 (Build 24832302)')
  })

  it('extracts version from Online-Fix card and detail page in cyrillic', () => {
    expect(extractVersionFromText('<div class="edit">Игра обновлена до версии 1.3.0. Обновлён фикс.</div>')).toBe('v1.3.0')
    expect(extractVersionFromText('<b>Версия игры: 1.3.0</b>')).toBe('v1.3.0')
  })

  it('extracts version from AnkerGames and Switch update patterns', () => {
    expect(extractVersionFromText('<span title="V 1.3.0">V 1.3.0</span>')).toBe('v1.3.0')
    expect(extractVersionFromText('Mario [01007E3006DDA800][v131072]')).toBe('v131072')
    expect(extractVersionFromText('Game (v1.0.4)')).toBe('v1.0.4')
  })
})

describe('windows-1251 decoding in websiteSource', () => {
  it('decodes windows-1251 content correctly into cyrillic without replacement chars', async () => {
    const cyrillicText = 'MARVEL Tokon Fighting Souls по сети'
    // Encode cyrillicText into windows-1251 buffer
    const buf = Buffer.from([
      0x4d, 0x41, 0x52, 0x56, 0x45, 0x4c, 0x20, 0x54, 0x6f, 0x6b, 0x6f, 0x6e, 0x20,
      0x46, 0x69, 0x67, 0x68, 0x74, 0x69, 0x6e, 0x67, 0x20, 0x53, 0x6f, 0x75, 0x6c, 0x73, 0x20,
      0xef, 0xee, 0x20, 0xf1, 0xe5, 0xf2, 0xe8
    ])
    const htmlWithCyrillic = `<html><head><meta charset="windows-1251"></head><body><div class="article clr"><a href="https://online-fix.me/game/18201.html"><h2>${new TextDecoder('windows-1251').decode(buf)}</h2></a><div class="edit">Игра обновлена до версии 1.3.0</div></div></body></html>`
    const encBuf = Buffer.concat([
      Buffer.from('<html><head><meta charset="windows-1251"></head><body><div class="article clr"><a href="https://online-fix.me/game/18201.html"><h2>MARVEL Tokon Fighting Souls '),
      Buffer.from([0xef, 0xee, 0x20, 0xf1, 0xe5, 0xf2, 0xe8]),
      Buffer.from('</h2></a><div class="edit">'),
      Buffer.from([0xc8, 0xe3, 0xf0, 0xe0, 0x20, 0xee, 0xe1, 0xed, 0xee, 0xe2, 0xeb, 0xe5, 0xed, 0xe0, 0x20, 0xe4, 0xee, 0x20, 0xe2, 0xe5, 0xf0, 0xf1, 0xe8, 0xe8, 0x20, 0x31, 0x2e, 0x33, 0x2e, 0x30]),
      Buffer.from('</div></div></body></html>')
    ])

    const ofManifest = {
      ...manifest,
      id: 'com.ghost.onlinefix',
      name: 'Online-Fix',
      homepage: 'https://online-fix.me',
      allowedDomains: ['online-fix.me']
    } as PluginManifest

    const fetchSpy = jest.spyOn(NetworkGuard, 'fetchResponse').mockResolvedValue(
      new Response(encBuf, {
        headers: { 'content-type': 'text/html; charset=windows-1251' }
      })
    )

    try {
      const source = websiteSource(ofManifest, { ...config, catalogPath: '/' })
      const results = await source.search('tokon')
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('MARVEL Tokon Fighting Souls')
      expect(results[0].version).toBe('v1.3.0')
      expect(results[0].title).not.toContain('\uFFFD')
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('extractGameMetadataFromHtml', () => {
  it('extracts metadata from SteamRIP game page', () => {
    const steamRipHtml = `
      <span class="date meta-item tie-icon"><span class="fa fa-clock-o"></span>March 29, 2025</span>
      <li><strong>Released By:</strong> RUNE</li>
      <li><strong>Game Size:</strong> 35.1 GB</li>
      <div class="entry-content"><p>Online multiplayer mode available with co-op.</p></div>
    `
    const meta = extractGameMetadataFromHtml(steamRipHtml, 'com.ghost.steamrip-source')
    expect(meta.uploadDate).toBe('March 29, 2025')
    expect(meta.cracker).toBe('RUNE')
    expect(meta.uploader).toBe('SteamRIP')
    expect(meta.size).toBe('35.1 GB')
    expect(meta.mode).toBe('Multiplayer / Co-op')
  })

  it('extracts metadata from AnkerGames game page', () => {
    const ankerHtml = `
      <div>Content Update Summary Updated by Carzed (Sep 11, 2026 at 07:39 AM)</div>
      <span title="Release Group: Own CSF">Own CSF</span>
      <span class="truncate">76.10 GB</span>
      <p>Singleplayer and multiplayer co-op</p>
    `
    const meta = extractGameMetadataFromHtml(ankerHtml, 'com.ghost.ankergames-source')
    expect(meta.uploadDate).toBe('Sep 11, 2026')
    expect(meta.uploader).toBe('Carzed')
    expect(meta.cracker).toBe('Own CSF')
    expect(meta.size).toBe('76.10 GB')
    expect(meta.mode).toBe('Multiplayer / Co-op')
  })

  it('identifies Online-Fix cracker, uploader, and mode by default', () => {
    const ofHtml = `
      <div class="svchk__date">26-08-2025, 14:48</div>
      <div>Играть по сети</div>
    `
    const meta = extractGameMetadataFromHtml(ofHtml, 'com.ghost.onlinefix')
    expect(meta.uploadDate).toBe('26-08-2025')
    expect(meta.cracker).toBe('Online-Fix')
    expect(meta.uploader).toBe('Online-Fix')
    expect(meta.mode).toBe('Multiplayer / Co-op')
  })
})

