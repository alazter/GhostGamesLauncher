import { mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import type { StremioAddonManifest } from 'common/types/plugins'
import {
  isAllowedScraperUrl,
  normalizeNuvioStream,
  NuvioScraperService
} from '../nuvioScraperService'

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => os.tmpdir())
  },
  net: {
    fetch: jest.fn()
  }
}))

jest.mock('backend/logger', () => ({
  logInfo: jest.fn(),
  logWarning: jest.fn(),
  logError: jest.fn(),
  LogPrefix: { Backend: 'Backend' }
}))

describe('NuvioScraperService', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ghost-nuvio-scrapers-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('validates scraper URLs strictly (https public hosts only)', () => {
    expect(
      isAllowedScraperUrl(
        'https://raw.githubusercontent.com/nathanael540/nuvio-fontes-ptbr-plugin/main/prism/providers/redeflix.js'
      )
    ).toBe(true)
    expect(isAllowedScraperUrl('http://example.com/provider.js')).toBe(false)
    expect(isAllowedScraperUrl('https://localhost/provider.js')).toBe(false)
    expect(isAllowedScraperUrl('https://127.0.0.1/provider.js')).toBe(false)
    expect(isAllowedScraperUrl('https://192.168.1.5/provider.js')).toBe(false)
  })

  it('normalizes direct HLS/MP4 streams with headers and magnet streams cleanly', () => {
    const scraper = {
      id: 'megaembed--all-1080p-pt-br',
      name: 'MegaEmbed',
      filename: 'https://example.com/megaembed.js'
    }

    const hls = normalizeNuvioStream(
      {
        url: 'https://cdn.example.com/video.m3u8',
        name: 'MegaEmbed 1080p Dublado',
        quality: '1080p',
        headers: { Referer: 'https://megaembed.com/' }
      },
      scraper
    )
    expect(hls?.url).toBe('https://cdn.example.com/video.m3u8')
    expect(hls?.quality).toBe('1080p')
    expect(hls?.behaviorHints?.headers?.Referer).toBe('https://megaembed.com/')
    expect(hls?.addonName).toBe('MegaEmbed · Nuvio')

    const mag = normalizeNuvioStream(
      {
        url: 'magnet:?xt=urn:btih:c301b175cae6ae4870076bd478680b6e3fc13743&dn=A+Origem',
        name: 'Comando 1080p Dublado'
      },
      scraper
    )
    expect(mag?.url).toBeUndefined()
    expect(mag?.infoHash).toBe('c301b175cae6ae4870076bd478680b6e3fc13743')
    expect(mag?.magnetUrl).toContain('magnet:?xt=urn:btih:')
  })

  it('resolves IMDb -> TMDB via Cinemeta, runs sandboxed scraper with cheerio, and blocks unsafe requires', async () => {
    const mockScraperCode = `
      const cheerio = require('cheerio-without-node-native');
      module.exports = {
        async getStreams(tmdbId, mediaType) {
          let blocked = false;
          try { require('fs'); } catch { blocked = true; }
          const res = await fetch('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + globalThis.TMDB_API_KEY);
          const data = await res.json();
          const $ = cheerio.load('<a href="https://stream.example.com/origem.mp4">1080p Dublado</a>');
          return [{
            url: $('a').attr('href'),
            title: data.title + ' ' + $('a').text() + (blocked ? ' [sandbox-ok]' : ''),
            quality: '1080p',
            headers: { Referer: 'https://player.example.com/' }
          }];
        }
      };
    `

    const fetchMock = jest.fn(async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input?.url || String(input)
      if (url.includes('v3-cinemeta.strem.io/meta/movie/tt1375666.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            meta: { id: 'tt1375666', moviedb_id: 27205, name: 'Inception', year: '2010' }
          })
        } as any
      }
      if (url === 'https://raw.githubusercontent.com/example/providers/mock.js') {
        return {
          ok: true,
          status: 200,
          text: async () => mockScraperCode
        } as any
      }
      if (url.startsWith('https://api.themoviedb.org/3/movie/27205')) {
        // Verify TMDB v4 Bearer token adaptation stripped api_key and sent Authorization header
        expect(url).not.toContain('api_key=')
        const headers = new Headers(init?.headers)
        expect(headers.get('authorization')).toBe('Bearer eyJ.fake.v4token')
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 27205, title: 'A Origem', original_title: 'Inception' })
        } as any
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as any
    })

    const svc = new NuvioScraperService({
      cacheDir: tmpDir,
      fetchFn: fetchMock as any,
      tmdbTokenOverride: 'eyJ.fake.v4token'
    })

    const addons: StremioAddonManifest[] = [
      {
        id: 'nuvio.scrapers.ptbr',
        name: 'Nuvio Fontes PT-BR',
        version: '0.1.0',
        manifestUrl: 'https://raw.githubusercontent.com/example/manifest.json',
        types: ['movie', 'series'],
        resources: ['stream'],
        isEnabled: true,
        pluginFormat: 'nuvio-scrapers',
        scrapers: [
          {
            id: 'mock--all-1080p-pt-br',
            name: 'MockPTBR',
            filename: 'https://raw.githubusercontent.com/example/providers/mock.js',
            supportedTypes: ['movie', 'tv'],
            enabled: true
          }
        ]
      }
    ]

    const streams = await svc.getStreamsFromAddons(addons, 'movie', 'tt1375666')
    expect(streams).toHaveLength(1)
    expect(streams[0].url).toBe('https://stream.example.com/origem.mp4')
    expect(streams[0].title).toContain('A Origem 1080p Dublado [sandbox-ok]')
    expect(streams[0].behaviorHints?.headers?.Referer).toBe('https://player.example.com/')
  })
})
