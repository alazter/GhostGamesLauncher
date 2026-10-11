import { setTimeout as delay } from 'timers/promises'
import { validateLocalStorageSnapshot } from './localStorageSnapshot'

type Snapshot = Record<string, string>

/** Serialize snapshots and retry temporary Windows sharing failures. */
export function createBackupPreferenceSync(
  write: (snapshot: Snapshot) => void | Promise<void>,
  retryDelays = [100, 200, 400, 800, 1600]
): (input: unknown) => Promise<void> {
  let pending: Promise<void> = Promise.resolve()
  return (input) => {
    // Validate and copy before queuing; the caller cannot alter a pending snapshot.
    const snapshot = validateLocalStorageSnapshot(input)
    const operation = pending
      .catch(() => undefined)
      .then(async () => {
        for (let attempt = 0; ; attempt++) {
          try {
            // Run the setter again, merging with the latest settings on every retry.
            await write(snapshot)
            return
          } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code
            if (
              attempt >= retryDelays.length ||
              !['EPERM', 'EBUSY', 'EACCES'].includes(code || '')
            )
              throw error
            await delay(retryDelays[attempt])
          }
        }
      })
    pending = operation
    return operation
  }
}
