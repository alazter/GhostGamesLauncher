import { readFileSync } from 'fs'
import { join } from 'path'
import { runInNewContext } from 'vm'
import {
  findOnlineFixHostersPage, onlineFixDirectUrl, onlineFixHoster,
  onlineFixHosterDownloadUrl, onlineFixHosterScript, parseOnlineFixPackages
} from '../onlineFixHosters'

const page = 'https://hosters.online-fix.me:2053/Example'
const catalog = (entries: Array<{ file_name: string; direct_link: string }>) =>
  `<div data-links='${JSON.stringify(entries)}'></div>`
const entry = (name: string, host = 'fileditchfiles.st') => ({ file_name: name, direct_link: `https://${host}/files/${name}` })

it('collects the game and fix once across all five observed hosters', () => {
  const fixture = readFileSync(join(__dirname, 'fixtures/online-fix-hosters.html'), 'utf8')
  const packages = parseOnlineFixPackages(fixture, page)
  expect(packages.map(file => [file.name, file.role])).toEqual([
    ['UNO.Build.12012023-OFME.rar', 'game'], ['UNO_Fix_Repair_Steam.rar', 'fix']
  ])
  for (const file of packages)
    expect(file.mirrors.map(mirror => mirror.hoster)).toEqual(['FileDitch', 'FileKeeper', 'Pixeldrain', 'Gofile', 'VikingFile'])
})

it('follows only a unique official Hosters link, without the site click handler', () => {
  expect(findOnlineFixHostersPage(`<a href="${page}" onclick="advert()">Hosters</a>`, 'https://online-fix.me/games/test.html')).toBe(page)
  expect(findOnlineFixHostersPage(`<a href="${page}">A</a><a href="${page}2">B</a>`, page)).toBeUndefined()
  expect(findOnlineFixHostersPage('<a href="https://loot-reward.com/t">Download</a>', page)).toBeUndefined()
})

it.each(['http://filekeeper.net/f', 'https://filekeeper.net:2053/f', 'https://filekeeper.net.evil.test/f',
  'https://user:pass@gofile.io/f', 'https://loot-reward.com/t', 'https://localhost/f'])('rejects untrusted hoster URL %s', url => {
  expect(onlineFixHoster(url)).toBeUndefined()
  expect(onlineFixDirectUrl(url)).toBe(false)
})

it('allows the observed official catalog port and Viking redirect, scoped to direct downloads', () => {
  expect(onlineFixDirectUrl(page)).toBe(true)
  expect(onlineFixHoster('https://vik1ngfile.site/f/test')).toBe('VikingFile')
  expect(onlineFixHoster('https://tunnel1.dlproxy.uk/download/test')).toBe('FileKeeper')
  expect(onlineFixHoster('https://tunnel2.dlproxy.uk/download/test')).toBeUndefined()
  expect(onlineFixDirectUrl('https://hosters.online-fix.me:8080/Example')).toBe(false)
  expect(onlineFixHosterDownloadUrl('https://pixeldrain.com/u/AbCd123')).toBe('https://pixeldrain.com/api/file/AbCd123?download')
})

it('rejects incomplete catalogs and ambiguous editions instead of installing half a game', () => {
  expect(() => parseOnlineFixPackages(catalog([entry('Game.rar')]), page)).toThrow('jogo e do fix')
  expect(() => parseOnlineFixPackages(catalog([entry('Game.rar'), entry('Game2.rar'), entry('Game_Fix.rar')]), page)).toThrow('edições')
})

it('preserves multipart siblings in numeric order and rejects a missing volume', () => {
  const entries = [entry('Game.part2.rar'), entry('Game_Fix.rar'), entry('Game.part1.rar')]
  expect(parseOnlineFixPackages(catalog(entries), page).map(file => file.name)).toEqual(['Game.part1.rar', 'Game.part2.rar', 'Game_Fix.rar'])
  expect(() => parseOnlineFixPackages(catalog([entry('Game.part1.rar'), entry('Game.part3.rar'), entry('Game_Fix.rar')]), page)).toThrow('edições')
})

it('ignores traversal names, installers and advertising URLs', () => {
  const entries = [entry('../Game.rar'), entry('setup.exe'), entry('Game.rar', 'loot-reward.com')]
  expect(parseOnlineFixPackages(catalog(entries), page)).toEqual([])
})

