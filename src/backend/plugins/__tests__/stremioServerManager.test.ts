import {
  STREMIO_STREAMING_URL,
  isStremioServerRunning,
  findStremioExecutable,
  ensureStremioServer
} from '../stremioServerManager'

describe('Stremio Streaming Server Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('exposes canonical streaming URL at http://127.0.0.1:11470', () => {
    expect(STREMIO_STREAMING_URL).toBe('http://127.0.0.1:11470')
  })

  test('checks if Stremio server is running via fetch', async () => {
    const originalFetch = global.fetch
    try {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any
      const running = await isStremioServerRunning()
      expect(running).toBe(true)

      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any
      const notRunning = await isStremioServerRunning()
      expect(notRunning).toBe(false)
    } finally {
      global.fetch = originalFetch
    }
  })

  test('locates installed Stremio executable or returns empty object', () => {
    const result = findStremioExecutable()
    expect(typeof result).toBe('object')
  })

  test('ensureStremioServer returns online status when server responds', async () => {
    const originalFetch = global.fetch
    try {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any
      const res = await ensureStremioServer()
      expect(res.online).toBe(true)
      expect(res.url).toBe(STREMIO_STREAMING_URL)
    } finally {
      global.fetch = originalFetch
    }
  })
})
