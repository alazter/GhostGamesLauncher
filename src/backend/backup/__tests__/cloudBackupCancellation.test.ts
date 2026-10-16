import { uploadBackupToCloud } from '../cloudBackup'
import { configStore } from '../../constants/key_value_stores'
jest.mock('../../logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  LogPrefix: { Backend: 'Backend' }
}))
jest.mock('../../constants/key_value_stores', () => ({
  configStore: { get: jest.fn(), set: jest.fn(), delete: jest.fn() }
}))
jest.mock('electron', () => ({
  app: {},
  shell: {},
  safeStorage: {
    isEncryptionAvailable: () => true,
    decryptString: () =>
      JSON.stringify({
        access_token: 'test-access',
        expires_at: Date.now() + 3600000
      })
  }
}))

beforeEach(() => {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ files: [], id: 'new-backup' }))
    )
})
afterEach(() => jest.restoreAllMocks())
function provider(name: string) {
  jest
    .mocked(configStore.get)
    .mockImplementation((key: string) =>
      key === 'cloud_provider'
        ? name
        : key === 'cloud_tokens_secure'
          ? 'fixture'
          : undefined
    )
}

it.each(['google', 'dropbox', 'onedrive'])(
  'passes the shutdown signal through the %s upload',
  async (name) => {
    provider(name)
    // Google has two separate JSON responses (listing and upload).
    jest
      .mocked(fetch)
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ files: [], id: 'new-backup' }))
      )
    const controller = new AbortController()
    expect(
      await uploadBackupToCloud({ fixture: true }, controller.signal)
    ).toEqual({ success: true })
    for (const [, options] of jest.mocked(fetch).mock.calls)
      expect(options?.signal).toBe(controller.signal)
  }
)

it('does not start an upload after the shutdown deadline', async () => {
  provider('google')
  const controller = new AbortController()
  controller.abort()
  expect((await uploadBackupToCloud({}, controller.signal)).success).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
  expect(configStore.set).toHaveBeenCalledWith(
    'backup.lastError',
    expect.any(String)
  )
})

it('does not upload or delete previous backups after cancellation during listing', async () => {
  provider('google')
  const controller = new AbortController()
  jest.mocked(fetch).mockImplementation(async () => {
    controller.abort()
    throw new Error('aborted')
  })
  expect((await uploadBackupToCloud({}, controller.signal)).success).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(configStore.set).not.toHaveBeenCalledWith(
    'backup.lastSuccess',
    expect.any(Number)
  )
})

it('does not mark a late upload response as a successful shutdown backup', async () => {
  provider('dropbox')
  const controller = new AbortController()
  jest.mocked(fetch).mockImplementation(async () => {
    controller.abort()
    return new Response(null, { status: 200 })
  })
  expect((await uploadBackupToCloud({}, controller.signal)).success).toBe(false)
  expect(configStore.set).not.toHaveBeenCalledWith('backup.lastSuccess', expect.any(Number))
})
