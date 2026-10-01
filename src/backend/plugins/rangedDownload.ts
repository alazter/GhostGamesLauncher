import { open, rm, statfs } from 'fs/promises'
import { dirname } from 'path'
import { setTimeout as delay } from 'timers/promises'

type FetchRange = (
  headers: Record<string, string>,
  signal: AbortSignal
) => Promise<Response>

/** A bounded, validated range transfer. Never combine different file revisions. */
export async function rangedDownload(options: {
  destination: string
  total: number
  etag: string
  signal: AbortSignal
  fetch: FetchRange
  progress: (bytes: number) => void
  event: (name: string) => void
  /** Retain only the verified contiguous prefix on interruption (TorBox). */
  resumeFrom?: number
}): Promise<boolean> {
  const { destination, total, etag, signal } = options
  const offset = options.resumeFrom ?? 0
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= total) return false
  const event = (name: string) => {
    try { options.event(name) } catch { /* Telemetry must not restart a transfer. */ }
  }
  if (
    !Number.isSafeInteger(total) ||
    total < 32 * 1024 * 1024 ||
    !/^"[^\r\n]+"$/.test(etag)
  )
    return false
  const controller = new AbortController()
  const stopped = AbortSignal.any([signal, controller.signal])
  const request = async (start: number, end: number, timeoutMs = 45000) => {
    const timeout = AbortSignal.timeout(timeoutMs)
    const response = await options.fetch(
      {
        Range: `bytes=${start}-${end}`,
        'If-Range': etag,
        'Accept-Encoding': 'identity'
      },
      AbortSignal.any([stopped, timeout])
    )
    if (
      response.status !== 206 ||
      response.headers.get('content-range') !==
        `bytes ${start}-${end}/${total}` ||
      response.headers.get('etag') !== etag ||
      !response.body ||
      ![null, 'identity'].includes(response.headers.get('content-encoding'))
    ) {
      await response.body?.cancel()
      throw new Error(
        'O servidor não confirmou as partes da mesma versão do arquivo.'
      )
    }
    return response
  }
  // A one-byte probe avoids downloading a whole package when Range is ignored.
  try {
    const probe = await request(0, 0, 5000)
    await probe.body!.cancel()
  } catch {
    signal.throwIfAborted()
    return false
  }
  const disk = await statfs(dirname(destination))
  if (disk.bavail * disk.bsize < total - offset) return false
  const file = await open(destination, options.resumeFrom === undefined ? 'wx' : offset ? 'r+' : 'w+')
  if (offset && (await file.stat()).size !== offset) {
    await file.close()
    throw new Error('O tamanho do arquivo parcial mudou. Tente retomar novamente.')
  }
  let success = false
  let next = offset
  let completed = offset
  let contiguous = offset
  const finished = new Map<number, number>()
  let reduced = false
  const pending = new Map<number, number>()
  const report = () =>
    options.progress(
      completed + [...pending.values()].reduce((a, b) => a + b, 0)
    )
  event('ranged-started')
  const worker = async (id: number) => {
    while (next < total && (!reduced || id === 0)) {
      stopped.throwIfAborted()
      const start = next
      const end = Math.min(total - 1, start + 8 * 1024 * 1024 - 1)
      next = end + 1
      const size = end - start + 1
      for (let attempt = 0; ; attempt++) {
        pending.set(start, 0)
        try {
          const response = await request(start, end)
          const reader = response.body!.getReader()
          const buffer = Buffer.allocUnsafe(size)
          let received = 0
          try {
            while (true) {
              const result = await reader.read()
              if (result.done) break
              if (received + result.value.length > size)
                throw new Error('Parte maior que o esperado.')
              buffer.set(result.value, received)
              received += result.value.length
              pending.set(start, received)
              report()
            }
          } finally {
            await reader.cancel().catch(() => undefined)
          }
          if (received !== size)
            throw new Error('Parte interrompida antes de concluir.')
          let written = 0
          while (written < size) {
            const result = await file.write(
              buffer,
              written,
              size - written,
              start + written
            )
            if (!result.bytesWritten)
              throw new Error('Falha ao gravar o pacote.')
            written += result.bytesWritten
          }
          completed += size
          finished.set(start, end + 1)
          while (finished.has(contiguous)) {
            const previous = contiguous
            contiguous = finished.get(previous)!
            finished.delete(previous)
          }
          pending.delete(start)
          report()
          break
        } catch (error) {
          stopped.throwIfAborted()
          if (
            attempt >= 2 ||
            (error as NodeJS.ErrnoException).code === 'ENOSPC'
          )
            throw error
          reduced = true
          event('ranged-retry-single-connection')
          pending.set(start, 0)
          await delay(1000 * (attempt + 1), undefined, { signal: stopped })
        }
      }
    }
  }
  try {
    const workers = Array.from({ length: 4 }, (_, id) =>
      worker(id).catch((error) => {
        controller.abort()
        throw error
      })
    )
    const results = await Promise.allSettled(workers)
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    if (completed !== total) throw new Error('O pacote não foi concluído.')
    await file.sync()
    success = true
    event('ranged-completed')
    return true
  } finally {
    try {
      if (!success && options.resumeFrom !== undefined) await file.truncate(contiguous)
    } finally { await file.close() }
    if (!success && options.resumeFrom === undefined) await rm(destination, { force: true })
  }
}
