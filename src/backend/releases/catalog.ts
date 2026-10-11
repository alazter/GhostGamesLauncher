import { BrowserWindow, session } from 'electron'
import {
  ReleaseCatalog,
  ReleaseProduct,
  ReleaseQuery,
  ReleaseRegion
} from 'common/types/releases'
import { RELEASE_CATEGORIES } from 'common/types/releases'
import { exactDate, parseReleaseCatalog, parseReleaseProduct } from './parser'
import { getReleaseArchive } from './archive'
import {
  catalogUpdateProblem,
  releaseUpdateProblem
} from 'common/releaseValidation'
import { parseResilient, obscuraReleasePage } from './engines'

const ORIGIN = 'https://www.releases.com'
const months = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec'
]
let queue: Promise<unknown> = Promise.resolve()
const sourceSessionsReady = new Set<ReleaseRegion>()
function getSourceSession(region: ReleaseRegion = 'us') {
  const result = session.fromPartition(
    `persist:ghost-release-catalog-${region}`
  )
  if (!sourceSessionsReady.has(region)) {
    // This partition only reads catalogue documents; ads, media playback, popups
    // and device permissions have no purpose in a data collector.
    result.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    result.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url)
      const source = [
        'www.releases.com',
        'releases.com',
        'cdn.releases.com'
      ].includes(url.hostname)
      const jquery =
        url.origin === 'https://ajax.aspnetcdn.com' &&
        url.pathname === '/ajax/jQuery/jquery-3.7.1.min.js' &&
        details.resourceType === 'script'
      callback({
        cancel:
          (!source && !jquery) ||
          ['image', 'media', 'font'].includes(details.resourceType)
      })
    })
    sourceSessionsReady.add(region)
  }
  return result
}

export function catalogUrl(query: ReleaseQuery): string {
  if (!query || typeof query !== 'object')
    throw new Error('Filtros de lançamentos inválidos.')
  if (query.region && !['us', 'uk'].includes(query.region))
    throw new Error('Região inválida.')
  if (
    query.platforms !== undefined &&
    (!Array.isArray(query.platforms) ||
      query.platforms.length > 50 ||
      query.platforms.some(
        (value) =>
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > 100 ||
          /[\x00-\x1f]/.test(value)
      ))
  )
    throw new Error('Plataformas inválidas.')
  if (query.cursor) {
    const cursor = new URL(query.cursor, ORIGIN)
    if (
      cursor.origin !== ORIGIN ||
      cursor.pathname !== '/partial/Releases.Www.PL.Calendar.Group' ||
      cursor.username ||
      cursor.password ||
      cursor.href.length > 2500
    )
      throw new Error('Página de lançamentos inválida.')
    return cursor.href
  }
  const category = query.category || 'all'
  if (!/^[a-z0-9_-]{1,80}$/.test(category))
    throw new Error('Categoria inválida.')
  let categoryCode = category === 'all' ? '' : category
  if (query.platform && !query.platforms) {
    if (!/^[a-z0-9-]{1,80}$/.test(query.platform) || !categoryCode)
      throw new Error('Plataforma inválida.')
    categoryCode += `_${query.platform}`
  }
  const section = query.view === 'hot' ? 'hot' : 'calendar'
  let pathname = `/${section}${categoryCode ? `/${categoryCode}` : ''}`
  if (query.view === 'hot')
    pathname += `/${{ week: 'weekly', month: 'monthly', year: 'yearly', all: 'alltime' }[query.interval || 'week'] || 'weekly'}`
  else if (query.date) {
    if (!exactDate(query.date)) throw new Error('Data inválida.')
  }
  const url = new URL(pathname, ORIGIN)
  for (const platform of [...new Set(query.platforms || [])].sort())
    url.searchParams.append('f', `v:${platform}`)
  if (query.date && query.view !== 'hot') {
    const [year, month, day] = query.date.split('-')
    url.searchParams.set(
      'at',
      `${year}-${months[Number(month) - 1]}-${Number(day)}`
    )
  }
  if (query.tag) {
    if (query.tag.length > 100) throw new Error('Marcador inválido.')
    url.searchParams.append('f', `tags:${query.tag}`)
  }
  return url.href
}

