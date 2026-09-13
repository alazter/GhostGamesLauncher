export type PluginType = 'ui' | 'theme' | 'layout' | 'game-source' | 'utility' | 'metadata'

export type PluginPermission =
  | 'ui:inject-css'
  | 'ui:widgets'
  | 'network'
  | 'storage'
  | 'game-lifecycle'
  | 'game-sources'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  type: PluginType
  entrypoint?: string
  style?: string
  icon?: string
  permissions: PluginPermission[]
  allowedDomains?: string[]
  tier?: 1 | 2 // 1 = Verificado pela Comunidade & Admin, 2 = Sideload/Externo
  homepage?: string
  minGhostVersion?: string
}

export interface PluginInfo extends PluginManifest {
  isEnabled: boolean
  installedPath: string
  isDev?: boolean
  hasCss?: boolean
  error?: string
  rawChecksum?: string
}

export interface GhostSearchResult {
  id: string
  title: string
  coverUrl?: string
  providerId: string
  providerName: string
  size?: string
  description?: string
  version?: string
  sourcesCount?: number
  releaseDate?: string
  genre?: string
}

export type DownloadSourceType = 'direct' | 'torbox' | 'torrent' | 'magnet' | 'external'

export interface GhostDownloadSource {
  id: string
  name: string
  type: DownloadSourceType
  url: string
  size?: string
  seeders?: number
  speed?: string
  headers?: Record<string, string>
  fileName?: string
}

export interface PluginPackResult {
  success: boolean
  outputPath?: string
  error?: string
}

export interface PluginInstallResult {
  success: boolean
  plugin?: PluginInfo
  error?: string
}

export interface GhostHeaderWidget {
  id: string
  pluginId: string
  title: string
  icon: string
  badgeText?: string
}

export interface GhostCardBadge {
  pluginId: string
  text: string
  color?: string
  backgroundColor?: string
  glowColor?: string
}
