/**
 * Ghost Games Launcher - Safe M3U & M3U8 Playlist Parser
 * Permite reprodução de IPTV e listas de canais em ambiente estritamente seguro,
 * isolado contra esquemas maliciosos (file:, javascript:, data:, etc.) e executáveis.
 */

import type { GhostTvChannel } from './types/plugins'

export interface ParsedM3uResult {
  channels: GhostTvChannel[]
  groups: string[]
  totalCount: number
  epgUrl?: string
}

// Regex segura para atributos de #EXTINF
const ATTR_REGEX = /([a-zA-Z0-9_-]+)=["']([^"']*)["']/g
const ATTR_UNQUOTED_REGEX = /([a-zA-Z0-9_-]+)=([^\s,]+)/g

// Extensões de arquivos estritamente proibidas para proteção do sistema
const FORBIDDEN_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.msi',
  '.ps1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.scr',
  '.com',
  '.pif',
  '.jar',
  '.dll',
  '.reg',
  '.inf',
  '.sh',
  '.bin'
])

/**
 * Validação rigorosa de segurança para URLs de streaming
 * Apenas protocolos http:// e https:// são aceitos.
 * Qualquer tentativa de file://, javascript:, data:, unc paths ou executáveis é descartada.
 */
export function isSafeStreamUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  if (!trimmed) return false

  // Apenas http:// ou https://
  const lower = trimmed.toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return false
  }

  // Previne caminhos UNC ou escapes
  if (lower.startsWith('http:////') || lower.startsWith('https:////')) {
    return false
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    // Bloqueia tentativas de execução de binários
    const pathname = parsed.pathname.toLowerCase()
    for (const ext of FORBIDDEN_EXTENSIONS) {
      if (pathname.endsWith(ext) || pathname.includes(`${ext}/`)) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * Gera um hash numérico determinístico para IDs estáveis de canais
 */
function generateChannelId(url: string, name: string): string {
  let hash = 0
  const combined = `${url}#${name}`
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i)
    hash |= 0
  }
  return `tv-${Math.abs(hash).toString(36)}`
}

/**
 * Parser determinístico e em memória de listas M3U e M3U8
 */
