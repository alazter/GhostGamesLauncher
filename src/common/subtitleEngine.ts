export interface ParsedSubtitleCue {
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
