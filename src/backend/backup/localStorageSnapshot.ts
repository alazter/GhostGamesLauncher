/** Only application preferences and native release tracking belong in backups. */
const releaseKeys = new Set([
  'ghost_release_tracking_v1',
  'ghost_release_tracking_recovery_v1',
  'ghost_tracked_releases',
  'ghost_releases_tracked',
  'ghost_releases_region',
  'ghost_releases_lang',
  'ghost_releases_view',
  'ghost_releases_preferences_v1',
  'ghost_alazterflix_card_preferences',
  'ghost_alazterflix_favorites',
  'ghost_alazterflix_cover_size',
  'ghost_alazterflix_cover_sizes',
  'ghost_stremio_library_v1',
  'ghost_alazterflix_sub_settings',
  'ghost_alazterflix_season_drawer_layout',
  'ghost_stremio_preferred_player',
  'alazterflix_tv_mode',
  'alazterflix_player_volume',
  'ghost_alazterflix_tv_playlists',
  'ghost_alazterflix_tv_epg_sources',
  'ghost_alazterflix_tv_favorites',
  'ghost_alazterflix_tv_epg_assignments',
  'current_custom_categories',
  'sidebar_collapsed',
  'hide_changelogs',
  'last_changelog',
  'updates'
])

export function validateLocalStorageSnapshot(
  input: unknown
): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Dados de backup inválidos.')
  }
  const result: Record<string, string> = {}
  let size = 0
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith('heroic_') && !releaseKeys.has(key)) continue
    if (typeof value !== 'string')
      throw new Error('Preferência de backup inválida.')
    size += Buffer.byteLength(key) + Buffer.byteLength(value)
    if (size > 20 * 1024 * 1024)
      throw new Error('As preferências excedem o limite do backup (20 MB).')
    result[key] = value
  }
  return result
}
