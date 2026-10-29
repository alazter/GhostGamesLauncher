import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { nativeImage } from 'electron'
import { createArtworkFinder, saveMediaArtwork, deleteMediaArtwork } from '../mediaArtwork'
import { NetworkGuard } from '../networkGuard'
import type { PluginManifest } from 'common/types/plugins'

jest.mock('electron', () => ({
  ...jest.requireActual('../../__mocks__/electron'),
  nativeImage: { createFromBuffer: jest.fn() }
}))

const manifest: PluginManifest = {
  id: 'com.ghost.alazterflix',
  name: 'Alazterflix',
  version: '1.1.0',
  description: '',
  author: '',
  type: 'media',
  permissions: ['media', 'network']
}
let root: string
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3])
const video = (folder: string, name: string) => {
  mkdirSync(folder, { recursive: true })
  const path = join(folder, name)
  writeFileSync(path, 'untouched video')
  return path
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'alazter-artwork-'))
  jest.mocked(nativeImage.createFromBuffer).mockReturnValue({
    isEmpty: () => false,
    getSize: () => ({ width: 1920, height: 1080 }),
    toJPEG: () => jpeg
  } as unknown as ReturnType<typeof nativeImage.createFromBuffer>)
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  jest.restoreAllMocks()
})

test('local artwork names are case insensitive and a series inherits its own root poster', () => {
  const show = join(root, 'SÉRIES', 'Exemplo')
  const path = video(join(show, 'Season 02'), 'Exemplo.S02E01.mkv')
  writeFileSync(join(show, 'POSTER.PNG'), jpeg)
  writeFileSync(join(show, 'FANART.JPG'), jpeg)
  expect(createArtworkFinder()(path)).toEqual({
    poster: join(show, 'POSTER.PNG'),
    backdrop: join(show, 'FANART.JPG')
  })
})
test('two films in a generic shared folder never inherit the same folder cover', () => {
  const directory = join(root, 'Minha coleção')
  const first = video(directory, 'Primeiro.mkv')
  video(directory, 'Segundo.mkv')
  writeFileSync(join(directory, 'poster.jpg'), jpeg)
  writeFileSync(join(directory, 'Primeiro-poster.jpg'), jpeg)
  expect(createArtworkFinder()(first).poster).toBe(
    join(directory, 'Primeiro-poster.jpg')
  )
  expect(
    createArtworkFinder()(join(directory, 'Segundo.mkv')).poster
  ).toBeUndefined()
})

