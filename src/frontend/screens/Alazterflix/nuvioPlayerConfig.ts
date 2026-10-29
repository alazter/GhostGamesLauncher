export type AlazterflixVideoPlayerId = 'nuvio' | 'alazterflix'

export type NuvioResizeMode = 'fit' | 'zoom' | 'stretch' | 'fill'

export interface NuvioPlayerPreferences {
  preferredPlayer: AlazterflixVideoPlayerId
  pauseOverlayEnabled: boolean
  openingOverlayEnabled: boolean
  holdToSpeedEnabled: boolean
  holdToSpeedValue: number
  blurUnwatchedEpisodes: boolean
  autoPlayNextEpisode: boolean
  showRemainingTime: boolean
  defaultResizeMode: NuvioResizeMode
  customSubtitleStylingEnabled: boolean
  subtitleFontSize: number
  subtitleBottomOffset: number
  subtitleBold: boolean
  subtitleTextColor: string
  subtitleTextOpacity: number
  subtitleOutlineEnabled: boolean
  subtitleOutlineColor: string
  subtitleBackgroundColor: string
  subtitleBackgroundOpacity: number
}

export interface NuvioSkipSegment {
  segmentType: 'intro' | 'recap' | 'outro'
  startSec: number
  endSec: number
}

export const NUVIO_PLAYER_STORAGE_KEY = 'ghost_alazterflix_video_player'
export const NUVIO_PREFS_STORAGE_KEY = 'ghost_nuvio_player_preferences'
export const NUVIO_SEGMENTS_STORAGE_KEY = 'ghost_nuvio_skip_segments'

export const DEFAULT_NUVIO_PREFERENCES: NuvioPlayerPreferences = {
  preferredPlayer: 'nuvio',
  pauseOverlayEnabled: true,
  openingOverlayEnabled: true,
  holdToSpeedEnabled: true,
  holdToSpeedValue: 2.0,
  blurUnwatchedEpisodes: false,
  autoPlayNextEpisode: true,
  showRemainingTime: false,
  defaultResizeMode: 'fit',
  customSubtitleStylingEnabled: true,
  subtitleFontSize: 28,
  subtitleBottomOffset: 42,
  subtitleBold: false,
  subtitleTextColor: '#ffffff',
  subtitleTextOpacity: 100,
  subtitleOutlineEnabled: true,
  subtitleOutlineColor: '#000000',
  subtitleBackgroundColor: '#080a10',
  subtitleBackgroundOpacity: 42
}

/**
 * Converts a Hex color (#RRGGBB or #RGB) and alpha (0 to 1) into an rgba(...) string.
 */
