export {}

const mockLoad = jest.fn<Promise<void>, [string]>()
const mockRead = jest.fn<Promise<unknown>, []>()
const mockDestroy = jest.fn()
const mockShow = jest.fn()
const mockPolicy = jest.fn()
const mockHeaders = jest.fn()
const mockWindows: {
  options: { show: boolean }
  listeners: Record<string, (...args: unknown[]) => void>
}[] = []
let mockStatus = 200
let mockUrl = ''
jest.mock('electron', () => ({
  session: {
    fromPartition: () => ({
      setPermissionRequestHandler: jest.fn(),
      setPermissionCheckHandler: jest.fn(),
      on: jest.fn(),
      webRequest: {
        onBeforeRequest: mockPolicy,
        onHeadersReceived: mockHeaders
      }
    })
  },
  BrowserWindow: jest.fn().mockImplementation((options: { show: boolean }) => {
    const listeners: Record<string, (...args: unknown[]) => void> = {}
    mockWindows.push({ options, listeners })
    return {
      isDestroyed: () => false,
      destroy: mockDestroy,
      show: mockShow,
      focus: jest.fn(),
      setTitle: jest.fn(),
      center: jest.fn(),
      setAlwaysOnTop: jest.fn(),
      moveTop: jest.fn(),
      on: (event: string, callback: (...args: unknown[]) => void) => {
        listeners[event] = callback
      },
      loadURL: (url: string) => {
        mockUrl = url
        listeners['did-navigate']?.({}, url, mockStatus)
        return mockLoad(url)
      },
      webContents: {
        getURL: () => mockUrl,
        on: (event: string, callback: (...args: unknown[]) => void) => {
          listeners[event] = callback
        },
        setAudioMuted: jest.fn(),
        setWindowOpenHandler: jest.fn(),
        executeJavaScript: () => mockRead()
      },
      once: (event: string, callback: (...args: unknown[]) => void) => {
        listeners[event] = callback
      }
    }
  })
}))

const url = 'https://www.skidrowreloaded.com/warhammer-40000-boltgun-2-rune/'
beforeEach(() => {
  jest.resetModules()
  mockWindows.length = 0
  mockStatus = 200
  mockLoad.mockResolvedValue(undefined)
  mockRead.mockResolvedValue(
    '<div class="post-extended"><h2>Warhammer 40000 Boltgun 2-RUNE</h2></div>'
  )
})
afterEach(() => jest.useRealTimers())

it('reads only allowed public URLs in a hidden window and closes it after success or failure', async () => {
  const { readSkidrowManualPage: read } = await import('../drmPublicPage')
  await expect(read('https://evil.example/')).rejects.toThrow('inválido')
  await expect(
    read('https://www.skidrowreloaded.com/download/')
  ).rejects.toThrow('inválido')
  expect(mockLoad).not.toHaveBeenCalled()
  expect(await read(url)).toContain('Boltgun 2-RUNE')
  expect(mockDestroy).toHaveBeenCalledTimes(1)
  expect(mockWindows[0].options.show).toBe(false)
  mockLoad.mockRejectedValue(new Error('offline'))
  await expect(read(url)).rejects.toThrow('offline')
  expect(mockDestroy).toHaveBeenCalledTimes(2)
  const preventDefault = jest.fn()
  mockWindows[0].listeners['will-redirect'](
    { preventDefault },
    'https://evil.example/'
  )
  expect(preventDefault).toHaveBeenCalled()
  const policy = mockPolicy.mock.calls[0][0] as (
    details: unknown,
    callback: (value: unknown) => void
  ) => void
  const cb = jest.fn()
  policy(
    {
      url: 'https://www.skidrowreloaded.com/archive.zip',
      resourceType: 'image'
    },
    cb
  )
  expect(cb).toHaveBeenCalledWith({ cancel: true })
})

it('handles a missing page without manufacturing a listing', async () => {
  const { readSkidrowManualPage: read } = await import('../drmPublicPage')
  mockStatus = 404
  expect(await read(url)).toBeUndefined()
  expect(mockRead).not.toHaveBeenCalled()
  expect(mockDestroy).toHaveBeenCalledTimes(1)
})

it('waits for complete content and times out stalled navigation while releasing the window', async () => {
  jest.useFakeTimers()
  const { readSkidrowManualPage: read } = await import('../drmPublicPage')
  mockRead.mockResolvedValueOnce(undefined)
  const first = read(url)
  await jest.advanceTimersByTimeAsync(500)
  await expect(first).resolves.toContain('Boltgun')
  mockLoad.mockImplementation(() => new Promise(() => {}))
  const second = expect(read(url)).rejects.toThrow('esgotado')
  await jest.advanceTimersByTimeAsync(23000)
  await second
  expect(mockDestroy).toHaveBeenCalledTimes(2)
})

it('respects a 429 Retry-After and refuses to start another page during the cooldown', async () => {
  const { readSkidrowManualPage: read } = await import('../drmPublicPage')
  mockHeaders.mockImplementation(
    (callback: (details: unknown, reply: () => void) => void) => {
      callback(
        {
          resourceType: 'mainFrame',
          statusCode: 429,
          responseHeaders: { 'Retry-After': ['180'] }
        },
        () => {}
      )
    }
  )
  await expect(read(url)).rejects.toThrow('limite temporário')
  await expect(read(url)).rejects.toThrow('limite temporário')
  expect(mockLoad).toHaveBeenCalledTimes(1)
})

it('opens a visible source in the reader profile and accepts only matching game content', async () => {
  const { openSkidrowSource: open } = await import('../drmPublicPage')
  mockRead.mockResolvedValue(
    `<link rel="canonical" href="${url}"><div class="post-extended"><h2>Warhammer 40000 Boltgun 2-RUNE</h2><div class="meta">Posted October 17, 2020 in <a rel="category tag">PC GAMES</a></div><p>Title: Warhammer 40,000: Boltgun 2\nRelease Date: 14 Oct, 2020</p><p>Warhammer 40000 Boltgun 2-RUNE\nSize: 9.9 GB</p></div>`
  )
  expect(await open('Warhammer 40,000: Boltgun 2', url)).toMatchObject({
    status: 'cracked',
    group: 'RUNE',
    url
  })
  expect(mockShow).toHaveBeenCalledTimes(1)
  expect(mockDestroy).toHaveBeenCalledTimes(1)
  await expect(
    open('Test', 'https://ankergames.net/game/test')
  ).rejects.toThrow('inválido')
})

it('does not report successful access when the user closes a pending verification', async () => {
  jest.useFakeTimers()
  const { openSkidrowSource: open } = await import('../drmPublicPage')
  mockLoad.mockImplementation(() => new Promise(() => {}))
  const pending = expect(
    open('Warhammer 40,000: Boltgun 2', url)
  ).rejects.toThrow('encerrada')
  await jest.advanceTimersByTimeAsync(1)
  mockWindows[0].listeners['closed']()
  await pending
  expect(mockDestroy).toHaveBeenCalledTimes(1)
})
