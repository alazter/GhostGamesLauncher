/**
 * Ghost Games Launcher - Stream Header Store
 * Gerencia cabeçalhos customizados (User-Agent, Referer, Origin, etc.) para fluxos
 * de streaming IPTV, Stremio e listas M3U/M3U8 com herança automática para chunks e segmentos .ts.
 */

export class StreamHeaderStore {
  private static instance: StreamHeaderStore
  private headersByUrl = new Map<string, Record<string, string>>()
  private headersByHost = new Map<string, Record<string, string>>()

  public static getInstance(): StreamHeaderStore {
    if (!StreamHeaderStore.instance) {
      StreamHeaderStore.instance = new StreamHeaderStore()
    }
    return StreamHeaderStore.instance
  }

  /**
   * Registra cabeçalhos requeridos para uma URL de stream e seus hosts/CDNs associados.
   */
  public setStreamHeaders(
    streamUrl: string,
    headers: Record<string, string>
  ): void {
    if (!streamUrl || !headers || typeof headers !== 'object') return

    const sanitizedHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string' && v.trim().length > 0) {
        sanitizedHeaders[k] = v.trim()
      }
    }

    this.headersByUrl.set(streamUrl, sanitizedHeaders)

    try {
      const parsed = new URL(streamUrl)
      const host = parsed.hostname.toLowerCase()
      const origin = parsed.origin.toLowerCase()

      this.headersByHost.set(host, sanitizedHeaders)
      this.headersByHost.set(origin, sanitizedHeaders)

      // Failover resiliente para mirrors conhecidos de CDN (ex: cdn10embed <-> cdn13embed)
      if (host.includes('cdn10embed.xyz')) {
        this.headersByHost.set(
          host.replace('cdn10embed.xyz', 'cdn13embed.xyz'),
          sanitizedHeaders
        )
      } else if (host.includes('cdn13embed.xyz')) {
        this.headersByHost.set(
          host.replace('cdn13embed.xyz', 'cdn10embed.xyz'),
          sanitizedHeaders
        )
      }

      // Se houver Referer, registra também para o domínio do Referer caso sub-requisições ocorram
      if (sanitizedHeaders['Referer']) {
        try {
          const refParsed = new URL(sanitizedHeaders['Referer'])
          this.headersByHost.set(refParsed.hostname.toLowerCase(), sanitizedHeaders)
        } catch {}
      }
    } catch {}
  }

  /**
   * Recupera os cabeçalhos registrados para uma URL específica ou pelo domínio/host correspondente.
   */
  public getHeadersForUrl(url: string): Record<string, string> | undefined {
    if (!url || typeof url !== 'string') return undefined

    // 1. Busca exata por URL completa
    if (this.headersByUrl.has(url)) {
      return this.headersByUrl.get(url)
    }

    // 2. Busca por Host e Origin
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      if (this.headersByHost.has(host)) {
        return this.headersByHost.get(host)
      }

      const origin = parsed.origin.toLowerCase()
      if (this.headersByHost.has(origin)) {
        return this.headersByHost.get(origin)
      }
    } catch {}

    return undefined
  }

  /**
   * Limpa todos os cabeçalhos registrados
   */
  public clear(): void {
    this.headersByUrl.clear()
    this.headersByHost.clear()
  }
}
