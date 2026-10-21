jest.mock('frontend/assets/heroic_card.jpg', () => 'heroic_card.jpg')
jest.mock('frontend/components/UI/CachedImage', () => () => null)

import {
  buildDestinationPreview,
  filterConfiguredDrives,
  formatBytesCompact,
  formatFreeSpaceSteam,
  getBaseNameFromPath,
  getDirectoryFromPath,
  getDriveLetter,
  normalizeDrivePathsMap
} from '../../frontend/screens/Library/components/InlineGameSettings/MoveGameModal'

describe('MoveGameModal helpers (Steam-inspired Move Game to HD)', () => {
  it('extracts drive letters accurately on Windows paths', () => {
    expect(getDriveLetter('C:\\Games\\Ghost\\Cyberpunk 2077')).toBe('C:')
    expect(getDriveLetter('d:\\SteamLibrary\\steamapps\\common')).toBe('D:')
    expect(getDriveLetter('/home/user/Games')).toBe('')
  })

  it('extracts directory and basename from game paths', () => {
    expect(getDirectoryFromPath('C:\\Games\\Ghost\\Hades\\Hades.exe')).toBe(
      'C:\\Games\\Ghost\\Hades'
    )
    expect(getBaseNameFromPath('C:\\Games\\Ghost\\Hades\\')).toBe('Hades')
    expect(getBaseNameFromPath('D:/Games/Ghost/Hollow Knight')).toBe('Hollow Knight')
  })

  it('builds destination preview without duplicating folder name', () => {
    expect(
      buildDestinationPreview('D:\\Meus Jogos', 'C:\\Games\\Ghost\\Cyberpunk 2077')
    ).toBe('D:\\Meus Jogos\\Cyberpunk 2077')

    expect(
      buildDestinationPreview(
        'D:\\Meus Jogos\\Cyberpunk 2077',
        'C:\\Games\\Ghost\\Cyberpunk 2077'
      )
    ).toBe('D:\\Meus Jogos\\Cyberpunk 2077')
  })

  it('formats disk space and game size in Steam style', () => {
    expect(formatBytesCompact(1024 * 1024 * 500)).toBe('500,0 MB')
    expect(formatBytesCompact(1024 * 1024 * 1024 * 42.5)).toBe('42,50 GB')
    expect(formatFreeSpaceSteam(1024 * 1024 * 1024 * 250)).toBe('250,00 GB LIVRE(S)')
  })

  it('shows only HDs/NVMes pre-configured by the user via gear settings', () => {
    const detectedDrives = [
      {
        letter: 'C:',
        label: 'Sistema',
        name: 'Sistema (C:)',
        freeSpace: 100 * 1024 * 1024 * 1024,
        totalSpace: 500 * 1024 * 1024 * 1024,
        path: 'C:\\Games\\Ghost'
      },
      {
        letter: 'D:',
        label: 'NVMe Games',
        name: 'NVMe Games (D:)',
        freeSpace: 800 * 1024 * 1024 * 1024,
        totalSpace: 1000 * 1024 * 1024 * 1024,
        path: 'D:\\Games\\Ghost'
      },
      {
        letter: 'E:',
        label: 'Backup HD',
        name: 'Backup HD (E:)',
        freeSpace: 1500 * 1024 * 1024 * 1024,
        totalSpace: 2000 * 1024 * 1024 * 1024,
        path: 'E:\\Games\\Ghost'
      }
    ]

    // 1. Quando o usuário ainda não configurou nenhum HD/NVMe, não exibe nenhum caminho inventado pelo sistema
    expect(filterConfiguredDrives(detectedDrives, {})).toEqual([])

    // 2. Quando o usuário pré-define os caminhos de D: e E: na engrenagem, exibe apenas D: e E: com os caminhos do usuário
    const userConfigured = normalizeDrivePathsMap({
      'd:': 'D:\\Jogos NVMe',
      'E:': 'E:\\Biblioteca HD',
      'C:': '   '
    })
    const visibleDrives = filterConfiguredDrives(detectedDrives, userConfigured)
    expect(visibleDrives).toHaveLength(2)
    expect(visibleDrives[0].letter).toBe('D:')
    expect(visibleDrives[0].path).toBe('D:\\Jogos NVMe')
    expect(visibleDrives[1].letter).toBe('E:')
    expect(visibleDrives[1].path).toBe('E:\\Biblioteca HD')
  })
})
