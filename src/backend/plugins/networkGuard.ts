import { secureDispatcher, secureDownloadFetch, isPublicAddress, QUAD9_DOH } from './secureDns'
import { sourceDomains } from './sourceSettings'
import type { PluginManifest } from 'common/types/plugins'
import { isIP } from 'net'
import { Agent } from 'undici'
import { execFile } from 'child_process'

export const isPublicDownloadAddress = isPublicAddress

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0'
])

export const TRUSTED_GAME_MIRROR_DOMAINS = [
  'pixeldrain.com',
  'buzzheavier.com',
  'bzzhr.to',
  'datanodes.to',
  'fileditch.com',
  'fileditchfiles.st',
  'gofile.io',
  '1fichier.com',
  'qiwi.gg',
  'qiwi.to',
  'rapidgator.net',
  'mega.nz',
  'mediafire.com',
  'archive.org',
  'megadb.net',
  'megadb.co',
  'megaup.net',
  'krakenfiles.com',
  'send.cm',
  'drop.download',
  'root.steamrip.com',
  'steamrip.com'
]

function isPrivateIP(ip: string): boolean {
  // Check 10.x.x.x
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  // Check 172.16-31.x.x
  const match172 = ip.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (match172) {
    const secondOctet = parseInt(match172[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) return true
  }
  // Check 192.168.x.x
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  // Check Link-local 169.254.x.x
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  return false
}

export class NetworkGuard {
  private static dispatcher?: Agent

  static async fetchWithCurl(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const args = [
      '-s',
      '--doh-url', QUAD9_DOH,
      '--proto', '=https',
      '--fail',
      '--write-out', '\n%{http_code}',
      '--max-time',
      '20',
      '-H',
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      '-H',
      'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      '-H',
      'Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      '-H',
      'Sec-Fetch-Dest: document',
      '-H',
      'Sec-Fetch-Mode: navigate',
      '-H',
      'Sec-Fetch-Site: none',
      '-H',
      'Sec-Fetch-User: ?1',
      '-H',
      'Upgrade-Insecure-Requests: 1'
    ]
    for (const [k, v] of Object.entries(headers)) {
      args.push('-H', `${k}: ${v}`)
    }
    const addresses = await (await import('./secureDns')).resolvePublicHost(new URL(url).hostname)
    args.push('--resolve', `${new URL(url).hostname}:443:${addresses.map(item => item.family === 6 ? `[${item.address}]` : item.address).join(',')}`)
    args.push(url)

    return new Promise((resolve, reject) => {
      execFile(
        'curl.exe',
        args,
        { maxBuffer: 15 * 1024 * 1024, encoding: 'buffer' },
        (error, stdout) => {
          if (error) {
            return reject(error)
          }
          const status = Number(stdout.subarray(-3).toString())
          if (status < 200 || status >= 300) { reject(new Error(`A fonte respondeu HTTP ${status}.`)); return }
          resolve(
            new Response(stdout.subarray(0, -4), {
              status,
              statusText: 'OK',
              headers: { 'Content-Type': 'text/html' }
            })
          )
        }
      )
    })
  }

  static async fetchResponse(rawUrl: string, manifest: PluginManifest, signal: AbortSignal, headers: Record<string, string> = {}, nativeOnly = false): Promise<Response> {
    let url = rawUrl
    const browserHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...headers
    }
    let requestHeaders = browserHeaders
    this.dispatcher ??= secureDispatcher()
    for (let redirects = 0; redirects <= 5; redirects++) {
      const check = this.validateUrl(url, manifest)
      if (!check.allowed) throw new Error(check.reason)
      const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '')
      if (isIP(hostname) && !isPublicDownloadAddress(hostname)) throw new Error('Endereço de rede não permitido.')

      let response: Response
      try {
        const request = { redirect: 'manual' as const, signal, headers: requestHeaders, dispatcher: this.dispatcher }
        response = nativeOnly ? await secureDownloadFetch(url, request) : await fetch(url, request)
      } catch (error) {
        signal.throwIfAborted()
        if (!nativeOnly && process.platform === 'win32') {
          try {
            return await this.fetchWithCurl(url, requestHeaders)
          } catch {
            // Segue para disparar o erro original
          }
        }
        throw error
      }

      if (!nativeOnly && [403, 503].includes(response.status) && process.platform === 'win32') {
        try {
          const curlRes = await this.fetchWithCurl(url, requestHeaders)
          await response.body?.cancel()
          return curlRes
        } catch {
          // Mantém a resposta original se o curl falhar
        }
      }

      if (![301, 302, 303, 307, 308].includes(response.status)) return response
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Redirecionamento sem destino.')
      const next = new URL(location, url).href
      if (new URL(next).origin !== new URL(url).origin) requestHeaders = {}
      url = next
    }
    throw new Error('Número excessivo de redirecionamentos.')
  }
  static validateUrl(rawUrl: string, manifest: PluginManifest): { allowed: boolean; reason?: string; parsedUrl?: URL } {
    if (!manifest.permissions.includes('network')) {
      return { allowed: false, reason: `Plugin "${manifest.name}" does not have "network" permission.` }
    }

    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return { allowed: false, reason: `Invalid URL format: "${rawUrl}"` }
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, reason: `Protocol "${parsed.protocol}" is forbidden. Only HTTP/HTTPS are permitted.` }
    }

    const hostname = parsed.hostname.toLowerCase()

    if (BLOCKED_HOSTNAMES.has(hostname) || isPrivateIP(hostname)) {
      return { allowed: false, reason: `Access to local network/loopback (${hostname}) is blocked by GhostShield.` }
    }

    const allowedDomains = [...(manifest.allowedDomains || []), ...sourceDomains(manifest.id)]
    if (allowedDomains.length === 0 && !manifest.permissions.includes('game-sources')) {
      return { allowed: false, reason: `Plugin has not declared any allowed domains in "allowedDomains".` }
    }

    const isDomainAllowed =
      allowedDomains.some((domain) => {
        const cleanDomain = domain.toLowerCase().replace(/^\*\./, '')
        return hostname === cleanDomain || hostname.endsWith(`.${cleanDomain}`)
      }) ||
      (manifest.permissions.includes('game-sources') &&
        TRUSTED_GAME_MIRROR_DOMAINS.some(
          (mirror) => hostname === mirror || hostname.endsWith(`.${mirror}`)
        ))

    if (!isDomainAllowed) {
      return {
        allowed: false,
        reason: `Domain "${hostname}" is not in the plugin's allowedDomains list: [${allowedDomains.join(', ')}].`
      }
    }

    return { allowed: true, parsedUrl: parsed }
  }

  static async safeFetch(
    rawUrl: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: string
      timeoutMs?: number
    } = {},
    manifest: PluginManifest
  ): Promise<{ ok: boolean; status: number; statusText: string; data: string; json: () => any }> {
    const check = this.validateUrl(rawUrl, manifest)
    if (!check.allowed || !check.parsedUrl) {
      throw new Error(`[GhostShield Network Violation]: ${check.reason}`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000)

    try {
      const response = await fetch(check.parsedUrl.toString(), {
        dispatcher: secureDispatcher(),
        redirect: 'error',
        method: options.method || 'GET',
        headers: {
          'User-Agent': `GhostLauncher/${manifest.id}/${manifest.version}`,
          ...options.headers
        },
        body: options.body,
        signal: controller.signal
      } as RequestInit)

      const text = await response.text()

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: text,
        json: () => JSON.parse(text)
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
