import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import type { SaveDiscoveryResult } from 'common/types/plugins'

export interface SaveEnv {
  home: string
  appData: string
  localAppData: string
  localLow: string
  docs: string
  oneDriveDocs: string
  publicDocs: string
  gameDir?: string
}

export interface PiratasKnowledgeEntry {
  title: string
  detectionType: 'knowledge_base' | 'unity' | 'crack' | 'unreal' | 'godot' | 'internal' | 'user_profile'
  details: string
  paths: (env: SaveEnv) => string[]
}

export const EXCLUDED_PIRATAS_APP_NAMES = new Set<string>([
  'jPNyjhQ7EuR46Wk5XkCyfx', // Clone Hero (Indies)
  'ehgNiPV1m9TjUuwwtXqixF', // League of Legends (Indies / Riot)
  '5irNctQKdV3KSq4iESkJi3', // The Settlers 4 Gold (GOG)
  'shKB2qLNLtBLAAYYtp3QWX', // DLSS 5 OneClick (Utility Program)
  '2vTwTDPPBSCD5bVmsvw7az', // Escape From Tarkov (Empty Paths)
  'p9e3LJEUcYd3qaMScYPFyC', // Marvel Tokon (Missing Path)
  '3gi84Lijrij2enLbTEbdyD', // Soulframe (Missing Path)
  'pqXZqBsJB9MCjETDoHXzh8', // OpenRCT2 (Open Source)
  'iVaZywHpCnWmHaKZjWGcox', // openttd-jgrpp- (Open Source)
  '8eGbpKBrL7uC7fvnn7hCYn'  // Transport Tycoon (Open Source)
])

