import * as wrappedPackages from '../wrappedPackage'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises'
const fsPromises = jest.requireActual<typeof import('fs/promises')>('fs/promises')
import { tmpdir } from 'os'
import { join } from 'path'
import { dialog } from 'electron'
import { ExternalGames } from '../externalGames'
import * as installSpace from '../installSpace'
import * as archiveMetadata from '../archiveSize'
import * as externalFiles from '../externalFiles'
import { PluginPacker } from '../pluginPacker'
import { NetworkGuard } from '../networkGuard'
import { AnkerAccount, ANKER_SOURCE_ID, ANKER_TORRENT_ID, ANKER_DIRECT_ID } from '../ankerAccount'
import { OnlineFixAccount, ONLINE_FIX_SOURCE_ID, ONLINE_FIX_TORRENT_ID } from '../onlineFixAccount'
import { TorboxClient } from '../torboxClient'
import { torrentInfoHash } from '../torrentMetadata'
import { libraryStore } from 'backend/storeManagers/sideload/electronStores'
import { backendEvents } from 'backend/backend_events'
import type {
  ExternalInstallation,
  GhostSearchResult,
  PluginManifest
} from 'common/types/plugins'

jest.mock('electron', () => {
  const os = jest.requireActual<typeof import('os')>('os')
  return {
    dialog: { showOpenDialog: jest.fn(), showMessageBox: jest.fn() },
    app: { getPath: () => os.homedir() },
    shell: { openExternal: jest.fn() }
  }
})
jest.mock('backend/constants/paths', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs')
  const path = jest.requireActual<typeof import('path')>('path')
  const os = jest.requireActual<typeof import('os')>('os')
  return {
    userDataPath: fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-service-tests-'))
  }
})
jest.mock('backend/storeManagers/sideload/electronStores', () => ({
  libraryStore: { get: jest.fn(), set: jest.fn() }
}))
jest.mock('backend/game_overrides/electronStores', () => ({ gameOverridesStore: { get: jest.fn(() => ({})), set: jest.fn() } }))
jest.mock('backend/ipc', () => ({ sendFrontendMessage: jest.fn() }))

let root: string
let service: ExternalGames
let games: unknown[]
const game: GhostSearchResult = {
  id: 'game-a',
  title: 'Example',
  providerId: 'anker',
  providerName: 'Anker',
  platform: 'windows',
  version: '1.0'
}
const manifest = {
  id: 'anker',
  name: 'Anker',
  permissions: ['network', 'game-sources'],
  allowedDomains: ['example.com']
} as PluginManifest
const source = {
  id: 'website',
  name: 'Site',
  type: 'external' as const,
  url: 'https://example.com/game'
}

async function prepare(next = game, replacement?: string) {
  jest
    .mocked(dialog.showOpenDialog)
    .mockResolvedValueOnce({ canceled: false, filePaths: [root] })
  if (replacement) jest.mocked(dialog.showOpenDialog).mockReset()
  jest
    .mocked(dialog.showMessageBox)
    .mockResolvedValue({ response: 1, checkboxChecked: false })
  const result = await service.enqueue(next, source, manifest, replacement)
  const archive = join(root, `archive-${result.jobId}.zip`)
  await writeFile(
    archive,
    PluginPacker.createZipBuffer([
      { name: 'game.exe', content: Buffer.from(next.version || 'new') }
    ])
  )
  jest
    .mocked(dialog.showOpenDialog)
    .mockResolvedValueOnce({ canceled: false, filePaths: [archive] })
  expect(
    await service.action({ type: 'import-archive', jobId: result.jobId! })
  ).toEqual({ success: true })
  return result.jobId!
}

async function install() {
  const jobId = await prepare()
  expect(
    await service.action({ type: 'finish', jobId, executable: 'game.exe' })
  ).toEqual({ success: true })
  const installation = service.snapshot().installations[0]
  const saves = join(installation.directory, 'saves')
  await mkdir(saves)
  await writeFile(join(saves, 'slot.dat'), 'my progress')
  jest
    .mocked(dialog.showOpenDialog)
    .mockResolvedValueOnce({ canceled: false, filePaths: [saves] })
  await service.action({
    type: 'configure-saves',
    installationId: installation.id
  })
  return service.snapshot().installations[0]
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-install-test-'))
  const { userDataPath } = await import('backend/constants/paths')
  await rm(join(userDataPath, 'external-games'), {
    recursive: true,
    force: true
  })
  backendEvents.removeAllListeners('gameStatusUpdate')
  ;(ExternalGames as unknown as { instance?: ExternalGames }).instance =
    undefined
  games = []
  jest.mocked(libraryStore.get).mockImplementation(() => games as never)
  jest.mocked(libraryStore.set).mockImplementation((_key, value) => {
    games = value as unknown[]
  })
  service = ExternalGames.getInstance()
})

