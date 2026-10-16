interface ExitOptions {
  confirm: () => Promise<boolean>
  hide: () => void
  presence: (signal: AbortSignal) => Promise<unknown>
  backup: (signal: AbortSignal) => Promise<unknown>
  exit: () => void
  report: (task: string, error: unknown) => void
  presenceTimeout?: number
  backupTimeout?: number
}

async function boundedExitTask(
  run: (signal: AbortSignal) => Promise<unknown>,
  timeout: number
) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve().then(() => run(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('Tempo limite de encerramento atingido.'))
        }, timeout)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** One confirmation/backup per exit, with independent network deadlines. */
export function createExitHandler(options: ExitOptions): () => Promise<void> {
  let pending: Promise<void> | undefined
  return () => {
    if (!pending) {
      pending = (async () => {
        if (!(await options.confirm())) return
        options.hide()
        try {
          await Promise.all([
            boundedExitTask(
              options.presence,
              options.presenceTimeout ?? 1500
            ).catch((error) => options.report('GOG presence', error)),
            boundedExitTask(
              options.backup,
              options.backupTimeout ?? 15000
            ).catch((error) => options.report('Cloud backup', error))
          ])
        } finally {
          options.exit()
        }
      })().finally(() => {
        pending = undefined
      })
    }
    return pending
  }
}
