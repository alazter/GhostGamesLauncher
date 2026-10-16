import presence from '../storeManagers/gog/presence'
import { GOGUser } from '../storeManagers/gog/user'
import { axiosClient } from '../utils'
import { callAbortController } from '../utils/aborthandler/aborthandler'

jest.mock('../logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  LogPrefix: { Gog: 'Gog' }
}))
jest.mock('../utils', () => ({
  axiosClient: { delete: jest.fn(), post: jest.fn() }
}))
jest.mock('../storeManagers/gog/user', () => ({
  GOGUser: { isLoggedIn: () => true, getCredentials: jest.fn() }
}))
jest.mock('../online_monitor', () => ({ isOnline: () => true }))
jest.mock('../config', () => ({
  GlobalConfig: { get: () => ({ getSettings: () => ({}) }) }
}))
jest.mock('../backend_events', () => ({ backendEvents: { on: jest.fn() } }))
jest.mock('../utils/aborthandler/aborthandler', () => ({
  callAbortController: jest.fn()
}))

it('passes the shutdown cancellation signal to the presence request', async () => {
  jest
    .mocked(GOGUser.getCredentials)
    .mockResolvedValue({
      user_id: 'fixture',
      access_token: 'fixture'
    } as Awaited<ReturnType<typeof GOGUser.getCredentials>>)
  jest.mocked(axiosClient.delete).mockResolvedValue({ status: 204 })
  const controller = new AbortController()
  await presence.deletePresence(false, controller.signal)
  expect(axiosClient.delete).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ signal: controller.signal })
  )
  controller.abort()
  expect(callAbortController).not.toHaveBeenCalled() // Completed request removes its listener.
})

it('aborts a stalled credential helper and does not start presence HTTP after the deadline', async () => {
  let finish: (
    value: Awaited<ReturnType<typeof GOGUser.getCredentials>>
  ) => void = () => undefined
  jest.mocked(GOGUser.getCredentials).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const controller = new AbortController()
  const pending = presence.deletePresence(false, controller.signal)
  controller.abort()
  expect(callAbortController).toHaveBeenCalledWith('gogdl-get-credentials')
  finish({ user_id: 'fixture', access_token: 'fixture' } as Awaited<
    ReturnType<typeof GOGUser.getCredentials>
  >)
  await pending
  expect(axiosClient.delete).not.toHaveBeenCalled()
})
