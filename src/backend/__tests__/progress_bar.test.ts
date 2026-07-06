import { BrowserWindow } from 'electron'
import { backendEvents } from '../backend_events'
import { sendGameStatusUpdate, sendProgressUpdate } from '../utils'
import '../progress_bar'

jest.mock('../logger')

describe('progress_bar', () => {
  const window = {
    webContents: {
      send: jest.fn()
    },
    setProgressBar: jest.fn()
  }

  // stub windows
  beforeAll(() => {
    BrowserWindow['setAllWindows']([window])
  })

  // cleanup stubs
  afterAll(() => {
    BrowserWindow['setAllWindows']([])
  })

  // spy on `setProgressBar` method
  beforeEach(() => {
    window.setProgressBar = jest.fn()
  })

  describe('on gameStatusUpdate with status="queued"', () => {
    it('does nothing', () => {
      sendGameStatusUpdate({
        appName: 'Test',
        status: 'queued'
      })

      expect(window.setProgressBar).not.toBeCalled()
    })
  })

  describe('on gameStatusUpdate with status other than "done"', () => {
    it('sets progress bar to indeterminate', () => {
      sendGameStatusUpdate({
        appName: 'Test',
        status: 'installing'
      })

      expect(window.setProgressBar).toBeCalledWith(2)
    })

    it('starts listening for progress updates', () => {
      jest.spyOn(backendEvents, 'on')

      sendGameStatusUpdate({
        appName: 'Test',
        status: 'installing'
      })

      expect(backendEvents.on).toBeCalledWith(
        'progressUpdate-Test',
        expect.any(Function)
      )
    })
  })

  describe('on progressUpdate-${appName}', () => {
    it('sets progress bar according to progress', () => {
      sendProgressUpdate({
        appName: 'Test',
        status: 'installing',
        progress: { percent: 42, bytes: '', eta: '' }
      })

      expect(window.setProgressBar).toBeCalledWith(0.42)
    })
  })

  describe('on gameStatusUpdate with reset statuses', () => {
    const resetStatuses = [
      'done',
      'canceled',
      'error',
      'playing',
      'launching',
      'syncing-saves',
      'notAvailable'
    ] as const

    resetStatuses.forEach((status) => {
      it(`removes the progress bar for status="${status}"`, () => {
        sendGameStatusUpdate({
          appName: 'Test',
          status
        })

        expect(window.setProgressBar).toBeCalledWith(-1)
      })

      it(`stops listening for progress updates for status="${status}"`, () => {
        jest.spyOn(backendEvents, 'off')

        sendGameStatusUpdate({
          appName: 'Test',
          status
        })

        expect(backendEvents.off).toBeCalledWith(
          'progressUpdate-Test',
          expect.any(Function)
        )
      })
    })
  })
})
