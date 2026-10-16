import {
  initializeSourceSettings,
  canonicalSourceUrl,
  sourceDomains
} from './sourceSettings'
import { initializeSourceEngines } from './sourceEngines'
import { refreshExternalRelease } from './externalVersion'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync
} from 'graceful-fs'
import { join, resolve } from 'path'
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
  SourceSearchResponse,
  SourceSearchProgress,
  GhostHomeContent,
  SpotlightGameItem,
  StoreShelfItem
} from 'common/types/plugins'
import {
  DEFAULT_HOME_SPOTLIGHT_GAMES,
  DEFAULT_STORE_HIGHLIGHT_SHELVES,
  isNonGameCard
} from 'common/defaultHomeContent'
import { PluginPacker } from './pluginPacker'
import {
  archivePluginInstallation,
  comparePluginVersions,
  pluginInstallPath,
  preferredPluginInstallations,
  readPluginInstallations,
  reconcilePluginInstallations
} from './pluginInstallations'
import { PluginHost, type MediaProvider } from './pluginHost'
import { ExternalGames } from './externalGames'
import { romSource, romPageUrl, ROM_DIRECT_ID } from './romSources'
import {
  ANKER_SOURCE_ID,
  ANKER_TORRENT_ID,
  ANKER_DIRECT_ID,
  STEAMRIP_SOURCE_ID,
  STEAMRIP_DIRECT_ID,
  steamripGameUrl,
  ankerGameUrl
} from './ankerAccount'
import { NetworkGuard } from './networkGuard'
import { ONLINE_FIX_DIRECT_ID } from './onlineFixHosters'
import {
  ONLINE_FIX_SOURCE_ID,
  ONLINE_FIX_TORRENT_ID,
  onlineFixGameUrl
} from './onlineFixAccount'
import {
  isNewerGameRelease,
  parseDateToIso
} from './externalPolicy'
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
      } else if (
        preferredTransport.includes('direct') ||
        preferredTransport === 'external'
      ) {
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
  private installationBackupsDir: string
  private hosts: Map<string, PluginHost> = new Map()
  private sourceResults = new Map<string, GhostSearchResult>()
  private updateMonitor?: ReturnType<typeof setInterval>
  private checkingUpdates = false
  private homeContentCache: GhostHomeContent | null = null
  private homeCacheFile = join(userDataPath, 'ghost_home_content_cache.json')

  private async pollExternalUpdates(
    force = false,
    options?: { scope?: string; appNames?: string[] }
  ): Promise<{ success: boolean; message: string; updatesFound: number }> {
    if (this.checkingUpdates) {
      return {
        success: false,
        message: 'Verificação já em andamento.',
        updatesFound: 0
      }
    }
    const settings = GlobalConfig.get().getSettings()
    if (!force && settings.checkPirataUpdatesDaily === false) {
      return {
        success: false,
        message: 'Verificação diária desativada.',
        updatesFound: 0
      }
    }

    const service = ExternalGames.getInstance()
    const lastCheck = service.getLastUpdateCheckTime() || 0
    const now = Date.now()
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    if (!force && now - lastCheck < ONE_DAY_MS) {
      return {
        success: true,
        message: 'Verificação recente já realizada.',
        updatesFound: 0
      }
    }

    this.checkingUpdates = true
    try {
      const scope = options?.scope || 'all'
      const isAll = scope === 'all'
      logInfo(
        `[PluginManager] Iniciando verificação de updates (escopo: ${scope})...`,
        LogPrefix.Backend
      )
      let installations = service
        .snapshot(true)
        .installations.filter((item) => {
          if (!item.appName || EXCLUDED_PIRATAS_APP_NAMES.has(item.appName))
            return false
          return (
            Boolean(item.game?.providerId) ||
            Boolean(item.game?.pageUrl) ||
            Boolean(item.game?.title)
          )
        })

      if (!isAll && options?.appNames && Array.isArray(options.appNames)) {
        const allowed = new Set(options.appNames)
        installations = installations.filter((item) =>
          allowed.has(item.appName)
        )
      }

      let updatesFound = 0
      for (const installation of installations) {
        try {
          const result = await this.checkExternalUpdate(installation.id)
          if (result?.update) {
            updatesFound++
            logInfo(
              `[PluginManager] Update identificado para "${installation.game?.title}": ${result.update.version || 'Nova versão'}`,
              LogPrefix.Backend
            )
          }
        } catch {
          // Falha individual silenciada
        }
        await new Promise((resolve) => setTimeout(resolve, 800))
      }

      service.setLastUpdateCheckTime(now)
      logInfo(
        `[PluginManager] Verificação concluída (${updatesFound} atualização(ões) encontrada(s)).`,
        LogPrefix.Backend
      )
      sendFrontendMessage('external-games-updated', service.snapshot())
      return {
        success: true,
        message:
          updatesFound > 0
            ? `${updatesFound} atualização(ões) encontrada(s)!`
            : 'Todos os jogos verificados estão atualizados.',
        updatesFound
      }
    } catch (err) {
      logError(
        ['[PluginManager] Erro na verificação de updates:', err],
        LogPrefix.Backend
      )
      return {
        success: false,
        message: 'Erro na verificação de updates.',
        updatesFound: 0
      }
    } finally {
      this.checkingUpdates = false
    }
  }

  public async checkPiratasUpdates(
    force = false,
    options?: { scope?: string; appNames?: string[] }
  ): Promise<{ success: boolean; message: string; updatesFound?: number }> {
    return await this.pollExternalUpdates(force, options)
  }

  public async installBuiltinSource(id: string): Promise<PluginInstallResult> {
    const source = builtinGameSources.find((item) => item.id === id)
    if (!source) return { success: false, error: 'Fonte desconhecida.' }
    const allowedDomains = Array.from(
      new Set([source.domain, `*.${source.domain}`, ...COMMON_GAME_FILE_HOSTS])
    )
    const manifest: PluginManifest = {
      id,
      name: source.name,
      version: '1.2.0',
      author: 'Ghost Community',
      description:
        'Catálogo público experimental e download nativo pelo Ghost. Suporte a ZIP, RAR e 7Z para Windows.',
      type: 'game-source',
      entrypoint: 'index.js',
      permissions: ['network', 'game-sources'],
      tier: 2,
      allowedDomains,
      homepage: `https://${source.domain}`,
      minGhostVersion: '0.2.7-beta'
    }
    const archive = PluginPacker.createZipBuffer([
      { name: 'plugin.json', content: Buffer.from(JSON.stringify(manifest)) },
      {
        name: 'index.js',
        content: Buffer.from(
          `ghost.registerWebsiteSource(${JSON.stringify(source.config)})`
        )
      }
    ])
    return this.installFromBuffer(`${id}.ghost`, archive.toString('base64'))
  }

  private remember(
    game: GhostSearchResult,
    plugin: PluginInfo
  ): GhostSearchResult {
    const normalized = {
      ...game,
      id: canonicalSourceUrl(plugin.id, game.id),
      pageUrl: game.pageUrl
        ? canonicalSourceUrl(plugin.id, game.pageUrl)
        : undefined,
      providerId: plugin.id,
      providerName: plugin.name,
      providerIcon: plugin.homepage
        ? new URL('/favicon.ico', plugin.homepage).href
        : undefined
    }
    this.sourceResults.set(
      JSON.stringify([plugin.id, normalized.id]),
      normalized
    )
    if (this.sourceResults.size > 2000)
      this.sourceResults.delete(this.sourceResults.keys().next().value!)
    return normalized
  }

  public async searchExternalGames(
    query: string,
    onProgress?: (progress: SourceSearchProgress) => void
  ): Promise<SourceSearchResponse> {
    const response: SourceSearchResponse = { games: [], errors: [] }
    if (!query.trim()) return response
    const providers = this.getPlugins()
        .filter((plugin) => plugin.isEnabled && plugin.type === 'game-source')
        .flatMap(plugin => {
          const provider = this.hosts.get(plugin.id)?.getSourceProvider()
          return provider ? [{ plugin, provider }] : []
        })
    const pending = new Map(providers.map(({ plugin }) => [plugin.id, { id: plugin.id, name: plugin.name }]))
    const publish = () => {
      try {
        onProgress?.({ games: [...response.games], errors: [...response.errors],
          completed: providers.length - pending.size, total: providers.length,
          pendingProviders: [...pending.values()] })
      } catch { /* A closed renderer must not fail source searches. */ }
    }
    publish()
    await Promise.all(
      providers.map(async ({ plugin, provider }) => {
          let timer: ReturnType<typeof setTimeout> | undefined
          try {
            const games = await Promise.race([
              provider.search(query.trim()),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(new Error('A fonte demorou demais para responder.')),
                  25000
                )
                timer.unref()
              })
            ])
            for (const item of games)
              response.games.push(this.remember(item, plugin))
          } catch (error) {
            response.errors.push({
              providerId: plugin.id,
              providerName: plugin.name,
              message: error instanceof Error ? error.message : String(error)
            })
          } finally {
            if (timer) clearTimeout(timer)
            pending.delete(plugin.id)
            publish()
          }
        })
    )
    return response
  }

  public addExternalPage(
    providerId: string,
    pageUrl: string,
    title: string,
    version?: string
  ): GhostSearchResult {
    const plugin = this.getPlugins().find(
      (item) =>
        item.id === providerId && item.isEnabled && item.type === 'game-source'
    )
    if (!plugin || !this.hosts.get(providerId)?.getSourceProvider())
      throw new Error('Ative a fonte antes de vincular uma página.')
    const check = NetworkGuard.validateUrl(pageUrl, plugin)
    if (!check.allowed || !title.trim())
      throw new Error(check.reason || 'Informe o nome do jogo.')
    const platform = /nxbrew|nswgf|romslab/i.test(providerId)
      ? 'switch'
      : 'windows'
    return this.remember(
      {
        id: pageUrl,
        pageUrl,
        title: title.trim(),
        version: version?.trim() || undefined,
        providerId,
        providerName: plugin.name,
        platform
      },
      plugin
    )
  }

  public async getGameDetails(
    providerId: string,
    gameId: string
  ): Promise<GhostSearchResult | undefined> {
    const plugin = this.getPlugins().find(
      (item) =>
        (item.id === providerId ||
          item.id.includes(providerId) ||
          providerId.includes(item.id)) &&
        item.isEnabled
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
  ): Promise<{
    games: GhostSearchResult[]
    hasMore: boolean
    totalEstimated?: number
  }> {
    const plugin = this.getPlugins().find(
      (item) =>
        (item.id === providerId ||
          item.id.includes(providerId) ||
          providerId.includes(item.id)) &&
        item.isEnabled
    )
    const provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
    if (!plugin || !provider) {
      return { games: [], hasMore: false }
    }

    if (provider.getCatalog) {
      try {
        const result = await provider.getCatalog(options)
        const rememberedGames = result.games.map((g) =>
          this.remember(g, plugin)
        )
        return {
          games: rememberedGames,
          hasMore: result.hasMore,
          totalEstimated: result.totalEstimated
        }
      } catch (err) {
        logWarning(
          `[PluginManager] getCatalog failed for ${providerId}: ${err}`,
          LogPrefix.Backend
        )
      }
    }

    // Fallback gracioso: busca jogos gerais
    try {
      const q =
        options?.letter && options.letter !== 'All'
          ? options.letter
          : options?.theme || 'a'
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

  public async getHomeContent(options?: {
    forceRefresh?: boolean
  }): Promise<GhostHomeContent> {
    const TTL_MS = 30 * 60 * 1000
    const now = Date.now()

    if (!options?.forceRefresh && this.homeContentCache && this.homeContentCache.updatedAt) {
      if (now - this.homeContentCache.updatedAt < TTL_MS) {
        return this.homeContentCache
      }
    }

    if (!options?.forceRefresh && existsSync(this.homeCacheFile)) {
      try {
        const raw = readFileSync(this.homeCacheFile, 'utf-8')
        const parsed = JSON.parse(raw) as GhostHomeContent
        if (
          parsed &&
          Array.isArray(parsed.shelves) &&
          parsed.shelves.length > 0 &&
          parsed.updatedAt &&
          now - parsed.updatedAt < TTL_MS
        ) {
          const sanitizedShelves = parsed.shelves.map((s) => ({
            ...s,
            games: (s.games || []).filter((g) => !isNonGameCard(g.title, g.pageUrl || g.id))
          }))
          const sanitizedSpotlight = (parsed.spotlightGames || []).filter(
            (sp) => !isNonGameCard(sp.title, sp.game?.pageUrl || sp.game?.id)
          )
          const sanitizedContent: GhostHomeContent = {
            ...parsed,
            shelves: sanitizedShelves,
            spotlightGames:
              sanitizedSpotlight.length > 0
                ? sanitizedSpotlight
                : DEFAULT_HOME_SPOTLIGHT_GAMES
          }
          this.homeContentCache = sanitizedContent
          return sanitizedContent
        }
      } catch (err) {
        logWarning(`[PluginManager] Erro ao ler cache de home do disco: ${err}`, LogPrefix.Backend)
      }
    }

    const plugins = this.getPlugins().filter((p) => p.isEnabled)
    const ankerPlugin = plugins.find((p) => p.id.includes('anker'))
    const steamripPlugin = plugins.find((p) => p.id.includes('steamrip'))
    const onlineFixPlugin = plugins.find(
      (p) => p.id.includes('online-fix') || p.id.includes('onlinefix')
    )
    const switchPlugin = plugins.find(
      (p) =>
        p.id.includes('nxbrew') ||
        p.id.includes('nswgf') ||
        p.id.includes('romslab')
    )

    const [ankerResult, steamripResult, onlineFixResult, switchResult] =
      await Promise.allSettled([
        ankerPlugin
          ? this.getCatalog(ankerPlugin.id, { page: 1 })
          : Promise.resolve({ games: [] as GhostSearchResult[], hasMore: false }),
        steamripPlugin
          ? this.getCatalog(steamripPlugin.id, { page: 1 })
          : Promise.resolve({ games: [] as GhostSearchResult[], hasMore: false }),
        onlineFixPlugin
          ? this.getCatalog(onlineFixPlugin.id, { page: 1 })
          : Promise.resolve({ games: [] as GhostSearchResult[], hasMore: false }),
        switchPlugin
          ? this.getCatalog(switchPlugin.id, { page: 1 })
          : Promise.resolve({ games: [] as GhostSearchResult[], hasMore: false })
      ])

    const ankerGames =
      ankerResult.status === 'fulfilled' && ankerResult.value.games.length > 0
        ? ankerResult.value.games.filter((g) => !isNonGameCard(g.title, g.pageUrl || g.id))
        : null
    const steamripGames =
      steamripResult.status === 'fulfilled' && steamripResult.value.games.length > 0
        ? steamripResult.value.games.filter((g) => !isNonGameCard(g.title, g.pageUrl || g.id))
        : null
    const onlineFixGames =
      onlineFixResult.status === 'fulfilled' && onlineFixResult.value.games.length > 0
        ? onlineFixResult.value.games.filter((g) => !isNonGameCard(g.title, g.pageUrl || g.id))
        : null
    const switchGames =
      switchResult.status === 'fulfilled' && switchResult.value.games.length > 0
        ? switchResult.value.games.filter((g) => !isNonGameCard(g.title, g.pageUrl || g.id))
        : null

    const baseShelves = this.homeContentCache?.shelves || DEFAULT_STORE_HIGHLIGHT_SHELVES

    const updatedShelves: StoreShelfItem[] = baseShelves.map((shelf) => {
      if (shelf.id === 'ankergames' && ankerGames && ankerGames.length > 0) {
        return { ...shelf, games: ankerGames.slice(0, 16) }
      }
      if (shelf.id === 'steamrip' && steamripGames && steamripGames.length > 0) {
        return { ...shelf, games: steamripGames.slice(0, 20) }
      }
      if (shelf.id === 'onlinefix' && onlineFixGames && onlineFixGames.length > 0) {
        return { ...shelf, games: onlineFixGames.slice(0, 16) }
      }
      if (shelf.id === 'switch' && switchGames && switchGames.length > 0) {
        return { ...shelf, games: switchGames.slice(0, 16) }
      }
      return shelf
    })

    const updatedSpotlight: SpotlightGameItem[] = []

    const prepareSpotlightGame = (
      game: GhostSearchResult,
      fallbackSpotlight: SpotlightGameItem,
      defaultTags: string[]
    ): SpotlightGameItem => {
      const tags = [
        game.genre || defaultTags[0],
        game.size || defaultTags[1],
        game.platform === 'switch' ? 'Nintendo Switch' : 'PC Windows',
        game.mode || defaultTags[3],
        'GhostShield Saves'
      ]
      return {
        id: game.id,
        title: game.title,
        tags,
        backdropUrl: game.coverUrl || fallbackSpotlight.backdropUrl,
        game: {
          ...game,
          description:
            game.description ||
            fallbackSpotlight.game.description ||
            `${game.title} está disponível com instalador completo, suporte a atualizações e backup de saves GhostShield.`
        }
      }
    }

    if (ankerGames && ankerGames[0]) {
      updatedSpotlight.push(
        prepareSpotlightGame(
          ankerGames[0],
          DEFAULT_HOME_SPOTLIGHT_GAMES[0],
          ['Repack Testado', '35 GB', 'PC Windows', 'Multiplayer / Co-op']
        )
      )
    } else {
      updatedSpotlight.push(
        this.homeContentCache?.spotlightGames?.[0] || DEFAULT_HOME_SPOTLIGHT_GAMES[0]
      )
    }

    if (steamripGames && steamripGames[0]) {
      updatedSpotlight.push(
        prepareSpotlightGame(
          steamripGames[0],
          DEFAULT_HOME_SPOTLIGHT_GAMES[1],
          ['Pré-instalado', '20 GB', 'PC Windows', 'Singleplayer']
        )
      )
    } else {
      updatedSpotlight.push(
        this.homeContentCache?.spotlightGames?.[1] || DEFAULT_HOME_SPOTLIGHT_GAMES[1]
      )
    }

    if (onlineFixGames && onlineFixGames[0]) {
      updatedSpotlight.push(
        prepareSpotlightGame(
          onlineFixGames[0],
          DEFAULT_HOME_SPOTLIGHT_GAMES[2],
          ['Multiplayer Online', '10 GB', 'PC Windows', 'Co-op Online']
        )
      )
    } else {
      updatedSpotlight.push(
        this.homeContentCache?.spotlightGames?.[2] || DEFAULT_HOME_SPOTLIGHT_GAMES[2]
      )
    }

    if (switchGames && switchGames[0]) {
      updatedSpotlight.push(
        prepareSpotlightGame(
          switchGames[0],
          DEFAULT_HOME_SPOTLIGHT_GAMES[3],
          ['Nintendo Switch', '6 GB', 'Switch Emulado', 'Ryujinx / Yuzu']
        )
      )
    } else {
      updatedSpotlight.push(
        this.homeContentCache?.spotlightGames?.[3] || DEFAULT_HOME_SPOTLIGHT_GAMES[3]
      )
    }

    const newHomeContent: GhostHomeContent = {
      spotlightGames: updatedSpotlight,
      shelves: updatedShelves,
      updatedAt: now
    }

    this.homeContentCache = newHomeContent
    try {
      writeFileSync(this.homeCacheFile, JSON.stringify(newHomeContent, null, 2), 'utf-8')
    } catch (err) {
      logWarning(`[PluginManager] Falha ao salvar cache de home: ${err}`, LogPrefix.Backend)
    }

    return newHomeContent
  }

  public async installExternalGame(
    request: ExternalInstallRequest
  ): Promise<ExternalActionResult> {
    try {
      const plugin = this.getPlugins().find(
        (item) =>
          (item.id === request.game.providerId ||
            item.id.includes(request.game.providerId) ||
            request.game.providerId.includes(item.id)) &&
          item.isEnabled
      )
      const provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
      let game =
        this.sourceResults.get(
          JSON.stringify([request.game.providerId, request.game.id])
        ) || (plugin ? this.remember(request.game, plugin) : request.game)
      if (!plugin || !provider || !game)
        throw new Error('Busque o jogo novamente com a fonte habilitada.')
      if (provider.getDetails) {
        game = this.remember(
          await refreshExternalRelease(game, (id) => provider.getDetails!(id)),
          plugin
        )
      }
      const officialAnker = plugin.id === ANKER_SOURCE_ID
      const options = await this.getDownloadSources(
        plugin.id,
        game.pageUrl || game.id
      )
      let preferredTransport: string | undefined
      let targetDirectory = request.targetDirectory
      if (request.replaceInstallationId) {
        const extSnap = ExternalGames.getInstance().snapshot()
        const prevJob = extSnap.jobs.find(
          (j) =>
            (j.installationId === request.replaceInstallationId ||
              j.id === request.replaceInstallationId) &&
            (j.status === 'completed' || j.bytes > 0)
        )
        if (prevJob?.transport) {
          preferredTransport = prevJob.transport
        }
        if (!targetDirectory) {
          const inst = extSnap.installations.find(
            (i) =>
              i.id === request.replaceInstallationId ||
              i.appName === request.replaceInstallationId
          )
          if (inst?.directory) {
            targetDirectory = inst.directory
          }
        }
      }
      const hasTorbox = await TorboxClient.configured().catch(() => false)
      let source = resolveBestDownloadSource(
        options,
        request.sourceId,
        hasTorbox,
        preferredTransport
      )
      if (
        !officialAnker &&
        !romSource(plugin.id) &&
        plugin.id !== STEAMRIP_SOURCE_ID &&
        plugin.id !== ONLINE_FIX_SOURCE_ID &&
        !source &&
        request.sourceId
      ) {
        source = {
          id: request.sourceId,
          name: request.game.title,
          type:
            request.sourceId.includes('.torrent') ||
            request.sourceId.startsWith('magnet:')
              ? 'torrent'
              : 'direct',
          url: request.sourceId
        }
      }
      if (!source)
        throw new Error('Esta opção de download não está mais disponível.')
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
        targetDirectory,
        Boolean(request.confirmed),
        Boolean(request.chooseDirectory)
      )
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  public async linkExternalGame(
    appName: string,
    selected: GhostSearchResult
  ): Promise<ExternalActionResult> {
    const game = this.sourceResults.get(
      JSON.stringify([selected.providerId, selected.id])
    )
    if (!game || !this.hosts.has(game.providerId))
      return {
        success: false,
        error: 'Busque o jogo novamente com a fonte habilitada.'
      }
    return ExternalGames.getInstance().linkExisting(appName, game)
  }

  public async checkExternalUpdate(
    installationId: string
  ): Promise<ExternalActionResult> {
    try {
      const installation = ExternalGames.getInstance()
        .snapshot()
        .installations.find((item) => item.id === installationId)
      if (!installation) throw new Error('Instalação externa não encontrada.')

      let plugin = this.getPlugins().find(
        (item) => item.id === installation.game.providerId && item.isEnabled
      )
      let provider = plugin && this.hosts.get(plugin.id)?.getSourceProvider()
      let details: GhostSearchResult | undefined

      if (
        provider?.getDetails &&
        plugin &&
        installation.game.id &&
        !installation.game.id.startsWith('external-') &&
        !installation.game.id.startsWith('account-')
      ) {
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
            return (
              cleanG === cleanTarget ||
              cleanG.includes(cleanTarget) ||
              cleanTarget.includes(cleanG)
            )
          })
          if (matches.length > 0) {
            let best = matches[0]
            for (const m of matches) {
              const comp = isNewerGameRelease(
                {
                  version: best.version,
                  sourceDate: best.sourceDate,
                  uploadDate: best.uploadDate
                },
                {
                  version: m.version,
                  sourceDate: m.sourceDate,
                  uploadDate: m.uploadDate
                }
              )
              if (comp.isNewer) {
                best = m
              }
            }
            details = best
            plugin = this.getPlugins().find(
              (p) => p.id === best.providerId && p.isEnabled
            )
          }
        }
      }

      if (!details) {
        throw new Error(
          'Nenhuma fonte ativa encontrou correspondência para este jogo. Tente buscar na página Buscar Jogos.'
        )
      }

      const currentVersion = installation.game.version
      const currentCandidate = {
        version: currentVersion,
        sourceDate: installation.game.sourceDate,
        uploadDate: installation.game.uploadDate
      }
      const remoteCandidate = {
        version: details.version,
        sourceDate: details.sourceDate,
        uploadDate: details.uploadDate
      }

      if (
        !currentVersion &&
        !currentCandidate.sourceDate &&
        !details.version &&
        !remoteCandidate.sourceDate
      ) {
        const message =
          'A versão ou data de publicação não foram informadas para comparar updates.'
        ExternalGames.getInstance().recordUpdate(
          installation.id,
          undefined,
          message
        )
        return { success: false, error: message }
      }

      const comparison = isNewerGameRelease(currentCandidate, remoteCandidate)
      const isNewer = comparison.isNewer

      if (comparison.reason === 'unknown') {
        const message = 'Não foi possível confirmar uma atualização: as versões ou datas da instalação e da fonte não são comparáveis.'
        ExternalGames.getInstance().recordUpdate(installation.id, undefined, message)
        return { success: false, error: message }
      }

      const update =
        isNewer && plugin ? this.remember(details, plugin) : undefined
      const dateInfo = details.uploadDate
        ? ` (Atualizado na fonte em ${details.uploadDate})`
        : ''
      const message = update
        ? `Atualização disponível: ${update.version || 'Nova versão'}${dateInfo}`
        : 'Jogo já está na versão mais recente da fonte.'

      // Se a instalação local não possuía sourceDate e está na mesma versão da loja, auto-atrela a data oficial
      if (
        !installation.game.sourceDate &&
        (details.sourceDate || details.uploadDate) &&
        currentVersion
      ) {
        const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (clean(currentVersion) === clean(details.version || '')) {
          const iso = details.sourceDate || parseDateToIso(details.uploadDate)
          if (iso) {
            ExternalGames.getInstance().attachSourceDate(
              installation.id,
              iso,
              details.uploadDate
            )
          }
        }
      }

      ExternalGames.getInstance().recordUpdate(installation.id, update, message)
      return { success: true, update }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  private pluginStates: Record<string, { enabled: boolean; isDev?: boolean }> =
    {}

  private constructor() {
    this.pluginsDir = join(userDataPath, 'plugins')
    this.dataRootDir = join(userDataPath, 'plugins_data')
    this.stateFilePath = join(userDataPath, 'plugins_state.json')
    this.installationBackupsDir = join(userDataPath, 'plugin_installation_backups')
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager()
    }
    return PluginManager.instance
  }

  public async init(): Promise<void> {
    initializeSourceSettings(userDataPath)
    await initializeSourceEngines(
      userDataPath,
      app.isPackaged
        ? join(process.resourcesPath, 'engine-bundles')
        : join(app.getAppPath(), 'public', 'engine-bundles'),
      app.getVersion(),
      { deferVerification: true }
    )
    ExternalGames.getInstance()
    mkdirSync(this.pluginsDir, { recursive: true })
    mkdirSync(this.dataRootDir, { recursive: true })

    this.loadStates()
    try {
      reconcilePluginInstallations(this.pluginsDir, this.installationBackupsDir)
    } catch (error) {
      logWarning(
        `[PluginManager] Falha ao unificar instalações: ${String(error)}`,
        LogPrefix.Backend
      )
    }

    // Sincroniza plugins bundled para a pasta de plugins do usuário
    try {
      const bundledDir = app.isPackaged
        ? join(process.resourcesPath, 'plugins')
        : join(app.getAppPath(), 'plugins')
      if (existsSync(bundledDir)) {
        const bundled = preferredPluginInstallations(
          readPluginInstallations(bundledDir)
        )
        for (const { manifest, installedPath: srcPath } of bundled) {
          if (this.pluginStates[manifest.id]?.isDev) continue
          const destPath = pluginInstallPath(this.pluginsDir, manifest.id)
          let shouldCopy = !existsSync(destPath)
          if (!shouldCopy) {
            try {
              const destManifestPath = join(destPath, 'plugin.json')
              if (!existsSync(destManifestPath)) {
                shouldCopy = true
              } else {
                const dstRaw = PluginPacker.validateManifest(
                  JSON.parse(readFileSync(destManifestPath, 'utf8'))
                )
                const comparison = comparePluginVersions(
                  manifest.version,
                  dstRaw.version
                )
                if (comparison > 0) {
                  shouldCopy = true
                } else if (manifest.version === dstRaw.version) {
                  const srcIndex = join(srcPath, 'index.js')
                  const dstIndex = join(destPath, 'index.js')
                  if (existsSync(srcIndex) && existsSync(dstIndex)) {
                    if (
                      statSync(srcIndex).mtimeMs > statSync(dstIndex).mtimeMs
                    ) {
                      shouldCopy = true
                    }
                  }
                }
              }
            } catch {
              shouldCopy = true
            }
          }
          if (shouldCopy) {
            PluginPacker.loadUnpacked(srcPath, destPath)
          }
        }
      }
    } catch (err) {
      logWarning(
        `[PluginManager] Falha ao sincronizar plugins bundled: ${err}`,
        LogPrefix.Backend
      )
    }

    logInfo(
      '[PluginManager] Initializing plugins subsystem...',
      LogPrefix.Backend
    )
    const plugins = this.getPlugins()

    for (const p of plugins) {
      if (p.isEnabled) {
        try {
          await this.startPluginHost(p)
        } catch (err) {
          logError(
            [`[PluginManager] Failed to start plugin "${p.id}":`, err],
            LogPrefix.Backend
          )
        }
      }
    }

    this.broadcastUpdates()
    if (!this.updateMonitor) {
      const initialCheck = setTimeout(
        () => void this.pollExternalUpdates(),
        20000
      )
      initialCheck.unref()
      this.updateMonitor = setInterval(
        () => void this.pollExternalUpdates(),
        60 * 60 * 1000
      )
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
      writeFileSync(
        this.stateFilePath,
        JSON.stringify(this.pluginStates, null, 2),
        'utf8'
      )
    } catch (err) {
      logError(
        ['[PluginManager] Failed to save states:', err],
        LogPrefix.Backend
      )
    }
  }

  public getPlugins(): PluginInfo[] {
    const installations = preferredPluginInstallations(
      readPluginInstallations(this.pluginsDir, (folder, error) => {
        logWarning(
          `[PluginManager] Skipping invalid plugin in ${folder}: ${String(error)}`,
          LogPrefix.Backend
        )
      })
    )
    return installations.map(({ manifest, installedPath: pDir }) => {
      const isDev = Boolean(this.pluginStates[manifest.id]?.isDev)
      const isEnabled = this.pluginStates[manifest.id]?.enabled ?? true

      const styleFile = manifest.style || 'theme.css'
      const hasCss = existsSync(join(pDir, styleFile))

      return {
        ...manifest,
        allowedDomains: [
          ...new Set([
            ...(manifest.allowedDomains || []),
            ...sourceDomains(manifest.id)
          ])
        ],
        isEnabled,
        installedPath: pDir,
        isDev,
        hasCss
      }
    })
  }

  private archiveOtherInstallations(id: string, keepPath: string): void {
    for (const installation of readPluginInstallations(this.pluginsDir)) {
      if (
        installation.manifest.id === id &&
        resolve(installation.installedPath) !== resolve(keepPath)
      ) {
        archivePluginInstallation(
          this.pluginsDir,
          this.installationBackupsDir,
          installation.installedPath
        )
      }
    }
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

  public async togglePlugin(
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
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
      logError(
        [`[PluginManager] Toggle failed for ${id}:`, err],
        LogPrefix.Backend
      )
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
          filters: [
            {
              name: 'Ghost Plugin (*.ghost, *.zip)',
              extensions: ['ghost', 'zip']
            }
          ],
          properties: ['openFile']
        })
        if (res.canceled || res.filePaths.length === 0) {
          return { success: false, error: 'Instalação cancelada.' }
        }
        targetPath = res.filePaths[0]
      }

      const tempExtractDir = join(this.pluginsDir, '__temp_unpacking__')
      const { manifest, checksum } = PluginPacker.unpack(
        targetPath,
        tempExtractDir
      )

      const finalDir = pluginInstallPath(this.pluginsDir, manifest.id)
      if (existsSync(finalDir)) {
        const host = this.hosts.get(manifest.id)
        if (host) host.dispose()
        rmSync(finalDir, { recursive: true, force: true })
      }

      PluginPacker.unpack(targetPath, finalDir)
      this.archiveOtherInstallations(manifest.id, finalDir)
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

  public async installFromBuffer(
    fileName: string,
    bufferBase64: string
  ): Promise<PluginInstallResult> {
    try {
      const buffer = Buffer.from(bufferBase64, 'base64')
      const tempExtractDir = join(this.pluginsDir, '__temp_unpacking__')
      const { manifest, checksum } = PluginPacker.unpackFromBuffer(
        buffer,
        tempExtractDir
      )

      const finalDir = pluginInstallPath(this.pluginsDir, manifest.id)
      if (existsSync(finalDir)) {
        const host = this.hosts.get(manifest.id)
        if (host) host.dispose()
        rmSync(finalDir, { recursive: true, force: true })
      }

      PluginPacker.unpackFromBuffer(buffer, finalDir)
      this.archiveOtherInstallations(manifest.id, finalDir)
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
      logError(
        ['[PluginManager] Buffer installation failed:', err],
        LogPrefix.Backend
      )
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

      const raw = JSON.parse(
        readFileSync(join(sourceDir, 'plugin.json'), 'utf8')
      )
      const manifest = PluginPacker.validateManifest(raw)

      const finalDir = pluginInstallPath(this.pluginsDir, manifest.id)
      if (resolve(sourceDir) !== finalDir) {
        PluginPacker.loadUnpacked(sourceDir, finalDir)
      }
      this.archiveOtherInstallations(manifest.id, finalDir)

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
      logError(
        ['[PluginManager] Load unpacked failed:', err],
        LogPrefix.Backend
      )
      return { success: false, error: err.message || String(err) }
    }
  }

  public async uninstallPlugin(
    id: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const host = this.hosts.get(id)
      if (host) {
        host.dispose()
        this.hosts.delete(id)
      }

      pluginInstallPath(this.pluginsDir, id)
      // Match by manifest ID, including legacy folder names. Preserve plugin data.
      for (const installation of readPluginInstallations(this.pluginsDir)) {
        if (installation.manifest.id === id) {
          archivePluginInstallation(
            this.pluginsDir,
            this.installationBackupsDir,
            installation.installedPath
          )
        }
      }

      delete this.pluginStates[id]
      this.saveStates()

      this.broadcastUpdates()
      return { success: true }
    } catch (err: any) {
      logError(
        [`[PluginManager] Uninstall failed for ${id}:`, err],
        LogPrefix.Backend
      )
      return { success: false, error: err.message || String(err) }
    }
  }

  public async packPlugin(
    sourceDir?: string,
    outputDir?: string
  ): Promise<PluginPackResult> {
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
          logError(
            [`[PluginManager] Search error in provider "${id}":`, err],
            LogPrefix.Backend
          )
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

  public async getDownloadSources(
    providerId: string,
    gameId: string
  ): Promise<GhostDownloadSource[]> {
    const normProviderId =
      providerId === 'ankergames'
        ? ANKER_SOURCE_ID
        : providerId === 'steamrip'
          ? STEAMRIP_SOURCE_ID
          : providerId === 'onlinefix'
            ? ONLINE_FIX_SOURCE_ID
            : providerId

    const rom = romSource(normProviderId)
    const isSourceEnabled = (id: string) =>
      this.getPlugins().some(
        (plugin) =>
          (plugin.id === id || plugin.id === providerId) && plugin.isEnabled
      ) || this.pluginStates[id]?.enabled !== false

    if (rom && isSourceEnabled(normProviderId)) {
      return [
        {
          id: ROM_DIRECT_ID,
          name: `${rom.name} · Download da ROM · Automático`,
          type: 'external',
          url: romPageUrl(normProviderId, gameId)
        }
      ]
    }
    if (
      normProviderId === ONLINE_FIX_SOURCE_ID &&
      isSourceEnabled(normProviderId)
    ) {
      return [
        {
          id: ONLINE_FIX_TORRENT_ID,
          name: 'Online-Fix · Torrent via TorBox',
          type: 'torbox',
          url: onlineFixGameUrl(gameId)
        },
        {
          id: ONLINE_FIX_DIRECT_ID,
          name: 'Online-Fix · Download direto · Jogo e fix',
          type: 'external',
          url: onlineFixGameUrl(gameId)
        }
      ]
    }
    if (
      normProviderId === STEAMRIP_SOURCE_ID &&
      isSourceEnabled(normProviderId)
    ) {
      return [
        {
          id: STEAMRIP_DIRECT_ID,
          name: 'SteamRIP · Download direto · Automático',
          type: 'external',
          url: steamripGameUrl(gameId)
        }
      ]
    }
    if (normProviderId === ANKER_SOURCE_ID && isSourceEnabled(normProviderId)) {
      return [
        {
          id: ANKER_TORRENT_ID,
          name: 'TorBox · Torrent',
          type: 'torbox',
          url: ankerGameUrl(gameId)
        },
        {
          id: ANKER_DIRECT_ID,
          name: 'Download direto · Automático',
          type: 'external',
          url: ankerGameUrl(gameId)
        }
      ]
    }
    let host = this.hosts.get(providerId)
    if (!host) {
      const match = [...this.hosts.entries()].find(
        ([id]) =>
          id.toLowerCase().includes(providerId.toLowerCase()) ||
          providerId.toLowerCase().includes(id.toLowerCase())
      )
      if (match) host = match[1]
    }
    if (!host) {
      logWarning(
        `[PluginManager] Provider host "${providerId}" not found.`,
        LogPrefix.Backend
      )
      return []
    }

    const provider = host.getSourceProvider()
    if (!provider) return []

    try {
      return await provider.getSources(gameId)
    } catch (err) {
      logError(
        [`[PluginManager] getSources error in provider "${providerId}":`, err],
        LogPrefix.Backend
      )
      return []
    }
  }

  public async startDownload(
    source: GhostDownloadSource,
    gameTitle: string,
    coverUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logInfo(
        `[PluginManager] Starting download for "${gameTitle}" via ${source.name} (${source.type})`,
        LogPrefix.Backend
      )

      if (
        source.type === 'magnet' ||
        source.type === 'torrent' ||
        source.type === 'external'
      ) {
        // Handover to external torrent client or default browser
        await shell.openExternal(source.url)
        return { success: true }
      }

      // For direct or torbox HTTP/HTTPS download link
      if (
        source.url.startsWith('http://') ||
        source.url.startsWith('https://')
      ) {
        // Can open external or queue with shell.openExternal
        await shell.openExternal(source.url)
        return { success: true }
      }

      return {
        success: false,
        error: `Tipo de fonte desconhecido: ${source.type}`
      }
    } catch (err: any) {
      logError(
        ['[PluginManager] startDownload failed:', err],
        LogPrefix.Backend
      )
      return { success: false, error: err.message || String(err) }
    }
  }

  private suggestionsCache = new Map<
    string,
    { timestamp: number; items: string[] }
  >()

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
        if (
          normT.includes(normQ) ||
          item.title.toLowerCase().includes(cacheKey)
        ) {
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
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      clearTimeout(timer)
      if (res.ok) {
        const data: any = await res.json()
        if (Array.isArray(data?.items)) {
          for (const item of data.items) {
            if (
              item.name &&
              typeof item.name === 'string' &&
              item.name.length < 70
            ) {
              suggestions.add(item.name)
            }
          }
        }
      }
    } catch {
      // Ignora falha de rede
    }

    const result = Array.from(suggestions).slice(0, 8)
    this.suggestionsCache.set(cacheKey, {
      timestamp: Date.now(),
      items: result
    })
    if (this.suggestionsCache.size > 500) {
      this.suggestionsCache.delete(this.suggestionsCache.keys().next().value!)
    }
    return result
  }

  public getMediaProvider(): MediaProvider | undefined {
    const plugin = this.getPlugins().find(
      (p) =>
        p.isEnabled &&
        (p.id === 'com.ghost.alazterflix' || p.id === 'com.ghost.cinema')
    )
    if (!plugin) return undefined
    return this.hosts.get(plugin.id)?.getMediaProvider()
  }

  public isCinemaPluginActive(): boolean {
    const plugin = this.getPlugins().find(
      (p) => p.id === 'com.ghost.alazterflix' || p.id === 'com.ghost.cinema'
    )
    return Boolean(plugin && plugin.isEnabled)
  }

  public async cinemaPickFolder(): Promise<string | null> {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(
      mainWindow || (undefined as any),
      {
        title: 'Selecionar pasta de filmes locais (Jellyfin Style)',
        properties: ['openDirectory']
      }
    )
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }

  public async cinemaPickCoverImage(): Promise<string | null> {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(
      mainWindow || (undefined as any),
      {
        title: 'Selecionar imagem de capa (Pôster)',
        properties: ['openFile'],
        filters: [
          {
            name: 'Imagens (JPG, PNG, WebP)',
            extensions: ['jpg', 'jpeg', 'png', 'webp']
          }
        ]
      }
    )
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return `imagecache://localhost/${encodeURIComponent(filePath)}`
  }

  public broadcastUpdates(): void {
    const plugins = this.getPlugins()
    const cssMap = this.getActiveCSS()
    sendFrontendMessage('plugins-updated', plugins)
    sendFrontendMessage('plugins-css-changed', cssMap)
  }
}
