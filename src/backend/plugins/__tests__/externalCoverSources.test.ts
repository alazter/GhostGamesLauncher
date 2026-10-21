jest.mock('electron', () => {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events')
  class Window extends EventEmitter {
    dead = false
    webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: jest.fn(),
      executeJavaScript: jest.fn(() => Promise.resolve(mockHtml))
    })
    loadURL = jest.fn(() => {
      queueMicrotask(() => this.webContents.emit('did-finish-load'))
      return Promise.resolve()
    })
    constructor(options: unknown) {
      super()
      mockWindows.push(this)
      mockOptions.push(options)
    }
    isDestroyed() {
      return this.dead
    }
    destroy() {
      this.dead = true
      this.emit('closed')
    }
  }
  return {
    BrowserWindow: Window,
    session: {
      fromPartition: jest.fn(() => ({
        setPermissionRequestHandler: jest.fn(),
        webRequest: { onBeforeRequest: jest.fn() }
      }))
    }
  }
})
jest.mock('backend/storeManagers/sideload/steamgridHelper', () => ({
  getApiKey: jest.fn()
}))
jest.mock('backend/steamgrid/utils', () => ({
  searchGame: jest.fn(),
  getGrids: jest.fn()
}))

import { resolveExternalGameCover } from '../externalCoverSources'
import { getApiKey } from 'backend/storeManagers/sideload/steamgridHelper'
import * as SteamGridDB from 'backend/steamgrid/utils'
import { session } from 'electron'

let mockHtml = ''
const mockWindows: Array<{ dead: boolean }> = []
const mockOptions: Array<unknown> = []
const anker = jest.fn()
beforeEach(() => {
  jest
    .mocked(session.fromPartition)
    .mockReturnValue({
      setPermissionRequestHandler: jest.fn(),
      webRequest: { onBeforeRequest: jest.fn() }
    } as unknown as ReturnType<typeof session.fromPartition>)
  anker.mockResolvedValue([])
  jest.mocked(getApiKey).mockReturnValue('test-only')
  jest.mocked(SteamGridDB.searchGame).mockResolvedValue([])
  jest.mocked(SteamGridDB.getGrids).mockResolvedValue([])
})

it('loads Google in a hidden sandbox without account sessions and closes it after reading candidates', async () => {
  mockHtml = '[["https://example.com/portrait.jpg",900,600]]'
  expect(
    await resolveExternalGameCover({ title: 'Google cover example' }, anker)
  ).toEqual({ provider: 'google', url: 'https://example.com/portrait.jpg' })
  expect(mockOptions[0]).toMatchObject({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  expect(mockWindows.every((window) => window.dead)).toBe(true)
  expect(SteamGridDB.searchGame).not.toHaveBeenCalled()
})

it('reuses lookup results when another component rejects a broken cover, trying the next tier', async () => {
  jest
    .mocked(SteamGridDB.searchGame)
    .mockResolvedValue([{ id: 12, name: 'Google cover example' }])
  jest
    .mocked(SteamGridDB.getGrids)
    .mockResolvedValue([
      { id: 1, url: 'https://cdn2.steamgriddb.com/grid/portrait.jpg' }
    ] as Awaited<ReturnType<typeof SteamGridDB.getGrids>>)
  const count = mockWindows.length
  expect(
    await resolveExternalGameCover(
      {
        title: 'Google cover example',
        excludedUrls: ['https://example.com/portrait.jpg']
      },
      anker
    )
  ).toMatchObject({ provider: 'steamgriddb' })
  expect(mockWindows).toHaveLength(count)
  expect(anker).not.toHaveBeenCalled()
  expect(SteamGridDB.getGrids).toHaveBeenCalledWith(
    'test-only',
    expect.objectContaining({ dimensions: ['600x900'], types: ['static'] })
  )
})

it('treats a challenge as unavailable and refuses a different sequel from SteamGridDB', async () => {
  mockHtml = 'unusual traffic /sorry/'
  jest
    .mocked(SteamGridDB.searchGame)
    .mockResolvedValue([{ id: 2, name: 'Sequel 2' }])
  expect(await resolveExternalGameCover({ title: 'Sequel' }, anker)).toBeNull()
  expect(SteamGridDB.getGrids).not.toHaveBeenCalled()
  expect(mockWindows.every((window) => window.dead)).toBe(true)
})

it('skips blocked Google temporarily and does not request SteamGridDB without a saved key', async () => {
  const count = mockWindows.length
  jest.mocked(getApiKey).mockReturnValue('')
  expect(
    await resolveExternalGameCover({ title: 'No configured source' }, anker)
  ).toBeNull()
  expect(mockWindows).toHaveLength(count)
  expect(SteamGridDB.searchGame).not.toHaveBeenCalled()
})
