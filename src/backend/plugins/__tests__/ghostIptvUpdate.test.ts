import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  GHOST_IPTV_GITHUB_REPO,
  GHOST_IPTV_GITHUB_URL,
  initializeGhostIptvUpdate,
  ghostIptvState,
  ghostIptvAction,
  checkGhostIptvUpdates,
  performGhostIptvInstall,
  syncGhostIptvFromLocalDev,
  readInstalledVersionFromManifest,
  isInstalledWebOutOfSync,
  setGhostIptvLocalDevPathForTest
} from '../ghostIptvUpdate'
import { resolveWebDirectory } from '../ghostIptvServer'
import { secureFetch } from '../secureDns'

jest.mock('../secureDns', () => ({
  secureFetch: jest.fn()
}))

jest.mock('electron', () => {
  const actual = jest.requireActual('../../__mocks__/electron')
  const tmp = require('os').tmpdir()
  return {
    ...actual,
    app: {
      ...actual.app,
      getPath: jest.fn(() => tmp),
      getAppPath: jest.fn(() => tmp),
      isPackaged: false
    }
  }
})

describe('Ghost IPTV GitHub & Local Update Engine (alazter/ghost-iptv)', () => {
  let tempDir: string
  let mockPluginDir: string
  let mockLocalDevDir: string

  beforeEach(() => {
    jest.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-iptv-update-test-'))
    mockPluginDir = path.join(tempDir, 'plugins', 'com.ghost.iptv')
    mockLocalDevDir = path.join(tempDir, 'local-dev-ghost-iptv')
    fs.mkdirSync(path.join(mockPluginDir, 'web', 'assets'), { recursive: true })
    setGhostIptvLocalDevPathForTest(null)

    fs.writeFileSync(
      path.join(mockPluginDir, 'plugin.json'),
      JSON.stringify(
        {
          id: 'com.ghost.iptv',
          name: 'Ghost IPTV - Alazterflix Addon',
          version: '2.4.6',
          homepage: 'https://github.com/alazter/ghost-iptv',
          repository: 'alazter/ghost-iptv',
          entrypoint: 'index.js'
        },
        null,
        2
      )
    )
    fs.writeFileSync(
      path.join(mockPluginDir, 'version.json'),
      JSON.stringify({ version: '2.4.6', build_number: 246 }, null, 2)
    )
    fs.writeFileSync(
      path.join(mockPluginDir, 'web', 'version.json'),
      JSON.stringify({ version: '2.4.6', build_number: 246 }, null, 2)
    )
    fs.writeFileSync(
      path.join(mockPluginDir, 'web', 'alazterflix_tv.html'),
      '<!DOCTYPE html><html><head></head><body><span class="version-badge" id="headerVersionBadge">v2.4.6</span></body></html>'
    )
    fs.writeFileSync(path.join(mockPluginDir, 'index.js'), '// Ghost IPTV Plugin')

    const electronMock = jest.requireMock('electron')
    electronMock.app.getPath.mockReturnValue(tempDir)
    electronMock.app.getAppPath.mockReturnValue(tempDir)

    initializeGhostIptvUpdate(tempDir)
  })

  afterEach(() => {
    setGhostIptvLocalDevPathForTest(undefined)
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  test('ties plugin update engine to official GitHub repo alazter/ghost-iptv', () => {
    expect(GHOST_IPTV_GITHUB_REPO).toBe('alazter/ghost-iptv')
    expect(GHOST_IPTV_GITHUB_URL).toBe('https://github.com/alazter/ghost-iptv')
  })

  test('detects out-of-sync installation when plugin.json claims 2.4.8 but web/alazterflix_tv.html is still 2.4.6', () => {
    // Simulate the exact bug where plugin.json was bumped to 2.4.8 without updating web/alazterflix_tv.html
    fs.writeFileSync(
      path.join(mockPluginDir, 'plugin.json'),
      JSON.stringify({ id: 'com.ghost.iptv', version: '2.4.8' }, null, 2)
    )

    expect(readInstalledVersionFromManifest()).toBe('2.4.6')
    expect(isInstalledWebOutOfSync('2.4.8')).toBe(true)
  })

  test('checks GitHub releases and detects upstream update when automatic updates are disabled', async () => {
    await ghostIptvAction({ type: 'set-automatic', automatic: false })

    const mockReleases = [
      {
        tag_name: 'v2.4.8',
        name: 'Ghost IPTV v2.4.8',
        html_url: 'https://github.com/alazter/ghost-iptv/releases/tag/v2.4.8',
        published_at: '2026-11-07T17:25:41Z',
        body: 'Controles de volume, proporcao 16:9/EST e divisor redimensionavel.'
      }
    ]

    ;(secureFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleases
    })

    const st = await checkGhostIptvUpdates(true)
    expect(st.installed).toBe('2.4.6')
    expect(st.upstream).toBe('2.4.8')
    expect(st.updateAvailable).toBe(true)
    expect(st.upstreamUpdateAvailable).toBe(true)
    expect(st.upstreamChangelog).toContain('Controles de volume')
  })

  test('synchronizes full web/ and assets/ payload from local dev repo during update and supports rollback', async () => {
    fs.mkdirSync(path.join(mockLocalDevDir, 'web', 'assets'), { recursive: true })
    fs.mkdirSync(path.join(mockLocalDevDir, 'assets'), { recursive: true })
    fs.writeFileSync(
      path.join(mockLocalDevDir, 'version.json'),
      JSON.stringify(
        {
          version: '2.4.8',
          build_number: 248,
          changelog: ['Novo player v2.4.8 com PiP e slider de volume']
        },
        null,
        2
      )
    )
    const v248Html =
      '<!DOCTYPE html><html><head><script id="embeddedEpgData">window.EMBEDDED_CHANNELS = [{"id":"ch1"}];</script></head><body><span class="version-badge" id="headerVersionBadge">v2.4.8</span></body></html>'
    fs.writeFileSync(
      path.join(mockLocalDevDir, 'web', 'alazterflix_tv.html'),
      v248Html
    )
    fs.writeFileSync(
      path.join(mockLocalDevDir, 'assets', 'channels_cache.json'),
      JSON.stringify([{ id: 'meufutebol:espn', name: 'ESPN' }])
    )

    setGhostIptvLocalDevPathForTest(mockLocalDevDir)

    await performGhostIptvInstall('2.4.8', '2.4.6')

    const st = ghostIptvState()
    expect(st.installed).toBe('2.4.8')
    expect(st.previous).toBe('2.4.6')
    expect(st.updateAvailable).toBe(false)

    // Verify actual HTML and version.json files were updated on disk
    const installedHtml = fs.readFileSync(
      path.join(mockPluginDir, 'web', 'alazterflix_tv.html'),
      'utf-8'
    )
    expect(installedHtml).toContain('id="headerVersionBadge">v2.4.8</span>')
    expect(installedHtml).toContain('window.EMBEDDED_CHANNELS')

    const installedWebVer = JSON.parse(
      fs.readFileSync(path.join(mockPluginDir, 'web', 'version.json'), 'utf-8')
    )
    expect(installedWebVer.version).toBe('2.4.8')

    // Test rollback to 2.4.6
    const rolledBack = await ghostIptvAction({ type: 'rollback' })
    expect(rolledBack.installed).toBe('2.4.6')
    const rolledHtml = fs.readFileSync(
      path.join(mockPluginDir, 'web', 'alazterflix_tv.html'),
      'utf-8'
    )
    expect(rolledHtml).toContain('id="headerVersionBadge">v2.4.6</span>')
  })

  test('resolveWebDirectory chooses highest version directory over stale v2.4.6 directory', () => {
    const staleDir = path.join(tempDir, 'stale-web')
    const freshDir = path.join(tempDir, 'fresh-web')
    fs.mkdirSync(staleDir, { recursive: true })
    fs.mkdirSync(freshDir, { recursive: true })

    fs.writeFileSync(
      path.join(staleDir, 'version.json'),
      JSON.stringify({ version: '2.4.6', build_number: 246 })
    )
    fs.writeFileSync(
      path.join(staleDir, 'alazterflix_tv.html'),
      '<html><body><span id="headerVersionBadge">v2.4.6</span></body></html>'
    )

    fs.writeFileSync(
      path.join(freshDir, 'version.json'),
      JSON.stringify({ version: '2.4.8', build_number: 248 })
    )
    fs.writeFileSync(
      path.join(freshDir, 'alazterflix_tv.html'),
      '<html><body><span id="headerVersionBadge">v2.4.8</span></body></html>'
    )

    const chosen = resolveWebDirectory([staleDir, freshDir])
    expect(chosen).toBe(freshDir)
  })

  test('syncGhostIptvFromLocalDev copies all web/ and assets/ files and updates manifest', async () => {
    fs.mkdirSync(path.join(mockLocalDevDir, 'web'), { recursive: true })
    fs.mkdirSync(path.join(mockLocalDevDir, 'assets'), { recursive: true })
    fs.writeFileSync(
      path.join(mockLocalDevDir, 'version.json'),
      JSON.stringify({ version: '2.4.8', build_number: 248 })
    )
    fs.writeFileSync(
      path.join(mockLocalDevDir, 'web', 'alazterflix_tv.html'),
      '<html><body><span id="headerVersionBadge">v2.4.8</span></body></html>'
    )
    setGhostIptvLocalDevPathForTest(mockLocalDevDir)

    const res = await syncGhostIptvFromLocalDev()
    expect(res.success).toBe(true)
    expect(res.state.installed).toBe('2.4.8')
    expect(res.state.updateAvailable).toBe(false)
  })
})