export const PIRATAS_48_KNOWLEDGE_BASE: Record<string, PiratasKnowledgeEntry> = {
  // 1. Super Woden GP 2
  kwbk9DBKvr7MhUSfg45fYS: {
    title: 'Super Woden GP 2',
    detectionType: 'unity',
    details: 'Unity Engine (ViJuDa)',
    paths: (env) => [
      join(env.localLow, 'ViJuDa', 'Super Woden GP 2'),
      join(env.localLow, 'ViJuDa', 'SuperWodenGP2')
    ]
  },
  // 2. Windrose
  jyZkMvUX4pqAhDH3AoGmWw: {
    title: 'Windrose',
    detectionType: 'unreal',
    details: 'Unreal Engine 5',
    paths: (env) => [
      join(env.localAppData, 'Windrose', 'Saved', 'SaveGames'),
      join(env.localAppData, 'Windrose')
    ]
  },
  // 3. Romestead
  jPkqCo1HDPLXj66juwr2Cn: {
    title: 'Romestead',
    detectionType: 'internal',
    details: 'Goldberg / Internal UserData',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'UserData')] : []),
      'S:\\Alazter Games\\Romestead\\UserData'
    ]
  },
  // 4. Enshrouded
  '78YPYrjGmg7GGCvALwNvcV': {
    title: 'Enshrouded',
    detectionType: 'crack',
    details: 'Online-Fix Netplay (AppID 1203620)',
    paths: (env) => [
      join(env.publicDocs, 'OnlineFix', '1203620', 'Saves'),
      join(env.localAppData, 'enshrouded')
    ]
  },
  // 5. Paralives
  x1KFeiwUqrWvvVRZV9YFFf: {
    title: 'Paralives',
    detectionType: 'unity',
    details: 'Unity Engine (Paralives)',
    paths: (env) => [join(env.localLow, 'Paralives', 'Paralives')]
  },
  // 6. BALL x PIT
  seHHoehhHjLiuarDbuTCRB: {
    title: 'BALL x PIT',
    detectionType: 'unity',
    details: 'Unity Engine (Kenny Sun)',
    paths: (env) => [
      join(env.localLow, 'Kenny Sun', 'BALL x PIT'),
      ...(env.gameDir ? [join(env.gameDir, 'SteamData')] : []),
      'S:\\Alazter Games\\BALLxPIT\\SteamData'
    ]
  },
  // 7. Cities.Skylines.II.Ultimate.Edition.
  '4eryZRAoBR2JoYE4dkt6HR': {
    title: 'Cities.Skylines.II.Ultimate.Edition.',
    detectionType: 'unity',
    details: 'Unity Engine (Colossal Order)',
    paths: (env) => [
      join(env.localLow, 'Colossal Order', 'Cities Skylines II')
    ]
  },
  // 8. Luma.Island.
  tHzgeLv1gFypGCj7F1KZtU: {
    title: 'Luma.Island.',
    detectionType: 'unity',
    details: 'Unity Engine (FeelFreeGames)',
    paths: (env) => [
      join(env.localLow, 'FeelFreeGames', 'Luma Island'),
      ...(env.gameDir ? [join(env.gameDir, 'SteamData')] : []),
      'S:\\Alazter Games\\Luma.Island.v1.20139-P2P\\SteamData'
    ]
  },
  // 9. PVZ Replanted
  hJ1EDbSWVyAv2mn8ovtoZL: {
    title: 'PVZ Replanted',
    detectionType: 'unity',
    details: 'Unity Engine (PopCap Games)',
    paths: (env) => [join(env.localLow, 'PopCap Games', 'PvZ Replanted')]
  },
  // 10. ShantyTown
  nciyLGxDmrxDGgdteHUUwy: {
    title: 'ShantyTown',
    detectionType: 'unreal',
    details: 'Unreal Engine 4/5',
    paths: (env) => [
      join(env.localAppData, 'ShantyTown', 'Saved', 'SaveGames'),
      join(env.localAppData, 'ShantyTown')
    ]
  },
  // 11. Stoneshard
  hf8iyumgeibk2zVvJjW5Zm: {
    title: 'Stoneshard',
    detectionType: 'user_profile',
    details: 'GameMaker LocalAppData',
    paths: (env) => [join(env.localAppData, 'StoneShard')]
  },
  // 12. Whisper Mountain Outbreak
  '3ehJCtC9LqA5ZERDNRuetM': {
    title: 'Whisper Mountain Outbreak',
    detectionType: 'unity',
    details: 'Unity Engine (Toge Productions)',
    paths: (env) => [
      join(env.localLow, 'Toge Productions', 'Whisper Mountain Outbreak')
    ]
  },
  // 13. Besiege
  qYjpnH7SJPAHPzZuE8ESaj: {
    title: 'Besiege',
    detectionType: 'internal',
    details: 'Spiderling / Besiege SavedMachines',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'Besiege_Data', 'SavedMachines')] : []),
      'J:\\Jogos\\Besiege (alpha)\\Besiege_Alpha_Win_v0_02\\Besiege_Data\\SavedMachines',
      join(env.docs, 'Besiege')
    ]
  },
  // 14. Battlefield 2
  oM5kDjDZGZheSmWygWSKJy: {
    title: 'Battlefield 2',
    detectionType: 'internal',
    details: 'EA DICE Profiles',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'profiles')] : []),
      'S:\\Origin Backups\\Battlefield 2 Complete Collection\\profiles',
      join(env.docs, 'Battlefield 2')
    ]
  },
  // 15. Phasmophobia
  '1m9JPXKsEZqutEwm8XLcUR': {
    title: 'Phasmophobia',
    detectionType: 'unity',
    details: 'Unity Engine (Kinetic Games)',
    paths: (env) => [
      join(env.localLow, 'Kinetic Games', 'Phasmophobia'),
      join(env.publicDocs, 'OnlineFix', '739630', 'Saves')
    ]
  },
  // 16. Slay the spire
  pUSLpJAutnSPziGmQCGmgQ: {
    title: 'Slay the spire',
    detectionType: 'internal',
    details: 'Mega Crit Internal Saves',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'saves')] : []),
      'J:\\Jogos\\Slay the spire\\saves'
    ]
  },
  // 17. Sonic Mania
  eVcr1ixDFBHdQN3LcjsX2P: {
    title: 'Sonic Mania',
    detectionType: 'user_profile',
    details: 'SEGA Roaming AppData / CODEX',
    paths: (env) => [
      join(env.appData, 'SEGA', 'SonicMania'),
      join(env.publicDocs, 'Steam', 'CODEX', '584400', 'remote')
    ]
  },
  // 18. Transport Fever
  tJwWgcH5Sofm9qJyo5dRLp: {
    title: 'Transport Fever',
    detectionType: 'user_profile',
    details: 'Urban Games Roaming AppData',
    paths: (env) => [
      join(env.appData, 'Transport Fever', 'save'),
      ...(env.gameDir ? [join(env.gameDir, 'save')] : []),
      'J:\\Jogos\\Transport Fever [FitGirl Repack]\\Transport Fever\\save'
    ]
  },
  // 19. inZOI
  '8boWf27kJMTLrAH8W4pTNa': {
    title: 'inZOI',
    detectionType: 'user_profile',
    details: 'Krafton Documents',
    paths: (env) => [
      join(env.docs, 'inZOI'),
      join(env.localAppData, 'inZOI', 'Saved', 'SaveGames')
    ]
  },
  // 20. Outbound
  '5Ez7e8XFujeBZujTGpnYCE': {
    title: 'Outbound',
    detectionType: 'unity',
    details: 'Unity Engine (Square Glade Games) & OnlineFix',
    paths: (env) => [
      join(env.localLow, 'Square Glade Games', 'Outbound'),
      join(env.publicDocs, 'OnlineFix', '2681030', 'Saves')
    ]
  },
  // 21. Battlefield V
  fSUh26scvPXEN1DJ7zhrR1: {
    title: 'Battlefield V',
    detectionType: 'user_profile',
    details: 'EA Documents Settings',
    paths: (env) => [
      join(env.docs, 'Battlefield V', 'settings'),
      join(env.docs, 'Battlefield V')
    ]
  },
  // 22. Heroes of Might and Magic Olden Era
  xfs1M2wtczLLmV5ZrkktgD: {
    title: 'Heroes of Might and Magic Olden Era',
    detectionType: 'unity',
    details: 'Unity Engine (Unfrozen)',
    paths: (env) => [join(env.localLow, 'Unfrozen', 'HeroesOldenEra')]
  },
  // 23. Liner Rider
  jkWP8Adxc9WzmhQ1NXUwxW: {
    title: 'Liner Rider',
    detectionType: 'internal',
    details: 'Local In-game Tracks',
    paths: (env) => [env.gameDir || 'J:\\Jogos\\Liner Rider']
  },
  // 24. MOUSE P.I. For Hire
  wGNGTdnvkyGNWxQjRJFVkC: {
    title: 'MOUSE P.I. For Hire',
    detectionType: 'unity',
    details: 'Unity Engine (Fumi Games)',
    paths: (env) => [
      join(env.localLow, 'Fumi Games', 'MOUSE'),
      join(env.localAppData, 'MOUSE', 'Saved', 'SaveGames')
    ]
  },
  // 25. SimCity 2013
  hQzAoiVeBm37pLux3k5ztw: {
    title: 'SimCity 2013',
    detectionType: 'user_profile',
    details: 'Maxis EA Documents',
    paths: (env) => [
      join(env.docs, 'SimCity', 'Games'),
      join(env.docs, 'SimCity')
    ]
  },
  // 26. Warhammer 40k Rogue Trader
  vD9ELxJqtvhRZQXrxigieB: {
    title: 'Warhammer 40k Rogue Trader',
    detectionType: 'unity',
    details: 'Unity Engine (Owlcat Games)',
    paths: (env) => [
      join(env.localLow, 'Owlcat Games', 'Warhammer 40000 Rogue Trader', 'Saved Games'),
      join(env.localLow, 'Owlcat Games', 'Warhammer 40000 Rogue Trader')
    ]
  },
  // 27. Zombieville USA 3-D
  '9XBZNPDrZfZkMupcY6Q7T6': {
    title: 'Zombieville USA 3-D',
    detectionType: 'unreal',
    details: 'Unreal Engine Project Exodus',
    paths: (env) => [
      join(env.localAppData, 'Exodus', 'Saved', 'SaveGames'),
      join(env.localAppData, 'Exodus')
    ]
  },
  // 28. Warhammer 40000 Space Marine 2
  nyFtHH2B6AmQL5HQp5EWdj: {
    title: 'Warhammer 40000 Space Marine 2',
    detectionType: 'crack',
    details: 'Saber Interactive Local & RUNE (AppID 2183900)',
    paths: (env) => [
      join(env.localAppData, 'Saber', 'Space Marine 2', 'storage', 'steam', 'user'),
      join(env.publicDocs, 'Steam', 'RUNE', '2183900', 'remote')
    ]
  },
  // 29. S.T.A.L.K.E.R. 2 Heart of Chornobyl
  '3EoHfd97sYY74fGJrbsGGm': {
    title: 'S.T.A.L.K.E.R. 2 Heart of Chornobyl',
    detectionType: 'unreal',
    details: 'Unreal Engine 5 (Stalker2)',
    paths: (env) => [
      join(env.localAppData, 'Stalker2', 'Saved'),
      join(env.localAppData, 'Stalker2', 'Saved', 'SaveGames')
    ]
  },
  // 30. Northgard
  wyAqX9mQGjZDBwPgrwEDGD: {
    title: 'Northgard',
    detectionType: 'internal',
    details: 'Shiro Games Internal Save',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'Save')] : []),
      'N:\\Alazter Games\\Northgard\\Northgard\\Save'
    ]
  },
  // 31. Megabonk
  aY1mzTUCznikwzTxFJfqM6: {
    title: 'Megabonk',
    detectionType: 'unity',
    details: 'Unity Engine (Ved)',
    paths: (env) => [join(env.localLow, 'Ved', 'Megabonk')]
  },
  // 32. All Will Fall
  vsia5rG5exRhFBZ8cFiXj7: {
    title: 'All Will Fall',
    detectionType: 'unity',
    details: 'Unity Engine (All Parts Connected)',
    paths: (env) => [
      join(env.localLow, 'All Parts Connected', 'All Will Fall'),
      join(env.localAppData, 'AllWillFall', 'Saved', 'SaveGames')
    ]
  },
  // 33. Replaced
  xqKBJU8K3XLfwVrC6Y9dwS: {
    title: 'Replaced',
    detectionType: 'unity',
    details: 'Unity Engine (SadCatStudios)',
    paths: (env) => [
      join(env.localLow, 'SadCatStudios', 'Replaced'),
      join(env.localAppData, 'Replaced', 'Saved', 'SaveGames')
    ]
  },
  // 34. Hytale
  kwEZy1avg7oMhva44Ze5nh: {
    title: 'Hytale',
    detectionType: 'user_profile',
    details: 'Hypixel Roaming AppData',
    paths: (env) => [
      join(env.appData, 'Hytale'),
      join(env.localAppData, 'Hytale')
    ]
  },
  // 35. ZERO Sievert
  g9kBWxMXz1arytWxWgtxaD: {
    title: 'ZERO Sievert',
    detectionType: 'user_profile',
    details: 'GameMaker LocalAppData (ZERO_Sievert)',
    paths: (env) => [join(env.localAppData, 'ZERO_Sievert')]
  },
  // 36. TCG Card Shop Simulator
  r98xmouuQHC46zmUdGSvqZ: {
    title: 'TCG Card Shop Simulator',
    detectionType: 'unity',
    details: 'Unity Engine (OPNeonGames)',
    paths: (env) => [
      join(env.localLow, 'OPNeonGames', 'Card Shop Simulator')
    ]
  },
  // 37. Balatro
  '331FHSzfc1fQN5v4TByVxS': {
    title: 'Balatro',
    detectionType: 'user_profile',
    details: 'Love2D Roaming AppData',
    paths: (env) => [join(env.appData, 'Balatro')]
  },
  // 38. Punch Club 2
  iCTx954JCCTBB8tNvtmM7F: {
    title: 'Punch Club 2',
    detectionType: 'unity',
    details: 'Unity Engine (Lazy Bear Games)',
    paths: (env) => [
      join(env.localLow, 'Lazy Bear Games', 'Punch Club'),
      join(env.localLow, 'Lazy Bear Games', 'Punch Club 2 Fast Forward')
    ]
  },
  // 39. Hellcard
  '5Q9VoaUQ1dB6TAUg7fiWC9': {
    title: 'Hellcard',
    detectionType: 'unity',
    details: 'Thing Trunk LocalLow & OnlineFix',
    paths: (env) => [
      join(env.localLow, 'Thing Trunk', 'HELLCARD'),
      join(env.publicDocs, 'OnlineFix', '1201540', 'Saves')
    ]
  },
  // 40. Wartales
  '8z4pqJajDzQ5ZzYxxrmQTu': {
    title: 'Wartales',
    detectionType: 'internal',
    details: 'SteamRIP / Shiro Games Internal Save',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'Save')] : []),
      'J:\\Jogos\\Wartales\\Wartales.Steam.Rip-InsaneRamZes\\Wartales\\Save'
    ]
  },
  // 41. Tabletop Simulator
  n7wcfCR4sSV1DPUhmrhC99: {
    title: 'Tabletop Simulator',
    detectionType: 'user_profile',
    details: 'My Games Documents & OnlineFix',
    paths: (env) => [
      join(env.docs, 'My Games', 'Tabletop Simulator', 'Saves'),
      join(env.docs, 'My Games', 'Tabletop Simulator'),
      join(env.publicDocs, 'OnlineFix', '286160', 'Saves'),
      join(env.publicDocs, 'OnlineFix', '324810', 'Saves')
    ]
  },
  // 42. Internet Cafe Simulator
  vm3ti4Zp8ksLm1VLWySvUf: {
    title: 'Internet Cafe Simulator',
    detectionType: 'unity',
    details: 'Unity Engine (Cheesecake Dev)',
    paths: (env) => [
      join(env.localLow, 'Cheesecake Dev', 'Internet Cafe Simulator 2')
    ]
  },
  // 43. Swag and Sorcery
  ruFmqMp5M8wSNso17QuAbw: {
    title: 'Swag and Sorcery',
    detectionType: 'internal',
    details: 'TinyBuild Internal Profile',
    paths: (env) => [
      ...(env.gameDir ? [join(env.gameDir, 'Profile')] : []),
      'J:\\Jogos\\Swag and Sorcery\\Swag and Sorcery\\Profile'
    ]
  },
  // 44. Parkitect.
  kWQQb8NeYaZmq13Ee9NFQk: {
    title: 'Parkitect.',
    detectionType: 'user_profile',
    details: 'Texel Raptor Documents',
    paths: (env) => [
      join(env.docs, 'Parkitect', 'Saves'),
      join(env.docs, 'Parkitect')
    ]
  },
  // 45. Assassins Creed Black Flag Resynced
  gWLaxs7Tv9FyNmx2nWv2ft: {
    title: 'Assassins Creed Black Flag Resynced',
    detectionType: 'user_profile',
    details: "Assassin's Creed Resynced Documents",
    paths: (env) => [
      join(env.docs, 'Assassin\'s Creed Black Flag Resynced'),
      join(env.docs, 'Assassin\'s Creed IV Black Flag')
    ]
  },
  // 46. Stonewards
  '86RGbW69DwVqms4mMADax7': {
    title: 'Stonewards',
    detectionType: 'unity',
    details: 'Unity Engine (Banana Tiger Studio)',
    paths: (env) => [
      join(env.localLow, 'Banana Tiger Studio', 'Stonewards'),
      join(env.publicDocs, 'OnlineFix', '4502710', 'Saves')
    ]
  },
  // 47. Corsair Cove
  '8iMoiScdbsKwx4mLWzLy12': {
    title: 'Corsair Cove',
    detectionType: 'unreal',
    details: 'Unreal Engine Project CorsairCove',
    paths: (env) => [
      join(env.localAppData, 'CorsairCove', 'Saved', 'SaveGames'),
      join(env.localAppData, 'CorsairCove', 'Saved')
    ]
  },
  // 48. Star Wars Zero Company
  '4r2MYFtJy8x6d66u6BfsDs': {
    title: 'Star Wars Zero Company',
    detectionType: 'unreal',
    details: 'Unreal Engine Project SWZeroCompany',
    paths: (env) => [
      join(env.localAppData, 'SWZeroCompany', 'Saved', 'SaveGames'),
      join(env.localAppData, 'SWZeroCompany', 'Saved')
    ]
  }
}

