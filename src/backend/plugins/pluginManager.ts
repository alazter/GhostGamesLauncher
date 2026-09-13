import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'graceful-fs'
import { join } from 'path'
import { app, dialog, shell } from 'electron'
import { userDataPath } from 'backend/constants/paths'
import { logError, logInfo, logWarning, LogPrefix } from 'backend/logger'
import { sendFrontendMessage } from 'backend/ipc'
import { getMainWindow } from 'backend/main_window'
import type {
  PluginInfo,
  PluginManifest,
  PluginInstallResult,
  PluginPackResult,
  GhostSearchResult,
  GhostDownloadSource
} from 'common/types/plugins'
import { PluginPacker } from './pluginPacker'
import { PluginHost } from './pluginHost'

export class PluginManager {
  private static instance: PluginManager
  private pluginsDir: string
  private dataRootDir: string
  private stateFilePath: string
  private hosts: Map<string, PluginHost> = new Map()
  private pluginStates: Record<string, { enabled: boolean; isDev?: boolean }> = {}

  private constructor() {
    this.pluginsDir = join(userDataPath, 'plugins')
    this.dataRootDir = join(userDataPath, 'plugins_data')
    this.stateFilePath = join(userDataPath, 'plugins_state.json')
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager()
    }
    return PluginManager.instance
  }

  public async init(): Promise<void> {
    mkdirSync(this.pluginsDir, { recursive: true })
    mkdirSync(this.dataRootDir, { recursive: true })
    this.loadStates()

    logInfo('[PluginManager] Initializing plugins subsystem...', LogPrefix.Backend)
    const plugins = this.getPlugins()

    for (const p of plugins) {
      if (p.isEnabled) {
        try {
          await this.startPluginHost(p)
        } catch (err) {
          logError([`[PluginManager] Failed to start plugin "${p.id}":`, err], LogPrefix.Backend)
        }
      }
    }

    this.broadcastUpdates()
  }

  private loadStates(): void {
    try {
      if (existsSync(this.stateFilePath)) {
        this.pluginStates = JSON.parse(readFileSync(this.stateFilePath, 'utf8'))
      }
    } catch {
      this.pluginStates = {}
    }
  }

  private saveStates(): void {
    try {
      writeFileSync(this.stateFilePath, JSON.stringify(this.pluginStates, null, 2), 'utf8')
    } catch (err) {
      logError(['[PluginManager] Failed to save states:', err], LogPrefix.Backend)
    }
  }

  public getPlugins(): PluginInfo[] {
    if (!existsSync(this.pluginsDir)) return []
    const results: PluginInfo[] = []

    const entries = readdirSync(this.pluginsDir)
    for (const entry of entries) {
      const pDir = join(this.pluginsDir, entry)
      if (!statSync(pDir).isDirectory()) continue

      const manifestPath = join(pDir, 'plugin.json')
      if (!existsSync(manifestPath)) continue

      try {
        const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
        const manifest = PluginPacker.validateManifest(raw)

        const isDev = Boolean(this.pluginStates[manifest.id]?.isDev)
        const isEnabled = this.pluginStates[manifest.id]?.enabled ?? true

        const styleFile = manifest.style || 'theme.css'
        const hasCss = existsSync(join(pDir, styleFile))

        results.push({
          ...manifest,
          isEnabled,
          installedPath: pDir,
          isDev,
          hasCss
        })
      } catch (err: any) {
        logWarning(`[PluginManager] Skipping invalid plugin in ${entry}: ${err.message}`, LogPrefix.Backend)
      }
    }

    return results
  }

  private async startPluginHost(info: PluginInfo): Promise<void> {
    if (this.hosts.has(info.id)) {
      this.hosts.get(info.id)?.dispose()
      this.hosts.delete(info.id)
    }

    const host = new PluginHost(info, info.installedPath, this.dataRootDir)
    this.hosts.set(info.id, host)
    await host.start()
  }

  public async togglePlugin(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const plugins = this.getPlugins()
      const target = plugins.find((p) => p.id === id)
      if (!target) {
        return { success: false, error: `Plugin "${id}" not found.` }
      }

      this.pluginStates[id] = {
        ...(this.pluginStates[id] || {}),
        enabled
      }
      this.saveStates()

      if (enabled) {
        await this.startPluginHost(target)
      } else {
        const host = this.hosts.get(id)
        if (host) {
          host.dispose()
          this.hosts.delete(id)
        }
      }

      this.broadcastUpdates()
      return { success: true }
    } catch (err: any) {
      logError([`[PluginManager] Toggle failed for ${id}:`, err], LogPrefix.Backend)
      return { success: false, error: err.message || String(err) }
    }
  }

  public async installPlugin(filePath?: string): Promise<PluginInstallResult> {
    try {
      let targetPath = filePath
      if (!targetPath) {
        const win = getMainWindow()
        const res = await dialog.showOpenDialog(win!, {
          title: 'Instalar Plugin Ghost (*.ghost)',
          filters: [{ name: 'Ghost Plugin (*.ghost, *.zip)', extensions: ['ghost', 'zip'] }],
          properties: ['openFile']
        })
        if (res.canceled || res.filePaths.length === 0) {
          return { success: false, error: 'Instalação cancelada.' }
        }
        targetPath = res.filePaths[0]
      }

      const tempExtractDir = join(this.pluginsDir, '__temp_unpacking__')
      const { manifest, checksum } = PluginPacker.unpack(targetPath, tempExtractDir)

      const finalDir = join(this.pluginsDir, manifest.id)
      if (existsSync(finalDir)) {
        const host = this.hosts.get(manifest.id)
        if (host) host.dispose()
        rmSync(finalDir, { recursive: true, force: true })
      }

      PluginPacker.unpack(targetPath, finalDir)
      rmSync(tempExtractDir, { recursive: true, force: true })

      this.pluginStates[manifest.id] = { enabled: true, isDev: false }
      this.saveStates()

      const info: PluginInfo = {
        ...manifest,
        isEnabled: true,
        installedPath: finalDir,
        hasCss: existsSync(join(finalDir, manifest.style || 'theme.css')),
        rawChecksum: checksum
      }

      await this.startPluginHost(info)
      this.broadcastUpdates()

      return { success: true, plugin: info }
    } catch (err: any) {
      logError(['[PluginManager] Installation failed:', err], LogPrefix.Backend)
      return { success: false, error: err.message || String(err) }
    }
  }

  public async installFromBuffer(fileName: string, bufferBase64: string): Promise<PluginInstallResult> {
    try {
      const buffer = Buffer.from(bufferBase64, 'base64')
      const tempExtractDir = join(this.pluginsDir, '__temp_unpacking__')
      const { manifest, checksum } = PluginPacker.unpackFromBuffer(buffer, tempExtractDir)

      const finalDir = join(this.pluginsDir, manifest.id)
      if (existsSync(finalDir)) {
        const host = this.hosts.get(manifest.id)
        if (host) host.dispose()
        rmSync(finalDir, { recursive: true, force: true })
      }

      PluginPacker.unpackFromBuffer(buffer, finalDir)
      rmSync(tempExtractDir, { recursive: true, force: true })

      this.pluginStates[manifest.id] = { enabled: true, isDev: false }
      this.saveStates()

      const info: PluginInfo = {
        ...manifest,
        isEnabled: true,
        installedPath: finalDir,
        hasCss: existsSync(join(finalDir, manifest.style || 'theme.css')),
        rawChecksum: checksum
      }

      await this.startPluginHost(info)
      this.broadcastUpdates()

      return { success: true, plugin: info }
    } catch (err: any) {
      logError(['[PluginManager] Buffer installation failed:', err], LogPrefix.Backend)
      return { success: false, error: err.message || String(err) }
    }
  }

  public async loadUnpacked(dirPath?: string): Promise<PluginInstallResult> {
    try {
      let sourceDir = dirPath
      if (!sourceDir) {
        const win = getMainWindow()
        const res = await dialog.showOpenDialog(win!, {
          title: 'Carregar Plugin Descompactado (Modo Desenvolvedor)',
          properties: ['openDirectory']
        })
        if (res.canceled || res.filePaths.length === 0) {
          return { success: false, error: 'Ação cancelada.' }
        }
        sourceDir = res.filePaths[0]
      }

      const raw = JSON.parse(readFileSync(join(sourceDir, 'plugin.json'), 'utf8'))
      const manifest = PluginPacker.validateManifest(raw)

      const finalDir = join(this.pluginsDir, manifest.id)
      PluginPacker.loadUnpacked(sourceDir, finalDir)

      this.pluginStates[manifest.id] = { enabled: true, isDev: true }
      this.saveStates()

      const info: PluginInfo = {
        ...manifest,
        isEnabled: true,
        installedPath: finalDir,
        isDev: true,
        hasCss: existsSync(join(finalDir, manifest.style || 'theme.css'))
      }

      await this.startPluginHost(info)
      this.broadcastUpdates()

      return { success: true, plugin: info }
    } catch (err: any) {
      logError(['[PluginManager] Load unpacked failed:', err], LogPrefix.Backend)
      return { success: false, error: err.message || String(err) }
    }
  }

  public async uninstallPlugin(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const host = this.hosts.get(id)
      if (host) {
        host.dispose()
        this.hosts.delete(id)
      }

      const pDir = join(this.pluginsDir, id)
      if (existsSync(pDir)) {
        rmSync(pDir, { recursive: true, force: true })
      }

      delete this.pluginStates[id]
      this.saveStates()

      this.broadcastUpdates()
      return { success: true }
    } catch (err: any) {
      logError([`[PluginManager] Uninstall failed for ${id}:`, err], LogPrefix.Backend)
      return { success: false, error: err.message || String(err) }
    }
  }

  public async packPlugin(sourceDir?: string, outputDir?: string): Promise<PluginPackResult> {
    try {
      let src = sourceDir
      if (!src) {
        const win = getMainWindow()
        const res = await dialog.showOpenDialog(win!, {
          title: 'Selecionar Pasta do Plugin para Empacotar em .ghost',
          properties: ['openDirectory']
        })
        if (res.canceled || res.filePaths.length === 0) {
          return { success: false, error: 'Operação cancelada.' }
        }
        src = res.filePaths[0]
      }

      return await PluginPacker.pack(src, outputDir)
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }

  public getActiveCSS(): Record<string, string> {
    const cssMap: Record<string, string> = {}
    const plugins = this.getPlugins()

    for (const p of plugins) {
      if (!p.isEnabled) continue

      const parts: string[] = []

      // 1. Static CSS file (theme.css or custom style)
      const styleFileName = p.style || 'theme.css'
      const stylePath = join(p.installedPath, styleFileName)
      if (existsSync(stylePath)) {
        try {
          parts.push(readFileSync(stylePath, 'utf8'))
        } catch {}
      }

      // 2. Dynamic CSS from PluginHost
      const host = this.hosts.get(p.id)
      if (host) {
        const dynamicCss = host.getDynamicCSS()
        if (dynamicCss) parts.push(dynamicCss)
      }

      if (parts.length > 0) {
        cssMap[p.id] = parts.join('\n\n')
      }
    }

    return cssMap
  }

  public async searchSources(query: string): Promise<GhostSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase()
    if (!cleanQuery) return []

    const tasks: Promise<GhostSearchResult[]>[] = []

    for (const [id, host] of this.hosts.entries()) {
      const provider = host.getSourceProvider()
      if (!provider) continue

      tasks.push(
        provider.search(cleanQuery).catch((err) => {
          logError([`[PluginManager] Search error in provider "${id}":`, err], LogPrefix.Backend)
          return []
        })
      )
    }

    const results = await Promise.allSettled(tasks)
    const combined: GhostSearchResult[] = []

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        combined.push(...res.value)
      }
    }

    return combined
  }

  public async getDownloadSources(providerId: string, gameId: string): Promise<GhostDownloadSource[]> {
    const host = this.hosts.get(providerId)
    if (!host) {
      logWarning(`[PluginManager] Provider host "${providerId}" not found.`, LogPrefix.Backend)
      return []
    }

    const provider = host.getSourceProvider()
    if (!provider) return []

    try {
      return await provider.getSources(gameId)
    } catch (err) {
      logError([`[PluginManager] getSources error in provider "${providerId}":`, err], LogPrefix.Backend)
      return []
    }
  }

  public async startDownload(
    source: GhostDownloadSource,
    gameTitle: string,
    coverUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logInfo(`[PluginManager] Starting download for "${gameTitle}" via ${source.name} (${source.type})`, LogPrefix.Backend)

      if (source.type === 'magnet' || source.type === 'torrent' || source.type === 'external') {
        // Handover to external torrent client or default browser
        await shell.openExternal(source.url)
        return { success: true }
      }

      // For direct or torbox HTTP/HTTPS download link
      if (source.url.startsWith('http://') || source.url.startsWith('https://')) {
        // Can open external or queue with shell.openExternal
        await shell.openExternal(source.url)
        return { success: true }
      }

      return { success: false, error: `Tipo de fonte desconhecido: ${source.type}` }
    } catch (err: any) {
      logError(['[PluginManager] startDownload failed:', err], LogPrefix.Backend)
      return { success: false, error: err.message || String(err) }
    }
  }

  public broadcastUpdates(): void {
    const plugins = this.getPlugins()
    const cssMap = this.getActiveCSS()
    sendFrontendMessage('plugins-updated', plugins)
    sendFrontendMessage('plugins-css-changed', cssMap)
  }
}
