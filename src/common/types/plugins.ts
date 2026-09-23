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
  installedSize?: string
  description?: string
  version?: string
  sourcesCount?: number
  releaseDate?: string
  uploadDate?: string
  uploader?: string
  cracker?: string
  genre?: string
  mode?: string
  pageUrl?: string
  platform?: 'windows' | 'switch'
  edition?: string
  providerIcon?: string
  developer?: string
  publisher?: string
  deckCompatibility?: string
  controllerSupport?: string
  rating?: string
  recommendPercent?: string
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
  sha256?: string
  archive?: 'zip' | 'rar' | '7z' | 'tar'
}

export interface ExternalInstallRequest {
  chooseDirectory?: boolean
  game: GhostSearchResult
  sourceId: string
  replaceInstallationId?: string
  targetDirectory?: string
  confirmed?: boolean
}

export interface ExternalInstallation {
  /** New installations use the package root directly, without a UUID wrapper. */
  packageRootLayout?: boolean
  id: string
  appName: string
  game: GhostSearchResult
  directory: string
  executable: string
  installedAt: string
  savePath?: string
  saveDetectionType?: string
  saveDetectionDetails?: string
  saveFilesCount?: number
  saveTotalBytes?: number
  autoBackup: boolean
  autoUpdate?: boolean
  availableUpdate?: GhostSearchResult
  updateMessage?: string
  backupError?: string
  linkedExisting?: boolean
  history: Array<{ game: GhostSearchResult; changedAt: string; backupId?: string }>
}

export interface SaveDiscoveryResult {
  path: string
  detectionType: 'knowledge_base' | 'unity' | 'crack' | 'unreal' | 'godot' | 'internal' | 'user_profile'
  details: string
  existsOnDisk: boolean
  hasFiles: boolean
  fileCount: number
  totalBytes: number
}

export interface PiratasSaveSyncItem {
  appName: string
  title: string
  savePath: string
  detectionType: string
  hasFiles: boolean
  backupCreated: boolean
  backupId?: string
  bytes?: number
  files?: number
}

export interface PiratasSaveSyncResult {
  total: number
  mapped: number
  existingOnDisk: number
  backedUp: number
  errors: Array<{ title: string; error: string }>
  results: PiratasSaveSyncItem[]
}

export type ExternalJobStatus = 'queued' | 'downloading' | 'paused' | 'awaiting-file' | 'extracting' | 'ready' | 'installing' | 'completed' | 'cancelled' | 'error'

export interface ExternalSpacePlan {
  packageReady?: boolean
  destination: string
  temporaryDirectory?: string
  packageBytes: number
  installedBytes: number
  requiredOriginal: number
  missingOriginal: number
  missingDestination: number
  estimated: boolean
}

export interface ExternalDownloadJob {
  oldRemoved?: boolean
  spacePlan?: ExternalSpacePlan
  canResume?: boolean
  directDiagnostic?: { event: string; host: string; bytes: number; total: number; canResume: boolean; attempts: number; at: string }
  id: string
  game: GhostSearchResult
  installationId: string
  operation: 'install' | 'update' | 'switch-source'
  status: ExternalJobStatus
  bytes: number
  total?: number
  speed: number
  createdAt: string
  error?: string
  candidates: string[]
  transport?: 'torbox' | 'anker-direct' | 'steamrip-direct' | 'rom-direct'
  transferPhase?: 'torrent' | 'remote' | 'local'
  remoteProgress?: number
  remoteStatus?: string
  old?: any
}

export interface DownloadIntegrationsState {
  ankerConnected: boolean
  torboxConfigured: boolean
}

export type DownloadIntegrationAction =
  | { type: 'connect-anker' | 'disconnect-anker' | 'disconnect-torbox' | 'test-torbox' }
  | { type: 'save-torbox'; apiKey: string }

export interface ExternalSaveBackup {
  id: string
  installationId: string
  createdAt: string
  version?: string
  files: number
  bytes: number
}

export interface LocalCandidateGame {
  appName: string
  title: string
  directory?: string
  executable?: string
  version?: string
}

export interface ExternalGamesState {
  jobs: ExternalDownloadJob[]
  installations: ExternalInstallation[]
  backups: ExternalSaveBackup[]
  lastUpdateCheckTime?: number
}

export type ExternalGameAction =
  | { type: 'space-proceed' | 'space-recheck'; jobId: string }
  | { type: 'dismiss'; jobId: string }
  | { type: 'pause' | 'resume' | 'cancel' | 'import-archive'; jobId: string }
  | { type: 'finish'; jobId: string; executable: string }
  | { type: 'configure-saves' | 'backup' | 'check-update' | 'auto-discover-saves'; installationId: string }
  | { type: 'set-save-path'; installationId: string; path: string }
  | { type: 'delete-backup'; installationId: string; backupId: string }
  | { type: 'auto-backup'; installationId: string; enabled: boolean }
  | { type: 'auto-update'; installationId: string; enabled: boolean }
  | { type: 'restore'; installationId: string; backupId: string }
  | { type: 'sync-piratas-saves'; autoBackup?: boolean }

export interface ExternalActionResult {
  success: boolean
  error?: string
  jobId?: string
  update?: GhostSearchResult
  saveDiscovery?: SaveDiscoveryResult
  piratasSyncResult?: PiratasSaveSyncResult
}

export interface SourceSearchResponse {
  games: GhostSearchResult[]
  errors: Array<{ providerId: string; providerName: string; message: string }>
}

export interface WebsiteSourceConfig {
  catalogPath: string
  gamePathPrefix?: string
  platform: 'windows' | 'switch'
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
