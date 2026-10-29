import {
  coverSizePages,
  normalizeCoverSizes
} from '../../../frontend/screens/Alazterflix/coverSizes'

describe('Alazterflix cover sizes by page', () => {
  test('retains the previous global choice as the starting size for every page', () => {
    expect(Object.values(normalizeCoverSizes(null, 0))).toEqual(
      coverSizePages.map(() => 0)
    )
    expect(Object.values(normalizeCoverSizes(null, 4))).toEqual(
      coverSizePages.map(() => 4)
    )
  })
  test('restores independent sizes including zero and ignores malformed values', () => {
    const saved = {
      all: 4,
      anime: 0,
      series: 1,
      movie: 3,
      documentary: -1,
      cartoon: '4',
      stremio: 99
    }
    expect(normalizeCoverSizes(saved, 2)).toEqual({
      all: 4,
      forYou: 2,
      anime: 0,
      series: 1,
      movie: 3,
      documentary: 2,
      cartoon: 2,
      ova: 2,
      tv: 2,
      stremio: 2
    })
    expect(saved.documentary).toBe(-1)
    for (const legacy of [null, '3', -1, 5, NaN, 0.5])
      expect(Object.values(normalizeCoverSizes([], legacy))).toEqual(
        coverSizePages.map(() => 2)
      )
  })
})
