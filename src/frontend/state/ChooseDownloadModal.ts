import { create } from 'zustand'
import type { GhostSearchResult, GhostDownloadSource } from 'common/types/plugins'

export interface ChooseDownloadModalState {
  isOpen: boolean
  game: GhostSearchResult | null
  title: string
  version?: string
  cover?: string
  providerName?: string
  providerIcon?: string
  providerId?: string
  replaceInstallationId?: string
  targetDirectory?: string
  sources: GhostDownloadSource[]
  loadingSources: boolean
  isTorboxConfigured: boolean
}

export const useChooseDownloadModal = create<ChooseDownloadModalState>()(() => ({
  isOpen: false,
  game: null,
  title: '',
  version: undefined,
  cover: undefined,
  providerName: undefined,
  providerIcon: undefined,
  providerId: undefined,
  replaceInstallationId: undefined,
  targetDirectory: undefined,
  sources: [],
  loadingSources: false,
  isTorboxConfigured: false
}))

export interface OpenChooseDownloadParams {
  game: GhostSearchResult
  title?: string
  version?: string
  cover?: string
  providerName?: string
  providerIcon?: string
  providerId?: string
  replaceInstallationId?: string
  targetDirectory?: string
  sources?: GhostDownloadSource[]
}

export const openChooseDownloadModal = async (params: OpenChooseDownloadParams) => {
  useChooseDownloadModal.setState({
    isOpen: true,
    game: params.game,
    title: params.title || params.game.title,
    version: params.version || params.game.version,
    cover: params.cover || params.game.coverUrl || (params.game as any)?.cover || (params.game as any)?.art_cover,
    providerName: params.providerName || params.game.providerName,
    providerIcon: params.providerIcon || params.game.providerIcon,
    providerId: params.providerId || params.game.providerId,
    replaceInstallationId: params.replaceInstallationId,
    targetDirectory: params.targetDirectory,
    sources: params.sources || [],
    loadingSources: !params.sources || params.sources.length === 0,
    isTorboxConfigured: false
  })

  try {
    const integrations = await window.api.downloadIntegrationsState()
    useChooseDownloadModal.setState({ isTorboxConfigured: Boolean(integrations?.torboxConfigured) })
  } catch {
    /* ignore */
  }

  if (!params.sources || params.sources.length === 0) {
    try {
      const sources = await window.api.pluginsGetDownloadSources(
        params.game.providerId,
        params.game.pageUrl || params.game.id
      )
      useChooseDownloadModal.setState({ sources: sources || [], loadingSources: false })
    } catch {
      useChooseDownloadModal.setState({ loadingSources: false })
    }
  }
}

export const closeChooseDownloadModal = () => {
  useChooseDownloadModal.setState({ isOpen: false })
}
