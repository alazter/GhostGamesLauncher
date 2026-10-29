import vm from 'node:vm'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  renameSync,
  unlinkSync
} from 'graceful-fs'
import { join, dirname, basename, extname } from 'path'
import type {
  PluginManifest,
  GhostSearchResult,
  GhostDownloadSource,
  GhostHeaderWidget,
  GhostCardBadge,
  GhostMovie,
  StremioAddonManifest,
  StremioMetaPreview,
  StremioStreamItem,
  CinemaLibraryState,
  CinemaMetadataCandidate,
  CinemaMetadataSettings,
  CinemaMetadataJob,
  CinemaUpdateOptions,
  CinemaMediaPreferences,
  GhostTvPlaylist,
  GhostTvChannel,
  GhostEpgSource
} from 'common/types/plugins'
import { NetworkGuard } from './networkGuard'
import { websiteSource } from './websiteSource'
import type { WebsiteSourceConfig } from 'common/types/plugins'
import { logError, logInfo, logWarning, LogPrefix } from 'backend/logger'
import { MediaStreamServer } from './mediaStreamServer'
import { createArtworkFinder, saveMediaArtwork, deleteMediaArtwork } from './mediaArtwork'

export interface SourceProvider {
  id: string
  name: string
  search: (query: string) => Promise<GhostSearchResult[]>
  getSources: (gameId: string) => Promise<GhostDownloadSource[]>
  getDetails?: (gameId: string) => Promise<GhostSearchResult>
  getCatalog?: (options?: {
    letter?: string
    page?: number
    theme?: string
  }) => Promise<{
    games: GhostSearchResult[]
    hasMore: boolean
    totalEstimated?: number
  }>
}

export interface MediaProvider {
  clearContinueWatching?: () => Promise<CinemaLibraryState>
  updateMediaPreferences?: (
    movieIds: string[],
    preferences: CinemaMediaPreferences
  ) => Promise<CinemaLibraryState>
  id: string
  name: string
  getState: () => Promise<CinemaLibraryState>
  getMovies: () => Promise<GhostMovie[]>
  scanFolders: (folders?: string[], options?: { skipMetadata?: boolean; fullScan?: boolean }) => Promise<GhostMovie[]>
  revalidatePaths?: (folders?: string[]) => Promise<GhostMovie[]>
  fullScan?: (folders?: string[]) => Promise<GhostMovie[]>
  revalidateWithStremio?: (
    movieId?: string
  ) => Promise<{ movies: GhostMovie[]; updatedCount: number }>
  addFolder: (path: string) => Promise<CinemaLibraryState>
  removeFolder: (path: string) => Promise<CinemaLibraryState>
  saveProgress: (
    movieId: string,
    progressSeconds: number,
    durationSeconds: number
  ) => Promise<void>
  stremioGetAddons: () => Promise<StremioAddonManifest[]>
  stremioAddAddon: (manifestUrl: string) => Promise<{
    success: boolean
    addon?: StremioAddonManifest
    error?: string
  }>
  stremioRemoveAddon: (addonId: string) => Promise<{ success: boolean }>
  stremioToggleAddon?: (
    addonId: string,
    enabled: boolean
  ) => Promise<{ success: boolean; addons?: StremioAddonManifest[] }>
  stremioGetCatalog: (
    addonId: string,
    type: string,
    catalogId: string,
    skip?: number,
    search?: string,
    extra?: Record<string, string>
  ) => Promise<{ metas: StremioMetaPreview[]; hasMore?: boolean }>
  stremioGetMeta: (addonId: string, type: string, id: string) => Promise<any>
  stremioGetStreams: (type: string, id: string) => Promise<StremioStreamItem[]>
  stremioGetSubtitles?: (type: string, id: string) => Promise<any[]>
  updateMovie?: (
    movie: GhostMovie,
    options?: CinemaUpdateOptions
  ) => Promise<GhostMovie>
  enrichMovie?: (movieId: string) => Promise<GhostMovie | null>
  autoCatalog?: () => Promise<GhostMovie[]>
  searchMetadata?: (
    query: string,
    type: 'movie' | 'series'
  ) => Promise<CinemaMetadataCandidate[]>
  metadataDetails?: (
    candidate: CinemaMetadataCandidate
  ) => Promise<CinemaMetadataCandidate>
  refreshMetadata?: (
    mode: 'missing' | 'all' | 'portuguese'
  ) => Promise<CinemaMetadataJob>
  getMetadataStatus?: () => Promise<CinemaMetadataJob>
  cancelMetadataRefresh?: () => Promise<CinemaMetadataJob>
  updateMetadataSettings?: (
    settings: Omit<CinemaMetadataSettings, 'tmdbConfigured'> & {
      tmdbToken?: string
    }
  ) => Promise<CinemaMetadataSettings>
  tvGetPlaylists?: () => Promise<GhostTvPlaylist[]>
  tvSavePlaylists?: (playlists: GhostTvPlaylist[]) => Promise<boolean>
  tvGetChannels?: () => Promise<GhostTvChannel[]>
  tvSaveChannels?: (channels: GhostTvChannel[]) => Promise<boolean>
  tvGetEpgSources?: () => Promise<GhostEpgSource[]>
  tvSaveEpgSources?: (sources: GhostEpgSource[]) => Promise<boolean>
  tvGetEpgAssignments?: () => Promise<Record<string, string>>
  tvSaveEpgAssignments?: (assignments: Record<string, string>) => Promise<boolean>
}

