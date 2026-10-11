import {
  drmBatchGames,
  refreshReleaseDrmBatch,
  requestReleaseDrm,
  subscribeReleaseDrm
} from 'frontend/helpers/releaseDrmRequests'
import type { ReleaseProduct } from 'common/types/releases'
import type { ReleaseDrmReport, ReleaseDrmStatus } from 'common/releaseDrm'

const mockDrm = jest.fn()
const game = (id: string, category = 'games'): ReleaseProduct => ({
  id,
  title: id,
  category,
  url: `https://www.releases.com/p/${id}`,
  platforms: ['PC'],
  dateLabel: 'TBA',
  region: 'us',
  releases: [],
  images: [],
  videos: [],
  tags: []
})
const report = (
  id: string,
  status: ReleaseDrmStatus = 'cracked'
): ReleaseDrmReport => ({
  id,
  title: id,
  status,
  platform: 'PC',
  checkedAt: new Date().toISOString(),
  sources: [
    { name: 'IsItCracked', status, url: `https://isitcracked.com/game/${id}` }
  ]
})
beforeEach(() => {
  mockDrm.mockClear()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      api: { releasesDrm: mockDrm, releasesDrmEndManual: async () => undefined }
    }
  })
  mockDrm.mockImplementation(async ({ id }) => report(id))
})
afterEach(() => jest.restoreAllMocks())

it('deduplicates calendar occurrences and tracked copies and excludes non-game categories', () => {
  expect(
    drmBatchGames([
      game('game-a'),
      game('game-a'),
      game('game-b'),
      game('movie', 'movies')
    ])
  ).toEqual([
    { id: 'game-a', title: 'game-a' },
    { id: 'game-b', title: 'game-b' }
  ])
})
it('stops automatic reads after confirmation but a general manual check forces every game', async () => {
  const games = [game('final-one'), game('final-two')]
  const listener = jest.fn()
  const unsubscribe = subscribeReleaseDrm(games[0], listener)
  await requestReleaseDrm(games[0])
  const realNow = Date.now()
  jest.spyOn(Date, 'now').mockReturnValue(realNow + 86400000)
  await requestReleaseDrm(games[0])
  expect(mockDrm).toHaveBeenCalledTimes(1)
  const progress = jest.fn()
  expect(
    await refreshReleaseDrmBatch(
      [...games, games[0]],
      progress,
      new AbortController().signal
    )
  ).toEqual({
    total: 2,
    completed: 2,
    failed: 0,
    unconfirmed: 0,
    hizVerification: false
  })
  expect(
    mockDrm.mock.calls.slice(1).every(([query]) => query.refresh === true)
  ).toBe(true)
  expect(listener).toHaveBeenCalledTimes(2)
  unsubscribe()
})
it.each(['uncracked', 'unknown', 'bypassed', 'conflicting'] as const)(
  'continues periodic checking for %s',
  async (status) => {
    const product = game('pending-' + status)
    mockDrm.mockImplementation(async () => report(product.id, status))
    await requestReleaseDrm(product)
    const realNow = Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 16 * 60000)
    await requestReleaseDrm(product)
    expect(mockDrm).toHaveBeenCalledTimes(2)
  }
)
it('enables browser support only for the general button, preserving automatic and individual refresh requests', async () => {
  await requestReleaseDrm(game('ordinary-auto'))
  await requestReleaseDrm(game('ordinary-individual'), true, true)
  expect(
    mockDrm.mock.calls.every(([query]) => query.manual === undefined)
  ).toBe(true)
  await refreshReleaseDrmBatch(
    [game('manual-browser')],
    jest.fn(),
    new AbortController().signal
  )
  expect(mockDrm).toHaveBeenLastCalledWith(
    expect.objectContaining({ refresh: true, manual: 'general' })
  )
})
it('allows the remaining games to finish while HizSearch is waiting for human verification', async () => {
  mockDrm.mockImplementation(async ({ id }) => ({
    ...report(id),
    sources: [
      ...report(id).sources,
      {
        name: 'HizSearch',
        url: 'https://hizsearch.pages.dev/',
        requiresVerification: true
      }
    ]
  }))
  expect(
    await refreshReleaseDrmBatch(
      [game('hiz-wait-one'), game('hiz-wait-two')],
      jest.fn(),
      new AbortController().signal
    )
  ).toMatchObject({ completed: 2, hizVerification: true, failed: 0 })
  await refreshReleaseDrmBatch(
    [game('hiz-wait-one')],
    jest.fn(),
    new AbortController().signal,
    'hiz'
  )
  expect(mockDrm).toHaveBeenLastCalledWith(
    expect.objectContaining({ manual: 'hiz' })
  )
})
it('keeps at most two requests active and stopping does not dispatch remaining games', async () => {
  const pending: ((report: ReleaseDrmReport) => void)[] = []
  mockDrm.mockImplementation(
    () => new Promise<ReleaseDrmReport>((resolve) => pending.push(resolve))
  )
  const controller = new AbortController()
  const run = refreshReleaseDrmBatch(
    [game('cancel-a'), game('cancel-b'), game('cancel-c')],
    jest.fn(),
    controller.signal
  )
  expect(mockDrm).toHaveBeenCalledTimes(2)
  controller.abort()
  pending[0](report('cancel-a'))
  pending[1](report('cancel-b'))
  expect(await run).toMatchObject({ total: 3, completed: 2 })
  expect(mockDrm).toHaveBeenCalledTimes(2)
})
it('reports failed and unconfirmed requests and continues the batch', async () => {
  mockDrm.mockImplementation(async ({ id }) => {
    if (id === 'failure') throw new Error('Offline')
    return report(id, id === 'no-confirmation' ? 'unknown' : 'cracked')
  })
  expect(
    await refreshReleaseDrmBatch(
      [game('failure'), game('no-confirmation'), game('success')],
      jest.fn(),
      new AbortController().signal
    )
  ).toMatchObject({ completed: 3, failed: 1, unconfirmed: 1 })
})