/** An isolated Chromium document reads the same public pages as the old webview.
 * No remote HTML or JavaScript is ever injected into the native renderer.
 * The source may refuse access; challenges are reported, never solved here.
 */
async function readSource(url: string, query?: ReleaseQuery): Promise<string> {
  const run = async () => {
    const sourceWindow = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        session: getSourceSession(query?.region),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false
      }
    })
    sourceWindow.webContents.setAudioMuted(true)
    sourceWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    const guard = (event: Electron.Event, target: string) => {
      if (new URL(target).origin !== ORIGIN) event.preventDefault()
    }
    sourceWindow.webContents.on('will-navigate', guard)
    sourceWindow.webContents.on('will-redirect', guard)
    const deadline = setTimeout(() => {
      if (!sourceWindow.isDestroyed()) sourceWindow.destroy()
    }, 30000)
    try {
      await sourceWindow.loadURL(url)
      if (query?.region && !query.cursor) {
        const changed = await sourceWindow.webContents
          .executeJavaScript(`(() => {
          const current = document.querySelector('.RWPC-Nav-MainMenuView-RegionButton.mad_active')?.getAttribute('data-region');
          if (current === ${JSON.stringify(query.region)}) return false;
          const button = document.querySelector('.RWPC-Nav-MainMenuView-RegionButton[data-region="${query.region}"]');
          if (!button) return false;
          button.click(); return true;
        })()`)
        if (changed) {
          for (let attempt = 0; attempt < 24; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 250))
            try {
              const region = await sourceWindow.webContents.executeJavaScript(
                `document.querySelector('[data-regionid]')?.getAttribute('data-regionid')`
              )
              if (region === query.region) break
            } catch (error) {
              if (sourceWindow.isDestroyed()) throw error
            }
          }
        }
      }
      if (query?.search) {
        const term = query.search.trim().slice(0, 200)
        await sourceWindow.webContents.executeJavaScript(`(() => {
          const field = document.querySelector('.RWP-Search-SearchFieldView-Input');
          if (!field) throw new Error('A busca da fonte está indisponível.');
          field.value = ${JSON.stringify(term)};
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', keyCode: 13, which: 13 }));
          const button = document.querySelector('.RWP-Search-SearchFieldView-SearchButton');
          if (button) button.click();
        })()`)
        for (let attempt = 0; attempt < 24; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          const result = (await sourceWindow.webContents.executeJavaScript(
            `document.querySelector('.RWP-Search-SearchResultView')?.outerHTML || ''`
          )) as string
          if (result) return result
        }
        throw new Error(
          'A busca do Releases.com não respondeu. Tente novamente.'
        )
      }
      const html = (await sourceWindow.webContents.executeJavaScript(
        'document.documentElement.outerHTML'
      )) as string
      if (html.length > 8 * 1024 * 1024)
        throw new Error('A resposta da fonte excedeu o tamanho permitido.')
      if (
        /Checking your browser|Just a moment|Verify you are human|cf-chl-widget/i.test(
          html.slice(0, 12000)
        )
      )
        throw new Error(
          'O Releases.com está exigindo verificação no site. Seus monitorados continuam disponíveis.'
        )
      return html
    } finally {
      clearTimeout(deadline)
      if (!sourceWindow.isDestroyed()) sourceWindow.destroy()
    }
  }
  const result = queue.catch(() => undefined).then(run)
  queue = result.catch(() => undefined)
  return result
}

function savedWarning(at: number, error: unknown): string {
  return (
    'Atualização suspensa. Exibindo dados confirmados em ' +
    new Date(at).toLocaleString('pt-BR') +
    '. ' +
    (error instanceof Error ? error.message : 'A fonte não respondeu.')
  )
}

async function sourceOrAlternative(
  url: string,
  query?: ReleaseQuery
): Promise<string> {
  try {
    return await readSource(url, query)
  } catch (error) {
    // An alternative engine is for transport compatibility, never challenge solving.
    if (
      query?.search ||
      /verificação|verification|403|429|captcha|ERR_BLOCKED/i.test(
        String(error)
      )
    )
      throw error
    const alternative = await obscuraReleasePage(url)
    if (alternative) return alternative
    throw error
  }
}

