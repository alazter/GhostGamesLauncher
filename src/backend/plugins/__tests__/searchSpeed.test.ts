jest.mock('../adaptiveSource', () => ({ adaptiveGames: jest.fn(), experimentalPage: jest.fn() }))
import { adaptiveGames } from '../adaptiveSource'
import { NetworkGuard } from '../networkGuard'
import { websiteSource } from '../websiteSource'
import type { PluginManifest } from 'common/types/plugins'

const manifest = { id: 'com.ghost.ankergames-source', name: 'AnkerGames',
  homepage: 'https://ankergames.net', allowedDomains: ['ankergames.net'],
  permissions: ['network', 'game-sources'] } as PluginManifest
const config = { catalogPath: '/games-list', gamePathPrefix: '/game/', platform: 'windows' as const }

afterEach(() => jest.restoreAllMocks())

it('returns recognised games without waiting for an adaptive engine or querying spelling variants', async () => {
  jest.mocked(adaptiveGames).mockImplementation(() => new Promise(() => undefined))
  const request = jest.spyOn(NetworkGuard, 'fetchResponse').mockImplementation(async () => new Response(
    '<article><h2><a href="/game/stalker-2">S.T.A.L.K.E.R. 2</a></h2></article>'))
  const result = await websiteSource(manifest, config).search('stalker 2')
  expect(result.map(game => game.title)).toEqual(['S.T.A.L.K.E.R. 2'])
  expect(request).toHaveBeenCalledTimes(1)
  expect(adaptiveGames).not.toHaveBeenCalled()
})

it('uses the adaptive engine when the normal reader cannot recognise the page layout', async () => {
  jest.mocked(adaptiveGames).mockResolvedValue([{ id: 'https://ankergames.net/game/test', title: 'Test',
    providerId: manifest.id, providerName: manifest.name, platform: 'windows' }])
  jest.spyOn(NetworkGuard, 'fetchResponse').mockImplementation(async () => new Response('<div>Changed layout</div>'))
  const result = await websiteSource(manifest, config).search('test')
  expect(result.map(game => game.title)).toEqual(['Test'])
  expect(adaptiveGames).toHaveBeenCalledTimes(1)
})
