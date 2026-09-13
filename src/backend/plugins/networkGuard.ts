import type { PluginManifest } from 'common/types/plugins'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0'
])

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

    const allowedDomains = manifest.allowedDomains || []
    if (allowedDomains.length === 0) {
      return { allowed: false, reason: `Plugin has not declared any allowed domains in "allowedDomains".` }
    }

    const isDomainAllowed = allowedDomains.some((domain) => {
      const cleanDomain = domain.toLowerCase().replace(/^\*\./, '')
      return hostname === cleanDomain || hostname.endsWith(`.${cleanDomain}`)
    })

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
        method: options.method || 'GET',
        headers: {
          'User-Agent': `GhostLauncher/${manifest.id}/${manifest.version}`,
          ...options.headers
        },
        body: options.body,
        signal: controller.signal
      })

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
