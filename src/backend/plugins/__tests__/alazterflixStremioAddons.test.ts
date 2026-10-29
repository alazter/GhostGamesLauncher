import vm from 'node:vm'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  normalizeStremioAddonUrl,
  generateStremioShareLinks,
  isSameStremioAddon,
  RECOMMENDED_STREMIO_ADDONS
} from 'common/stremioAddonUtils'

const REAL_CINEMETA_MANIFEST = {
  id: 'com.linvo.cinemeta',
  version: '3.0.13',
  name: 'Cinemeta',
  description: 'The official addon for movie and series catalogs',
  resources: ['catalog', 'meta', 'addon_catalog'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [
    {
      type: 'movie',
      id: 'top',
      name: 'Popular',
      extra: [
        { name: 'genre', options: ['Action', 'Comedy', 'Sci-Fi'] },
        { name: 'search' },
        { name: 'skip' }
      ]
    },
    {
      type: 'movie',
      id: 'year',
      name: 'Year',
      extra: [
        { name: 'genre', isRequired: true, options: ['2026', '2025', '2024'] },
        { name: 'skip' }
      ]
    },
    {
      type: 'series',
      id: 'top',
      name: 'Popular',
      extra: [
        { name: 'genre', options: ['Action', 'Drama', 'Sci-Fi'] },
        { name: 'search' },
        { name: 'skip' }
      ]
    }
  ]
}

function createAlazterflixSandbox() {
  const storage: Record<string, any> = {
    metadata_settings: { autoFetch: false }
  }
  let provider: any
  const httpFetch = jest.fn<Promise<any>, [string, any?]>(async (url: string) => {
    if (url === 'https://v3-cinemeta.strem.io/manifest.json') {
      return {
        ok: true,
        status: 200,
        json: async () => REAL_CINEMETA_MANIFEST
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ metas: [] })
    }
  })

  const context = vm.createContext({
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    ghost: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      storage: {
        get: async (key: string) =>
          storage[key] === undefined
            ? undefined
            : JSON.parse(JSON.stringify(storage[key])),
        set: async (key: string, value: any) => {
          storage[key] = JSON.parse(JSON.stringify(value))
        }
      },
      http: { fetch: httpFetch },
      ui: { injectCSS: jest.fn() },
      media: {
        registerMediaProvider: (registered: any) => {
          provider = registered
        },
        artworkExists: async () => true,
        scanFolder: async () => [],
        saveArtwork: async () => ({ localPath: '', streamUrl: '' }),
        deleteArtwork: async () => true
      }
    }
  })

  const scriptCode = readFileSync(
    resolve('plugins/alazterflix/index.js'),
    'utf8'
  )
  vm.runInContext(scriptCode, context)

  return { provider, storage, httpFetch }
}

