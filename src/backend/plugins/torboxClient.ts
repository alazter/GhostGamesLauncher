import { safeStorage } from 'electron'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { userDataPath } from 'backend/constants/paths'
import { TORBOX_DOWNLOAD_DOMAINS } from './torboxDomains'

export interface TorboxTorrent {
  id: number
  hash: string
  progress: number
  download_state: string
  download_finished: boolean
  download_present: boolean
  files: Array<{ id: number; name: string; size: number }>
}
const apiBase = 'https://api.torbox.app/v1/api/'
const keyPath = () => join(userDataPath, 'external-games', 'torbox.key')

export class TorboxRejectedError extends Error {}

export class TorboxClient {
  constructor(private readonly key: string) {}

  static async configured(): Promise<boolean> {
    return readFile(keyPath()).then(
      () => true,
      () => false
    )
  }
  static async saved(): Promise<TorboxClient> {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('O armazenamento seguro do sistema está indisponível.')
    try {
      return new TorboxClient(
        safeStorage.decryptString(await readFile(keyPath()))
      )
    } catch {
      throw new Error(
        'Conecte o TorBox em Configurações → Integrações de downloads.'
      )
    }
  }
  static async save(key: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('Não é possível salvar a chave sem armazenamento seguro.')
    if (!key.trim() || key.length > 1024 || /[\r\n]/.test(key))
      throw new Error('Informe uma chave válida do TorBox.')
    await new TorboxClient(key.trim()).test()
    await mkdir(join(userDataPath, 'external-games'), { recursive: true })
    await writeFile(`${keyPath()}.tmp`, safeStorage.encryptString(key.trim()), {
      mode: 0o600
    })
    await rename(`${keyPath()}.tmp`, keyPath())
  }
  static async disconnect(): Promise<void> {
    await rm(keyPath(), { force: true })
  }

  private async request<T>(
    path: string,
    signal?: AbortSignal,
    body?: FormData
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${apiBase}${path}`, {
        method: body ? 'POST' : 'GET',
        body,
        redirect: 'error',
        headers: { Authorization: `Bearer ${this.key}` },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000)
      })
    } catch {
      signal?.throwIfAborted()
      throw new Error('Não foi possível conectar ao TorBox. Tente novamente.')
    }
    if (response.status === 401 || response.status === 403)
      throw new TorboxRejectedError(
        'TorBox: chave inválida ou conta sem acesso a este recurso.'
      )
    if (response.status === 429)
      throw new TorboxRejectedError(
        'Limite de consultas do TorBox atingido. Aguarde antes de continuar.'
      )
    if (!response.ok)
      throw new Error(`TorBox indisponível (HTTP ${response.status}).`)
    let result: { success?: boolean; data: T }
    try {
      const parsed: unknown = await response.json()
      if (!parsed || typeof parsed !== 'object' || !('success' in parsed))
        throw new Error('Invalid response')
      result = parsed as { success?: boolean; data: T }
    } catch {
      throw new Error('O TorBox retornou uma resposta inválida.')
    }
    // Never propagate the server's free-form detail or URL: it may contain a token.
    if (result.success !== true)
      throw new TorboxRejectedError(
        'O TorBox recusou a operação. Confira os limites e o estado da conta.'
      )
    return result.data
  }
  async test(): Promise<void> {
    await this.request('user/me')
  }
  async list(signal?: AbortSignal, id?: number): Promise<TorboxTorrent[]> {
    const data = await this.request<TorboxTorrent[] | TorboxTorrent | null>(
      `torrents/mylist?bypass_cache=true${id === undefined ? '' : `&id=${id}`}`,
      signal
    )
    const rows = Array.isArray(data)
      ? data
      : id !== undefined
        ? data
          ? [data]
          : []
        : undefined
    if (!rows) throw new Error('Lista de torrents inválida.')
    return rows.map((row) => {
      if (
        !row ||
        !/^\d+$/.test(String(row.id)) ||
        !Number.isSafeInteger(Number(row.id))
      )
        throw new Error(
          'Identificador de torrent inválido na resposta do TorBox.'
        )
      return {
        ...row,
        id: Number(row.id),
        files: row.files?.map((file) => ({
          ...file,
          id: /^\d+$/.test(String(file.id)) ? Number(file.id) : NaN
        }))
      }
    })
  }
  async create(torrent: Buffer, signal: AbortSignal): Promise<number> {
    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(torrent)], { type: 'application/x-bittorrent' }),
      'game.torrent'
    )
    form.append('allow_zip', 'true')
    const data = await this.request<{ torrent_id: number }>(
      'torrents/createtorrent',
      signal,
      form
    )
    if (
      !data ||
      !/^\d+$/.test(String(data.torrent_id)) ||
      !Number.isSafeInteger(Number(data.torrent_id))
    )
      throw new Error('TorBox não confirmou o identificador do torrent.')
    return Number(data.torrent_id)
  }
  async link(
    id: number,
    signal: AbortSignal,
    fileId?: number
  ): Promise<string> {
    const query = new URLSearchParams({
      token: this.key,
      torrent_id: String(id),
      redirect: 'false'
    })
    if (fileId === undefined) query.set('zip_link', 'true')
    else query.set('file_id', String(fileId))
    const link = await this.request<string>(
      `torrents/requestdl?${query}`,
      signal
    )
    let url: URL
    try {
      url = new URL(link)
    } catch {
      throw new Error('TorBox retornou um link inválido.')
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !TORBOX_DOWNLOAD_DOMAINS.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      )
    )
      throw new Error(
        'O TorBox retornou um servidor de download não reconhecido.'
      )
    return url.href
  }
}
