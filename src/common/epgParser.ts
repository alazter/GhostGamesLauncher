/**
 * Ghost Games Launcher - Safe XMLTV (EPG) Guide Parser & Matcher
 * Suporte a Guia de Programação Eletrônica (EPG) para listas M3U/M3U8.
 * Algoritmo de correspondência compatível com o padrão TiviMate:
 * 1. Igualar tvg-id do M3U com channel id do XML;
 * 2. Se falhar, igualar nome do canal M3U com display-name ou channel id do XML;
 * 3. Se falhar, permitir ao usuário atribuir manualmente via "Atribuir EPG".
 */

import { XMLParser } from 'fast-xml-parser'
import type {
  GhostEpgChannel,
  GhostEpgProgram,
  GhostTvChannel
} from './types/plugins'

export interface ParsedEpgResult {
  channels: GhostEpgChannel[]
  programs: GhostEpgProgram[]
  totalChannels: number
  totalPrograms: number
}

/**
 * Converte strings de datas do padrão XMLTV (YYYYMMDDHHmmss [+/-HHMM]) em milissegundos UTC.
 */
export function parseXmltvDate(dateStr: string): number {
  if (!dateStr || typeof dateStr !== 'string') return 0
  const trimmed = dateStr.trim()
  const match = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?(?:\s*([+-]\d{4}))?/
  )
  if (!match) {
    const fallback = Date.parse(trimmed)
    return isNaN(fallback) ? 0 : fallback
  }

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1
  const day = parseInt(match[3], 10)
  const hour = match[4] ? parseInt(match[4], 10) : 0
  const minute = match[5] ? parseInt(match[5], 10) : 0
  const second = match[6] ? parseInt(match[6], 10) : 0
  const tz = match[7]

  let utcMs = Date.UTC(year, month, day, hour, minute, second)
  if (tz) {
    const sign = tz[0] === '-' ? -1 : 1
    const tzHours = parseInt(tz.substring(1, 3), 10)
    const tzMins = parseInt(tz.substring(3, 5), 10)
    const offsetMs = sign * (tzHours * 60 + tzMins) * 60 * 1000
    utcMs -= offsetMs
  }
  return utcMs
}

/**
 * Formata timestamp em horário legível HH:MM no fuso local.
 */
export function formatTime(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Calcula a porcentagem decorrida de um programa no ar (0 a 100%).
 */
export function calculateProgress(
  startMs: number,
  stopMs: number,
  nowMs = Date.now()
): number {
  if (!startMs || !stopMs || stopMs <= startMs) return 0
  if (nowMs <= startMs) return 0
  if (nowMs >= stopMs) return 100
  return Math.min(
    100,
    Math.max(0, Math.round(((nowMs - startMs) / (stopMs - startMs)) * 100))
  )
}

function extractText(val: any): string {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) {
    for (const item of val) {
      const text = extractText(item)
      if (text) return text
    }
    return ''
  }
  if (typeof val === 'object') {
    if (val['#text']) return String(val['#text']).trim()
    if (val._text) return String(val._text).trim()
  }
  return ''
}

function extractDisplayName(val: any): string {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (Array.isArray(val)) {
    for (const item of val) {
      const t = extractText(item)
      if (t) return t
    }
  }
  if (typeof val === 'object') {
    return extractText(val)
  }
  return ''
}

function extractIcon(val: any): string | undefined {
  if (!val) return undefined
  if (Array.isArray(val)) {
    for (const item of val) {
      const icon = extractIcon(item)
      if (icon) return icon
    }
  }
  if (typeof val === 'object') {
    const src = val['@_src'] || val.src || val['#text']
    if (
      src &&
      typeof src === 'string' &&
      (src.startsWith('http://') || src.startsWith('https://'))
    ) {
      return src.trim()
    }
  }
  return undefined
}

/**
 * Normaliza o nome do canal para correspondência fonética e textual resiliente.
 */
