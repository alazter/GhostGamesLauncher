import { sourceRuleSelector } from './sourceRules'
import type {
  GhostSearchResult,
  PluginManifest,
  WebsiteSourceConfig
} from 'common/types/plugins'
import { withSourceEngine } from './sourceEngines'
import { engineProcess } from './engineProcess'
import { engineProxy } from './engineProxy'
import { createHash } from 'crypto'
import { canonicalSourceUrl } from './sourceSettings'
import { builtinGameSources } from 'common/builtinGameSources'

export function isAdaptiveGamePath(id: string, path: string): boolean {
  if (id === 'com.ghost.ankergames-source')
    return /^\/game\/[^/]+\/?$/.test(path)
  if (id === 'com.ghost.online-fix-source')
    return /^\/games\/.+\.html$/.test(path)
  if (!builtinGameSources.some((source) => source.id === id)) return false
  return (
    path !== '/' &&
    !/^\/(?:category|tag|author|page|feed|wp-|contact|about|privacy|dmca|faq|search|comments|login|register|account|logout)(?:\b|\/)/i.test(
      path
    ) &&
    !/\.(?!html?$)[a-z0-9]+$/i.test(path.replace(/\/$/, ''))
  )
}

export async function adaptiveGames(
  html: string,
  base: string,
  manifest: PluginManifest,
  config: WebsiteSourceConfig
): Promise<GhostSearchResult[]> {
  if (!builtinGameSources.some((source) => source.id === manifest.id)) return []
  return (
    (await withSourceEngine('scrapling', async (executable, storage) => {
      const output = await engineProcess(
        executable,
        [],
        JSON.stringify({
          protocol: 1,
          html,
          base,
          storage,
          selector: sourceRuleSelector(manifest.id),
          scope: createHash('sha256').update(manifest.id).digest('hex'),
          provider: manifest.id
        })
      )
      const result: unknown = JSON.parse(output)
      if (!Array.isArray(result) || result.length > 200)
        throw new Error('Resposta adaptativa inválida.')
      return result.flatMap((item) => {
        if (
          !item ||
          typeof item.url !== 'string' ||
          typeof item.title !== 'string'
        )
          return []
        const url = new URL(item.url, base)
        if (
          url.origin !== new URL(base).origin ||
          !isAdaptiveGamePath(manifest.id, url.pathname) ||
          url.search ||
          url.hash ||
          url.username ||
          url.password ||
          item.title.length < 2 ||
          item.title.length > 200 ||
          /^(?:download|read more|login|register|home|next|previous)$/i.test(
            item.title.trim()
          )
        )
          return []
        const id = canonicalSourceUrl(manifest.id, url.href)
        return [
          {
            id,
            pageUrl: id,
            title: item.title,
            providerId: manifest.id,
            providerName: manifest.name,
            platform: config.platform
          }
        ]
      })
    })) || []
  )
}
export async function experimentalPage(
  url: string,
  manifest: PluginManifest
): Promise<string | undefined> {
  return withSourceEngine('obscura', async (executable) => {
    const proxy = await engineProxy(manifest)
    try {
      // Public catalog only. Authenticated downloads keep the existing Electron session.
      return await engineProcess(
        executable,
        [
          '--proxy',
          proxy.url,
          'fetch',
          url,
          '--timeout',
          '12',
          '--dump',
          'html'
        ],
        undefined,
        16000
      )
    } finally {
      proxy.close()
    }
  })
}
