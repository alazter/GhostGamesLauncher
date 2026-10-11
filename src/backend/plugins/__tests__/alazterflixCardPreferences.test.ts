import {
  mediaTmdbRating,
  normalizeCardPreferences,
  parseUserRating
} from '../../../frontend/screens/Alazterflix/cardPreferences'
import type { GhostMovie } from 'common/types/plugins'

describe('Alazterflix card settings and ratings', () => {
  test('accepts zero, decimals and comma; rejects out-of-range or malformed scores', () => {
    for (const [input, expected] of [
      ['0', 0],
      ['10', 10],
      ['9,5', 9.5],
      [' 9.50 ', 9.5],
      ['', null]
    ] as const)
      expect(parseUserRating(input)).toBe(expected)
    for (const input of ['-1', '11', '9,5,2', 'NaN', 'abc', '1e1', '0xA'])
      expect(parseUserRating(input)).toBeUndefined()
  })
  test('keeps the current style by default and restores independent title preferences safely', () => {
    expect(normalizeCardPreferences(null)).toEqual({
      style: 'classic',
      showTitle: true,
      titleAlignment: 'left'
    })
    expect(
      normalizeCardPreferences({
        style: 'clean',
        showTitle: false,
        titleAlignment: 'right'
      })
    ).toEqual({ style: 'clean', showTitle: false, titleAlignment: 'right' })
    expect(
      normalizeCardPreferences({ style: 'bad', titleAlignment: 'bad' }).style
    ).toBe('classic')
  })
  test('never labels Cinemeta/IMDb, missing values or editable legacy scores as TMDB', () => {
    const movie = { rating: '8.4', metadataProvider: 'cinemeta' } as GhostMovie
    expect(mediaTmdbRating(movie)).toBeUndefined()
    expect(mediaTmdbRating({ ...movie, metadataProvider: 'tmdb' })).toBe('8.4')
    expect(
      mediaTmdbRating({
        ...movie,
        metadataProvider: 'tmdb',
        metadataLocked: true
      })
    ).toBeUndefined()
    expect(
      mediaTmdbRating({ ...movie, metadataProvider: 'tmdb', tmdbRating: null })
    ).toBeUndefined()
    expect(mediaTmdbRating({ ...movie, tmdbRating: 0 })).toBe('0.0')
    expect(mediaTmdbRating({ ...movie, tmdbRating: 9.5 })).toBe('9.5')
    expect(mediaTmdbRating({ ...movie, tmdbRating: 12 })).toBeUndefined()
  })
})