export function parseM3u(
  content: string,
  options?: {
    playlistId?: string
    defaultGroup?: string
    maxChannels?: number
  }
): ParsedM3uResult {
  if (!content || typeof content !== 'string') {
    return { channels: [], groups: [], totalCount: 0 }
  }

  const maxChannels = options?.maxChannels || 15000
  const lines = content.split(/\r?\n/)
  const channels: GhostTvChannel[] = []
  const groupSet = new Set<string>()

  let currentAttributes: Record<string, string> = {}
  let currentTitle = ''
  let currentGroup = options?.defaultGroup || 'Geral'
  let globalGroup = options?.defaultGroup || 'Geral'
  let currentHeaders: Record<string, string> | undefined
  let extractedEpgUrl: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (rawLine.startsWith('#EXTM3U')) {
      const epgMatch =
        rawLine.match(/(?:url-tvg|x-tvg-url)=["']([^"']+)["']/i) ||
        rawLine.match(/(?:url-tvg|x-tvg-url)=([^\s,]+)/i)
      if (epgMatch && isSafeStreamUrl(epgMatch[1].trim())) {
        extractedEpgUrl = epgMatch[1].trim()
      }
    }
    const line = lines[i].trim()
    if (!line) continue

    if (line.startsWith('#EXTGRP:')) {
      const grp = line.substring(8).trim()
      if (grp) {
        currentGroup = grp
        globalGroup = grp
      }
    } else if (line.startsWith('#EXTINF:')) {
      currentAttributes = {}
      currentGroup = globalGroup

      // Extrai tudo antes da vírgula para atributos e após a vírgula para o título
      const commaIndex = line.indexOf(',')
      let attrPart = ''
      if (commaIndex !== -1) {
        attrPart = line.substring(8, commaIndex).trim()
        currentTitle = line.substring(commaIndex + 1).trim()
      } else {
        attrPart = line.substring(8).trim()
        currentTitle = ''
      }

      // Parse atributos entre aspas
      ATTR_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = ATTR_REGEX.exec(attrPart)) !== null) {
        currentAttributes[match[1].toLowerCase()] = match[2].trim()
      }

      // Parse atributos sem aspas (fallback)
      ATTR_UNQUOTED_REGEX.lastIndex = 0
      while ((match = ATTR_UNQUOTED_REGEX.exec(attrPart)) !== null) {
        const key = match[1].toLowerCase()
        if (!currentAttributes[key]) {
          currentAttributes[key] = match[2].trim()
        }
      }

      if (currentAttributes['group-title']) {
        currentGroup = currentAttributes['group-title']
      }
      if (currentAttributes['tvg-name'] && !currentTitle) {
        currentTitle = currentAttributes['tvg-name']
      }
    } else if (line.startsWith('#EXTGRP:')) {
      const grp = line.substring(8).trim()
      if (grp) currentGroup = grp
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const vlcOpt = line.substring(11).trim()
      const eqIdx = vlcOpt.indexOf('=')
      if (eqIdx !== -1) {
        const k = vlcOpt.substring(0, eqIdx).trim().toLowerCase()
        const v = vlcOpt.substring(eqIdx + 1).trim()
        if (!currentHeaders) currentHeaders = {}
        if (k === 'http-user-agent') currentHeaders['User-Agent'] = v
        else if (k === 'http-referrer') currentHeaders['Referer'] = v
        else currentHeaders[k] = v
      }
    } else if (!line.startsWith('#')) {
      // Linha de URL de stream com suporte a Pipe syntax IPTV (ex: http://stream.m3u8|User-Agent=...&Referer=...)
      let streamUrl = line
      let customHeaders = currentHeaders ? { ...currentHeaders } : undefined

      if (line.includes('|')) {
        const pipeIdx = line.indexOf('|')
        streamUrl = line.substring(0, pipeIdx).trim()
        const headerPart = line.substring(pipeIdx + 1).trim()
        if (headerPart) {
          if (!customHeaders) customHeaders = {}
          const pairs = headerPart.split('&')
          for (const pair of pairs) {
            const eqIdx = pair.indexOf('=')
            if (eqIdx !== -1) {
              const hKey = pair.substring(0, eqIdx).trim()
              const hVal = decodeURIComponent(pair.substring(eqIdx + 1).trim())
              customHeaders[hKey] = hVal
            }
          }
        }
      }

      if (isSafeStreamUrl(streamUrl)) {
        const name = currentTitle || currentAttributes['tvg-name'] || `Canal ${channels.length + 1}`
        const logo = isSafeStreamUrl(currentAttributes['tvg-logo'] || '')
          ? currentAttributes['tvg-logo']
          : undefined

        const channel: GhostTvChannel = {
          id: generateChannelId(streamUrl, name),
          name,
          logo,
          url: streamUrl,
          group: currentGroup || 'Geral',
          tvgId: currentAttributes['tvg-id'],
          tvgName: currentAttributes['tvg-name'],
          sourceType: streamUrl.toLowerCase().includes('.m3u8') ? 'm3u8' : 'm3u',
          playlistId: options?.playlistId,
          customHeaders
        }

        channels.push(channel)
        groupSet.add(channel.group)

        if (channels.length >= maxChannels) {
          break
        }
      }

      // Reseta estado para a próxima entrada
      currentAttributes = {}
      currentHeaders = undefined
      currentTitle = ''
      currentGroup = options?.defaultGroup || 'Geral'
    }
  }

  const sortedGroups = Array.from(groupSet).sort((a, b) => a.localeCompare(b))

  return {
    channels,
    groups: sortedGroups,
    totalCount: channels.length,
    epgUrl: extractedEpgUrl
  }
}
