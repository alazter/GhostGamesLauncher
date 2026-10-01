import { setTimeout as delay } from 'timers/promises'

// Windows may retain the just-executed image briefly after the process closes.
// Retry only sharing/access failures; never hide missing paths or disk errors.
export async function engineFileOperation<T>(
  operation: () => Promise<T>,
  delays = [100, 200, 400, 800, 1600]
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (
        attempt >= delays.length ||
        !['EPERM', 'EBUSY', 'EACCES'].includes(
          (error as NodeJS.ErrnoException).code || ''
        )
      )
        throw error
      await delay(delays[attempt])
    }
  }
}