afterEach(async () => {
  jest.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

it('blocks replacement when the configured save folder is empty', async () => {
  const installed = await install()
  const jobId = await prepare({ ...game, version: '2.0' }, installed.id)
  await rm(join(installed.savePath!, 'slot.dat'))
  const result = await service.action({ type: 'finish', jobId, executable: 'game.exe' })
  expect(result.success).toBe(false)
  expect(result.error).toContain('Nenhum save')
  expect(await readFile(join(installed.directory, 'game.exe'), 'utf8')).toBe('1.0')
})

async function waitForJob(predicate: () => boolean) {
  for (let i = 0; i < 500 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10))
  expect(predicate()).toBe(true)
}

it('drops the last removed library registration and allows a fresh installation', async () => {
  const old = await install()
  games = []
  expect(service.snapshot().installations).toHaveLength(0)
  const result = await service.enqueue(game, source, manifest, old.id, false, false, root)
  const job = service.snapshot().jobs.find(item => item.id === result.jobId)!
  expect(job.operation).toBe('install')
  expect(job.installationId).not.toBe(old.id)
})

it('ignores deleted game files and preserves remaining saves during a fresh install', async () => {
  const old = await install()
  await rm(old.executable)
  expect(service.snapshot().installations).toHaveLength(0)
  expect(service.localCandidates()).toHaveLength(0)
  const result = await service.enqueue(game, source, manifest, old.id, false, false, root)
  const job = service.snapshot().jobs.find(item => item.id === result.jobId)!
  expect(job.operation).toBe('install')
  expect(job.installationId).not.toBe(old.id)
  expect(await readFile(join(old.savePath!, 'slot.dat'), 'utf8')).toBe('my progress')
})

it('installs a package root without a UUID wrapper and retains the layout on update', async () => {
  async function nested(version: string, replaceId?: string) {
    jest.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false })
    const result = await service.enqueue({ ...game, version }, source, manifest, replaceId, false, false, replaceId ? undefined : root)
    const archive = join(root, `nested-${version}.zip`)
    await writeFile(archive, PluginPacker.createZipBuffer([{ name: 'Game-Root/Inner/game.exe', content: Buffer.from(version) }]))
    jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [archive] })
    expect(await service.action({ type: 'import-archive', jobId: result.jobId! })).toEqual({ success: true })
    expect(await service.action({ type: 'finish', jobId: result.jobId!, executable: join('Inner', 'game.exe') })).toEqual({ success: true })
    return service.snapshot().installations[0]
  }
  const first = await nested('1.0')
  expect(first.directory).toBe(join(root, 'Game-Root'))
  const saves = join(first.directory, 'saves')
  await mkdir(saves)
  await writeFile(join(saves, 'slot'), 'progress')
  jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [saves] })
  await service.action({ type: 'configure-saves', installationId: first.id })
  const second = await nested('2.0', first.id)
  expect(second.executable).toBe(join(root, 'Game-Root', 'Inner', 'game.exe'))
  expect(await readFile(second.executable, 'utf8')).toBe('2.0')
  expect(await readFile(join(saves, 'slot'), 'utf8')).toBe('progress')
})

function torboxFixture() {
  const torrent = Buffer.from('d4:infod6:lengthi1e4:name8:game.zipee')
  const client = {
    list: jest.fn(), create: jest.fn().mockResolvedValue(42),
    link: jest.fn().mockResolvedValue('https://cdn.torbox.app/file.zip?ephemeral=token')
  }
  const remote = { id: 42, hash: torrentInfoHash(torrent), progress: 1, download_finished: true, download_present: true, download_state: 'cached', files: [{ id: 7, name: 'game.zip', size: 100 }] }
  jest.spyOn(TorboxClient, 'saved').mockResolvedValue(client as unknown as TorboxClient)
  jest.spyOn(AnkerAccount, 'torrent').mockImplementation(async (_url, file) => {
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, torrent)
    return torrent
  })
  jest.spyOn(NetworkGuard, 'fetchResponse').mockImplementation(async () => new Response(new Uint8Array(PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('downloaded') }]))))
  const enqueue = () => service.enqueue(
    { ...game, id: 'https://ankergames.net/game/test', providerId: ANKER_SOURCE_ID },
    { id: ANKER_TORRENT_ID, name: 'Download', type: 'torbox', url: 'https://ankergames.net/game/test' },
    { ...manifest, id: ANKER_SOURCE_ID }, undefined, false, false, root
  )
  return { client, remote, enqueue }
}

it('receives a browser-confirmed archive without requiring or calling TorBox', async () => {
  const torbox = jest.spyOn(TorboxClient, 'saved').mockRejectedValue(new Error('No key'))
  const direct = jest.spyOn(AnkerAccount, 'direct').mockImplementation(async (_page, directory, _signal, progress) => {
    await mkdir(directory, { recursive: true })
    const file = join(directory, 'package.zip')
    const data = PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('direct game') }])
    await writeFile(file, data)
    progress(data.length, data.length, file)
    return file
  })
  const result = await service.enqueue(
    { ...game, id: 'https://ankergames.net/game/test', providerId: ANKER_SOURCE_ID },
    { id: ANKER_DIRECT_ID, name: 'Download direto', type: 'external', url: 'https://ankergames.net/game/test' },
    { ...manifest, id: ANKER_SOURCE_ID }, undefined, false, false, root
  )
  expect(result.success).toBe(true)
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(torbox).not.toHaveBeenCalled()
  expect(direct).toHaveBeenCalledTimes(1)
  expect(service.snapshot().jobs[0].transport).toBe('anker-direct')
  expect(service.snapshot().jobs[0].bytes).toBeGreaterThan(0)
})

it('reuses the matching TorBox torrent and downloads without persisting signed links', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([remote])
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(client.create).not.toHaveBeenCalled()
  expect(client.link).toHaveBeenCalledWith(42, expect.any(AbortSignal), 7)
  const { userDataPath } = await import('backend/constants/paths')
  const disk = await readFile(join(userDataPath, 'external-games', 'state.json'), 'utf8')
  expect(disk).not.toContain('ephemeral')
  expect(disk).toContain('torboxId')
  expect(service.snapshot().jobs[0].transferPhase).toBe('local')
  expect(result.success).toBe(true)
})