export function inspectFolderSaveFiles(folderPath: string): { fileCount: number; bytes: number } {
  if (!existsSync(folderPath)) return { fileCount: 0, bytes: 0 }
  let fileCount = 0
  let bytes = 0
  try {
    const stat = statSync(folderPath)
    if (!stat.isDirectory()) {
      return { fileCount: 1, bytes: stat.size }
    }
    const entries = readdirSync(folderPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(folderPath, entry.name)
      try {
        const s = statSync(full)
        if (s.isFile()) {
          fileCount++
          bytes += s.size
        } else if (s.isDirectory()) {
          const sub = inspectFolderSaveFiles(full)
          fileCount += sub.fileCount
          bytes += sub.bytes
        }
      } catch {}
    }
  } catch {}
  return { fileCount, bytes }
}

export function findDeepAppId(dir?: string): string | undefined {
  if (!dir || !existsSync(dir)) return undefined

  const checks = [
    join(dir, 'steam_appid.txt'),
    join(dir, 'steam_settings', 'steam_appid.txt'),
    join(dir, 'steam_settings', 'settings', 'steam_appid.txt'),
    join(dir, 'Engine', 'Binaries', 'Win64', 'steam_appid.txt'),
    join(dir, 'Binaries', 'Win64', 'steam_appid.txt'),
    join(dir, 'client_pc', 'root', 'bin', 'pc', 'steam_appid.txt'),
    join(dir, 'windows_content', 'steam_appid.txt')
  ]

  for (const c of checks) {
    if (existsSync(c)) {
      try {
        const txt = readFileSync(c, 'utf8').trim()
        const m = txt.match(/^\d+/)
        if (m) return m[0]
      } catch {}
    }
  }

  const iniChecks = [
    join(dir, 'steam_emu.ini'),
    join(dir, 'OnlineFix.ini'),
    join(dir, 'steam_settings', 'settings', 'configs.user.ini'),
    join(dir, 'steam_settings', 'settings', 'configs.app.ini'),
    join(dir, 'client_pc', 'root', 'bin', 'pc', 'steam_emu.ini'),
    join(dir, 'Engine', 'Binaries', 'Win64', 'steam_emu.ini'),
    join(dir, 'Binaries', 'Win64', 'steam_emu.ini')
  ]

  for (const ini of iniChecks) {
    if (existsSync(ini)) {
      try {
        const txt = readFileSync(ini, 'utf8')
        const m =
          txt.match(/RealAppId\s*=\s*(\d+)/i) ||
          txt.match(/AppId\s*=\s*(\d+)/i) ||
          txt.match(/SteamAppId\s*=\s*(\d+)/i) ||
          txt.match(/FakeAppId\s*=\s*(\d+)/i)
        if (m) return m[1]
      } catch {}
    }
  }

  return undefined
}

