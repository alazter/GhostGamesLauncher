import { mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import { deflateSync } from 'zlib'
import {
  decodeStremioWatchedBitfield,
  StremioLibraryService,
  toCalendarDateKey
} from '../stremioLibraryService'

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => os.tmpdir())
  },
  net: {
    fetch: jest.fn()
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => false),
    encryptString: jest.fn((s: string) => Buffer.from(s)),
    decryptString: jest.fn((b: Buffer) => b.toString('utf-8'))
  }
}))

jest.mock('backend/logger', () => ({
  logInfo: jest.fn(),
  logWarning: jest.fn(),
  logError: jest.fn(),
  LogPrefix: { Backend: 'Backend' }
}))

describe('StremioLibraryService', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ghost-stremio-lib-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('extracts exact YYYY-MM-DD calendar date keys without UTC timezone drift', () => {
    expect(toCalendarDateKey('2026-11-06T00:00:00.000Z')).toBe('2026-11-06')
    expect(toCalendarDateKey('2026-11-20T23:30:00Z')).toBe('2026-11-20')
    expect(toCalendarDateKey('invalid-date')).toBeNull()
  })

  it('decodes Stremio zlib-compressed watched bitfields accurately', () => {
    const videoIds = ['tt1:1:1', 'tt1:1:2', 'tt1:1:3', 'tt1:1:4', 'tt1:1:5']
    // Bits 0, 1, 2 set (0b00000111 = 7)
    const compressed = deflateSync(Buffer.from([0b00000111])).toString('base64')
    const watchedStr = `tt1:1:3:3:${compressed}`

    const decoded = decodeStremioWatchedBitfield(watchedStr, videoIds)
    expect(decoded.has('tt1:1:1')).toBe(true)
    expect(decoded.has('tt1:1:2')).toBe(true)
    expect(decoded.has('tt1:1:3')).toBe(true)
    expect(decoded.has('tt1:1:4')).toBe(false)
    expect(decoded.has('tt1:1:5')).toBe(false)
  })

  it('persists library CRUD, watched toggles, and playback progress atomically', () => {
    const svc = new StremioLibraryService({ dataDir: tmpDir })

    let lib = svc.upsertLibraryItem({
      id: 'tt1375666',
      type: 'movie',
      name: 'Inception',
      poster: 'https://example.com/inception.jpg'
    })
    expect(lib).toHaveLength(1)
    expect(lib[0].name).toBe('Inception')
    expect(lib[0].isWatched).toBe(false)

    lib = svc.saveProgress({
      id: 'tt1375666',
      progressSeconds: 1800,
      durationSeconds: 7200
    })
    expect(lib[0].progressSeconds).toBe(1800)
    expect(lib[0].durationSeconds).toBe(7200)
    expect(lib[0].isWatched).toBe(false)

    lib = svc.toggleWatched('tt1375666', true)
    expect(lib[0].isWatched).toBe(true)

    // Re-instantiate service from disk to verify atomic persistence
    const reloaded = new StremioLibraryService({ dataDir: tmpDir })
    expect(reloaded.getLibrary()).toHaveLength(1)
    expect(reloaded.getLibrary()[0].isWatched).toBe(true)

    const afterRemove = reloaded.removeLibraryItem('tt1375666')
    expect(afterRemove).toHaveLength(0)
  })

  it('builds an up-to-date series calendar and calculates unwatched newEpisodesCount (+N badge)', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/meta/series/tt9999999.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            meta: {
              id: 'tt9999999',
              type: 'series',
              name: 'Chainsmoker Cat',
              poster: 'https://example.com/cat.jpg',
              videos: [
                {
                  id: 'tt9999999:0:20',
                  season: 0,
                  episode: 20,
                  name: 'Mini Anime #19',
                  released: '2026-10-16T00:00:00.000Z'
                },
                {
                  id: 'tt9999999:0:21',
                  season: 0,
                  episode: 21,
                  name: 'Mini Anime #20',
                  released: '2026-10-23T00:00:00.000Z'
                },
                {
                  id: 'tt9999999:0:22',
                  season: 0,
                  episode: 22,
                  name: 'Mini Anime #21',
                  released: '2026-10-30T00:00:00.000Z'
                },
                {
                  id: 'tt9999999:0:23',
                  season: 0,
                  episode: 23,
                  name: '"Yani Neko" Mini Anime #22',
                  released: '2026-11-06T00:00:00.000Z',
                  thumbnail: 'https://example.com/ep23.jpg'
                },
                {
                  id: 'tt9999999:0:24',
                  season: 0,
                  episode: 24,
                  name: 'Upcoming Episode #23',
                  released: '2026-11-27T00:00:00.000Z'
                }
              ]
            }
          })
        } as any
      }
      return { ok: false, status: 404, json: async () => ({}) } as any
    })

    const fixedNow = new Date(2026, 10, 20, 12, 0, 0) // 2026-11-20
    const svc = new StremioLibraryService({
      dataDir: tmpDir,
      fetchFn: fetchMock as any,
      nowFn: () => fixedNow
    })

    svc.upsertLibraryItem({
      id: 'tt9999999',
      type: 'series',
      name: 'Chainsmoker Cat',
      watchedVideos: ['tt9999999:0:20']
    })

    const cal = await svc.getCalendar(false)
    expect(cal.seriesCount).toBe(1)
    expect(cal.syncedSeries).toBe(1)
    expect(cal.episodes).toHaveLength(5)

    const nov6 = cal.episodes.find((e) => e.dateKey === '2026-11-06')
    expect(nov6).toBeDefined()
    expect(nov6?.season).toBe(0)
    expect(nov6?.episode).toBe(23)
    expect(nov6?.isUpcoming).toBe(false)
    expect(nov6?.isWatched).toBe(false)

    const nov27 = cal.episodes.find((e) => e.dateKey === '2026-11-27')
    expect(nov27?.isUpcoming).toBe(true)

    // Episodes 21, 22, 23 aired after watched episode 20 => newEpisodesCount = 3
    const updatedLib = svc.getLibrary()
    expect(updatedLib[0].newEpisodesCount).toBe(3)

    // Cached second call should NOT refetch
    const calCached = await svc.getCalendar(false)
    expect(calCached.syncedSeries).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Force refresh SHOULD refetch
    const calForced = await svc.getCalendar(true)
    expect(calForced.syncedSeries).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('imports non-removed library items on Stremio account loginAndSync while preserving local additions', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/login')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { authKey: 'secret-auth-key-123' } })
        } as any
      }
      if (url.endsWith('/datastoreGet')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: [
              {
                _id: 'tt3032476',
                type: 'series',
                name: 'Better Call Saul',
                poster: 'https://example.com/bcs.jpg',
                removed: false,
                temp: false,
                state: {
                  lastWatched: '2026-11-10T10:00:00.000Z',
                  timeOffset: 1200000,
                  duration: 3000000,
                  timesWatched: 1,
                  flaggedWatched: 1,
                  video_id: 'tt3032476:6:13'
                }
              },
              {
                _id: 'tt_deleted',
                type: 'movie',
                name: 'Removed Movie',
                removed: true,
                temp: false
              },
              {
                _id: 'tt_temp',
                type: 'movie',
                name: 'Temp History Movie',
                removed: false,
                temp: true
              }
            ]
          })
        } as any
      }
      return { ok: false, status: 404, json: async () => ({}) } as any
    })

    const svc = new StremioLibraryService({
      dataDir: tmpDir,
      fetchFn: fetchMock as any
    })

    svc.upsertLibraryItem({
      id: 'tt_local_1',
      type: 'movie',
      name: 'Local Added Movie'
    })

    const res = await svc.loginAndSync('user@example.com', 'password123', false)
    expect(res.success).toBe(true)
    expect(res.importedCount).toBe(2) // Local Added Movie + Better Call Saul
    expect(res.library?.some((i) => i.id === 'tt3032476')).toBe(true)
    expect(res.library?.some((i) => i.id === 'tt_local_1')).toBe(true)
    expect(res.library?.some((i) => i.id === 'tt_deleted')).toBe(false)
    expect(res.library?.some((i) => i.id === 'tt_temp')).toBe(false)

    const bcs = res.library?.find((i) => i.id === 'tt3032476')
    expect(bcs?.progressSeconds).toBe(1200)
    expect(bcs?.durationSeconds).toBe(3000)
    expect(bcs?.isWatched).toBe(true)
    expect(svc.getAccountStatus().connected).toBe(true)
    expect(svc.getAccountStatus().email).toBe('user@example.com')
  })
})
