export {}

const mockLoad = jest.fn<Promise<void>, [string]>()
const mockRead = jest.fn<Promise<string>, [string]>()
const mockDestroy = jest.fn()
const mockHeaders = jest.fn()
const mockLanguage = jest.fn()
const mockWindows: {
  options: { show: boolean }
  listeners: Record<string, (...args: unknown[]) => void>
}[] = []
let mockNow = Date.parse('2026-10-16T12:00:00Z')
let mockStatus = 200
jest.mock('electron', () => ({
  session: {
    fromPartition: () => ({
      getUserAgent: () => 'Electron test',
      setUserAgent: mockLanguage,
      on: jest.fn(),
      setPermissionRequestHandler: jest.fn(),
      webRequest: { onBeforeRequest: jest.fn(), onHeadersReceived: mockHeaders }
    })
  },
  BrowserWindow: jest.fn().mockImplementation((options: { show: boolean }) => {
    const listeners: Record<string, (...args: unknown[]) => void> = {}
    let url = ''
    mockWindows.push({ options, listeners })
    return {
      isDestroyed: () => false,
      destroy: mockDestroy,
      loadURL: (target: string) => {
        url = target
        mockNow += 2000
        listeners['did-navigate']?.({}, url, mockStatus)
        return mockLoad(url)
      },
      webContents: {
        setAudioMuted: jest.fn(),
        setWindowOpenHandler: jest.fn(),
        on: (event: string, callback: (...args: unknown[]) => void) => {
          listeners[event] = callback
        },
        executeJavaScript: () => mockRead(url)
      }
    }
  })
}))
const postUrl =
  'https://www.reddit.com/r/CrackWatch/comments/1x6xft4/enshroudedrune/'
const search = `<div data-testid="search-post-unit"><a data-testid="post-title" aria-label="Enshrouded-RUNE" href="${postUrl}"></a></div>`
const post = `<shreddit-post id="t3_1x6xft4" subreddit-name="CrackWatch" permalink="/r/CrackWatch/comments/1x6xft4/enshroudedrune/" post-title="Enshrouded-RUNE" created-timestamp="2026-10-15T20:59:09Z"><shreddit-post-flair>Release</shreddit-post-flair></shreddit-post>`