export function normalizeChannelName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(
      /\b(fhd|hd|sd|4k|uhd|hevc|h265|h264|raw|vip|plus|\+|canal|tv|brasil|br)\b/gi,
      ''
    )
    .replace(/\[.*?\]|\(.*?\)|\|/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Realiza o parsing em memória de conteúdo XMLTV.
 */
export function parseXmltv(
  xmlContent: string,
  options?: { maxPrograms?: number }
): ParsedEpgResult {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return { channels: [], programs: [], totalChannels: 0, totalPrograms: 0 }
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    isArray: (name) => name === 'channel' || name === 'programme'
  })

  let raw: any
  try {
    raw = parser.parse(xmlContent)
  } catch (err) {
    console.error('[Ghost EPG] Erro no parsing XMLTV:', err)
    return { channels: [], programs: [], totalChannels: 0, totalPrograms: 0 }
  }

  const tv = raw?.tv || raw?.TV || raw
  if (!tv) {
    return { channels: [], programs: [], totalChannels: 0, totalPrograms: 0 }
  }

  const channels: GhostEpgChannel[] = []
  const channelMap = new Set<string>()

  const rawChannels = Array.isArray(tv.channel)
    ? tv.channel
    : tv.channel
      ? [tv.channel]
      : []

  for (const ch of rawChannels) {
    const id = ch['@_id']
    if (!id) continue
    const cleanId = String(id).trim()
    if (!channelMap.has(cleanId)) {
      channelMap.add(cleanId)
      channels.push({
        id: cleanId,
        displayName:
          extractDisplayName(ch['display-name']) || cleanId,
        icon: extractIcon(ch.icon)
      })
    }
  }

  const programs: GhostEpgProgram[] = []
  const maxPrograms = options?.maxPrograms || 50000

  const rawPrograms = Array.isArray(tv.programme)
    ? tv.programme
    : tv.programme
      ? [tv.programme]
      : []

  for (const prog of rawPrograms) {
    const channelId = prog['@_channel']
    if (!channelId) continue
    const startMs = parseXmltvDate(prog['@_start'])
    const stopMs = parseXmltvDate(prog['@_stop'])
    if (!startMs || !stopMs) continue

    programs.push({
      channelId: String(channelId).trim(),
      title: extractText(prog.title) || 'Sem título',
      description: extractText(prog.desc) || undefined,
      category: extractText(prog.category) || undefined,
      start: startMs,
      stop: stopMs,
      startFormatted: formatTime(startMs),
      stopFormatted: formatTime(stopMs),
      icon: extractIcon(prog.icon)
    })

    if (programs.length >= maxPrograms) {
      break
    }
  }

  programs.sort((a, b) => a.start - b.start)

  return {
    channels,
    programs,
    totalChannels: channels.length,
    totalPrograms: programs.length
  }
}

/**
 * Algoritmo de correspondência compatível com o TiviMate:
 * Passo 0: Verifica se há atribuição manual gravada pelo usuário;
 * Passo 1: Tenta igualar o ID do canal M3U (tvg-id) com o ID do canal XML;
 * Passo 2: Se falhar, tenta igualar o nome do canal M3U com display-name ou channel id do XML;
 * Passo 3: Se falhar novamente, retorna null (permitindo ao usuário usar "Atribuir EPG").
 */
export function matchChannelWithEpg(
  channel: GhostTvChannel,
  epgChannels: GhostEpgChannel[],
  manualAssignments?: Record<string, string>
): GhostEpgChannel | null {
  if (!channel || !Array.isArray(epgChannels) || epgChannels.length === 0) {
    return null
  }

  // Passo 0: Atribuição manual persistida pelo usuário
  const manualId = manualAssignments?.[channel.id] || channel.assignedEpgId
  if (manualId) {
    const manualFound = epgChannels.find((c) => c.id === manualId)
    if (manualFound) return manualFound
  }

  // Passo 1: Igualar ID do canal m3u (tvg-id) com ID do canal XML
  if (channel.tvgId) {
    const targetId = channel.tvgId.trim().toLowerCase()
    const idMatch = epgChannels.find((c) => c.id.toLowerCase() === targetId)
    if (idMatch) return idMatch
  }

  // Passo 2: Igualar nome do canal do m3u com display-name ou ID do canal do XML
  const candidateNames = [channel.tvgName, channel.name].filter(
    (n): n is string => Boolean(n && n.trim())
  )

  // 2a. Comparação direta (case-insensitive)
  for (const cName of candidateNames) {
    const lower = cName.trim().toLowerCase()
    const nameMatch = epgChannels.find(
      (c) =>
        c.displayName.trim().toLowerCase() === lower ||
        c.id.trim().toLowerCase() === lower
    )
    if (nameMatch) return nameMatch
  }

  // 2b. Comparação normalizada (sem acentos, sem tags [HD], sem pontuação)
  for (const cName of candidateNames) {
    const norm = normalizeChannelName(cName)
    if (!norm) continue
    const normMatch = epgChannels.find(
      (c) =>
        normalizeChannelName(c.displayName) === norm ||
        normalizeChannelName(c.id) === norm
    )
    if (normMatch) return normMatch
  }

  // Passo 3: Se falhar novamente, não atribui automaticamente (opção Atribuir EPG do usuário)
  return null
}

/**
 * Localiza o programa atual no ar e o próximo programa para um canal vinculado.
 */
export function resolveChannelPrograms(
  matchedEpgChannelId: string,
  programs: GhostEpgProgram[],
  now = Date.now()
): {
  currentProgram?: GhostEpgProgram
  nextProgram?: GhostEpgProgram
  schedule: GhostEpgProgram[]
} {
  if (!matchedEpgChannelId || !Array.isArray(programs) || programs.length === 0) {
    return { schedule: [] }
  }

  const channelPrograms = programs.filter(
    (p) => p.channelId === matchedEpgChannelId
  )
  if (channelPrograms.length === 0) {
    return { schedule: [] }
  }

  let currentProgram: GhostEpgProgram | undefined
  let nextProgram: GhostEpgProgram | undefined

  for (let i = 0; i < channelPrograms.length; i++) {
    const p = channelPrograms[i]
    if (p.start <= now && p.stop > now) {
      currentProgram = {
        ...p,
        progressPercent: calculateProgress(p.start, p.stop, now)
      }
      nextProgram = channelPrograms[i + 1]
      break
    } else if (p.start > now && !nextProgram) {
      nextProgram = p
    }
  }

  return {
    currentProgram,
    nextProgram,
    schedule: channelPrograms
  }
}
