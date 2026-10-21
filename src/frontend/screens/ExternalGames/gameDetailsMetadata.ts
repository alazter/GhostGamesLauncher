import type { GhostSearchResult } from 'common/types/plugins'

export function detailsVersion(game: GhostSearchResult): string {
  const version = game.version?.trim()
  if (!version) return 'Versão não informada'
  const build = version.match(/^(?:build|b)\s*(\d+)$/i)
  return build ? `B ${build[1]}` : version
}

const genreTranslations: Record<string, string> = {
  action: 'Ação',
  adventure: 'Aventura',
  singleplayer: 'Um jogador',
  'single player': 'Um jogador',
  'character customization': 'Personalização de personagem',
  colorful: 'Colorido',
  combat: 'Combate',
  'score attack': 'Ataque de pontuação',
  'co-op': 'Cooperativo',
  cooperative: 'Cooperativo',
  fighting: 'Luta',
  simulation: 'Simulação',
  strategy: 'Estratégia',
  racing: 'Corrida',
  sports: 'Esportes',
  survival: 'Sobrevivência',
  horror: 'Terror'
}

export function detailsGenres(genre?: string, mode?: string): string[] {
  return [
    ...new Set(
      [genre, mode]
        .filter(Boolean)
        .join(',')
        .split(/[,;|]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => genreTranslations[tag.toLowerCase()] || tag)
    )
  ]
}

export function translatedCompatibility(value?: string): string {
  if (!value) return 'Não informado'
  return value
    .replace(/unsupported/gi, 'Não compatível')
    .replace(/supported/gi, 'Compatível')
    .replace(/verified/gi, 'Verificado')
    .replace(/playable/gi, 'Jogável')
    .replace(/unknown/gi, 'Não informado')
    .replace(/\b(?:full|total)\b/gi, 'Completo')
    .replace(/partial/gi, 'Parcial')
}

export function installedSizeBytes(value?: string): number | undefined {
  const match = value
    ?.trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*(B|K(?:i)?B|M(?:i)?B|G(?:i)?B|T(?:i)?B)$/i)
  if (!match) return undefined
  const bytes =
    Number(match[1].replace(',', '.')) *
    1024 ** 'BKMGT'.indexOf(match[2][0].toUpperCase())
  return Number.isFinite(bytes) && bytes > 0 ? bytes : undefined
}

export function freeSpaceLabel(bytes?: number): string {
  if (bytes === undefined) return 'Espaço indisponível'
  const power = bytes >= 1024 ** 4 ? 4 : bytes >= 1024 ** 3 ? 3 : 2
  return `${(bytes / 1024 ** power).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB', 'TB'][power]} livres`
}
