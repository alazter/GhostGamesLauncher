import { Runner } from './types'

export const storeMap: { [key in Runner]: string | undefined } = {
  legendary: 'epic',
  gog: 'gog',
  nile: 'amazon',
  sideload: undefined,
  zoom: 'zoom',
  steam: 'steam'
}

// Comparador semântico resiliente para SemVer, Builds, datas e updates de Switch
export function isNewerRelease(
  current: string | undefined,
  next: string | undefined
): boolean {
  if (!current || !next) return false
  const cleanCurrent = current.trim().toLowerCase()
  const cleanNext = next.trim().toLowerCase()
  if (cleanCurrent === cleanNext) return false

  // 1. Tratamento de Datas: ISO (YYYY-MM-DD ou YYYY.MM.DD)
  const parseDate = (val: string) => {
    const match = val.match(/\b(\d{4})[.-](\d{2})[.-](\d{2})\b/)
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null
  }
  const dateA = parseDate(cleanCurrent)
  const dateB = parseDate(cleanNext)
  if (dateA || dateB) {
    if (dateA && dateB) return dateB > dateA
    return false
  }

  // 2. Builds explícitos: "Build 123"
  const parseBuild = (val: string) => {
    const match = val.match(/\bbuild\s*(\d+)\b/i)
    return match ? Number(match[1]) : null
  }
  const buildA = parseBuild(cleanCurrent)
  const buildB = parseBuild(cleanNext)
  if (buildA !== null || buildB !== null) {
    if (buildA !== null && buildB !== null) return buildB > buildA
    return false
  }

  // 3. SemVer / Versão pontuada: "1.9", "1.10", "v1.2.3"
  const parseSemver = (val: string) => {
    const match = val.match(/^(?:v)?\s*(\d+(?:\.\d+)+)/i)
    return match ? match[1].split('.').map(Number) : null
  }
  const semA = parseSemver(cleanCurrent)
  const semB = parseSemver(cleanNext)
  if (semA || semB) {
    if (semA && semB) {
      const maxLen = Math.max(semA.length, semB.length)
      for (let i = 0; i < maxLen; i++) {
        const a = semA[i] ?? 0
        const b = semB[i] ?? 0
        if (b !== a) return b > a
      }
      return false
    }
    return false
  }

  // 4. Versões numéricas inteiras do Switch (ex: v131072 vs v65536)
  const parseIntVer = (val: string) => {
    const match = val.match(/^(?:v)?(\d+)$/i)
    return match ? Number(match[1]) : null
  }
  const intA = parseIntVer(cleanCurrent)
  const intB = parseIntVer(cleanNext)
  if (intA !== null && intB !== null) {
    return intB > intA
  }

  return false
}

const MONTH_NAMES_TO_NUMBER: Record<string, string> = {
  // English
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
  // Portuguese
  janeiro: '01',
  fevereiro: '02',
  marco: '03', março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
  // Russian
  янв: '01', января: '01', январь: '01',
  фев: '02', февраля: '02', февраль: '02',
  мар: '03', марта: '03', март: '03',
  апр: '04', апреля: '04', апрель: '04',
  май: '05', мая: '05',
  июн: '06', июня: '06', июнь: '06',
  июл: '07', июля: '07', июль: '07',
  авг: '08', августа: '08', август: '08',
  сен: '09', сентября: '09', сентябрь: '09',
  окт: '10', октября: '10', октябрь: '10',
  ноя: '11', ноября: '11', ноябрь: '11',
  дек: '12', декабря: '12', декабрь: '12'
}

/**
 * Converte datas heterogêneas de lojas e repacks (ISO, EN, PT, RU, DD/MM/YYYY) para ISO YYYY-MM-DD
 */
