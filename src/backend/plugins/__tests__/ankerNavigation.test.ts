import { EventEmitter } from 'events'
import type { BrowserWindow } from 'electron'
import { loadAnkerPage, evaluateAnkerPage } from '../ankerNavigation'

function fixture() {
  const contents = Object.assign(new EventEmitter(), {
    executeJavaScript: jest.fn().mockResolvedValue(true)
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
    loadURL: jest.fn().mockImplementation(() => new Promise(() => undefined))
  })
  return {
    window,
    contents,
    load: () =>
      loadAnkerPage(
        window as unknown as BrowserWindow,
        'https://ankergames.net/game/test'
      )
  }
}

afterEach(() => jest.useRealTimers())

it('releases a stalled document evaluation so the operation can time out or be cancelled', async () => {
  jest.useFakeTimers()
  const { window, contents } = fixture()
  contents.executeJavaScript.mockImplementation(
    () => new Promise(() => undefined)
  )
  const result = evaluateAnkerPage(
    window as unknown as BrowserWindow,
    'document.readyState'
  )
  await jest.advanceTimersByTimeAsync(3000)
  await expect(result).resolves.toBeUndefined()
  expect(jest.getTimerCount()).toBe(0)
})

it('continues when the document is ready although subresources never finish', async () => {
  const { load, contents } = fixture()
  const result = load()
  contents.emit('dom-ready')
  await expect(result).resolves.toBeUndefined()
  expect(contents.listenerCount('dom-ready')).toBe(0)
})

it('waits for the replacement document after an aborted navigation', async () => {
  const { load, contents, window } = fixture()
  contents.executeJavaScript.mockResolvedValueOnce(false)
  window.loadURL.mockRejectedValue({ code: 'ERR_ABORTED' })
  const result = load()
  await Promise.resolve()
  await Promise.resolve()
  contents.emit('dom-ready')
  await expect(result).resolves.toBeUndefined()
})

it('reports connection failures without exposing signed URLs or asking for login', async () => {
  const { load, window } = fixture()
  window.loadURL.mockRejectedValue({
    code: 'ERR_NAME_NOT_RESOLVED',
    message: 'https://ankergames.net/torrent/secret'
  })
  await expect(load()).rejects.toThrow('ERR_NAME_NOT_RESOLVED')
  await expect(load()).rejects.not.toThrow('secret')
})

it('does not accept an error document and times out with cleanup', async () => {
  jest.useFakeTimers()
  const { load, contents, window } = fixture()
  contents.executeJavaScript.mockResolvedValue(false)
  const result = load()
  const assertion = expect(result).rejects.toThrow('demorou')
  contents.emit('dom-ready')
  await jest.advanceTimersByTimeAsync(30000)
  await assertion
  expect(contents.listenerCount('dom-ready')).toBe(0)
  expect(window.listenerCount('closed')).toBe(0)
})