it('checks TorBox before contacting Anker again even after the earlier job is dismissed', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([remote])
  const first = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  await waitForJob(() => !(service as unknown as { active: boolean }).active)
  await service.action({ type: 'cancel', jobId: first.jobId! })
  await service.action({ type: 'dismiss', jobId: first.jobId! })
  expect(service.snapshot().jobs).toHaveLength(0)
  jest.mocked(AnkerAccount.torrent).mockClear()
  client.list.mockClear()
  await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(AnkerAccount.torrent).not.toHaveBeenCalled()
  expect(client.create).not.toHaveBeenCalled()
  expect(client.list).toHaveBeenNthCalledWith(1, expect.any(AbortSignal), 42)
})

it('keeps a newly submitted torrent queued until its details appear and resumes without resubmitting', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([])
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.remoteStatus?.startsWith('Aguardando o TorBox') === true)
  expect(service.snapshot().jobs[0].status).toBe('downloading')
  expect(client.list).toHaveBeenLastCalledWith(expect.any(AbortSignal), 42)
  await service.action({ type: 'pause', jobId: result.jobId! })
  await waitForJob(() => !(service as unknown as { active: boolean }).active)
  client.list.mockResolvedValue([remote])
  await service.action({ type: 'resume', jobId: result.jobId! })
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(client.create).toHaveBeenCalledTimes(1)
  expect(client.link).toHaveBeenCalledWith(42, expect.any(AbortSignal), 7)
})

it('does not submit again after an uncertain TorBox create request', async () => {
  const { client, enqueue } = torboxFixture()
  client.list.mockResolvedValue([])
  client.create.mockRejectedValue(new Error('Connection lost'))
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  await service.action({ type: 'resume', jobId: result.jobId! })
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  expect(client.create).toHaveBeenCalledTimes(1)
  expect(service.snapshot().jobs[0].error).toContain('evitar duplicar')
})

it('pauses remote monitoring without deleting a torrent from the account', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([{ ...remote, download_finished: false, progress: 0.3 }])
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.remoteProgress === 0.3)
  expect((await service.action({ type: 'pause', jobId: result.jobId! })).success).toBe(true)
  await waitForJob(() => !(service as unknown as { active: boolean }).active)
  expect(service.snapshot().jobs[0].status).toBe('paused')
  expect(client.link).not.toHaveBeenCalled()
})

it('rejects a reused remote id belonging to another torrent', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValueOnce([remote]).mockResolvedValue([{ ...remote, hash: 'different-game' }])
  await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  expect(service.snapshot().jobs[0].error).toContain('não corresponde')
  expect(client.link).not.toHaveBeenCalled()
  expect(NetworkGuard.fetchResponse).not.toHaveBeenCalled()
})

it('reconciles an uncertain submission by hash on retry', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([])
  client.create.mockRejectedValue(new Error('Connection lost'))
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  client.list.mockResolvedValue([remote])
  await service.action({ type: 'resume', jobId: result.jobId! })
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(client.create).toHaveBeenCalledTimes(1)
  expect(AnkerAccount.torrent).toHaveBeenCalledTimes(1)
})

it('waits for cached files even when the cloud reports a completed torrent', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([{ ...remote, download_present: false }])
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.remoteProgress === 1)
  expect(client.link).not.toHaveBeenCalled()
  await service.action({ type: 'pause', jobId: result.jobId! })
  await waitForJob(() => !(service as unknown as { active: boolean }).active)
})

it('installs, switches providers only after success, removes old files and preserves saves', async () => {
  const installed = await install()
  await writeFile(join(installed.directory, 'old-mod.txt'), 'remove me')
  const next = {
    ...game,
    id: 'other-id',
    providerId: 'steamrip',
    providerName: 'SteamRIP',
    version: '2.0'
  }
  const jobId = await prepare(next, installed.id)
  expect(service.snapshot().installations[0].game.providerId).toBe('anker')
  expect(
    await service.action({ type: 'finish', jobId, executable: 'game.exe' })
  ).toEqual({ success: true })
  expect(service.snapshot().installations[0].game.providerId).toBe('steamrip')
  expect(await readFile(join(installed.directory, 'game.exe'), 'utf8')).toBe(
    '2.0'
  )
  expect(await readFile(join(installed.savePath!, 'slot.dat'), 'utf8')).toBe(
    'my progress'
  )
  await expect(
    readFile(join(installed.directory, 'old-mod.txt'))
  ).rejects.toThrow()
  expect(service.snapshot().backups).toHaveLength(1)
  expect(service.snapshot().installations[0].history[0].game.providerId).toBe(
    'anker'
  )
})

it('keeps the old installation when backup fails', async () => {
  const installed = await install()
  const jobId = await prepare({ ...game, version: '2.0' }, installed.id)
  await rm(installed.savePath!, { recursive: true })
  expect(
    (await service.action({ type: 'finish', jobId, executable: 'game.exe' }))
      .success
  ).toBe(false)
  expect(await readFile(join(installed.directory, 'game.exe'), 'utf8')).toBe(
    '1.0'
  )
  expect(service.snapshot().installations[0].game.version).toBe('1.0')
})

