import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'graceful-fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  areAlazterflixAndGhostIptvInstalled,
  collectGhostIptvBackupData,
  getGhostIptvCanonicalAddonsPath,
  getGhostIptvCustomM3uDir,
  restoreGhostIptvBackupData
} from '../ghostIptvBackup'

function createTempUserData(): string {
  return mkdtempSync(join(tmpdir(), 'ghost-iptv-backup-test-'))
}

function installFakePlugin(
  userDataPath: string,
  id: string,
  name: string
): void {
  const dir = join(userDataPath, 'plugins', id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'plugin.json'),
    JSON.stringify({
      id,
      name,
      version: '1.0.0',
      author: 'Ghost',
      description: 'Test plugin',
      type: 'media',
      main: 'index.js'
    }),
    'utf8'
  )
}

describe('ghostIptvBackup conditional backup & functional restore', () => {
  const tempDirs: string[] = []

  const makeTemp = () => {
    const dir = createTempUserData()
    tempDirs.push(dir)
    return dir
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        try {
          rmSync(dir, { recursive: true, force: true })
        } catch {}
      }
    }
  })

  it('ignores backup when Alazterflix is NOT installed (even if Ghost IPTV and lists exist)', () => {
    const userData = makeTemp()
    installFakePlugin(userData, 'com.ghost.iptv', 'Ghost IPTV')
    writeFileSync(
      getGhostIptvCanonicalAddonsPath(userData),
      JSON.stringify([
        {
          id: 'custom_1',
          name: 'Brasil IPTV',
          manifest_url: 'https://iptv-org.github.io/iptv/countries/br.m3u',
          enabled: true
        }
      ]),
      'utf8'
    )

    expect(areAlazterflixAndGhostIptvInstalled(userData)).toBe(false)
    expect(collectGhostIptvBackupData({ userDataPath: userData })).toBeUndefined()
  })

  it('ignores backup when Ghost IPTV addon is NOT installed (even if Alazterflix is installed)', () => {
    const userData = makeTemp()
    installFakePlugin(userData, 'com.ghost.alazterflix', 'Alazterflix')

    expect(areAlazterflixAndGhostIptvInstalled(userData)).toBe(false)
    expect(
      collectGhostIptvBackupData({
        userDataPath: userData,
        pluginsData: {
          'com.ghost.alazterflix': {
            tv_playlists: [{ id: 'p1', name: 'Lista', url: 'https://example.com/a.m3u' }]
          }
        }
      })
    ).toBeUndefined()
  })

  it('ignores backup when both plugins are installed but only the default builtin source exists', () => {
    const userData = makeTemp()
    installFakePlugin(userData, 'com.ghost.alazterflix', 'Alazterflix')
    installFakePlugin(userData, 'com.ghost.iptv', 'Ghost IPTV')
    writeFileSync(
      getGhostIptvCanonicalAddonsPath(userData),
      JSON.stringify([
        {
          id: 'org.meufutebol',
          name: 'Meu Futebol',
          manifest_url: 'https://meufutebol.oneplayhd.com/manifest.json',
          source_type: 'builtin',
          enabled: true
        }
      ]),
      'utf8'
    )

    expect(areAlazterflixAndGhostIptvInstalled(userData)).toBe(true)
    expect(collectGhostIptvBackupData({ userDataPath: userData })).toBeUndefined()
  })

  it('collects and restores M3U URL lists, uploaded custom M3U files and native playlists functionally', () => {
    const sourceUserData = makeTemp()
    installFakePlugin(sourceUserData, 'com.ghost.alazterflix', 'Alazterflix')
    installFakePlugin(sourceUserData, 'com.ghost.iptv', 'Ghost IPTV')

    const customM3uDir = getGhostIptvCustomM3uDir(sourceUserData)
    mkdirSync(customM3uDir, { recursive: true })
    const sampleM3u = '#EXTM3U\n#EXTINF:-1,Canal Teste HD\nhttps://stream.example.com/live.m3u8\n'
    writeFileSync(join(customM3uDir, 'custom_m3u_100.m3u'), sampleM3u, 'utf8')

    writeFileSync(
      getGhostIptvCanonicalAddonsPath(sourceUserData),
      JSON.stringify([
        {
          id: 'org.meufutebol',
          name: 'Meu Futebol',
          source_type: 'builtin',
          enabled: true
        },
        {
          id: 'custom_5',
          name: 'Brasil IPTV',
          manifest_url: 'https://iptv-org.github.io/iptv/countries/br.m3u',
          group_override: 'Brasil IPTV',
          enabled: true
        },
        {
          id: 'custom_m3u_100',
          name: 'Minha Lista Local',
          manifest_url: 'http://127.0.0.1:8888/api/addons/m3u/custom_m3u_100.m3u',
          resolved_url: 'http://127.0.0.1:8888/api/addons/m3u/custom_m3u_100.m3u',
          source_type: 'm3u_file',
          enabled: true
        }
      ]),
      'utf8'
    )

    const collected = collectGhostIptvBackupData({
      userDataPath: sourceUserData,
      pluginsData: {
        'com.ghost.alazterflix': {
          tv_playlists: [{ id: 'pl-1', name: 'Minha M3U Nativa', url: 'https://example.com/list.m3u' }]
        }
      }
    })

    expect(collected).toBeDefined()
    expect(collected?.addons).toHaveLength(3)
    expect(collected?.customM3uFiles?.['custom_m3u_100']).toBe(sampleM3u)
    expect(collected?.nativePlaylists).toHaveLength(1)

    // Destino SEM plugins instalados deve ignorar a restauração
    const targetWithoutPlugins = makeTemp()
    const skippedRes = restoreGhostIptvBackupData({
      userDataPath: targetWithoutPlugins,
      backupData: { ghostIptvSources: collected }
    })
    expect(skippedRes.restored).toBe(false)
    expect(skippedRes.reason).toBe('plugins_not_installed')
    expect(existsSync(getGhostIptvCanonicalAddonsPath(targetWithoutPlugins))).toBe(false)

    // Destino COM Alazterflix + Ghost IPTV instalados deve restaurar tudo funcionalmente (incluindo porta do servidor)
    const targetWithPlugins = makeTemp()
    installFakePlugin(targetWithPlugins, 'com.ghost.alazterflix', 'Alazterflix')
    installFakePlugin(targetWithPlugins, 'com.ghost.iptv', 'Ghost IPTV')

    const restoredRes = restoreGhostIptvBackupData({
      userDataPath: targetWithPlugins,
      backupData: { ghostIptvSources: collected },
      serverPort: 8899
    })

    expect(restoredRes.restored).toBe(true)
    expect(restoredRes.addonsCount).toBe(2)
    expect(restoredRes.customM3uCount).toBe(1)
    expect(restoredRes.nativePlaylistsCount).toBe(1)

    const restoredAddons = JSON.parse(
      readFileSync(getGhostIptvCanonicalAddonsPath(targetWithPlugins), 'utf8')
    )
    expect(restoredAddons).toHaveLength(3)
    expect(restoredAddons[1].manifest_url).toBe('https://iptv-org.github.io/iptv/countries/br.m3u')
    expect(restoredAddons[2].manifest_url).toBe(
      'http://127.0.0.1:8899/api/addons/m3u/custom_m3u_100.m3u'
    )

    const restoredM3uFile = join(
      getGhostIptvCustomM3uDir(targetWithPlugins),
      'custom_m3u_100.m3u'
    )
    expect(existsSync(restoredM3uFile)).toBe(true)
    expect(readFileSync(restoredM3uFile, 'utf8')).toBe(sampleM3u)

    const restoredAlazterflixJson = JSON.parse(
      readFileSync(
        join(targetWithPlugins, 'plugins_data', 'com.ghost.alazterflix.json'),
        'utf8'
      )
    )
    expect(restoredAlazterflixJson.tv_playlists).toHaveLength(1)
  })
})
