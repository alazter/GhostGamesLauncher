import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { isIP } from 'net'
import { builtinGameSources } from 'common/builtinGameSources'
import type { SourceSettings } from 'common/types/plugins'

const recent = new Map<string, { origin: string; until: number }>()
let settings: Record<string, SourceSettings> | undefined
let settingsRoot: string | undefined
export function initializeSourceSettings(root: string) {
  settingsRoot = root
  settings = undefined
  recent.clear()
  state()
}
function state() {
  if (!settings) {
    if (!settingsRoot) return {}
    const file = join(settingsRoot, 'source-addresses.json')
    settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  }
  return settings!
}
export function normalizeSourceOrigin(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    isIP(url.hostname) ||
    !url.hostname.includes('.') ||
    /\.(local|localhost|internal)$/i.test(url.hostname)
  )
    throw new Error(
      'Informe somente o endereço HTTPS público do site, sem caminho, senha ou porta.'
    )
  return url.origin
}
export function sourceSettings(id: string): SourceSettings {
  const source = builtinGameSources.find((item) => item.id === id)
  if (!source)
    throw new Error('Esta fonte não oferece configuração de endereços.')
  const original = `https://${source.domain}`
  const saved = state()[id]
  return {
    original,
    additional: saved?.additional || [],
    preferred: saved?.preferred || original
  }
}
export function saveSourceSettings(
  id: string,
  input: SourceSettings
): SourceSettings {
  const original = sourceSettings(id).original
  if (!Array.isArray(input.additional) || input.additional.length > 8)
    throw new Error('Adicione no máximo oito endereços.')
  const additional = [
    ...new Set(input.additional.map(normalizeSourceOrigin))
  ].filter((url) => url !== original)
  const preferred = normalizeSourceOrigin(input.preferred)
  if (![original, ...additional].includes(preferred))
    throw new Error('Selecione um endereço cadastrado.')
  const result = { original, additional, preferred }
  const next = { ...state(), [id]: result }
  if (!settingsRoot)
    throw new Error('Configurações de fontes ainda não inicializadas.')
  mkdirSync(settingsRoot, { recursive: true })
  const file = join(settingsRoot, 'source-addresses.json')
  writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2))
  renameSync(`${file}.tmp`, file)
  settings = next
  recent.delete(id)
  return result
}
export function sourceOrigins(id: string): string[] {
  if (!builtinGameSources.some((source) => source.id === id)) return []
  const config = sourceSettings(id)
  return [...new Set([config.preferred, config.original, ...config.additional])]
}
export function isSourceUrl(
  id: string,
  value: string,
  subdomains = false
): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      sourceOrigins(id).some((origin) => {
        const host = new URL(origin).hostname
        return (
          url.hostname === host ||
          url.hostname === `www.${host}` ||
          (subdomains && url.hostname.endsWith(`.${host}`))
        )
      })
    )
  } catch {
    return false
  }
}
export function canonicalSourceUrl(id: string, value: string): string {
  if (!isSourceUrl(id, value)) return value
  const url = new URL(value)
  return new URL(
    url.pathname + url.search + url.hash,
    sourceSettings(id).original
  ).href
}
export function sourceCandidates(id: string, value: string): string[] {
  if (!isSourceUrl(id, value)) return [value]
  const url = new URL(value)
  const origins = sourceOrigins(id)
  const health = recent.get(id)
  const last = health && health.until > Date.now() ? health.origin : undefined
  if (last && origins.includes(last))
    origins.splice(0, 0, ...origins.splice(origins.indexOf(last), 1))
  return origins.map(
    (origin) => new URL(url.pathname + url.search + url.hash, origin).href
  )
}
export function markSourceAvailable(id: string, value: string) {
  if (isSourceUrl(id, value))
    recent.set(id, {
      origin: new URL(value).origin,
      until: Date.now() + 300000
    })
}
export function sourceDomains(id: string): string[] {
  return sourceOrigins(id).flatMap((origin) => {
    const host = new URL(origin).hostname
    return [host, `*.${host}`]
  })
}
