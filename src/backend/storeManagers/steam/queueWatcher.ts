import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  openSync,
  readSync,
  closeSync
} from 'graceful-fs'
import { join } from 'path'
import { shell } from 'electron'
import { DMQueueElement, GameInfo, Status } from 'common/types'
import { InstallResult } from 'common/types/game_manager'
import { STEAM_CDN, IGNORED_STEAM_APP_IDS } from './constants'
import { SteamDownloader } from './downloader'
import { libraryStore } from './electronStores'
import { SteamUser } from './user'
import { sendGameStatusUpdate, sendProgressUpdate } from '../../utils'
import { sendFrontendMessage } from '../../ipc'
import { logInfo, logWarning, LogPrefix } from 'backend/logger'
import { findGameExecutables } from './processWatcher'

function safeLogInfo(message: any, prefix?: LogPrefix) {
  try {
    if (typeof logInfo === 'function') {
      logInfo(message, prefix)
      return
    }
  } catch {}
  console.log(`[SteamQueueWatcher]`, message)
}

function safeLogWarning(message: any, prefix?: LogPrefix) {
  try {
    if (typeof logWarning === 'function') {
      logWarning(message, prefix)
      return
    }
  } catch {}
  console.warn(`[SteamQueueWatcher]`, message)
}

export interface SteamDownloadScanResult {
  active: DMQueueElement | null
  rawActive: DetectedSteamApp | null
  queue: DMQueueElement[]
}

export interface DetectedSteamApp {
  appId: string
  name: string
  installDir: string
  fullInstallPath: string
  stateFlags: number
  bytesDownloaded: number
  bytesToDownload: number
  bytesStaged: number
  bytesToStage: number
  sizeOnDisk: number
  buildId: string
  isPaused: boolean
}

interface SteamLogTelemetry {
  lastRateMbps: number
  rateAgeSec: number
  activeAppId: string | null
  appStates: Map<string, {
    isPaused: boolean
    isRunning: boolean
    isFinished: boolean
    isCommitting: boolean
    stateDetermined?: boolean
    bytesDownloaded?: number
    bytesToDownload?: number
    bytesStaged?: number
    bytesToStage?: number
  }>
}

/**
 * StateFlags masks in Valve Steam engine:
 * 1: Uninstalled
 * 2: Update Required
 * 4: Fully Installed
 * 256: Update Running
 * 512: Update Paused
 * 1024: Update Started
 * 131072: Downloading
 * 262144: Staging
 * 524288: Committing
 */
const STEAM_UPDATE_FLAGS_MASK = 2 | 256 | 512 | 1024 | 131072 | 262144 | 524288

export class SteamQueueWatcher {
  private static watchTimer: NodeJS.Timeout | null = null
  private static isWatching = false
  private static onQueueChanged?: () => void

  private static dismissedApps = new Set<string>()
  private static userPausedAppIds = new Set<string>()
  private static pendingInstalls = new Map<string, number>()
  private static trackedApps = new Set<string>()
  private static handledFinishedAppIds = new Map<string, number>()
  private static completionResolvers = new Map<string, (res: InstallResult) => void>()

  private static cachedSteamPath: string | null = null
  private static lastDiskSample: {
    appId: string
    time: number
    staged: number
    lastSpeedMBps: number
  } | null = null

  // ---------------------------------------------------------------
  // 1. LIFECYCLE & MASTER 3-SECOND WATCHER
  // ---------------------------------------------------------------

  public static startWatcher() {
    if (this.watchTimer) return

    safeLogInfo('Starting unified 3-second SteamQueueWatcher', LogPrefix.Steam)
    void this.tick()

    this.watchTimer = setInterval(async () => {
      await this.tick()
    }, 3000)
  }

