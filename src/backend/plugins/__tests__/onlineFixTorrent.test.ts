import { onlineFixDownloadUrl } from '../onlineFixUrls'
import { resolveOnlineFixTorrentLink } from '../onlineFixTorrent'
import { withSourceEngine } from '../sourceEngines'
import { engineProcess } from '../engineProcess'
import { experimentalPage } from '../adaptiveSource'

jest.mock('../sourceEngines', () => ({ withSourceEngine: jest.fn() }))
jest.mock('../engineProcess', () => ({ engineProcess: jest.fn() }))
jest.mock('../adaptiveSource', () => ({ experimentalPage: jest.fn() }))

const game = 'https://online-fix.me/games/strategy/18267-uno-online.html'
const directory = 'https://uploads.online-fix.me:2053/torrents/UNO/'
const file = `${directory}UNO.Build.12012023-OFME.torrent`
beforeEach(() => {
  jest.mocked(withSourceEngine).mockResolvedValue(undefined)
  jest.mocked(experimentalPage).mockResolvedValue(undefined)
})

it('accepts the official HTTPS upload port without allowing arbitrary ports or hosts', () => {
  expect(onlineFixDownloadUrl(file)).toBe(true)
  for (const invalid of [
    'https://loot-reward.com/t?cc=fixture',
    file.replace(':2053', ':8080'),
    file.replace('https:', 'http:'),
    file.replace('uploads.', 'evil.'),
    file.replace('online-fix.me:', 'online-fix.me.evil.test:'),
    file.replace('https://', 'https://user:password@')
  ]) {
    expect(onlineFixDownloadUrl(invalid)).toBe(false)
  }
})

it('resolves the game page and directory links regardless of button language or CSS classes', async () => {
  expect(
    await resolveOnlineFixTorrentLink(
      `<a class="changed" href="${directory}">Скачать Торрент</a>`,
      game
    )
  ).toBe(directory)
  expect(
    await resolveOnlineFixTorrentLink(
      '<a href="../">Up</a><a href="UNO.Build.12012023-OFME.torrent">UNO torrent</a>',
      directory
    )
  ).toBe(file)
})

it('handles other Online-Fix games without a title-specific rule', async () => {
  const other = 'https://uploads.online-fix.me:2053/torrents/AnotherGame/'
  expect(
    await resolveOnlineFixTorrentLink(
      `<a href="${other}">Torrent</a>`,
      game.replace('18267-uno', '123-another')
    )
  ).toBe(other)
  expect(
    await resolveOnlineFixTorrentLink(
      '<a href="Game.torrent">Game.torrent</a>',
      other
    )
  ).toBe(`${other}Game.torrent`)
})

it('does not select multiple editions or a torrent outside the selected game folder', async () => {
  expect(
    await resolveOnlineFixTorrentLink(
      '<a href="first.torrent">A</a><a href="second.torrent">B</a>',
      directory
    )
  ).toBeUndefined()
  expect(
    await resolveOnlineFixTorrentLink(
      '<a href="../Other/Game.torrent">Other</a>',
      directory
    )
  ).toBeUndefined()
  expect(
    await resolveOnlineFixTorrentLink(
      '<a href="https://evil.test/Game.torrent">Game</a>',
      directory
    )
  ).toBeUndefined()
})

it('uses the Scrapling operation and revalidates its output', async () => {
  jest
    .mocked(withSourceEngine)
    .mockImplementation(async (_id, run) => run('worker', 'storage'))
  jest
    .mocked(engineProcess)
    .mockResolvedValue(JSON.stringify([{ url: directory, title: 'Torrent' }]))
  expect(
    await resolveOnlineFixTorrentLink('<div>Changed page</div>', game)
  ).toBe(directory)
  expect(engineProcess).toHaveBeenCalledWith(
    'worker',
    [],
    expect.stringContaining('online-fix-torrent-links-v1')
  )
  jest
    .mocked(engineProcess)
    .mockResolvedValue(
      JSON.stringify([
        { url: 'https://evil.test/game.torrent', title: 'Torrent' }
      ])
    )
  expect(
    await resolveOnlineFixTorrentLink('<div>Changed page</div>', game)
  ).toBeUndefined()
})

it('preserves native resolution if Scrapling is older or unavailable', async () => {
  jest.mocked(withSourceEngine).mockRejectedValue(new Error('Old worker'))
  expect(
    await resolveOnlineFixTorrentLink(
      `<a href="${directory}">Torrent</a>`,
      game
    )
  ).toBe(directory)
})

it('uses Obscura only for the public game page, without sending session credentials', async () => {
  jest
    .mocked(experimentalPage)
    .mockResolvedValue(`<a href="${directory}">Torrent</a>`)
  expect(
    await resolveOnlineFixTorrentLink('<div>Waiting for content</div>', game)
  ).toBe(directory)
  expect(experimentalPage).toHaveBeenCalledWith(
    game,
    expect.objectContaining({ id: 'com.ghost.online-fix-source' })
  )
  jest.mocked(experimentalPage).mockClear()
  await resolveOnlineFixTorrentLink('<div>Login required</div>', directory)
  expect(experimentalPage).not.toHaveBeenCalled()
})