it('rolls back files and provenance if library registration fails', async () => {
  const installed = await install()
  const jobId = await prepare(
    { ...game, providerId: 'steamrip', version: '2.0' },
    installed.id
  )
  jest.mocked(libraryStore.set).mockImplementationOnce(() => {
    throw new Error('Disk failure')
  })
  expect(
    (await service.action({ type: 'finish', jobId, executable: 'game.exe' }))
      .success
  ).toBe(false)
  expect(service.snapshot().installations[0].game.providerId).toBe('anker')
  expect(await readFile(join(installed.directory, 'game.exe'), 'utf8')).toBe(
    '1.0'
  )
})

it('rejects replacements while the game is running or the library points to an official game', async () => {
  const installed = await install()
  backendEvents.emit('gameStatusUpdate', {
    appName: installed.appName,
    runner: 'sideload',
    status: 'playing'
  })
  await expect(
    service.enqueue(game, source, manifest, installed.id)
  ).rejects.toThrow('Feche o jogo')
  backendEvents.emit('gameStatusUpdate', {
    appName: installed.appName,
    runner: 'sideload',
    status: 'done'
  })
  games = [{ ...(games[0] as object), runner: 'steam' }]
  await expect(
    service.enqueue(game, source, manifest, installed.id)
  ).rejects.toThrow('vínculo')
})

it('rejects executable selection outside the extracted package', async () => {
  const jobId = await prepare()
  expect(
    (
      await service.action({
        type: 'finish',
        jobId,
        executable: '../outside.exe'
      })
    ).success
  ).toBe(false)
  expect(service.snapshot().installations).toHaveLength(0)
})

it('restores a backup after live saves were removed', async () => {
  const installed = await install()
  await service.action({ type: 'backup', installationId: installed.id })
  const backupId = service.snapshot().backups[0].id
  await rm(installed.savePath!, { recursive: true })
  expect(
    await service.action({
      type: 'restore',
      installationId: installed.id,
      backupId
    })
  ).toEqual({ success: true })
  expect(await readFile(join(installed.savePath!, 'slot.dat'), 'utf8')).toBe(
    'my progress'
  )
})

it('rejects a Switch package before touching a Windows installation', async () => {
  const installed: ExternalInstallation = await install()
  await expect(
    service.enqueue(
      { ...game, platform: 'switch' },
      source,
      manifest,
      installed.id
    )
  ).rejects.toThrow('plataforma')
})

it('links an existing external game without modifying its executable', async () => {
  const executable = join(root, 'existing.exe')
  await writeFile(executable, 'existing game')
  games = [
    {
      app_name: 'local-game',
      title: 'Existing game',
      runner: 'sideload',
      is_installed: true,
      install: { executable, platform: 'Windows' }
    }
  ]
  jest
    .mocked(dialog.showOpenDialog)
    .mockResolvedValueOnce({ canceled: false, filePaths: [root] })
  jest
    .mocked(dialog.showMessageBox)
    .mockResolvedValueOnce({ response: 1, checkboxChecked: false })
  expect(await service.linkExisting('local-game', game)).toEqual({
    success: true
  })
  expect(service.snapshot().installations[0].linkedExisting).toBe(true)
  expect(service.localCandidates()).toEqual([])
  expect(await readFile(executable, 'utf8')).toBe('existing game')
})

it('does not offer official games as candidates', async () => {
  games = [
    {
      app_name: 'steam-game',
      title: 'Official',
      runner: 'steam',
      is_installed: true,
      install: { executable: join(root, 'game.exe'), platform: 'Windows' }
    }
  ]
  expect(service.localCandidates()).toEqual([])
  expect((await service.linkExisting('steam-game', game)).success).toBe(false)
})

async function eventually(condition: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 500; i++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(
    `Operation did not reach the expected state: ${JSON.stringify(service.snapshot().jobs)}`
  )
}

it('downloads a ZIP and resumes from the confirmed byte offset', async () => {
  const zip = PluginPacker.createZipBuffer([
    { name: 'game.exe', content: Buffer.from('downloaded game') }
  ])
  const split = Math.floor(zip.length / 2)
  const firstBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(zip.subarray(0, split)))
    }
  })
  const network = jest
    .spyOn(NetworkGuard, 'fetchResponse')
    .mockResolvedValueOnce(
      new Response(firstBody, {
        headers: {
          'content-type': 'application/zip',
          'content-length': String(zip.length),
          etag: '"version-1"'
        }
      })
    )
    .mockResolvedValueOnce(
      new Response(zip.subarray(split), {
        status: 206,
        headers: {
          'content-type': 'application/zip',
          'content-range': `bytes ${split}-${zip.length - 1}/${zip.length}`,
          etag: '"version-1"'
        }
      })
    )
  try {
    jest
      .mocked(dialog.showOpenDialog)
      .mockResolvedValueOnce({ canceled: false, filePaths: [root] })
    const result = await service.enqueue(
      game,
      { ...source, type: 'direct', archive: 'zip' },
      manifest
    )
    await eventually(() => service.snapshot().jobs[0].bytes === split)
    const { userDataPath } = await import('backend/constants/paths')
    await eventually(
      async () =>
        (
          await readFile(
            join(
              userDataPath,
              'external-games',
              'downloads',
              result.jobId!,
              'package.zip'
            )
          ).catch(() => Buffer.alloc(0))
        ).length === split
    )
    expect(
      await service.action({ type: 'pause', jobId: result.jobId! })
    ).toEqual({ success: true })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(
      await service.action({ type: 'resume', jobId: result.jobId! })
    ).toEqual({ success: true })
    await eventually(() => service.snapshot().jobs[0].status === 'ready')
    expect(network.mock.calls[1][3]).toMatchObject({
      Range: `bytes=${split}-`,
      'If-Range': '"version-1"'
    })
    expect(
      await service.action({
        type: 'finish',
        jobId: result.jobId!,
        executable: 'game.exe'
      })
    ).toEqual({ success: true })
    expect(
      await readFile(service.snapshot().installations[0].executable, 'utf8')
    ).toBe('downloaded game')
  } finally {
    network.mockRestore()
  }
})

