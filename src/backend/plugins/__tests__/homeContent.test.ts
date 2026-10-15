import fs from 'graceful-fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  DEFAULT_HOME_SPOTLIGHT_GAMES,
  DEFAULT_STORE_HIGHLIGHT_SHELVES
} from 'common/defaultHomeContent'
import type { GhostSearchResult } from 'common/types/plugins'

let mockUserDataPath = ''

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: jest.fn(),
    getVersion: () => '0.3.2-beta'
  },
  dialog: {},
  shell: {}
}))
jest.mock('backend/constants/paths', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs')
  const path = jest.requireActual<typeof import('path')>('path')
  const os = jest.requireActual<typeof import('os')>('os')
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-home-test-paths-'))
  return {
    userDataPath: tempDir,
    appFolder: tempDir,
    iconsFolder: tempDir
  }
})
jest.mock('backend/images_cache', () => ({
  ensureCachedImage: jest.fn(),
  getImageCachePath: jest.fn()
}))
jest.mock('backend/logger', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
  logInfo: jest.fn(),
  LogPrefix: { Backend: 'backend' }
}))
jest.mock('backend/ipc', () => ({ sendFrontendMessage: jest.fn() }))
jest.mock('backend/main_window', () => ({ getMainWindow: jest.fn() }))
jest.mock('backend/config', () => ({ GlobalConfig: {} }))
jest.mock('../sourceSettings', () => ({
  initializeSourceSettings: jest.fn(),
  sourceDomains: () => []
}))
jest.mock('../sourceEngines', () => ({ initializeSourceEngines: jest.fn() }))
jest.mock('../externalGames', () => ({
  ExternalGames: { getInstance: jest.fn() }
}))
jest.mock('../externalVersion', () => ({ refreshExternalRelease: jest.fn() }))
jest.mock('../ankerAccount', () => ({}))
jest.mock('../onlineFixAccount', () => ({}))
jest.mock('../networkGuard', () => ({}))
jest.mock('../piratasSaveKnowledge', () => ({}))
jest.mock('../torboxClient', () => ({}))

import { PluginManager } from '../pluginManager'

