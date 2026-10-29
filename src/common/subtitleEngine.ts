export interface ParsedSubtitleCue {
  id?: string
  startTime: number
  endTime: number
  text: string
}

export function parseVttContent(rawText: string): ParsedSubtitleCue[] {
  if (!rawText) return []
  const cues: ParsedSubtitleCue[] = []
  const normalized = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r/g, '\n')
    .trim()
  const blocks = normalized.split(/\n\s*\n/)

  const timeRegex =
    /((?:(?:\d{1,2}:)?\d{1,2}:\d{2}[\.,]\d{1,3}))\s*-->\s*((?:(?:\d{1,2}:)?\d{1,2}:\d{2}[\.,]\d{1,3}))/

  function parseSeconds(timeStr: string): number {
    const parts = timeStr.trim().replace(',', '.').split(':')
    if (parts.length === 3) {
      return (
        parseFloat(parts[0]) * 3600 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2])
      )
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
    }
    return 0
  }

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length || lines[0] === 'WEBVTT') continue

    let timeLineIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIdx = i
        break
      }
    }
    if (timeLineIdx === -1) continue

    const match = lines[timeLineIdx].match(timeRegex)
    if (!match) continue

    const startSec = parseSeconds(match[1])
    const endSec = parseSeconds(match[2])
    const textLines = lines.slice(timeLineIdx + 1)
    const text = textLines.join('\n')

    if (text) {
      cues.push({
        startTime: startSec,
        endTime: endSec,
        text
      })
    }
  }
  return cues.sort((a, b) => a.startTime - b.startTime)
}

export function findCueAtTime(
  cues: ParsedSubtitleCue[],
  time: number
): ParsedSubtitleCue | null {
  if (!cues || !cues.length) return null
  const matching: ParsedSubtitleCue[] = []
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]
    if (time >= c.startTime && time <= c.endTime) {
      matching.push(c)
    }
    if (c.startTime > time + 10) {
      break
    }
  }
  if (!matching.length) return null
  if (matching.length === 1) return matching[0]

  const uniqueTexts: string[] = []
  for (const m of matching) {
    if (!uniqueTexts.includes(m.text)) {
      uniqueTexts.push(m.text)
    }
  }

  return {
    startTime: matching[0].startTime,
    endTime: Math.max(...matching.map((m) => m.endTime)),
    text: uniqueTexts.join('\n')
  }
}

export function sanitizeSubtitleHtml(rawText: string): string {
  if (!rawText) return ''
  let html = rawText.replace(/\r\n|\r|\n/g, '<br />')
  html = html.replace(
    /<\/?(script|iframe|object|embed|style|meta|link)[^>]*>/gi,
    ''
  )
  html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  return html
}


/**
 * Localiza a fala mais próxima ao timestamp atual (janela de busca de até 30 segundos).
 * Usado pelo mecanismo de AutoSync (Nuvio Reshaped Style) para alinhar legendas externas com o áudio.
 */
export function findClosestCue(
  cues: ParsedSubtitleCue[],
  time: number,
  maxWindowSeconds = 30
): ParsedSubtitleCue | null {
  if (!cues || !cues.length) return null
  let closest: ParsedSubtitleCue | null = null
  let minDiff = Infinity

  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]
    const diff = Math.abs(c.startTime - time)
    if (diff < minDiff && diff <= maxWindowSeconds) {
      minDiff = diff
      closest = c
    }
  }
  return closest
}

/**
 * Calcula o offset de sincronização automática (AutoSync) entre a posição do vídeo e a fala mais próxima.
 * Retorna o novo delay em segundos e o texto da fala sincronizada.
 */
export function calculateAutoSyncOffset(
  cues: ParsedSubtitleCue[],
  currentTime: number,
  currentDelay = 0
): { newDelay: number; deltaSeconds: number; matchedCueText?: string } | null {
  if (!cues || cues.length === 0 || currentTime <= 0) return null

  // O tempo em que a legenda está sendo renderizada no momento
  const adjustedTime = currentTime - currentDelay
  const closest = findClosestCue(cues, adjustedTime)
  if (!closest) return null

  // Queremos que closest.startTime passe a aparecer exatamente em currentTime.
  // Novo delay = currentTime - closest.startTime
  const newDelay = Number((currentTime - closest.startTime).toFixed(2))
  const deltaSeconds = Number((newDelay - currentDelay).toFixed(2))

  return {
    newDelay,
    deltaSeconds,
    matchedCueText: closest.text.replace(/<[^>]*>/g, '').trim()
  }
}

/**
 * Aplica fator de compensação de Framerate (23.976 fps -> 25 fps ou 25 fps -> 23.976 fps).
 */
export function applyFramerateCorrection(
  currentDelay: number,
  direction: 'to25' | 'to23976'
): number {
  const ratio = direction === 'to25' ? 25 / 23.976 : 23.976 / 25
  return Number((currentDelay * ratio).toFixed(2))
}