  public static stopWatcher() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer)
      this.watchTimer = null
    }
    this.isWatching = false
  }

  public static startWatcherIfNeeded() {
    this.startWatcher()
  }

  public static isAppActiveOrQueued(appId: string): boolean {
    return this.trackedApps.has(appId) || this.pendingInstalls.has(appId)
  }

  public static setOnQueueChanged(cb: () => void) {
    this.onQueueChanged = cb
  }

  // ---------------------------------------------------------------
  // 2. SAFE I/O & PARSER DE TELEMETRIA (content_log.txt)
  // ---------------------------------------------------------------

  private static async getSteamRootPath(): Promise<string | null> {
    if (this.cachedSteamPath && existsSync(this.cachedSteamPath)) {
      return this.cachedSteamPath
    }
    const detected = (await SteamUser.getSteamPath()) || (await SteamUser.getDetectedAccount())?.steamPath
    if (detected && existsSync(detected)) {
      this.cachedSteamPath = detected
      return detected
    }
    return null
  }

  /**
   * Parser seguro de data do log da Steam usando fuso horário local.
   * Evita discrepâncias de timezone que causavam ageSec gigante.
   */
  private static parseLocalLogDate(dateStr: string): number {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
    if (!match) return 0
    const [, y, m, d, h, min, s] = match
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      Number(s)
    ).getTime()
  }

  /**
   * Leitura atômica dos últimos 64KB de content_log.txt com fechamento garantido.
   */
  private static readTailLog(logPath: string, maxBytes = 65536): string {
    if (!logPath || !existsSync(logPath)) return ''
    let fd: number | null = null
    try {
      const stat = statSync(logPath)
      if (stat.size === 0) return ''
      const readLen = Math.min(maxBytes, stat.size)
      const buf = Buffer.alloc(readLen)
      fd = openSync(logPath, 'r')
      readSync(fd, buf, 0, readLen, stat.size - readLen)
      return buf.toString('utf8')
    } catch {
      return ''
    } finally {
      if (fd !== null) {
        try {
          closeSync(fd)
        } catch {}
      }
    }
  }

  /**
   * Extrai com precisão científica métricas reais do log oficial da Steam:
   * - Taxa de rede real (Mbps)
   * - Bytes de download e staging reportados em `update started`
   * - Estados de `Running Update`, `(Suspended)` e `scheduler finished`
   */
  private static parseSteamLog(logContent: string): SteamLogTelemetry {
    const res: SteamLogTelemetry = {
      lastRateMbps: 0,
      rateAgeSec: 999,
      activeAppId: null,
      appStates: new Map()
    }
    if (!logContent) return res

    const lines = logContent.split(/\r?\n/)
    const now = Date.now()

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]

      // 1. Extração da taxa de rede real (Mbps)
      if (res.lastRateMbps === 0) {
        const rateMatch = line.match(
          /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] Current download rate:\s+([\d.]+)\s+Mbps/i
        ) || line.match(
          /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\].*?stats:.*?\((\d+(?:\.\d+)?)\s+Mbps\)/i
        )

        if (rateMatch) {
          const logTime = this.parseLocalLogDate(rateMatch[1])
          res.rateAgeSec = logTime > 0 ? Math.max(0, (now - logTime) / 1000) : 0
          res.lastRateMbps = parseFloat(rateMatch[2])
        }
      }

      // 2. Extração de eventos por AppID
      const appMatch = line.match(/AppID\s+(\d+)/i)
      if (appMatch) {
        const appId = appMatch[1]
        let appEntry = res.appStates.get(appId)
        if (!appEntry) {
          appEntry = {
            isPaused: false,
            isRunning: false,
            isFinished: false,
            isCommitting: false,
            stateDetermined: false
          }
          res.appStates.set(appId, appEntry)
        }

        if (!appEntry.stateDetermined) {
          if (line.includes('Running Update') && !line.includes('(Suspended)')) {
            if (!res.activeAppId) {
              res.activeAppId = appId
            }
            appEntry.isRunning = true
            appEntry.isPaused = false
            appEntry.stateDetermined = true
          } else if (line.includes('(Suspended)') || line.includes('Update Paused')) {
            appEntry.isPaused = true
            appEntry.isRunning = false
            appEntry.stateDetermined = true
          } else if (
            line.includes('scheduler finished : removed from schedule') ||
            line.includes('state changed : Fully Installed,')
          ) {
            appEntry.isFinished = true
            appEntry.stateDetermined = true
          }
        }

        if (line.includes('Committing')) {
          appEntry.isCommitting = true
        }

        if (appEntry.bytesToDownload === undefined && line.includes('update started :')) {
          const dlMatch = line.match(/download\s+(\d+)\/(\d+)/i)
          const stMatch = line.match(/stage\s+(\d+)\/(\d+)/i)
          if (dlMatch) {
            appEntry.bytesDownloaded = parseInt(dlMatch[1], 10)
            appEntry.bytesToDownload = parseInt(dlMatch[2], 10)
          }
          if (stMatch) {
            appEntry.bytesStaged = parseInt(stMatch[1], 10)
            appEntry.bytesToStage = parseInt(stMatch[2], 10)
          }
        }
      }
    }

    return res
  }

  // ---------------------------------------------------------------
  // 3. VARREDURA CIENTÍFICA DE MANIFESTOS (.acf)
  // ---------------------------------------------------------------

  public static async getSteamDownloadState(): Promise<SteamDownloadScanResult> {
    const steamRoot = await this.getSteamRootPath()
    const libraryFolders = await SteamDownloader.getSteamLibraryFolders()
    if (!libraryFolders || libraryFolders.length === 0) {
      return { active: null, rawActive: null, queue: [] }
    }

    const logPath = steamRoot ? join(steamRoot, 'logs', 'content_log.txt') : ''
    const logContent = this.readTailLog(logPath)
    const logTelemetry = this.parseSteamLog(logContent)

    const detectedApps: DetectedSteamApp[] = []
    const justFinishedApps: DetectedSteamApp[] = []
    const seenAppIds = new Set<string>()

    for (const libPath of libraryFolders) {
      const steamappsDir = join(libPath, 'steamapps')
      if (!existsSync(steamappsDir)) continue

      try {
        const files = readdirSync(steamappsDir)
        for (const file of files) {
          const match = file.match(/^appmanifest_(\d+)\.acf$/i)
          if (!match) continue

          const appId = match[1]
          if (IGNORED_STEAM_APP_IDS.has(appId) || seenAppIds.has(appId)) continue

          const acfPath = join(steamappsDir, file)
          try {
            const content = readFileSync(acfPath, 'utf8')
            const nameMatch = content.match(/"name"\s+"([^"]+)"/i)
            const dirMatch = content.match(/"installdir"\s+"([^"]+)"/i)
            const stateMatch = content.match(/"StateFlags"\s+"([^"]+)"/i)
            const dlMatch = content.match(/"BytesDownloaded"\s+"([^"]+)"/i)
            const toDlMatch = content.match(/"BytesToDownload"\s+"([^"]+)"/i)
            const stagedMatch = content.match(/"BytesStaged"\s+"([^"]+)"/i)
            const toStageMatch = content.match(/"BytesToStage"\s+"([^"]+)"/i)
            const sizeMatch = content.match(/"SizeOnDisk"\s+"([^"]+)"/i)
            const buildMatch = content.match(/"buildid"\s+"([^"]+)"/i)

            const title = nameMatch ? nameMatch[1].trim() : `Steam App ${appId}`
            const installDir = dirMatch ? dirMatch[1].trim() : appId
            const fullInstallPath = join(steamappsDir, 'common', installDir)
            const stateFlags = stateMatch ? parseInt(stateMatch[1], 10) : 0
            const bytesDownloaded = dlMatch ? parseInt(dlMatch[1], 10) : 0
            const bytesToDownload = toDlMatch ? parseInt(toDlMatch[1], 10) : 0
            const bytesStaged = stagedMatch ? parseInt(stagedMatch[1], 10) : 0
            const bytesToStage = toStageMatch ? parseInt(toStageMatch[1], 10) : 0
            const sizeOnDisk = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
            const buildId = buildMatch ? buildMatch[1].trim() : ''

            const hasUpdateFlags = (stateFlags & STEAM_UPDATE_FLAGS_MASK) !== 0
            const logEntry = logTelemetry.appStates.get(appId)

            // Um jogo só é considerado concluído se NÃO possui flags de update, está instalado (4) e o log confirma término
            const isInstalledClean = stateFlags === 4 && !hasUpdateFlags
            const wasTracked = this.trackedApps.has(appId) || this.pendingInstalls.has(appId)

            if ((isInstalledClean || logEntry?.isFinished) && wasTracked && !hasUpdateFlags) {
              justFinishedApps.push({
                appId,
                name: title,
                installDir,
                fullInstallPath,
                stateFlags: 4,
                bytesDownloaded: bytesToDownload,
                bytesToDownload,
                bytesStaged: bytesToStage,
                bytesToStage,
                sizeOnDisk,
                buildId,
                isPaused: false
              })
              this.trackedApps.delete(appId)
              this.pendingInstalls.delete(appId)
              continue
            }

            // O jogo só é ativo ou fila se possui flags reais de update
            if (!hasUpdateFlags && !this.pendingInstalls.has(appId)) {
              continue
            }

            const effToDownload = logEntry?.bytesToDownload || bytesToDownload
            const effToStage = logEntry?.bytesToStage || bytesToStage
            const isActivelyRunning =
              Boolean(logEntry?.isRunning) ||
              (stateFlags & (256 | 1024 | 131072 | 262144 | 524288)) !== 0
            const isPending = this.pendingInstalls.has(appId)

            // 1. Depots compartilhados, DLCs e Soundtracks (Bit 64: AppState_SharedInstall)
            // Não devem poluir a fila de downloads a menos que estejam ativamente baixando
            if ((stateFlags & 64) !== 0 && !isActivelyRunning && !isPending) {
              continue
            }

            // 2. Se tem zero bytes a baixar e zero bytes a processar (staging) e não está executando nem pendente,
            // trata-se de flag residual (ex: Update Required passivo em manifesto antigo) e não um download real
            if (effToDownload === 0 && effToStage === 0 && !isActivelyRunning && !isPending) {
              continue
            }

            const isPaused =
              (stateFlags & 512) !== 0 ||
              this.userPausedAppIds.has(appId) ||
              Boolean(logEntry?.isPaused)

            // Se estiver em execução na Steam, desmarca dismiss automaticamente
            if ((stateFlags & (256 | 1024 | 131072)) !== 0 || logEntry?.isRunning) {
              this.dismissedApps.delete(appId)
            } else if (this.dismissedApps.has(appId)) {
              continue
            }

            seenAppIds.add(appId)
            this.trackedApps.add(appId)
            this.pendingInstalls.delete(appId)

            detectedApps.push({
              appId,
              name: title,
              installDir,
              fullInstallPath,
              stateFlags,
              bytesDownloaded: Math.max(bytesDownloaded, logEntry?.bytesDownloaded ?? 0),
              bytesToDownload: logEntry?.bytesToDownload || bytesToDownload,
              bytesStaged: Math.max(bytesStaged, logEntry?.bytesStaged ?? 0),
              bytesToStage: logEntry?.bytesToStage || bytesToStage,
              sizeOnDisk,
              buildId,
              isPaused
            })
          } catch {}
        }
      } catch {}
    }

    // Processa jogos que acabaram de concluir
    for (const fApp of justFinishedApps) {
      await this.handleAppFinished(fApp)
    }

    // Processa instalações pendentes iniciadas pelo Ghost que ainda não criaram manifestos
    const now = Date.now()
    for (const [pAppId, pTime] of this.pendingInstalls.entries()) {
      if (now - pTime > 25000) {
        this.pendingInstalls.delete(pAppId)
      } else if (!seenAppIds.has(pAppId) && !this.dismissedApps.has(pAppId)) {
        seenAppIds.add(pAppId)
        const steamGamesList = libraryStore.get('games', [])
        const knownGame = steamGamesList.find((g) => g.app_name === pAppId)
        detectedApps.push({
          appId: pAppId,
          name: knownGame?.title || `Steam App ${pAppId}`,
          installDir: pAppId,
          fullInstallPath: join(libraryFolders[0] || 'N:\\Steam', 'steamapps', 'common', pAppId),
          stateFlags: 1024,
          bytesDownloaded: 0,
          bytesToDownload: 0,
          bytesStaged: 0,
          bytesToStage: 0,
          sizeOnDisk: 0,
          buildId: '',
          isPaused: false
        })
      }
    }

    if (detectedApps.length === 0) {
      return { active: null, rawActive: null, queue: [] }
    }

    // Determina o aplicativo ativo:
    // Prioridade 1: AppID indicado como ativo no log recente da Steam
    let activeApp: DetectedSteamApp | null = null
    if (logTelemetry.activeAppId) {
      activeApp = detectedApps.find((a) => a.appId === logTelemetry.activeAppId) || null
    }

    // Prioridade 2: Flag 256 (Update Running) ativa
    if (!activeApp) {
      activeApp = detectedApps.find((a) => (a.stateFlags & 256) !== 0) || null
    }

    // Prioridade 3: Instalação pendente solicitada pelo Ghost
    if (!activeApp) {
      for (const [pId] of this.pendingInstalls.entries()) {
        const match = detectedApps.find((a) => a.appId === pId)
        if (match) {
          activeApp = match
          break
        }
      }
    }

    // Prioridade 4: Primeiro aplicativo não pausado ou primeiro da lista
    if (!activeApp) {
      activeApp = detectedApps.find((a) => !a.isPaused) || detectedApps[0]
    }

    const queuedApps = detectedApps.filter((a) => a.appId !== activeApp?.appId)

    return {
      active: activeApp ? this.mapToDMElement(activeApp, true) : null,
      rawActive: activeApp,
      queue: queuedApps.map((a) => this.mapToDMElement(a, false))
    }
  }

  // ---------------------------------------------------------------
  // 4. MAPPER DE ELEMENTOS E DISPATCH DE TELEMETRIA
  // ---------------------------------------------------------------

  public static mapToDMElement(app: DetectedSteamApp, isCurrent: boolean): DMQueueElement {
    const steamGamesList = libraryStore.get('games', [])
    const knownGame = steamGamesList.find((g) => g.app_name === app.appId)

    const gameInfo: GameInfo = knownGame || {
      app_name: app.appId,
      title: app.name,
      runner: 'steam',
      is_installed: false,
      canRunOffline: true,
      art_square: STEAM_CDN.verticalCover(app.appId),
      art_cover: STEAM_CDN.horizontalBanner(app.appId),
      art_background: STEAM_CDN.heroBackground(app.appId),
      art_logo: STEAM_CDN.logo(app.appId),
      store_url: `https://store.steampowered.com/app/${app.appId}/`,
      install: {
        platform: 'Windows',
        is_dlc: false,
        install_path: app.fullInstallPath,
        executable: '',
        install_size: app.bytesToDownload > 0 ? `${(app.bytesToDownload / (1024 * 1024 * 1024)).toFixed(1)} GB` : ''
      }
    }

    const totalGb = app.bytesToDownload > 0 ? (app.bytesToDownload / (1024 * 1024 * 1024)).toFixed(2) : ''
    const sizeFormatted = totalGb ? `${totalGb} GB` : '?? GB'
    const isUpdate = Boolean(knownGame?.is_installed || (app.stateFlags & 4) !== 0)

    return {
      params: {
        appName: app.appId,
        runner: 'steam',
        path: app.fullInstallPath,
        platformToInstall: 'Windows',
        gameInfo,
        size: sizeFormatted
      },
      type: isUpdate ? 'update' : 'install',
      addToQueueTime: Date.now(),
      startTime: isCurrent ? Date.now() : 0,
      endTime: 0
    }
  }

  private static dispatchTelemetry(app: DetectedSteamApp, logTelemetry: SteamLogTelemetry) {
    const now = Date.now()
    const { isPaused, bytesDownloaded, bytesToDownload, bytesStaged, bytesToStage } = app

    // 1. Velocidade de rede real (Mbps -> MB/s)
    let downSpeedMB = 0
    if (isPaused) {
      downSpeedMB = 0
    } else if (logTelemetry.lastRateMbps > 0 && logTelemetry.rateAgeSec < 45) {
      downSpeedMB = Math.round((logTelemetry.lastRateMbps / 8) * 10) / 10
    }

    // 2. Velocidade de disco real (Delta Staged Bytes / Delta Time) - Zero senoide
    let diskSpeedMB = 0
    if (isPaused) {
      diskSpeedMB = 0
    } else if (this.lastDiskSample && this.lastDiskSample.appId === app.appId) {
      const deltaSec = Math.max(1, (now - this.lastDiskSample.time) / 1000)
      const deltaStaged = Math.max(0, bytesStaged - this.lastDiskSample.staged)
      if (deltaStaged > 0) {
        diskSpeedMB = Math.round((deltaStaged / (1024 * 1024 * deltaSec)) * 10) / 10
      } else if (downSpeedMB > 0) {
        diskSpeedMB = downSpeedMB
      }
    }
    this.lastDiskSample = {
      appId: app.appId,
      time: now,
      staged: bytesStaged,
      lastSpeedMBps: diskSpeedMB
    }

    // 3. Fases e Progresso Real
    const isNetworkPhase = bytesToDownload > 0 && bytesDownloaded < bytesToDownload
    const isStagingPhase = !isNetworkPhase && bytesToStage > 0 && bytesStaged < bytesToStage
    const isCommitting = !isNetworkPhase && !isStagingPhase && ((app.stateFlags & 524288) !== 0 || bytesToDownload > 0)

    let percent = 0
    if (isCommitting) {
      percent = 99
    } else if (isStagingPhase && bytesToStage > 0) {
      percent = Math.min(99, Math.max(1, Math.floor((bytesStaged / bytesToStage) * 100)))
    } else if (bytesToDownload > 0) {
      percent = Math.min(99, Math.max(1, Math.floor((bytesDownloaded / bytesToDownload) * 100)))
    }

    // 4. Texto formatado de bytes
    const totalGb = bytesToDownload > 0 ? (bytesToDownload / (1024 * 1024 * 1024)).toFixed(2) : '??'
    const curDlGb = (bytesDownloaded / (1024 * 1024 * 1024)).toFixed(2)

    let bytesString = ''
    if (isPaused) {
      bytesString = `${curDlGb} GB / ${totalGb} GB (Pausado)`
    } else if (isCommitting) {
      bytesString = `${totalGb} GB / ${totalGb} GB (Finalizando instalação...)`
    } else if (isStagingPhase) {
      const curStGb = (bytesStaged / (1024 * 1024 * 1024)).toFixed(2)
      const totStGb = (bytesToStage / (1024 * 1024 * 1024)).toFixed(2)
      bytesString = `${curStGb} GB / ${totStGb} GB (Instalando no disco...)`
    } else if (bytesToDownload > 0) {
      bytesString = `${curDlGb} GB / ${totalGb} GB`
    } else {
      bytesString = 'Iniciando download...'
    }

    // 5. ETA Real
    let formattedEta = '00:00'
    if (isPaused) {
      formattedEta = 'Pausado'
    } else if (isCommitting) {
      formattedEta = '00:03'
    } else if (isStagingPhase && diskSpeedMB > 0 && bytesToStage > 0) {
      const remBytes = Math.max(0, bytesToStage - bytesStaged)
      const sec = Math.round(remBytes / (diskSpeedMB * 1024 * 1024))
      formattedEta = sec > 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`
    } else if (downSpeedMB > 0 && bytesToDownload > 0) {
      const remBytes = Math.max(0, bytesToDownload - bytesDownloaded)
      const sec = Math.round(remBytes / (downSpeedMB * 1024 * 1024))
      formattedEta = sec > 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`
    }

    const isUpdate = (app.stateFlags & 4) !== 0
    const status: Status = isUpdate ? 'updating' : 'installing'

    sendProgressUpdate({
      appName: app.appId,
      runner: 'steam',
      status,
      folder: app.fullInstallPath,
      progress: {
        bytes: bytesString,
        eta: formattedEta,
        percent,
        downSpeed: downSpeedMB,
        diskSpeed: diskSpeedMB,
        folder: app.fullInstallPath
      }
    })

    sendGameStatusUpdate({
      appName: app.appId,
      runner: 'steam',
      status,
      folder: app.fullInstallPath,
      progress: {
        bytes: bytesString,
        eta: formattedEta,
        percent,
        downSpeed: downSpeedMB,
        diskSpeed: diskSpeedMB,
        folder: app.fullInstallPath
      }
    })
  }

  // ---------------------------------------------------------------
  // 5. CICLO PRINCIPAL (TICK)
  // ---------------------------------------------------------------

  public static async tick(): Promise<void> {
    try {
      const state = await this.getSteamDownloadState()
      const steamRoot = await this.getSteamRootPath()
      const logPath = steamRoot ? join(steamRoot, 'logs', 'content_log.txt') : ''
      const logContent = this.readTailLog(logPath)
      const logTelemetry = this.parseSteamLog(logContent)

      if (state.active && state.rawActive) {
        this.isWatching = true
        this.dispatchTelemetry(state.rawActive, logTelemetry)
      } else {
        const hadActive = this.isWatching
        this.isWatching = false
        if (hadActive) {
          sendFrontendMessage('refreshLibrary', 'steam')
        }
      }

      this.onQueueChanged?.()
    } catch (err) {
      safeLogWarning(['[SteamQueueWatcher] tick error:', err], LogPrefix.Steam)
    }
  }

  // ---------------------------------------------------------------
  // 6. CONCLUSÃO DE JOGOS (PILAR 3)
  // ---------------------------------------------------------------

  public static async handleAppFinished(app: DetectedSteamApp): Promise<void> {
    const appId = app.appId
    this.pendingInstalls.delete(appId)
    this.dismissedApps.delete(appId)
    this.userPausedAppIds.delete(appId)

    const now = Date.now()
    const lastHandled = this.handledFinishedAppIds.get(appId)
    if (lastHandled && now - lastHandled < 15000) {
      return
    }
    this.handledFinishedAppIds.set(appId, now)

    safeLogInfo(`Steam download finished for ${app.name} (${appId}). Processing completion.`, LogPrefix.Steam)

    // 1. Atualiza libraryStore com is_installed: true
    try {
      const list = libraryStore.get('games', [])
      const gameIdx = list.findIndex((g) => g.app_name === appId)
      const exes = findGameExecutables(app.fullInstallPath)
      const mainExe = exes.length > 0 ? exes[0] : ''

      if (gameIdx >= 0) {
        list[gameIdx] = {
          ...list[gameIdx],
          is_installed: true,
          install: {
            ...list[gameIdx].install,
            install_path: app.fullInstallPath,
            executable: mainExe,
            version: app.buildId || '1.0'
          }
        }
        libraryStore.set('games', list)
      }
    } catch (err) {
      safeLogWarning([`Failed to update libraryStore for finished Steam app ${appId}:`, err], LogPrefix.Steam)
    }

    // 2. Adiciona ao store 'finished' do DownloadManager
    const dmElem = this.mapToDMElement(app, false)
    dmElem.endTime = Date.now()
    dmElem.status = 'done'
    if (dmElem.params?.gameInfo) {
      dmElem.params.gameInfo.is_installed = true
    }

    try {
      const { addToFinished, emitQueueUpdate } = await import('../../downloadmanager/downloadqueue')
      addToFinished(dmElem, 'done')
      await emitQueueUpdate()
    } catch (err) {
      safeLogWarning([`Failed to add ${appId} to downloadManager finished:`, err], LogPrefix.Steam)
    }

    // 3. Notifica interface do Ghost
    sendProgressUpdate({
      appName: appId,
      runner: 'steam',
      status: 'done',
      folder: app.fullInstallPath,
      progress: {
        bytes: 'Concluído',
        eta: '00:00',
        percent: 100,
        downSpeed: 0,
        diskSpeed: 0,
        folder: app.fullInstallPath
      }
    })

    sendGameStatusUpdate({
      appName: appId,
      runner: 'steam',
      status: 'done'
    })

    sendFrontendMessage('refreshLibrary', 'steam')

    // 4. Resolve Promises de espera
    const resolver = this.completionResolvers.get(appId)
    if (resolver) {
      resolver({ status: 'done' })
      this.completionResolvers.delete(appId)
    }
  }

  // ---------------------------------------------------------------
  // 7. CONTROLES DO GHOST (PILAR 2: INICIAR, PAUSAR, CANCELAR)
  // ---------------------------------------------------------------

  public static async pauseApp(appId: string): Promise<void> {
    this.userPausedAppIds.add(appId)
    await this.triggerSteamUrl(`steam://pause/${appId}`)
    void this.tick()
  }

  public static async resumeApp(appId: string): Promise<void> {
    this.userPausedAppIds.delete(appId)
    this.dismissedApps.delete(appId)
    await this.triggerSteamUrl(`steam://install/${appId}`)
    void this.tick()
  }

  public static dismissApp(appId: string) {
    this.dismissedApps.add(appId)
    this.pendingInstalls.delete(appId)
    this.userPausedAppIds.delete(appId)

    const resolver = this.completionResolvers.get(appId)
    if (resolver) {
      resolver({ status: 'abort' })
      this.completionResolvers.delete(appId)
    }

    void this.triggerSteamUrl(`steam://pause/${appId}`)
    void this.tick()
  }

  public static undismissApp(appId: string) {
    this.dismissedApps.delete(appId)
  }

  public static isDismissed(appId: string): boolean {
    return this.dismissedApps.has(appId)
  }

  public static isUserPaused(appId: string): boolean {
    return this.userPausedAppIds.has(appId)
  }

  public static trackPendingInstall(appId: string) {
    this.dismissedApps.delete(appId)
    this.userPausedAppIds.delete(appId)
    this.pendingInstalls.set(appId, Date.now())
  }

  public static waitForCompletion(appId: string): Promise<InstallResult> {
    return new Promise((resolve) => {
      const steamGamesList = libraryStore.get('games', [])
      const knownGame = steamGamesList.find((g) => g.app_name === appId)
      if (knownGame?.is_installed && !this.trackedApps.has(appId)) {
        resolve({ status: 'done' })
        return
      }
      this.completionResolvers.set(appId, resolve)
    })
  }

  public static async triggerSteamUrl(url: string): Promise<void> {
    safeLogInfo([`[SteamQueueWatcher] triggerSteamUrl: ${url}`], LogPrefix.Steam)
    try {
      await shell.openExternal(url)
    } catch (err) {
      safeLogWarning([`shell.openExternal failed for ${url}:`, err], LogPrefix.Steam)
    }
  }
}
