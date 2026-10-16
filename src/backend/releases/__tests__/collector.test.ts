jest.mock('../engines', () => ({
  obscuraReleasePage: jest.fn(),
  scraplingReleasePage: jest.fn()
}))
import { obscuraReleasePage, scraplingReleasePage } from '../engines'
import { collectReleasePage, validateReleaseCollector } from '../collector'
const url = 'https://www.releases.com/calendar/games'
const parse = jest.fn<Promise<string[]>, [string]>()
const native = jest.fn<Promise<string>, []>()
beforeEach(() => {
  parse.mockImplementation(async (html) => {
    if (html === 'broken') throw new Error('Invalid dates')
    if (html === 'challenge') throw new Error('A fonte exige verificação.')
    return [html]
  })
  native.mockResolvedValue('native')
})

it('preserves the default collector and rejects invalid IPC options', async () => {
  expect(await collectReleasePage(url, {}, parse, native)).toEqual({
    value: ['native']
  })
  expect(scraplingReleasePage).not.toHaveBeenCalled()
  expect(obscuraReleasePage).not.toHaveBeenCalled()
  expect(() => validateReleaseCollector('arbitrary-command')).toThrow(
    'inválido'
  )
})

it.each(['scrapling', 'obscura'] as const)(
  'prefers %s without opening an Electron source page',
  async (collector) => {
    ;(scraplingReleasePage as jest.Mock).mockResolvedValue('preferred')
    ;(obscuraReleasePage as jest.Mock).mockResolvedValue('preferred')
    expect(await collectReleasePage(url, { collector }, parse, native)).toEqual(
      { value: ['preferred'] }
    )
    expect(native).not.toHaveBeenCalled()
  }
)

it.each([undefined, 'broken'])(
  'falls back with a notice when the motor is unavailable or invalid (%s)',
  async (html) => {
    ;(scraplingReleasePage as jest.Mock).mockResolvedValue(html)
    expect(
      await collectReleasePage(url, { collector: 'scrapling' }, parse, native)
    ).toEqual({
      value: ['native'],
      warning: expect.stringContaining('Usando o coletor padrão')
    })
    expect(native).toHaveBeenCalledTimes(1)
  }
)

it('preserves the failure when both the preferred and default documents are invalid', async () => {
  ;(scraplingReleasePage as jest.Mock).mockResolvedValue('broken')
  await expect(
    collectReleasePage(
      url,
      { collector: 'scrapling' },
      parse,
      async () => 'broken'
    )
  ).rejects.toThrow('Invalid dates')
})

it('does not silently switch motors after an access challenge or HTTP refusal', async () => {
  ;(scraplingReleasePage as jest.Mock).mockResolvedValue('challenge')
  await expect(
    collectReleasePage(url, { collector: 'scrapling' }, parse, native)
  ).rejects.toThrow('verificação')
  ;(scraplingReleasePage as jest.Mock).mockRejectedValue(new Error('HTTP 429'))
  await expect(
    collectReleasePage(url, { collector: 'scrapling' }, parse, native)
  ).rejects.toThrow('429')
  expect(native).not.toHaveBeenCalled()
})

it.each([{ region: 'uk' as const }, { search: 'Game' }])(
  'uses the existing session for region switching and search (%j)',
  async (query) => {
    expect(
      (
        await collectReleasePage(
          url,
          { ...query, collector: 'scrapling' },
          parse,
          native
        )
      ).value
    ).toEqual(['native'])
    expect(scraplingReleasePage).not.toHaveBeenCalled()
  }
)
