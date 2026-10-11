import { PluginPacker } from '../pluginPacker'
import { MediaStreamServer } from '../mediaStreamServer'
import { NetworkGuard } from '../networkGuard'
import { PluginHost } from '../pluginHost'
import fs from 'graceful-fs'
import path from 'path'
import os from 'os'
import http from 'http'
import type { PluginManifest } from 'common/types/plugins'
import { saveMediaArtwork } from '../mediaArtwork'

jest.mock('../mediaArtwork', () => {
  const original = jest.requireActual('../mediaArtwork')
  return {
    ...original,
    saveMediaArtwork: jest.fn(async (_manifest, filePath, _source, type) => {
      const localPath = require('path').join(
        require('path').dirname(filePath),
        type + '.jpg'
      )
      require('fs').writeFileSync(localPath, Buffer.from([0xff, 0xd8, 0xff]))
      return {
        localPath,
        streamUrl: 'imagecache://localhost/' + encodeURIComponent(localPath)
      }
    })
  }
})

describe('Ghost Cinema & Filmes Plugin Subsystem', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-cinema-test-'))
    jest
      .mocked(saveMediaArtwork)
      .mockImplementation(async (_manifest, filePath, _source, type) => {
        const localPath = path.join(path.dirname(filePath), type + '.jpg')
        fs.writeFileSync(localPath, Buffer.from([0xff, 0xd8, 0xff]))
        return {
          localPath,
          streamUrl: 'imagecache://localhost/' + encodeURIComponent(localPath)
        }
      })
  })

  afterEach(() => {
    MediaStreamServer.getInstance().stop()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  test('PluginPacker validates manifest with type "media" and permission "media"', () => {
    const raw = {
      id: 'com.ghost.alazterflix',
      name: 'Alazterflix',
      version: '1.0.0',
      type: 'media',
      permissions: ['media', 'network', 'storage', 'ui:inject-css']
    }
    const validated = PluginPacker.validateManifest(raw)
    expect(validated.id).toBe('com.ghost.alazterflix')
    expect(validated.type).toBe('media')
    expect(validated.permissions).toContain('media')
  })

  test('NetworkGuard allows public domains when "media" permission is present and blocks private IPs', () => {
    const manifest: PluginManifest = {
      id: 'com.ghost.alazterflix',
      name: 'Alazterflix',
      version: '1.0.0',
      description: 'Cinema plugin',
      author: 'Ghost Labs',
      type: 'media',
      permissions: ['network', 'media']
    }

    // Public Stremio domains should be allowed
    const publicUrl = 'https://v3-cinemeta.strem.io/manifest.json'
    const publicResult = NetworkGuard.validateUrl(publicUrl, manifest)
    expect(publicResult.allowed).toBe(true)

    // Localhost/private IP must be blocked for security
    const localUrl = 'http://127.0.0.1:8080/evil'
    const localResult = NetworkGuard.validateUrl(localUrl, manifest)
    expect(localResult.allowed).toBe(false)
    expect(localResult.reason).toContain('blocked by GhostShield')
  })

  test('MediaStreamServer starts, serves HTTP 206 Partial Content for video streaming, and stops', async () => {
    const server = MediaStreamServer.getInstance()
    const testVideoFile = path.join(tempDir, 'sample_movie.mp4')
    // Create dummy 100-byte video buffer
    const dummyBuffer = Buffer.alloc(100, 42)
    fs.writeFileSync(testVideoFile, dummyBuffer)

    const port = await server.start()
    expect(port).toBeGreaterThan(0)

    const streamUrl = await server.getStreamUrl(testVideoFile)
    expect(streamUrl).toContain(`http://127.0.0.1:${port}/stream?file=`)

    // Test HTTP 206 Range request (bytes 10-29 -> 20 bytes)
    const rangePromise = new Promise<{
      statusCode: number
      data: Buffer
      headers: http.IncomingHttpHeaders
    }>((resolve, reject) => {
      const req = http.get(
        streamUrl,
        {
          headers: { Range: 'bytes=10-29' }
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 0,
              data: Buffer.concat(chunks),
              headers: res.headers
            })
          })
        }
      )
      req.on('error', reject)
    })

    const response = await rangePromise
    expect(response.statusCode).toBe(206)
    expect(response.data.length).toBe(20)
    expect(response.headers['content-range']).toBe('bytes 10-29/100')
    expect(response.headers['content-type']).toBe('video/mp4')

    server.stop()
  })

  test('MediaStreamServer detects local SRT subtitles and serves valid WebVTT with CORS', async () => {
    const server = MediaStreamServer.getInstance()
    const testVideoFile = path.join(tempDir, 'Filme.Exemplo.2024.1080p.mkv')
    const testSrtFile = path.join(tempDir, 'Filme.Exemplo.2024.1080p.srt')
    
    fs.writeFileSync(testVideoFile, Buffer.alloc(100, 1))
    const srtSample = `1
00:00:01,500 --> 00:00:04,200
Olá, isto é um teste de legenda em português!

2
00:00:05,000 --> 00:00:08,000
Segunda linha de fala perfeitamente sincronizada.`
    fs.writeFileSync(testSrtFile, srtSample, 'utf8')

    const port = await server.start()
    const localSubs = await server.getLocalSubtitles(testVideoFile)
    expect(localSubs.length).toBeGreaterThan(0)
    expect(localSubs[0].filePath).toBe(testSrtFile)

    const subUrl = localSubs[0].streamUrl
    expect(subUrl).toContain(`/subtitle?file=`)

    const subPromise = new Promise<{
      statusCode: number
      body: string
      headers: http.IncomingHttpHeaders
    }>((resolve, reject) => {
      const req = http.get(subUrl, (res) => {
        let body = ''
        res.on('data', (c) => { body += c.toString('utf8') })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
            headers: res.headers
          })
        })
      })
      req.on('error', reject)
    })

    const res = await subPromise
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/vtt; charset=utf-8')
    expect(res.headers['access-control-allow-origin']).toBe('*')
    expect(res.body.startsWith('WEBVTT')).toBe(true)
    expect(res.body).toContain('00:00:01.500 --> 00:00:04.200')
    expect(res.body).toContain('Olá, isto é um teste de legenda em português!')

    server.stop()
  })

  test('MediaStreamServer inspects user real files for subtitles if present', async () => {
    const server = MediaStreamServer.getInstance()
    const dbzFile = 'T:\\Alazter Multimídia\\Animes\\Dragon Ball\\Filmes\\Filme 2 - Dragon Ball Z - O Renascimento de Freeza\\Dragon.Ball.Z.O.Renascimento.de.Freeza.2015.1080p.BluRay.DUAL-LAPUMiA.mkv'
    const bossFile = 'T:\\Alazter Multimídia\\Filmes\\Boss Level\\Mate ou Morra 2021 1080p BluRay DUAL 2.0.mkv'

    if (fs.existsSync(dbzFile)) {
      const dbzSubs = await server.getLocalSubtitles(dbzFile)
      console.log('[TEST] DBZ Subs detected:', JSON.stringify(dbzSubs, null, 2))
      expect(dbzSubs.length).toBeGreaterThan(0)

      const subRes = await new Promise<string>((resolve) => {
        http.get(dbzSubs[0].streamUrl, (res) => {
          let b = ''
          res.on('data', (c) => { b += c.toString('utf8') })
          res.on('end', () => resolve(b))
        })
      })
      console.log('[TEST] DBZ VTT Snippet (first 5 lines):\n', subRes.split('\n').slice(0, 5).join('\n'))
      const { parseVttContent, findCueAtTime } = require('common/subtitleEngine')
      const dbzCues = parseVttContent(subRes)
      console.log('[TEST] DBZ parsed cues count:', dbzCues.length)
      expect(dbzCues.length).toBeGreaterThan(100)
      const cueAt2m15s = findCueAtTime(dbzCues, 135)
      console.log('[TEST] DBZ cue at 2m15s (135s):', cueAt2m15s)
      expect(cueAt2m15s).toBeDefined()
    }

    if (fs.existsSync(bossFile)) {
      const bossSubs = await server.getLocalSubtitles(bossFile)
      console.log('[TEST] Boss Level Subs detected:', JSON.stringify(bossSubs, null, 2))
      expect(bossSubs.length).toBeGreaterThan(0)

      const fullSub = bossSubs.find(s => s.name.includes('FULL')) || bossSubs[0]
      const subRes = await new Promise<string>((resolve) => {
        http.get(fullSub.streamUrl, (res) => {
          let b = ''
          res.on('data', (c) => { b += c.toString('utf8') })
          res.on('end', () => resolve(b))
        })
      })
      console.log('[TEST] Boss Level VTT Snippet (first 8 lines):\n', subRes.split('\n').slice(0, 8).join('\n'))
      const { parseVttContent, findCueAtTime } = require('common/subtitleEngine')
      const bossCues = parseVttContent(subRes)
      console.log('[TEST] Boss Level parsed cues count:', bossCues.length)
      expect(bossCues.length).toBeGreaterThan(500)
      const cueAt37s = findCueAtTime(bossCues, 37.0)
      console.log('[TEST] Boss Level cue at 37s:', cueAt37s)
      expect(cueAt37s).toBeDefined()
    }
  }, 20000)

  test('Ghost Cinema plugin loads in sandbox, registers MediaProvider, and manages library state', async () => {
    const pluginDir = path.resolve('plugins/alazterflix')
    const manifestPath = path.join(pluginDir, 'plugin.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const manifest = PluginPacker.validateManifest(rawManifest)

    const dataRootDir = path.join(tempDir, 'plugins_data')
    fs.mkdirSync(dataRootDir, { recursive: true })
    fs.writeFileSync(
      path.join(dataRootDir, `${manifest.id}.json`),
      JSON.stringify({ metadata_settings: { autoFetch: false } })
    )
    const host = new PluginHost(manifest, pluginDir, dataRootDir)

    await host.start()
    const provider = host.getMediaProvider()
    expect(provider).toBeDefined()
    expect(provider?.id).toBe('com.ghost.alazterflix')

    // Initial state should provide default Stremio addons
    const state = await provider!.getState()
    expect(state.isPluginActive).toBe(true)
    expect(state.addons.length).toBeGreaterThan(0)
    expect(state.addons[0].id).toBe('org.stremio.cinemeta')

    // Add a folder with dummy video file
    const moviesFolder = path.join(tempDir, 'MyMovies')
    fs.mkdirSync(moviesFolder, { recursive: true })
    const dummyVideo = path.join(moviesFolder, 'Interstellar.2014.1080p.mkv')
    fs.writeFileSync(dummyVideo, Buffer.alloc(50, 1))

    const afterAdd = await provider!.addFolder(moviesFolder)
    expect(afterAdd.folders).toContain(moviesFolder)
    expect(afterAdd.movies.length).toBe(1)
    expect(afterAdd.movies[0].title).toBe('Interstellar')
    expect(afterAdd.movies[0].year).toBe(2014)
    expect(afterAdd.movies[0].resolution).toBe('1080p')

    // Save playback progress
    const movieId = afterAdd.movies[0].id
    await provider!.saveProgress(movieId, 1200, 9600)
    const stateWithProgress = await provider!.getState()
    expect(stateWithProgress.playbackHistory[movieId]).toBeDefined()
    expect(stateWithProgress.playbackHistory[movieId].progressSeconds).toBe(
      1200
    )

    // Add a series episode with S01E07 pattern
    const dummyEpisode = path.join(
      moviesFolder,
      'Better.Call.Saul.S01E07.1080p.mkv'
    )
    fs.writeFileSync(dummyEpisode, Buffer.alloc(60, 2))
    const stateWithSeries = await provider!.scanFolders([moviesFolder])
    const epItem = stateWithSeries.find((m) =>
      m.fileName.includes('Better.Call.Saul')
    )
    expect(epItem).toBeDefined()
    expect(epItem?.title).toBe('Better Call Saul')
    expect(epItem?.season).toBe(1)
    expect(epItem?.episode).toBe(7)
    expect(epItem?.isSeries).toBe(true)

    // Manual metadata editing without altering physical file
    const originalPath = epItem!.filePath
    const updated = await provider!.updateMovie!({
      ...epItem!,
      title: 'Better Call Saul - Bingo (Oficial)',
      customTitle: 'Better Call Saul - Bingo (Oficial)',
      coverUrl: 'https://example.com/cover.jpg',
      season: 1,
      episode: 7
    })
    expect(updated.title).toBe('Better Call Saul - Bingo (Oficial)')
    expect(updated.coverUrl).toContain('imagecache://localhost/')
    expect(updated.localCoverPath).toBeDefined()
    expect(fs.existsSync(updated.localCoverPath!)).toBe(true)
    expect(updated.customCoverUrl).toBe(updated.coverUrl)
    expect(updated.filePath).toBe(originalPath) // Physical path remains intact
    expect(fs.existsSync(originalPath)).toBe(true) // File still exists at original path

    host.dispose()
  })

  test('Packs the current Alazterflix in a temporary directory and verifies integrity', async () => {
    const pluginDir = path.resolve('plugins/alazterflix')
    const sourceManifest = PluginPacker.validateManifest(
      JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'))
    )
    const destGhost = path.join(tempDir, 'alazterflix.ghost')

    const packResult = await PluginPacker.pack(pluginDir, destGhost)
    expect(packResult.success).toBe(true)
    expect(packResult.outputPath).toBe(destGhost)
    expect(fs.existsSync(destGhost)).toBe(true)

    const unpackDir = path.join(tempDir, 'unpacked-alazterflix')
    const unpacked = await PluginPacker.unpack(destGhost, unpackDir)
    expect(unpacked.manifest.id).toBe('com.ghost.alazterflix')
    expect(unpacked.manifest.version).toBe(sourceManifest.version)
    expect(unpacked.checksum).toBeDefined()
    expect(fs.existsSync(path.join(unpackDir, 'index.js'))).toBe(true)
  })

  test('Dedicated Cinema Subtitle Engine parses cues and lookups frame-accurately', () => {
    const rawVtt = `WEBVTT

1
00:00:10.500 --> 00:00:14.200 line:85%,end
<i>Olá, seja bem-vindo ao Ghost!</i>

2
00:00:15.000 --> 00:00:18.500 line:85%,end
<b>Aproveite seus filmes com máxima fluidez.</b>`

    const { parseVttContent, findCueAtTime, sanitizeSubtitleHtml } = require('common/subtitleEngine')
    const cues = parseVttContent(rawVtt)
    expect(cues.length).toBe(2)
    expect(cues[0].startTime).toBe(10.5)
    expect(cues[0].endTime).toBe(14.2)
    expect(cues[0].text).toBe('<i>Olá, seja bem-vindo ao Ghost!</i>')

    // Lookup
    expect(findCueAtTime(cues, 5)).toBeNull()
    const active = findCueAtTime(cues, 12.0)
    expect(active).toBeDefined()
    expect(active?.text).toContain('Olá, seja bem-vindo ao Ghost!')

    // Sanitize
    const clean = sanitizeSubtitleHtml(active!.text)
    expect(clean).toBe('<i>Olá, seja bem-vindo ao Ghost!</i>')
    expect(sanitizeSubtitleHtml('Linha 1\nLinha 2')).toBe('Linha 1<br />Linha 2')
  })

  test('MediaStreamServer finds exact keyframe and aligns transcode stream startTime with 0 drift', async () => {
    const server = MediaStreamServer.getInstance()
    expect(await server.findExactKeyframe('non_existent.mkv', 0)).toBe(0)
    expect(await server.findExactKeyframe('non_existent.mkv', 60)).toBe(60)

    const userMovie = 'T:\\Alazter Multimídia\\Filmes\\Boss Level\\Mate ou Morra 2021 1080p BluRay DUAL 2.0.mkv'
    if (fs.existsSync(userMovie)) {
      const kf = await server.findExactKeyframe(userMovie, 1159.4)
      console.log('[TEST] Boss Level exact keyframe at 1159.4s:', kf)
      expect(kf).toBeGreaterThan(1145)
      expect(kf).toBeLessThanOrEqual(1159.4)

      const url = await server.getTranscodeStreamUrl(userMovie, 0, 1159.4)
      expect(url).toContain(`startTime=${kf}`)
    }
  })
})

