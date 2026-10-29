export interface NuvioAddonUpdateState {
  id: 'com.nuvio.player.addon'
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
}

export type NuvioAddonAction =
  | { type: 'check' }
  | { type: 'automatic'; enabled: boolean }
  | { type: 'install' }
  | { type: 'restore' }
  | { type: 'verify' }