it('does not treat an HTML page as a completed game download', async () => {
  const network = jest.spyOn(NetworkGuard, 'fetchResponse').mockResolvedValue(
    new Response('<html>Login required</html>', {
      headers: { 'content-type': 'text/html' }
    })
  )
  try {
    jest
      .mocked(dialog.showOpenDialog)
      .mockResolvedValueOnce({ canceled: false, filePaths: [root] })
    await service.enqueue(
      game,
      { ...source, type: 'direct', archive: 'zip' },
      manifest
    )
    await eventually(() => service.snapshot().jobs[0].status === 'error')
    expect(service.snapshot().installations).toEqual([])
    expect(service.snapshot().jobs[0].error).toContain('página')
  } finally {
    network.mockRestore()
  }
})

it('supports getOrCreateInstallation and manages GhostShield save backups', async () => {
  const gameDir = join(root, 'mock-pirate-game')
  const saveDir = join(root, 'mock-saves')
  await mkdir(gameDir, { recursive: true })
  await mkdir(saveDir, { recursive: true })
  await writeFile(join(gameDir, 'game.exe'), 'exe content')
  await writeFile(join(saveDir, 'save.dat'), 'player save 100%')

  const fakeGame: any = {
    app_name: 'test-pirate-1',
    title: 'Pirate Game Test',
    runner: 'sideload',
    install: {
      executable: join(gameDir, 'game.exe'),
      install_path: gameDir
    }
  }
  games = [fakeGame]

  const inst = await service.getOrCreateInstallation('test-pirate-1', fakeGame)
  expect(inst).toBeDefined()
  expect(inst?.appName).toBe('test-pirate-1')

  // Set save path
  await service.action({
    type: 'set-save-path',
    installationId: inst!.id,
    path: saveDir
  })

  // Create backup snapshot
  const backupRes = await service.action({
    type: 'backup',
    installationId: inst!.id
  })
  expect(backupRes.success).toBe(true)
  expect(service.snapshot().backups.length).toBe(1)
  const backupId = service.snapshot().backups[0].id

  // Modify original save
  await writeFile(join(saveDir, 'save.dat'), 'corrupted save')

  // Restore snapshot (creates safety backup before overwriting)
  const restoreRes = await service.action({
    type: 'restore',
    installationId: inst!.id,
    backupId
  })
  expect(restoreRes.success).toBe(true)
  expect(await readFile(join(saveDir, 'save.dat'), 'utf8')).toBe('player save 100%')
  expect(service.snapshot().backups.length).toBe(2)

  // Delete original backup
  const deleteRes = await service.action({
    type: 'delete-backup',
    installationId: inst!.id,
    backupId
  })
  expect(deleteRes.success).toBe(true)
  expect(service.snapshot().backups.length).toBe(1)
})

test('deve executar syncPiratasSaves em lote e mapear múltiplos jogos', async () => {
  const gameDir1 = await mkdtemp(join(root, 'game-pirata-1-'))
  const saveDir1 = await mkdtemp(join(root, 'save-pirata-1-'))
  await writeFile(join(saveDir1, 'save.sav'), 'progress 1')

  const gameDir2 = await mkdtemp(join(root, 'game-pirata-2-'))
  const saveDir2 = await mkdtemp(join(root, 'save-pirata-2-'))
  await writeFile(join(saveDir2, 'save.sav'), 'progress 2')

  const piratasMockGames = [
    {
      app_name: 'Cuphead',
      title: 'Cuphead',
      runner: 'sideload',
      install: { executable: join(gameDir1, 'Cuphead.exe'), install_path: gameDir1 }
    },
    {
      app_name: 'Phasmophobia',
      title: 'Phasmophobia',
      runner: 'sideload',
      install: { executable: join(gameDir2, 'Phasmophobia.exe'), install_path: gameDir2 }
    },
    {
      app_name: 'jPNyjhQ7EuR46Wk5XkCyfx', // ID real do Clone Hero no EXCLUDED_PIRATAS_APP_NAMES
      title: 'Clone Hero',
      runner: 'sideload',
      install: { executable: join(gameDir1, 'CloneHero.exe') }
    }
  ]
  games = piratasMockGames

  const syncResult = await service.syncPiratasSaves({ autoBackup: false })
  expect(syncResult.total).toBe(2) // 3 menos o excluído Clone Hero
  expect(syncResult.mapped).toBeGreaterThanOrEqual(1)
  expect(syncResult.results.length).toBe(2)

  // Testar chamada via action({ type: 'sync-piratas-saves' })
  const actionRes = await service.action({ type: 'sync-piratas-saves', autoBackup: false })
  expect(actionRes.success).toBe(true)
  expect(actionRes.piratasSyncResult).toBeDefined()
})