beforeEach(() => {
  jest.resetModules()
  mockWindows.length = 0
  mockNow = Date.parse('2026-10-16T12:00:00Z')
  mockStatus = 200
  jest.spyOn(Date, 'now').mockImplementation(() => mockNow)
  mockLoad.mockResolvedValue(undefined)
  mockRead.mockImplementation((url) =>
    Promise.resolve(url === postUrl ? post : search)
  )
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it('uses public title search, verifies the post, shares concurrent work and caches compact results', async () => {
  const { readCrackWatch, crackWatchSearchUrl } = await import('../drmReddit')
  expect(new URL(crackWatchSearchUrl('Enshrouded')).searchParams.get('q')).toBe(
    '(title:"Enshrouded") AND NOT (title:update OR title:hotfix OR title:crackfix OR title:repack OR title:dlc OR flair:repack OR flair:discussion)'
  )
  const results = await Promise.all([
    readCrackWatch('Enshrouded'),
    readCrackWatch('Enshrouded')
  ])
  expect(results[0][0]).toMatchObject({ status: 'cracked', url: postUrl })
  expect(results[1]).toEqual(results[0])
  await readCrackWatch('Enshrouded')
  expect(mockLoad).toHaveBeenCalledTimes(2)
  expect(mockDestroy).toHaveBeenCalledTimes(2)
  expect(mockWindows.every((window) => window.options.show === false)).toBe(
    true
  )
  expect(mockLanguage).toHaveBeenCalledWith('Electron test', 'en-US,en;q=0.9')
  mockNow += 15000
  await readCrackWatch('Enshrouded', true)
  expect(mockLoad).toHaveBeenCalledTimes(4)
})

it('does not let an index HTTP 403 disable post searches, and retries after a short failure cache', async () => {
  const { readCrackWatch, readCrackWatchIndex } = await import('../drmReddit')
  mockStatus = 403
  await expect(readCrackWatchIndex('Enshrouded')).rejects.toThrow('403')
  await expect(readCrackWatchIndex('Enshrouded', true)).rejects.toThrow('403')
  expect(mockLoad).toHaveBeenCalledTimes(1)
  mockStatus = 200
  expect((await readCrackWatch('Enshrouded'))[0].status).toBe('cracked')
  mockNow += 61000
  mockRead.mockResolvedValue('<h1>New format</h1>')
  await expect(readCrackWatchIndex('Enshrouded', true)).rejects.toThrow(
    'formato'
  )
  expect(mockLoad).toHaveBeenCalledTimes(4)
})

it('backs off on rate limits and does not keep a one-hour global lock', async () => {
  const { readCrackWatch } = await import('../drmReddit')
  mockStatus = 429
  await expect(readCrackWatch('Enshrouded')).rejects.toThrow('429')
  await expect(readCrackWatch('Other')).rejects.toThrow('limite')
  expect(mockLoad).toHaveBeenCalledTimes(1)
  mockNow += 61000
  mockStatus = 200
  expect((await readCrackWatch('Enshrouded', true))[0].status).toBe('cracked')
})

it('rejects redirects outside the requested page and closes windows after network failures', async () => {
  const { readCrackWatch } = await import('../drmReddit')
  mockLoad.mockRejectedValue(new Error('offline'))
  await expect(readCrackWatch('Enshrouded')).rejects.toThrow('offline')
  expect(mockDestroy).toHaveBeenCalledTimes(1)
  const preventDefault = jest.fn()
  mockWindows[0].listeners['will-redirect'](
    { preventDefault },
    'https://www.reddit.com/login/'
  )
  mockWindows[0].listeners['will-navigate'](
    { preventDefault },
    'https://evil.example/'
  )
  expect(preventDefault).toHaveBeenCalledTimes(2)
})

it('honors Retry-After longer than its minimum cooldown', async () => {
  const { readCrackWatch } = await import('../drmReddit')
  mockHeaders.mockImplementation(
    (handler: (details: unknown, callback: () => void) => void) => {
      handler(
        {
          resourceType: 'mainFrame',
          statusCode: 429,
          responseHeaders: { 'Retry-After': ['180'] }
        },
        () => {}
      )
    }
  )
  mockStatus = 429
  await expect(readCrackWatch('Enshrouded')).rejects.toThrow('429')
  mockNow += 61000
  mockStatus = 200
  await expect(readCrackWatch('Other')).rejects.toThrow('limite')
  expect(mockLoad).toHaveBeenCalledTimes(1)
  mockNow += 181000
  expect((await readCrackWatch('Enshrouded'))[0].status).toBe('cracked')
})

it('keeps verified evidence when another matching announcement is unavailable', async () => {
  const { readCrackWatch } = await import('../drmReddit')
  const missing = postUrl.replace('1x6xft4', 'missing')
  mockRead.mockImplementation((target) => {
    if (target === missing) return Promise.reject(new Error('post unavailable'))
    return Promise.resolve(
      target === postUrl ? post : search + search.replaceAll(postUrl, missing)
    )
  })
  const result = await readCrackWatch('Enshrouded')
  expect(result[0]).toMatchObject({ status: 'cracked', url: postUrl })
  expect(result[0].notice).toContain('Algumas publicações')
})

it('bounds a stalled navigation and releases the hidden window', async () => {
  jest.useFakeTimers()
  const { readCrackWatch } = await import('../drmReddit')
  mockLoad.mockImplementation(() => new Promise(() => {}))
  const result = expect(readCrackWatch('Enshrouded')).rejects.toThrow('tempo')
  await jest.advanceTimersByTimeAsync(25000)
  await result
  expect(mockDestroy).toHaveBeenCalledTimes(1)
})
