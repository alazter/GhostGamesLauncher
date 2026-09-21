import type { DownloadItem } from 'electron'

export interface DirectDownloadDiagnostic {
  event: string
  host: string
  bytes: number
  total: number
  canResume: boolean
  attempts: number
  at: string
}

/** A transient DownloadItem update is not a terminal download failure. */
export function directDownloadRecovery(
  item: DownloadItem,
  fail: (error: Error) => void,
  report: (diagnostic: DirectDownloadDiagnostic) => void
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  let closed = false
  let recovering = false
  const delays = [2000, 5000, 10000, 20000, 30000]
  const diagnostic = (event: string) => {
    let host = ''
    try {
      host = new URL(item.getURL()).hostname
    } catch {
      /* no URL in diagnostics */
    }
    report({
      event,
      host,
      bytes: item.getReceivedBytes(),
      total: item.getTotalBytes(),
      canResume: item.canResume(),
      attempts,
      at: new Date().toISOString()
    })
  }
  const stop = () => {
    closed = true
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  return {
    updated(state: string) {
      if (closed) return
      if (state !== 'interrupted') {
        if (recovering) {
          recovering = false
          if (timer) clearTimeout(timer)
          timer = undefined
          diagnostic('recovered')
        }
        return
      }
      if (timer) return
      recovering = true
      diagnostic('interrupted')
      if (!item.canResume() || attempts >= delays.length) {
        stop()
        fail(
          new Error(
            'A transferência foi interrompida e não pôde continuar automaticamente. Use Retomar para confirmar um novo link no site; a transferência será reiniciada. A causa da interrupção não foi informada pelo navegador.'
          )
        )
        return
      }
      const delay = delays[attempts++]
      diagnostic('retry-scheduled')
      timer = setTimeout(() => {
        timer = undefined
        if (closed) return
        try {
          // Chromium may have recovered on its own while we were waiting.
          if (item.getState() !== 'interrupted') return
          if (!item.canResume()) {
            stop()
            fail(
              new Error(
                'O download não permite mais continuar. Use Retomar para obter um novo link; a transferência será reiniciada.'
              )
            )
            return
          }
          diagnostic('resuming')
          item.resume()
        } catch {
          stop()
          fail(
            new Error(
              'Não foi possível recuperar a transferência. Use Retomar para confirmar um novo link no site.'
            )
          )
        }
      }, delay)
    },
    done(state: string) {
      if (!closed) diagnostic(`done-${state}`)
      stop()
    },
    stop
  }
}
