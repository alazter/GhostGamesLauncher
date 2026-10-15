import {
  BUFFERING_DELAY_MS,
  observeVideoBuffering
} from '../../../frontend/screens/Alazterflix/videoBuffering'

class FakeVideo extends EventTarget {
  currentTime = 10
  paused = false
  ended = false
  seeking = false
  error = null
  readyState = 4
  send(event: string) {
    this.dispatchEvent(new Event(event))
  }
}

describe('Alazterflix buffering indicator', () => {
  let video: FakeVideo
  let changes: jest.Mock
  let cleanup: () => void
  beforeEach(() => {
    jest.useFakeTimers()
    video = new FakeVideo()
    changes = jest.fn()
    cleanup = observeVideoBuffering(
      video as unknown as HTMLVideoElement,
      changes
    )
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  test('a brief wait does not flash loading during continuous playback', () => {
    video.readyState = 2
    video.send('waiting')
    jest.advanceTimersByTime(BUFFERING_DELAY_MS - 1)
    video.send('playing')
    jest.advanceTimersByTime(1000)
    expect(changes.mock.calls.some(([value]) => value === true)).toBe(false)
  })
  test('a sustained real stall remains visible until playback resumes', () => {
    video.readyState = 2
    video.send('waiting')
    jest.advanceTimersByTime(BUFFERING_DELAY_MS)
    expect(changes).toHaveBeenLastCalledWith(true)
    video.send('timeupdate')
    expect(changes).toHaveBeenLastCalledWith(true)
    video.readyState = 4
    video.send('playing')
    expect(changes).toHaveBeenLastCalledWith(false)
  })
  test('advancing frames clear a stale indicator even without a second canplay event', () => {
    video.readyState = 2
    video.send('waiting')
    jest.advanceTimersByTime(BUFFERING_DELAY_MS)
    video.currentTime += 0.25
    video.readyState = 4
    video.send('timeupdate')
    expect(changes).toHaveBeenLastCalledWith(false)
  })
  test('stalled network events do not show loading while buffered playback is possible', () => {
    video.send('stalled')
    jest.advanceTimersByTime(1000)
    expect(changes.mock.calls.some(([value]) => value === true)).toBe(false)
  })
  test('repeated waiting events do not indefinitely postpone a genuine stall', () => {
    video.readyState = 2
    video.send('waiting')
    jest.advanceTimersByTime(300)
    video.send('waiting')
    jest.advanceTimersByTime(100)
    expect(changes).toHaveBeenLastCalledWith(true)
  })
  test.each(['pause', 'ended', 'error'])(
    '%s cancels pending loading',
    (event) => {
      video.readyState = 2
      video.send('waiting')
      video.send(event)
      jest.advanceTimersByTime(1000)
      expect(changes).toHaveBeenLastCalledWith(false)
      expect(changes.mock.calls.some(([value]) => value === true)).toBe(false)
    }
  )
  test('cleanup releases listeners and pending timers when a video is closed or replaced', () => {
    video.readyState = 2
    video.send('waiting')
    cleanup()
    changes.mockClear()
    video.send('waiting')
    jest.advanceTimersByTime(1000)
    expect(changes).not.toHaveBeenCalled()
  })
})