test('documentary series explicitly marked in the folder share their own artwork', () => {
  const directory = join(root, 'Documentários', 'Série Construindo a História')
  const first = video(directory, 'Construindo Um Império - China.mkv')
  video(directory, 'Construindo Um Império - Rússia.mkv')
  writeFileSync(join(directory, 'poster.jpg'), jpeg)
  expect(createArtworkFinder()(first).poster).toBe(
    join(directory, 'poster.jpg')
  )
})
test('standalone movies never inherit unrelated artwork from an ancestor', () => {
  const path = video(join(root, 'Meus arquivos', 'Exemplo'), 'Exemplo.mkv')
  writeFileSync(join(root, 'Meus arquivos', 'poster.jpg'), jpeg)
  expect(createArtworkFinder()(path).poster).toBeUndefined()
})
test('saved local PNG is encoded as JPEG beside the media and a new scan finds it', async () => {
  const path = video(join(root, 'Filmes', 'Exemplo'), 'Exemplo.mkv')
  const selected = join(root, 'chosen.png')
  writeFileSync(selected, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const result = await saveMediaArtwork(
    manifest,
    path,
    'imagecache://localhost/' + encodeURIComponent(selected),
    'poster'
  )
  expect(result.localPath).toBe(join(root, 'Filmes', 'Exemplo', 'poster.jpg'))
  expect(readFileSync(result.localPath)).toEqual(jpeg)
  expect(readFileSync(path, 'utf8')).toBe('untouched video')
  expect(createArtworkFinder()(path).poster).toBe(result.localPath)
})
test('single-episode artwork is stored separately from the show poster', async () => {
  const show = join(root, 'Séries', 'Exemplo')
  const path = video(join(show, 'Season 01'), 'Exemplo.S01E01.mkv')
  writeFileSync(join(show, 'poster.jpg'), 'original show cover')
  const result = await saveMediaArtwork(
    manifest,
    path,
    'data:image/jpeg;base64,' + jpeg.toString('base64'),
    'poster',
    undefined,
    true
  )
  expect(result.localPath).toContain('Exemplo.S01E01-poster.jpg')
  expect(readFileSync(join(show, 'poster.jpg'), 'utf8')).toBe(
    'original show cover'
  )
})
test('invalid images and unrelated destination directories are rejected without touching videos', async () => {
  const path = video(join(root, 'Filmes'), 'Exemplo.mkv')
  jest
    .mocked(nativeImage.createFromBuffer)
    .mockReturnValue({ isEmpty: () => true } as unknown as ReturnType<
      typeof nativeImage.createFromBuffer
    >)
  await expect(
    saveMediaArtwork(manifest, path, 'data:image/png;base64,AAAA', 'poster')
  ).rejects.toThrow('imagem válida')
  const unrelated = join(root, 'Unrelated')
  mkdirSync(unrelated)
  await expect(
    saveMediaArtwork(
      manifest,
      path,
      'data:image/png;base64,AAAA',
      'poster',
      unrelated
    )
  ).rejects.toThrow('conter o vídeo')
  expect(readFileSync(path, 'utf8')).toBe('untouched video')
})
test('a portrait downloaded as a backdrop is rejected before replacing existing art', async () => {
  const directory = join(root, 'Filmes', 'Exemplo')
  const path = video(directory, 'Exemplo.mkv')
  const original = join(directory, 'backdrop.jpg')
  writeFileSync(original, 'original horizontal artwork')
  jest.mocked(nativeImage.createFromBuffer).mockReturnValue({
    isEmpty: () => false,
    getSize: () => ({ width: 500, height: 750 }),
    toJPEG: () => jpeg
  } as unknown as ReturnType<typeof nativeImage.createFromBuffer>)
  jest
    .spyOn(NetworkGuard, 'fetchResponse')
    .mockResolvedValue(new Response(jpeg))
  await expect(
    saveMediaArtwork(
      manifest,
      path,
      'https://example.com/portrait.jpg',
      'backdrop'
    )
  ).rejects.toThrow('horizontal')
  expect(readFileSync(original, 'utf8')).toBe('original horizontal artwork')
  expect(readFileSync(path, 'utf8')).toBe('untouched video')
})

test('artwork downloads reject private network URLs and oversized responses', async () => {
  const path = video(join(root, 'Filmes'), 'Exemplo.mkv')
  await expect(
    saveMediaArtwork(manifest, path, 'http://192.168.1.1/cover.jpg', 'poster')
  ).rejects.toThrow('blocked')
  jest.spyOn(NetworkGuard, 'fetchResponse').mockResolvedValue(
    new Response(jpeg, {
      headers: { 'content-length': String(21 * 1024 * 1024) }
    })
  )
  await expect(
    saveMediaArtwork(manifest, path, 'https://example.com/cover.jpg', 'poster')
  ).rejects.toThrow('20 MB')
})


test('saveMediaArtwork automatically resolves IMDb mediaviewer links and downloads artwork', async () => {
  const folder = join(root, 'Filmes', 'Police Squad')
  const path = video(folder, 'Police Squad E01.mkv')
  const imdbUrl =
    'https://www.imdb.com/pt/title/tt8579674/mediaviewer/rm4236618753/'
  const resolvedImageUrl =
    'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_.jpg'

  const imdbResolver = await import('../imdbImageResolver')
  jest
    .spyOn(imdbResolver, 'resolveImdbCoverImage')
    .mockResolvedValue(resolvedImageUrl)

  jest.spyOn(NetworkGuard, 'fetchResponse').mockResolvedValue(new Response(jpeg))

  const saved = await saveMediaArtwork(manifest, path, imdbUrl, 'poster')

  expect(imdbResolver.resolveImdbCoverImage).toHaveBeenCalledWith(imdbUrl)
  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
  expect(readFileSync(saved.localPath)).toEqual(jpeg)
  expect(readFileSync(join(folder, 'cover.jpg'))).toEqual(jpeg)
})

test('deleteMediaArtwork removes valid image file and rejects video files or non-existent files', () => {
  const folder = join(root, 'Filmes', 'TesteDelete')
  const videoPath = video(folder, 'Teste.mkv')
  const imagePath = join(folder, 'velha_capa.png')
  writeFileSync(imagePath, jpeg)

  expect(existsSync(imagePath)).toBe(true)
  expect(deleteMediaArtwork(imagePath)).toBe(true)
  expect(existsSync(imagePath)).toBe(false)

  // Rejects video files without deleting
  expect(deleteMediaArtwork(videoPath)).toBe(false)
  expect(existsSync(videoPath)).toBe(true)

  // Returns false safely on non-existent path
  expect(deleteMediaArtwork(join(folder, 'inexistente.jpg'))).toBe(false)
})

test('saveMediaArtwork with deleteOld=true deletes old artwork and legacy image formats', async () => {
  const folder = join(root, 'Filmes', 'Matrix')
  const videoPath = video(folder, 'Matrix.mkv')
  const oldArtwork = join(folder, 'matrix_antiga.webp')
  const legacyCover = join(folder, 'folder.jpg')
  writeFileSync(oldArtwork, jpeg)
  writeFileSync(legacyCover, jpeg)

  const saved = await saveMediaArtwork(
    manifest,
    videoPath,
    'data:image/jpeg;base64,' + jpeg.toString('base64'),
    'poster',
    undefined,
    false,
    true,
    oldArtwork
  )

  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
  expect(existsSync(saved.localPath)).toBe(true)
  expect(existsSync(join(folder, 'cover.jpg'))).toBe(true)
  // Old artwork and legacy cover removed from disk
  expect(existsSync(oldArtwork)).toBe(false)
  expect(existsSync(legacyCover)).toBe(false)
  // Video remains intact
  expect(readFileSync(videoPath, 'utf8')).toBe('untouched video')
})

test('saveMediaArtwork accepts file:// URLs and normalizes them to local files', async () => {
  const folder = join(root, 'Animes', 'Akira')
  const videoPath = video(folder, 'Akira.mkv')
  const localImage = join(root, 'downloads', 'akira_poster.webp')
  mkdirSync(join(root, 'downloads'), { recursive: true })
  writeFileSync(localImage, jpeg)

  const fileUrl = 'file:///' + localImage.replace(/\\/g, '/')
  const saved = await saveMediaArtwork(manifest, videoPath, fileUrl, 'poster')

  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
  expect(existsSync(saved.localPath)).toBe(true)
  expect(readFileSync(saved.localPath)).toEqual(jpeg)
})

test('saveMediaArtwork supports modern data URIs including avif and jfif', async () => {
  const folder = join(root, 'Animes', 'Evangelion')
  const videoPath = video(folder, 'Eva.mkv')

  const savedAvif = await saveMediaArtwork(
    manifest,
    videoPath,
    'data:image/avif;base64,' + jpeg.toString('base64'),
    'poster'
  )
  expect(savedAvif.localPath).toBe(join(folder, 'poster.jpg'))
  expect(existsSync(savedAvif.localPath)).toBe(true)
})

test('saveMediaArtwork extracts direct image from Google Images redirect URL', async () => {
  const folder = join(root, 'Animes', 'Cowboy Bebop')
  const videoPath = video(folder, 'Bebop.mkv')
  const directUrl = 'https://example.com/bebop_poster.jpg'
  const googleUrl = `https://www.google.com/imgres?imgurl=${encodeURIComponent(directUrl)}&imgrefurl=https://example.com`

  jest.spyOn(NetworkGuard, 'fetchResponse').mockResolvedValue(new Response(jpeg))

  const saved = await saveMediaArtwork(manifest, videoPath, googleUrl, 'poster')
  expect(NetworkGuard.fetchResponse).toHaveBeenCalledWith(
    directUrl,
    manifest,
    expect.anything(),
    expect.anything(),
    false
  )
  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
})

test('saveMediaArtwork extracts og:image from webpage HTML and downloads target image', async () => {
  const folder = join(root, 'Animes', 'Naruto')
  const videoPath = video(folder, 'Naruto.mkv')
  const pageUrl = 'https://myanimelist.net/anime/20/Naruto'
  const imageUrl = 'https://cdn.myanimelist.net/images/anime/13/11403.jpg'
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:image" content="${imageUrl}">
      </head>
      <body>Anime Page</body>
    </html>
  `

  jest.spyOn(NetworkGuard, 'fetchResponse').mockImplementation(async (url) => {
    if (url === pageUrl) {
      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }
    return new Response(jpeg, {
      headers: { 'content-type': 'image/jpeg' }
    })
  })

  const saved = await saveMediaArtwork(manifest, videoPath, pageUrl, 'poster')
  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
  expect(readFileSync(saved.localPath)).toEqual(jpeg)
})

test('saveMediaArtwork uses decodeImageWithChromium fallback when nativeImage.createFromBuffer fails', async () => {
  const folder = join(root, 'Animes', 'Bleach')
  const videoPath = video(folder, 'Bleach.mkv')
  const rawWebpBuffer = Buffer.from([1, 2, 3, 4, 5])

  const mediaArtModule = await import('../mediaArtwork')
  const decodeSpy = jest
    .spyOn(mediaArtModule.imageDecoder, 'decodeWithChromium')
    .mockResolvedValue(jpeg)

  let callCount = 0
  jest.mocked(nativeImage.createFromBuffer).mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      return { isEmpty: () => true } as unknown as ReturnType<
        typeof nativeImage.createFromBuffer
      >
    }
    return {
      isEmpty: () => false,
      getSize: () => ({ width: 550, height: 782 }),
      toJPEG: () => jpeg
    } as unknown as ReturnType<typeof nativeImage.createFromBuffer>
  })

  const saved = await saveMediaArtwork(
    manifest,
    videoPath,
    'data:image/webp;base64,' + rawWebpBuffer.toString('base64'),
    'poster'
  )

  expect(decodeSpy).toHaveBeenCalledWith(rawWebpBuffer)
  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
  expect(readFileSync(saved.localPath)).toEqual(jpeg)
})

test('saveMediaArtwork with deleteOld=false preserves old artwork on disk', async () => {
  const folder = join(root, 'Filmes', 'Inception')
  const videoPath = video(folder, 'Inception.mkv')
  const oldArtwork = join(folder, 'inception_antiga.png')
  writeFileSync(oldArtwork, jpeg)

  const saved = await saveMediaArtwork(
    manifest,
    videoPath,
    'data:image/jpeg;base64,' + jpeg.toString('base64'),
    'poster',
    undefined,
    false,
    false,
    oldArtwork
  )

  expect(saved.localPath).toBe(join(folder, 'poster.jpg'))
  expect(existsSync(saved.localPath)).toBe(true)
  // Old artwork must still exist when deleteOld is false
  expect(existsSync(oldArtwork)).toBe(true)
  expect(readFileSync(videoPath, 'utf8')).toBe('untouched video')
})
