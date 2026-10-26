import {
  isImdbUrl,
  isImdbWebPageUrl,
  normalizeImdbImageUrl,
  resolveImdbCoverImage
} from '../imdbImageResolver'

describe('IMDb Image Resolver', () => {
  describe('isImdbUrl', () => {
    test('identifies standard and localized IMDb URLs', () => {
      expect(
        isImdbUrl(
          'https://www.imdb.com/pt/title/tt8579674/mediaviewer/rm4236618753/'
        )
      ).toBe(true)
      expect(
        isImdbUrl(
          'https://www.imdb.com/title/tt8579674/mediaviewer/rm4236618753/'
        )
      ).toBe(true)
      expect(isImdbUrl('https://imdb.com/title/tt8579674/')).toBe(true)
    })

    test('identifies Amazon Media CDN image URLs for IMDb', () => {
      expect(
        isImdbUrl(
          'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_.jpg'
        )
      ).toBe(true)
    })

    test('rejects non-IMDb URLs and local files', () => {
      expect(isImdbUrl('https://image.tmdb.org/t/p/original/poster.jpg')).toBe(
        false
      )
      expect(isImdbUrl('https://example.com/cover.png')).toBe(false)
      expect(isImdbUrl('C:\\Videos\\Filmes\\Police Squad\\poster.jpg')).toBe(
        false
      )
      expect(isImdbUrl('')).toBe(false)
      expect(isImdbUrl(undefined)).toBe(false)
    })
  })

  describe('isImdbWebPageUrl', () => {
    test('returns true for web pages and false for direct media CDN assets', () => {
      expect(
        isImdbWebPageUrl(
          'https://www.imdb.com/pt/title/tt8579674/mediaviewer/rm4236618753/'
        )
      ).toBe(true)
      expect(isImdbWebPageUrl('https://www.imdb.com/title/tt8579674/')).toBe(
        true
      )
      expect(
        isImdbWebPageUrl(
          'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_.jpg'
        )
      ).toBe(false)
    })
  })

  describe('normalizeImdbImageUrl', () => {
    test('strips crop and downscale query/path tokens returning full resolution', () => {
      const cropped =
        'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg'
      const normalized =
        'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_.jpg'
      expect(normalizeImdbImageUrl(cropped)).toBe(normalized)

      const withAspectCrop =
        'https://m.media-amazon.com/images/M/MV5BMDAyY2FhYjct_V1_QL75_UX380_CR0,0,380,562_.webp'
      expect(normalizeImdbImageUrl(withAspectCrop)).toBe(
        'https://m.media-amazon.com/images/M/MV5BMDAyY2FhYjct._V1_.webp'
      )
    })

    test('preserves already normalized or non-Amazon image URLs', () => {
      const original =
        'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_.jpg'
      expect(normalizeImdbImageUrl(original)).toBe(original)

      const other = 'https://image.tmdb.org/t/p/original/test.jpg'
      expect(normalizeImdbImageUrl(other)).toBe(other)
    })
  })

  describe('resolveImdbCoverImage', () => {
    test('resolves direct media-amazon image URLs immediately without window creation', async () => {
      const direct =
        'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg'
      const res = await resolveImdbCoverImage(direct)
      expect(res).toBe(
        'https://m.media-amazon.com/images/M/MV5BNjQ4ZTZiZmUtNThiOC00ZTM0LWJkZGYtYmI0ODEyNzJlMDJmXkEyXkFqcGc@._V1_.jpg'
      )
    })

    test('returns null for non-IMDb URLs', async () => {
      expect(await resolveImdbCoverImage('https://example.com/movie')).toBeNull()
      expect(await resolveImdbCoverImage('')).toBeNull()
    })
  })
})
