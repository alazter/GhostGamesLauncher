import {
  readDrmCsv,
  parseCrackWatchSheet,
  parseCrackWatchIndex,
  DRM_SHEETS,
  drmSheetUrl,
  CRACKWATCH_INDEX
} from '../drmCommunityParser'
import { safeDrmSourceUrl } from 'common/releaseDrm'
const observed = '2026-10-04T20:00:00.000Z'
const sheet = (gid: string) => DRM_SHEETS.find((item) => item.gid === gid)!

it('reads Google CSV quoting, commas, multiline cells, escaped quotes and BOM', () => {
  expect(
    readDrmCsv('\uFEFFName,Comment\r\n"A, B","line 1\nline ""2"""\r\n')
  ).toEqual([
    ['Name', 'Comment'],
    ['A, B', 'line 1\nline "2"']
  ])
  expect(() => readDrmCsv('Name\n"unterminated')).toThrow()
  expect(() => readDrmCsv('Name\n"quoted"junk')).toThrow()
})
it('finds headers after instructions and accepts repeated tables and genuinely empty tabs', () => {
  const csv =
    'Instructions,,,\n,,,\nName,Published By,Released,Cracked,By,Hypervisor\nGame A,Publisher,2020-01-01,,,Exists\n,,,\nName,Published By,Released,Cracked,By,Hypervisor\nGame B,Publisher,2020-01-01,2021-01-01,CPY,Not needed'
  const sources = parseCrackWatchSheet(csv, sheet('2072675210'), observed)
  expect(sources.map((source) => source.status)).toEqual([
    'bypassed',
    'cracked'
  ])
  expect(
    parseCrackWatchSheet(
      'Name,Published By,Released,Store page',
      sheet('464952770'),
      observed
    )
  ).toEqual([])
  expect(() =>
    parseCrackWatchSheet('Title,Date\nGame,2020', sheet('0'), observed)
  ).toThrow()
  expect(() =>
    parseCrackWatchSheet(
      'Name,Released,By\nGame,2020,CPY',
      sheet('0'),
      observed
    )
  ).toThrow()
})
it('preserves distinct crack, bypass, upcoming and removal semantics', () => {
  expect(
    parseCrackWatchSheet(
      'Name,Released,Cracked,By\nPersona 3 Reload,2024-02-02,2026-09-05,voices38',
      sheet('0'),
      observed
    )[0]
  ).toMatchObject({
    status: 'cracked',
    crackDate: '2026-09-05',
    group: 'voices38',
    observedAt: observed
  })
  expect(
    parseCrackWatchSheet(
      'Name,Released,Bypassed by\nGame,2024-02-02,Hypervisor',
      sheet('2121137636'),
      observed
    )[0].status
  ).toBe('bypassed')
  const removed = parseCrackWatchSheet(
    'Name,Released,Cracked,By\nGame,2024-02-02,,',
    sheet('1664037808'),
    observed
  )[0]
  expect(removed.status).toBeUndefined()
  expect(removed.protection).toContain('pelo menos uma versão')
  const future = parseCrackWatchSheet(
    'Name,Releasing\nGame,2026-10-06\nOld game,2026-01-01',
    sheet('587965008'),
    observed
  )
  expect(future[0]).toMatchObject({
    status: 'unreleased',
    protection: expect.stringContaining('estimativas')
  })
  expect(future[1].status).toBeUndefined()
})
it('does not treat a crack before Denuvo was added as a current Denuvo crack', () => {
  const source = parseCrackWatchSheet(
    'Name,Released,Originally cracked on,Original cracker,Denuvo cracked on,By\nGame,2020-01-01,2020-01-02,CPY,,',
    sheet('534853160'),
    observed
  )[0]
  expect(source.status).toBeUndefined()
  expect(source.crackDate).toBeUndefined()
  expect(
    parseCrackWatchSheet(
      'Name,Released,Cracked,By\nGame,2020-01-01,,',
      sheet('31030764'),
      observed
    )[0]
  ).toMatchObject({ protection: 'UWP / Microsoft Store' })
})
it('reads only explicit matching status rows from the exact curated post', () => {
  const post = (selftext: string, id = 'p9ak4n') => [
    {
      data: { children: [{ data: { id, subreddit: 'CrackWatch', selftext } }] }
    }
  ]
  const markdown =
    '|Game|Status|Group|Crack date|\n|--|--|--|--|\n|Minecraft Dungeons II|Cracked|RUNE|2026-09-30|\n|Minecraft Dungeons II Deluxe|Uncracked|||'
  expect(parseCrackWatchIndex(post(markdown), 'Minecraft Dungeons 2')).toEqual([
    expect.objectContaining({
      name: 'CrackWatchIndex',
      url: CRACKWATCH_INDEX,
      status: 'cracked',
      group: 'RUNE'
    })
  ])
  expect(
    parseCrackWatchIndex(
      post('Minecraft Dungeons II might be cracked'),
      'Minecraft Dungeons 2'
    )
  ).toEqual([])
  expect(
    parseCrackWatchIndex(post(markdown, 'other'), 'Minecraft Dungeons 2')
  ).toEqual([])
})
it('allows the exact shared sheet and post but rejects unrelated files and destinations', () => {
  expect(safeDrmSourceUrl(drmSheetUrl('0'))).toBeDefined()
  expect(safeDrmSourceUrl(CRACKWATCH_INDEX)).toBeDefined()
  expect(
    safeDrmSourceUrl(
      drmSheetUrl('0').replace(
        '1f8wm0424N4QsZUYwY41kalaax0K2Lb_GZgfjxY07jkg',
        'other'
      )
    )
  ).toBeUndefined()
  expect(
    safeDrmSourceUrl(drmSheetUrl('0').replace('gid=0', 'gid=hello'))
  ).toBeUndefined()
  expect(
    safeDrmSourceUrl(
      'https://old.reddit.com/r/CrackWatch/comments/other/download/'
    )
  ).toBeUndefined()
})
