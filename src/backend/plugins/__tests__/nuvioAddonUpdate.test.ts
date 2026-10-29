import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  NUVIO_GITHUB_REPO,
  NUVIO_GITHUB_URL,
  initializeNuvioAddonUpdate,
  nuvioAddonState,
  nuvioAddonAction,
  checkNuvioUpdates,
  installNuvioUpdate,
  restoreNuvioVersion,
  verifyNuvioAddon
} from '../nuvioAddonUpdate'
import { secureFetch } from '../secureDns'

jest.mock('../secureDns', () => ({
  secureFetch: jest.fn()
}))

jest.mock('electron', () => ({
  ...jest.requireActual('../../__mocks__/electron'),
  app: {
    getPath: jest.fn(),
    getAppPath: jest.fn(),
    isPackaged: false
  }
}))

describe('Nuvio Addon GitHub Update Engine (NuvioMedia/NuvioDesktop)', () => {
  let tempDir: string
  let mockPluginDir: string

  beforeEach(() => {
    jest.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-nuvio-update-test-'))
    mockPluginDir = path.join(tempDir, 'plugins', 'com.nuvio.player.addon')
    fs.mkdirSync(mockPluginDir, { recursive: true })

    // Create a mock plugin.json
    fs.writeFileSync(
      path.join(mockPluginDir, 'plugin.json'),
      JSON.stringify({
        id: 'com.nuvio.player.addon',
        name: 'Nuvio Media Player Addon',
        version: '0.1.32-alpha',
        homepage: 'https://github.com/NuvioMedia/NuvioDesktop',
        repository: 'NuvioMedia/NuvioDesktop',
        entrypoint: 'index.js'
      }, null, 2)
    )

    fs.writeFileSync(path.join(mockPluginDir, 'index.js'), '// Nuvio Addon')

    const electronMock = jest.requireMock('electron')
    electronMock.app.getPath.mockReturnValue(tempDir)
    electronMock.app.getAppPath.mockReturnValue(tempDir)

    initializeNuvioAddonUpdate(tempDir)
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  test('ties plugin update engine to official GitHub repo NuvioMedia/NuvioDesktop', () => {
    expect(NUVIO_GITHUB_REPO).toBe('NuvioMedia/NuvioDesktop')
    expect(NUVIO_GITHUB_URL).toBe('https://github.com/NuvioMedia/NuvioDesktop')
  })

  test('reports installed version and initial update state', async () => {
    const state = await nuvioAddonState()
    expect(state.installed).toBe('0.1.32-alpha')
    expect(state.githubRepo).toBe('NuvioMedia/NuvioDesktop')
    expect(state.githubUrl).toBe('https://github.com/NuvioMedia/NuvioDesktop')
    expect(state.automatic).toBe(true)
    expect(state.busy).toBe(false)
  })

  test('checks GitHub releases and detects when an upstream update is available in manual mode', async () => {
    await nuvioAddonAction({ type: 'automatic', enabled: false })

    const mockReleases = [
      {
        tag_name: 'v0.1.33-alpha',
        name: 'Nuvio Desktop v0.1.33-alpha',
        html_url: 'https://github.com/NuvioMedia/NuvioDesktop/releases/tag/v0.1.33-alpha',
        published_at: '2026-10-25T12:00:00Z',
        body: 'Improvements to player controls and subtitles.'
      }
    ]

    ;(secureFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleases
    })

    const state = await checkNuvioUpdates(true)
    expect(state.upstream).toBe('0.1.33-alpha')
    expect(state.installed).toBe('0.1.32-alpha')
    expect(state.updateAvailable).toBe(true)
    expect(state.upstreamUpdateAvailable).toBe(true)
    expect(state.upstreamChangelog).toContain('Improvements to player controls')
  })

  test('simulates manually installing an update with automated backup and rollback capability', async () => {
    await nuvioAddonAction({ type: 'automatic', enabled: false })

    // First simulate update found
    const mockReleases = [
      {
        tag_name: 'v0.1.33-alpha',
        name: 'Nuvio Desktop v0.1.33-alpha',
        html_url: 'https://github.com/NuvioMedia/NuvioDesktop/releases/tag/v0.1.33-alpha',
        published_at: '2026-10-25T12:00:00Z',
        body: 'New release'
      }
    ]
    ;(secureFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleases
    })
    await checkNuvioUpdates(true)

    // Now execute installation
    const installedState = await installNuvioUpdate()
    expect(installedState.installed).toBe('0.1.33-alpha')
    expect(installedState.previous).toBe('0.1.32-alpha')
    expect(installedState.updateAvailable).toBe(false)

    // Verify backup was created
    const backupDir = path.join(tempDir, 'plugin_installation_backups', 'com.nuvio.player.addon-backup')
    expect(fs.existsSync(backupDir)).toBe(true)
    expect(fs.existsSync(path.join(backupDir, 'plugin.json'))).toBe(true)

    // Now test restore / rollback to previous version
    const restoredState = await restoreNuvioVersion()
    expect(restoredState.installed).toBe('0.1.32-alpha')
    expect(restoredState.previous).toBeUndefined()
  })

  test('automatically checks and installs update when automatic updates are enabled', async () => {
    await nuvioAddonAction({ type: 'automatic', enabled: true })

    const mockReleases = [
      {
        tag_name: 'v0.1.33-alpha',
        name: 'Nuvio Desktop v0.1.33-alpha',
        html_url: 'https://github.com/NuvioMedia/NuvioDesktop/releases/tag/v0.1.33-alpha',
        published_at: '2026-10-25T12:00:00Z',
        body: 'Automatic update release'
      }
    ]
    ;(secureFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleases
    })

    const autoState = await checkNuvioUpdates(true)
    expect(autoState.installed).toBe('0.1.33-alpha')
    expect(autoState.previous).toBe('0.1.32-alpha')
    expect(autoState.updateAvailable).toBe(false)
  })

  test('preserves custom manifest fields and custom files across updates without destruction', async () => {
    const customManifest = {
      id: 'com.nuvio.player.addon',
      name: 'Nuvio Media Player & Addon (Stremio + Alazterflix)',
      version: '0.1.32-alpha',
      description: 'Custom tailored description for Ghost Launcher',
      author: 'Custom Tailored Author',
      entrypoint: 'index.js',
      style: 'theme.css',
      permissions: ['ui:inject-css', 'ui:widgets', 'network', 'storage', 'media'],
      allowedDomains: ['custom.example.org', '*.strem.io'],
      tier: 1,
      minGhostVersion: '0.1.0'
    }
    fs.writeFileSync(path.join(mockPluginDir, 'plugin.json'), JSON.stringify(customManifest, null, 2))
    fs.writeFileSync(path.join(mockPluginDir, 'index.js'), '// Tailored Ghost Nuvio Logic')
    fs.writeFileSync(path.join(mockPluginDir, 'theme.css'), '/* Cyber-Neon Theme */')

    // Simulate update found and installed
    await installNuvioUpdate()

    // Read back manifest and files
    const updatedManifest = JSON.parse(fs.readFileSync(path.join(mockPluginDir, 'plugin.json'), 'utf8'))
    expect(updatedManifest.version).toBe('0.1.33-alpha')
    expect(updatedManifest.description).toBe('Custom tailored description for Ghost Launcher')
    expect(updatedManifest.author).toBe('Custom Tailored Author')
    expect(updatedManifest.allowedDomains).toContain('custom.example.org')
    expect(updatedManifest.allowedDomains).toContain('*.strem.io')
    expect(updatedManifest.allowedDomains).toContain('api.themoviedb.org')

    // Custom code and styles are intact
    expect(fs.readFileSync(path.join(mockPluginDir, 'index.js'), 'utf8')).toBe('// Tailored Ghost Nuvio Logic')
    expect(fs.readFileSync(path.join(mockPluginDir, 'theme.css'), 'utf8')).toBe('/* Cyber-Neon Theme */')
  })

  test('enabling automatic updates immediately triggers check and auto-install', async () => {
    await nuvioAddonAction({ type: 'automatic', enabled: false })

    const mockReleases = [
      {
        tag_name: 'v0.1.33-alpha',
        name: 'Nuvio Desktop v0.1.33-alpha',
        html_url: 'https://github.com/NuvioMedia/NuvioDesktop/releases/tag/v0.1.33-alpha',
        published_at: '2026-10-25T12:00:00Z',
        body: 'New release via toggle'
      }
    ]
    ;(secureFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockReleases
    })

    const result = await nuvioAddonAction({ type: 'automatic', enabled: true })
    expect(result.automatic).toBe(true)
    expect(result.installed).toBe('0.1.33-alpha')
  })

  test('verifies integrity of installed Nuvio Addon and fails on missing files', async () => {
    const verified = verifyNuvioAddon()
    expect(verified.installed).toBe('0.1.32-alpha')
    expect(verified.message).toContain('verificada')

    // Remove index.js to simulate missing file
    fs.rmSync(path.join(mockPluginDir, 'index.js'))
    expect(() => verifyNuvioAddon()).toThrow('Arquivos essenciais do Nuvio Addon estão ausentes.')
  })

  test('handles nuvioAddonAction requests seamlessly (check, automatic, restore, verify)', async () => {
    const autoResult = await nuvioAddonAction({ type: 'automatic', enabled: false })
    expect(autoResult.automatic).toBe(false)

    const verifyResult = await nuvioAddonAction({ type: 'verify' })
    expect(verifyResult.installed).toBe('0.1.32-alpha')
    expect(verifyResult.message).toContain('verificada')
  })
})
