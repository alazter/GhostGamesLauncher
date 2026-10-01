import { downloadProgress } from '../downloadProgress'

afterEach(() => jest.restoreAllMocks())

it('bounds UI and disk work during a burst of download chunks', () => {
  let now = 0
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  const report = jest.fn()
  const save = jest.fn()
  const progress = downloadProgress(0, report, save)
  for (let chunk = 1; chunk <= 2000; chunk++) {
    now = chunk * 10
    progress(chunk * 65536)
  }
  expect(report).toHaveBeenCalledTimes(40)
  expect(save).toHaveBeenCalledTimes(2)
  expect(report).toHaveBeenLastCalledWith(6553600)
})

it('checkpoints the captured path immediately and flushes a short transfer', () => {
  let now = 0
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  const report = jest.fn()
  const save = jest.fn()
  const progress = downloadProgress(100, report, save)
  progress(100, true)
  expect(save).toHaveBeenCalledTimes(1)
  now = 200
  progress(300, true)
  expect(report).toHaveBeenLastCalledWith(1000)
  expect(save).toHaveBeenCalledTimes(2)
})
