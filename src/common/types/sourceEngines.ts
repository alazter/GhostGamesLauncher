export type SourceEngineId = 'scrapling' | 'obscura'
export interface EngineRelease {
  id: SourceEngineId
  version: string
  platform: string
  arch: string
  minGhostVersion: string
  protocol: 1
  url: string
  sha256: string
  executable: string
}
export interface EngineStatus {
  id: SourceEngineId
  installed?: string
  previous?: string
  available?: string
  upstream?: string
  enabled: boolean
  busy: boolean
  message?: string
}
export interface SourceEnginesState {
  automatic: boolean
  checkedAt?: number
  engines: EngineStatus[]
}
export type SourceEngineAction =
  | { type: 'check' }
  | { type: 'automatic'; enabled: boolean }
  | { type: 'enable'; id: SourceEngineId; enabled: boolean }
  | { type: 'install' | 'restore'; id: SourceEngineId }
