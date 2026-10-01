import { create } from 'zustand'
import type { GhostSearchResult, GhostDownloadSource } from 'common/types/plugins'

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\[\(].*?[\]\)]/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

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
  availableSources: GhostSearchResult[]
  searchingOtherStores: boolean
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
  isTorboxConfigured: false,
  availableSources: [],
  searchingOtherStores: false
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
  availableSources?: GhostSearchResult[]
}

export const switchChooseDownloadStore = async (newGame: GhostSearchResult) => {
  const currentCover = useChooseDownloadModal.getState().cover
  useChooseDownloadModal.setState({
    game: newGame,
    title: newGame.title,
    version: newGame.version,
    cover: newGame.coverUrl || (newGame as any)?.cover || (newGame as any)?.art_cover || currentCover,
    providerName: newGame.providerName,
    providerIcon: newGame.providerIcon,
    providerId: newGame.providerId,
    loadingSources: true,
    sources: []
  })

  try {
    const sources = await window.api.pluginsGetDownloadSources(
      newGame.providerId,
      newGame.pageUrl || newGame.id
    )
    useChooseDownloadModal.setState({ sources: sources || [], loadingSources: false })
  } catch {
    useChooseDownloadModal.setState({ loadingSources: false })
  }
}

export const openChooseDownloadModal = async (params: OpenChooseDownloadParams) => {
  const initialAvailable =
    params.availableSources && params.availableSources.length > 0
      ? params.availableSources
      : [params.game]

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
    isTorboxConfigured: false,
    availableSources: initialAvailable,
    searchingOtherStores: initialAvailable.length <= 1
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

  if (initialAvailable.length <= 1) {
    void (async () => {
      try {
        const rawTitle = params.title || params.game.title
        const cleanName = rawTitle.replace(/[\[\(].*?[\]\)]/g, ' ').trim()
        const results = await window.api.pluginsSearchSources(cleanName)
        if (results && results.length > 0) {
          const normBase = normalizeTitle(cleanName)
          const matching = results.filter((r) => {
            const norm = normalizeTitle(r.title)
            return norm === normBase || norm.includes(normBase) || normBase.includes(norm)
          })
          const merged = [...initialAvailable]
          for (const cand of matching) {
            if (!merged.some((m) => m.providerId === cand.providerId)) {
              merged.push(cand)
            }
          }
          if (merged.length > initialAvailable.length) {
            useChooseDownloadModal.setState({ availableSources: merged, searchingOtherStores: false })
          } else {
            useChooseDownloadModal.setState({ searchingOtherStores: false })
          }
        } else {
          useChooseDownloadModal.setState({ searchingOtherStores: false })
        }
      } catch {
        useChooseDownloadModal.setState({ searchingOtherStores: false })
      }
    })()
  }
}

export const closeChooseDownloadModal = () => {
  useChooseDownloadModal.setState({ isOpen: false })
}
