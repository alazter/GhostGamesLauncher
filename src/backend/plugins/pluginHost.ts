import vm from 'node:vm'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'graceful-fs'
import { join } from 'path'
import type {
  PluginManifest,
  GhostSearchResult,
  GhostDownloadSource,
  GhostHeaderWidget,
  GhostCardBadge
} from 'common/types/plugins'
import { NetworkGuard } from './networkGuard'
import { websiteSource } from './websiteSource'
import type { WebsiteSourceConfig } from 'common/types/plugins'
import { logError, logInfo, logWarning, LogPrefix } from 'backend/logger'

export interface SourceProvider {
  id: string
  name: string
  search: (query: string) => Promise<GhostSearchResult[]>
  getSources: (gameId: string) => Promise<GhostDownloadSource[]>
  getDetails?: (gameId: string) => Promise<GhostSearchResult>
}

export class PluginHost {
  private manifest: PluginManifest
  private pluginDir: string
  private dataDir: string
  private storageFilePath: string
  private dynamicCSS: string[] = []
  private sourceProvider?: SourceProvider
  private headerWidgets: GhostHeaderWidget[] = []
  private cardBadges: GhostCardBadge[] = []
  private gameLaunchedCallbacks: Array<(game: any) => void> = []
  private gameExitedCallbacks: Array<(game: any) => void> = []
  private isDisposed = false

  constructor(manifest: PluginManifest, pluginDir: string, dataRootDir: string) {
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
      logWarning(`[PluginHost:${this.manifest.id}] Failed to read storage file: ${err}`, LogPrefix.Backend)
    }
    return {}
  }

  private saveStorage(data: Record<string, any>): void {
    try {
      writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8')
    } catch (err) {
      logError([`[PluginHost:${this.manifest.id}] Failed to write storage file:`, err], LogPrefix.Backend)
    }
  }

  public getDynamicCSS(): string {
    return this.dynamicCSS.join('\n\n')
  }

  public getSourceProvider(): SourceProvider | undefined {
    return this.sourceProvider
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
        logError([`[PluginHost:${this.manifest.id}] Error in onGameLaunched callback:`, err], LogPrefix.Backend)
      }
    }
  }

  public notifyGameExited(game: any): void {
    for (const cb of this.gameExitedCallbacks) {
      try {
        cb(game)
      } catch (err) {
        logError([`[PluginHost:${this.manifest.id}] Error in onGameExited callback:`, err], LogPrefix.Backend)
      }
    }
  }

  public async start(): Promise<void> {
    const entryFile = join(this.pluginDir, this.manifest.entrypoint || 'index.js')
    if (!existsSync(entryFile)) {
      logInfo(`[PluginHost:${this.manifest.id}] No entrypoint file found at ${entryFile}. Skipping script execution.`, LogPrefix.Backend)
      return
    }

    const scriptCode = readFileSync(entryFile, 'utf8')

    // Prepare GhostShield SDK
    const ghostSdk = {
      registerWebsiteSource: (config: WebsiteSourceConfig) => {
        if (!this.manifest.permissions.includes('game-sources')) throw new Error('Permissão game-sources necessária.')
        this.sourceProvider = websiteSource(this.manifest, config)
      },
      plugin: {
        id: this.manifest.id,
        name: this.manifest.name,
        version: this.manifest.version,
        type: this.manifest.type
      },

      log: (...args: any[]) => {
        logInfo(`[Plugin:${this.manifest.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`, LogPrefix.Backend)
      },
      warn: (...args: any[]) => {
        logWarning(`[Plugin:${this.manifest.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`, LogPrefix.Backend)
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
        registerHeaderWidget: (widget: { id: string; title: string; icon: string; badgeText?: string }) => {
          this.headerWidgets.push({
            id: widget.id,
            pluginId: this.manifest.id,
            title: widget.title,
            icon: widget.icon,
            badgeText: widget.badgeText
          })
        },
        registerCardBadge: (badge: { text: string; color?: string; backgroundColor?: string; glowColor?: string }) => {
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
      registerSourceProvider: (provider: {
        id: string
        name: string
        search: (query: string) => Promise<GhostSearchResult[]>
        getSources: (gameId: string) => Promise<GhostDownloadSource[]>
        getDetails?: (gameId: string) => Promise<GhostSearchResult>
      }) => {
        if (!this.manifest.permissions.includes('game-sources')) {
          logError([`[PluginHost:${this.manifest.id}] Cannot register source provider without "game-sources" permission.`], LogPrefix.Backend)
          return
        }
        this.sourceProvider = {
          id: provider.id || this.manifest.id,
          name: provider.name || this.manifest.name,
          search: provider.search,
          getSources: provider.getSources,
          getDetails: provider.getDetails
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
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
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
      logInfo(`[PluginHost:${this.manifest.id}] Initialized successfully.`, LogPrefix.Backend)
    } catch (err: any) {
      logError([`[PluginHost:${this.manifest.id}] Execution failed:`, err], LogPrefix.Backend)
      throw err
    }
  }

  public dispose(): void {
    this.isDisposed = true
    this.dynamicCSS = []
    this.sourceProvider = undefined
    this.headerWidgets = []
    this.cardBadges = []
    this.gameLaunchedCallbacks = []
    this.gameExitedCallbacks = []
  }
}
