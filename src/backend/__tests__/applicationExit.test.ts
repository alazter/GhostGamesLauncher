import { createExitHandler } from '../applicationExit'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
function fixture(
  overrides: Partial<Parameters<typeof createExitHandler>[0]> = {}
) {
  const options = {
    confirm: jest.fn(async () => true),
    hide: jest.fn(),
    presence: jest.fn(async (_signal: AbortSignal) => undefined),
    backup: jest.fn(async (_signal: AbortSignal) => undefined),
    exit: jest.fn(),
    report: jest.fn(),
    ...overrides
  }
  return { ...options, request: createExitHandler(options) }
}

it('hides promptly and starts an enabled backup without waiting for GOG', async () => {
  const events: string[] = []
  const f = fixture({
    hide: () => {
      events.push('hidden')
    },
    presence: () => new Promise(() => undefined),
    backup: async () => {
      events.push('backup saved')
    },
    exit: () => {
      events.push('exit')
    }
  })
  const pending = f.request()
  await jest.advanceTimersByTimeAsync(0)
  expect(events).toEqual(['hidden', 'backup saved'])
  await jest.advanceTimersByTimeAsync(1500)
  await pending
  expect(events).toEqual(['hidden', 'backup saved', 'exit'])
  expect(f.report).toHaveBeenCalledWith('GOG presence', expect.any(Error))
  expect(jest.getTimerCount()).toBe(0)
})

it('aborts a stalled presence request and waits for the configured backup independently', async () => {
  let presenceSignal: AbortSignal | undefined
  let backupSignal: AbortSignal | undefined
  const f = fixture({
    presence: (signal) => {
      presenceSignal = signal
      return new Promise(() => undefined)
    },
    backup: (signal) => {
      backupSignal = signal
      return new Promise(() => undefined)
    }
  })
  const pending = f.request()
  await jest.advanceTimersByTimeAsync(1500)
  expect(presenceSignal?.aborted).toBe(true)
  expect(backupSignal?.aborted).toBe(false)
  expect(f.exit).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(13500)
  await pending
  expect(backupSignal?.aborted).toBe(true)
  expect(f.exit).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('coalesces repeated close clicks into one confirmation, presence request and backup', async () => {
  const f = fixture()
  const first = f.request(),
    second = f.request()
  expect(first).toBe(second)
  await first
  expect(f.confirm).toHaveBeenCalledTimes(1)
  expect(f.backup).toHaveBeenCalledTimes(1)
  expect(f.presence).toHaveBeenCalledTimes(1)
  expect(f.exit).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('preserves cancellation of pending-operation confirmation and permits a later close', async () => {
  const confirm = jest
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
  const f = fixture({ confirm })
  await f.request()
  expect(f.hide).not.toHaveBeenCalled()
  expect(f.backup).not.toHaveBeenCalled()
  expect(f.exit).not.toHaveBeenCalled()
  await f.request()
  expect(f.exit).toHaveBeenCalledTimes(1)
})

it('exits immediately after fast cleanup and records backup failures without hanging', async () => {
  const f = fixture({
    backup: async () => {
      throw new Error('offline')
    }
  })
  await f.request()
  expect(f.report).toHaveBeenCalledWith('Cloud backup', expect.any(Error))
  expect(f.exit).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})