it.each([
  '/report/files/Game.rar', '/report-abuse/files/Game.rar', '/%72eport/files/Game.rar',
  '/files/Game.rar?action=report', '/abuse.php?file=Game.rar', '/delete/files/Game.rar'
])('blocks a management route even when the URL contains the archive filename: %s', path => {
  expect(onlineFixDirectUrl(`https://fileditchfiles.st${path}`)).toBe(false)
})

function anchor(path: string, textContent: string, attributes: Record<string, string> = {}) {
  const attrs = { href: path, ...attributes }
  return { href: new URL(path, 'https://fileditchfiles.st').href, textContent, title: '', id: '',
    getAttribute: (key: string) => attrs[key as keyof typeof attrs] || null,
    hasAttribute: (key: string) => key in attrs, closest: () => null }
}

function runHosterScript(links: ReturnType<typeof anchor>[], name = 'Game.rar') {
  return runInNewContext(onlineFixHosterScript(name), {
    URL, location: { hostname: 'fileditchfiles.st', origin: 'https://fileditchfiles.st' },
    document: { body: { textContent: name }, querySelector: () => null,
      querySelectorAll: (selector: string) => selector === 'a[href]' ? links : [] }
  }) as { url?: string; manual?: boolean }
}

it('chooses the real Download endpoint instead of a Report URL ending in the expected archive name', () => {
  const report = anchor('/report/files/Game.rar', 'Report abuse')
  const download = anchor('/download?id=game', 'Download')
  expect(runHosterScript([report, download])).toEqual({ url: download.href })
})

it('never follows a report-only link, including one disguised with a download attribute', () => {
  const report = anchor('/report/files/Game.rar', 'Download', { download: 'Game.rar' })
  expect(runHosterScript([report])).toEqual({ manual: true })
})

it('rejects an abuse action by its label even when its URL resembles a binary download', () => {
  expect(runHosterScript([anchor('/files/Game.rar', 'Report abuse')])).toEqual({ manual: true })
})

it('retains a legitimate designated download of a game whose filename contains Report', () => {
  const download = anchor('/files/Report.rar', 'Download Report.rar', { download: 'Report.rar' })
  expect(runHosterScript([download], 'Report.rar')).toEqual({ url: download.href })
})

it('ignores download-manager promotions so the actual Download action remains unique', () => {
  const promotion = anchor('https://www.freedownloadmanager.org/', 'Free Download Manager')
  const download = anchor('/download?id=game', 'Download')
  expect(runHosterScript([promotion, download])).toEqual({ url: download.href })
})

it('recognizes the actual Portuguese FileDitch action and opaque signed relay, ignoring Denunciar', () => {
  const report = anchor('https://abuse.fileditch.com/files/Game.rar', '🚨 Denunciar')
  const download = anchor('https://blehpooffileditchstuff.org/opaque-signed-path', '⬇ Baixar', { download: '' })
  expect(onlineFixDirectUrl(download.href)).toBe(true)
  expect(onlineFixDirectUrl(report.href)).toBe(false)
  expect(runHosterScript([report, download])).toEqual({ url: download.href })
  expect(onlineFixDirectUrl('https://blehpooffileditchstuff.org.evil.test/file')).toBe(false)
  expect(onlineFixDirectUrl('https://unobserved-fileditchstuff.org/file')).toBe(false)
  expect(onlineFixDirectUrl('https://alpha.struggleditchfr810.st/files/Game.rar')).toBe(true)
  expect(onlineFixDirectUrl('https://alpha.struggleditchfr810.st.evil.test/files/Game.rar')).toBe(false)
  expect(onlineFixDirectUrl('https://alpha.struggleditchfr811.st/files/Game.rar')).toBe(false)
})

it('waits silently while FileDitch is still completing its browser verification', () => {
  const result: unknown = runInNewContext(onlineFixHosterScript('Game.rar'), {
    URL, location: { hostname: 'fileditchfiles.st' },
    document: { querySelector: (selector: string) => selector === '.verifying-overlay'
      ? { getClientRects: () => [{}] } : null },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
  })
  expect(result).toEqual({ waiting: true })
})
