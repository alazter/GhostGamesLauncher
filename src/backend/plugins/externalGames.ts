import { app, dialog, shell } from 'electron'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import {
  mkdir,
  readdir,
  rmdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  statfs,
  writeFile
} from 'fs/promises'
import { randomUUID } from 'crypto'
import { synchronizeExternalVersion } from './externalVersion'
import { selectWrappedPackage } from './wrappedPackage'
import { archiveSize } from './archiveSize'
import { planInstallSpace, sizeBytes, spaceReserve } from './installSpace'
import { gameDirectoryName, prepareNewInstallDirectory } from './installDirectory'
import type { GameInfo } from 'common/types'
import { basename, dirname, join, relative, resolve } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { userDataPath } from 'backend/constants/paths'
import { backendEvents } from 'backend/backend_events'
import { libraryStore } from 'backend/storeManagers/sideload/electronStores'
import { sendFrontendMessage } from 'backend/ipc'
import type {
  ExternalActionResult,
  ExternalDownloadJob,
  ExternalGameAction,
  ExternalGamesState,
  ExternalInstallation,
  ExternalSaveBackup,
  GhostDownloadSource,
  GhostSearchResult,
  LocalCandidateGame,
  PiratasSaveSyncResult,
  PluginManifest,
  SaveDiscoveryResult
} from 'common/types/plugins'
import { NetworkGuard } from './networkGuard'
import { AnkerAccount, ANKER_SOURCE_ID, ANKER_TORRENT_ID, ANKER_DIRECT_ID, ankerGameUrl } from './ankerAccount'
import { OnlineFixAccount, ONLINE_FIX_SOURCE_ID, ONLINE_FIX_TORRENT_ID, onlineFixGameUrl } from './onlineFixAccount'
import { TorboxClient, TorboxRejectedError } from './torboxClient'
import { TORBOX_DOWNLOAD_DOMAINS } from './torboxDomains'
import { torrentInfoHash } from './torrentMetadata'
import { setTimeout as waitForRemote } from 'timers/promises'
import {
  copySaveSnapshot,
  extractGame,
  hashFile,
  regularFiles,
  restoreSaveSnapshot
} from './externalFiles'
import { inside, replacementOperation } from './externalPolicy'
import {
  discoverSavePathForGame,
  EXCLUDED_PIRATAS_APP_NAMES
} from './piratasSaveKnowledge'

interface StoredJob extends ExternalDownloadJob {
  pendingArchive?: string
  replacementPrepared?: boolean
  removalStarted?: boolean
  temporaryDirectory?: string
  packageEstimate?: number
  installedEstimate?: number
  torboxId?: number
  torrentHash?: string
  torboxSubmissionPending?: boolean
  torboxWrapped?: boolean
  packageDownloaded?: boolean
  source: GhostDownloadSource
  manifest: PluginManifest
  directory: string
  stage: string
  archive: string
  old?: ExternalInstallation
  backupId?: string
  etag?: string
  commitStarted?: boolean
  previousLibrary?: GameInfo
  autoFinish?: boolean
  cleanReplace?: boolean
  replaceDirectory?: string
}
interface StoredState extends Omit<ExternalGamesState, 'jobs'> {
  jobs: StoredJob[]
  torboxReferences?: Record<string, { hash: string; id?: number; recordedAt: number }>
  lastUpdateCheckTime?: number
}

