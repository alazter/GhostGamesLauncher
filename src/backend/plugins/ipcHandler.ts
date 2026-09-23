import { addHandler } from 'backend/ipc'
import { PluginManager } from './pluginManager'
import { ExternalGames } from './externalGames'
import { AnkerAccount } from './ankerAccount'
import { TorboxClient } from './torboxClient'
import { GlobalConfig } from 'backend/config'
import { resolvePortugueseDescription, resolveYouTubeTrailerId } from './gameMediaResolver'

export function registerPluginsIPC(): void {
  const manager = PluginManager.getInstance()
  addHandler('downloadIntegrationsState', async () => ({
    ankerConnected: AnkerAccount.status(), torboxConfigured: await TorboxClient.configured()
  }))
  addHandler('downloadIntegrationsAction', async (_event, action) => {
    try {
      switch (action.type) {
        case 'connect-anker': await AnkerAccount.connect(); break
        case 'disconnect-anker': await AnkerAccount.disconnect(); break
        case 'save-torbox': await TorboxClient.save(action.apiKey); break
        case 'disconnect-torbox': await TorboxClient.disconnect(); break
        case 'test-torbox': await (await TorboxClient.saved()).test(); break
        default: throw new Error('Ação de integração inválida.')
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Não foi possível conectar a integração.' }
    }
  })
  addHandler('pluginsInstallBuiltinSource', async (_event, id) => manager.installBuiltinSource(id))
  addHandler('externalGamesState', async () => ExternalGames.getInstance().snapshot())
  addHandler('externalGamesLocalCandidates', async () => ExternalGames.getInstance().localCandidates())
  addHandler('externalGamesLink', async (_event, appName, game) => manager.linkExternalGame(appName, game))
  addHandler('externalGamesSearch', async (_event, query) => manager.searchExternalGames(query))
  addHandler('externalGamesAddPage', async (_event, providerId, pageUrl, title, version) => manager.addExternalPage(providerId, pageUrl, title, version))
  addHandler('externalGamesInstall', async (_event, request) => manager.installExternalGame(request))
  addHandler('externalGamesInstallLocal', async () => {
    try {
      if (!GlobalConfig.get().getSettings().enableLocalPackageInstall)
        return { success: false, error: 'Ative Instalar por arquivo local nas configurações.' }
      return await ExternalGames.getInstance().installLocalPackage()
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Não foi possível abrir o pacote local.' }
    }
  })
  addHandler('externalGamesAction', async (_event, action) => action.type === 'check-update'
    ? manager.checkExternalUpdate(action.installationId)
    : ExternalGames.getInstance().action(action))
  addHandler('externalGamesGetOrCreateInstallation', async (_event, appName: string, gameInfo?: any) =>
    ExternalGames.getInstance().getOrCreateInstallation(appName, gameInfo)
  )
  addHandler('externalGamesSyncPiratasSaves', async (_event, options?: { autoBackup?: boolean }) =>
    ExternalGames.getInstance().syncPiratasSaves(options)
  )
  addHandler('externalGamesDeleteGame', async (_event, appName: string, deleteFiles: boolean) =>
    ExternalGames.getInstance().deleteInstallationAndFiles(appName, deleteFiles)
  )
  addHandler('externalGamesRemoveInstallation', async (_event, installationId: string) =>
    ExternalGames.getInstance().removeInstallation(installationId)
  )
  addHandler('externalGamesCheckPiratasUpdates', async (_event, force?: boolean) =>
    manager.checkPiratasUpdates(Boolean(force))
  )

  addHandler('pluginsGetList', async () => {
    return manager.getPlugins()
  })

  addHandler('pluginsToggle', async (event, pluginId: string, enabled: boolean) => {
    return await manager.togglePlugin(pluginId, enabled)
  })

  addHandler('pluginsInstall', async (event, filePath?: string) => {
    return await manager.installPlugin(filePath)
  })

  addHandler('pluginsInstallFromBuffer', async (event, fileName: string, bufferBase64: string) => {
    return await manager.installFromBuffer(fileName, bufferBase64)
  })

  addHandler('pluginsUninstall', async (event, pluginId: string) => {
    return await manager.uninstallPlugin(pluginId)
  })

  addHandler('pluginsLoadUnpacked', async (event, dirPath?: string) => {
    return await manager.loadUnpacked(dirPath)
  })

  addHandler('pluginsPack', async (event, sourceDir?: string, outputDir?: string) => {
    return await manager.packPlugin(sourceDir, outputDir)
  })

  addHandler('pluginsSearchSources', async (event, query: string) => {
    return await manager.searchSources(query)
  })

  addHandler('pluginsGetDownloadSources', async (event, providerId: string, gameId: string) => {
    return await manager.getDownloadSources(providerId, gameId)
  })

  addHandler('pluginsGetGameDetails', async (event, providerId: string, gameId: string) => {
    return await manager.getGameDetails(providerId, gameId)
  })

  addHandler('pluginsStartDownload', async (event, source, gameTitle: string, coverUrl?: string) => {
    return await manager.startDownload(source, gameTitle, coverUrl)
  })

  addHandler('pluginsGetActiveCSS', async () => {
    return manager.getActiveCSS()
  })

  addHandler('pluginsGetPortugueseDescription', async (_event, canonicalTitle: string, rawEnglishDesc?: string) => {
    return await resolvePortugueseDescription(canonicalTitle, rawEnglishDesc)
  })

  addHandler('pluginsGetGameTrailer', async (_event, canonicalTitle: string) => {
    return await resolveYouTubeTrailerId(canonicalTitle)
  })

  addHandler('pluginsGetGameSuggestions', async (_event, query: string) => {
    return await manager.getGameSuggestions(query)
  })
}
