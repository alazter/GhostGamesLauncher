import type { DownloadItem } from 'electron'
import { directDownloadRecovery } from '../directDownloadRecovery'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
function fixture(canResume = true) {
  const item = {
    getURL: () => 'https://host.example/file?private=secret',
    getReceivedBytes: () => 100,
    getTotalBytes: () => 200,
    getState: jest.fn(() => 'interrupted'),
    canResume: jest.fn(() => canResume),
    resume: jest.fn()
  }
  const fail = jest.fn(),
    report = jest.fn()
  const recovery = directDownloadRecovery(
    item as unknown as DownloadItem,
    fail,
    report
  )
  return { item, fail, report, recovery }
}

it('recovers an interrupted update without cancelling or immediately failing', () => {
  const { item, fail, report, recovery } = fixture()
  recovery.updated('interrupted')
  recovery.updated('interrupted')
  expect(fail).not.toHaveBeenCalled()
  jest.advanceTimersByTime(2000)
  expect(item.resume).toHaveBeenCalledTimes(1)
  recovery.updated('progressing')
  recovery.done('completed')
  expect(fail).not.toHaveBeenCalled()
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'recovered', host: 'host.example' })
  )
  expect(JSON.stringify(report.mock.calls)).not.toContain('secret')
})

it('bounds retries and explains the new-link fallback', () => {
  const { item, fail, recovery } = fixture()
  for (let count = 0; count < 6; count++) {
    recovery.updated('interrupted')
    jest.runOnlyPendingTimers()
  }
  expect(item.resume).toHaveBeenCalledTimes(5)
  expect(fail).toHaveBeenCalledTimes(1)
  expect(fail.mock.calls[0][0].message).toContain('Retomar')
})

it('does not retry a non-resumable download or revive a cancelled operation', () => {
  const unavailable = fixture(false)
  unavailable.recovery.updated('interrupted')
  expect(unavailable.fail).toHaveBeenCalledTimes(1)
  const cancelled = fixture()
  cancelled.recovery.updated('interrupted')
  cancelled.recovery.stop()
  jest.runAllTimers()
  expect(cancelled.item.resume).not.toHaveBeenCalled()
})

it('clears a pending retry after terminal completion or spontaneous recovery', () => {
  for (const event of ['done', 'progressing']) {
    const { item, recovery } = fixture()
    recovery.updated('interrupted')
    if (event === 'done') recovery.done('interrupted')
    else recovery.updated('progressing')
    jest.runAllTimers()
    expect(item.resume).not.toHaveBeenCalled()
  }
})
