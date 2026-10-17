const mockProcess = jest.fn()
const mockProxyClose = jest.fn()
const mockRead = jest.fn()
const mockRequestPolicy = jest.fn()
const mockWindowOpen = jest.fn()
const mockShow = jest.fn()
const mockPartition = jest.fn()
const mockEngine = jest.fn()
jest.mock('../../plugins/engineProcess', () => ({
  engineProcess: (...args: unknown[]) => mockProcess(...args)
}))
jest.mock('../../plugins/engineProxy', () => ({
  engineProxy: async () => ({
    url: 'http://ghost:private@127.0.0.1:12345',
    close: mockProxyClose
  })
}))
jest.mock('../../plugins/sourceEngines', () => ({
  withSourceEngine: (...args: unknown[]) => mockEngine(...args)
}))
jest.mock('electron', () => ({
  session: {
    fromPartition: (...args: unknown[]) => {
      mockPartition(...args)
      return {
        setPermissionRequestHandler: jest.fn(),
        setPermissionCheckHandler: jest.fn(),
        webRequest: { onBeforeRequest: mockRequestPolicy },
        on: jest.fn()
      }
    }
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    isDestroyed: () => false,
    loadURL: async () => undefined,
    show: mockShow,
    setTitle: jest.fn(),
    center: jest.fn(),
    setAlwaysOnTop: jest.fn(),
    moveTop: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    on: jest.fn(),
    webContents: {
      setAudioMuted: jest.fn(),
      setWindowOpenHandler: mockWindowOpen,
      on: jest.fn(),
      executeJavaScript: (...args: unknown[]) => mockRead(...args)
    }
  }))
}))

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  mockEngine.mockImplementation(async (_id, run) =>
    run('worker.exe', 'C:/isolated/data')
  )
  mockProcess.mockImplementation(async (_file, args) =>
    args.length
      ? JSON.stringify({ capabilities: ['manual-drm-page-v1'] })
      : JSON.stringify({
          status: 200,
          url: 'https://ankergames.net/game/test',
          html: '<main><h1>Test</h1></main>'
        })
  )
  mockRead.mockResolvedValue(false)
})

it('uses an isolated persistent Anker profile with the scoped proxy and closes the proxy', async () => {
  const { readAnkerManualPage } = await import('../drmManual')
  expect(
    await readAnkerManualPage('https://ankergames.net/game/test')
  ).toContain('<h1>Test</h1>')
  const request = JSON.parse(mockProcess.mock.calls[1][2])
  expect(request).toMatchObject({
    operation: 'manual-drm-page-v1',
    url: 'https://ankergames.net/game/test'
  })
  expect(request.storage).toMatch(/drm-anker$/)
  expect(mockProxyClose).toHaveBeenCalledTimes(1)
})
it('does not claim access from a 200 verification page or an unavailable motor', async () => {
  const { readAnkerManualPage } = await import('../drmManual')
  mockProcess
    .mockResolvedValueOnce(
      JSON.stringify({ capabilities: ['manual-drm-page-v1'] })
    )
    .mockResolvedValueOnce(
      JSON.stringify({
        status: 200,
        url: 'https://ankergames.net/game/test',
        html: '<title>Just a moment...</title>'
      })
    )
  await expect(
    readAnkerManualPage('https://ankergames.net/game/test')
  ).rejects.toThrow(/verificação/)
  mockEngine.mockResolvedValueOnce(undefined)
  await expect(
    readAnkerManualPage('https://ankergames.net/game/test')
  ).rejects.toThrow(/indisponível/)
  await expect(
    readAnkerManualPage('https://evil.test/game/test')
  ).rejects.toThrow(/inválido/)
})
it('keeps a blocked Hiz source nonterminal, hidden, reusable and restricted to its own session', async () => {
  const { readHizManualSource } = await import('../drmManual')
  const first = await readHizManualSource('Test')
  const second = await readHizManualSource('Other game')
  expect(first).toMatchObject({ name: 'HizSearch', requiresVerification: true })
  expect(first.status).toBeUndefined()
  expect(second.requiresVerification).toBe(true)
  expect(mockShow).not.toHaveBeenCalled()
  expect(mockPartition).toHaveBeenCalledTimes(1)
  expect(mockPartition).toHaveBeenCalledWith('persist:ghost-drm-hiz')
  const policy = mockRequestPolicy.mock.calls[0][0]
  const callback = jest.fn()
  policy({ url: 'https://hizapi.onrender.com/search' }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: false })
  policy({ url: 'https://hizsearch.pages.dev.evil.test/' }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: true })
  policy({ url: 'http://127.0.0.1/' }, callback)
  expect(callback).toHaveBeenLastCalledWith({ cancel: true })
  expect(mockWindowOpen.mock.calls[0][0]()).toEqual({ action: 'deny' })
})
it('only the release action shows the Hiz window and confirms that search is enabled', async () => {
  const { verifyHizAccess } = await import('../drmManual')
  mockRead.mockResolvedValue(true)
  expect(await verifyHizAccess()).toBe(true)
  expect(mockShow).toHaveBeenCalledTimes(1)
})