describe('Dynamic Home Content via Scrapling and Obscura', () => {
  let rootDir: string

  beforeEach(() => {
    rootDir = fs.mkdtempSync(join(tmpdir(), 'ghost-home-test-'))
    mockUserDataPath = rootDir
  })

  afterEach(() => {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('default home content structures are non-empty and well-formed', () => {
    expect(DEFAULT_HOME_SPOTLIGHT_GAMES.length).toBeGreaterThanOrEqual(4)
    expect(DEFAULT_STORE_HIGHLIGHT_SHELVES.length).toBe(4)

    const shelfIds = DEFAULT_STORE_HIGHLIGHT_SHELVES.map((s) => s.id)
    expect(shelfIds).toEqual(['ankergames', 'steamrip', 'onlinefix', 'switch'])

    DEFAULT_STORE_HIGHLIGHT_SHELVES.forEach((shelf) => {
      expect(shelf.games.length).toBeGreaterThan(0)
      shelf.games.forEach((game) => {
        expect(game.id).toBeTruthy()
        expect(game.title).toBeTruthy()
        expect(game.providerId).toBeTruthy()
      })
    })

    DEFAULT_HOME_SPOTLIGHT_GAMES.forEach((spotlight) => {
      expect(spotlight.id).toBeTruthy()
      expect(spotlight.title).toBeTruthy()
      expect(spotlight.tags.length).toBeGreaterThan(0)
      expect(spotlight.backdropUrl).toBeTruthy()
      expect(spotlight.game).toBeDefined()
    })
  })

  test('getHomeContent returns default content on initial launch and creates disk cache', async () => {
    const manager = PluginManager.getInstance()
    // Força limpeza do cache interno para o teste
    ;(manager as any).homeContentCache = null
    ;(manager as any).homeCacheFile = join(rootDir, 'ghost_home_content_cache.json')

    const homeContent = await manager.getHomeContent()
    expect(homeContent).toBeDefined()
    expect(homeContent.shelves.length).toBe(4)
    expect(homeContent.spotlightGames.length).toBe(4)
    expect(homeContent.updatedAt).toBeGreaterThan(0)

    // O cache persistente deve ter sido gravado em disco
    const cacheFile = (manager as any).homeCacheFile
    expect(fs.existsSync(cacheFile)).toBe(true)
    const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    expect(saved.shelves.length).toBe(4)
    expect(saved.updatedAt).toBe(homeContent.updatedAt)
  })

  test('getHomeContent reuses valid in-memory cache and disk cache within TTL', async () => {
    const manager = PluginManager.getInstance()
    const cacheFile = join(rootDir, 'ghost_home_content_cache.json')
    ;(manager as any).homeCacheFile = cacheFile

    const initialTimestamp = Date.now() - 5 * 60 * 1000 // 5 minutos atrás (dentro dos 30min)
    const cachedData = {
      spotlightGames: DEFAULT_HOME_SPOTLIGHT_GAMES,
      shelves: DEFAULT_STORE_HIGHLIGHT_SHELVES,
      updatedAt: initialTimestamp
    }
    fs.writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2), 'utf-8')
    ;(manager as any).homeContentCache = null

    // Deve carregar direto do disco sem disparar scraper novo
    const result = await manager.getHomeContent({ forceRefresh: false })
    expect(result.updatedAt).toBe(initialTimestamp)
  })

  test('getHomeContent dynamically updates shelves and hero banner when catalogs return new scraped games', async () => {
    const manager = PluginManager.getInstance()
    ;(manager as any).homeContentCache = null
    ;(manager as any).homeCacheFile = join(rootDir, 'ghost_home_content_cache.json')

    const mockAnkerGame: GhostSearchResult = {
      id: 'scraped-gta6',
      title: 'Grand Theft Auto VI',
      providerId: 'com.ghost.ankergames-source',
      providerName: 'AnkerGames',
      size: '120 GB',
      genre: 'Ação, Mundo Aberto',
      coverUrl: 'https://ankergames.net/uploads/poster/gta6.jpg',
      description: 'Lançamento épico em Vice City.'
    }

    const mockSteamRipGame: GhostSearchResult = {
      id: 'scraped-half-life-3',
      title: 'Half-Life 3',
      providerId: 'com.ghost.steamrip-source',
      providerName: 'SteamRIP',
      size: '45 GB',
      genre: 'FPS, Ficção Científica',
      coverUrl: 'https://steamrip.com/wp-content/uploads/hl3.jpg',
      description: 'Gordon Freeman retorna na aventura definitiva.'
    }

    // Mock getPlugins para simular plugins ativos
    jest.spyOn(manager, 'getPlugins').mockReturnValue([
      {
        id: 'com.ghost.ankergames-source',
        name: 'AnkerGames',
        description: 'Fonte AnkerGames',
        isEnabled: true,
        version: '1.0.0',
        author: 'Ghost',
        type: 'game-source',
        permissions: [],
        installedPath: ''
      },
      {
        id: 'com.ghost.steamrip-source',
        name: 'SteamRIP',
        description: 'Fonte SteamRIP',
        isEnabled: true,
        version: '1.0.0',
        author: 'Ghost',
        type: 'game-source',
        permissions: [],
        installedPath: ''
      }
    ])

    // Mock getCatalog retornando os jogos raspados
    jest.spyOn(manager, 'getCatalog').mockImplementation(async (providerId) => {
      if (providerId.includes('anker')) {
        return { games: [mockAnkerGame], hasMore: true }
      }
      if (providerId.includes('steamrip')) {
        return { games: [mockSteamRipGame], hasMore: true }
      }
      return { games: [], hasMore: false }
    })

    const refreshed = await manager.getHomeContent({ forceRefresh: true })

    // A prateleira de AnkerGames agora contém o jogo raspado
    const ankerShelf = refreshed.shelves.find((s) => s.id === 'ankergames')
    expect(ankerShelf?.games[0].title).toBe('Grand Theft Auto VI')

    // A prateleira de SteamRIP agora contém o jogo raspado
    const steamripShelf = refreshed.shelves.find((s) => s.id === 'steamrip')
    expect(steamripShelf?.games[0].title).toBe('Half-Life 3')

    // O Hero Spotlight 0 foi atualizado dinamicamente com o novo destaque da AnkerGames
    expect(refreshed.spotlightGames[0].title).toBe('Grand Theft Auto VI')
    expect(refreshed.spotlightGames[0].backdropUrl).toBe('https://ankergames.net/uploads/poster/gta6.jpg')

    // O Hero Spotlight 1 foi atualizado dinamicamente com o novo destaque do SteamRIP
    expect(refreshed.spotlightGames[1].title).toBe('Half-Life 3')

    // As lojas que falharam (Online-Fix e Switch) mantiveram seus fallbacks seguros
    expect(refreshed.shelves.find((s) => s.id === 'onlinefix')?.games.length).toBeGreaterThan(0)
    expect(refreshed.shelves.find((s) => s.id === 'switch')?.games.length).toBeGreaterThan(0)
  })

  test('getHomeContent filters out bogus navigation cards from SteamRIP and takes 20 games from Recently Added', async () => {
    const manager = PluginManager.getInstance()
    ;(manager as any).homeContentCache = null
    ;(manager as any).homeCacheFile = join(rootDir, 'ghost_home_content_cache.json')

    // Simula resposta do SteamRIP contendo os 4 cards não-jogos seguidos de 25 jogos reais da seção Recently Added
    const bogusCards: GhostSearchResult[] = [
      { id: 'sr-top-games', title: 'Top Games', pageUrl: 'https://steamrip.com/category/top-games/', providerId: 'com.ghost.steamrip-source', providerName: 'SteamRIP' },
      { id: 'sr-recent-updates', title: 'Recent Updates', pageUrl: 'https://steamrip.com/recent-updates/', providerId: 'com.ghost.steamrip-source', providerName: 'SteamRIP' },
      { id: 'sr-all-games', title: 'All Games Games Collection', pageUrl: 'https://steamrip.com/all-games-collection/', providerId: 'com.ghost.steamrip-source', providerName: 'SteamRIP' },
      { id: 'sr-how-to-run', title: 'How to Run Games', pageUrl: 'https://steamrip.com/how-to-run-games/', providerId: 'com.ghost.steamrip-source', providerName: 'SteamRIP' }
    ]

    const realGames: GhostSearchResult[] = Array.from({ length: 25 }, (_, i) => ({
      id: `sr-recent-game-${i + 1}`,
      title: `Recently Added Game ${i + 1}`,
      pageUrl: `https://steamrip.com/game-${i + 1}-free-download/`,
      providerId: 'com.ghost.steamrip-source',
      providerName: 'SteamRIP',
      size: `${i + 5} GB`,
      genre: 'Ação',
      coverUrl: `https://steamrip.com/covers/game-${i + 1}.jpg`,
      description: `Descrição do jogo ${i + 1}`
    }))

    jest.spyOn(manager, 'getPlugins').mockReturnValue([
      {
        id: 'com.ghost.steamrip-source',
        name: 'SteamRIP',
        description: 'Fonte SteamRIP',
        isEnabled: true,
        version: '1.0.0',
        author: 'Ghost',
        type: 'game-source',
        permissions: [],
        installedPath: ''
      }
    ])

    jest.spyOn(manager, 'getCatalog').mockImplementation(async (providerId) => {
      if (providerId.includes('steamrip')) {
        return { games: [...bogusCards, ...realGames], hasMore: true }
      }
      return { games: [], hasMore: false }
    })

    const refreshed = await manager.getHomeContent({ forceRefresh: true })
    const steamripShelf = refreshed.shelves.find((s) => s.id === 'steamrip')

    expect(steamripShelf).toBeDefined()
    // Deve conter exatamente os 20 primeiros jogos da seção Recently Added
    expect(steamripShelf?.games.length).toBe(20)

    // Nenhum dos 4 cards de navegação/artigos deve estar presente na prateleira
    expect(steamripShelf?.games.some((g) => g.title === 'Top Games')).toBe(false)
    expect(steamripShelf?.games.some((g) => g.title === 'Recent Updates')).toBe(false)
    expect(steamripShelf?.games.some((g) => g.title === 'All Games Games Collection')).toBe(false)
    expect(steamripShelf?.games.some((g) => g.title === 'How to Run Games')).toBe(false)

    // Os jogos da prateleira devem começar exatamente pelo primeiro jogo real
    expect(steamripShelf?.games[0].title).toBe('Recently Added Game 1')
    expect(steamripShelf?.games[19].title).toBe('Recently Added Game 20')

    // O Spotlight do SteamRIP deve ser o jogo 1 real, nunca o "Top Games"
    expect(refreshed.spotlightGames[1].title).toBe('Recently Added Game 1')
  })
})