export function findUnityAppInfo(dir?: string): { company: string; product: string } | undefined {
  if (!dir || !existsSync(dir)) return undefined
  try {
    const list = readdirSync(dir, { withFileTypes: true })
    for (const item of list) {
      if (item.isDirectory() && item.name.endsWith('_Data')) {
        const appInfo = join(dir, item.name, 'app.info')
        if (existsSync(appInfo)) {
          const lines = readFileSync(appInfo, 'utf8')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
          if (lines.length >= 2) {
            return { company: lines[0], product: lines[1] }
          }
        }
      }
    }
  } catch {}
  return undefined
}

export async function discoverSavePathForGame(params: {
  appName: string
  title: string
  directory?: string
  executable?: string
  homeDir: string
}): Promise<SaveDiscoveryResult> {
  const { appName, title, directory, executable, homeDir } = params
  const cleanTitle = title.replace(/[^\w\s-]/g, '').trim()
  const localAppData = join(homeDir, 'AppData', 'Local')
  const appData = join(homeDir, 'AppData', 'Roaming')
  const localLow = join(homeDir, 'AppData', 'LocalLow')
  const docs = join(homeDir, 'Documents')
  const oneDriveDocs = join(homeDir, 'OneDrive', 'Documentos')
  const publicDocs = process.env.PUBLIC ? join(process.env.PUBLIC, 'Documents') : 'C:\\Users\\Public\\Documents'
  const env: SaveEnv = {
    home: homeDir,
    appData,
    localAppData,
    localLow,
    docs,
    oneDriveDocs,
    publicDocs,
    gameDir: directory
  }

  // Camada 1: Consulta à Base de Conhecimento dos 48 Jogos
  let kbEntry = PIRATAS_48_KNOWLEDGE_BASE[appName]
  if (!kbEntry) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const tNorm = norm(title)
    const foundKey = Object.keys(PIRATAS_48_KNOWLEDGE_BASE).find((k) => {
      const e = PIRATAS_48_KNOWLEDGE_BASE[k]
      return norm(e.title) === tNorm || tNorm.includes(norm(e.title)) || norm(e.title).includes(tNorm)
    })
    if (foundKey) kbEntry = PIRATAS_48_KNOWLEDGE_BASE[foundKey]
  }

  let defaultCandidatePath = ''

  if (kbEntry) {
    const candidatePaths = kbEntry.paths(env).filter(Boolean)
    if (candidatePaths.length > 0) {
      defaultCandidatePath = candidatePaths[0]
      for (const p of candidatePaths) {
        if (existsSync(p)) {
          const stats = inspectFolderSaveFiles(p)
          if (stats.fileCount > 0) {
            return {
              path: resolve(p),
              detectionType: kbEntry.detectionType,
              details: kbEntry.details,
              existsOnDisk: true,
              hasFiles: true,
              fileCount: stats.fileCount,
              totalBytes: stats.bytes
            }
          }
        }
      }
    }
  }

  // Camada 2: Unity Engine app.info
  const unityInfo = findUnityAppInfo(directory)
  if (unityInfo) {
    const unityPath = join(localLow, unityInfo.company, unityInfo.product)
    if (!defaultCandidatePath) defaultCandidatePath = unityPath
    if (existsSync(unityPath)) {
      const stats = inspectFolderSaveFiles(unityPath)
      if (stats.fileCount > 0) {
        return {
          path: resolve(unityPath),
          detectionType: 'unity',
          details: `Unity Engine (${unityInfo.company})`,
          existsOnDisk: true,
          hasFiles: true,
          fileCount: stats.fileCount,
          totalBytes: stats.bytes
        }
      }
    }
  }

  // Camada 3: Deep AppID inspection para Cracks (RUNE, CODEX, OnlineFix, Goldberg)
  const appId = findDeepAppId(directory)
  if (appId) {
    const crackCandidates = [
      { path: join(publicDocs, 'OnlineFix', appId, 'Saves'), label: `Online-Fix Netplay (${appId})` },
      { path: join(publicDocs, 'OnlineFix', appId, 'saves'), label: `Online-Fix Netplay (${appId})` },
      { path: join(publicDocs, 'Steam', 'RUNE', appId, 'remote'), label: `RUNE Steam Crack (${appId})` },
      { path: join(publicDocs, 'Steam', 'CODEX', appId, 'remote'), label: `CODEX Steam Crack (${appId})` },
      { path: join(appData, 'Goldberg SteamEmu Saves', appId, 'remote'), label: `Goldberg SteamEmu (${appId})` },
      { path: join(appData, 'Goldberg SteamEmu Saves', appId), label: `Goldberg SteamEmu (${appId})` },
      { path: join(localAppData, 'TENOKE', appId), label: `TENOKE (${appId})` },
      { path: join(appData, 'FLT', appId), label: `Fairlight FLT (${appId})` },
      { path: join(localAppData, 'EMPRESS', appId, 'remote'), label: `EMPRESS (${appId})` }
    ]
    for (const c of crackCandidates) {
      if (existsSync(c.path)) {
        const stats = inspectFolderSaveFiles(c.path)
        if (stats.fileCount > 0) {
          return {
            path: resolve(c.path),
            detectionType: 'crack',
            details: c.label,
            existsOnDisk: true,
            hasFiles: true,
            fileCount: stats.fileCount,
            totalBytes: stats.bytes
          }
        }
      }
    }
  }

  // Camada 4: Unreal Engine 4/5
  const rawExeBase = executable ? resolve(executable).replace(/\\/g, '/').split('/').pop()?.replace(/\.exe$/i, '') || '' : ''
  const ueProjectName = rawExeBase.replace(/-(?:Win64|Win32)-(?:Shipping|Development|Test)$/i, '')
  const ueCandidates = [
    join(localAppData, cleanTitle, 'Saved', 'SaveGames'),
    join(localAppData, cleanTitle, 'Saved'),
    ...(ueProjectName ? [
      join(localAppData, ueProjectName, 'Saved', 'SaveGames'),
      join(localAppData, ueProjectName, 'Saved')
    ] : []),
    ...(directory ? [
      join(directory, 'Saved', 'SaveGames'),
      join(directory, 'Saved'),
      ...(ueProjectName ? [
        join(directory, ueProjectName, 'Saved', 'SaveGames'),
        join(directory, ueProjectName, 'Saved')
      ] : [])
    ] : [])
  ]

  // Procura subpastas de projeto Unreal Engine (ex: <GameDir>/<Project>/Saved/SaveGames)
  if (directory && existsSync(directory)) {
    try {
      const subs = readdirSync(directory)
      for (const s of subs) {
        const candidate = join(directory, s, 'Saved', 'SaveGames')
        if (existsSync(candidate)) {
          ueCandidates.push(candidate)
        }
      }
    } catch {
      // continua
    }
  }
  for (const p of ueCandidates) {
    if (existsSync(p)) {
      const stats = inspectFolderSaveFiles(p)
      if (stats.fileCount > 0) {
        return {
          path: resolve(p),
          detectionType: 'unreal',
          details: `Unreal Engine (${cleanTitle})`,
          existsOnDisk: true,
          hasFiles: true,
          fileCount: stats.fileCount,
          totalBytes: stats.bytes
        }
      }
    }
  }

  // Camada 5: Godot Engine
  const godotPath = join(appData, 'Godot', 'app_userdata', cleanTitle)
  if (existsSync(godotPath)) {
    const stats = inspectFolderSaveFiles(godotPath)
    if (stats.fileCount > 0) {
      return {
        path: resolve(godotPath),
        detectionType: 'godot',
        details: `Godot Engine (${cleanTitle})`,
        existsOnDisk: true,
        hasFiles: true,
        fileCount: stats.fileCount,
        totalBytes: stats.bytes
      }
    }
  }

  // Camada 6: Saves Internos da Pasta do Jogo
  if (directory && existsSync(directory)) {
    const internalSubdirs = ['saves', 'save', 'UserData', 'Profile', 'profiles', 'SavedMachines', join('steam_settings', 'saves')]
    for (const sub of internalSubdirs) {
      const p = join(directory, sub)
      if (existsSync(p)) {
        const stats = inspectFolderSaveFiles(p)
        if (stats.fileCount > 0) {
          return {
            path: resolve(p),
            detectionType: 'internal',
            details: `Pasta Interna (${sub})`,
            existsOnDisk: true,
            hasFiles: true,
            fileCount: stats.fileCount,
            totalBytes: stats.bytes
          }
        }
      }
    }
  }

  // Camada 7: Perfil de Usuário
  const profileCandidates = [
    join(docs, title),
    join(docs, cleanTitle),
    join(docs, 'My Games', title),
    join(docs, 'My Games', cleanTitle),
    join(oneDriveDocs, title),
    join(oneDriveDocs, cleanTitle),
    join(homeDir, 'Saved Games', title),
    join(homeDir, 'Saved Games', cleanTitle),
    join(localAppData, title),
    join(localAppData, cleanTitle),
    join(appData, title),
    join(appData, cleanTitle)
  ]
  for (const p of profileCandidates) {
    if (existsSync(p)) {
      const stats = inspectFolderSaveFiles(p)
      if (stats.fileCount > 0) {
        return {
          path: resolve(p),
          detectionType: 'user_profile',
          details: `Perfil de Usuário (${cleanTitle})`,
          existsOnDisk: true,
          hasFiles: true,
          fileCount: stats.fileCount,
          totalBytes: stats.bytes
        }
      }
    }
  }

  // Fallback: Retorna o caminho alvo mapeado mais provável mesmo se ainda não criado
  const fallbackPath = defaultCandidatePath || join(localLow, cleanTitle, cleanTitle)
  const isExisting = existsSync(fallbackPath)
  const stats = isExisting ? inspectFolderSaveFiles(fallbackPath) : { fileCount: 0, bytes: 0 }

  return {
    path: resolve(fallbackPath),
    detectionType: kbEntry ? kbEntry.detectionType : (unityInfo ? 'unity' : 'user_profile'),
    details: kbEntry ? kbEntry.details : (unityInfo ? `Unity Engine (${unityInfo.company})` : `Diretório Mapeado (${cleanTitle})`),
    existsOnDisk: isExisting,
    hasFiles: stats.fileCount > 0,
    fileCount: stats.fileCount,
    totalBytes: stats.bytes
  }
}
