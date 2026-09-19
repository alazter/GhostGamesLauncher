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
  readFile,
  realpath,
  rename,
  rm,
  stat,
  statfs,
  writeFile
} from 'fs/promises'
import { randomUUID } from 'crypto'
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
  torboxId?: number
  torrentHash?: string
  torboxSubmissionPending?: boolean
  torboxWrapped?: boolean
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
}
interface StoredState extends Omit<ExternalGamesState, 'jobs'> {
  jobs: StoredJob[]
  torboxReferences?: Record<string, { hash: string; id?: number; recordedAt: number }>
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
      if (job.commitStarted) {
        this.recover(job)
      } else if (['downloading', 'queued'].includes(job.status))
        job.status = 'paused'
      else if (['extracting', 'installing'].includes(job.status)) {
        job.status = 'error'
        job.error =
          'Operação interrompida. O jogo anterior e os backups foram preservados.'
      }
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
        !job.old &&
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
        'Operação interrompida. A instalação anterior foi recuperada; os backups foram preservados.'
    } catch {
      job.status = 'error'
      job.error =
        'Recuperação automática incompleta. As pastas foram preservadas; revise a instalação antes de continuar.'
    }
  }

  canLaunch(appName: string): boolean {
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
      autoBackup: false,
      autoUpdate: false,
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

  snapshot(): ExternalGamesState {
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
        candidates: job.candidates
      })),
      installations: this.state.installations,
      backups: this.state.backups
    }
  }

  private installation(id: string) {
    const installation = this.state.installations.find((item) => item.id === id)
    if (!installation) throw new Error('Instalação externa não encontrada.')
    const game = libraryStore
      .get('games', [])
      .find((item) => item.app_name === installation.appName)
    if (
      !game ||
      game.runner !== 'sideload' ||
      resolve(game.install.executable || '') !==
        resolve(installation.executable)
    ) {
      throw new Error(
        'O vínculo com a instalação externa mudou. Nenhum arquivo foi alterado.'
      )
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
          (game.install?.executable || game.install?.install_path) &&
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
        autoBackup: false,
        autoUpdate: false,
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
    confirmed = false
  ): Promise<ExternalActionResult> {
    const old = replaceId ? this.installation(replaceId) : undefined
    const viaTorbox = source.type === 'torbox'
    const viaBrowser = manifest.id === ANKER_SOURCE_ID && source.id === ANKER_DIRECT_ID
    if (viaBrowser) ankerGameUrl(source.url)
    if (viaTorbox) {
      if (manifest.id !== ANKER_SOURCE_ID || source.id !== ANKER_TORRENT_ID)
        throw new Error('Fonte TorBox não reconhecida.')
      ankerGameUrl(source.url)
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

    const installationId = old?.id || randomUUID()
    let parent: string
    let finalDirectory: string
    if (old) {
      if (targetDirectory && existsSync(targetDirectory) && resolve(targetDirectory) !== resolve(old.directory)) {
        parent = targetDirectory
        finalDirectory = join(parent, basename(old.directory) || `ghost-${installationId}`)
      } else {
        parent = dirname(old.directory)
        finalDirectory = old.directory
      }
    } else if (targetDirectory && existsSync(targetDirectory)) {
      parent = targetDirectory
      finalDirectory = join(parent, `ghost-${installationId}`)
    } else {
      const selection = await dialog.showOpenDialog({
        title: 'Escolha onde instalar o jogo',
        properties: ['openDirectory', 'createDirectory']
      })
      if (selection.canceled || !selection.filePaths[0]) {
        return { success: false }
      }
      parent = selection.filePaths[0]
      finalDirectory = join(parent, `ghost-${installationId}`)
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
          if (job.transport === 'torbox') await this.downloadTorbox(job)
          else if (job.transport === 'anker-direct') await this.downloadAnkerDirect(job)
          else await this.download(job)
        } catch (error) {
          if (!['paused', 'cancelled'].includes(job.status)) {
            job.status = 'error'
            job.error = error instanceof Error ? error.message : String(error)
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
    const archive = await AnkerAccount.direct(job.source.url, join(this.root, 'downloads', job.id), controller.signal, (bytes, total, path) => {
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

  private async downloadTorbox(job: StoredJob) {
    job.status = 'downloading'
    const controller = new AbortController()
    this.controllers.set(job.id, controller)
    const signal = controller.signal
    const client = await TorboxClient.saved()
    const referenceKey = (item: StoredJob) => JSON.stringify([
      item.game.providerId, ankerGameUrl(item.source.url), item.game.version || '', item.game.edition || ''
    ])
    const key = referenceKey(job)
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
    const torrentPath = join(this.root, 'downloads', job.id, 'source.torrent')
    if (job.torboxId === undefined) {
      job.transferPhase = 'torrent'
      this.save()
      let torrent: Buffer
      if (existsSync(torrentPath)) torrent = await readFile(torrentPath)
      else torrent = await AnkerAccount.torrent(job.source.url, torrentPath, signal)
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
        job.archive = join(this.root, 'downloads', job.id, `package.${extension}`)
        const url = await client.link(job.torboxId!, signal, format ? single?.id : undefined)
        job.transferPhase = 'local'
        job.remoteProgress = 1
        this.save()
        const manifest = { ...job.manifest, permissions: ['network'] as PluginManifest['permissions'], allowedDomains: [...TORBOX_DOWNLOAD_DOMAINS] }
        await this.download(job, { url, manifest }, controller)
        return
      }
      if (/error|missingfiles/i.test(remote.download_state || ''))
        throw new Error('O TorBox informou falha no torrent. Confira a tarefa na sua conta.')
      // Only active jobs poll; never a global idle timer. Pausing aborts this wait.
      await waitForRemote(15000, undefined, { signal })
    }
  }

  private async download(job: StoredJob, resolved?: { url: string; manifest: PluginManifest }, activeController?: AbortController) {
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
    await this.prepare(job, job.archive)
  }

  private async prepare(job: StoredJob, archive: string) {
    job.status = 'extracting'
    this.save()
    // Each extraction uses a fresh, job-owned directory; existing games are untouched.
    if (existsSync(job.stage))
      throw new Error(
        'Uma extração anterior já existe. Cancele esta operação e inicie outra.'
      )
    let candidates = await extractGame(archive, job.stage)
    if (!candidates.length && job.torboxWrapped) {
      const files = await regularFiles(job.stage)
      const packages = files.filter((file) => /\.(zip|rar|7z|tar)$/i.test(file) && !/\.part(?!0*1\.)\d+\.rar$/i.test(file))
      if (packages.length !== 1)
        throw new Error('O torrent contém múltiplos pacotes ou um formato não reconhecido. A instalação anterior foi preservada.')
      // Keep multipart siblings together for the extractor, with output in a new child.
      const unpacked = join(job.stage, '.ghost-content')
      if (existsSync(unpacked)) throw new Error('O pacote contém uma pasta reservada pelo instalador.')
      candidates = await extractGame(packages[0], unpacked)
      if (candidates.length) {
        // These are verified regular files in this job's staging folder, not installed data.
        for (const file of files) await rm(file)
      }
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
    const old = job.old ? this.installation(job.installationId) : undefined
    if (old && resolve(old.directory) !== resolve(job.directory) && existsSync(job.directory))
      throw new Error('A pasta de destino já existe. Escolha uma pasta vazia para a nova instalação.')
    const restoredSavePath = old?.savePath && inside(old.directory, old.savePath)
      ? join(job.directory, relative(old.directory, old.savePath)) : old?.savePath
    if (old) {
      await this.owned(old.directory, old.id)
      if (!old.savePath || !(await regularFiles(old.savePath)).length)
        throw new Error('Nenhum save foi encontrado na pasta configurada. Confira a pasta antes de substituir o jogo.')
      job.backupId = (await this.backup(old)).id
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
      if (old) {
        await safeRename(old.directory, rollback)
        movedOld = true
      } else if (existsSync(job.directory))
        throw new Error('A pasta de destino já existe.')
      await safeRename(job.stage, job.directory)
      movedNew = true
      if (
        old?.savePath &&
        inside(old.directory, old.savePath) &&
        job.backupId
      ) {
        await restoreSaveSnapshot(
          join(this.root, 'backups', job.backupId),
          restoredSavePath!
        )
      }
      const installed: ExternalInstallation = {
        id: job.installationId,
        appName: old?.appName || `external-${job.installationId}`,
        game: job.game,
        directory: job.directory,
        executable: join(job.directory, executable),
        installedAt: new Date().toISOString(),
        savePath: restoredSavePath,
        autoBackup: old?.autoBackup ?? false,
        autoUpdate: old?.autoUpdate ?? false,
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
          art_cover: job.game.coverUrl || '',
          art_square: job.game.coverUrl || '',
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
      if (movedOld) await safeRename(rollback, old!.directory).catch(() => {})
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
    if (inside(join(this.root, 'downloads'), dirname(job.archive)))
      await rm(dirname(job.archive), { recursive: true, force: true }).catch(
        () => {}
      )
  }

  private async cleanupJob(job: StoredJob) {
    if (job.commitStarted)
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
    await rm(job.stage, { recursive: true, force: true })
    const downloadFolder = join(this.root, 'downloads', job.id)
    if (
      !inside(join(this.root, 'downloads'), downloadFolder) ||
      dirname(job.archive) !== downloadFolder
    )
      throw new Error('Pasta de download inválida.')
    await rm(downloadFolder, { recursive: true, force: true })
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
        if (
          action.type === 'pause' &&
          ['downloading', 'queued'].includes(job.status)
        ) {
          job.status = 'paused'
          this.controllers.get(job.id)?.abort()
        } else if (action.type === 'resume' && (job.status === 'paused' || (job.status === 'error' && ['torbox', 'anker-direct'].includes(job.transport || '') && !existsSync(job.stage)))) {
          if (this.controllers.has(job.id))
            throw new Error('Aguarde a pausa terminar.')
          job.status = 'queued'
          job.error = undefined
          void this.pump()
        } else if (
          action.type === 'cancel' &&
          !['extracting', 'installing', 'completed'].includes(job.status) &&
          !job.commitStarted
        ) {
          job.status = 'cancelled'
          this.controllers.get(job.id)?.abort()
          if (!this.controllers.has(job.id)) await this.cleanupJob(job)
        } else if (
          action.type === 'dismiss' &&
          ['completed', 'cancelled', 'error'].includes(job.status) &&
          !job.commitStarted &&
          !this.controllers.has(job.id)
        ) {
          await this.cleanupJob(job)
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
        } else if (action.type === 'auto-discover-saves') {
          const discovery = await this.discoverSavePathEnhanced(installation)
          if (discovery?.path) {
            installation.savePath = discovery.path
            installation.saveDetectionType = discovery.detectionType
            installation.saveDetectionDetails = discovery.details
            installation.saveFilesCount = discovery.fileCount
            installation.saveTotalBytes = discovery.totalBytes
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
}
