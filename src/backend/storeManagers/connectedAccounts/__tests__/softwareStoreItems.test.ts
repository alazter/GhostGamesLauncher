import {
  findMatchingSoftwareByPath,
  findPrimarySoftwareStore,
  formatSoftwareIconUrl,
  getSoftwareStoreItems,
  resolveGameExecutablePath,
  resolveGameIconUrls
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

  it('resolves executable path using folder_name when install.install_path is absent', () => {
    const game = {
      app_name: 'dlss-app',
      title: 'DLSS 5 OneClick',
      runner: 'sideload',
      folder_name: 'T:\\Downloads\\Programs',
      install: {
        executable: 'DLSS5-Swapper-2.2.5-portable.exe',
        platform: 'Windows'
      }
    } as unknown as GameInfo

    expect(resolveGameExecutablePath(game)).toBe(
      'T:\\Downloads\\Programs\\DLSS5-Swapper-2.2.5-portable.exe'
    )
  })

  it('formats image URLs safely for local filesystem, file:// and web URLs', () => {
    expect(formatSoftwareIconUrl('')).toBe('')
    expect(formatSoftwareIconUrl('https://example.com/cover.png')).toBe(
      'https://example.com/cover.png'
    )
    expect(formatSoftwareIconUrl('imagecache://localhost/foo.png')).toBe(
      'imagecache://localhost/foo.png'
    )

    const winPath = 'C:\\Users\\alazt\\Downloads\\DLSS 5 Swapper_ Evolução Neon.png'
    expect(formatSoftwareIconUrl(winPath)).toBe(
      `imagecache://localhost/${encodeURIComponent(winPath)}`
    )

    const fileUrl = 'file:///C:/Users/alazt/Downloads/DLSS 5 Swapper_ Evolução Neon.png'
    expect(formatSoftwareIconUrl(fileUrl)).toBe(
      `imagecache://localhost/${encodeURIComponent('C:/Users/alazt/Downloads/DLSS 5 Swapper_ Evolução Neon.png')}`
    )
  })

  it('resolves game icon URLs with priority for square art and overrides, ignoring placeholder defaults', () => {
    const gameWithOverrides: GameInfo = {
      app_name: 'dlss-swapper',
      title: 'DLSS 5 Swapper',
      runner: 'sideload',
      art_cover: 'file:///C:/Temp/resources/app.asar/build/assets/heroic_card-bbsQ4lqh.jpg',
      art_square: 'C:\\Users\\alazt\\Downloads\\DLSS 5 Swapper_ Evolução Neon.png',
      overrides: {
        title: 'DLSS 5 Swapper',
        art_square: 'C:\\Users\\alazt\\Downloads\\DLSS 5 Swapper_ Evolução Neon.png'
      }
    } as unknown as GameInfo

    const resolved = resolveGameIconUrls(gameWithOverrides)
    expect(resolved.iconUrl).toBe(
      `imagecache://localhost/${encodeURIComponent('C:\\Users\\alazt\\Downloads\\DLSS 5 Swapper_ Evolução Neon.png')}`
    )

    // Check that secondary fallback is available if two valid images exist
    const gameMultiArt: GameInfo = {
      app_name: 'borderless',
      title: 'Borderless Gaming',
      runner: 'sideload',
      art_square: 'C:\\Users\\alazt\\Downloads\\Gaming sem Fronteiras.png',
      art_cover: 'C:\\Users\\alazt\\AppData\\Roaming\\ghost\\custom-covers\\cover.jpg'
    } as unknown as GameInfo

    const multi = resolveGameIconUrls(gameMultiArt)
    expect(multi.iconUrl).toBe(
      `imagecache://localhost/${encodeURIComponent('C:\\Users\\alazt\\Downloads\\Gaming sem Fronteiras.png')}`
    )
    expect(multi.fallbackIconUrl).toBe(
      `imagecache://localhost/${encodeURIComponent('C:\\Users\\alazt\\AppData\\Roaming\\ghost\\custom-covers\\cover.jpg')}`
    )
  })

  it('populates iconUrl and fallbackIconUrl in getSoftwareStoreItems entries', () => {
    const items = getSoftwareStoreItems({
      allGames: sampleLibrary,
      customStores,
      assignments,
      storeFilter: 'softwares'
    })

    const ls = items.find((i) => i.appName === 'lossless-scaling')
    expect(ls).toBeDefined()
    expect(ls?.iconUrl).toBe('https://example.com/ls.png')

    const ds4 = items.find((i) => i.appName === 'ds4-windows')
    expect(ds4).toBeDefined()
    expect(ds4?.iconUrl).toBe('https://example.com/ds4.png')
  })
})