async function safeRename(
  from: string,
  to: string,
  maxRetries = 4,
  delayMs = 300
): Promise<void> {
  let lastErr: unknown
  for (let i = 0; i < maxRetries; i++) {
    try {
      await rename(from, to)
      return
    } catch (err: unknown) {
      lastErr = err
      const code = (err as { code?: string })?.code
      if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

let onExternalQueueChangedCallback: (() => Promise<void> | void) | null = null

export function setOnExternalQueueChanged(cb: () => Promise<void> | void): void {
  onExternalQueueChangedCallback = cb
}

export function notifyExternalQueueChanged(): void {
  try {
    void onExternalQueueChangedCallback?.()
  } catch {
    // ignora erro em callback
  }
}

export class ExternalGames {
  private static instance: ExternalGames
  static getInstance() {
    return (this.instance ??= new ExternalGames())
  }
  private readonly root = join(userDataPath, 'external-games')
  private readonly statePath = join(this.root, 'state.json')
  private state: StoredState = { jobs: [], installations: [], backups: [] }
  private active = false
  private controllers = new Map<string, AbortController>()
  private playing = new Set<string>()
  private locked = new Set<string>()
  private finishing = new Set<string>()

  private constructor() {
    mkdirSync(this.root, { recursive: true })
    if (existsSync(this.statePath))
      this.state = JSON.parse(
        readFileSync(this.statePath, 'utf8')
      ) as StoredState
    for (const job of this.state.jobs) {
      if (job.removalStarted) {
        job.status = 'error'
        job.error = 'A remoção foi interrompida. Retome para concluir a reinstalação; o backup foi preservado.'
      } else if (job.commitStarted) {
        this.recover(job)
      } else if (['downloading', 'queued'].includes(job.status))
        job.status = 'paused'
      else if (['extracting', 'installing'].includes(job.status)) {
        job.status = 'error'
        job.error =
          job.oldRemoved ? 'Reinstalação interrompida. O jogo está indisponível; o backup foi preservado.' : 'Operação interrompida. O jogo anterior e os backups foram preservados.'
      }
    }
    const migrationFlagFile = join(this.root, '.ghost-defaults-enabled-v1')
    const needsMigration = !existsSync(migrationFlagFile)
    let stateModified = false

    const initialGames = (libraryStore.get('games', []) || []) as GameInfo[]
    if (this.healInstallations(initialGames)) {
      stateModified = true
    }

    for (const installation of this.state.installations) {
      if (needsMigration) {
        installation.autoBackup = true
        installation.autoUpdate = true
        stateModified = true
      } else {
        if (installation.autoBackup === undefined) {
          installation.autoBackup = true
          stateModified = true
        }
        if (installation.autoUpdate === undefined) {
          installation.autoUpdate = true
          stateModified = true
        }
      }
      if (installation.game.version && existsSync(installation.executable)) {
        synchronizeExternalVersion(installation.appName, installation.game.version)
      }
    }

    if (needsMigration) {
      try {
        writeFileSync(migrationFlagFile, JSON.stringify({ migratedAt: new Date().toISOString() }))
      } catch {}
    }

    if (stateModified) {
      this.save()
    }
    backendEvents.on('gameStatusUpdate', ({ runner, appName, status }) => {
      if (runner !== 'sideload') return
      if (status === 'playing' || status === 'launching')
        this.playing.add(appName)
      else if (
        ['done', 'error', 'installed'].includes(status) &&
        this.playing.delete(appName)
      ) {
        const installation = this.state.installations.find(
          (item) => item.appName === appName
        )
        if (installation?.autoBackup && installation.savePath) {
          void this.action({
            type: 'backup',
            installationId: installation.id
          }).then((result) => {
            installation.backupError = result.error
            this.save()
          })
        }
      }
    })
    this.save()
  }

  private save() {
    const temporary = `${this.statePath}.tmp`
    const content = JSON.stringify(this.state, null, 2)
    try {
      writeFileSync(temporary, content)
      try {
        renameSync(temporary, this.statePath)
      } catch {
        // Fallback resiliente no Windows contra locks transitivos de antivírus
        writeFileSync(this.statePath, content)
        if (existsSync(temporary)) {
          try {
            unlinkSync(temporary)
          } catch {
            // ignora erro de unlink
          }
        }
      }
    } catch {
      writeFileSync(this.statePath, content)
    }
    sendFrontendMessage('external-games-updated', this.snapshot())
    notifyExternalQueueChanged()
  }

  private recover(job: StoredJob) {
    try {
      const rollback = join(dirname(job.directory), `.ghost-rollback-${job.id}`)
      if (existsSync(rollback)) {
        if (existsSync(job.directory)) {
          const marker = JSON.parse(
            readFileSync(join(job.directory, '.ghost-install.json'), 'utf8')
          ) as { id: string }
          if (marker.id !== job.installationId || existsSync(job.stage))
            throw new Error('Recuperação requer revisão das pastas.')
          renameSync(job.directory, job.stage)
        }
        renameSync(rollback, job.old?.directory || job.directory)
      } else if (
        (!job.old || job.oldRemoved) &&
        existsSync(job.directory) &&
        !existsSync(job.stage)
      ) {
        const marker = JSON.parse(
          readFileSync(join(job.directory, '.ghost-install.json'), 'utf8')
        ) as { id: string }
        if (marker.id !== job.installationId)
          throw new Error('Marcador de instalação inválido.')
        renameSync(job.directory, job.stage)
      }
      const appName = job.old?.appName || `external-${job.installationId}`
      const games = libraryStore
        .get('games', [])
        .filter((game) => game.app_name !== appName)
      if (job.previousLibrary) games.push(job.previousLibrary)
      libraryStore.set('games', games)
      this.state.installations = this.state.installations.filter(
        (item) => item.id !== job.installationId
      )
      if (job.old) this.state.installations.push(job.old)
      job.commitStarted = false
      job.status = existsSync(job.stage) ? 'ready' : 'error'
      job.error =
        job.oldRemoved ? 'Reinstalação interrompida. O jogo está indisponível; o backup foi preservado.' : 'Operação interrompida. A instalação anterior foi recuperada; os backups foram preservados.'
    } catch {
      job.status = 'error'
      job.error =
        'Recuperação automática incompleta. As pastas foram preservadas; revise a instalação antes de continuar.'
    }
  }

  canLaunch(appName: string): boolean {
    if (this.state.jobs.some(job => job.old?.appName === appName && (job.removalStarted || job.oldRemoved) && job.status !== 'completed')) return false
    const installation = this.state.installations.find(
      (item) => item.appName === appName
    )
    return (
      !installation ||
      (!this.locked.has(installation.id) && !this.finishing.has(installation.id) &&
        !this.state.jobs.some(
          (job) => job.installationId === installation.id && job.commitStarted
        ))
    )
  }

  setInstalledVersion(appName: string, version: string): void {
    const installation = this.state.installations.find(item => item.appName === appName)
    if (!installation) return
    if (this.locked.has(installation.id) || this.finishing.has(installation.id) ||
        this.state.jobs.some(job => job.installationId === installation.id && !['completed', 'cancelled', 'error'].includes(job.status)))
      throw new Error('Aguarde a instalação terminar antes de editar a versão.')
    installation.game = { ...installation.game, version: version.trim() || undefined }
    installation.availableUpdate = undefined
    installation.updateMessage = undefined
    synchronizeExternalVersion(appName, installation.game.version)
    this.save()
  }

  recordUpdate(id: string, update?: GhostSearchResult, message?: string) {
    const installation = this.state.installations.find((item) => item.id === id)
    if (installation) {
      installation.availableUpdate = update
      installation.updateMessage = message
      this.save()
    }
  }

  public async discoverSavePathEnhanced(
    installation: ExternalInstallation
  ): Promise<SaveDiscoveryResult> {
    const home = app.getPath('home')
    return await discoverSavePathForGame({
      appName: installation.appName,
      title: installation.game.title,
      directory: installation.directory,
      executable: installation.executable,
      homeDir: home
    })
  }

  public async discoverSavePath(
    installation: ExternalInstallation
  ): Promise<string | undefined> {
    const discovery = await this.discoverSavePathEnhanced(installation)
    if (discovery?.path) {
      installation.savePath = discovery.path
      installation.saveDetectionType = discovery.detectionType
      installation.saveDetectionDetails = discovery.details
      installation.saveFilesCount = discovery.fileCount
      installation.saveTotalBytes = discovery.totalBytes
      return discovery.path
    }
    return undefined
  }

  public async getOrCreateInstallation(
    appName: string,
    gameInfo?: GameInfo
  ): Promise<ExternalInstallation> {
    let installation = this.state.installations.find(
      (item) => item.appName === appName
    )
    if (installation) {
      if (installation.autoBackup === undefined) {
        installation.autoBackup = true
      }
      if (installation.autoUpdate === undefined) {
        installation.autoUpdate = true
      }
      if (!installation.savePath) {
        const autoSave = await this.discoverSavePathEnhanced(installation)
        if (autoSave?.path) {
          installation.savePath = autoSave.path
          installation.saveDetectionType = autoSave.detectionType
          installation.saveDetectionDetails = autoSave.details
          installation.saveFilesCount = autoSave.fileCount
          installation.saveTotalBytes = autoSave.totalBytes
          this.save()
        }
      }
      return installation
    }

    const libraryGames = libraryStore.get('games', [])
    const foundGame = libraryGames.find((g) => g.app_name === appName) || gameInfo
    const title = foundGame?.title || appName
    const executable = foundGame?.install?.executable || ''
    const directory = foundGame?.install?.install_path || foundGame?.folder_name || (executable ? dirname(executable) : '')

    const id = randomUUID()
    installation = {
      id,
      appName,
      game: {
        id: appName,
        title,
        providerId: 'sideload',
        providerName: 'Sideload / Piratas',
        platform: 'windows',
        version: foundGame?.version || '1.0'
      },
      directory,
      executable,
      installedAt: new Date().toISOString(),
      savePath: undefined,
      autoBackup: true,
      autoUpdate: true,
      linkedExisting: true,
      history: []
    }

    const autoSave = await this.discoverSavePathEnhanced(installation)
    if (autoSave?.path) {
      installation.savePath = autoSave.path
      installation.saveDetectionType = autoSave.detectionType
      installation.saveDetectionDetails = autoSave.details
      installation.saveFilesCount = autoSave.fileCount
      installation.saveTotalBytes = autoSave.totalBytes
    }

    this.state.installations.push(installation)
    this.save()
    return installation
  }

  public async syncPiratasSaves(options?: {
    autoBackup?: boolean
  }): Promise<PiratasSaveSyncResult> {
    const libraryGames = libraryStore.get('games', [])
    const piratasGames = libraryGames.filter((g) => {
      if (g.runner !== 'sideload') return false
      if (EXCLUDED_PIRATAS_APP_NAMES.has(g.app_name)) return false
      return true
    })

    const result: PiratasSaveSyncResult = {
      total: piratasGames.length,
      mapped: 0,
      existingOnDisk: 0,
      backedUp: 0,
      errors: [],
      results: []
    }

    for (let i = 0; i < piratasGames.length; i++) {
      const game = piratasGames[i]
      sendFrontendMessage('external-games-piratas-sync-progress', {
        current: i + 1,
        total: piratasGames.length,
        gameTitle: game.title,
        status: `Analisando saves de ${game.title}...`
      })

      try {
        const installation = await this.getOrCreateInstallation(game.app_name, game)
        const discovery = await this.discoverSavePathEnhanced(installation)

        if (discovery?.path) {
          result.mapped++
          installation.savePath = discovery.path
          installation.saveDetectionType = discovery.detectionType
          installation.saveDetectionDetails = discovery.details
          installation.saveFilesCount = discovery.fileCount
          installation.saveTotalBytes = discovery.totalBytes
          installation.autoBackup = true
          installation.autoUpdate = true
        }

        let backupCreated = false
        let backupId: string | undefined

        if (discovery?.hasFiles && options?.autoBackup !== false) {
          result.existingOnDisk++
          try {
            const backup = await this.backup(installation)
            backupCreated = true
            backupId = backup.id
            result.backedUp++
          } catch (bErr) {
            console.warn(`[GhostShield] Falha ao criar snapshot para ${game.title}:`, bErr)
          }
        } else if (discovery?.existsOnDisk) {
          result.existingOnDisk++
        }

        result.results.push({
          appName: game.app_name,
          title: game.title,
          savePath: discovery?.path || '',
          detectionType: discovery?.details || discovery?.detectionType || 'desconhecido',
          hasFiles: Boolean(discovery?.hasFiles),
          backupCreated,
          backupId,
          bytes: discovery?.totalBytes,
          files: discovery?.fileCount
        })
      } catch (err) {
        result.errors.push({
          title: game.title,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    this.save()
    sendFrontendMessage('external-games-piratas-sync-progress', {
      current: piratasGames.length,
      total: piratasGames.length,
      gameTitle: 'Concluído',
      status: `Varredura concluída com sucesso: ${result.backedUp} backups gerados.`
    })

    return result
  }

  public async deleteBackup(
    installationId: string,
    backupId: string
  ): Promise<ExternalActionResult> {
    if (this.state.jobs.some(job => job.backupId === backupId && job.status !== 'completed'))
      return { success: false, error: 'Este backup protege uma reinstalação pendente.' }
    const backupIndex = this.state.backups.findIndex(
      (b) => b.id === backupId && b.installationId === installationId
    )
    if (backupIndex === -1) {
      return { success: false, error: 'Backup não encontrado.' }
    }
    const backupFolder = join(this.root, 'backups', backupId)
    try {
      if (existsSync(backupFolder)) {
        await rm(backupFolder, { recursive: true, force: true })
      }
    } catch {
      // continua
    }
    this.state.backups.splice(backupIndex, 1)
    this.save()
    return { success: true }
  }

  public resolveTargetExecutable(job: StoredJob): string | undefined {
    if (!job.candidates || !job.candidates.length) return undefined

    // 1. Prioridade: mesmo caminho relativo da instalação anterior
    if (job.old?.executable && job.old?.directory) {
      const oldRel = relative(job.old.directory, job.old.executable).replace(/\\/g, '/')
      const exactMatch = job.candidates.find((c) => c.replace(/\\/g, '/') === oldRel)
      if (exactMatch) return exactMatch

      // 2. Prioridade: mesmo nome de executável anterior
      const oldBase = basename(job.old.executable).toLowerCase()
      const baseMatch = job.candidates.find((c) => basename(c).toLowerCase() === oldBase)
      if (baseMatch) return baseMatch
    }

    // 3. Se houver apenas 1 executável candidato
    if (job.candidates.length === 1) {
      return job.candidates[0]
    }

    // 4. Filtrar binários utilitários
    const cleanCandidates = job.candidates.filter(
      (c) => !/(?:unins\w*|setup|install|crash|report|vcredist|dxsetup|patch|updater)\.exe$/i.test(c)
    )
    if (cleanCandidates.length === 1) {
      return cleanCandidates[0]
    }

    // 5. Comparar similaridade com o título do jogo
    const titleWords = job.game.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    let bestCandidate: string | undefined
    let bestScore = -1
    const pool = cleanCandidates.length > 0 ? cleanCandidates : job.candidates
    for (const c of pool) {
      const name = basename(c).toLowerCase()
      let score = 0
      for (const w of titleWords) {
        if (name.includes(w)) score += 10
      }
      const depth = c.split(/[/\\]/).length
      score -= depth
      if (score > bestScore) {
        bestScore = score
        bestCandidate = c
      }
    }

    return bestCandidate || pool[0]
  }

  private healInstallations(games: GameInfo[]): boolean {
    if (!Array.isArray(games) || games.length === 0) return false
    let modified = false

    const norm = (str?: string) =>
      (str || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    // 1. Reconstitui instalações a partir de completed jobs em state.jobs com executável existente
    for (const job of this.state.jobs) {
      if (job.status === 'completed' && job.installationId) {
        const appName = job.old?.appName || `external-${job.installationId}`
        const libGame = games.find(
          (g) =>
            (g.app_name === appName ||
              (g.title && job.game?.title && norm(g.title) === norm(job.game.title))) &&
            g.runner === 'sideload' &&
            g.is_installed !== false
        )
        if (!libGame) continue

        const exists = this.state.installations.some(
          (i) => i.id === job.installationId || i.appName === libGame.app_name
        )
        if (!exists) {
          const directory =
            libGame.folder_name ||
            libGame.install?.install_path ||
            job.directory
          const executable =
            libGame.install?.executable ||
            (job.candidates?.[0] ? join(directory, job.candidates[0]) : '')
          if (!executable || !existsSync(executable)) continue

          this.state.installations.push({
            id: job.installationId,
            appName: libGame.app_name,
            game: {
              ...job.game,
              version: libGame.version || job.game?.version || '1.0'
            },
            directory,
            executable,
            installedAt: job.createdAt || new Date().toISOString(),
            autoBackup: true,
            autoUpdate: true,
            history: []
          })
          modified = true
        }
      }
    }

    // 2. Reconstitui instalações a partir de jogos sideload com prefixo 'external-' cujo executável exista
    for (const g of games) {
      if (g.runner === 'sideload' && g.app_name?.startsWith('external-') && g.is_installed !== false) {
        const instId = g.app_name.replace(/^external-/, '')
        const exists = this.state.installations.some(
          (i) => i.appName === g.app_name || i.id === instId
        )
        if (!exists) {
          const executable = g.install?.executable || ''
          if (!executable || !existsSync(executable)) continue
          const directory =
            g.install?.install_path ||
            g.folder_name ||
            dirname(executable)
          this.state.installations.push({
            id: instId,
            appName: g.app_name,
            game: {
              id: g.app_name,
              title: g.title,
              providerId: 'sideload',
              providerName: 'Sideload / Piratas',
              platform: 'windows',
              version: g.version || '1.0'
            },
            directory,
            executable,
            installedAt: new Date().toISOString(),
            autoBackup: true,
            autoUpdate: true,
            history: []
          })
          modified = true
        }
      }
    }

    return modified
  }

  snapshot(): ExternalGamesState {
    const games = (libraryStore.get('games', []) || []) as GameInfo[]
    let stateChanged = false

    // Autocura defensiva: recupera instalações de jobs concluídos e jogos sideload
    if (this.healInstallations(games)) {
      stateChanged = true
    }

    // Auto-prune: remove instalações se o jogo foi removido da biblioteca ou se o executável foi deletado
    {
      const beforeCount = this.state.installations.length
      this.state.installations = this.state.installations.filter((inst) => {
        if (!inst.appName) return true
        if (this.state.jobs.some(job => job.installationId === inst.id && job.commitStarted)) return true
        const libGame = Array.isArray(games) && games.find((g) => g.app_name === inst.appName && g.runner === 'sideload' && g.is_installed !== false)
        if (!libGame) return false
        if (inst.executable && !existsSync(inst.executable)) return false
        return true
      })
      if (this.state.installations.length !== beforeCount) {
        stateChanged = true
      }
    }

    for (const inst of this.state.installations) {
      const libGame = games.find((g: any) => g.app_name === inst.appName)
      if (libGame) {
        const libExecutable = libGame.install?.executable || ''
        const libDir =
          libGame.install?.install_path ||
          libGame.folder_name ||
          (libExecutable ? dirname(libExecutable) : '')
        if (libDir && libDir !== inst.directory) {
          inst.directory = libDir
          stateChanged = true
        }
        if (libExecutable && libExecutable !== inst.executable) {
          inst.executable = libExecutable
          stateChanged = true
        }
      }
    }

    if (stateChanged) {
      this.save()
    }

    return {
      jobs: this.state.jobs.map((job) => ({
        id: job.id,
        game: job.game,
        installationId: job.installationId,
        operation: job.operation,
        status: job.status,
        bytes: job.bytes,
        total: job.total,
        speed: job.speed,
        createdAt: job.createdAt,
        error: job.error,
        transport: job.transport,
        transferPhase: job.transferPhase,
        remoteProgress: job.remoteProgress,
        remoteStatus: job.remoteStatus,
        oldRemoved: job.oldRemoved || job.removalStarted,
        spacePlan: job.spacePlan,
        canResume: !job.commitStarted && (this.canRetryPackage(job) || (!existsSync(job.stage) && Boolean(job.oldRemoved || job.removalStarted || ['torbox', 'anker-direct'].includes(job.transport || '')))),
        candidates: job.candidates
      })),
      installations: this.state.installations.filter(inst =>
        this.state.jobs.some(job => job.installationId === inst.id && job.commitStarted) ||
        (!!inst.executable && existsSync(inst.executable))
      ),
      backups: this.state.backups
    }
  }

  removeInstallation(idOrAppName: string): boolean {
    const before = this.state.installations.length
    this.state.installations = this.state.installations.filter(
      (item) => item.id !== idOrAppName && item.appName !== idOrAppName
    )
    if (this.state.installations.length !== before) {
      this.save()
      sendFrontendMessage('external-games-updated', this.snapshot())
      return true
    }
    return false
  }

  private installation(id: string) {
    const installation = this.state.installations.find((item) => item.id === id)
    if (!installation) throw new Error('Instalação externa não encontrada.')
    const game = libraryStore
      .get('games', [])
      .find((item) => item.app_name === installation.appName)
    if (!game || game.runner !== 'sideload') {
      throw new Error(
        'O vínculo com a instalação externa mudou. Nenhum arquivo foi alterado.'
      )
    }
    // Sincroniza dinamicamente se o executável ou diretório foi alterado na biblioteca
    if (
      game.install?.executable &&
      resolve(game.install.executable) !== resolve(installation.executable)
    ) {
      installation.executable = game.install.executable
      installation.directory =
        game.install.install_path ||
        game.folder_name ||
        dirname(game.install.executable)
      this.save()
    }
    if (this.playing.has(installation.appName))
      throw new Error('Feche o jogo antes de continuar.')
    return installation
  }

  localCandidates(): LocalCandidateGame[] {
    const registered = new Set(this.state.installations.map((item) => item.appName))
    return libraryStore
      .get('games', [])
      .filter(
        (game) =>
          game.runner === 'sideload' &&
          game.is_installed &&
          game.install?.platform === 'Windows' &&
          !!game.install?.executable && existsSync(game.install.executable) &&
          !registered.has(game.app_name)
      )
      .map((game) => {
        const executable = game.install?.executable || ''
        const directory =
          game.install?.install_path ||
          game.folder_name ||
          (executable ? dirname(executable) : '')
        return {
          appName: game.app_name,
          title: game.title,
          directory,
          executable,
          version: game.version
        }
      })
  }

  async linkExisting(
    appName: string,
    sourceGame: GhostSearchResult
  ): Promise<ExternalActionResult> {
    if (this.locked.has(appName))
      return {
        success: false,
        error: 'Este vínculo já está sendo configurado.'
      }
    this.locked.add(appName)
    try {
      const game = libraryStore
        .get('games', [])
        .find((item) => item.app_name === appName)
      if (
        !game ||
        !this.localCandidates().some((item) => item.appName === appName) ||
        sourceGame.platform !== 'windows'
      )
        throw new Error(
          'Somente jogos Windows externos ainda não vinculados podem ser associados.'
        )
      if (this.playing.has(appName))
        throw new Error('Feche o jogo antes de vincular a fonte.')
      const choice = await dialog.showOpenDialog({
        title: 'Selecione a pasta raiz deste jogo (não a biblioteca inteira)',
        defaultPath: dirname(game.install.executable!),
        properties: ['openDirectory']
      })
      if (choice.canceled || !choice.filePaths[0]) return { success: false }
      const directory = await realpath(choice.filePaths[0])
      const executable = game.install.executable!
      if (
        !inside(directory, await realpath(executable)) ||
        inside(directory, this.root) ||
        directory === resolve(app.getPath('home')) ||
        dirname(directory) === directory
      )
        throw new Error('A pasta deve conter exclusivamente este jogo.')
      const otherGames = libraryStore
        .get('games', [])
        .filter((item) => item.app_name !== appName && item.install?.executable)
      if (
        otherGames.some((item) => inside(directory, item.install.executable!))
      )
        throw new Error(
          'A pasta contém outros jogos. Selecione a pasta específica deste jogo.'
        )
      if (existsSync(join(directory, '.ghost-install.json')))
        throw new Error('Esta pasta já possui um vínculo do Ghost.')
      const answer = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Cancelar', 'Vincular fonte'],
        defaultId: 0,
        cancelId: 0,
        title: 'Vincular jogo existente',
        message: `${game.title} → ${sourceGame.providerName}`,
        detail: `Confirme que a página corresponde ao mesmo jogo e edição. Pasta: ${directory}\nNas próximas reinstalações, todo o conteúdo desta pasta será substituído após o backup dos saves configurados.`
      })
      if (answer.response !== 1) return { success: false }
      const id = randomUUID()
      await writeFile(
        join(directory, '.ghost-install.json'),
        JSON.stringify({ id }),
        { flag: 'wx' }
      )
      this.state.installations.push({
        id,
        appName,
        game: { ...sourceGame, version: game.version || undefined },
        directory,
        executable,
        installedAt: new Date().toISOString(),
        autoBackup: true,
        autoUpdate: true,
        linkedExisting: true,
        history: []
      })
      this.save()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      this.locked.delete(appName)
    }
  }

  private async owned(directory: string, id: string) {
    const markerFile = join(directory, '.ghost-install.json')
    if (!existsSync(markerFile)) {
      const match = this.state.installations.find(
        (item) =>
          item.id === id &&
          (resolve(item.directory) === resolve(directory) || item.linkedExisting)
      )
      if (match && existsSync(directory)) {
        await writeFile(markerFile, JSON.stringify({ id }), 'utf8').catch(() => undefined)
        return
      }
      throw new Error('Pasta não pertence a esta instalação do Ghost.')
    }
    try {
      const marker = JSON.parse(
        await readFile(markerFile, 'utf8')
      ) as { id: string }
      if (
        marker.id !== id &&
        !this.state.installations.some(
          (item) =>
            item.id === id &&
            (resolve(item.directory) === resolve(directory) || item.linkedExisting)
        )
      ) {
        throw new Error('Pasta não pertence a esta instalação do Ghost.')
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Pasta não pertence a esta instalação do Ghost.') {
        throw e
      }
      const match = this.state.installations.find(
        (item) =>
          item.id === id &&
          (resolve(item.directory) === resolve(directory) || item.linkedExisting)
      )
      if (match && existsSync(directory)) {
        await writeFile(markerFile, JSON.stringify({ id }), 'utf8').catch(() => undefined)
        return
      }
      throw new Error('Pasta não pertence a esta instalação do Ghost.')
    }
  }

  async enqueue(
    game: GhostSearchResult,
    source: GhostDownloadSource,
    manifest: PluginManifest,
    replaceId?: string,
    automatic = false,
    autoFinish = automatic,
    targetDirectory?: string,
    confirmed = false,
    chooseDirectory = false
  ): Promise<ExternalActionResult> {
    const previous = replaceId ? this.state.installations.find(item => item.id === replaceId) : undefined
    if (previous && !existsSync(previous.executable) && !this.playing.has(previous.appName) &&
      !this.state.jobs.some(job => job.installationId === previous.id && job.commitStarted)) {
      if (targetDirectory && resolve(targetDirectory) === resolve(previous.directory)) targetDirectory = dirname(previous.directory)
      replaceId = undefined
    }
    // A removed registration must not turn a fresh download into a replacement.
    if (replaceId && !previous) replaceId = undefined
    const old = replaceId ? this.installation(replaceId) : undefined
    const viaTorbox = source.type === 'torbox'
    const viaBrowser = manifest.id === ANKER_SOURCE_ID && source.id === ANKER_DIRECT_ID
    if (viaBrowser) ankerGameUrl(source.url)
    if (viaTorbox) {
      this.torrentProvider(manifest.id, source.id, source.url)
      await TorboxClient.saved()
    }
    if (game.platform !== 'windows')
      throw new Error(
        'A instalação automática desta plataforma ainda não está disponível. Este fluxo aceita jogos Windows em ZIP, RAR ou 7Z.'
      )
    const operation = old ? replacementOperation(old, game) : 'install'
    if (
      automatic &&
      (!old?.autoUpdate ||
        operation !== 'update' ||
        (!viaTorbox && (source.type !== 'direct' ||
        !['zip', 'rar', '7z', 'tar'].includes(source.archive || 'zip'))))
    )
      throw new Error('Atualização automática indisponível para esta fonte.')
    if (
      this.state.jobs.some(
        (job) =>
          (job.installationId === replaceId ||
            (!old &&
              job.game.id === game.id &&
              job.game.providerId === game.providerId)) &&
          !['completed', 'cancelled', 'error'].includes(job.status)
      )
    ) {
      throw new Error('Já existe uma operação para este jogo em Downloads.')
    }
    if (old) {
      await this.owned(old.directory, old.id)
      if (!old.savePath) {
        const autoSave = await this.discoverSavePath(old)
        if (autoSave) {
          old.savePath = autoSave
          this.save()
        } else {
          throw new Error('Não foi possível identificar os saves. Configure a pasta de saves antes de substituir o jogo.')
        }
      }
      const answer = automatic || confirmed
        ? { response: 1 }
        : await dialog.showMessageBox({
            type: 'question',
            buttons: ['Cancelar', 'Reinstalar e preservar saves'],
            defaultId: 0,
            cancelId: 0,
            title:
              operation === 'update'
                ? 'Atualizar jogo externo'
                : 'Trocar fonte',
            message: `${old.game.title} (${old.game.providerName}) → ${game.title} (${game.providerName})`,
            detail:
              'Confirme que se trata do mesmo jogo e de uma edição compatível. A reinstalação será limpa: mods e configurações não serão migrados. Os saves terão backup; a compatibilidade entre fontes depende do jogo.'
          })
      if (answer.response !== 1) return { success: false }
    }

    if (!old && chooseDirectory) {
      const selection = await dialog.showOpenDialog({
        title: 'Onde deseja baixar e instalar o jogo?',
        defaultPath: targetDirectory,
        properties: ['openDirectory', 'createDirectory']
      })
      if (selection.canceled || !selection.filePaths[0]) return { success: false }
      targetDirectory = selection.filePaths[0]
    }
    const installationId = old?.id || randomUUID()
    let parent: string
    let finalDirectory: string
    let cleanReplace = false
    let replaceDirectory: string | undefined
    if (old) {
      if (targetDirectory && existsSync(targetDirectory) && resolve(targetDirectory) !== resolve(old.directory)) {
        parent = targetDirectory
        finalDirectory = join(parent, basename(old.directory) || `ghost-${installationId}`)
      } else {
        parent = dirname(old.directory)
        finalDirectory = old.directory
      }
    } else if (targetDirectory && existsSync(targetDirectory)) {
      if (basename(targetDirectory).toLowerCase() === gameDirectoryName(game.title).toLowerCase()) {
        parent = dirname(targetDirectory)
        finalDirectory = targetDirectory
      } else {
        parent = targetDirectory
        finalDirectory = join(parent, gameDirectoryName(game.title))
      }
    } else {
      const selection = await dialog.showOpenDialog({
        title: 'Escolha onde instalar o jogo',
        properties: ['openDirectory', 'createDirectory']
      })
      if (selection.canceled || !selection.filePaths[0]) {
        return { success: false }
      }
      parent = selection.filePaths[0]
      if (basename(parent).toLowerCase() === gameDirectoryName(game.title).toLowerCase()) {
        finalDirectory = parent
        parent = dirname(parent)
      } else {
        finalDirectory = join(parent, gameDirectoryName(game.title))
      }
    }

    if (!old && existsSync(finalDirectory)) {
      cleanReplace = true
      replaceDirectory = finalDirectory
    }

    const id = randomUUID()
    const work = join(this.root, 'downloads', id)
    const archiveExt = source.archive === '7z' ? '.7z' : source.archive === 'rar' ? '.rar' : source.archive === 'tar' ? '.tar' : '.zip'
    const isDirectArchive = source.type === 'direct' && ['zip', 'rar', '7z', 'tar'].includes(source.archive || 'zip')
    const job: StoredJob = {
      id,
      game,
      source,
      manifest,
      installationId,
      operation,
      old,
      cleanReplace,
      replaceDirectory,
      directory: finalDirectory,
      stage: join(parent, `.ghost-stage-${id}`),
      archive: join(work, `package${archiveExt}`),
      status: isDirectArchive || viaTorbox || viaBrowser ? 'queued' : 'awaiting-file',
      transport: viaTorbox ? 'torbox' : viaBrowser ? 'anker-direct' : undefined,
      bytes: 0,
      speed: 0,
      candidates: [],
      createdAt: new Date().toISOString(),
      autoFinish: Boolean(autoFinish || automatic)
    }
    this.state.jobs.push(job)
    if (old && confirmed) {
      this.locked.add(installationId)
      job.status = 'paused'
      this.save()
      try {
        await this.prepareReplacement(job)
        if (await this.checkReplacementSpace(job))
          job.status = isDirectArchive || viaTorbox || viaBrowser ? 'queued' : 'awaiting-file'
      } catch (error) {
        job.status = 'error'
        job.error = `${error instanceof Error ? error.message : String(error)}${job.oldRemoved || job.removalStarted ? ' O jogo está indisponível até concluir a reinstalação. O backup foi preservado.' : ''}`
      } finally { this.locked.delete(installationId) }
    }
    this.save()
    if (job.status === 'awaiting-file') {
      const url = new URL(source.url)
      if (!['https:', 'http:', 'magnet:'].includes(url.protocol))
        throw new Error('Protocolo externo não permitido.')
      await shell.openExternal(url.href)
    }
    void this.pump()
    return { success: true, jobId: id }
  }

  private async prepareReplacement(job: StoredJob) {
    if (job.replacementPrepared) return
    const old = job.old!
    if (this.playing.has(old.appName)) throw new Error('Feche o jogo antes de reinstalar.')
    const directory = resolve(old.directory)
    if (directory === dirname(directory) || directory.toLowerCase() === resolve(this.root).toLowerCase() || inside(directory, this.root) || inside(this.root, directory) ||
        inside(directory, dirname(job.directory)) ||
        libraryStore.get('games', []).some(game => game.app_name !== old.appName && game.install?.install_path &&
          (resolve(game.install.install_path) === directory || inside(directory, game.install.install_path))) ||
        this.state.installations.some(item => item.id !== old.id &&
          (resolve(item.directory) === directory || inside(directory, item.directory))))
      throw new Error('A pasta contém outros dados gerenciados e não pode ser apagada.')
    if (existsSync(directory)) {
      if (resolve(await realpath(directory)).toLowerCase() !== directory.toLowerCase())
        throw new Error('A pasta da instalação foi redirecionada.')
      const marker = JSON.parse(await readFile(join(directory, '.ghost-install.json'), 'utf8')) as { id: string }
      if (marker.id !== old.id) throw new Error('Marcador da instalação inválido.')
      const files = await regularFiles(directory)
      if (!job.installedEstimate) {
        let footprint = 0
        for (const file of files) footprint += (await stat(file)).size
        job.packageEstimate = sizeBytes(job.source.size) || sizeBytes(job.game.size) || footprint
        job.installedEstimate = sizeBytes(job.game.installedSize) || Math.max(footprint, job.packageEstimate * 3)
      }
    }
    if (!job.backupId) {
      if (!old.savePath || !(await regularFiles(old.savePath)).length)
        throw new Error('Nenhum save encontrado. Configure a pasta correta antes de substituir o jogo.')
      job.backupId = (await this.backup(old)).id
    }
    // Verify every persisted backup byte again before any destructive operation.
    const backupPath = join(this.root, 'backups', job.backupId)
    const snapshot = JSON.parse(await readFile(join(backupPath, '.ghost-save-manifest.json'), 'utf8')) as { files: Array<{ path: string; sha256: string }> }
    if (!snapshot.files.length) throw new Error('O backup está vazio.')
    for (const file of snapshot.files) {
      const path = resolve(backupPath, file.path)
      if (!inside(backupPath, path) || await hashFile(path) !== file.sha256)
        throw new Error('O backup não passou na verificação. A exclusão foi bloqueada.')
    }
    const removal = join(dirname(directory), `.ghost-remove-${job.id}`)
    if (existsSync(removal) && (!job.removalStarted || existsSync(directory)))
      throw new Error('A pasta de remoção já existe. Nenhuma pasta adicional foi apagada.')
    if (!job.removalStarted) job.installedEstimate = (job.installedEstimate || 0) + (this.state.backups.find(item => item.id === job.backupId)?.bytes || 0)
    job.removalStarted = true
    this.save()
    if (existsSync(directory)) await safeRename(directory, removal)
    if (existsSync(removal)) {
      if (resolve(await realpath(removal)).toLowerCase() !== resolve(removal).toLowerCase())
        throw new Error('A pasta de remoção foi redirecionada.')
      await rm(removal, { recursive: true, force: true })
    }
    job.oldRemoved = true
    job.removalStarted = false
    job.replacementPrepared = true
    libraryStore.set('games', libraryStore.get('games', []).map(game =>
      game.app_name === old.appName ? { ...game, is_installed: false } : game))
    this.save()
    sendFrontendMessage('refreshLibrary', 'sideload')
  }

  private async checkReplacementSpace(job: StoredJob, acceptAlternative = false): Promise<boolean> {
    const plan = await planInstallSpace(dirname(job.directory), job.id,
      job.packageEstimate || 0, job.installedEstimate || 0,
      !sizeBytes(job.game.installedSize) || !(sizeBytes(job.source.size) || sizeBytes(job.game.size)))
    if (job.temporaryDirectory) {
      const disk = await statfs(job.temporaryDirectory)
      const sameDisk = (await stat(job.temporaryDirectory)).dev === (await stat(dirname(job.directory))).dev
      const required = Math.max(0, plan.packageBytes - job.bytes) + spaceReserve + (sameDisk ? plan.installedBytes : 0)
      if (!plan.missingDestination && disk.bavail * disk.bsize >= required) {
        job.spacePlan = undefined
        return true
      }
      if (acceptAlternative && plan.temporaryDirectory && plan.temporaryDirectory !== job.temporaryDirectory && !plan.missingDestination) {
        await this.cleanTemporaryPackage(job)
        job.temporaryDirectory = undefined
        job.bytes = 0
        job.etag = undefined
      }
    }
    if (!job.temporaryDirectory && (!plan.missingOriginal || (acceptAlternative && plan.temporaryDirectory && !plan.missingDestination))) {
      const folder = plan.missingOriginal ? plan.temporaryDirectory! : join(dirname(job.directory), `.ghost-download-${job.id}`)
      // Only a freshly created, marked folder can become a cleanup target.
      await mkdir(folder)
      await writeFile(join(folder, '.ghost-download.json'), JSON.stringify({ id: job.id }))
      job.temporaryDirectory = folder
      job.archive = join(folder, basename(job.archive))
      job.spacePlan = undefined
      this.save()
      return true
    }
    job.spacePlan = plan
    job.status = 'paused'
    this.save()
    return false
  }

  private async cleanTemporaryPackage(job: StoredJob) {
    const folder = job.temporaryDirectory!
    if (!existsSync(folder)) return
    if (basename(folder) !== `.ghost-download-${job.id}` ||
        resolve(await realpath(folder)).toLowerCase() !== resolve(folder).toLowerCase())
      throw new Error('Pasta temporária redirecionada ou inválida.')
    const marker = JSON.parse(await readFile(join(folder, '.ghost-download.json'), 'utf8')) as { id: string }
    if (marker.id !== job.id) throw new Error('Pasta temporária não pertence a esta tarefa.')
    await rm(folder, { recursive: true, force: true })
  }

  private async pump() {
    if (this.active) return
    this.active = true
    try {
      for (
        let job = this.state.jobs.find((item) => item.status === 'queued');
        job;
        job = this.state.jobs.find((item) => item.status === 'queued')
      ) {
        try {
          if (job.removalStarted) await this.prepareReplacement(job)
          if (job.oldRemoved && !(await this.checkReplacementSpace(job))) continue
          if (job.oldRemoved && job.source.type === 'external' && !job.transport) {
            job.status = 'awaiting-file'
            this.save()
            await shell.openExternal(job.source.url)
            continue
          }
          if (job.transport === 'torbox') await this.downloadTorbox(job)
          else if (job.transport === 'anker-direct') await this.downloadAnkerDirect(job)
          else await this.download(job)
        } catch (error) {
          if (!['paused', 'cancelled'].includes(job.status)) {
            job.status = 'error'
            job.error = (error instanceof Error ? error.message : String(error)) + (job.oldRemoved ? ' O jogo está indisponível até concluir a reinstalação; o backup foi preservado.' : '')
          }
        } finally {
          if (job.status === 'cancelled')
            await this.cleanupJob(job).catch((error: unknown) => {
              job.error = `Não foi possível limpar os arquivos temporários: ${String(error)}`
            })
          this.controllers.delete(job.id)
          job.speed = 0
          this.save()
        }
      }
    } finally {
      this.active = false
    }
  }

  private async downloadAnkerDirect(job: StoredJob) {
    const controller = new AbortController()
    this.controllers.set(job.id, controller)
    job.status = 'downloading'
    job.transferPhase = undefined
    job.bytes = 0
    job.total = undefined
    this.save()
    let lastTime = Date.now(), lastBytes = 0
    const archive = await AnkerAccount.direct(job.source.url, dirname(job.archive), controller.signal, (bytes, total, path) => {
      const now = Date.now()
      job.speed = now > lastTime ? Math.max(0, (bytes - lastBytes) * 1000 / (now - lastTime)) : 0
      lastTime = now
      lastBytes = bytes
      job.bytes = bytes
      job.total = total || undefined
      job.archive = path
      job.transferPhase = 'local'
      this.save()
    })
    controller.signal.throwIfAborted()
    await this.prepare(job, archive)
  }

  private torrentProvider(providerId: string, sourceId: string, url: string) {
    if (providerId === ANKER_SOURCE_ID && sourceId === ANKER_TORRENT_ID)
      return { page: ankerGameUrl(url), torrent: AnkerAccount.torrent.bind(AnkerAccount) }
    if (providerId === ONLINE_FIX_SOURCE_ID && sourceId === ONLINE_FIX_TORRENT_ID)
      return { page: onlineFixGameUrl(url), torrent: OnlineFixAccount.torrent.bind(OnlineFixAccount) }
    throw new Error('Fonte TorBox não reconhecida.')
  }

  private async downloadTorbox(job: StoredJob) {
    job.status = 'downloading'
    const controller = new AbortController()
    this.controllers.set(job.id, controller)
    const signal = controller.signal
    const client = await TorboxClient.saved()
    const provider = this.torrentProvider(job.manifest.id, job.source.id, job.source.url)
    const referenceKey = (item: StoredJob) => {
      try { return JSON.stringify([item.game.providerId, this.torrentProvider(item.manifest.id, item.source.id, item.source.url).page, item.game.version || '', item.game.edition || '']) }
      catch { return undefined }
    }
    const key = referenceKey(job)!
    this.state.torboxReferences ??= {}
    if (job.torboxId === undefined) {
      const previous = [...this.state.jobs].reverse().find(item =>
        item.id !== job.id && item.transport === 'torbox' && item.torrentHash && referenceKey(item) === key
      )
      const reference = this.state.torboxReferences[key]
      // Unversioned pages can change in place; only reuse recent associations.
      const reusable = reference && (job.game.version || Date.now() - reference.recordedAt < 3600000)
      if (!job.torrentHash && reusable) job.torrentHash = reference.hash
      else if (!job.torrentHash && previous && job.game.version) job.torrentHash = previous.torrentHash
      if (job.torrentHash) {
        job.transferPhase = 'remote'
        job.remoteStatus = 'Consultando o arquivo já enviado ao TorBox'
        this.save()
        const knownId = reusable ? reference.id : previous?.torboxId
        let match = knownId === undefined ? undefined : (await client.list(signal, knownId)).find(item => item.hash?.toLowerCase() === job.torrentHash)
        match ??= (await client.list(signal)).find(item => item.hash?.toLowerCase() === job.torrentHash)
        if (match) job.torboxId = match.id
      }
    }
    const torrentPath = join(dirname(job.archive), 'source.torrent')
    if (job.torboxId === undefined) {
      job.transferPhase = 'torrent'
      this.save()
      let torrent: Buffer
      if (existsSync(torrentPath)) torrent = await readFile(torrentPath)
      else torrent = await provider.torrent(provider.page, torrentPath, signal)
      job.torrentHash = torrentInfoHash(torrent)
      this.state.torboxReferences[key] = { hash: job.torrentHash, recordedAt: Date.now() }
      this.save()
      const existing = (await client.list(signal)).find((item) => item.hash?.toLowerCase() === job.torrentHash)
      if (existing) job.torboxId = existing.id
      else {
        if (job.torboxSubmissionPending)
          throw new Error('O envio anterior ao TorBox não foi confirmado. Aguarde e tente novamente para evitar duplicar o torrent.')
        job.torboxSubmissionPending = true
        this.save()
        // Persist uncertainty before the mutation; retries reconcile by info hash.
        try { job.torboxId = await client.create(torrent, signal) }
        catch (error) {
          if (error instanceof TorboxRejectedError) job.torboxSubmissionPending = false
          throw error
        }
      }
      job.torboxSubmissionPending = false
      this.save()
    }
    if (job.torrentHash) {
      this.state.torboxReferences[key] = { hash: job.torrentHash, id: job.torboxId, recordedAt: Date.now() }
    }
    job.transferPhase = 'remote'
    this.save()
    let missingSince: number | undefined
    while (true) {
      signal.throwIfAborted()
      const remote = (await client.list(signal, job.torboxId)).find((item) => item.id === job.torboxId)
      if (!remote) {
        missingSince ??= Date.now()
        if (Date.now() - missingSince >= 600000)
          throw new Error('O TorBox confirmou o envio, mas ainda não retornou os dados do torrent. Use Retomar para consultar novamente, sem reenviar o arquivo.')
        job.remoteStatus = 'Aguardando o TorBox disponibilizar os dados do torrent'
        job.remoteProgress = undefined
        this.save()
        await waitForRemote(15000, undefined, { signal })
        continue
      }
      missingSince = undefined
      if (!job.torrentHash || remote.hash?.toLowerCase() !== job.torrentHash)
        throw new Error('O torrent desta conta não corresponde ao jogo. Confira a conta TorBox conectada.')
      job.remoteProgress = Number.isFinite(remote.progress) ? Math.max(0, Math.min(1, remote.progress)) : undefined
      job.remoteStatus = remote.download_state
      this.save()
      if (remote.download_finished && remote.download_present) {
        if (!Array.isArray(remote.files) || !remote.files.length || remote.files.some(file => !Number.isSafeInteger(file.id) || typeof file.name !== 'string'))
          throw new Error('O TorBox ainda não disponibilizou uma lista válida de arquivos.')
        const single = remote.files?.length === 1 ? remote.files[0] : undefined
        const format = single?.name.match(/\.(zip|rar|7z|tar)$/i)?.[1]?.toLowerCase() as GhostDownloadSource['archive']
        // A loose directory or multipart package is transferred as a TorBox ZIP.
        job.torboxWrapped = !format
        const extension = format || 'zip'
        job.archive = join(dirname(job.archive), `package.${extension}`)
        job.transferPhase = 'local'
        job.remoteProgress = 1
        this.save()
        const manifest = { ...job.manifest, permissions: ['network'] as PluginManifest['permissions'], allowedDomains: [...TORBOX_DOWNLOAD_DOMAINS] }
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const url = await client.link(job.torboxId!, signal, format ? single?.id : undefined)
            await this.download(job, { url, manifest }, controller)
            return
          } catch (error) {
            signal.throwIfAborted()
            const cause = error as { message?: string; cause?: { code?: string; errors?: Array<{ code?: string }> } }
            if (cause.message === 'fetch failed' || cause.cause?.code || cause.cause?.errors) {
              if (attempt < 2) {
                job.remoteStatus = `Reconectando ao servidor de arquivos do TorBox (${attempt + 1}/2)`
                this.save()
                await waitForRemote(1000 * (attempt + 1), undefined, { signal })
                continue
              }
              const codes = [cause.cause?.code, ...(cause.cause?.errors?.map(item => item.code) || [])]
              const code = codes.find(value => value && /^(?:E(?:CONNRESET|CONNREFUSED|NETUNREACH|HOSTUNREACH|TIMEDOUT|NOTFOUND|AI_AGAIN)|UND_ERR_(?:CONNECT_TIMEOUT|SOCKET)|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/.test(value))
              throw new Error(`Falha na conexão com o servidor de arquivos do TorBox${code ? ` (${code})` : ''}. O torrent continua registrado. Use Retomar para obter um novo link, sem baixar nem reenviar o torrent.`)
            }
            throw error
          }
        }
        return
      }
      if (/error|missingfiles/i.test(remote.download_state || ''))
        throw new Error('O TorBox informou falha no torrent. Confira a tarefa na sua conta.')
      // Only active jobs poll; never a global idle timer. Pausing aborts this wait.
      await waitForRemote(15000, undefined, { signal })
    }
  }

  private async download(job: StoredJob, resolved?: { url: string; manifest: PluginManifest }, activeController?: AbortController) {
    job.packageDownloaded = false
    job.status = 'downloading'
    const controller = activeController || new AbortController()
    this.controllers.set(job.id, controller)
    this.save()
    let offset = job.etag
      ? await stat(job.archive).then(
          (value) => value.size,
          () => 0
        )
      : 0
    const headers: Record<string, string> = {
      ...job.source.headers,
      'Accept-Encoding': 'identity'
    }
    if (offset) {
      headers.Range = `bytes=${offset}-`
      headers['If-Range'] = job.etag!
    }
    const response = await NetworkGuard.fetchResponse(
      resolved?.url || job.source.url,
      resolved?.manifest || job.manifest,
      controller.signal,
      headers,
      Boolean(resolved)
    )
    if (!response.ok || !response.body)
      throw new Error(`Download indisponível (HTTP ${response.status}).`)
    if (
      /text\/html|application\/json/i.test(
        response.headers.get('content-type') || ''
      )
    ) {
      await response.body.cancel()
      throw new Error(
        'A fonte retornou uma página, não um arquivo. Use o download pelo site e importe o ZIP.'
      )
    }
    if (response.status === 206) {
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
        response.headers.get('content-range') || ''
      )
      if (
        !range ||
        Number(range[1]) !== offset ||
        (job.etag && response.headers.get('etag') !== job.etag)
      ) {
        await response.body.cancel()
        throw new Error(
          'O servidor não confirmou a retomada. Reinicie o download.'
        )
      }
      job.total = Number(range[3])
    } else {
      offset = 0
      job.total = Number(response.headers.get('content-length')) || undefined
    }
    job.etag = response.headers.get('etag') || undefined
    if (job.etag?.startsWith('W/')) job.etag = undefined
    await mkdir(dirname(job.archive), { recursive: true })
    if (job.total) {
      const disk = await statfs(dirname(job.archive))
      if (disk.bavail * disk.bsize < job.total - offset)
        throw new Error('Espaço insuficiente para baixar o pacote.')
    }
    job.bytes = offset
    if (job.oldRemoved && job.total) {
      job.packageEstimate = job.total
      if (!(await this.checkReplacementSpace(job))) {
        await response.body.cancel()
        return
      }
    }
    let tick = Date.now(),
      lastBytes = offset
    const emitProgress = () => {
      sendFrontendMessage('external-games-updated', this.snapshot())
      notifyExternalQueueChanged()
    }
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        job.bytes += chunk.length
        const elapsed = Date.now() - tick
        if (elapsed > 500) {
          job.speed = ((job.bytes - lastBytes) * 1000) / elapsed
          tick = Date.now()
          lastBytes = job.bytes
          emitProgress()
        }
        callback(null, chunk)
      }
    })
    this.save()
    await pipeline(
      Readable.fromWeb(response.body as never),
      progress,
      createWriteStream(job.archive, { flags: offset ? 'a' : 'w' }),
      { signal: controller.signal }
    )
    if (job.total && job.bytes !== job.total)
      throw new Error('O download terminou incompleto.')
    if (
      job.source.sha256 &&
      (await hashFile(job.archive)) !== job.source.sha256.toLowerCase()
    )
      throw new Error(
        'O checksum do pacote não corresponde ao informado pela fonte.'
      )
    job.packageDownloaded = true
    this.save()
    await this.prepare(job, job.archive)
  }

  private canRetryPackage(job: StoredJob): boolean {
    if (job.transport !== 'torbox' || job.commitStarted || job.removalStarted) return false
    try {
      const file = statSync(job.archive)
      return file.isFile() && file.size > 0 && (job.packageDownloaded === true ||
        (job.transferPhase === 'local' && Boolean(job.total) && job.bytes === job.total && file.size === job.total))
    } catch { return false }
  }

  private async retryPackage(job: StoredJob) {
    if (!this.canRetryPackage(job)) throw new Error('O pacote local está incompleto ou indisponível.')
    const downloadFolder = job.temporaryDirectory || join(this.root, 'downloads', job.id)
    if (resolve(dirname(job.archive)) !== resolve(downloadFolder) ||
        !inside(await realpath(downloadFolder), await realpath(job.archive)) ||
        resolve(job.stage) !== resolve(dirname(job.directory), `.ghost-stage-${job.id}`))
      throw new Error('Caminho de pacote temporário inválido.')
    if (existsSync(job.stage)) {
      if (resolve(await realpath(job.stage)).toLowerCase() !== resolve(job.stage).toLowerCase())
        throw new Error('A pasta de extração foi redirecionada.')
      await rm(job.stage, { recursive: true, force: true })
    }
    job.candidates = []
    job.error = undefined
    try { await this.prepare(job, job.archive) }
    catch (error) {
      job.status = 'error'
      job.error = error instanceof Error ? error.message : 'Não foi possível extrair o pacote.'
      this.save()
      throw error
    }
  }

  private async prepare(job: StoredJob, archive: string) {
    const password = /online[- ]?fix/i.test(job.game.providerId + ' ' + job.game.providerName) ? 'online-fix.me' : undefined
    if (job.oldRemoved) {
      const unpackedBytes = await archiveSize(archive, password)
      const saveBytes = this.state.backups.find(item => item.id === job.backupId)?.bytes || 0
      job.installedEstimate = unpackedBytes + saveBytes
      const disk = await statfs(dirname(job.directory))
      if (disk.bavail * disk.bsize < job.installedEstimate + spaceReserve) {
        job.pendingArchive = archive
        job.spacePlan = { ...await planInstallSpace(dirname(job.directory), job.id, 0, job.installedEstimate, false), packageReady: true }
        job.status = 'paused'
        this.save()
        return
      }
      job.pendingArchive = undefined
    }
    job.status = 'extracting'
    this.save()
    // Each extraction uses a fresh, job-owned directory; existing games are untouched.
    if (existsSync(job.stage))
      throw new Error(
        'Uma extração anterior já existe. Cancele esta operação e inicie outra.'
      )
    let candidates = await extractGame(archive, job.stage, password)
    if (!candidates.length && job.torboxWrapped) {
      const files = await regularFiles(job.stage)
      const mainPackage = selectWrappedPackage(files, job.stage, Boolean(password))
      // Keep multipart siblings together for the extractor, with output in a new child.
      const unpacked = join(job.stage, '.ghost-content')
      if (existsSync(unpacked)) throw new Error('O pacote contém uma pasta reservada pelo instalador.')
      candidates = await extractGame(mainPackage, unpacked, password)
      if (candidates.length) {
        // These are verified regular files in this job's staging folder, not installed data.
        for (const file of files) await rm(file)
        // Remove only empty wrapper folders, retaining the extracted game tree.
        const removeEmptyWrappers = async (directory: string): Promise<void> => {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            const child = join(directory, entry.name)
            if (entry.isDirectory() && !entry.isSymbolicLink() && child !== unpacked)
              await removeEmptyWrappers(child)
          }
          if (directory !== job.stage && !(await readdir(directory)).length) await rmdir(directory)
        }
        await removeEmptyWrappers(job.stage)
      }
    }
    if ((!job.old || job.old.packageRootLayout) && candidates.length) {
      const allowExisting = Boolean(job.old || job.cleanReplace || (job.directory && existsSync(job.directory)))
      const prepared = await prepareNewInstallDirectory(job.stage, dirname(job.directory), job.game.title, candidates,
        this.state.jobs.filter(item => item.id !== job.id && !['cancelled', 'error', 'completed'].includes(item.status)).map(item => item.directory),
        allowExisting)
      if (!job.old && !job.cleanReplace) job.directory = prepared.directory
      candidates = prepared.candidates
    }
    job.candidates = candidates.map((file) => relative(job.stage, file))
    if (!job.candidates.length)
      throw new Error('Nenhum executável de jogo encontrado no arquivo baixado.')
    job.status = 'ready'
    job.error = undefined
    this.save()

    // Auto-Finish: se configurado, finaliza automaticamente identificando o executável
    const targetExecutable = this.resolveTargetExecutable(job)
    if (job.autoFinish && targetExecutable) {
      try {
        await this.finish(job, targetExecutable)
      } catch (err) {
        job.status = 'ready'
        job.error = `Instalação automática requer confirmação: ${err instanceof Error ? err.message : String(err)}`
        this.save()
      }
    }
  }

  private async backup(
    installation: ExternalInstallation
  ): Promise<ExternalSaveBackup> {
    if (!installation.savePath)
      throw new Error('Configure a pasta de saves primeiro.')
    const id = randomUUID()
    const snapshot = await copySaveSnapshot(
      resolve(installation.savePath),
      join(this.root, 'backups', id)
    )
    const backup: ExternalSaveBackup = {
      id,
      installationId: installation.id,
      createdAt: new Date().toISOString(),
      version: installation.game.version,
      files: snapshot.files.length,
      bytes: snapshot.files.reduce((sum, file) => sum + file.bytes, 0)
    }
    this.state.backups.push(backup)
    this.save()
    return backup
  }

  private async finish(job: StoredJob, executable: string) {
    if (this.finishing.has(job.installationId)) throw new Error('Instalação já em andamento.')
    this.finishing.add(job.installationId)
    try { await this.commitInstallation(job, executable) }
    finally { this.finishing.delete(job.installationId) }
  }

  private async commitInstallation(job: StoredJob, executable: string) {
    if (
      job.status !== 'ready' ||
      !job.candidates.includes(executable) ||
      !inside(job.stage, join(job.stage, executable))
    )
      throw new Error('Selecione um executável da instalação preparada.')
    const old = job.oldRemoved ? job.old : job.old ? this.installation(job.installationId) : undefined
    if (old && resolve(old.directory) !== resolve(job.directory) && existsSync(job.directory))
      throw new Error('A pasta de destino já existe. Escolha uma pasta vazia para a nova instalação.')
    const restoredSavePath = old?.savePath && inside(old.directory, old.savePath)
      ? join(job.directory, relative(old.directory, old.savePath)) : old?.savePath
    if (old && !job.oldRemoved) {
      await this.owned(old.directory, old.id)
      if (!old.savePath || !(await regularFiles(old.savePath)).length)
        throw new Error('Nenhum save foi encontrado na pasta configurada. Confira a pasta antes de substituir o jogo.')
      job.backupId = (await this.backup(old)).id
    }
    if (job.cleanReplace && !job.backupId && existsSync(job.directory)) {
      try {
        const dummyInst: ExternalInstallation = {
          id: job.installationId,
          appName: old?.appName || `external-${job.installationId}`,
          game: job.game,
          directory: job.directory,
          executable: join(job.directory, executable),
          installedAt: new Date().toISOString(),
          autoBackup: true,
          autoUpdate: true,
          history: []
        }
        const discovered = await this.discoverSavePathEnhanced(dummyInst)
        if (discovered?.path && existsSync(discovered.path)) {
          dummyInst.savePath = discovered.path
          job.backupId = (await this.backup(dummyInst)).id
        }
      } catch {}
    }
    job.previousLibrary = libraryStore
      .get('games', [])
      .find(
        (game) =>
          game.app_name === (old?.appName || `external-${job.installationId}`)
      )
    job.status = 'installing'
    job.commitStarted = true
    this.save()
    const rollback = join(dirname(job.directory), `.ghost-rollback-${job.id}`)
    let movedOld = false,
      movedNew = false
    try {
      await writeFile(
        join(job.stage, '.ghost-install.json'),
        JSON.stringify({ id: job.installationId })
      )
      if (old && !job.oldRemoved) {
        await safeRename(old.directory, rollback)
        movedOld = true
      } else if (existsSync(job.directory)) {
        if (job.cleanReplace) {
          await safeRename(job.directory, rollback)
          movedOld = true
        } else {
          throw new Error('A pasta de destino já existe.')
        }
      }
      await safeRename(job.stage, job.directory)
      movedNew = true
      if (
        ((old?.savePath && (job.oldRemoved || inside(old.directory, old.savePath))) || job.cleanReplace) &&
        job.backupId &&
        restoredSavePath
      ) {
        await restoreSaveSnapshot(
          join(this.root, 'backups', job.backupId),
          restoredSavePath!
        )
      }
      const installed: ExternalInstallation = {
        packageRootLayout: job.old ? Boolean(job.old.packageRootLayout) : true,
        id: job.installationId,
        appName: old?.appName || `external-${job.installationId}`,
        game: job.game,
        directory: job.directory,
        executable: join(job.directory, executable),
        installedAt: new Date().toISOString(),
        savePath: restoredSavePath,
        autoBackup: old?.autoBackup ?? true,
        autoUpdate: old?.autoUpdate ?? true,
        linkedExisting: old?.linkedExisting,
        history: [
          ...(old?.history || []),
          ...(old
            ? [
                {
                  game: old.game,
                  changedAt: new Date().toISOString(),
                  backupId: job.backupId
                }
              ]
            : [])
        ]
      }
      const library = libraryStore.get('games', [])
      const previous = library.find(
        (game) => game.app_name === installed.appName
      )
      if (previous && previous.runner !== 'sideload')
        throw new Error('Jogos de lojas oficiais não podem ser substituídos.')
      libraryStore.set('games', [
        ...library.filter((game) => game.app_name !== installed.appName),
        {
          ...previous,
          app_name: installed.appName,
          title: job.game.title,
          runner: 'sideload',
          art_cover: previous?.art_cover || job.game.coverUrl || '',
          art_square: previous?.art_square || job.game.coverUrl || '',
          install: {
            executable: installed.executable,
            install_path: installed.directory,
            platform: 'Windows',
            is_dlc: false
          },
          is_installed: true,
          canRunOffline: true,
          version: job.game.version,
          folder_name: installed.directory
        }
      ])
      if (!installed.savePath) {
        const autoSave = await this.discoverSavePath(installed)
        if (autoSave) {
          installed.savePath = autoSave
        }
      }

      this.state.installations = [
        ...this.state.installations.filter((item) => item.id !== installed.id),
        installed
      ]
      synchronizeExternalVersion(installed.appName, installed.game.version)
      job.status = 'completed'
      job.commitStarted = false
      this.save()
      sendFrontendMessage('refreshLibrary', 'sideload')

      // Atribuição seletiva à loja "Piratas" exclusivamente para SteamRIP, AnkerGames e Online-Fix
      const piratasSources = ['anker', 'steamrip', 'online-fix', 'ankergames']
      const isPiratasEligible = piratasSources.some((s) =>
        (job.game.providerId || '').toLowerCase().includes(s) ||
        (job.game.providerName || '').toLowerCase().includes(s)
      )
      if (isPiratasEligible) {
        sendFrontendMessage('external-games-assign-piratas', {
          appName: installed.appName
        })
      }
    } catch (error) {
      if (movedNew) await safeRename(job.directory, job.stage).catch(() => {})
      if (movedOld) await safeRename(rollback, old?.directory || job.directory).catch(() => {})
      this.state.installations = this.state.installations.filter(
        (item) => item.id !== job.installationId
      )
      if (old) this.state.installations.push(old)
      const originalLibrary = libraryStore
        .get('games', [])
        .filter(
          (game) =>
            game.app_name !== (old?.appName || `external-${job.installationId}`)
        )
      if (job.previousLibrary) originalLibrary.push(job.previousLibrary)
      libraryStore.set('games', originalLibrary)
      job.commitStarted = false
      job.status = 'ready'
      throw error
    }
    // Deletion is restricted to the exact rollback directory this transaction created.
    if (
      movedOld &&
      inside(dirname(job.directory), rollback) &&
      basename(rollback) === `.ghost-rollback-${job.id}`
    ) {
      await rm(rollback, { recursive: true, force: true }).catch(() => {
        job.error =
          'Instalação concluída. A cópia anterior ainda ocupa espaço em disco.'
      })
    }
    if (job.temporaryDirectory) await this.cleanTemporaryPackage(job).catch(() => { job.error = 'Instalação concluída. Não foi possível remover a pasta temporária: ' + job.temporaryDirectory; this.save() })
    if (inside(join(this.root, 'downloads'), dirname(job.archive)))
      await rm(dirname(job.archive), { recursive: true, force: true }).catch(
        () => {}
      )
  }

  private async cleanupJob(job: StoredJob) {
    if (job.commitStarted || job.removalStarted)
      throw new Error('A instalação precisa ser recuperada antes da limpeza.')
    if (
      basename(job.stage) !== `.ghost-stage-${job.id}` ||
      !inside(dirname(job.directory), job.stage)
    )
      throw new Error('Pasta temporária inválida.')
    if (
      existsSync(job.stage) &&
      !inside(await realpath(dirname(job.stage)), await realpath(job.stage))
    )
      throw new Error('A pasta temporária foi redirecionada.')
    try {
      if (existsSync(job.stage)) await rm(job.stage, { recursive: true, force: true })
    } catch {}
    if (job.temporaryDirectory) {
      try {
        await this.cleanTemporaryPackage(job)
      } catch {}
    }
    const downloadFolder = join(this.root, 'downloads', job.id)
    if (inside(join(this.root, 'downloads'), downloadFolder) && existsSync(downloadFolder)) {
      try {
        await rm(downloadFolder, { recursive: true, force: true })
      } catch {}
    }
    if (job.oldRemoved && job.status === 'cancelled') {
      job.temporaryDirectory = undefined
      job.archive = join(downloadFolder, basename(job.archive || 'package.zip'))
      job.spacePlan = undefined
      job.pendingArchive = undefined
      job.bytes = 0
      job.etag = undefined
    }
  }

  async action(action: ExternalGameAction): Promise<ExternalActionResult> {
    const lockId =
      'jobId' in action
        ? this.state.jobs.find((item) => item.id === action.jobId)
            ?.installationId
        : 'installationId' in action
        ? action.installationId
        : action.type === 'sync-piratas-saves'
        ? 'sync-piratas-saves'
        : undefined
    if (!lockId || this.locked.has(lockId) || this.finishing.has(lockId))
      return {
        success: false,
        error: 'Operação em andamento ou jogo não encontrado.'
      }
    this.locked.add(lockId)
    try {
      if ('jobId' in action) {
        const job = this.state.jobs.find((item) => item.id === action.jobId)!
        if (job.removalStarted && action.type === 'import-archive') throw new Error('Retome a tarefa para concluir a remoção interrompida primeiro.')
        if (action.type === 'space-proceed' || action.type === 'space-recheck') {
          if (!job.spacePlan || job.status !== 'paused') throw new Error('A verificação de espaço não está pendente.')
          if (job.pendingArchive) {
            await this.prepare(job, job.pendingArchive)
            if (job.status !== 'paused') job.spacePlan = undefined
          } else if (await this.checkReplacementSpace(job, action.type === 'space-proceed')) {
            job.status = job.source.type === 'external' && !job.transport ? 'awaiting-file' : 'queued'
            if (job.status === 'awaiting-file') await shell.openExternal(job.source.url)
            job.error = undefined
            void this.pump()
          }
        } else if (
          action.type === 'pause' &&
          ['downloading', 'queued'].includes(job.status)
        ) {
          job.status = 'paused'
          this.controllers.get(job.id)?.abort()
        } else if (action.type === 'resume' && ['error', 'paused'].includes(job.status) && this.canRetryPackage(job)) {
          if (this.controllers.has(job.id)) throw new Error('Aguarde a transferência terminar.')
          await this.retryPackage(job)
        } else if (action.type === 'resume' && (job.status === 'paused' || (job.status === 'cancelled' && job.oldRemoved) || (job.status === 'error' && (job.oldRemoved || job.removalStarted || ['torbox', 'anker-direct'].includes(job.transport || '')) && !existsSync(job.stage)))) {
          if (this.controllers.has(job.id))
            throw new Error('Aguarde a pausa terminar.')
          if (job.spacePlan) throw new Error('Use as opções de espaço disponíveis nesta tarefa.')
          job.status = 'queued'
          job.error = undefined
          void this.pump()
        } else if (
          action.type === 'cancel' &&
          !['extracting', 'installing', 'completed'].includes(job.status) &&
          !job.commitStarted
        ) {
          if (job.status === 'cancelled' || job.status === 'error') {
            this.controllers.get(job.id)?.abort()
            try {
              await this.cleanupJob(job)
            } catch (cleanErr) {
              console.warn('[ExternalGames] Falha ao limpar arquivos no cancel/dismiss:', cleanErr)
            }
            this.state.jobs = this.state.jobs.filter((item) => item.id !== job.id)
          } else {
            job.status = 'cancelled'
            this.controllers.get(job.id)?.abort()
            if (!this.controllers.has(job.id)) {
              try {
                await this.cleanupJob(job)
              } catch (cleanErr) {
                console.warn('[ExternalGames] Falha ao limpar arquivos no cancel:', cleanErr)
              }
            }
          }
        } else if (
          action.type === 'dismiss' &&
          ['completed', 'cancelled', 'error', 'paused', 'queued'].includes(job.status) &&
          !job.commitStarted
        ) {
          this.controllers.get(job.id)?.abort()
          try {
            await this.cleanupJob(job)
          } catch (cleanErr) {
            console.warn('[ExternalGames] Falha ao limpar arquivos no dismiss:', cleanErr)
          }
          this.state.jobs = this.state.jobs.filter((item) => item.id !== job.id)
        } else if (
          action.type === 'import-archive' &&
          ['awaiting-file', 'error'].includes(job.status) &&
          !job.commitStarted
        ) {
          const file = await dialog.showOpenDialog({
            title: 'Selecione o arquivo baixado do jogo (ZIP, RAR, 7Z, TAR, ISO)',
            properties: ['openFile'],
            filters: [
              { name: 'Pacote Compactado (ZIP, RAR, 7Z, TAR, ISO)', extensions: ['zip', 'rar', '7z', 'tar', 'iso'] },
              { name: 'Todos os arquivos', extensions: ['*'] }
            ]
          })
          if (file.canceled || !file.filePaths[0]) return { success: false }
          await this.prepare(job, file.filePaths[0])
        } else if (action.type === 'finish') {
          if (job.status === 'completed') return { success: true }
          await this.finish(job, action.executable)
        }
        else throw new Error('Ação indisponível nesta etapa.')
      } else if (action.type === 'sync-piratas-saves') {
        const syncResult = await this.syncPiratasSaves({ autoBackup: action.autoBackup !== false })
        return {
          success: true,
          piratasSyncResult: syncResult
        }
      } else {
        if (action.type === 'delete-backup' && this.state.jobs.some(job => job.backupId === action.backupId && job.status !== 'completed')) throw new Error('Este backup protege uma reinstalação pendente.')
        const installation = this.installation(action.installationId)
        if (action.type === 'configure-saves') {
          const directory = await dialog.showOpenDialog({
            title: 'Selecione a pasta específica dos saves deste jogo',
            properties: ['openDirectory']
          })
          if (directory.canceled || !directory.filePaths[0])
            return { success: false }
          const path = resolve(directory.filePaths[0])
          if (
            path === resolve(installation.directory) ||
            path === resolve(app.getPath('home')) ||
            inside(path, this.root) ||
            inside(this.root, path)
          )
            throw new Error('Selecione somente a pasta específica dos saves.')
          installation.savePath = path
          installation.autoBackup ??= true
          installation.autoUpdate ??= true
        } else if (action.type === 'auto-discover-saves') {
          const discovery = await this.discoverSavePathEnhanced(installation)
          if (discovery?.path) {
            installation.savePath = discovery.path
            installation.saveDetectionType = discovery.detectionType
            installation.saveDetectionDetails = discovery.details
            installation.saveFilesCount = discovery.fileCount
            installation.saveTotalBytes = discovery.totalBytes
            installation.autoBackup ??= true
            installation.autoUpdate ??= true
          } else {
            throw new Error('Nenhuma pasta de saves conhecida foi encontrada automaticamente para este jogo.')
          }
          this.save()
          return { success: true, saveDiscovery: discovery }
        } else if (action.type === 'set-save-path') {
          if (!action.path || !existsSync(action.path)) {
            throw new Error('A pasta informada não existe.')
          }
          const path = resolve(action.path)
          if (
            path === resolve(installation.directory) ||
            path === resolve(app.getPath('home')) ||
            inside(path, this.root) ||
            inside(this.root, path)
          ) {
            throw new Error('Selecione somente a pasta específica dos saves.')
          }
          installation.savePath = path
          installation.autoBackup ??= true
          installation.autoUpdate ??= true
        } else if (action.type === 'delete-backup') {
          return await this.deleteBackup(installation.id, action.backupId)
        } else if (action.type === 'backup') await this.backup(installation)
        else if (action.type === 'auto-backup')
          installation.autoBackup = action.enabled
        else if (action.type === 'auto-update') {
          if (action.enabled && !installation.savePath)
            throw new Error(
              'Configure os saves antes de habilitar downloads automáticos de updates.'
            )
          installation.autoUpdate = action.enabled
        } else if (action.type === 'restore') {
          const backup = this.state.backups.find(
            (item) =>
              item.id === action.backupId &&
              item.installationId === installation.id
          )
          if (!backup || !installation.savePath)
            throw new Error('Backup ou pasta de saves não encontrado.')
          if (
            existsSync(installation.savePath) &&
            (await regularFiles(installation.savePath)).length
          )
            await this.backup(installation)
          await restoreSaveSnapshot(
            join(this.root, 'backups', backup.id),
            installation.savePath
          )
        }
      }
      this.save()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        'jobId' in action &&
        ['import-archive', 'finish'].includes(action.type)
      ) {
        const job = this.state.jobs.find((item) => item.id === action.jobId)
        if (job && !['ready', 'completed'].includes(job.status)) {
          job.status = 'error'
          job.error = message
        }
      }
      this.save()
      return { success: false, error: message }
    } finally {
      this.locked.delete(lockId)
    }
  }

  getLastUpdateCheckTime(): number {
    return this.state.lastUpdateCheckTime || 0
  }

  setLastUpdateCheckTime(time: number): void {
    this.state.lastUpdateCheckTime = time
    this.save()
  }

  async deleteInstallationAndFiles(
    appName: string,
    deleteFiles: boolean
  ): Promise<ExternalActionResult> {
    try {
      const installation = this.state.installations.find(
        (item) => item.appName === appName || item.id === appName
      )
      const games = libraryStore.get('games', [])
      const libraryGame = games.find((g) => g.app_name === appName)

      if (deleteFiles) {
        const candidateDir =
          installation?.directory ||
          libraryGame?.install?.install_path ||
          (installation?.executable ? dirname(installation.executable) : null) ||
          (libraryGame?.install?.executable ? dirname(libraryGame.install.executable) : null)

        if (candidateDir && existsSync(candidateDir)) {
          const resolved = resolve(candidateDir)
          const home = resolve(app.getPath('home'))
          const rootDir = resolve('/')
          const windowsDir = process.env.SystemRoot ? resolve(process.env.SystemRoot) : null
          const progFiles = process.env.ProgramFiles ? resolve(process.env.ProgramFiles) : null
          const progFilesX86 = process.env['ProgramFiles(x86)'] ? resolve(process.env['ProgramFiles(x86)']) : null

          // Proteção estrita contra exclusão de pastas críticas do sistema
          if (
            resolved === home ||
            resolved === rootDir ||
            dirname(resolved) === resolved ||
            (windowsDir && (resolved === windowsDir || inside(windowsDir, resolved))) ||
            (progFiles && resolved === progFiles) ||
            (progFilesX86 && resolved === progFilesX86)
          ) {
            throw new Error('Diretório crítico ou protegido do sistema não pode ser excluído.')
          }

          await rm(resolved, { recursive: true, force: true }).catch((err) => {
            throw new Error(`Falha ao excluir arquivos do disco: ${err instanceof Error ? err.message : String(err)}`)
          })
        }
      }

      if (!deleteFiles) {
        // Remover da biblioteca: limpa o registro de instalação e remove de libraryStore
        this.state.installations = this.state.installations.filter(
          (item) => item.appName !== appName && item.id !== appName
        )
        libraryStore.set(
          'games',
          games.filter((g) => g.app_name !== appName)
        )
      } else {
        // "Deletar do Computador": Exclui apenas os arquivos físicos do disco.
        // O jogo permanece na biblioteca com is_installed: true.
        // Como os arquivos foram apagados do disco, existsSync(executable) retorna false,
        // e o Ghost exibe a capa com o status canônico "Arquivos indisponíveis"!
        this.state.installations = this.state.installations.filter(
          (item) => item.appName !== appName && item.id !== appName
        )
        if (libraryGame) {
          libraryGame.is_installed = true
          libraryStore.set('games', games)
        }
      }

      this.save()
      sendFrontendMessage('external-games-updated', this.snapshot())
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async installLocalPackage(): Promise<ExternalActionResult> {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Selecionar pacote do jogo (ZIP, RAR, 7Z, TAR)',
        properties: ['openFile'],
        filters: [
          { name: 'Pacotes Compactados', extensions: ['zip', 'rar', '7z', 'tar'] },
          { name: 'Todos os Arquivos', extensions: ['*'] }
        ]
      })
      if (canceled || !filePaths.length || !filePaths[0]) {
        return { success: false, error: 'Seleção cancelada.' }
      }

      const archivePath = filePaths[0]
      const pkgName = basename(archivePath).replace(/\.(?:zip|rar|7z|tar)$/i, '')
      const id = randomUUID()
      const targetDir = join(this.root, 'games', pkgName)
      const stage = join(this.root, 'games', `.ghost-stage-${id}`)

      const fileSize = existsSync(archivePath) ? statSync(archivePath).size : 0

      const job: StoredJob = {
        id,
        installationId: id,
        game: {
          id: `local-${id}`,
          title: pkgName,
          platform: 'windows',
          providerId: 'local',
          providerName: 'Arquivo Local'
        },
        source: {
          id: 'local-file',
          name: 'Arquivo Local',
          type: 'external',
          url: archivePath
        },
        manifest: {
          id: 'local-package',
          name: 'Arquivo Local',
          description: 'Instalação a partir de arquivo compactado local',
          author: 'Ghost',
          version: '1.0.0',
          type: 'game-source',
          permissions: []
        },
        directory: targetDir,
        stage,
        archive: archivePath,
        operation: 'install',
        status: 'extracting',
        bytes: fileSize,
        total: fileSize,
        speed: 0,
        createdAt: new Date().toISOString(),
        candidates: [],
        transferPhase: 'local'
      }

      this.state.jobs.push(job)
      this.save()
      sendFrontendMessage('external-games-updated', this.snapshot())

      void this.prepare(job, archivePath).catch((err) => {
        job.status = 'error'
        job.error = err instanceof Error ? err.message : String(err)
        this.save()
        sendFrontendMessage('external-games-updated', this.snapshot())
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