export class PluginHost {
  private manifest: PluginManifest
  private pluginDir: string
  private dataDir: string
  private storageFilePath: string
  private dynamicCSS: string[] = []
  private sourceProvider?: SourceProvider
  private mediaProvider?: MediaProvider
  private headerWidgets: GhostHeaderWidget[] = []
  private cardBadges: GhostCardBadge[] = []
  private gameLaunchedCallbacks: Array<(game: any) => void> = []
  private gameExitedCallbacks: Array<(game: any) => void> = []
  private isDisposed = false
  private pluginTimers = new Set<NodeJS.Timeout>()

  constructor(
    manifest: PluginManifest,
    pluginDir: string,
    dataRootDir: string
  ) {
    this.manifest = manifest
    this.pluginDir = pluginDir
    this.dataDir = dataRootDir
    this.storageFilePath = join(dataRootDir, `${manifest.id}.json`)
    mkdirSync(this.dataDir, { recursive: true })
  }

  private loadStorage(): Record<string, any> {
    try {
      if (existsSync(this.storageFilePath)) {
        const raw = readFileSync(this.storageFilePath, 'utf8')
        return JSON.parse(raw)
      }
    } catch (err) {
      logWarning(
        `[PluginHost:${this.manifest.id}] Failed to read storage file: ${err}`,
        LogPrefix.Backend
      )
      throw err
    }
    return {}
  }

