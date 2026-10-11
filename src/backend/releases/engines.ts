import { createHash } from 'crypto'
import { withSourceEngine } from '../plugins/sourceEngines'
import { engineProcess } from '../plugins/engineProcess'
import { experimentalPage } from '../plugins/adaptiveSource'
import type { PluginManifest } from 'common/types/plugins'

const capabilities = new Map<string, boolean>()
const manifest: PluginManifest = {
  id: 'com.ghost.releases',
  name: 'Lançamentos',
  version: '1.0.0',
  author: 'Ghost',
  description: 'Catálogo público de lançamentos',
  type: 'metadata',
  permissions: ['network'],
  allowedDomains: [
    'www.releases.com',
    'releases.com',
    'cdn.releases.com',
    'ajax.aspnetcdn.com'
  ]
}

export async function releaseSelectors(
  html: string,
  identity: string,
  mode: 'learn' | 'repair'
): Promise<string | undefined> {
  if (html.length > 8 * 1024 * 1024)
    throw new Error('Documento adaptativo muito grande.')
  return withSourceEngine('scrapling', async (executable, storage) => {
    if (!capabilities.has(executable)) {
      const info = JSON.parse(await engineProcess(executable, ['--self-test']))
      capabilities.set(
        executable,
        info.ok === true &&
          info.capabilities?.includes('release-selectors-v1') === true
      )
    }
    // Existing protocol-1 bundles without this capability remain valid for other sources.
    if (!capabilities.get(executable)) return undefined
    const result = JSON.parse(
      await engineProcess(
        executable,
        [],
        JSON.stringify({
          protocol: 1,
          operation: 'release-selectors-v1',
          mode,
          html,
          base: 'https://www.releases.com',
          storage,
          scope: createHash('sha256').update(identity).digest('hex')
        })
      )
    )
    if (result.capability !== 'release-selectors-v1')
      throw new Error('Resposta incompatível do motor adaptativo.')
    if (mode === 'learn') return undefined
    if (
      typeof result.html !== 'string' ||
      result.html.length > 8 * 1024 * 1024 ||
      !Number.isInteger(result.recovered)
    )
      throw new Error('Resposta adaptativa inválida.')
    return result.recovered > 0 ? result.html : undefined
  })
}

export async function obscuraReleasePage(
  url: string
): Promise<string | undefined> {
  const target = new URL(url)
  if (
    target.origin !== 'https://www.releases.com' ||
    target.username ||
    target.password ||
    !/^\/(?:calendar(?:\/|$)|hot(?:\/|$)|partial\/Releases\.Www\.PL\.(?:Product\.Index|Calendar\.Group)$)/.test(
      target.pathname
    )
  )
    throw new Error('Endereço não permitido para o coletor alternativo.')
  // Honors the existing disabled-by-default Obscura setting and domain-limited proxy.
  return experimentalPage(target.href, manifest)
}

/** Only successfully validated native parses train references; recovered data must be revalidated. */
export async function parseResilient<T>(
  html: string,
  identity: string,
  parse: (html: string) => T
): Promise<T> {
  if (
    /Checking your browser|Just a moment|Verify you are human|cf-chl-widget/i.test(
      html.slice(0, 12000)
    )
  )
    throw new Error(
      'A fonte exige verificação; os dados salvos foram preservados.'
    )
  let original: unknown
  try {
    const value = parse(html)
    try {
      await releaseSelectors(html, identity, 'learn')
    } catch (error) {
      console.warn('[Releases] Falha ao salvar referências adaptativas:', error)
    }
    return value
  } catch (error) {
    original = error
  }
  let recovered: string | undefined
  try {
    recovered = await releaseSelectors(html, identity, 'repair')
  } catch (error) {
    console.warn('[Releases] Recuperação adaptativa indisponível:', error)
  }
  if (recovered) return parse(recovered)
  throw original
}
