import { create } from 'zustand'
import type {
  GhostSearchResult,
  GhostDownloadSource,
  ExternalActionResult
} from 'common/types/plugins'

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[[(].*?[\])]/g, ' ')
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

export const useChooseDownloadModal = create<ChooseDownloadModalState>()(
  () => ({
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
  })
)

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

let modalGeneration = 0
let sourceGeneration = 0

function sourceCover(game: GhostSearchResult) {
  const legacy = game as GhostSearchResult & {
    cover?: string
    art_cover?: string
  }
  return game.coverUrl || legacy.cover || legacy.art_cover
}

export const switchChooseDownloadStore = async (newGame: GhostSearchResult) => {
  if (!useChooseDownloadModal.getState().isOpen) return
  const generation = modalGeneration
  const request = ++sourceGeneration
  const isCurrent = () =>
    generation === modalGeneration &&
    request === sourceGeneration &&
    useChooseDownloadModal.getState().isOpen
  useChooseDownloadModal.setState({
    game: newGame,
    title: newGame.title,
    version: newGame.version,
    cover: sourceCover(newGame),
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
    if (isCurrent())
      useChooseDownloadModal.setState({
        sources: sources || [],
        loadingSources: false
      })
  } catch {
    if (isCurrent()) useChooseDownloadModal.setState({ loadingSources: false })
  }
}

export const openChooseDownloadModal = async (
  params: OpenChooseDownloadParams
) => {
  const generation = ++modalGeneration
  const request = ++sourceGeneration
  const isCurrent = () =>
    generation === modalGeneration && useChooseDownloadModal.getState().isOpen
  const isCurrentSource = () => isCurrent() && request === sourceGeneration
  const initialAvailable =
    params.availableSources && params.availableSources.length > 0
      ? params.availableSources
      : [params.game]

  useChooseDownloadModal.setState({
    isOpen: true,
    game: params.game,
    title: params.title || params.game.title,
    version: params.version || params.game.version,
    cover: sourceCover(params.game) || params.cover,
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
    if (isCurrent())
      useChooseDownloadModal.setState({
        isTorboxConfigured: Boolean(integrations?.torboxConfigured)
      })
  } catch {
    /* ignore */
  }

  if (isCurrentSource() && (!params.sources || params.sources.length === 0)) {
    try {
      const sources = await window.api.pluginsGetDownloadSources(
        params.game.providerId,
        params.game.pageUrl || params.game.id
      )
      if (isCurrentSource())
        useChooseDownloadModal.setState({
          sources: sources || [],
          loadingSources: false
        })
    } catch {
      if (isCurrentSource())
        useChooseDownloadModal.setState({ loadingSources: false })
    }
  }

  if (isCurrent() && initialAvailable.length <= 1) {
    void (async () => {
      try {
        const rawTitle = params.title || params.game.title
        const cleanName = rawTitle.replace(/[[(].*?[\])]/g, ' ').trim()
        const results = await window.api.pluginsSearchSources(cleanName)
        if (!isCurrent()) return
        if (results && results.length > 0) {
          const normBase = normalizeTitle(cleanName)
          const matching = results.filter((r) => {
            const norm = normalizeTitle(r.title)
            return (
              norm === normBase ||
              norm.includes(normBase) ||
              normBase.includes(norm)
            )
          })
          const merged = [...initialAvailable]
          for (const cand of matching) {
            if (!merged.some((m) => m.providerId === cand.providerId)) {
              merged.push(cand)
            }
          }
          if (merged.length > initialAvailable.length) {
            useChooseDownloadModal.setState({
              availableSources: merged,
              searchingOtherStores: false
            })
          } else {
            useChooseDownloadModal.setState({ searchingOtherStores: false })
          }
        } else {
          useChooseDownloadModal.setState({ searchingOtherStores: false })
        }
      } catch {
        if (isCurrent())
          useChooseDownloadModal.setState({ searchingOtherStores: false })
      }
    })()
  }
}

export const closeChooseDownloadModal = () => {
  ++modalGeneration
  ++sourceGeneration
  useChooseDownloadModal.setState({ isOpen: false })
}

/** Hand off to Downloads before waiting for source lookup or installation preparation. */
export async function submitChooseDownloadSource(
  sourceId: string,
  onAccepted: () => void
): Promise<ExternalActionResult | undefined> {
  const state = useChooseDownloadModal.getState()
  if (!state.isOpen || !state.game || state.loadingSources) return
  const source = state.sources.find((item) => item.id === sourceId)
  if (!source)
    return {
      success: false,
      error: 'Esta opção de download não está mais disponível.'
    }
  if (source.type === 'torbox' && !state.isTorboxConfigured)
    return {
      success: false,
      error:
        'Conecte sua conta TorBox em Configurações > Integrações de downloads.'
    }

  const request = {
    game: state.game,
    sourceId,
    replaceInstallationId: state.replaceInstallationId,
    targetDirectory: state.targetDirectory,
    confirmed: true
  }
  // Closing the store synchronously also rejects a second click before React rerenders.
  closeChooseDownloadModal()
  onAccepted()
  try {
    return await window.api.externalGamesInstall(request)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
