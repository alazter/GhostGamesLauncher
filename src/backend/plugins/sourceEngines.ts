import { installSourceRules, validateSourceRules } from './sourceRules'
import { mkdir, readFile, writeFile, rename, rm, stat } from 'fs/promises'
import { join, resolve } from 'path'
import { createHash, randomUUID } from 'crypto'
import extractZip from 'extract-zip'
import { gt, valid } from 'semver'
import type {
  EngineRelease,
  SourceEngineAction,
  SourceEngineId,
  SourceEnginesState
} from 'common/types/sourceEngines'
import { secureFetch } from './secureDns'
import { engineProcess } from './engineProcess'
import { validateEngineRelease } from './enginePolicy'
import { engineFileOperation } from './engineFileOperation'
import {
  officialObscuraRelease,
  testObscuraCompatibility
} from './obscuraRelease'
import {
  createSourceEnginePackage,
  readSourceEnginePackage,
  engineArchiveLimit
} from './sourceEnginePackage'

const ids: SourceEngineId[] = ['scrapling', 'obscura']
const repositories = {
  scrapling: 'D4Vinci/Scrapling',
  obscura: 'h4ckf0r0day/obscura'
}
const feed =
  'https://github.com/alazter/GhostGamesLauncher/releases/download/engines-stable/catalog.json'
type State = {
  automatic: boolean
  checkedAt?: number
  enabled: Record<SourceEngineId, boolean>
  installed: Partial<Record<SourceEngineId, EngineRelease>>
  previous: Partial<Record<SourceEngineId, EngineRelease>>
  rejected: Partial<Record<SourceEngineId, string>>
}
let root: string | undefined
const verifiedWorkers = new Set<string>()
let bundles = ''
let ghostVersion = ''
let state: State = {
  automatic: true,
  enabled: { scrapling: true, obscura: false },
  installed: {},
  previous: {},
  rejected: {}
}
let releases: EngineRelease[] = []
const upstream: Partial<Record<SourceEngineId, string>> = {}
const messages: Partial<Record<SourceEngineId, string>> = {}
const active = new Set<SourceEngineId>()
let checking = false
let catalogError: string | undefined
let monitor: ReturnType<typeof setInterval> | undefined
let writes = Promise.resolve()
const pending = new Set<SourceEngineId>()
const idleWaiters = new Map<SourceEngineId, Set<() => void>>()
function releaseEngine(id: SourceEngineId) {
  active.delete(id)
  for (const wake of idleWaiters.get(id) || []) wake()
}
async function claimEngine(id: SourceEngineId) {
  const deadline = Date.now() + 5000
  while (active.has(id) && Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      const waiters = idleWaiters.get(id) || new Set<() => void>()
      idleWaiters.set(id, waiters)
      const wake = () => {
        clearTimeout(timer)
        waiters.delete(wake)
        resolve()
      }
      const timer = setTimeout(wake, Math.max(1, deadline - Date.now()))
      waiters.add(wake)
    })
  }
  if (active.has(id)) return false
  active.add(id)
  return true
}

