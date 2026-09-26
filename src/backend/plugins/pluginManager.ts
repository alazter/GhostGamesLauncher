import { refreshExternalRelease } from './externalVersion'
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
  GhostDownloadSource,
  ExternalInstallRequest,
  ExternalActionResult,
  SourceSearchResponse
} from 'common/types/plugins'
import { PluginPacker } from './pluginPacker'
import { PluginHost } from './pluginHost'
import { ExternalGames } from './externalGames'
import { romSource, romPageUrl, ROM_DIRECT_ID } from './romSources'
import { ANKER_SOURCE_ID, ANKER_TORRENT_ID, ANKER_DIRECT_ID, STEAMRIP_SOURCE_ID, STEAMRIP_DIRECT_ID, steamripGameUrl, ankerGameUrl } from './ankerAccount'
import { NetworkGuard } from './networkGuard'
import { ONLINE_FIX_SOURCE_ID, ONLINE_FIX_TORRENT_ID, onlineFixGameUrl } from './onlineFixAccount'
import { isNewerRelease } from './externalPolicy'
import { builtinGameSources } from 'common/builtinGameSources'
import { GlobalConfig } from 'backend/config'
import { EXCLUDED_PIRATAS_APP_NAMES } from './piratasSaveKnowledge'
import { TorboxClient } from './torboxClient'

const COMMON_GAME_FILE_HOSTS = [
  'pixeldrain.com',
  '*.pixeldrain.com',
  'buzzheavier.com',
  '*.buzzheavier.com',
  'gofile.io',
  '*.gofile.io',
  'qiwi.gg',
  '*.qiwi.gg',
  '1fichier.com',
  '*.1fichier.com',
  'mediafire.com',
  '*.mediafire.com',
  'megaup.net',
  '*.megaup.net',
  'datanodes.to',
  '*.datanodes.to',
  'steamrip.com',
  '*.steamrip.com',
  'ankergames.net',
  '*.ankergames.net',
  'online-fix.me',
  '*.online-fix.me'
]

export function resolveBestDownloadSource(
  options: GhostDownloadSource[],
  requestedSourceId?: string,
  hasTorbox = false,
  preferredTransport?: string
): GhostDownloadSource | undefined {
  let source = options.find((item) => item.id === requestedSourceId)
  if (!source && options.length > 0) {
    if (preferredTransport) {
      if (preferredTransport === 'torbox' && hasTorbox) {
        source = options.find((o) => o.type === 'torbox')
      } else if (preferredTransport.includes('direct') || preferredTransport === 'external') {
        source = options.find((o) => o.type !== 'torbox')
      }
    }
    // Fallback inteligente: se request.sourceId for o providerId ou não corresponder a nenhuma opção,
    // escolhe a melhor fonte de download disponível baseada na integração TorBox do usuário:
    if (!source && hasTorbox) {
      source = options.find((o) => o.type === 'torbox')
    }
    if (!source) {
      source = options.find((o) => o.type !== 'torbox') || options[0]
    }
  }
  return source
}

export class PluginManager {
  private static instance: PluginManager
  private pluginsDir: string
  private dataRootDir: string
  private stateFilePath: string
  private hosts: Map<string, PluginHost> = new Map()
  private sourceResults = new Map<string, GhostSearchResult>()
  private updateMonitor?: ReturnType<typeof setInterval>
  private checkingUpdates = false

