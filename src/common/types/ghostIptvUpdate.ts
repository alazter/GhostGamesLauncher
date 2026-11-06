export interface GhostIptvUpdateState {
  id: string
  installed: string
  previous?: string
  available?: string
  upstream?: string
  upstreamPublishedAt?: string
  upstreamChangelog?: string
  upstreamUrl?: string
  updateAvailable: boolean
  upstreamUpdateAvailable: boolean
  automatic: boolean
  checkedAt?: number
  busy: boolean
  message?: string
  githubRepo: string
  githubUrl: string
  apkUrl?: string
  localDevPath?: string
  localDevAvailable?: boolean
  webUrl?: string
}

export type GhostIptvAction =
  | { type: 'check' }
  | { type: 'update'; version?: string }
  | { type: 'rollback' }
  | { type: 'set-automatic'; automatic: boolean }
  | { type: 'sync-local' }
  | { type: 'open-web' }
  | { type: 'open-window' }
  | { type: 'open-folder' }
  | { type: 'open-github' }
