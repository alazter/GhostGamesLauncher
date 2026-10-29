import fs from 'fs'
import path from 'path'
import {
  DEFAULT_NUVIO_PREFERENCES,
  formatNuvioClock,
  getPreferredVideoPlayer,
  hexToRgba,
  loadNuvioPlayerPreferences,
  loadNuvioSkipSegments,
  parseTimeInputToSeconds,
  saveNuvioPlayerPreferences,
  saveNuvioSkipSegment,
  setPreferredVideoPlayer
} from '../../../frontend/screens/Alazterflix/nuvioPlayerConfig'
import {
  RECOMMENDED_STREMIO_ADDONS,
  normalizeStremioAddonUrl,
  generateStremioShareLinks
} from '../../../common/stremioAddonUtils'

describe('Nuvio Media Player Addon & Alazterflix Player Selection', () => {
  const store = new Map<string, string>()

  beforeAll(() => {
    const mockStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear()
    }
    ;(global as any).localStorage = mockStorage
    if (!(global as any).window) {
      ;(global as any).window = {
        dispatchEvent: () => true
      }
    } else if (!(global as any).window.dispatchEvent) {
      ;(global as any).window.dispatchEvent = () => true
    }
    if (!(global as any).Event) {
      ;(global as any).Event = class {
        type: string
        constructor(type: string) {
          this.type = type
        }
      }
    }
    if (!(global as any).CustomEvent) {
      ;(global as any).CustomEvent = class {
        type: string
        detail: any
        constructor(type: string, init?: { detail?: any }) {
          this.type = type
          this.detail = init?.detail
        }
      }
    }
  })

  beforeEach(() => {
    store.clear()
  })

  test('defaults to Nuvio Media Player and persists player switching between nuvio and alazterflix', () => {
    expect(getPreferredVideoPlayer()).toBe('nuvio')

    setPreferredVideoPlayer('alazterflix')
    expect(getPreferredVideoPlayer()).toBe('alazterflix')
    expect(loadNuvioPlayerPreferences().preferredPlayer).toBe('alazterflix')

    setPreferredVideoPlayer('nuvio')
    expect(getPreferredVideoPlayer()).toBe('nuvio')
    expect(loadNuvioPlayerPreferences().preferredPlayer).toBe('nuvio')
  })

  test('persists Nuvio Desktop player preferences (3-Rail subtitle styling, overlays, hold-to-speed 2x)', () => {
    const initial = loadNuvioPlayerPreferences()
    expect(initial).toEqual(DEFAULT_NUVIO_PREFERENCES)

    const updated = saveNuvioPlayerPreferences({
      pauseOverlayEnabled: false,
      holdToSpeedValue: 2.0,
      blurUnwatchedEpisodes: true,
      subtitleFontSize: 34,
      subtitleTextColor: '#f5c518',
      subtitleBackgroundColor: '#3b0764',
      subtitleBackgroundOpacity: 0,
      defaultResizeMode: 'zoom'
    })

    expect(updated.pauseOverlayEnabled).toBe(false)
    expect(updated.blurUnwatchedEpisodes).toBe(true)
    expect(updated.subtitleFontSize).toBe(34)
    expect(updated.subtitleTextColor).toBe('#f5c518')
    expect(updated.subtitleBackgroundColor).toBe('#3b0764')
    expect(updated.subtitleBackgroundOpacity).toBe(0)
    expect(updated.defaultResizeMode).toBe('zoom')
    expect(loadNuvioPlayerPreferences().subtitleFontSize).toBe(34)
    expect(loadNuvioPlayerPreferences().subtitleBackgroundColor).toBe('#3b0764')
    expect(loadNuvioPlayerPreferences().subtitleBackgroundOpacity).toBe(0)
  })

  test('converts hex colors to rgba with opacity and handles transparent correctly', () => {
    expect(hexToRgba('#080a10', 0.42)).toBe('rgba(8, 10, 16, 0.42)')
    expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(hexToRgba('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)')
    expect(hexToRgba('transparent', 0.5)).toBe('transparent')
  })

  test('stores and retrieves Skip Intro / Recap / Outro segments per media key', () => {
    const mediaKey = 'tt0903747:S1E1'
    expect(loadNuvioSkipSegments(mediaKey)).toEqual([])

    saveNuvioSkipSegment(mediaKey, {
      segmentType: 'intro',
      startSec: 12,
      endSec: 95
    })
    saveNuvioSkipSegment(mediaKey, {
      segmentType: 'outro',
      startSec: 2700,
      endSec: 2820
    })

    const segments = loadNuvioSkipSegments(mediaKey)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({
      segmentType: 'intro',
      startSec: 12,
      endSec: 95
    })
    expect(segments[1]).toEqual({
      segmentType: 'outro',
      startSec: 2700,
      endSec: 2820
    })
  })

  test('parses MM:SS / HH:MM:SS timestamps and formats Nuvio clock strings accurately', () => {
    expect(parseTimeInputToSeconds('01:25')).toBe(85)
    expect(parseTimeInputToSeconds('01:02:03')).toBe(3723)
    expect(parseTimeInputToSeconds('45')).toBe(45)
    expect(parseTimeInputToSeconds('invalid')).toBeNull()

    expect(formatNuvioClock(85)).toBe('01:25')
    expect(formatNuvioClock(3723)).toBe('01:02:03')
  })

  test('registers Nuvio Media Player Addon in RECOMMENDED_STREMIO_ADDONS and normalizes Share Addon URLs', () => {
    const nuvioEntry = RECOMMENDED_STREMIO_ADDONS.find(
      (a) => a.id === 'com.nuvio.player.addon'
    )
    expect(nuvioEntry).toBeDefined()
    expect(nuvioEntry?.manifestUrl).toBe(
      'https://nuvio-player.strem.io/manifest.json'
    )

    const shareLinks = generateStremioShareLinks(nuvioEntry!.manifestUrl)
    expect(normalizeStremioAddonUrl(shareLinks.webShareUrl)).toBe(
      'https://nuvio-player.strem.io/manifest.json'
    )
    expect(normalizeStremioAddonUrl(shareLinks.stremioProtocolUrl)).toBe(
      'https://nuvio-player.strem.io/manifest.json'
    )
  })

  test('contains a valid standalone Ghost plugin package in plugins/nuvio-player-addon', () => {
    const pluginDir = path.resolve(
      __dirname,
      '../../../../plugins/nuvio-player-addon'
    )
    const manifestPath = path.join(pluginDir, 'plugin.json')
    const mainPath = path.join(pluginDir, 'index.js')
    const cssPath = path.join(pluginDir, 'theme.css')

    expect(fs.existsSync(manifestPath)).toBe(true)
    expect(fs.existsSync(mainPath)).toBe(true)
    expect(fs.existsSync(cssPath)).toBe(true)

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    expect(manifest.id).toBe('com.nuvio.player.addon')
    expect(manifest.type).toBe('media')
    expect(manifest.tier).toBe(1)
  })
})