export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex === 'transparent') return 'transparent'
  const clean = hex.replace('#', '').trim()
  let r = 0
  let g = 0
  let b = 0
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0
    g = parseInt(clean[1] + clean[1], 16) || 0
    b = parseInt(clean[2] + clean[2], 16) || 0
  } else if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16) || 0
    g = parseInt(clean.substring(2, 4), 16) || 0
    b = parseInt(clean.substring(4, 6), 16) || 0
  }
  const clampedAlpha = Math.max(0, Math.min(1, Number(alpha.toFixed(2))))
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`
}

export function getPreferredVideoPlayer(): AlazterflixVideoPlayerId {
  try {
    const raw = localStorage.getItem(NUVIO_PLAYER_STORAGE_KEY)
    if (raw === 'alazterflix' || raw === 'nuvio') {
      return raw
    }
    const prefsRaw = localStorage.getItem(NUVIO_PREFS_STORAGE_KEY)
    if (prefsRaw) {
      const parsed = JSON.parse(prefsRaw)
      if (
        parsed?.preferredPlayer === 'alazterflix' ||
        parsed?.preferredPlayer === 'nuvio'
      ) {
        return parsed.preferredPlayer
      }
    }
  } catch {
    // Fallback
  }
  return 'nuvio'
}

export function setPreferredVideoPlayer(
  player: AlazterflixVideoPlayerId
): void {
  const valid: AlazterflixVideoPlayerId =
    player === 'alazterflix' ? 'alazterflix' : 'nuvio'
  try {
    localStorage.setItem(NUVIO_PLAYER_STORAGE_KEY, valid)
    const prefs = loadNuvioPlayerPreferences()
    prefs.preferredPlayer = valid
    localStorage.setItem(NUVIO_PREFS_STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(
      new CustomEvent('ghost-nuvio-player-changed', { detail: valid })
    )
  } catch {
    // Ignore storage error
  }
}

export function loadNuvioPlayerPreferences(): NuvioPlayerPreferences {
  try {
    const raw = localStorage.getItem(NUVIO_PREFS_STORAGE_KEY)
    const explicitPlayer = localStorage.getItem(NUVIO_PLAYER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_NUVIO_PREFERENCES,
        ...parsed,
        preferredPlayer:
          explicitPlayer === 'alazterflix' || explicitPlayer === 'nuvio'
            ? explicitPlayer
            : parsed.preferredPlayer === 'alazterflix'
              ? 'alazterflix'
              : 'nuvio'
      }
    }
    if (explicitPlayer === 'alazterflix' || explicitPlayer === 'nuvio') {
      return {
        ...DEFAULT_NUVIO_PREFERENCES,
        preferredPlayer: explicitPlayer
      }
    }
  } catch {
    // Ignore parse error
  }
  return { ...DEFAULT_NUVIO_PREFERENCES }
}

export function saveNuvioPlayerPreferences(
  updates: Partial<NuvioPlayerPreferences>
): NuvioPlayerPreferences {
  const current = loadNuvioPlayerPreferences()
  const merged: NuvioPlayerPreferences = {
    ...current,
    ...updates
  }
  try {
    localStorage.setItem(NUVIO_PREFS_STORAGE_KEY, JSON.stringify(merged))
    if (updates.preferredPlayer) {
      localStorage.setItem(NUVIO_PLAYER_STORAGE_KEY, updates.preferredPlayer)
    }
    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(
      new CustomEvent('ghost-nuvio-prefs-changed', { detail: merged })
    )
  } catch {
    // Ignore storage error
  }
  return merged
}

export function loadNuvioSkipSegments(mediaKey: string): NuvioSkipSegment[] {
  if (!mediaKey) return []
  try {
    const raw = localStorage.getItem(NUVIO_SEGMENTS_STORAGE_KEY)
    if (!raw) return []
    const map = JSON.parse(raw)
    const list = map?.[mediaKey]
    if (Array.isArray(list)) {
      return list.filter(
        (s) =>
          s &&
          typeof s.startSec === 'number' &&
          typeof s.endSec === 'number' &&
          s.endSec > s.startSec
      )
    }
  } catch {
    // Ignore
  }
  return []
}

export function saveNuvioSkipSegment(
  mediaKey: string,
  segment: NuvioSkipSegment
): NuvioSkipSegment[] {
  if (!mediaKey || segment.endSec <= segment.startSec) return []
  try {
    const raw = localStorage.getItem(NUVIO_SEGMENTS_STORAGE_KEY)
    const map: Record<string, NuvioSkipSegment[]> = raw ? JSON.parse(raw) : {}
    const existing = Array.isArray(map[mediaKey]) ? map[mediaKey] : []
    const filtered = existing.filter(
      (s) => s.segmentType !== segment.segmentType
    )
    filtered.push(segment)
    filtered.sort((a, b) => a.startSec - b.startSec)
    map[mediaKey] = filtered
    localStorage.setItem(NUVIO_SEGMENTS_STORAGE_KEY, JSON.stringify(map))
    return filtered
  } catch {
    return [segment]
  }
}

export function parseTimeInputToSeconds(raw: string): number | null {
  const value = String(raw || '').trim()
  if (!value) return null
  const sep = value.includes(':') ? ':' : value.includes('.') ? '.' : ''
  if (sep) {
    const parts = value.split(sep).map((p) => Number(p))
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    if (parts.length === 2) {
      if (parts[1] >= 60) return null
      return parts[0] * 60 + parts[1]
    }
    return null
  }
  const sec = Number(value)
  return Number.isFinite(sec) && sec >= 0 ? sec : null
}

export function formatNuvioClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
