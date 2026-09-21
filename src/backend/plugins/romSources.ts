import type { PluginManifest } from 'common/types/plugins'
import { TRUSTED_GAME_MIRROR_DOMAINS } from './networkGuard'

export const ROM_SOURCES = [
  { id: 'com.ghost.nxbrew-source', name: 'NXBrew', domain: 'nxbrew.net' },
  { id: 'com.ghost.nswgf-source', name: 'NSWGF', domain: 'nswgf.com' },
  { id: 'com.ghost.romslab-source', name: 'RomsLab', domain: 'romslab.com' }
] as const
export const ROM_DIRECT_ID = 'rom-browser-direct'
export function romSource(id: string) {
  return ROM_SOURCES.find((source) => source.id === id)
}
export function romPageUrl(id: string, value: string): string {
  const source = romSource(id)
  const url = new URL(value)
  if (
    !source ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    ![source.domain, `www.${source.domain}`].includes(url.hostname) ||
    url.pathname === '/'
  )
    throw new Error('Página da ROM inválida para esta fonte.')
  url.hash = ''
  return url.href
}
export function romManifest(id: string): PluginManifest {
  const source = romSource(id)
  if (!source) throw new Error('Fonte de ROM não reconhecida.')
  return {
    id,
    name: source.name,
    version: '1.0.0',
    description: 'Download de ROM',
    author: 'Ghost',
    type: 'game-source',
    permissions: ['network'],
    allowedDomains: [
      source.domain,
      ...TRUSTED_GAME_MIRROR_DOMAINS,
      ...(source.name === 'RomsLab' ? ['filekeeper.net'] : [])
    ]
  }
}
