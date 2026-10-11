import { mkdtemp, mkdir, readFile, rm } from 'fs/promises'
import { resolve, join, sep } from 'path'
import { getCrackWatchSheetSources } from '../drmSheets'
import { DRM_SHEETS } from '../drmCommunityParser'
let mockDirectory: string
const mockFetch = jest.fn()
jest.mock('electron', () => ({
  app: { getPath: () => mockDirectory },
  net: { fetch: (...args: unknown[]) => mockFetch(...args) }
}))
it('shares a current index across games and retains each validated tab after schema/network failures', async () => {
  const root = resolve('build/release-drm-tests')
  await mkdir(root, { recursive: true })
  mockDirectory = await mkdtemp(join(root, 'community-'))
  let mode = 'valid'
  mockFetch.mockImplementation(async (url: string) => {
    const gid = new URL(url).searchParams.get('gid')!
    if (mode === 'offline') throw new Error('Offline')
    const sheet = DRM_SHEETS.find((sheet) => sheet.gid === gid)!
    const columns =
      sheet.kind === 'added'
        ? 'Denuvo cracked on,By'
        : sheet.kind === 'bypassed'
          ? 'Bypassed by'
          : 'Cracked,By'
    const csv =
      gid === '0'
        ? mode === 'changed'
          ? 'Unexpected,Columns'
          : 'Name,Released,Cracked,By\nPersona 3 Reload,2024-02-02,2026-09-05,voices38'
        : `Name,Released,${columns}`
    return { ok: true, text: async () => csv }
  })
  try {
    const [first, other] = await Promise.all([
      getCrackWatchSheetSources('Persona III Reload'),
      getCrackWatchSheetSources('Another game')
    ])
    expect(first.sources[0]).toMatchObject({
      status: 'cracked',
      group: 'voices38'
    })
    expect(other.sources).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(12)
    await getCrackWatchSheetSources('Persona 3 Reload')
    expect(mockFetch).toHaveBeenCalledTimes(12)
    mode = 'changed'
    const changed = await getCrackWatchSheetSources('Persona 3 Reload', true)
    expect(changed.sources).toEqual(first.sources)
    expect(changed.warning).toContain('1 aba(s)')
    expect(changed.stale).toBe(true)
    mode = 'offline'
    const offline = await getCrackWatchSheetSources('Persona 3 Reload', true)
    expect(offline.sources).toEqual(first.sources)
    expect(offline.warning).toContain('12 aba(s)')
    expect(offline.stale).toBe(true)
    const persisted = JSON.parse(
      await readFile(
        join(mockDirectory, 'releases', 'drm-community.json'),
        'utf8'
      )
    )
    expect(
      persisted.find((sheet: { gid: string }) => sheet.gid === '0').sources
    ).toEqual(first.sources)
    jest.resetModules()
    const reloaded = await import('../drmSheets')
    expect(
      (await reloaded.getCrackWatchSheetSources('Persona 3 Reload')).sources
    ).toEqual(first.sources)
  } finally {
    if (resolve(mockDirectory).startsWith(root + sep))
      await rm(mockDirectory, { recursive: true, force: true })
  }
})
