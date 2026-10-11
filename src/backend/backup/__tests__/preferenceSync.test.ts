import Store from 'electron-store'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createBackupPreferenceSync } from '../preferenceSync'

const sharingError = (code: string) =>
  Object.assign(new Error('Temporary file sharing failure'), { code })

type TestSettings = {
  language: string
  localStorageBackup: Record<string, string>
}

describe('backup preference synchronization', () => {
  it.each(['EPERM', 'EBUSY', 'EACCES'])(
    'retries %s and resolves only after the write succeeds',
    async (code) => {
      const write = jest
        .fn()
        .mockRejectedValueOnce(sharingError(code))
        .mockRejectedValueOnce(sharingError(code))
        .mockResolvedValue(undefined)
      const sync = createBackupPreferenceSync(write, [0, 0])
      const snapshot = { heroic_custom_bg: 'background.png' }

      await expect(sync(snapshot)).resolves.toBeUndefined()
      expect(write).toHaveBeenCalledTimes(3)
      expect(write).toHaveBeenLastCalledWith(snapshot)
    }
  )

  it('limits retries and continues processing the queue after a failed write', async () => {
    const error = sharingError('EPERM')
    const write = jest.fn().mockRejectedValue(error)
    const sync = createBackupPreferenceSync(write, [0, 0])
    await expect(sync({ heroic_custom_bg: 'first' })).rejects.toBe(error)
    expect(write).toHaveBeenCalledTimes(3)

    write.mockResolvedValue(undefined)
    await expect(sync({ heroic_custom_bg: 'second' })).resolves.toBeUndefined()
    expect(write).toHaveBeenCalledTimes(4)
    expect(write).toHaveBeenLastCalledWith({ heroic_custom_bg: 'second' })
  })

  it.each(['ENOSPC', 'EIO'])(
    'reports %s without treating it as a temporary sharing failure',
    async (code) => {
      const error = sharingError(code)
      const write = jest.fn().mockRejectedValue(error)
      const sync = createBackupPreferenceSync(write, [0, 0])
      await expect(sync({ heroic_custom_bg: 'background' })).rejects.toBe(error)
      expect(write).toHaveBeenCalledTimes(1)
    }
  )

  it('keeps concurrent snapshots in order while a previous write is awaiting completion', async () => {
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const saved: string[] = []
    const write = jest.fn(async (snapshot: Record<string, string>) => {
      if (snapshot.heroic_custom_bg === 'first') await blocked
      saved.push(snapshot.heroic_custom_bg)
    })
    const sync = createBackupPreferenceSync(write, [0])
    const first = sync({ heroic_custom_bg: 'first' })
    const second = sync({ heroic_custom_bg: 'second' })
    await Promise.resolve()
    await Promise.resolve()
    expect(write).toHaveBeenCalledTimes(1)
    expect(saved).toEqual([])
    release()
    await Promise.all([first, second])
    expect(saved).toEqual(['first', 'second'])
  })

  it('copies validated data before queuing and excludes website sessions', async () => {
    const write = jest.fn()
    const sync = createBackupPreferenceSync(write)
    const input = { heroic_custom_bg: 'original', auth_token: 'private' }
    const pending = sync(input)
    input.heroic_custom_bg = 'modified'
    await pending
    expect(write).toHaveBeenCalledWith({ heroic_custom_bg: 'original' })
  })

  it('rejects invalid snapshots before attempting a write', () => {
    const write = jest.fn()
    const sync = createBackupPreferenceSync(write)
    expect(() => sync(null)).toThrow('Dados de backup inválidos')
    expect(() => sync({ heroic_custom_bg: 42 })).toThrow()
    expect(write).not.toHaveBeenCalled()
  })

  it('preserves stored preferences on failure and merges current settings on retry', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ghost-backup-sync-'))
    try {
      const store = new Store<{ settings: TestSettings }>({
        cwd: directory,
        name: 'config'
      })
      store.set('settings', {
        language: 'pt',
        localStorageBackup: { heroic_custom_bg: 'old' }
      })
      let attempts = 0
      const sync = createBackupPreferenceSync(
        (snapshot) => {
          if (attempts++ === 0) {
            const disk = JSON.parse(readFileSync(store.path, 'utf8')) as {
              settings: TestSettings
            }
            expect(disk.settings.localStorageBackup.heroic_custom_bg).toBe(
              'old'
            )
            // Another setting is changed while the snapshot is waiting to retry.
            store.set('settings.language', 'en')
            throw sharingError('EPERM')
          }
          store.set('settings', {
            ...store.get('settings'),
            localStorageBackup: snapshot
          })
        },
        [0]
      )

      const first = sync({ heroic_custom_bg: 'first' })
      const second = sync({ heroic_custom_bg: 'latest' })
      await Promise.all([first, second])
      const disk = JSON.parse(readFileSync(store.path, 'utf8')) as {
        settings: TestSettings
      }
      expect(disk.settings).toEqual({
        language: 'en',
        localStorageBackup: { heroic_custom_bg: 'latest' }
      })
      expect(attempts).toBe(3)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
