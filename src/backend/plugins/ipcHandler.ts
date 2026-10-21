import { addHandler } from 'backend/ipc'
import { PluginManager } from './pluginManager'
import { sourceSettings, saveSourceSettings } from './sourceSettings'
import { testSourceAddress } from './sourceAddressTest'
import { sourceEnginesState, sourceEngineAction } from './sourceEngines'
import { ExternalGames } from './externalGames'
import { AnkerAccount } from './ankerAccount'
import { TorboxClient } from './torboxClient'
import { GlobalConfig } from 'backend/config'
import {
  resolvePortugueseDescription,
  resolveYouTubeTrailerId
} from './gameMediaResolver'
import { MediaStreamServer } from './mediaStreamServer'
import { resolveExternalGameCover } from './externalCoverSources'

export function registerPluginsIPC(): void {
  const manager = PluginManager.getInstance()
  addHandler('pluginsResolveGameCover', (_event, request) =>
    resolveExternalGameCover(request, () => manager.findAnkerCoverGames(request.title, request.platform))
  )
  addHandler('pluginsSourceEnginesState', async () => sourceEnginesState())
  addHandler('pluginsSourceEngineAction', async (_event, action) => {
    try {
      return { success: true, state: await sourceEngineAction(action) }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o motor.',
        state: sourceEnginesState()
      }
    }
  })
  addHandler('pluginsSourceSettings', async (_event, id, value) =>
    value ? saveSourceSettings(id, value) : sourceSettings(id)
  )
  addHandler('pluginsTestSourceAddress', async (_event, id, address) =>
    testSourceAddress(id, address)
  )
  addHandler('downloadIntegrationsState', async () => ({
    ankerConnected: AnkerAccount.status(),
    torboxConfigured: await TorboxClient.configured()
  }))
  addHandler('downloadIntegrationsAction', async (_event, action) => {
    try {
      switch (action.type) {
        case 'connect-anker':
          await AnkerAccount.connect()
          break
        case 'disconnect-anker':
          await AnkerAccount.disconnect()
          break
        case 'save-torbox':
          await TorboxClient.save(action.apiKey)
          break
        case 'disconnect-torbox':
          await TorboxClient.disconnect()
          break
        case 'test-torbox':
          await (await TorboxClient.saved()).test()
          break
        default:
          throw new Error('Ação de integração inválida.')
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível conectar a integração.'
      }
    }
  })
  addHandler('pluginsInstallBuiltinSource', async (_event, id) =>
    manager.installBuiltinSource(id)
  )
  addHandler('externalGamesState', async () =>
    ExternalGames.getInstance().snapshot()
  )
  addHandler('externalGamesLocalCandidates', async () =>
    ExternalGames.getInstance().localCandidates()
  )
  addHandler('externalGamesLink', async (_event, appName, game) =>
    manager.linkExternalGame(appName, game)
  )
  addHandler('externalGamesSearch', async (event, query, requestId) =>
    manager.searchExternalGames(query, requestId ? progress => {
      if (!event.sender.isDestroyed())
        event.sender.send('external-games-search-progress', requestId, progress)
    } : undefined)
  )
  addHandler(
    'externalGamesGetCatalog',
    async (_event, providerId: string, options?: any) =>
      manager.getCatalog(providerId, options)
  )
  addHandler('externalGamesGetHomeContent', async (_event, options) =>
    manager.getHomeContent(options)
  )
  addHandler(
    'externalGamesAddPage',
    async (_event, providerId, pageUrl, title, version) =>
      manager.addExternalPage(providerId, pageUrl, title, version)
  )
  addHandler('externalGamesInstall', async (_event, request) =>
    manager.installExternalGame(request)
  )
  addHandler('externalGamesInstallLocal', async () => {
    try {
      if (!GlobalConfig.get().getSettings().enableLocalPackageInstall)
        return {
          success: false,
          error: 'Ative Instalar por arquivo local nas configurações.'
        }
      return await ExternalGames.getInstance().installLocalPackage()
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível abrir o pacote local.'
      }
    }
  })
  addHandler('externalGamesAction', async (_event, action) =>
    action.type === 'check-update'
      ? manager.checkExternalUpdate(action.installationId)
      : ExternalGames.getInstance().action(action)
  )
  addHandler(
    'externalGamesSetReleaseDate',
    async (_event, installationId, sourceDate) => {
      try {
        ExternalGames.getInstance().setInstalledReleaseDate(installationId, sourceDate)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Não foi possível salvar a data da release.'
        }
      }
    }
  )
  addHandler(
    'externalGamesGetOrCreateInstallation',
    async (_event, appName: string, gameInfo?: any) =>
      ExternalGames.getInstance().getOrCreateInstallation(appName, gameInfo)
  )
  addHandler(
    'externalGamesSyncPiratasSaves',
    async (_event, options?: { autoBackup?: boolean }) =>
      ExternalGames.getInstance().syncPiratasSaves(options)
  )
  addHandler(
    'externalGamesDeleteGame',
    async (_event, appName: string, deleteFiles: boolean) =>
      ExternalGames.getInstance().deleteInstallationAndFiles(
        appName,
        deleteFiles
      )
  )
  addHandler(
    'externalGamesRemoveInstallation',
    async (_event, installationId: string) =>
      ExternalGames.getInstance().removeInstallation(installationId)
  )
  addHandler(
    'externalGamesCheckPiratasUpdates',
    async (
      _event,
      force?: boolean,
      options?: { scope?: string; appNames?: string[] }
    ) => manager.checkPiratasUpdates(Boolean(force), options)
  )

  addHandler('pluginsGetList', async () => {
    return manager.getPlugins()
  })

  addHandler(
    'pluginsToggle',
    async (event, pluginId: string, enabled: boolean) => {
      return await manager.togglePlugin(pluginId, enabled)
    }
  )

  addHandler('pluginsShare', async (_event, pluginId) => manager.sharePlugin(pluginId))
  addHandler('pluginsShareSourceEngine', async (_event, id) => manager.shareSourceEngine(id))

  addHandler('pluginsInstall', async (event, filePath?: string) => {
    return await manager.installPlugin(filePath)
  })

  addHandler(
    'pluginsInstallFromBuffer',
    async (event, fileName: string, bufferBase64: string) => {
      return await manager.installFromBuffer(fileName, bufferBase64)
    }
  )

  addHandler('pluginsUninstall', async (event, pluginId: string) => {
    return await manager.uninstallPlugin(pluginId)
  })

  addHandler('pluginsLoadUnpacked', async (event, dirPath?: string) => {
    return await manager.loadUnpacked(dirPath)
  })

  addHandler(
    'pluginsPack',
    async (event, sourceDir?: string, outputDir?: string) => {
      return await manager.packPlugin(sourceDir, outputDir)
    }
  )

  addHandler('pluginsSearchSources', async (event, query: string) => {
    return await manager.searchSources(query)
  })

  addHandler(
    'pluginsGetDownloadSources',
    async (event, providerId: string, gameId: string) => {
      return await manager.getDownloadSources(providerId, gameId)
    }
  )

  addHandler(
    'pluginsGetGameDetails',
    async (event, providerId: string, gameId: string) => {
      return await manager.getGameDetails(providerId, gameId)
    }
  )

  addHandler(
    'pluginsStartDownload',
    async (event, source, gameTitle: string, coverUrl?: string) => {
      return await manager.startDownload(source, gameTitle, coverUrl)
    }
  )

  addHandler('pluginsGetActiveCSS', async () => {
    return manager.getActiveCSS()
  })

  addHandler(
    'pluginsGetPortugueseDescription',
    async (_event, canonicalTitle: string, rawEnglishDesc?: string) => {
      return await resolvePortugueseDescription(canonicalTitle, rawEnglishDesc)
    }
  )

  addHandler(
    'pluginsGetGameTrailer',
    async (_event, canonicalTitle: string) => {
      return await resolveYouTubeTrailerId(canonicalTitle)
    }
  )

  addHandler('pluginsGetGameSuggestions', async (_event, query: string) => {
    return await manager.getGameSuggestions(query)
  })

  // ==========================================
  // GHOST CINEMA & STREMIO ADDONS IPC HANDLERS
  // ==========================================
  addHandler('cinemaIsActive', async () => manager.isCinemaPluginActive())

  addHandler('cinemaGetState', async () => {
    const provider = manager.getMediaProvider()
    if (!provider) {
      return {
        isPluginActive: false,
        folders: [],
        movies: [],
        addons: [],
        playbackHistory: {}
      }
    }
    await MediaStreamServer.getInstance()
      .start()
      .catch(() => {})
    return await provider.getState()
  })

  addHandler('cinemaPickFolder', async () => {
    return await manager.cinemaPickFolder()
  })

  addHandler('cinemaAddFolder', async (_event, folderPath: string) => {
    const provider = manager.getMediaProvider()
    if (!provider)
      throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
    return await provider.addFolder(folderPath)
  })

  addHandler('cinemaRemoveFolder', async (_event, folderPath: string) => {
    const provider = manager.getMediaProvider()
    if (!provider)
      throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
    return await provider.removeFolder(folderPath)
  })

  addHandler('cinemaScanFolders', async (_event, folders?: string[]) => {
    const provider = manager.getMediaProvider()
    if (!provider)
      throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
    return await provider.scanFolders(folders)
  })

  addHandler(
    'cinemaSaveProgress',
    async (
      _event,
      movieId: string,
      progressSeconds: number,
      durationSeconds: number
    ) => {
      const provider = manager.getMediaProvider()
      if (!provider) return
      await provider.saveProgress(movieId, progressSeconds, durationSeconds)
    }
  )

  addHandler('cinemaClearContinueWatching', async () => {
    const provider = manager.getMediaProvider()
    if (!provider?.clearContinueWatching)
      throw new Error('Atualize o plugin Alazterflix para limpar a lista de continuação.')
    return await provider.clearContinueWatching()
  })

  addHandler('cinemaGetStreamUrl', async (_event, filePath: string) => {
    const provider = manager.getMediaProvider()
    if (!provider)
      throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
    const { MediaStreamServer } = await import('./mediaStreamServer')
    return await MediaStreamServer.getInstance().getStreamUrl(filePath)
  })

  addHandler(
    'cinemaGetTranscodeStreamUrl',
    async (_event, filePath: string, audioIndex = 0, startTime = 0) => {
      const provider = manager.getMediaProvider()
      if (!provider)
        throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
      const { MediaStreamServer } = await import('./mediaStreamServer')
      return await MediaStreamServer.getInstance().getTranscodeStreamUrl(
        filePath,
        audioIndex,
        startTime
      )
    }
  )

  addHandler('cinemaProbeMedia', async (_event, filePath: string) => {
    const { MediaStreamServer } = await import('./mediaStreamServer')
    return await MediaStreamServer.getInstance().probeMedia(filePath)
  })

  addHandler(
    'cinemaGetSubtitles',
    async (
      _event,
      filePath: string,
      imdbId?: string,
      season?: number,
      episode?: number
    ) => {
      const { MediaStreamServer } = await import('./mediaStreamServer')
      const server = MediaStreamServer.getInstance()

      // 1. Legendas locais da pasta do vídeo
      const local = await server.getLocalSubtitles(filePath)

      // 2. Legendas remotas oficiais Stremio OpenSubtitles v3
      const remote: Array<{
        id: string
        name: string
        lang: string
        streamUrl: string
        format?: string
      }> = []

      if (imdbId) {
        try {
          const subQuery =
            season !== undefined && episode !== undefined
              ? `https://opensubtitles-v3.strem.io/subtitles/series/${encodeURIComponent(imdbId)}:${season}:${episode}.json`
              : `https://opensubtitles-v3.strem.io/subtitles/movie/${encodeURIComponent(imdbId)}.json`

          const res = await fetch(subQuery, {
            signal: AbortSignal.timeout(6000)
          })
          if (res.ok) {
            const data: any = await res.json()
            if (data && Array.isArray(data.subtitles)) {
              for (const s of data.subtitles) {
                let langLabel = s.lang || 'Desconhecido'
                if (s.lang === 'pob' || s.lang === 'pt-br')
                  langLabel = 'Português (Brasil)'
                else if (s.lang === 'por' || s.lang === 'pt')
                  langLabel = 'Português'
                else if (s.lang === 'eng') langLabel = 'Inglês'
                else if (s.lang === 'spa') langLabel = 'Espanhol'
                else if (s.lang === 'fre' || s.lang === 'fra')
                  langLabel = 'Francês'
                else if (s.lang === 'ger' || s.lang === 'deu')
                  langLabel = 'Alemão'
                else if (s.lang === 'ita') langLabel = 'Italiano'
                else if (s.lang === 'jpn') langLabel = 'Japonês'

                const streamUrl = await server.getSubtitleUrl(s.url, true)
                remote.push({
                  id: String(s.id),
                  name:
                    s.movieReleaseName ||
                    s.subtitleFileName ||
                    `Legenda ${langLabel}`,
                  lang: langLabel,
                  streamUrl,
                  format: s.releaseFormat
                })
              }
            }
          }
        } catch {}
      }

      return { local, remote }
    }
  )

  addHandler('cinemaStremioGetAddons', async () => {
    const provider = manager.getMediaProvider()
    if (!provider) return []
    return await provider.stremioGetAddons()
  })

  addHandler('cinemaStremioAddAddon', async (_event, manifestUrl: string) => {
    const provider = manager.getMediaProvider()
    if (!provider)
      throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
    return await provider.stremioAddAddon(manifestUrl)
  })

  addHandler('cinemaStremioRemoveAddon', async (_event, addonId: string) => {
    const provider = manager.getMediaProvider()
    if (!provider)
      throw new Error('Plugin Ghost Cinema & Filmes não está ativo.')
    return await provider.stremioRemoveAddon(addonId)
  })

  addHandler(
    'cinemaStremioGetCatalog',
    async (
      _event,
      addonId: string,
      type: string,
      catalogId: string,
      skip?: number,
      search?: string
    ) => {
      const provider = manager.getMediaProvider()
      if (!provider) return { metas: [] }
      return await provider.stremioGetCatalog(
        addonId,
        type,
        catalogId,
        skip,
        search
      )
    }
  )

  addHandler(
    'cinemaStremioGetMeta',
    async (_event, addonId: string, type: string, id: string) => {
      const provider = manager.getMediaProvider()
      if (!provider) return null
      return await provider.stremioGetMeta(addonId, type, id)
    }
  )

  addHandler(
    'cinemaStremioGetStreams',
    async (_event, type: string, id: string) => {
      const provider = manager.getMediaProvider()
      if (!provider) return []
      return await provider.stremioGetStreams(type, id)
    }
  )

  addHandler('cinemaUpdateMovie', async (_event, movie, options) => {
    const provider = manager.getMediaProvider()
    if (!provider) throw new Error('Plugin Alazterflix não está ativo.')
    if (typeof provider.updateMovie === 'function') {
      return await provider.updateMovie(movie, options)
    }
    throw new Error('Atualize o plugin Alazterflix para editar a biblioteca.')
  })

  addHandler(
    'cinemaUpdateMediaPreferences',
    async (_event, movieIds, preferences) => {
      const provider = manager.getMediaProvider()
      if (!provider) throw new Error('Plugin Alazterflix não está ativo.')
      if (typeof provider.updateMediaPreferences !== 'function')
        throw new Error(
          'Atualize o plugin Alazterflix para salvar notas e assistidos.'
        )
      return await provider.updateMediaPreferences(movieIds, preferences)
    }
  )

  addHandler('cinemaPickCoverImage', async () => {
    return await manager.cinemaPickCoverImage()
  })

  addHandler('cinemaEnrichMovie', async (_event, movieId: string) => {
    const provider = manager.getMediaProvider()
    if (!provider) return null
    if (typeof provider.enrichMovie === 'function') {
      return await provider.enrichMovie(movieId)
    }
    return null
  })

  addHandler('cinemaAutoCatalog', async () => {
    const provider = manager.getMediaProvider()
    if (!provider) return []
    if (typeof provider.autoCatalog === 'function') {
      return await provider.autoCatalog()
    }
    return await provider.getMovies()
  })

  const requireMediaProvider = () => {
    const provider = manager.getMediaProvider()
    if (!provider) throw new Error('O plugin Alazterflix não está ativo.')
    return provider
  }
  addHandler('cinemaSearchMetadata', async (_event, query, type) => {
    const provider = requireMediaProvider()
    if (!provider.searchMetadata)
      throw new Error('Atualize o plugin para buscar capas.')
    return provider.searchMetadata(query, type)
  })
  addHandler('cinemaMetadataDetails', async (_event, candidate) => {
    const provider = requireMediaProvider()
    if (!provider.metadataDetails)
      throw new Error('Atualize o plugin para identificar obras.')
    return provider.metadataDetails(candidate)
  })
  addHandler('cinemaRefreshMetadata', async (_event, mode) => {
    if (!['missing', 'all', 'portuguese'].includes(mode))
      throw new Error('Modo de atualização inválido.')
    const provider = requireMediaProvider()
    if (!provider.refreshMetadata)
      throw new Error('Atualize o plugin para atualizar capas.')
    return provider.refreshMetadata(mode)
  })
  addHandler('cinemaGetMetadataStatus', async () => {
    const provider = requireMediaProvider()
    if (!provider.getMetadataStatus)
      throw new Error('Atualize o plugin para acompanhar a atualização.')
    return provider.getMetadataStatus()
  })
  addHandler('cinemaCancelMetadataRefresh', async () => {
    const provider = requireMediaProvider()
    if (!provider.cancelMetadataRefresh)
      throw new Error('Atualize o plugin para interromper a atualização.')
    return provider.cancelMetadataRefresh()
  })
  addHandler('cinemaUpdateMetadataSettings', async (_event, settings) => {
    const provider = requireMediaProvider()
    if (!provider.updateMetadataSettings)
      throw new Error('Atualize o plugin para configurar as capas.')
    return provider.updateMetadataSettings(settings)
  })
}
