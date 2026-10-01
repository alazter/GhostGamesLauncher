jest.mock('electron', () => ({
  app: { configureHostResolver: jest.fn() },
  net: { resolveHost: jest.fn() }
}))
import { app, net } from 'electron'
import { configureSecureDns, resolvePublicHost, QUAD9_DOH, secureDownloadFetch } from '../secureDns'

it('configures encrypted Quad9 without insecure fallback', () => {
  configureSecureDns()
  expect(app.configureHostResolver).toHaveBeenCalledWith({
    enableBuiltInResolver: true,
    secureDnsMode: 'secure',
    secureDnsServers: [QUAD9_DOH]
  })
})

it('retries a file connection timeout with a different dispatcher while keeping the range', async () => {
  const fetcher = jest.spyOn(global, 'fetch')
    .mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }))
    .mockResolvedValueOnce(new Response('part', { status: 206 }))
  try {
    expect((await secureDownloadFetch('https://cdn.example/file', { headers: { Range: 'bytes=100-' }, redirect: 'manual' })).status).toBe(206)
    expect(fetcher).toHaveBeenCalledTimes(2)
    const first = fetcher.mock.calls[0][1] as RequestInit & { dispatcher: unknown }
    const second = fetcher.mock.calls[1][1] as RequestInit & { dispatcher: unknown }
    expect(first.dispatcher).not.toBe(second.dispatcher)
    expect(second.headers).toEqual({ Range: 'bytes=100-' })
    expect(second.redirect).toBe('manual')
  } finally { fetcher.mockRestore() }
})

it('does not retry after the user pauses the download', async () => {
  const controller = new AbortController()
  controller.abort()
  const fetcher = jest.spyOn(global, 'fetch').mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }))
  try {
    await expect(secureDownloadFetch('https://cdn.example/file', { signal: controller.signal })).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
  } finally { fetcher.mockRestore() }
})
it('uses Chromium DNS for the backend and rejects private DNS answers', async () => {
  jest
    .mocked(net.resolveHost)
    .mockResolvedValue({ endpoints: [{ address: '9.9.9.9', family: 'ipv4' }] })
  await expect(resolvePublicHost('example.com')).resolves.toEqual([
    { address: '9.9.9.9', family: 4 }
  ])
  expect(net.resolveHost).toHaveBeenCalledWith('example.com', {
    source: 'dns',
    secureDnsPolicy: 'allow'
  })
  jest.mocked(net.resolveHost).mockResolvedValue({
    endpoints: [{ address: '127.0.0.1', family: 'ipv4' }]
  })
  await expect(resolvePublicHost('example.com')).rejects.toThrow()
})
