import { createServer } from 'http'
import { connect, type Socket } from 'net'
import { randomBytes } from 'crypto'
import { resolvePublicHost } from './secureDns'
import { NetworkGuard } from './networkGuard'
import type { PluginManifest } from 'common/types/plugins'

// Only this per-operation proxy resolves hosts for the experimental browser.
export async function engineProxy(manifest: PluginManifest) {
  const password = randomBytes(24).toString('hex')
  const authorization = `Basic ${Buffer.from(`ghost:${password}`).toString('base64')}`
  const sockets = new Set<Socket>()
  const server = createServer((_request, response) => {
    response.writeHead(403)
    response.end()
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.setTimeout(20000, () => socket.destroy())
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => socket.destroy())
  })
  server.on('connect', (request, client, head) => {
    void (async () => {
      try {
        if (request.headers['proxy-authorization'] !== authorization)
          throw new Error('Unauthorized')
        const url = new URL(`https://${request.url}`)
        if (url.port || !NetworkGuard.validateUrl(url.href, manifest).allowed)
          throw new Error('Host blocked')
        const addresses = await resolvePublicHost(url.hostname)
        if (client.destroyed) return
        const remote = connect({ host: addresses[0].address, port: 443 })
        sockets.add(remote)
        remote.setTimeout(20000, () => remote.destroy())
        remote.on('close', () => {
          sockets.delete(remote)
          client.destroy()
        })
        remote.on('error', () => client.destroy())
        client.on('close', () => remote.destroy())
        remote.once('connect', () => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          if (head.length) remote.write(head)
          client.pipe(remote)
          remote.pipe(client)
        })
      } catch {
        client.destroy()
      }
    })()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Não foi possível iniciar a navegação experimental.')
  return {
    url: `http://ghost:${password}@127.0.0.1:${address.port}`,
    close() {
      for (const socket of sockets) socket.destroy()
      server.close()
    }
  }
}