export async function getReleaseCatalog(
  query: ReleaseQuery
): Promise<ReleaseCatalog> {
  const sourceUrl = catalogUrl(query)
  const key = JSON.stringify([
    sourceUrl,
    query.search || '',
    query.region || 'us'
  ])
  const archive = await getReleaseArchive()
  const saved = await archive.get<ReleaseCatalog>('catalog', key)
  if (!query.refresh && saved && Date.now() - saved.at < 5 * 60 * 1000)
    return saved.value
  try {
    const html = await sourceOrAlternative(
      query.search ? ORIGIN : sourceUrl,
      query
    )
    const result = await parseResilient(html, 'catalog:' + key, (html) => {
      const result = parseReleaseCatalog(html, query, sourceUrl)
      if (query.search) {
        result.products = result.products.map((product) => ({
          ...product,
          region: query.region || 'us',
          releases: [],
          releaseDate: undefined,
          dateLabel: 'Ver datas por plataforma'
        }))
      } else if (
        query.region &&
        result.products.some((product) => product.region !== query.region)
      ) {
        throw new Error('A fonte retornou datas de outra região.')
      }
      if (query.search && query.category && query.category !== 'all')
        result.products = result.products.filter((product) =>
          query.category!.split('_').includes(product.category)
        )
      if (query.search && (query.platform || query.platforms?.length)) {
        const legacy = RELEASE_CATEGORIES.find(
          (category) => category.id === query.category
        )?.platforms.find((platform) => platform.id === query.platform)
        const platforms = query.platforms || (legacy ? [legacy.label] : [])
        if (platforms.length)
          result.products = result.products.filter((product) =>
            product.platforms.some((platform) => platforms.includes(platform))
          )
      }
      const problem = catalogUpdateProblem(result, saved?.value)
      if (problem) throw new Error(problem)
      return result
    })
    await archive.put('catalog', key, result)
    return result
  } catch (error) {
    if (saved)
      return {
        ...saved.value,
        stale: true,
        warning: savedWarning(saved.at, error)
      }
    throw error
  }
}

export async function getReleaseDetails(
  id: string,
  region: ReleaseRegion = 'us'
): Promise<ReleaseProduct> {
  if (
    typeof id !== 'string' ||
    !/^[a-z0-9][a-z0-9._~-]{0,200}$/i.test(id) ||
    !['us', 'uk'].includes(region)
  )
    throw new Error('Lançamento inválido.')
  const key = region + ':' + id
  const archive = await getReleaseArchive()
  const saved = await archive.get<ReleaseProduct>('product', key)
  if (saved && Date.now() - saved.at < 15 * 60 * 1000) return saved.value
  const url =
    ORIGIN +
    '/partial/Releases.Www.PL.Product.Index?ProductSlug=' +
    encodeURIComponent(id) +
    '&RegionId=' +
    region
  try {
    let html: string
    try {
      const response = await getSourceSession(region).fetch(url, {
        signal: AbortSignal.timeout(20000),
        redirect: 'error'
      })
      if (!response.ok)
        throw new Error(
          'A fonte recusou os detalhes (HTTP ' + response.status + ').'
        )
      html = await response.text()
    } catch (error) {
      if (/403|429|captcha|ERR_BLOCKED/i.test(String(error))) throw error
      const alternative = await obscuraReleasePage(url)
      if (!alternative) throw error
      html = alternative
    }
    if (html.length > 8 * 1024 * 1024)
      throw new Error('Resposta da fonte muito grande.')
    const product = await parseResilient(html, 'product:' + key, (html) => {
      const product = parseReleaseProduct(html, id, region)
      product.releases = product.releases.filter((row) => row.region === region)
      if (!product.releases.length)
        throw new Error(
          'A fonte não informou datas por plataforma; a atualização foi suspensa.'
        )
      const problem = releaseUpdateProblem(product, saved?.value)
      if (problem) throw new Error(problem)
      return product
    })
    product.verifiedAt = new Date().toISOString()
    await archive.put('product', key, product)
    return product
  } catch (error) {
    if (saved)
      return {
        ...saved.value,
        stale: true,
        warning: savedWarning(saved.at, error)
      }
    throw error
  }
}
