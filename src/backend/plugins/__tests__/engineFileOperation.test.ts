import { engineFileOperation } from '../engineFileOperation'

it('retries a Windows executable sharing failure before activating the folder', async () => {
  const operation = jest
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('Sharing violation'), { code: 'EPERM' })
    )
    .mockResolvedValue('activated')
  await expect(engineFileOperation(operation, [0])).resolves.toBe('activated')
  expect(operation).toHaveBeenCalledTimes(2)
})
it('bounds retries and propagates the original failure', async () => {
  const error = Object.assign(new Error('Still locked'), { code: 'EBUSY' })
  const operation = jest.fn().mockRejectedValue(error)
  await expect(engineFileOperation(operation, [0, 0])).rejects.toBe(error)
  expect(operation).toHaveBeenCalledTimes(3)
})
it('does not retry disk space or missing path errors', async () => {
  const error = Object.assign(new Error('No space'), { code: 'ENOSPC' })
  const operation = jest.fn().mockRejectedValue(error)
  await expect(engineFileOperation(operation, [0])).rejects.toBe(error)
  expect(operation).toHaveBeenCalledTimes(1)
})