export function parseDateToIso(rawDate: string | undefined): string | undefined {
  if (!rawDate) return undefined
  let clean = rawDate
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:last\s*updated|updated\s*on|published\s*on|posted\s*on|data\s*de\s*atualização|дата\s*обновления|date|data)[:\s_-]*/i, '')
    .replace(/(?:at|às|в)\s+\d{1,2}:\d{2}(?::\d{2})?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return undefined

  // 1. ISO direto: YYYY-MM-DD (com ou sem timestamp T...)
  const isoMatch = clean.match(/(?:^|[^\d])(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]|$|[^\d])/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2].padStart(2, '0')
    const d = isoMatch[3].padStart(2, '0')
    const numM = Number(m)
    const numD = Number(d)
    if (numM >= 1 && numM <= 12 && numD >= 1 && numD <= 31) {
      return `${y}-${m}-${d}`
    }
  }

  // 2. Mês por extenso seguido do dia e ano (ex: "September 29, 2026", "Sep 11, 2026")
  const monthFirstMatch = clean.match(/\b([a-zA-Z\u0400-\u04FF]+)\s+(\d{1,2}),?\s+(\d{4})\b/i)
  if (monthFirstMatch) {
    const monthKey = monthFirstMatch[1].toLowerCase()
    const m = MONTH_NAMES_TO_NUMBER[monthKey] || MONTH_NAMES_TO_NUMBER[monthKey.slice(0, 3)]
    if (m) {
      const d = monthFirstMatch[2].padStart(2, '0')
      const y = monthFirstMatch[3]
      return `${y}-${m}-${d}`
    }
  }

  // 3. Dia seguido do mês por extenso e ano (ex: "29 September 2026", "29 de Setembro de 2026", "29 сентября 2026")
  const dayFirstMatch = clean.match(/\b(\d{1,2})(?:\s+de)?\s+([a-zA-Z\u0400-\u04FF]+),?(?:\s+de)?\s+(\d{4})\b/i)
  if (dayFirstMatch) {
    const monthKey = dayFirstMatch[2].toLowerCase()
    const m = MONTH_NAMES_TO_NUMBER[monthKey] || MONTH_NAMES_TO_NUMBER[monthKey.slice(0, 3)]
    if (m) {
      const d = dayFirstMatch[1].padStart(2, '0')
      const y = dayFirstMatch[3]
      return `${y}-${m}-${d}`
    }
  }

  // 4. Numérico DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmyMatch = clean.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/)
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0')
    const m = dmyMatch[2].padStart(2, '0')
    const y = dmyMatch[3]
    const numM = Number(m)
    const numD = Number(d)
    if (numM >= 1 && numM <= 12 && numD >= 1 && numD <= 31) {
      return `${y}-${m}-${d}`
    }
  }

  return undefined
}

export interface GameReleaseCandidate {
  version?: string
  sourceDate?: string // ISO YYYY-MM-DD
  uploadDate?: string // Raw or human date
}

export interface ReleaseComparisonResult {
  isNewer: boolean
  reason: 'date' | 'version' | 'same' | 'unknown'
}

/**
 * Comparador universal híbrido:
 * 1. PRIORIDADE PRIMÁRIA: Data de Last Updated / Publicação na Fonte (sourceDate)
 * 2. PRIORIDADE SECUNDÁRIA / DESEMPATE: SemVer, Builds e Versões (version)
 */
export function isNewerGameRelease(
  current: GameReleaseCandidate | undefined,
  next: GameReleaseCandidate | undefined
): ReleaseComparisonResult {
  if (!current || !next) return { isNewer: false, reason: 'unknown' }

  const curDate = (current.sourceDate ? parseDateToIso(current.sourceDate) : undefined) || parseDateToIso(current.uploadDate)
  const nextDate = (next.sourceDate ? parseDateToIso(next.sourceDate) : undefined) || parseDateToIso(next.uploadDate)

  // 1. REGRA PRIMÁRIA SOBERANA: Data do Last Updated / Publicação na Fonte
  if (curDate && nextDate) {
    if (nextDate > curDate) {
      return { isNewer: true, reason: 'date' }
    }
    if (nextDate < curDate) {
      return { isNewer: false, reason: 'date' }
    }
    // Se as datas forem exatamente idênticas, desempata pela versão abaixo
  }

  // 2. REGRA SECUNDÁRIA / DESEMPATE: SemVer, Builds, Versões Numéricas
  if (current.version && next.version) {
    if (isNewerRelease(current.version, next.version)) {
      return { isNewer: true, reason: 'version' }
    }
    if (isNewerRelease(next.version, current.version)) {
      return { isNewer: false, reason: 'version' }
    }
    const cleanCur = current.version.trim().toLowerCase().replace(/^v(?:ersion|er)?[ ._-]*/, '')
    const cleanNext = next.version.trim().toLowerCase().replace(/^v(?:ersion|er)?[ ._-]*/, '')
    if (cleanCur && cleanNext && cleanCur === cleanNext) {
      return { isNewer: false, reason: 'same' }
    }
  }

  return { isNewer: false, reason: 'unknown' }
}
