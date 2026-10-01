import { builtinGameSources } from 'common/builtinGameSources'
import type { PluginManifest, SourceAddressTest } from 'common/types/plugins'
import { normalizeSourceOrigin } from './sourceSettings'
import { NetworkGuard } from './networkGuard'
import { parseWebsiteGames } from './websiteSource'

export async function testSourceAddress(
  id: string,
  address: string
): Promise<SourceAddressTest> {
  try {
    const source = builtinGameSources.find((item) => item.id === id)
    if (!source) throw new Error('Fonte desconhecida.')
    const origin = normalizeSourceOrigin(address)
    const manifest = {
      id,
      name: source.name,
      permissions: ['network'],
      allowedDomains: [new URL(origin).hostname]
    } as PluginManifest
    const response = await NetworkGuard.fetchResponse(
      new URL(source.config.catalogPath, origin).href,
      manifest,
      AbortSignal.timeout(12000),
      {},
      true
    )
    if ([401, 403].includes(response.status)) {
      await response.body?.cancel()
      return {
        status: 'login',
        message:
          'O site respondeu, mas exige login ou confirmação no navegador. A estrutura ainda não foi validada.'
      }
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`O site respondeu com HTTP ${response.status}.`)
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Resposta vazia.')
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.length
      if (bytes > 8 * 1024 * 1024) {
        await reader.cancel()
        throw new Error('A resposta excedeu o tamanho permitido.')
      }
      chunks.push(part.value)
    }
    const html = Buffer.concat(chunks).toString('utf8')
    if (/cf-chl-|Just a moment|Checking your browser/i.test(html))
      return {
        status: 'login',
        message:
          'Confirme o acesso na janela do site. A estrutura ainda não foi validada.'
      }
    const games = parseWebsiteGames(html, origin, source.config, manifest)
    return games.length
      ? {
          status: 'available',
          message: `Disponível: ${games.length} páginas de jogos reconhecidas. Isso não comprova a identidade do domínio; utilize um endereço anunciado pelo site.`
        }
      : {
          status: 'unrecognized',
          message:
            'O endereço respondeu, mas o catálogo não foi reconhecido. Pode exigir interação ou adaptação do plugin.'
        }
  } catch (error) {
    return {
      status: 'unavailable',
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar esse endereço.'
    }
  }
}
