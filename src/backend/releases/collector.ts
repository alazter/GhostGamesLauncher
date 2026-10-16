import type { ReleaseQuery } from 'common/types/releases'
import { obscuraReleasePage, scraplingReleasePage } from './engines'

export function validateReleaseCollector(value: unknown): void {
  if (
    value !== undefined &&
    (typeof value !== 'string' ||
      !['electron', 'scrapling', 'obscura'].includes(value))
  )
    throw new Error('Motor de coleta de lançamentos inválido.')
}

export function sourceAccessBlocked(error: unknown): boolean {
  return /verificação|verification|403|429|captcha|ERR_BLOCKED/i.test(
    String(error)
  )
}

/** Both the preferred page and a compatibility fallback must pass the same parser. */
export async function collectReleasePage<T>(
  url: string,
  query: Pick<ReleaseQuery, 'collector' | 'region' | 'search'>,
  parse: (html: string) => Promise<T>,
  readDefault: () => Promise<string>
): Promise<{ value: T; warning?: string }> {
  validateReleaseCollector(query.collector)
  if (!query.collector || query.collector === 'electron')
    return { value: await parse(await readDefault()) }
  const name = query.collector === 'scrapling' ? 'Scrapling' : 'Obscura'
  let reason = ''
  try {
    // Search and region switching depend on the source's browser session.
    // Do not label a default US response as UK or invent a search endpoint.
    if (query.search || query.region === 'uk')
      reason = 'Esta consulta usa a busca ou a seleção regional do site.'
    else {
      const html = await (query.collector === 'scrapling'
        ? scraplingReleasePage(url)
        : obscuraReleasePage(url))
      if (html === undefined)
        reason = 'Instale ou atualize e habilite o motor em Plugins.'
      else return { value: await parse(html) }
    }
  } catch (error) {
    if (sourceAccessBlocked(error)) throw error
    reason = 'O motor não forneceu dados válidos nesta consulta.'
    console.warn(`[Releases] ${name}:`, error)
  }
  return {
    value: await parse(await readDefault()),
    warning: `${name} indisponível para esta consulta. Usando o coletor padrão. ${reason}`
  }
}
