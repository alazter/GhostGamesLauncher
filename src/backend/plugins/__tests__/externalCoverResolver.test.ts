import {
  createExternalCoverResolver,
  googleCoverCandidates
} from '../externalCoverResolver'
import { matchingAnkerCovers, isPublicCoverUrl } from 'common/externalGameCover'
import type { GhostSearchResult } from 'common/types/plugins'

const game: GhostSearchResult = {
  id: 'test',
  title: 'Hades 2',
  providerId: 'com.ghost.ankergames-source',
  providerName: 'AnkerGames',
  platform: 'windows',
  coverUrl: 'https://ankergames.net/hades-2.jpg'
}
const anker = jest.fn(),
  google = jest.fn(),
  steamgrid = jest.fn()
const resolveCover = createExternalCoverResolver({ anker, google, steamgrid })
beforeEach(() => {
  anker.mockResolvedValue([])
  google.mockResolvedValue([])
  steamgrid.mockResolvedValue([])
})

it('chooses Anker independently of source order and never asks lower tiers', async () => {
  const wrong = {
    ...game,
    providerId: 'steamrip',
    coverUrl: 'https://steamrip.com/wrong.jpg'
  }
  expect(
    await resolveCover({ title: 'Hades 2', sources: [wrong, game] })
  ).toEqual({ url: game.coverUrl, provider: 'ankergames' })
  expect(anker).not.toHaveBeenCalled()
  expect(google).not.toHaveBeenCalled()
  expect(steamgrid).not.toHaveBeenCalled()
})
it('looks up Anker before Google, then stops when Google has a usable cover', async () => {
  const order: string[] = []
  anker.mockImplementation(() => {
    order.push('anker')
    return Promise.resolve([])
  })
  google.mockImplementation(() => {
    order.push('google')
    return Promise.resolve(['https://example.com/hades-2.png'])
  })
  expect(await resolveCover({ title: 'Hades 2' })).toMatchObject({
    provider: 'google'
  })
  expect(order).toEqual(['anker', 'google'])
  expect(steamgrid).not.toHaveBeenCalled()
})
it('falls back to SteamGridDB after Google fails or blocks access', async () => {
  google.mockRejectedValue(new Error('Unavailable'))
  steamgrid.mockResolvedValue(['https://cdn2.steamgriddb.com/grid/hades-2.png'])
  expect(await resolveCover({ title: 'Hades 2' })).toMatchObject({
    provider: 'steamgriddb'
  })
})
it('does not recycle a failed URL or jump over another usable Anker cover', async () => {
  const other = 'https://ankergames.net/hades-2-new.jpg'
  anker.mockResolvedValue([game.coverUrl, other])
  expect(
    await resolveCover({
      title: 'Hades 2',
      sources: [game],
      excludedUrls: [game.coverUrl!]
    })
  ).toEqual({ url: other, provider: 'ankergames' })
  expect(google).not.toHaveBeenCalled()
})
it('keeps sequels and platforms separate and strips release metadata', () => {
  expect(
    matchingAnkerCovers({
      title: 'Hades 2 Build 123456',
      sources: [
        game,
        {
          ...game,
          title: 'Hades',
          coverUrl: 'https://ankergames.net/first.jpg'
        },
        {
          ...game,
          platform: 'switch',
          coverUrl: 'https://ankergames.net/switch.jpg'
        }
      ]
    })
  ).toEqual([game.coverUrl])
})
it('returns no arbitrary source artwork when all preferred tiers are unavailable', async () => {
  expect(
    await resolveCover({
      title: 'Hades 2',
      sources: [
        {
          ...game,
          providerId: 'other',
          coverUrl: 'https://example.com/arbitrary.jpg'
        }
      ]
    })
  ).toBeNull()
})
it('times out an unavailable provider and continues without waiting forever', async () => {
  jest.useFakeTimers()
  try {
    anker.mockImplementation(() => new Promise(() => {}))
    google.mockResolvedValue(['https://example.com/cover.jpg'])
    const pending = resolveCover({ title: 'Hades 2' })
    await jest.advanceTimersByTimeAsync(8000)
    expect(await pending).toMatchObject({ provider: 'google' })
  } finally {
    jest.useRealTimers()
  }
})
it.each([
  'file:///C:/secret.png',
  'http://example.com/cover.png',
  'https://127.0.0.1/cover.png',
  'https://[::ffff:127.0.0.1]/cover.png',
  'https://example.local/cover.png',
  'https://user:pass@example.com/cover.png'
])('rejects unsafe image address %s', (url) =>
  expect(isPublicCoverUrl(url)).toBe(false)
)
it('extracts original portrait images while rejecting thumbnails, banners and small pictures', () => {
  const html = JSON.stringify([
    ['https://example.com/cover.jpg', 900, 600],
    ['https://example.com/banner.jpg', 400, 900],
    ['https://encrypted-tbn0.gstatic.com/thumbnail.jpg', 900, 600],
    ['https://example.com/tiny.jpg', 150, 100],
    ['https://example.com/cover.jpg', 900, 600]
  ])
  expect(googleCoverCandidates(html)).toEqual(['https://example.com/cover.jpg'])
  expect(googleCoverCandidates('unusual traffic ' + html)).toEqual([])
})
