import { installSourceRules, validateSourceRules } from './sourceRules'
import { mkdir, readFile, writeFile, rename, rm, stat } from 'fs/promises'
import { join, resolve } from 'path'
import { createHash, randomUUID } from 'crypto'
import extractZip from 'extract-zip'
import { gt } from 'semver'
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
      gt(a.version, b.version) ? -1 : gt(b.version, a.version) ? 1 : 0
    )[0]
}
export function sourceEnginesState(): SourceEnginesState {
  return {
    automatic: state.automatic,
    checkedAt: state.checkedAt,
    engines: ids.map((id) => ({
      id,
      installed: state.installed[id]?.version,
      previous: state.previous[id]?.version,
      available: candidate(id)?.version,
      upstream: upstream[id],
      enabled: state.enabled[id],
      busy: active.has(id),
      message: messages[id]
    }))
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
  const executable = join(folder, release.executable)
  const output = await engineProcess(
    executable,
    release.id === 'scrapling' ? ['--self-test'] : ['--version']
  )
  if (release.id === 'scrapling') {
    const result = JSON.parse(output)
    if (
      result.protocol !== 1 ||
      result.version !== release.version ||
      result.ok !== true
    )
      throw new Error('O teste do Scrapling falhou.')
  } else if (!output.includes(release.version))
    throw new Error('A versão do Obscura não corresponde ao pacote.')
}
async function install(id: SourceEngineId) {
  if (!root) throw new Error('Motores ainda não inicializados.')
  const release = candidate(id)
  if (!release)
    throw new Error(
      'Ainda não há pacote aprovado para este sistema. Verifique as atualizações mais tarde.'
    )
  if (active.has(id)) {
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
      archive = await readFile(join(bundles, `${release.sha256}.zip`))
    } catch {
      archive = await boundedDownload(release.url, 250 * 1024 * 1024, 180000)
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
    if (old?.sha256 !== release.sha256) state.previous[id] = old
    state.installed[id] = release
    try {
      await persist()
    } catch (error) {
      state.installed[id] = old
      state.previous[id] = oldPrevious
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
        await writeFile(join(root!, 'rules.tmp'), JSON.stringify(rules))
        await rename(join(root!, 'rules.tmp'), join(root!, 'rules.json'))
        installSourceRules(rules)
      }
      releases = [
        ...approved,
        ...releases.filter(
          (old) =>
            !approved.some(
              (item) => item.id === old.id && item.version === old.version
            )
        )
      ]
    } catch {
      for (const id of ids)
        messages[id] =
          'Catálogo remoto indisponível; pacotes locais e versão instalada preservados.'
    }
    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await boundedDownload(
            `https://api.github.com/repos/${repositories[id]}/releases/latest`,
            1024 * 1024
          )
          upstream[id] = JSON.parse(response.toString()).tag_name
        } catch {
          /* The approved feed, not upstream availability, decides activation. */
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
            gt(next.version, state.installed[id]!.version) ||
            (next.version === state.installed[id]!.version &&
              next.sha256 !== state.installed[id]!.sha256))
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
  version: string
) {
  root = resolve(dataRoot, 'source-engines')
  await mkdir(root, { recursive: true })
  bundles = bundleRoot
  ghostVersion = version
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
    installSourceRules(
      JSON.parse(await readFile(join(root, 'rules.json'), 'utf8'))
    )
  } catch {
    /* Bundled rules remain active. */
  }
  // Verify the installed worker before use; recover without touching sessions or games.
  for (const id of ids)
    if (state.installed[id]) {
      try {
        await smoke(state.installed[id]!, directory(state.installed[id]!))
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
  const release = state.installed[id]!
  try {
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
