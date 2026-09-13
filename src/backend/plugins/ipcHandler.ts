import { addHandler } from 'backend/ipc'
import { PluginManager } from './pluginManager'

export function registerPluginsIPC(): void {
  const manager = PluginManager.getInstance()

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

  addHandler('pluginsStartDownload', async (event, source, gameTitle: string, coverUrl?: string) => {
    return await manager.startDownload(source, gameTitle, coverUrl)
  })

  addHandler('pluginsGetActiveCSS', async () => {
    return manager.getActiveCSS()
  })
}
