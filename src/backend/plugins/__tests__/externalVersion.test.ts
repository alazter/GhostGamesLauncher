import {
  synchronizeExternalVersion,
  refreshExternalRelease
} from '../externalVersion'
import { libraryStore } from 'backend/storeManagers/sideload/electronStores'
import { gameOverridesStore } from 'backend/game_overrides/electronStores'
import { isNewerRelease } from '../externalPolicy'

jest.mock('backend/storeManagers/sideload/electronStores', () => ({
  libraryStore: { get: jest.fn(), set: jest.fn() }
}))
jest.mock('backend/game_overrides/electronStores', () => ({
  gameOverridesStore: { get: jest.fn(), set: jest.fn() }
}))
jest.mock('backend/ipc', () => ({ sendFrontendMessage: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

it('repairs the old displayed version while preserving custom artwork and title', () => {
  jest
    .mocked(libraryStore.get)
    .mockReturnValue([
      { app_name: 'inzoi', runner: 'sideload', version: 'v0.9.0' }
    ] as never)
  jest
    .mocked(gameOverridesStore.get)
    .mockReturnValue({
      inzoi: {
        version: 'v0.9.0',
        title: 'My inZOI',
        art_cover: 'cover.png',
        is_manual: true
      },
      other: { version: 'v1.0' }
    } as never)
  synchronizeExternalVersion('inzoi', 'v0.10.4')
  expect(libraryStore.set).toHaveBeenCalledWith('games', [
    expect.objectContaining({ version: 'v0.10.4' })
  ])
  expect(gameOverridesStore.set).toHaveBeenCalledWith('overrides', {
    inzoi: { title: 'My inZOI', art_cover: 'cover.png', is_manual: true },
    other: { version: 'v1.0' }
  })
})

it('does not keep an old version when the newly installed package has no version', () => {
  jest
    .mocked(libraryStore.get)
    .mockReturnValue([
      { app_name: 'game', runner: 'sideload', version: 'v1.0' }
    ] as never)
  jest
    .mocked(gameOverridesStore.get)
    .mockReturnValue({ game: { version: 'v1.0' } } as never)
  synchronizeExternalVersion('game', undefined)
  expect(libraryStore.set).toHaveBeenCalledWith('games', [
    expect.objectContaining({ version: undefined })
  ])
  expect(gameOverridesStore.set).toHaveBeenCalledWith('overrides', { game: {} })
})

it('leaves official store games alone', () => {
  jest
    .mocked(libraryStore.get)
    .mockReturnValue([
      { app_name: 'official', runner: 'legendary', version: '1.0' }
    ] as never)
  synchronizeExternalVersion('official', '2.0')
  expect(libraryStore.set).not.toHaveBeenCalled()
  expect(gameOverridesStore.set).not.toHaveBeenCalled()
})

it('compares the actual installed release numerically, including the reported inZOI versions', () => {
  expect(isNewerRelease('v0.9.0', 'v0.10.4')).toBe(true)
  expect(isNewerRelease('v0.10.4', 'v0.10.4')).toBe(false)
  expect(isNewerRelease('v0.10.4', 'v0.10.5')).toBe(true)
  expect(isNewerRelease('v0.10.4', 'v0.9.0')).toBe(false)
})

it('refreshes cached search metadata before recording the downloaded release', async () => {
  const cached = {
    id: 'inzoi',
    title: 'inZOI',
    providerId: 'anker',
    providerName: 'Anker',
    platform: 'windows' as const,
    version: 'v0.9.0'
  }
  const getDetails = jest.fn(async () => ({ ...cached, version: 'v0.10.4' }))
  expect((await refreshExternalRelease(cached, getDetails)).version).toBe(
    'v0.10.4'
  )
  expect(getDetails).toHaveBeenCalledWith('inzoi')
  expect(
    (
      await refreshExternalRelease(cached, async () => ({
        ...cached,
        version: undefined
      }))
    ).version
  ).toBeUndefined()
  await expect(
    refreshExternalRelease(cached, async () => ({
      ...cached,
      id: 'other-game'
    }))
  ).rejects.toThrow('edição')
})