it('backs up before confirmed removal and restores saves after a clean replacement', async () => {
  const old = await install()
  const result = await service.enqueue({ ...game, version: '2.0' }, source, manifest, old.id, false, false, undefined, true)
  const job = service.snapshot().jobs.find(item => item.id === result.jobId)!
  expect(job.oldRemoved).toBe(true)
  expect(service.canLaunch(old.appName)).toBe(false)
  await expect(readFile(old.executable)).rejects.toThrow()
  expect(service.snapshot().backups).toHaveLength(1)
  const archive = join(root, 'replacement.zip')
  await writeFile(archive, PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('2.0') }]))
  jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [archive] })
  expect(await service.action({ type: 'import-archive', jobId: job.id })).toEqual({ success: true })
  expect(await service.action({ type: 'finish', jobId: job.id, executable: 'game.exe' })).toEqual({ success: true })
  expect(await readFile(old.executable, 'utf8')).toBe('2.0')
  expect(await readFile(join(old.savePath!, 'slot.dat'), 'utf8')).toBe('my progress')
  expect(service.canLaunch(old.appName)).toBe(true)
  await expect(readFile(join(root, `.ghost-download-${job.id}`, '.ghost-download.json'))).rejects.toThrow()
})

it('does not delete a confirmed replacement when saves cannot be backed up', async () => {
  const old = await install()
  await rm(join(old.savePath!, 'slot.dat'))
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('error')
  expect(await readFile(old.executable, 'utf8')).toBe('1.0')
})

it('preserves the verified backup when cancelled after deletion', async () => {
  const old = await install()
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  expect(await service.action({ type: 'cancel', jobId: result.jobId! })).toEqual({ success: true })
  expect(service.snapshot().backups).toHaveLength(1)
  expect(service.canLaunch(old.appName)).toBe(false)
  await expect(readFile(old.executable)).rejects.toThrow()
  const { userDataPath } = await import('backend/constants/paths')
  expect(await readFile(join(userDataPath, 'external-games', 'backups', service.snapshot().backups[0].id, 'slot.dat'), 'utf8')).toBe('my progress')
})

it('keeps the removed state and backup across a launcher restart', async () => {
  const old = await install()
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  ;(ExternalGames as unknown as { instance?: ExternalGames }).instance = undefined
  const restarted = ExternalGames.getInstance()
  expect(restarted.snapshot().jobs.find(item => item.id === result.jobId)?.oldRemoved).toBe(true)
  expect(restarted.canLaunch(old.appName)).toBe(false)
  expect(restarted.snapshot().backups).toHaveLength(1)
})


it('waits for consent before using an alternative temporary directory', async () => {
  const old = await install()
  const alternative = await mkdtemp(join(root, 'other-disk-'))
  const spy = jest.spyOn(installSpace, 'planInstallSpace').mockImplementation(async (destination, id) => ({
    destination, temporaryDirectory: join(alternative, `.ghost-download-${id}`),
    packageBytes: 100, installedBytes: 100, requiredOriginal: 512 * 1024 ** 2 + 200,
    missingOriginal: 100, missingDestination: 0, estimated: false
  }))
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  const job = service.snapshot().jobs.find(item => item.id === result.jobId)!
  expect(job.status).toBe('paused')
  expect(job.spacePlan?.missingOriginal).toBe(100)
  await expect(readFile(join(job.spacePlan!.temporaryDirectory!, '.ghost-download.json'))).rejects.toThrow()
  expect(await service.action({ type: 'space-proceed', jobId: job.id })).toEqual({ success: true })
  expect(service.snapshot().jobs.find(item => item.id === job.id)?.spacePlan).toBeUndefined()
  expect(await readFile(join(alternative, `.ghost-download-${job.id}`, '.ghost-download.json'), 'utf8')).toContain(job.id)
  spy.mockRestore()
  await service.action({ type: 'cancel', jobId: job.id })
})

it('rechecks disk space without permitting an undersized installation destination', async () => {
  const old = await install()
  const spy = jest.spyOn(installSpace, 'planInstallSpace').mockImplementation(async destination => ({
    destination, packageBytes: 100, installedBytes: 200, requiredOriginal: 300,
    missingOriginal: 200, missingDestination: 100, estimated: false
  }))
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  await service.action({ type: 'space-proceed', jobId: result.jobId! })
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('paused')
  spy.mockRestore()
  await service.action({ type: 'space-recheck', jobId: result.jobId! })
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('awaiting-file')
  await service.action({ type: 'cancel', jobId: result.jobId! })
})

it('blocks deletion when the saved snapshot fails checksum verification', async () => {
  const old = await install()
  jest.spyOn(externalFiles, 'hashFile').mockResolvedValue('invalid-checksum')
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('error')
  expect(await readFile(old.executable, 'utf8')).toBe('1.0')
})


