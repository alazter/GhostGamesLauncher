jest.mock('../../plugins/sourceEngines', () => ({
  withSourceEngine: jest.fn()
}))
jest.mock('../../plugins/engineProcess', () => ({ engineProcess: jest.fn() }))
jest.mock('../../plugins/adaptiveSource', () => ({
  experimentalPage: jest.fn()
}))
import { withSourceEngine } from '../../plugins/sourceEngines'
import { engineProcess } from '../../plugins/engineProcess'
import { experimentalPage } from '../../plugins/adaptiveSource'
import {
  parseResilient,
  releaseSelectors,
  obscuraReleasePage
} from '../engines'
let sequence = 0
beforeEach(() => {
  const executable = `worker-${sequence++}`
  ;(withSourceEngine as jest.Mock).mockImplementation((_id, run) =>
    run(executable, 'test-storage')
  )
  ;(engineProcess as jest.Mock).mockImplementation((_exe, args, input) => {
    if (args.includes('--self-test'))
      return JSON.stringify({
        ok: true,
        capabilities: ['release-selectors-v1']
      })
    const request = JSON.parse(input)
    return JSON.stringify({
      capability: 'release-selectors-v1',
      recovered: 1,
      html: request.mode === 'repair' ? 'recovered-document' : undefined
    })
  })
})
it('trains only validated documents and revalidates adaptive output before returning it', async () => {
  const parse = jest.fn((html: string) => {
    if (html === 'changed-document') throw new Error('Changed')
    return html
  })
  expect(
    await parseResilient('changed-document', 'product:us:game', parse)
  ).toBe('recovered-document')
  expect(parse.mock.calls).toEqual([
    ['changed-document'],
    ['recovered-document']
  ])
  expect(
    (engineProcess as jest.Mock).mock.calls
      .filter((call) => call[2])
      .map((call) => JSON.parse(call[2]).mode)
  ).toEqual(['repair'])
})
it('does not accept a recovered document if its fields still fail validation', async () => {
  await expect(
    parseResilient('changed', 'identity', () => {
      throw new Error('Wrong region')
    })
  ).rejects.toThrow('Wrong region')
})
it('leaves older installed bundles alone when they do not advertise the new capability', async () => {
  ;(engineProcess as jest.Mock).mockResolvedValue(
    JSON.stringify({ ok: true, protocol: 1 })
  )
  expect(await releaseSelectors('html', 'identity', 'repair')).toBeUndefined()
  expect(engineProcess).toHaveBeenCalledTimes(1)
})
it('does not invoke either engine to solve an access challenge', async () => {
  await expect(
    parseResilient('<title>Just a moment</title>', 'identity', () => true)
  ).rejects.toThrow('verificação')
  expect(withSourceEngine).not.toHaveBeenCalled()
})
it('limits Obscura to the release origin and read-only catalog/detail paths', async () => {
  for (const url of [
    'http://127.0.0.1/',
    'https://www.releases.com/account/login',
    'https://evil.test/calendar'
  ])
    await expect(obscuraReleasePage(url)).rejects.toThrow()
  ;(experimentalPage as jest.Mock).mockResolvedValue('<html>public</html>')
  expect(
    await obscuraReleasePage('https://www.releases.com/calendar/games')
  ).toBe('<html>public</html>')
  expect(experimentalPage).toHaveBeenCalledTimes(1)
})