  private async pollExternalUpdates(force = false) {
    if (this.checkingUpdates) return
    const settings = GlobalConfig.get().getSettings()
    if (!force && settings.checkPirataUpdatesDaily === false) {
      return
    }

    const service = ExternalGames.getInstance()
    const lastCheck = service.getLastUpdateCheckTime() || 0
    const now = Date.now()
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    if (!force && now - lastCheck < ONE_DAY_MS) {
      return
    }

    this.checkingUpdates = true
    try {
      logInfo('[PluginManager] Iniciando verificação de updates da Loja Piratas (rotina de 24h)...', LogPrefix.Backend)
      const installations = service.snapshot().installations.filter((item) => {
        if (!item.appName || EXCLUDED_PIRATAS_APP_NAMES.has(item.appName)) return false
        return Boolean(item.game?.providerId) || Boolean(item.game?.pageUrl)
      })

      let updatesFound = 0
      for (const installation of installations) {
        try {
          const result = await this.checkExternalUpdate(installation.id)
          if (result?.update) {
            updatesFound++
            logInfo(`[PluginManager] Update identificado para "${installation.game?.title}": ${result.update.version || 'Nova versão'}`, LogPrefix.Backend)
          }
        } catch {
          // Falha individual silenciada
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      service.setLastUpdateCheckTime(now)
      logInfo(`[PluginManager] Verificação da Loja Piratas concluída. (${updatesFound} atualização(ões) encontrada(s))`, LogPrefix.Backend)
      sendFrontendMessage('external-games-updated', service.snapshot())
    } catch (err) {
      logError(['[PluginManager] Erro na verificação diária de updates:', err], LogPrefix.Backend)
    } finally {
      this.checkingUpdates = false
    }
  }

  public async checkPiratasUpdates(force = false): Promise<{ success: boolean; message: string }> {
    await this.pollExternalUpdates(force)
    return { success: true, message: 'Verificação da Loja Piratas concluída.' }
  }

  public async installBuiltinSource(id: string): Promise<PluginInstallResult> {
    const source = builtinGameSources.find((item) => item.id === id)
    if (!source) return { success: false, error: 'Fonte desconhecida.' }
    const allowedDomains = Array.from(new Set([
      source.domain,
      `*.${source.domain}`,
      ...COMMON_GAME_FILE_HOSTS
    ]))
    const manifest: PluginManifest = { id, name: source.name, version: '1.2.0', author: 'Ghost Community',
      description: 'Catálogo público experimental e download nativo pelo Ghost. Suporte a ZIP, RAR e 7Z para Windows.',
      type: 'game-source', entrypoint: 'index.js', permissions: ['network', 'game-sources'], tier: 2,
      allowedDomains, homepage: `https://${source.domain}`, minGhostVersion: '0.2.7-beta' }
    const archive = PluginPacker.createZipBuffer([
      { name: 'plugin.json', content: Buffer.from(JSON.stringify(manifest)) },
      { name: 'index.js', content: Buffer.from(`ghost.registerWebsiteSource(${JSON.stringify(source.config)})`) }
    ])
    return this.installFromBuffer(`${id}.ghost`, archive.toString('base64'))
  }

  private remember(game: GhostSearchResult, plugin: PluginInfo): GhostSearchResult {
    const normalized = { ...game, providerId: plugin.id, providerName: plugin.name, providerIcon: plugin.homepage ? new URL('/favicon.ico', plugin.homepage).href : undefined }
    this.sourceResults.set(JSON.stringify([plugin.id, game.id]), normalized)
    if (this.sourceResults.size > 2000) this.sourceResults.delete(this.sourceResults.keys().next().value!)
    return normalized
  }

  public async searchExternalGames(query: string): Promise<SourceSearchResponse> {
    const response: SourceSearchResponse = { games: [], errors: [] }
    if (!query.trim()) return response
    await Promise.all(this.getPlugins().filter((plugin) => plugin.isEnabled && plugin.type === 'game-source').map(async (plugin) => {
      const provider = this.hosts.get(plugin.id)?.getSourceProvider()
      if (!provider) return
      try {
        const games = await Promise.race([provider.search(query.trim()), new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('A fonte demorou demais para responder.')), 25000); timer.unref() })])
        for (const item of games) response.games.push(this.remember(item, plugin))
      } catch (error) {
        response.errors.push({ providerId: plugin.id, providerName: plugin.name, message: error instanceof Error ? error.message : String(error) })
      }
    }))
    return response
  }

  public addExternalPage(providerId: string, pageUrl: string, title: string, version?: string): GhostSearchResult {
    const plugin = this.getPlugins().find((item) => item.id === providerId && item.isEnabled && item.type === 'game-source')
    if (!plugin || !this.hosts.get(providerId)?.getSourceProvider()) throw new Error('Ative a fonte antes de vincular uma página.')
    const check = NetworkGuard.validateUrl(pageUrl, plugin)
    if (!check.allowed || !title.trim()) throw new Error(check.reason || 'Informe o nome do jogo.')
    const platform = /nxbrew|nswgf|romslab/i.test(providerId) ? 'switch' : 'windows'
    return this.remember({ id: pageUrl, pageUrl, title: title.trim(), version: version?.trim() || undefined, providerId, providerName: plugin.name, platform }, plugin)
  }

  public async getGameDetails(providerId: string, gameId: string): Promise<GhostSearchResult | undefined> {
    const plugin = this.getPlugins().find(
      (item) => (item.id === providerId || item.id.includes(providerId) || providerId.includes(item.id)) && item.isEnabled
    )
    const provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
    if (!plugin || !provider || !provider.getDetails) return undefined
    try {
      const details = await provider.getDetails(gameId)
      return this.remember(details, plugin)
    } catch {
      return undefined
    }
  }

  public async getCatalog(
    providerId: string,
    options?: { letter?: string; page?: number; theme?: string }
  ): Promise<{ games: GhostSearchResult[]; hasMore: boolean; totalEstimated?: number }> {
    const plugin = this.getPlugins().find(
      (item) => (item.id === providerId || item.id.includes(providerId) || providerId.includes(item.id)) && item.isEnabled
    )
    const provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
    if (!plugin || !provider) {
      return { games: [], hasMore: false }
    }

    if (provider.getCatalog) {
      try {
        const result = await provider.getCatalog(options)
        const rememberedGames = result.games.map((g) => this.remember(g, plugin))
        return {
          games: rememberedGames,
          hasMore: result.hasMore,
          totalEstimated: result.totalEstimated
        }
      } catch (err) {
        logWarning(`[PluginManager] getCatalog failed for ${providerId}: ${err}`, LogPrefix.Backend)
      }
    }

    // Fallback gracioso: busca jogos gerais
    try {
      const q = options?.letter && options.letter !== 'All' ? options.letter : (options?.theme || 'a')
      const games = await provider.search(q)
      const rememberedGames = games.map((g) => this.remember(g, plugin))
      return {
        games: rememberedGames,
        hasMore: rememberedGames.length >= 10,
        totalEstimated: rememberedGames.length * 10
      }
    } catch {
      return { games: [], hasMore: false }
    }
  }

  public async installExternalGame(request: ExternalInstallRequest): Promise<ExternalActionResult> {
    try {
      const plugin = this.getPlugins().find(
        (item) => (item.id === request.game.providerId || item.id.includes(request.game.providerId) || request.game.providerId.includes(item.id)) && item.isEnabled
      )
      const provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
      let game = this.sourceResults.get(JSON.stringify([request.game.providerId, request.game.id])) ||
        (plugin ? this.remember(request.game, plugin) : request.game)
      if (!plugin || !provider || !game) throw new Error('Busque o jogo novamente com a fonte habilitada.')
      if (provider.getDetails) {
        game = this.remember(await refreshExternalRelease(game, id => provider.getDetails!(id)), plugin)
      }
      const officialAnker = plugin.id === ANKER_SOURCE_ID
      const options = await this.getDownloadSources(plugin.id, game.pageUrl || game.id)
      let preferredTransport: string | undefined
      if (request.replaceInstallationId) {
        const prevJob = ExternalGames.getInstance().snapshot().jobs.find(
          (j) => (j.installationId === request.replaceInstallationId || j.id === request.replaceInstallationId) && (j.status === 'completed' || j.bytes > 0)
        )
        if (prevJob?.transport) {
          preferredTransport = prevJob.transport
        }
      }
      const hasTorbox = await TorboxClient.configured().catch(() => false)
      let source = resolveBestDownloadSource(options, request.sourceId, hasTorbox, preferredTransport)
      if (!officialAnker && !romSource(plugin.id) && plugin.id !== STEAMRIP_SOURCE_ID && plugin.id !== ONLINE_FIX_SOURCE_ID && !source && request.sourceId) {
        source = {
          id: request.sourceId,
          name: request.game.title,
          type: request.sourceId.includes('.torrent') || request.sourceId.startsWith('magnet:') ? 'torrent' : 'direct',
          url: request.sourceId
        }
      }
      if (!source) throw new Error('Esta opção de download não está mais disponível.')
      const finalGame = {
        ...game,
        coverUrl: request.game.coverUrl || game.coverUrl
      }
      return await ExternalGames.getInstance().enqueue(
        finalGame,
        source,
        plugin,
        request.replaceInstallationId,
        false,
        true,
        request.targetDirectory,
        Boolean(request.confirmed),
        Boolean(request.chooseDirectory)
      )
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) } }
  }

  public async linkExternalGame(appName: string, selected: GhostSearchResult): Promise<ExternalActionResult> {
    const game = this.sourceResults.get(JSON.stringify([selected.providerId, selected.id]))
    if (!game || !this.hosts.has(game.providerId)) return { success: false, error: 'Busque o jogo novamente com a fonte habilitada.' }
    return ExternalGames.getInstance().linkExisting(appName, game)
  }

  public async checkExternalUpdate(installationId: string): Promise<ExternalActionResult> {
    try {
      const installation = ExternalGames.getInstance().snapshot().installations.find((item) => item.id === installationId)
      if (!installation) throw new Error('Instalação externa não encontrada.')

      let plugin = this.getPlugins().find((item) => item.id === installation.game.providerId && item.isEnabled)
      let provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
      let details: GhostSearchResult | undefined

      if (provider?.getDetails && plugin && installation.game.id && !installation.game.id.startsWith('external-') && !installation.game.id.startsWith('account-')) {
        try {
          const direct = await provider.getDetails(installation.game.id)
          if (direct && direct.id === installation.game.id) {
            details = direct
          }
        } catch {
          // Fallback para busca por título
        }
      }

      // Se não encontrou via provider direto ou se providerId for sideload/desconhecido, busca pelo título nas fontes comunitárias ativas
      if (!details || !details.version) {
        const titleToSearch = installation.game.title
        if (titleToSearch) {
          const searchRes = await this.searchExternalGames(titleToSearch)
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
          const cleanTarget = norm(titleToSearch)
          const matches = searchRes.games.filter((g) => {
            const cleanG = norm(g.title)
            return cleanG === cleanTarget || cleanG.includes(cleanTarget) || cleanTarget.includes(cleanG)
          })
          if (matches.length > 0) {
            let best = matches[0]
            for (const m of matches) {
              if (m.version && (!best.version || isNewerRelease(best.version, m.version))) {
                best = m
              }
            }
            details = best
            plugin = this.getPlugins().find((p) => p.id === best.providerId && p.isEnabled)
          }
        }
      }

      if (!details) {
        throw new Error('Nenhuma fonte ativa encontrou correspondência para este jogo. Tente buscar na página Buscar Jogos.')
      }

      const currentVersion = installation.game.version
      if (!currentVersion || !details.version) {
        const message = !currentVersion
          ? 'A versão instalada não foi identificada. Informe a versão instalada para comparar updates.'
          : 'A fonte não informou a versão disponível. Não foi possível confirmar se há atualização.'
        ExternalGames.getInstance().recordUpdate(installation.id, undefined, message)
        return { success: false, error: message }
      }
      const isNewer = isNewerRelease(currentVersion, details.version)

      const normalized = (value: string) => value.trim().toLowerCase().replace(/^v(?:ersion|er)?[ ._-]*/, '')
      if (!isNewer && !isNewerRelease(details.version, currentVersion) && normalized(currentVersion) !== normalized(details.version)) {
        const message = 'As versões instalada e disponível usam formatos diferentes. Confira a versão na página da fonte.'
        ExternalGames.getInstance().recordUpdate(installation.id, undefined, message)
        return { success: false, error: message }
      }
      const update = isNewer && plugin ? this.remember(details, plugin) : undefined
      const message = update
        ? `Atualização disponível: ${update.version || 'Nova versão'}`
        : 'Jogo já está na versão mais recente da fonte.'

      ExternalGames.getInstance().recordUpdate(installation.id, update, message)
      return { success: true, update }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) } }
  }
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
    ExternalGames.getInstance()
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
    if (!this.updateMonitor) {
      const initialCheck = setTimeout(() => void this.pollExternalUpdates(), 20000)
      initialCheck.unref()
      this.updateMonitor = setInterval(() => void this.pollExternalUpdates(), 60 * 60 * 1000)
      this.updateMonitor.unref()
    }
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
      const rom = romSource(providerId)
      if (rom && this.getPlugins().some(plugin => plugin.id === providerId && plugin.isEnabled)) {
        return [{ id: ROM_DIRECT_ID, name: `${rom.name} · Download da ROM · Confirmar no site`, type: 'external', url: romPageUrl(providerId, gameId) }]
      }
      if (providerId === ONLINE_FIX_SOURCE_ID && this.getPlugins().some(plugin => plugin.id === providerId && plugin.isEnabled)) {
        const existing = await this.hosts.get(providerId)?.getSourceProvider()?.getSources(gameId).catch(() => []) || []
        return [{ id: ONLINE_FIX_TORRENT_ID, name: 'Online-Fix · Torrent via TorBox', type: 'torbox', url: onlineFixGameUrl(gameId) }, ...existing.filter(item => item.id !== ONLINE_FIX_TORRENT_ID)]
      }
      if (providerId === STEAMRIP_SOURCE_ID && this.getPlugins().some(plugin => plugin.id === providerId && plugin.isEnabled)) {
        return [{ id: STEAMRIP_DIRECT_ID, name: 'SteamRIP · Download direto', type: 'external', url: steamripGameUrl(gameId) }]
      }
    if (providerId === ANKER_SOURCE_ID && this.getPlugins().some((plugin) => plugin.id === providerId && plugin.isEnabled)) {
      return [
        { id: ANKER_TORRENT_ID, name: 'TorBox · Torrent', type: 'torbox', url: ankerGameUrl(gameId) },
        { id: ANKER_DIRECT_ID, name: 'Download direto · Confirmar no site', type: 'external', url: ankerGameUrl(gameId) }
      ]
    }
    let host = this.hosts.get(providerId)
    if (!host) {
      const match = [...this.hosts.entries()].find(([id]) =>
        id.toLowerCase().includes(providerId.toLowerCase()) ||
        providerId.toLowerCase().includes(id.toLowerCase())
      )
      if (match) host = match[1]
    }
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

  private suggestionsCache = new Map<string, { timestamp: number; items: string[] }>()

  public async getGameSuggestions(query: string): Promise<string[]> {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) return []

    const cacheKey = trimmed.toLowerCase()
    const cached = this.suggestionsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60) {
      return cached.items
    }

    const suggestions = new Set<string>()

    // 1. Catálogo local rápido se contiver acrônimos ou correspondência direta
    try {
      const { normalizeAcronyms } = await import('./websiteSource')
      const normQ = normalizeAcronyms(trimmed).toLowerCase()
      for (const item of this.sourceResults.values()) {
        const normT = normalizeAcronyms(item.title).toLowerCase()
        if (normT.includes(normQ) || item.title.toLowerCase().includes(cacheKey)) {
          suggestions.add(item.title)
          if (suggestions.size >= 8) break
        }
      }
    } catch {}

    // 2. Consulta de autocomplete da loja Steam (pública, sem necessidade de API key, rápida e com títulos canônicos)
    try {
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(trimmed)}&l=portuguese&cc=BR`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2500)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      clearTimeout(timer)
      if (res.ok) {
        const data: any = await res.json()
        if (Array.isArray(data?.items)) {
          for (const item of data.items) {
            if (item.name && typeof item.name === 'string' && item.name.length < 70) {
              suggestions.add(item.name)
            }
          }
        }
      }
    } catch {
      // Ignora falha de rede
    }

    const result = Array.from(suggestions).slice(0, 8)
    this.suggestionsCache.set(cacheKey, { timestamp: Date.now(), items: result })
    if (this.suggestionsCache.size > 500) {
      this.suggestionsCache.delete(this.suggestionsCache.keys().next().value!)
    }
    return result
  }

  public broadcastUpdates(): void {
    const plugins = this.getPlugins()
    const cssMap = this.getActiveCSS()
    sendFrontendMessage('plugins-updated', plugins)
    sendFrontendMessage('plugins-css-changed', cssMap)
  }
}
