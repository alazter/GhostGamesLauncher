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