it('recovers an interrupted removal without repeating or losing the backup', async () => {
  const old = await install()
  const realRm = fsPromises.rm
  const failure = jest.spyOn(fsPromises, 'rm').mockImplementation(async (path, options) => {
    if (String(path).includes('.ghost-remove-')) throw new Error('Disk temporarily unavailable')
    return realRm(path, options)
  })
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('error')
  expect(service.canLaunch(old.appName)).toBe(false)
  failure.mockRestore()
  ;(ExternalGames as unknown as { instance?: ExternalGames }).instance = undefined
  const restarted = ExternalGames.getInstance()
  expect(await restarted.action({ type: 'resume', jobId: result.jobId! })).toEqual({ success: true })
  for (let i = 0; i < 100 && restarted.snapshot().jobs.find(item => item.id === result.jobId)?.status !== 'awaiting-file'; i++)
    await new Promise(resolve => setTimeout(resolve, 10))
  expect(restarted.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('awaiting-file')
  expect(restarted.snapshot().backups).toHaveLength(1)
  expect(restarted.canLaunch(old.appName)).toBe(false)
  await restarted.action({ type: 'cancel', jobId: result.jobId! })
})


it('keeps the downloaded package when its extracted size requires more disk space', async () => {
  const old = await install()
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  const archive = join(root, 'retained.zip')
  await writeFile(archive, PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('2.0') }]))
  jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [archive] })
  const metadata = jest.spyOn(archiveMetadata, 'archiveSize').mockResolvedValue(Number.MAX_SAFE_INTEGER)
  await service.action({ type: 'import-archive', jobId: result.jobId! })
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.spacePlan?.packageReady).toBe(true)
  expect((await readFile(archive)).length).toBeGreaterThan(0)
  metadata.mockRestore()
  await service.action({ type: 'space-recheck', jobId: result.jobId! })
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('ready')
  await service.action({ type: 'finish', jobId: result.jobId!, executable: 'game.exe' })
  expect(await readFile(join(old.savePath!, 'slot.dat'), 'utf8')).toBe('my progress')
})


it('can resume a cancelled replacement using its preserved save backup', async () => {
  const old = await install()
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  await service.action({ type: 'cancel', jobId: result.jobId! })
  expect(await service.action({ type: 'resume', jobId: result.jobId! })).toEqual({ success: true })
  for (let i = 0; i < 100 && service.snapshot().jobs.find(item => item.id === result.jobId)?.status !== 'awaiting-file'; i++)
    await new Promise(resolve => setTimeout(resolve, 10))
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('awaiting-file')
  expect(service.snapshot().backups).toHaveLength(1)
  const archive = join(root, 'after-cancel.zip')
  await writeFile(archive, PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('2.0') }]))
  jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [archive] })
  await service.action({ type: 'import-archive', jobId: result.jobId! })
  expect(await service.action({ type: 'finish', jobId: result.jobId!, executable: 'game.exe' })).toEqual({ success: true })
  expect(await readFile(join(old.savePath!, 'slot.dat'), 'utf8')).toBe('my progress')
})


it('keeps manual version corrections in the same record used for update checks', async () => {
  const installed = await install()
  service.recordUpdate(installed.id, { ...game, version: '2.0' }, 'update')
  service.setInstalledVersion(installed.appName, 'v0.10.4')
  const current = service.snapshot().installations.find(item => item.id === installed.id)!
  expect(current.game.version).toBe('v0.10.4')
  expect(current.availableUpdate).toBeUndefined()
  expect(libraryStore.get('games', []).find(item => item.app_name === installed.appName)?.version).toBe('v0.10.4')
})


it('captures Online-Fix torrents using its own session and reuses them after cancellation', async () => {
  const { client, remote } = torboxFixture()
  client.list.mockResolvedValue([remote])
  const capture = jest.spyOn(OnlineFixAccount, 'torrent').mockResolvedValue(Buffer.from('d4:infod6:lengthi1e4:name8:game.zipee'))
  const enqueue = () => service.enqueue(
    { ...game, providerId: ONLINE_FIX_SOURCE_ID, id: 'https://online-fix.me/games/test/123-test.html' },
    { id: ONLINE_FIX_TORRENT_ID, name: 'Torrent', type: 'torbox', url: 'https://online-fix.me/games/test/123-test.html' },
    { ...manifest, id: ONLINE_FIX_SOURCE_ID }, undefined, false, false, root)
  const first = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(capture).toHaveBeenCalledTimes(1)
  expect(AnkerAccount.torrent).not.toHaveBeenCalled()
  await service.action({ type: 'cancel', jobId: first.jobId! })
  await enqueue()
  await waitForJob(() => service.snapshot().jobs[1]?.status === 'ready')
  expect(capture).toHaveBeenCalledTimes(1)
  expect(client.create).not.toHaveBeenCalled()
})

it('restores a failed TorBox job after restarting without requesting or uploading the torrent again', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([remote])
  jest.mocked(NetworkGuard.fetchResponse).mockRejectedValue(new Error('local transfer unavailable'))
  const result = await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  expect(service.snapshot().jobs[0].canResume).toBe(true)
  ;(ExternalGames as unknown as { instance?: ExternalGames }).instance = undefined
  const restarted = ExternalGames.getInstance()
  jest.mocked(NetworkGuard.fetchResponse).mockResolvedValue(new Response(new Uint8Array(PluginPacker.createZipBuffer([{ name: 'game.exe', content: Buffer.from('resumed') }]))))
  await restarted.action({ type: 'resume', jobId: result.jobId! })
  await waitForJob(() => restarted.snapshot().jobs[0]?.status === 'ready')
  expect(AnkerAccount.torrent).toHaveBeenCalledTimes(1)
  expect(client.create).not.toHaveBeenCalled()
  expect(client.link).toHaveBeenCalledTimes(2)
})

it('refreshes the TorBox file link after a temporary network failure without resubmitting', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([remote])
  jest.mocked(NetworkGuard.fetchResponse).mockRejectedValueOnce(new TypeError('fetch failed'))
  await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'ready')
  expect(client.link).toHaveBeenCalledTimes(2)
  expect(client.create).not.toHaveBeenCalled()
  expect(AnkerAccount.torrent).toHaveBeenCalledTimes(1)
})