function persist() {
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      if (!root) throw new Error('Motores ainda não inicializados.')
      await mkdir(root, { recursive: true })
      await writeFile(join(root, 'state.tmp'), JSON.stringify(state, null, 2))
      await rename(join(root, 'state.tmp'), join(root, 'state.json'))
    })
  return writes
}
function directory(release: EngineRelease) {
  return join(
    root!,
    release.id,
    `${release.version}-${release.sha256.slice(0, 12)}`
  )
}
function candidate(id: SourceEngineId) {
  return releases
    .filter((item) => item.id === id && state.rejected[id] !== item.sha256)
    .sort((a, b) =>
      gt(a.version, b.version)
        ? -1
        : gt(b.version, a.version)
          ? 1
          : (b.integrationRevision || 0) - (a.integrationRevision || 0)
    )[0]
}
export function sourceEnginesState(): SourceEnginesState {
  return {
    automatic: state.automatic,
    checkedAt: state.checkedAt,
    catalogError,
    engines: ids.map((id) => {
      const next = candidate(id)
      const installed = state.installed[id]
      const published = valid(upstream[id] || '')
      return {
        id,
        installed: state.installed[id]?.version,
        previous: state.previous[id]?.version,
        available: next?.version,
        upstream: upstream[id],
        updateAvailable: Boolean(
          installed &&
          next &&
          (gt(next.version, installed.version) ||
            (next.version === installed.version &&
              next.sha256 !== installed.sha256))
        ),
        upstreamUpdateAvailable: Boolean(
          published && installed && gt(published, installed.version)
        ),
        enabled: state.enabled[id],
        busy: active.has(id),
        message: messages[id]
      }
    })
  }
}
async function boundedDownload(url: string, limit: number, timeout = 30000) {
  let target = url
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(target)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      ![
        'github.com',
        'api.github.com',
        'release-assets.githubusercontent.com',
        'objects.githubusercontent.com'
      ].includes(parsed.hostname)
    )
      throw new Error('Servidor de atualização não autorizado.')
    const response = await secureFetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      headers: {
        Accept:
          parsed.hostname === 'api.github.com'
            ? 'application/vnd.github+json'
            : 'application/octet-stream'
      }
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Atualização sem destino.')
      target = new URL(location, target).href
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(
        `Servidor de atualização respondeu HTTP ${response.status}.`
      )
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Pacote vazio.')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const part = await reader.read()
      if (part.done) return Buffer.concat(chunks)
      size += part.value.length
      if (size > limit) {
        await reader.cancel()
        throw new Error('Pacote excedeu o tamanho permitido.')
      }
      chunks.push(part.value)
    }
  }
  throw new Error('Redirecionamentos demais na atualização.')
}
async function smoke(release: EngineRelease, folder: string) {
  verifiedWorkers.delete(release.sha256)
  const executable = join(folder, release.executable)
  const output = await engineProcess(
    executable,
    release.id === 'scrapling' ? ['--self-test'] : ['--version']
  )
  if (release.id === 'scrapling') {
    const parsed: unknown = JSON.parse(output)
    if (!parsed || typeof parsed !== 'object')
      throw new Error('O teste do Scrapling falhou.')
    const result = parsed as Record<string, unknown>
    if (
      result.protocol !== 1 ||
      result.version !== release.version ||
      result.ok !== true ||
      ((release.integrationRevision || 0) >= 3 &&
        (!Array.isArray(result.capabilities) ||
          !result.capabilities.includes('online-fix-torrent-links-v1'))) ||
      ((release.integrationRevision || 0) >= 4 &&
        (!Array.isArray(result.capabilities) ||
          !result.capabilities.includes('direct-download-page-v1'))) ||
      ((release.integrationRevision || 0) >= 5 &&
        (!Array.isArray(result.capabilities) ||
          !result.capabilities.includes('release-page-v1'))) ||
      ((release.integrationRevision || 0) >= 6 &&
        (!Array.isArray(result.capabilities) ||
          !result.capabilities.includes('direct-download-learning-v1')))
    )
      throw new Error('O teste do Scrapling falhou.')
  } else if (!output.includes(release.version))
    throw new Error('A versão do Obscura não corresponde ao pacote.')
  verifiedWorkers.add(release.sha256)
}
async function install(
  id: SourceEngineId,
  shared?: { release: EngineRelease; archive: Buffer }
) {
  if (!root) throw new Error('Motores ainda não inicializados.')
  const release = shared?.release || candidate(id)
  if (!release)
    throw new Error(
      'Ainda não há pacote aprovado para este sistema. Verifique as atualizações mais tarde.'
    )
  if (state.installed[id] && gt(state.installed[id].version, release.version))
    throw new Error(
      'A versão instalada é mais recente que o pacote disponível.'
    )
  if (
    shared &&
    state.installed[id]?.version === release.version &&
    (state.installed[id]?.integrationRevision || 0) >
      (release.integrationRevision || 0)
  )
    throw new Error(
      'A integração instalada é mais recente que o pacote compartilhado.'
    )
  if (active.has(id)) {
    if (shared)
      throw new Error(
        'Motor em uso. Aguarde e tente instalar o arquivo novamente.'
      )
    pending.add(id)
    messages[id] = 'Aguardando a operação atual terminar.'
    return
  }
  active.add(id)
  const staging = join(root, `.stage-${randomUUID()}`)
  try {
    if (state.installed[id]?.sha256 === release.sha256) {
      try {
        await smoke(release, directory(release))
        if (shared) {
          await cacheEngineArchive(release, shared.archive)
          const enabled = state.enabled[id]
          state.enabled[id] = true
          try {
            await persist()
          } catch (error) {
            state.enabled[id] = enabled
            throw error
          }
        }
        messages[id] = 'A versão instalada está íntegra.'
        return
      } catch {
        /* Reinstall a damaged worker from the verified archive. */
      }
    }
    messages[id] = 'Baixando e verificando atualização…'
    await mkdir(staging, { recursive: true })
    let archive: Buffer
    try {
      archive = shared?.archive || (await readEngineArchive(release))
    } catch {
      archive = await boundedDownload(release.url, engineArchiveLimit, 180000)
    }
    if (createHash('sha256').update(archive).digest('hex') !== release.sha256)
      throw new Error('O pacote não passou na verificação de integridade.')
    const zip = join(staging, 'package.zip')
    const content = join(staging, 'content')
    await writeFile(zip, archive)
    let size = 0
    await extractZip(zip, {
      dir: content,
      onEntry(entry) {
        size += entry.uncompressedSize
        if (
          size > 700 * 1024 * 1024 ||
          ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000
        )
          throw new Error('Conteúdo do pacote não permitido.')
      }
    })
    await smoke(release, content)
    if (release.id === 'obscura')
      await testObscuraCompatibility(join(content, release.executable))
    await cacheEngineArchive(release, archive)
    const destination = directory(release)
    await mkdir(join(root, id), { recursive: true })
    // A verified folder from an interrupted activation may be reused.
    try {
      await stat(destination)
      await smoke(release, destination)
    } catch {
      await rm(destination, { recursive: true, force: true })
      await engineFileOperation(() => rename(content, destination))
    }
    const old = state.installed[id]
    const oldPrevious = state.previous[id]
    const oldEnabled = state.enabled[id]
    if (old?.sha256 !== release.sha256) state.previous[id] = old
    state.installed[id] = release
    if (shared) state.enabled[id] = true
    try {
      await persist()
    } catch (error) {
      state.installed[id] = old
      state.previous[id] = oldPrevious
      state.enabled[id] = oldEnabled
      throw error
    }
    messages[id] = 'Motor atualizado e verificado.'
    if (
      oldPrevious &&
      oldPrevious.sha256 !== state.previous[id]?.sha256 &&
      oldPrevious.sha256 !== release.sha256
    ) {
      await rm(directory(oldPrevious), { recursive: true, force: true }).catch(
        () => {
          messages[id] =
            'Motor atualizado. Uma versão antiga será mantida porque estava em uso.'
        }
      )
    }
  } catch (error) {
    messages[id] =
      error instanceof Error
        ? error.message
        : 'Falha na atualização; versão anterior preservada.'
    throw error
  } finally {
    releaseEngine(id)
    await rm(staging, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    })
  }
}

