jest.mock('backend/game_overrides/electronStores', () => ({
  gameOverridesStore: { get: jest.fn(), set: jest.fn() }
}))

import { PluginManager } from '../pluginManager'
import type { GhostSearchResult, PluginInfo, SourceSearchProgress } from 'common/types/plugins'

function setup(searches: Array<() => Promise<GhostSearchResult[]>>) {
  const manager = Object.create(PluginManager.prototype) as PluginManager
  const plugins = searches.map((_, i) => ({ id: `source-${i}`, name: `Source ${i}`,
    isEnabled: true, type: 'game-source' } as PluginInfo))
  jest.spyOn(manager, 'getPlugins').mockReturnValue(plugins)
  Object.assign(manager, { sourceResults: new Map(), hosts: new Map(searches.map((search, i) =>
    [plugins[i].id, { getSourceProvider: () => ({ search }) }])) })
  return manager
}
const game: GhostSearchResult = { id: 'https://example.com/game/test', title: 'Test',
  platform: 'windows', providerId: '', providerName: '' }

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it('delivers fast results before the slowest source finishes, with immutable progress snapshots', async () => {
  let slow!: (games: GhostSearchResult[]) => void
  const delayed = new Promise<GhostSearchResult[]>(resolve => { slow = resolve })
  const manager = setup([async () => [game], () => delayed])
  const progress: SourceSearchProgress[] = []
  let finished = false
  const task = manager.searchExternalGames('test', next => progress.push(next)).then(result => { finished = true; return result })
  for (let i = 0; i < 5; i++) await Promise.resolve()
  expect(finished).toBe(false)
  expect(progress[0]).toMatchObject({ completed: 0, total: 2, games: [] })
  expect(progress.at(-1)).toMatchObject({ completed: 1, games: [expect.objectContaining({ providerId: 'source-0' })],
    pendingProviders: [{ id: 'source-1', name: 'Source 1' }] })
  slow([{ ...game, id: `${game.id}-other` }])
  const final = await task
  expect(final.games).toHaveLength(2)
  expect(progress.at(-1)).toMatchObject({ completed: 2, total: 2, pendingProviders: [] })
  expect(progress[0].games).toEqual([])
  expect(progress[1].games).toHaveLength(1)
})

it('preserves successful results when another source fails or times out', async () => {
  jest.useFakeTimers()
  const manager = setup([async () => [game], async () => { throw new Error('Unavailable') },
    () => new Promise(() => undefined)])
  const progress = jest.fn()
  const task = manager.searchExternalGames('test', progress)
  await jest.advanceTimersByTimeAsync(25000)
  const result = await task
  expect(result.games).toHaveLength(1)
  expect(result.errors.map(error => error.message)).toEqual(['Unavailable', 'A fonte demorou demais para responder.'])
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 3, total: 3, pendingProviders: [] }))
  expect(jest.getTimerCount()).toBe(0)
})

it('completes empty searches without leaving timers or failing when the renderer closes', async () => {
  jest.useFakeTimers()
  const manager = setup([async () => []])
  const result = await manager.searchExternalGames('test', () => { throw new Error('Renderer closed') })
  expect(result).toEqual({ games: [], errors: [] })
  expect(jest.getTimerCount()).toBe(0)
})

it('keeps simultaneous searches separate', async () => {
  const manager = setup([async () => [game]])
  const first = jest.fn()
  const second = jest.fn()
  await Promise.all([manager.searchExternalGames('first', first), manager.searchExternalGames('second', second)])
  expect(first).toHaveBeenCalledTimes(2)
  expect(second).toHaveBeenCalledTimes(2)
  expect(first.mock.calls[1][0].games).toHaveLength(1)
  expect(second.mock.calls[1][0].games).toHaveLength(1)
})
