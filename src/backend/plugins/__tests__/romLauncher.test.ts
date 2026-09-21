import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { prepareRomLaunch, romLaunchArguments } from '../romLauncher'
import { ROM_SOURCES, romPageUrl, romManifest } from '../romSources'
import { NetworkGuard } from '../networkGuard'

it('passes a ROM with spaces as one argument without interpreting its contents', () => {
  const rom = 'C:\\Games\\A game $(test).nsp'
  expect(romLaunchArguments('--fullscreen {rom}', rom)).toEqual([
    '--fullscreen',
    rom
  ])
  expect(romLaunchArguments('--game={rom}', rom)).toEqual([`--game=${rom}`])
  expect(() => romLaunchArguments('--fullscreen', rom)).toThrow('{rom}')
})

it('validates both paths and uses any selected emulator executable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ghost-rom-launch-'))
  try {
    const rom = join(root, 'game.nsp'),
      emulator = join(root, 'custom-emulator.exe')
    await writeFile(rom, 'rom')
    await writeFile(emulator, 'emulator')
    expect(await prepareRomLaunch(rom, emulator)).toEqual({
      executable: emulator,
      args: [rom]
    })
    await expect(prepareRomLaunch(rom, '')).rejects.toThrow('Configurações')
    await expect(
      prepareRomLaunch(join(root, 'missing.nsp'), emulator)
    ).rejects.toThrow('ROM')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(ROM_SOURCES)(
  'scopes $name navigation to its own source and approved hosts',
  (source) => {
    expect(romPageUrl(source.id, `https://${source.domain}/game/`)).toContain(
      source.domain
    )
    expect(() =>
      romPageUrl(source.id, `https://${source.domain}.evil.test/game/`)
    ).toThrow()
    expect(
      NetworkGuard.validateUrl(
        'https://store1.gofile.io/game.zip',
        romManifest(source.id)
      ).allowed
    ).toBe(true)
    expect(
      NetworkGuard.validateUrl(
        'https://unknown.test/game.zip',
        romManifest(source.id)
      ).allowed
    ).toBe(false)
  }
)
