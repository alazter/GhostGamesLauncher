import { request } from 'http'
import { engineProxy } from '../engineProxy'
import { resolvePublicHost } from '../secureDns'
import type { PluginManifest } from 'common/types/plugins'
jest.mock('../secureDns', () => ({ resolvePublicHost: jest.fn() }))
jest.mock('../networkGuard', () => ({
  NetworkGuard: { validateUrl: () => ({ allowed: false }) }
}))

it('challenges Chromium for proxy credentials without resolving any unauthenticated destination', async () => {
  const proxy = await engineProxy({
    permissions: ['network'],
    allowedDomains: ['example.com']
  } as PluginManifest)
  try {
    const endpoint = new URL(proxy.url)
    const reply = await new Promise<{ status: number; challenge: unknown }>(
      (resolve, reject) => {
        const connection = request({
          hostname: endpoint.hostname,
          port: endpoint.port,
          method: 'CONNECT',
          path: 'example.com:443'
        })
        connection.on('connect', (response, socket) => {
          socket.destroy()
          resolve({
            status: response.statusCode!,
            challenge: response.headers['proxy-authenticate']
          })
        })
        connection.on('error', reject)
        connection.end()
      }
    )
    expect(reply).toEqual({ status: 407, challenge: 'Basic realm="Ghost"' })
    expect(resolvePublicHost).not.toHaveBeenCalled()
  } finally {
    proxy.close()
  }
})
