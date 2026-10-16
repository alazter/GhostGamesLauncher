import {
  callAllAbortControllers,
  createAbortController,
  deleteAbortController
} from '../utils/aborthandler/aborthandler'
jest.mock('../logger', () => ({
  logError: jest.fn(),
  LogPrefix: { Backend: 'Backend' }
}))

it('aborts each registered operation rather than iterating properties of the map iterator', () => {
  const one = createAbortController('close-fixture-one')
  const two = createAbortController('close-fixture-two')
  try {
    callAllAbortControllers()
    expect(one.signal.aborted).toBe(true)
    expect(two.signal.aborted).toBe(true)
  } finally {
    deleteAbortController('close-fixture-one')
    deleteAbortController('close-fixture-two')
  }
})