describe('Alazterflix Stremio Addons Ecosystem (Traditional + Share Addon + Protocol v3)', () => {
  test('normalizes traditional manifest URLs, Share Addon links, stremio:// protocol and /configure links', () => {
    expect(
      normalizeStremioAddonUrl('https://v3-cinemeta.strem.io/manifest.json')
    ).toBe('https://v3-cinemeta.strem.io/manifest.json')

    expect(normalizeStremioAddonUrl('https://v3-cinemeta.strem.io')).toBe(
      'https://v3-cinemeta.strem.io/manifest.json'
    )

    expect(
      normalizeStremioAddonUrl('stremio://v3-cinemeta.strem.io/manifest.json')
    ).toBe('https://v3-cinemeta.strem.io/manifest.json')

    expect(
      normalizeStremioAddonUrl(
        'https://web.stremio.com/#/addons?addon=https%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json'
      )
    ).toBe('https://v3-cinemeta.strem.io/manifest.json')

    expect(
      normalizeStremioAddonUrl(
        'https://app.strem.io/shell-v4.4/#/addons?addon=stremio%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json'
      )
    ).toBe('https://v3-cinemeta.strem.io/manifest.json')

    expect(
      normalizeStremioAddonUrl(
        'https://torrentio.strem.fun/providers=yts,eztv/configure'
      )
    ).toBe('https://torrentio.strem.fun/providers=yts,eztv/manifest.json')

    expect(
      normalizeStremioAddonUrl(
        'Instale este addon incrível: https://web.stremio.com/#/addons?addon=https%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json!'
      )
    ).toBe('https://v3-cinemeta.strem.io/manifest.json')
  })

  test('generates Stremio Share Addon links and identifies equivalent Cinemeta addons', () => {
    const links = generateStremioShareLinks('https://v3-cinemeta.strem.io')
    expect(links.manifestUrl).toBe('https://v3-cinemeta.strem.io/manifest.json')
    expect(links.stremioProtocolUrl).toBe(
      'stremio://v3-cinemeta.strem.io/manifest.json'
    )
    expect(links.webShareUrl).toBe(
      'https://web.stremio.com/#/addons?addon=https%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json'
    )

    expect(
      isSameStremioAddon(
        { id: 'org.stremio.cinemeta', url: 'https://v3-cinemeta.strem.io/manifest.json' },
        RECOMMENDED_STREMIO_ADDONS[0]
      )
    ).toBe(true)
  })

  test('installs Cinemeta via traditional manifest link and Share Addon link without duplicating entry', async () => {
    const { provider, httpFetch } = createAlazterflixSandbox()

    // 1. Instalação via link tradicional https://v3-cinemeta.strem.io/manifest.json
    const res1 = await provider.stremioAddAddon(
      'https://v3-cinemeta.strem.io/manifest.json'
    )
    expect(res1.success).toBe(true)
    expect(res1.addon.version).toBe('3.0.13')
    expect(httpFetch).toHaveBeenCalledWith(
      'https://v3-cinemeta.strem.io/manifest.json'
    )

    // 2. Instalação via link Share Addon do Stremio Web
    const shareUrl =
      'https://web.stremio.com/#/addons?addon=https%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json'
    const res2 = await provider.stremioAddAddon(shareUrl)
    expect(res2.success).toBe(true)

    const addons = await provider.stremioGetAddons()
    const cinemetaCount = addons.filter(
      (a: any) =>
        a.id === 'org.stremio.cinemeta' || a.id === 'com.linvo.cinemeta'
    ).length
    expect(cinemetaCount).toBe(1)
  })

  test('installs custom stream addon via stremio:// link, toggles state, and queries catalogs, meta, streams and subtitles', async () => {
    const { provider, httpFetch } = createAlazterflixSandbox()

    httpFetch.mockImplementation(async (url: string) => {
      if (url === 'https://my-streams.strem.fun/manifest.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'org.community.mystreams',
            name: 'My Streams Addon',
            version: '1.2.0',
            types: ['movie', 'series'],
            resources: [
              { name: 'stream', types: ['movie', 'series'], idPrefixes: ['tt'] }
            ]
          })
        }
      }
      if (url === 'https://v3-cinemeta.strem.io/catalog/series/top/genre=Sci-Fi&skip=20.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            metas: [{ id: 'tt0944947', type: 'series', name: 'Severance' }]
          })
        }
      }
      if (url === 'https://v3-cinemeta.strem.io/catalog/movie/year/genre=2026.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            metas: [{ id: 'tt1111111', type: 'movie', name: 'Future Movie 2026' }]
          })
        }
      }
      if (url === 'https://v3-cinemeta.strem.io/meta/series/tt0944947.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            meta: {
              id: 'tt0944947',
              type: 'series',
              name: 'Severance',
              videos: [{ id: 'tt0944947:1:1', season: 1, episode: 1, title: 'Pilot' }]
            }
          })
        }
      }
      if (url === 'https://my-streams.strem.fun/stream/series/tt0944947:1:1.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            streams: [
              {
                name: 'MyStreams 4K',
                title: 'Severance S01E01 2160p WEB-DL',
                infoHash: '0123456789abcdef0123456789abcdef01234567'
              }
            ]
          })
        }
      }
      if (url === 'https://opensubtitles-v3.strem.io/subtitles/series/tt0944947:1:1.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            subtitles: [
              {
                id: 'sub-pt-1',
                lang: 'pob',
                url: 'https://opensubtitles-v3.strem.io/sub/1.vtt'
              }
            ]
          })
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    // Install via stremio:// protocol
    const addRes = await provider.stremioAddAddon(
      'stremio://my-streams.strem.fun/configure'
    )
    expect(addRes.success).toBe(true)
    expect(addRes.addon.id).toBe('org.community.mystreams')

    // Catalog with genre + skip
    const catRes = await provider.stremioGetCatalog(
      'com.linvo.cinemeta',
      'series',
      'top',
      20,
      undefined,
      { genre: 'Sci-Fi' }
    )
    expect(catRes.metas).toHaveLength(1)
    expect(catRes.metas[0].name).toBe('Severance')

    // Catalog with required extra (year) auto-fills first option ('2026')
    const yearRes = await provider.stremioGetCatalog(
      'org.stremio.cinemeta',
      'movie',
      'year',
      0
    )
    expect(yearRes.metas).toHaveLength(1)
    expect(yearRes.metas[0].name).toBe('Future Movie 2026')

    // Meta for series
    const meta = await provider.stremioGetMeta(
      'org.stremio.cinemeta',
      'series',
      'tt0944947'
    )
    expect(meta).toBeDefined()
    expect(meta.videos).toHaveLength(1)

    // Streams for series episode (tt0944947:1:1)
    const streams = await provider.stremioGetStreams('series', 'tt0944947:1:1')
    expect(streams).toHaveLength(1)
    expect(streams[0].quality).toBe('4K')
    expect(streams[0].magnetUrl).toContain(
      'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567'
    )

    // Subtitles for series episode
    const subs = await provider.stremioGetSubtitles('series', 'tt0944947:1:1')
    expect(subs).toHaveLength(1)
    expect(subs[0].lang).toBe('pob')

    // Toggle addon off -> should not return streams when disabled
    await provider.stremioToggleAddon('org.community.mystreams', false)
    const streamsWhenDisabled = await provider.stremioGetStreams(
      'series',
      'tt0944947:1:1'
    )
    expect(streamsWhenDisabled).toHaveLength(0)
  })

  it('deve extrair bandeiras, tamanho de arquivo, seeds e tracker com precisão via parseStremioStreamDetails', async () => {
    const { parseStremioStreamDetails } = await import('common/stremioAddonUtils')

    const torrentioStream = {
      name: 'Torrentio\n1080p',
      title: '[Erai-raws] Kimetsu no Yaiba - Yuukaku Hen - 11 [1080p][HEVC][BATCH][Multiple Subtitle][5B5AB113].mkv\n👤 21 💾 526.63 MB ⚙ Nyaa\nMulti Subs / 🇬🇧 / 🇵🇹 / 🇪🇸 / 🇫🇷 / 🇩🇪',
      quality: '1080p'
    }

    const parsed = parseStremioStreamDetails(torrentioStream)
    expect(parsed.provider).toBe('Torrentio 1080p')
    expect(parsed.quality).toBe('1080p')
    expect(parsed.title).toContain('[Erai-raws] Kimetsu no Yaiba')
    expect(parsed.size).toBe('526.63 MB')
    expect(parsed.seeds).toBe(21)
    expect(parsed.tracker).toBe('Nyaa')
    expect(parsed.flags).toEqual(expect.arrayContaining(['🇬🇧', '🇵🇹', '🇪🇸', '🇫🇷', '🇩🇪']))
    expect(parsed.languagesLine).toContain('Multi Subs')

    const watchHubStream = {
      name: 'WatchHub',
      title: 'Crunchyroll Amazon Channel\nSubscription'
    }
    const parsedWatchHub = parseStremioStreamDetails(watchHubStream)
    expect(parsedWatchHub.isOfficial).toBe(true)
    expect(parsedWatchHub.title).toContain('Crunchyroll Amazon Channel')

    // Teste de conversão de siglas de países para emojis de bandeiras (Imagem 1)
    const streamWithCountryCodes = {
      name: 'Torrentio\n1080p',
      title: 'Outer Banks S04E08 [1080p][x265]\n👤 150 💾 1.45 GB ⚙ EZTV\nMulti Subs / GB / RU / PT / ES / MX / FR / DE',
      quality: '1080p'
    }
    const parsedCodes = parseStremioStreamDetails(streamWithCountryCodes)
    expect(parsedCodes.size).toBe('1.45 GB')
    expect(parsedCodes.languagesLine).toBe('Multi Subs / 🇬🇧 / 🇷🇺 / 🇵🇹 / 🇪🇸 / 🇲🇽 / 🇫🇷 / 🇩🇪')
    expect(parsedCodes.flags).toEqual(
      expect.arrayContaining(['🇬🇧', '🇷🇺', '🇵🇹', '🇪🇸', '🇲🇽', '🇫🇷', '🇩🇪'])
    )
  })

  it('deve registrar AIOStreams v2.36.0 (RemuxDB) e SubMaker em RECOMMENDED_STREMIO_ADDONS com urls de configuração e dicas', async () => {
    const { RECOMMENDED_STREMIO_ADDONS } = await import('common/stremioAddonUtils')

    const aio = RECOMMENDED_STREMIO_ADDONS.find((a) => a.id === 'aiostreams')
    expect(aio).toBeDefined()
    expect(aio?.version).toBe('2.36.0')
    expect(aio?.badge).toContain('RemuxDB')
    expect(aio?.configureUrl).toBe('https://aiostreams.elfhosted.com/configure')
    expect(aio?.guideTips).toContain('PT-BR')
    expect(aio?.guideTips).toContain('Sorting')

    const submaker = RECOMMENDED_STREMIO_ADDONS.find((a) => a.id === 'submaker')
    expect(submaker).toBeDefined()
    expect(submaker?.badge).toContain('Legendas IA')
    expect(submaker?.configureUrl).toBe('https://submaker.elfhosted.com')
    expect(submaker?.guideTips).toContain('Nuvio Reshaped')
  })

  it('deve ordenar streams Stremio com a hierarquia recomendada RemuxDB (Cached > Resolução > Qualidade > Idioma/Legenda PT-BR)', async () => {
    const { sortStremioStreamsByRemuxPreference } = await import('common/stremioAddonUtils')

    const rawStreams = [
      {
        name: 'Torrentio 1080p',
        title: 'Movie 1080p WEB-DL English\n👤 40 💾 2.1 GB'
      },
      {
        name: 'AIOStreams [RD+] 4K',
        title: 'Movie 2160p Remux HDR Dublado PT-BR Dual Áudio\n⚡ Cached RealDebrid 💾 45 GB'
      },
      {
        name: 'AIOStreams 720p',
        title: 'Movie 720p HDTV Dual Audio\n👤 10 💾 1.1 GB'
      },
      {
        name: 'Torrentio [RD+] 1080p',
        title: 'Movie 1080p BluRay Dual Áudio 🇧🇷\n⚡ Cached 💾 8 GB'
      },
      {
        name: 'CamPirate',
        title: 'Movie CAM 720p Screener'
      }
    ]

    const sorted = sortStremioStreamsByRemuxPreference(rawStreams, true)

    // O primeiro deve ser o AIOStreams [RD+] 4K (Cached + 4K + Remux + PT-BR)
    expect(sorted[0].name).toContain('AIOStreams [RD+] 4K')
    // O segundo deve ser o Torrentio [RD+] 1080p (Cached + 1080p + BluRay + PT-BR)
    expect(sorted[1].name).toContain('Torrentio [RD+] 1080p')
    // O último deve ser o CAM
    expect(sorted[sorted.length - 1].name).toBe('CamPirate')
  })

  it('deve calcular AutoSync de legendas e compensação de framerate com precisão milimétrica (Nuvio Reshaped Style)', async () => {
    const {
      calculateAutoSyncOffset,
      findClosestCue,
      applyFramerateCorrection
    } = await import('common/subtitleEngine')

    const mockCues = [
      { id: '1', startTime: 10.0, endTime: 13.0, text: 'Olá mundo!' },
      { id: '2', startTime: 25.5, endTime: 28.0, text: 'Essa é uma fala importante' },
      { id: '3', startTime: 60.0, endTime: 63.2, text: 'Final do primeiro minuto' }
    ]

    // 1. findClosestCue
    const closest = findClosestCue(mockCues, 26.0)
    expect(closest?.startTime).toBe(25.5)
    expect(closest?.text).toBe('Essa é uma fala importante')

    // 2. calculateAutoSyncOffset quando o usuário pausa/aciona na fala aos 27.0s
    // A fala original era aos 25.5s com delay atual de 0s.
    // Novo delay deve ser 27.0 - 25.5 = +1.5s
    const syncRes = calculateAutoSyncOffset(mockCues, 27.0, 0)
    expect(syncRes).toBeDefined()
    expect(syncRes?.newDelay).toBe(1.5)
    expect(syncRes?.deltaSeconds).toBe(1.5)
    expect(syncRes?.matchedCueText).toBe('Essa é uma fala importante')

    // 3. Compensação de framerate (23.976 <-> 25 fps)
    const delay25 = applyFramerateCorrection(10.0, 'to25')
    expect(delay25).toBeCloseTo(10.0 * (25 / 23.976), 2)

    const delayBack = applyFramerateCorrection(delay25, 'to23976')
    expect(delayBack).toBeCloseTo(10.0, 1)
  })
})
