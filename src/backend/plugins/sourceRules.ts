import { builtinGameSources } from 'common/builtinGameSources'
import type { WebsiteSourceConfig } from 'common/types/plugins'

export interface SourceRule {
  id: string
  version: number
  catalogPath: string
  gamePathPrefix?: string
  selector?: string
}
let rules: SourceRule[] = []
export function validateSourceRules(value: unknown): SourceRule[] {
  if (!Array.isArray(value) || value.length > builtinGameSources.length)
    throw new Error('Regras de fontes inválidas.')
  const ids = new Set<string>()
  return value.map((rule) => {
    const validPath = (path: unknown) =>
      typeof path === 'string' &&
      /^\/(?!\/)[a-zA-Z0-9/_?=&.-]*$/.test(path) &&
      path.length < 250 &&
      !path.includes('..')
    if (
      !rule ||
      !builtinGameSources.some((source) => source.id === rule.id) ||
      ids.has(rule.id) ||
      !Number.isSafeInteger(rule.version) ||
      rule.version < 1 ||
      !validPath(rule.catalogPath) ||
      (rule.gamePathPrefix !== undefined && !validPath(rule.gamePathPrefix)) ||
      (rule.selector !== undefined &&
        (typeof rule.selector !== 'string' ||
          !/^[a-zA-Z0-9_.# >-]{1,120}$/.test(rule.selector)))
    )
      throw new Error('Regras de fontes inválidas.')
    ids.add(rule.id)
    return {
      id: rule.id,
      version: rule.version,
      catalogPath: rule.catalogPath,
      gamePathPrefix: rule.gamePathPrefix,
      selector: rule.selector
    }
  })
}
export function installSourceRules(value: unknown) {
  const incoming = validateSourceRules(value)
  rules = incoming.map((rule) => {
    const old = rules.find((item) => item.id === rule.id)
    return old && old.version > rule.version ? old : rule
  })
}
export function sourceRuleConfig(
  id: string,
  config: WebsiteSourceConfig
): WebsiteSourceConfig {
  const rule = rules.find((item) => item.id === id)
  return rule
    ? {
        ...config,
        catalogPath: rule.catalogPath,
        gamePathPrefix: rule.gamePathPrefix || config.gamePathPrefix
      }
    : config
}
export function sourceRuleSelector(id: string) {
  return rules.find((item) => item.id === id)?.selector || '.post-title a'
}
