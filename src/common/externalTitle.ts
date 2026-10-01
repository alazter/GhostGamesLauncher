/** Strip release metadata without treating a sequel number as a version. */
export function externalTitleKey(title: string): string {
  return title
    .replace(
      /\b(?:v|ver|version|versão|build)\s*[.:_-]?\s*\d+(?:\.\d+)*\b/gi,
      ' '
    )
    .replace(/[\[(].*?[\])]/g, ' ')
    .replace(/\b\d+(?:\.\d+)+\b/g, ' ')
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(
      /\b(?:free download|download game free|baixar grátis|remastered|deluxe edition|definitive edition|edition|version|versão|build)\b/gi,
      ' '
    )
    .replace(
      /\b(?:ofme|rune|tenoke|codex|skidrow|flt|reloaded|hoodlum|empress|cpy|elamigos|fitgirl|dodi|goldberg|clean steam files|own csf)\b/gi,
      ' '
    )
    .replace(/([a-z])\.(?=[a-z]|\s|$)/gi, '$1')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hasRequestedTitleNumbers(
  title: string,
  query: string
): boolean {
  const requested = externalTitleKey(query).match(/\b\d+\b/g) || []
  const actual = new Set(externalTitleKey(title).match(/\b\d+\b/g) || [])
  return requested.every((number) => actual.has(number))
}

export function externalTitleGroupKey(
  title: string,
  platform = 'windows'
): string {
  return JSON.stringify([platform, externalTitleKey(title)])
}