  private saveStorage(data: Record<string, any>): void {
    const temporary = `${this.storageFilePath}.tmp`
    try {
      writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8')
      renameSync(temporary, this.storageFilePath)
    } catch (err) {
      logError(
        [`[PluginHost:${this.manifest.id}] Failed to write storage file:`, err],
        LogPrefix.Backend
      )
      throw err
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary)
    }
  }

  public getDynamicCSS(): string {
    return this.dynamicCSS.join('\n\n')
  }

  public getSourceProvider(): SourceProvider | undefined {
    return this.sourceProvider
  }

  public getMediaProvider(): MediaProvider | undefined {
    return this.mediaProvider
  }

  public getHeaderWidgets(): GhostHeaderWidget[] {
    return this.headerWidgets
  }

  public getCardBadges(): GhostCardBadge[] {
    return this.cardBadges
  }

  public notifyGameLaunched(game: any): void {
    for (const cb of this.gameLaunchedCallbacks) {
      try {
        cb(game)
      } catch (err) {
        logError(
          [
            `[PluginHost:${this.manifest.id}] Error in onGameLaunched callback:`,
            err
          ],
          LogPrefix.Backend
        )
      }
    }
  }

  public notifyGameExited(game: any): void {
    for (const cb of this.gameExitedCallbacks) {
      try {
        cb(game)
      } catch (err) {
        logError(
          [
            `[PluginHost:${this.manifest.id}] Error in onGameExited callback:`,
            err
          ],
          LogPrefix.Backend
        )
      }
    }
  }

  public async start(): Promise<void> {
    const entryFile = join(
      this.pluginDir,
      this.manifest.entrypoint || 'index.js'
    )
    if (!existsSync(entryFile)) {
      logInfo(
        `[PluginHost:${this.manifest.id}] No entrypoint file found at ${entryFile}. Skipping script execution.`,
        LogPrefix.Backend
      )
      return
    }

    const scriptCode = readFileSync(entryFile, 'utf8')

    // Prepare GhostShield SDK
    const ghostSdk = {
      registerWebsiteSource: (config: WebsiteSourceConfig) => {
        if (!this.manifest.permissions.includes('game-sources'))
          throw new Error('Permissão game-sources necessária.')
        this.sourceProvider = websiteSource(this.manifest, config)
      },
      plugin: {
        id: this.manifest.id,
        name: this.manifest.name,
        version: this.manifest.version,
        type: this.manifest.type
      },

      log: (...args: any[]) => {
        logInfo(
          `[Plugin:${this.manifest.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          LogPrefix.Backend
        )
      },
      warn: (...args: any[]) => {
        logWarning(
          `[Plugin:${this.manifest.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          LogPrefix.Backend
        )
      },
      error: (...args: any[]) => {
        logError([`[Plugin:${this.manifest.id}]`, ...args], LogPrefix.Backend)
      },

      // Network: strictly validated through NetworkGuard
      http: {
        fetch: async (url: string, options?: any) => {
          return NetworkGuard.safeFetch(url, options, this.manifest)
        }
      },

      // Storage: strictly scoped to plugins_data/<id>.json
      storage: {
        get: async (key: string, fallback?: any) => {
          const store = this.loadStorage()
          return store[key] !== undefined ? store[key] : fallback
        },
        set: async (key: string, value: any) => {
          if (this.isDisposed) throw new Error('O plugin foi desativado.')
          const store = this.loadStorage()
          store[key] = value
          this.saveStorage(store)
        }
      },

      // UI: Visual customization & layout modifications
      ui: {
        injectCSS: (css: string) => {
          if (typeof css === 'string' && css.trim().length > 0) {
            this.dynamicCSS.push(css)
            return {
              remove: () => {
                this.dynamicCSS = this.dynamicCSS.filter((c) => c !== css)
              }
            }
          }
          return { remove: () => {} }
        },
        setThemeVariable: (varName: string, value: string) => {
          const cssRule = `:root { ${varName}: ${value} !important; }`
          this.dynamicCSS.push(cssRule)
        },
        registerHeaderWidget: (widget: {
          id: string
          title: string
          icon: string
          badgeText?: string
        }) => {
          this.headerWidgets.push({
            id: widget.id,
            pluginId: this.manifest.id,
            title: widget.title,
            icon: widget.icon,
            badgeText: widget.badgeText
          })
        },
        registerCardBadge: (badge: {
          text: string
          color?: string
          backgroundColor?: string
          glowColor?: string
        }) => {
          this.cardBadges.push({
            pluginId: this.manifest.id,
            text: badge.text,
            color: badge.color,
            backgroundColor: badge.backgroundColor,
            glowColor: badge.glowColor
          })
        }
      },

      // Game source provider (AnkerGames, FitGirl, TorBox, Skidrow, etc.)
      registerSourceProvider: (provider: SourceProvider) => {
        if (!this.manifest.permissions.includes('game-sources')) {
          logError(
            [
              `[PluginHost:${this.manifest.id}] Cannot register source provider without "game-sources" permission.`
            ],
            LogPrefix.Backend
          )
          return
        }
        this.sourceProvider = {
          id: provider.id || this.manifest.id,
          name: provider.name || this.manifest.name,
          search: provider.search,
          getSources: provider.getSources,
          getDetails: provider.getDetails,
          getCatalog: provider.getCatalog
        }
      },

      // Media provider (Ghost Cinema & Stremio Addons)
      media: {
        artworkExists: async (path: string) => {
          if (!this.manifest.permissions.includes('media'))
            throw new Error('Permissão media necessária.')
          return /\.(jpg|jpeg|png|webp)$/i.test(path) && existsSync(path)
        },
        registerMediaProvider: (provider: MediaProvider) => {
          if (!this.manifest.permissions.includes('media')) {
            logError(
              [
                `[PluginHost:${this.manifest.id}] Cannot register media provider without "media" permission.`
              ],
              LogPrefix.Backend
            )
            return
          }
          this.mediaProvider = {
            ...provider,
            id: this.manifest.id,
            name: this.manifest.name
          }
        },
        scanFolder: async (
          dirPath: string
        ): Promise<
          Array<{
            path: string
            name: string
            size: number
            birthtime: string
            localPoster?: string
            localBackdrop?: string
            posterStreamUrl?: string
            backdropStreamUrl?: string
          }>
        > => {
          if (!this.manifest.permissions.includes('media')) {
            throw new Error(
              'Permissão "media" necessária para escanear pastas.'
            )
          }
          if (!existsSync(dirPath) || !statSync(dirPath).isDirectory())
            throw new Error('A pasta de mídia não está disponível.')
          const list: Array<{
            path: string
            name: string
            size: number
            birthtime: string
            localPoster?: string
            localBackdrop?: string
            posterStreamUrl?: string
            backdropStreamUrl?: string
          }> = []
          const VIDEO_EXTS = new Set([
            '.mp4',
            '.mkv',
            '.webm',
            '.avi',
            '.mov',
            '.m4v',
            '.ts',
            '.wmv',
            '.flv',
            '.rmvb',
            '.vob',
            '.divx',
            '.ogv',
            '.mpg',
            '.mpeg',
            '.m2ts'
          ])
          const findArtwork = createArtworkFinder()

          let streamPort = 0
          try {
            streamPort = await MediaStreamServer.getInstance().start()
          } catch {}

          const scanRecursive = (dir: string, depth = 0) => {
            if (depth > 12) return
            try {
              const entries = readdirSync(dir, { withFileTypes: true })
              for (const entry of entries) {
                if (
                  entry.name.startsWith('.') ||
                  entry.name.startsWith('$') ||
                  entry.name === 'System Volume Information' ||
                  entry.name === '$RECYCLE.BIN'
                ) {
                  continue
                }
                const full = join(dir, entry.name)
                if (entry.isDirectory()) {
                  scanRecursive(full, depth + 1)
                } else if (entry.isFile()) {
                  const lastDot = full.lastIndexOf('.')
                  if (lastDot !== -1) {
                    const ext = full.slice(lastDot).toLowerCase()
                    if (VIDEO_EXTS.has(ext)) {
                      try {
                        const stat = statSync(full)
                        const artwork = findArtwork(full)
                        const posterStreamUrl =
                          artwork.poster && streamPort > 0
                            ? `http://127.0.0.1:${streamPort}/stream?file=${encodeURIComponent(artwork.poster)}`
                            : undefined
                        const backdropStreamUrl =
                          artwork.backdrop && streamPort > 0
                            ? `http://127.0.0.1:${streamPort}/stream?file=${encodeURIComponent(artwork.backdrop)}`
                            : undefined

                        list.push({
                          path: full,
                          name: entry.name,
                          size: stat.size,
                          birthtime: stat.birthtime
                            ? stat.birthtime.toISOString()
                            : new Date().toISOString(),
                          localPoster: artwork.poster,
                          localBackdrop: artwork.backdrop,
                          posterStreamUrl,
                          backdropStreamUrl
                        })
                      } catch {}
                    }
                  }
                }
              }
            } catch (err) {
              logWarning(
                `[PluginHost:${this.manifest.id}] Erro ao ler pasta ${dir}: ${err}`,
                LogPrefix.Backend
              )
            }
          }

          scanRecursive(dirPath)
          return list
        },
        findLocalArtwork: async (
          filePath: string,
          showDir?: string
        ): Promise<{
          poster?: string
          backdrop?: string
          posterStreamUrl?: string
          backdropStreamUrl?: string
        }> => {
          if (!this.manifest.permissions.includes('media')) {
            throw new Error('Permissão "media" necessária.')
          }
          const res: {
            poster?: string
            backdrop?: string
            posterStreamUrl?: string
            backdropStreamUrl?: string
          } = createArtworkFinder()(filePath, showDir)

          let streamPort = 0
          try {
            streamPort = await MediaStreamServer.getInstance().start()
          } catch {}

          if (res.poster && streamPort > 0) {
            res.posterStreamUrl = `http://127.0.0.1:${streamPort}/stream?file=${encodeURIComponent(res.poster)}`
          }
          if (res.backdrop && streamPort > 0) {
            res.backdropStreamUrl = `http://127.0.0.1:${streamPort}/stream?file=${encodeURIComponent(res.backdrop)}`
          }

          return res
        },
        saveArtwork: async (
          filePath: string,
          imageSource: string,
          type: 'poster' | 'backdrop',
          showDir?: string,
          singleItem = false,
          deleteOld = true,
          oldArtworkPath?: string
        ) => {
          if (!this.manifest.permissions.includes('media'))
            throw new Error('Permissão media necessária para salvar capas.')
          return saveMediaArtwork(
            this.manifest,
            filePath,
            imageSource,
            type,
            showDir,
            singleItem,
            deleteOld,
            oldArtworkPath
          )
        },
        deleteArtwork: async (artworkPath: string) => {
          if (!this.manifest.permissions.includes('media'))
            throw new Error('Permissão media necessária para excluir capas.')
          return deleteMediaArtwork(artworkPath)
        },
        getStreamUrl: async (filePath: string): Promise<string> => {
          if (!this.manifest.permissions.includes('media')) {
            throw new Error(
              'Permissão "media" necessária para obter URL de streaming.'
            )
          }
          return MediaStreamServer.getInstance().getStreamUrl(filePath)
        }
      },

      // Game lifecycle hooks
      events: {
        onGameLaunched: (cb: (game: any) => void) => {
          if (typeof cb === 'function') this.gameLaunchedCallbacks.push(cb)
        },
        onGameExited: (cb: (game: any) => void) => {
          if (typeof cb === 'function') this.gameExitedCallbacks.push(cb)
        }
      }
    }

    // GhostShield Sandbox Context
    const sandbox = {
      ghost: ghostSdk,
      console: {
        log: ghostSdk.log,
        warn: ghostSdk.warn,
        error: ghostSdk.error,
        info: ghostSdk.log
      },
      setTimeout: (callback: () => void, delay: number) => {
        const timer = setTimeout(() => {
          this.pluginTimers.delete(timer)
          if (!this.isDisposed) callback()
        }, delay)
        this.pluginTimers.add(timer)
        return timer
      },
      clearTimeout: (timer: NodeJS.Timeout) => {
        this.pluginTimers.delete(timer)
        clearTimeout(timer)
      },
      setInterval: (callback: () => void, delay: number) => {
        const timer = setInterval(() => {
          if (!this.isDisposed) callback()
        }, delay)
        this.pluginTimers.add(timer)
        return timer
      },
      clearInterval: (timer: NodeJS.Timeout) => {
        this.pluginTimers.delete(timer)
        clearInterval(timer)
      },
      URL,
      URLSearchParams,
      Buffer,
      Promise,
      JSON,
      Math,
      Date,
      RegExp,
      Array,
      Object,
      String,
      Number,
      Boolean
    }

    const context = vm.createContext(sandbox)

    try {
      const script = new vm.Script(scriptCode, {
        filename: `${this.manifest.id}/index.js`
      })
      script.runInContext(context, { timeout: 10000 })
      logInfo(
        `[PluginHost:${this.manifest.id}] Initialized successfully.`,
        LogPrefix.Backend
      )
    } catch (err: any) {
      logError(
        [`[PluginHost:${this.manifest.id}] Execution failed:`, err],
        LogPrefix.Backend
      )
      throw err
    }
  }

  public dispose(): void {
    this.isDisposed = true
    for (const timer of this.pluginTimers) clearTimeout(timer)
    this.pluginTimers.clear()
    this.dynamicCSS = []
    this.sourceProvider = undefined
    this.mediaProvider = undefined
    this.headerWidgets = []
    this.cardBadges = []
    this.gameLaunchedCallbacks = []
    this.gameExitedCallbacks = []
  }
}