it('asks for the destination even when a default folder is saved and cancels before queueing', async () => {
  jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] })
  const result = await service.enqueue(game, source, manifest, undefined, false, false, root, false, true)
  expect(result.success).toBe(false)
  expect(service.snapshot().jobs).toHaveLength(0)
  expect(dialog.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: root, title: 'Onde deseja baixar e instalar o jogo?' }))
})


it('reports persistent TorBox file connection failures safely and keeps Resume available', async () => {
  const { client, remote, enqueue } = torboxFixture()
  client.list.mockResolvedValue([remote])
  jest.mocked(NetworkGuard.fetchResponse).mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET', message: 'https://cdn.torbox.app/?token=secret' } }))
  await enqueue()
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  const failed = service.snapshot().jobs[0]
  expect(failed.canResume).toBe(true)
  expect(failed.error).toContain('ECONNRESET')
  expect(failed.error).toContain('Retomar')
  expect(failed.error).not.toContain('secret')
  expect(client.link).toHaveBeenCalledTimes(3)
  expect(AnkerAccount.torrent).toHaveBeenCalledTimes(1)
  expect(client.create).not.toHaveBeenCalled()
}, 15000)

it('uses the newly selected destination instead of the saved default', async () => {
  const destination = join(root, 'chosen')
  await mkdir(destination)
  jest.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [destination] })
  const result = await service.enqueue(game, source, manifest, undefined, false, false, root, false, true)
  const { userDataPath } = await import('backend/constants/paths')
  const persisted = JSON.parse(await readFile(join(userDataPath, 'external-games', 'state.json'), 'utf8'))
  expect(persisted.jobs.find((item: { id: string }) => item.id === result.jobId).directory).toBe(join(destination, 'Example'))
})

it('dismisses already cancelled job when cancel or dismiss is called, expunging it from state.jobs', async () => {
  const old = await install()
  const result = await service.enqueue(game, source, manifest, old.id, false, false, undefined, true)
  // Primeiro cancel: cancela e marca como 'cancelled' mantendo backup
  expect(await service.action({ type: 'cancel', jobId: result.jobId! })).toEqual({ success: true })
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)?.status).toBe('cancelled')
  // Segundo cancel (ou clique no X em job já cancelado): remove completamente da lista de jobs
  expect(await service.action({ type: 'cancel', jobId: result.jobId! })).toEqual({ success: true })
  expect(service.snapshot().jobs.find(item => item.id === result.jobId)).toBeUndefined()
})



it('retries an existing Online-Fix wrapper with a repair archive using the local download after restart', async () => {
  const { client, remote } = torboxFixture()
  client.list.mockResolvedValue([{ ...remote, files: [{ id: 7, name: 'Game.rar', size: 100 }, { id: 8, name: 'Fix Repair/repair.rar', size: 10 }] }])
  const capture = jest.spyOn(OnlineFixAccount, 'torrent').mockResolvedValue(Buffer.from('d4:infod6:lengthi1e4:name8:game.zipee'))
  const main = PluginPacker.createZipBuffer([{ name: 'Stonewards/game.exe', content: Buffer.from('game') }])
  const repair = PluginPacker.createZipBuffer([{ name: 'patch.txt', content: Buffer.from('optional repair') }])
  const wrapper = PluginPacker.createZipBuffer([{ name: 'Stonewards/Stonewards.v0.1.5-OFME.zip', content: main }, { name: 'Stonewards/Fix Repair/Stonewards_Fix_Repair.zip', content: repair }])
  jest.mocked(NetworkGuard.fetchResponse).mockResolvedValue(new Response(new Uint8Array(wrapper), { headers: { 'content-length': String(wrapper.length) } }))
  const rejectLegacy = jest.spyOn(wrappedPackages, 'selectWrappedPackage').mockImplementationOnce(() => { throw new Error('Legacy multiple archives error') })
  const result = await service.enqueue(
    { ...game, providerId: ONLINE_FIX_SOURCE_ID, id: 'https://online-fix.me/games/test/123-test.html' },
    { id: ONLINE_FIX_TORRENT_ID, name: 'Torrent', type: 'torbox', url: 'https://online-fix.me/games/test/123-test.html' },
    { ...manifest, id: ONLINE_FIX_SOURCE_ID }, undefined, false, false, root)
  await waitForJob(() => service.snapshot().jobs[0]?.status === 'error')
  await waitForJob(() => !(service as unknown as { active: boolean }).active)
  rejectLegacy.mockRestore()
  const { userDataPath } = await import('backend/constants/paths')
  const statePath = join(userDataPath, 'external-games', 'state.json')
  const persisted = JSON.parse(await readFile(statePath, 'utf8'))
  delete persisted.jobs[0].packageDownloaded
  await writeFile(statePath, JSON.stringify(persisted))
  ;(ExternalGames as unknown as { instance?: ExternalGames }).instance = undefined
  const restarted = ExternalGames.getInstance()
  expect(restarted.snapshot().jobs[0].canResume).toBe(true)
  expect(await restarted.action({ type: 'resume', jobId: result.jobId! })).toEqual({ success: true })
  expect(restarted.snapshot().jobs[0].status).toBe('ready')
  expect(restarted.snapshot().jobs[0].candidates).toContain('game.exe')
  expect(NetworkGuard.fetchResponse).toHaveBeenCalledTimes(1)
  expect(capture).toHaveBeenCalledTimes(1)
  expect(client.link).toHaveBeenCalledTimes(1)
  expect(client.create).not.toHaveBeenCalled()
})
