import {
  findMatchingSoftwareByPath,
  findPrimarySoftwareStore,
  getSoftwareStoreItems,
  resolveGameExecutablePath
} from 'frontend/helpers/softwareStoreItems'
import { GameInfo } from 'common/types'
import { CustomStore } from 'frontend/types'

describe('Software Store Items Helper (Scripts & Softwares Integration)', () => {
  const customStores: CustomStore[] = [
    {
      id: 'store-steam',
      name: 'Steam',
      icon: '',
      isVisible: true
    },
    {
      id: 'store-softwares-1',
      name: 'Softwares',
      icon: '',
      isVisible: true
    },
    {
      id: 'store-indies',
      name: 'Indies',
      icon: '',
      isVisible: true
    }
  ]

  const sampleLibrary: GameInfo[] = [
    {
      app_name: 'lossless-scaling',
      title: 'Lossless Scaling',
      runner: 'sideload',
      art_square: 'https://example.com/ls.png',
      art_cover: '',
      is_installed: true,
      canRunOffline: true,
      install: {
        executable: 'C:\\Softwares\\LosslessScaling\\LosslessScaling.exe',
        install_path: 'C:\\Softwares\\LosslessScaling'
      }
    },
    {
      app_name: 'ds4-windows',
      title: 'DS4Windows',
      runner: 'sideload',
      art_square: '',
      art_cover: 'https://example.com/ds4.png',
      is_installed: true,
      canRunOffline: true,
      install: {
        executable: 'DS4Windows.exe',
        install_path: 'C:\\Softwares\\DS4Windows'
      }
    },
    {
      app_name: 'cyberpunk-2077',
      title: 'Cyberpunk 2077',
      runner: 'gog',
      art_square: '',
      art_cover: '',
      is_installed: true,
      canRunOffline: true,
      install: {
        executable: 'C:\\Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe',
        install_path: 'C:\\Games\\Cyberpunk 2077'
      }
    }
  ]

  const assignments: Record<string, string> = {
    'lossless-scaling': 'store-softwares-1',
    'ds4-windows': 'Softwares',
    'cyberpunk-2077': 'store-steam'
  }

  it('finds the primary Softwares custom store by name or id', () => {
    const store = findPrimarySoftwareStore(customStores)
    expect(store).toBeDefined()
    expect(store?.id).toBe('store-softwares-1')
    expect(store?.name).toBe('Softwares')
  })

  it('resolves absolute and relative executable paths accurately', () => {
    expect(resolveGameExecutablePath(sampleLibrary[0])).toBe(
      'C:\\Softwares\\LosslessScaling\\LosslessScaling.exe'
    )
    expect(resolveGameExecutablePath(sampleLibrary[1])).toBe(
      'C:\\Softwares\\DS4Windows\\DS4Windows.exe'
    )
  })

  it('returns only softwares assigned to the Softwares store when storeFilter is softwares', () => {
    const items = getSoftwareStoreItems({
      allGames: sampleLibrary,
      customStores,
      assignments,
      storeFilter: 'softwares'
    })

    expect(items).toHaveLength(2)
    expect(items.map((i) => i.title)).toEqual(['DS4Windows', 'Lossless Scaling'])
    expect(items[0].storeName).toBe('Softwares')
    expect(items[1].executablePath).toBe(
      'C:\\Softwares\\LosslessScaling\\LosslessScaling.exe'
    )
  })

  it('filters softwares by search query and excludes the currently opened game', () => {
    const filtered = getSoftwareStoreItems({
      allGames: sampleLibrary,
      customStores,
      assignments,
      storeFilter: 'softwares',
      searchQuery: 'lossless'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].appName).toBe('lossless-scaling')

    const withExclusion = getSoftwareStoreItems({
      allGames: sampleLibrary,
      customStores,
      assignments,
      storeFilter: 'all',
      excludeAppName: 'cyberpunk-2077'
    })
    expect(withExclusion.some((i) => i.appName === 'cyberpunk-2077')).toBe(false)
  })

  it('matches selected script path back to the linked software entry case-insensitively', () => {
    const items = getSoftwareStoreItems({
      allGames: sampleLibrary,
      customStores,
      assignments,
      storeFilter: 'softwares'
    })

    const matched = findMatchingSoftwareByPath(
      'c:/softwares/losslessscaling/losslessscaling.exe',
      items
    )
    expect(matched).toBeDefined()
    expect(matched?.title).toBe('Lossless Scaling')
    expect(matched?.storeName).toBe('Softwares')
  })
})
