jest.mock('backend/game_overrides/electronStores', () => ({
  gameOverridesStore: { get: jest.fn(), set: jest.fn() }
}))
jest.mock('../externalGames', () => ({
  ExternalGames: { getInstance: jest.fn() }, setOnExternalQueueChanged: jest.fn()
}))

import { PluginManager } from '../pluginManager'
import { ExternalGames } from '../externalGames'
import type { GhostSearchResult, PluginInfo } from 'common/types/plugins'

const game: GhostSearchResult = {
  id: 'https://ankergames.net/game/dimraeth', title: 'Dimraeth',
  providerId: 'com.ghost.ankergames-source', providerName: 'AnkerGames',
  platform: 'windows', version: 'v0.107.7832', sourceDate: '2026-10-13'
}

it.each([
  ['v0.107.7832', 'v0.107.7832', true],
  ['v0.107.7832', 'v0.107.7756', true],
  ['v1.009.1', 'v1.009.1', true],
  ['v1.009.1', 'v1.010', true],
  ['v1.0', 'v1.0.0', true]
])('checks %s against %s using the newer source release date', async (current, next, newer) => {
  const manager = Object.create(PluginManager.prototype) as PluginManager
  const remote = { ...game, version: next, sourceDate: '2026-10-14' }
  const recordUpdate = jest.fn()
  jest.mocked(ExternalGames.getInstance).mockReturnValue({
    snapshot: () => ({ installations: [{ id: 'installed', game: { ...game, version: current } }] }),
    recordUpdate
  } as unknown as ExternalGames)
  jest.spyOn(manager, 'getPlugins').mockReturnValue([
    { id: game.providerId, name: 'AnkerGames', isEnabled: true } as PluginInfo
  ])
  Object.assign(manager, {
    hosts: new Map([[game.providerId, { getSourceProvider: () => ({ getDetails: async () => remote }) }]]),
    sourceResults: new Map()
  })
  const result = await manager.checkExternalUpdate('installed')
  expect(result.success).toBe(true)
  expect(Boolean(result.update)).toBe(newer)
  expect(recordUpdate).toHaveBeenCalledWith('installed', newer ? expect.objectContaining({ version: next }) : undefined, expect.any(String))
})

it('clears an unconfirmed notice and reports incompatible version formats', async () => {
  const manager = Object.create(PluginManager.prototype) as PluginManager
  const recordUpdate = jest.fn()
  jest.mocked(ExternalGames.getInstance).mockReturnValue({
    snapshot: () => ({ installations: [{ id: 'installed', game: { ...game, version: 'Build 1234', sourceDate: undefined } }] }),
    recordUpdate
  } as unknown as ExternalGames)
  jest.spyOn(manager, 'getPlugins').mockReturnValue([
    { id: game.providerId, isEnabled: true } as PluginInfo
  ])
  Object.assign(manager, { hosts: new Map([[game.providerId, {
    getSourceProvider: () => ({ getDetails: async () => ({ ...game, sourceDate: '2026-10-14' }) })
  }]]) })
  const result = await manager.checkExternalUpdate('installed')
  expect(result.success).toBe(false)
  expect(result.error).toMatch(/não são comparáveis/)
  expect(recordUpdate).toHaveBeenCalledWith('installed', undefined, expect.any(String))
})
