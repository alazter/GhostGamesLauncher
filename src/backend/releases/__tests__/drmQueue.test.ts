import { DrmLookupQueue } from '../drmQueue'
it('limits concurrent reads, prioritizes details and deduplicates an already queued card', async () => {
  const queue = new DrmLookupQueue<string>(1)
  let finish!: (value: string) => void
  const calls: string[] = []
  const first = queue.run(
    'first',
    () =>
      new Promise<string>((resolve) => {
        calls.push('first')
        finish = resolve
      })
  )
  const second = queue.run('second', async () => {
    calls.push('second')
    return 'second'
  })
  const detail = queue.run('detail', async () => {
    calls.push('detail')
    return 'detail'
  })
  const promoted = queue.run(
    'detail',
    async () => {
      throw new Error('Duplicate read')
    },
    true
  )
  expect(promoted).toBe(detail)
  await Promise.resolve()
  expect(calls).toEqual(['first'])
  finish('first')
  await Promise.all([first, second, detail])
  expect(calls).toEqual(['first', 'detail', 'second'])
})