async function readEngineArchive(release: EngineRelease): Promise<Buffer> {
  try {
    const archive = await readFile(
      join(root!, 'packages', `${release.sha256}.zip`)
    )
    if (createHash('sha256').update(archive).digest('hex') === release.sha256)
      return archive
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return readFile(join(bundles, `${release.sha256}.zip`))
}

async function cacheEngineArchive(release: EngineRelease, archive: Buffer) {
  await mkdir(join(root!, 'packages'), { recursive: true })
  const target = join(root!, 'packages', `${release.sha256}.zip`)
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, archive)
    await engineFileOperation(() => rename(temporary, target))
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function exportSourceEngine(
  id: SourceEngineId,
  outputPath: string
) {
  if (!root || !ids.includes(id) || !state.installed[id])
    throw new Error('Instale o motor antes de compartilhar.')
  if (!(await claimEngine(id)))
    throw new Error('Motor em uso. Aguarde e tente novamente.')
  const temporary = `${outputPath}.${randomUUID()}.tmp`
  try {
    const release = state.installed[id]
    await smoke(release, directory(release))
    let archive: Buffer
    try {
      archive = await readEngineArchive(release)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      archive = await boundedDownload(release.url, engineArchiveLimit, 180000)
    }
    if (createHash('sha256').update(archive).digest('hex') !== release.sha256)
      throw new Error(
        'O pacote não passou na verificação de integridade. Reinstale o motor antes de compartilhar.'
      )
    await cacheEngineArchive(release, archive)
    await writeFile(temporary, createSourceEnginePackage(release, archive))
    await engineFileOperation(() => rename(temporary, outputPath))
  } finally {
    releaseEngine(id)
    await rm(temporary, { force: true })
  }
}

export async function importSourceEngine(
  buffer: Buffer
): Promise<EngineRelease> {
  if (!root) throw new Error('Motores ainda não inicializados.')
  const { release: raw, archive } = readSourceEnginePackage(buffer)
  const release = validateEngineRelease(
    raw,
    ghostVersion,
    process.platform,
    process.arch
  )
  if (createHash('sha256').update(archive).digest('hex') !== release.sha256)
    throw new Error('O pacote não passou na verificação de integridade.')

  // Never let an arbitrary file self-approve a native executable or its command path.
  const matches = (trusted: EngineRelease | undefined) =>
    trusted !== undefined &&
    trusted.id === release.id &&
    trusted.version === release.version &&
    trusted.sha256 === release.sha256 &&
    trusted.executable === release.executable &&
    trusted.url === release.url &&
    trusted.minGhostVersion === release.minGhostVersion &&
    (trusted.integrationRevision || 0) === (release.integrationRevision || 0)
  let approved = [
    ...releases,
    ...Object.values(state.installed),
    ...Object.values(state.previous)
  ].some(matches)
  if (!approved) {
    try {
      const catalog = JSON.parse(
        (await boundedDownload(feed, 1024 * 1024)).toString()
      )
      approved =
        Array.isArray(catalog.releases) &&
        catalog.releases.some((item: EngineRelease) => {
          try {
            return matches(
              validateEngineRelease(
                item,
                ghostVersion,
                process.platform,
                process.arch
              )
            )
          } catch {
            return false
          }
        })
    } catch {
      if (release.id !== 'obscura')
        throw new Error(
          'Não foi possível confirmar este motor no catálogo oficial. Conecte-se à internet e tente novamente.'
        )
    }
  }
  if (!approved && release.id === 'obscura') {
    try {
      const metadata: unknown = JSON.parse(
        (
          await boundedDownload(
            `https://api.github.com/repos/h4ckf0r0day/obscura/releases/tags/${encodeURIComponent(`v${release.version}`)}`,
            1024 * 1024
          )
        ).toString()
      )
      approved = matches(officialObscuraRelease(metadata, ghostVersion))
    } catch {
      throw new Error(
        'Não foi possível confirmar o pacote na origem oficial do Obscura. Verifique a conexão e tente novamente.'
      )
    }
  }
  if (!approved)
    throw new Error(
      'Este pacote de motor não consta no catálogo aprovado. Atualize o Ghost ou peça um arquivo compatível.'
    )
  await install(release.id, { release, archive })
  messages[release.id] = 'Motor compartilhado instalado, testado e ativado.'
  return release
}
async function restore(id: SourceEngineId, alreadyActive = false) {
  if (active.has(id) && !alreadyActive)
    throw new Error('Aguarde a operação atual terminar.')
  const previous = state.previous[id]
  if (!previous) throw new Error('Não existe versão anterior disponível.')
  active.add(id)
  try {
    await smoke(previous, directory(previous))
    state.rejected[id] = state.installed[id]?.sha256
    state.installed[id] = previous
    delete state.previous[id]
    await persist()
    messages[id] = 'Versão anterior restaurada.'
  } finally {
    if (!alreadyActive) releaseEngine(id)
  }
}
async function verify(id: SourceEngineId) {
  const installed = state.installed[id]
  if (!installed) throw new Error('Este motor ainda não está instalado.')
  // Keep the existing repair path, without installing a different update.
  if (!active.has(id) && candidate(id)?.sha256 === installed.sha256)
    return install(id)
  if (!(await claimEngine(id)))
    throw new Error('Motor em uso. Aguarde e tente novamente.')
  try {
    await smoke(installed, directory(installed))
    messages[id] = 'A versão instalada está íntegra.'
  } catch (error) {
    messages[id] =
      'A instalação falhou na verificação. Reinstale ou restaure uma versão.'
    throw error
  } finally {
    releaseEngine(id)
  }
}
export async function checkSourceEngines(force = false) {
  if (
    !root ||
    checking ||
    (!force && Date.now() - (state.checkedAt || 0) < 86400000)
  )
    return
  checking = true
  try {
    try {
      const data = JSON.parse(
        (await boundedDownload(feed, 1024 * 1024)).toString()
      )
      const approved = (data.releases as EngineRelease[])
        .filter(
          (item) =>
            item.platform === process.platform && item.arch === process.arch
        )
        .map((item) =>
          validateEngineRelease(
            item,
            ghostVersion,
            process.platform,
            process.arch
          )
        )
      if (data.rules) {
        const rules = validateSourceRules(data.rules)
        await writeFile(join(root, 'rules.tmp'), JSON.stringify(rules))
        await rename(join(root, 'rules.tmp'), join(root, 'rules.json'))
        installSourceRules(rules)
      }
      releases = [
        ...approved,
        ...releases.filter(
          (old) =>
            !approved.some(
              (item) =>
                item.id === old.id &&
                item.version === old.version &&
                (item.integrationRevision || 0) >=
                  (old.integrationRevision || 0)
            )
        )
      ]
      catalogError = undefined
    } catch (error) {
      catalogError =
        `Catálogo do Ghost indisponível. Pacotes locais e versões instaladas preservados; o Obscura também é consultado na origem oficial. ${error instanceof Error ? error.message : ''}`.trim()
    }
    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await boundedDownload(
            `https://api.github.com/repos/${repositories[id]}/releases/latest`,
            1024 * 1024
          )
          const metadata: unknown = JSON.parse(response.toString())
          if (
            metadata &&
            typeof metadata === 'object' &&
            'tag_name' in metadata &&
            typeof metadata.tag_name === 'string'
          ) {
            upstream[id] = metadata.tag_name.replace(/^v/, '')
          }
          if (id === 'obscura') {
            const release = officialObscuraRelease(metadata, ghostVersion)
            if (release) {
              await writeFile(
                join(root!, 'obscura-release.tmp'),
                JSON.stringify(release)
              )
              await engineFileOperation(() =>
                rename(
                  join(root!, 'obscura-release.tmp'),
                  join(root!, 'obscura-release.json')
                )
              )
              releases = [
                ...releases.filter(
                  (item) =>
                    item.id !== 'obscura' || item.sha256 !== release.sha256
                ),
                release
              ]
            }
          }
        } catch {
          /* Keep the installed/local packages when official metadata is unavailable. */
        }
      })
    )
    state.checkedAt = Date.now()
    await persist()
    if (state.automatic)
      for (const id of ids) {
        const next = candidate(id)
        if (
          state.enabled[id] &&
          next &&
          (!state.installed[id] ||
            gt(next.version, state.installed[id].version) ||
            (next.version === state.installed[id].version &&
              next.sha256 !== state.installed[id].sha256))
        ) {
          try {
            await install(id)
          } catch {
            /* install retains the visible diagnostic. */
          }
        }
      }
  } finally {
    checking = false
  }
}
export async function initializeSourceEngines(
  dataRoot: string,
  bundleRoot: string,
  version: string,
  options: { deferVerification?: boolean } = {}
) {
  verifiedWorkers.clear()
  root = resolve(dataRoot, 'source-engines')
  await mkdir(root, { recursive: true })
  bundles = bundleRoot
  ghostVersion = version
  catalogError = undefined
  for (const id of ids) {
    delete upstream[id]
    delete messages[id]
  }
  state = {
    automatic: true,
    enabled: { scrapling: true, obscura: false },
    installed: {},
    previous: {},
    rejected: {}
  }
  try {
    state = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new Error('Não foi possível ler as configurações dos motores.')
  }
  for (const id of ids) {
    for (const entry of [state.installed[id], state.previous[id]])
      if (entry)
        validateEngineRelease(entry, version, process.platform, process.arch)
  }
  try {
    const catalog = JSON.parse(
      await readFile(join(bundles, 'catalog.json'), 'utf8')
    )
    if (catalog.rules) installSourceRules(catalog.rules)
    releases = catalog.releases
      .filter(
        (item: EngineRelease) =>
          item.platform === process.platform && item.arch === process.arch
      )
      .map((item: EngineRelease) =>
        validateEngineRelease(item, version, process.platform, process.arch)
      )
  } catch {
    releases = []
  }
  try {
    const cached = validateEngineRelease(
      JSON.parse(await readFile(join(root, 'obscura-release.json'), 'utf8')),
      version,
      process.platform,
      process.arch
    )
    if (cached.id === 'obscura') releases.push(cached)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      catalogError =
        'Não foi possível ler o pacote de atualização salvo. Use Verificar atualizações para consultar novamente.'
  }
  try {
    installSourceRules(
      JSON.parse(await readFile(join(root, 'rules.json'), 'utf8'))
    )
  } catch {
    /* Bundled rules remain active. */
  }
  // Verify the installed worker before use; recover without touching sessions or games.
  for (const id of options.deferVerification ? [] : ids)
    if (state.installed[id]) {
      try {
        await smoke(state.installed[id], directory(state.installed[id]))
      } catch {
        try {
          await restore(id)
        } catch {
          state.enabled[id] = false
          messages[id] = 'Motor indisponível. Reinstale ou restaure uma versão.'
        }
      }
    }
  const timer = setTimeout(
    () => void checkSourceEngines().catch(() => undefined),
    30000
  )
  timer.unref()
  if (!monitor) {
    monitor = setInterval(
      () => void checkSourceEngines().catch(() => undefined),
      3600000
    )
    monitor.unref()
  }
}
export async function sourceEngineAction(action: SourceEngineAction) {
  if (action.type === 'automatic') {
    state.automatic = Boolean(action.enabled)
    await persist()
  } else if (action.type === 'check') await checkSourceEngines(true)
  else {
    if (!ids.includes(action.id)) throw new Error('Motor desconhecido.')
    if (action.type === 'enable') {
      state.enabled[action.id] = Boolean(action.enabled)
      await persist()
    } else if (action.type === 'install') await install(action.id)
    else if (action.type === 'verify') await verify(action.id)
    else if (action.type === 'restore') await restore(action.id)
    else throw new Error('Ação desconhecida.')
  }
  return sourceEnginesState()
}
export async function withSourceEngine<T>(
  id: SourceEngineId,
  run: (executable: string, data: string) => Promise<T>
): Promise<T | undefined> {
  if (
    !root ||
    !state.installed[id] ||
    !state.enabled[id] ||
    !(await claimEngine(id))
  )
    return undefined
  const release = state.installed[id]
  try {
    // Startup can load engine metadata without spawning browsers/workers.
    // The first actual use still verifies the installed executable under its lock.
    if (!verifiedWorkers.has(release.sha256))
      await smoke(release, directory(release))
    const data = join(root, id, 'data')
    await mkdir(data, { recursive: true })
    return await run(join(directory(release), release.executable), data)
  } catch (error) {
    messages[id] =
      'A operação do motor falhou. O navegador padrão continua disponível.'
    // A website failure must not roll back a healthy motor. A failed self-test does.
    try {
      await smoke(release, directory(release))
    } catch {
      try {
        await restore(id, true)
      } catch {
        state.enabled[id] = false
        await persist()
      }
    }
    throw error
  } finally {
    releaseEngine(id)
    if (pending.delete(id)) void install(id).catch(() => undefined)
  }
}
