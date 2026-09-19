import {
  PIRATAS_48_KNOWLEDGE_BASE,
  EXCLUDED_PIRATAS_APP_NAMES,
  discoverSavePathForGame
} from '../piratasSaveKnowledge'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Validação da Base de Conhecimento e IA de Saves da Loja Piratas (48 Jogos)', () => {
  let testHome: string
  let testGameDir: string

  beforeEach(async () => {
    testHome = await mkdtemp(join(tmpdir(), 'ghost-piratas-home-'))
    testGameDir = await mkdtemp(join(tmpdir(), 'ghost-piratas-game-'))
  })

  afterEach(async () => {
    await rm(testHome, { recursive: true, force: true })
    await rm(testGameDir, { recursive: true, force: true })
  })

  test('deve conter regras válidas no Knowledge Base para jogos da loja Piratas', () => {
    const entries = Object.values(PIRATAS_48_KNOWLEDGE_BASE)
    expect(entries.length).toBeGreaterThanOrEqual(40)
    for (const entry of entries) {
      expect(entry.title).toBeTruthy()
      expect(typeof entry.paths).toBe('function')
      expect(entry.details).toBeTruthy()
    }
  })

  test('deve conter os 10 itens na lista de exclusão para não poluir a loja Piratas', () => {
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('jPNyjhQ7EuR46Wk5XkCyfx')).toBe(true) // Clone Hero
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('ehgNiPV1m9TjUuwwtXqixF')).toBe(true) // LoL
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('5irNctQKdV3KSq4iESkJi3')).toBe(true) // The Settlers 4 Gold
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('shKB2qLNLtBLAAYYtp3QWX')).toBe(true) // DLSS 5 OneClick
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('2vTwTDPPBSCD5bVmsvw7az')).toBe(true) // Escape From Tarkov
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('p9e3LJEUcYd3qaMScYPFyC')).toBe(true) // Marvel Tokon
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('3gi84Lijrij2enLbTEbdyD')).toBe(true) // Soulframe
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('pqXZqBsJB9MCjETDoHXzh8')).toBe(true) // OpenRCT2
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('iVaZywHpCnWmHaKZjWGcox')).toBe(true) // openttd-jgrpp-
    expect(EXCLUDED_PIRATAS_APP_NAMES.has('8eGbpKBrL7uC7fvnn7hCYn')).toBe(true) // Transport Tycoon
  })

  test('deve detectar com precisão jogo da Knowledge Base (ex: Phasmophobia em LocalLow)', async () => {
    const phasmoSaveDir = join(testHome, 'AppData', 'LocalLow', 'Kinetic Games', 'Phasmophobia')
    await mkdir(phasmoSaveDir, { recursive: true })
    await writeFile(join(phasmoSaveDir, 'saveData.txt'), 'test phasmo save content')

    const result = await discoverSavePathForGame({
      appName: '1m9JPXKsEZqutEwm8XLcUR',
      title: 'Phasmophobia',
      directory: testGameDir,
      executable: join(testGameDir, 'Phasmophobia.exe'),
      homeDir: testHome
    })

    expect(result.path).toBe(phasmoSaveDir)
    expect(result.hasFiles).toBe(true)
    expect(result.fileCount).toBe(1)
    expect(result.existsOnDisk).toBe(true)
    expect(result.detectionType).toBe('unity')
  })

  test('deve detectar via heurística Unity app.info caso não esteja no Knowledge Base', async () => {
    // Cria estrutura Unity: Game_Data/app.info
    const dataDir = join(testGameDir, 'MyIndie_Data')
    await mkdir(dataDir, { recursive: true })
    await writeFile(join(dataDir, 'app.info'), 'IndieStudio\nCoolGame')

    const localLowDir = join(testHome, 'AppData', 'LocalLow', 'IndieStudio', 'CoolGame')
    await mkdir(localLowDir, { recursive: true })
    await writeFile(join(localLowDir, 'save.json'), '{"level": 5}')

    const result = await discoverSavePathForGame({
      appName: 'CustomIndieApp',
      title: 'Custom Indie Game',
      directory: testGameDir,
      executable: join(testGameDir, 'MyIndie.exe'),
      homeDir: testHome
    })

    expect(result.path).toBe(localLowDir)
    expect(result.hasFiles).toBe(true)
    expect(result.fileCount).toBe(1)
    expect(result.detectionType).toBe('unity')
  })

  test('deve inspecionar Deep AppID e encontrar save em Goldberg/AppData', async () => {
    // Cria steam_appid.txt
    await writeFile(join(testGameDir, 'steam_appid.txt'), '1245620') // Elden Ring AppID

    const goldbergDir = join(testHome, 'AppData', 'Roaming', 'Goldberg SteamEmu Saves', '1245620')
    await mkdir(goldbergDir, { recursive: true })
    await writeFile(join(goldbergDir, 'ER0000.sl2'), 'elden ring save binary')

    const result = await discoverSavePathForGame({
      appName: 'RandomEldenRelease',
      title: 'Desconhecido Elden Ring Special Edition',
      directory: testGameDir,
      executable: join(testGameDir, 'game.exe'),
      homeDir: testHome
    })

    expect(result.path).toBe(goldbergDir)
    expect(result.hasFiles).toBe(true)
    expect(result.fileCount).toBe(1)
  })

  test('deve detectar saves de Unreal Engine em Saved/SaveGames na pasta do jogo', async () => {
    const unrealSaveDir = join(testGameDir, 'GameName', 'Saved', 'SaveGames')
    await mkdir(unrealSaveDir, { recursive: true })
    await writeFile(join(unrealSaveDir, 'SaveSlot0.sav'), 'UE4 save data')

    const result = await discoverSavePathForGame({
      appName: 'CustomUnrealGame',
      title: 'Unreal Engine 5 Action Game',
      directory: testGameDir,
      executable: join(testGameDir, 'GameName', 'Binaries', 'Win64', 'GameName-Win64-Shipping.exe'),
      homeDir: testHome
    })

    expect(result.path).toBe(unrealSaveDir)
    expect(result.hasFiles).toBe(true)
    expect(result.detectionType).toBe('unreal')
  })

  test('deve retornar pre-mapped com hasFiles=false se o jogo for novo e ainda não tiver saves gerados', async () => {
    const result = await discoverSavePathForGame({
      appName: '5Ez7e8XFujeBZujTGpnYCE',
      title: 'Outbound',
      directory: testGameDir,
      executable: join(testGameDir, 'Outbound.exe'),
      homeDir: testHome
    })

    expect(result.path).toBeTruthy()
    expect(result.hasFiles).toBe(false)
    expect(result.existsOnDisk).toBe(false)
    expect(result.detectionType).toBe('unity')
  })
})
