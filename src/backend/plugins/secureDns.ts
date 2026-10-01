import { app, net } from 'electron'
import { Agent } from 'undici'
import { BlockList, isIP } from 'net'

export const QUAD9_DOH = 'https://dns.quad9.net/dns-query'
export function configureSecureDns() {
  app.configureHostResolver({
    enableBuiltInResolver: true,
    secureDnsMode: 'secure',
    secureDnsServers: [QUAD9_DOH]
  })
}
export function isPublicAddress(address: string): boolean {
  const blocked = new BlockList()
  for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
  ] as const)
    blocked.addSubnet(network, prefix, 'ipv4')
  if (isIP(address) === 4) return !blocked.check(address, 'ipv4')
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address)
}
export async function resolvePublicHost(hostname: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const result = await Promise.race([
    net.resolveHost(hostname, { source: 'dns', secureDnsPolicy: 'allow' }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error('O DNS seguro demorou para responder. Tente novamente.')
          ),
        8000
      )
    })
  ]).finally(() => clearTimeout(timer))
  const addresses = result.endpoints.map((endpoint) => ({
    address: endpoint.address,
    family: isIP(endpoint.address)
  }))
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  )
    throw new Error('O DNS seguro não retornou um endereço público permitido.')
  return addresses
}
let dispatcher: Agent | undefined
let downloadDispatcher: Agent | undefined
let ipv4Dispatcher: Agent | undefined
function makeDispatcher(ipv4 = false, timeout = 10000) {
  return new Agent({
    connect: {
      timeout,
      autoSelectFamily: !ipv4,
      autoSelectFamilyAttemptTimeout: 250,
      lookup(hostname, options, callback) {
        void resolvePublicHost(hostname).then(
          (addresses) => {
            const family = ipv4 ? 4 : options.family
            const matching = family
              ? addresses.filter((item) => item.family === family)
              : addresses
            if (!matching.length) {
              callback(
                new Error('O DNS seguro não retornou endereço compatível.'),
                '',
                4
              )
              return
            }
            if (options.all) callback(null, matching)
            else callback(null, matching[0].address, matching[0].family)
          },
          (error) => callback(error, '', 4)
        )
      }
    }
  })
}
export function secureDispatcher() {
  return (dispatcher ??= makeDispatcher())
}

/** GET-only file requests: retry connection establishment, never a partial body. */
export async function secureDownloadFetch(url: string, options: RequestInit): Promise<Response> {
  const request = (agent: Agent) => fetch(url, { ...options, dispatcher: agent } as RequestInit)
  try {
    return await request(downloadDispatcher ??= makeDispatcher(false, 30000))
  } catch (error) {
    options.signal?.throwIfAborted()
    const code = (error as { cause?: { code?: string } }).cause?.code
    if (!['UND_ERR_CONNECT_TIMEOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code || '')) throw error
    return request(ipv4Dispatcher ??= makeDispatcher(true, 30000))
  }
}

export function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    dispatcher: secureDispatcher()
  } as RequestInit)
}
