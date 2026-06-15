import { exec, execSync } from 'child_process'
import { existsSync, readdirSync, statSync } from 'graceful-fs'
import { readdir, stat } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { libraryStore } from './electronStores'
import { addNewApp } from './library'
import { GlobalConfig } from 'backend/config'
import { GameConfig } from 'backend/game_config'
import { logInfo, logError } from 'backend/logger'
import short from 'short-uuid'
import { GameCandidate } from 'common/types'
import { uninstall } from './games'
import { sendFrontendMessage } from 'backend/ipc'
import { getApiKey, fetchCoverFromSteamGridDB } from './steamgridHelper'

interface RegistryEntry {
  DisplayName?: string
  InstallLocation?: string
  DisplayIcon?: string
}

function runPowerShell(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // UTF8 encoding is set to handle accented characters/Unicode from the registry properly.
    const fullCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${query.replace(/"/g, '\\"')}"`
    exec(fullCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

function normalizePathForComparison(p: string): string {
  if (!p) return ''
  return p.replace(/\\/g, '/').toLowerCase().trim()
}

function normalizeTitleForComparison(t: string): string {
  if (!t) return ''
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[®™©]/g, '') // Remove símbolos especiais
    .replace(/[^a-z0-9]/gi, '') // Mantém apenas letras e números
    .toLowerCase()
    .trim()
}

function isDuplicateGame(
  game: { title?: string; install?: { executable?: string } },
  scannedTitle: string,
  scannedExecutableOrFolder: string
): boolean {
  const normTitle1 = normalizeTitleForComparison(game.title || '')
  const normTitle2 = normalizeTitleForComparison(scannedTitle)

  // 1. Se os títulos normalizados alfanuméricos forem idênticos
  if (normTitle1 === normTitle2 && normTitle1 !== '') {
    return true
  }

  // 2. Se a pasta pai do executável ou a pasta de instalação for idêntica (normalizada)
  const exe1 = game.install?.executable
  if (exe1 && scannedExecutableOrFolder) {
    const dir1 = normalizePathForComparison(dirname(exe1))
    
    // Se a entrada escaneada for uma pasta (como InstallLocation/folder)
    if (existsSync(scannedExecutableOrFolder) && statSync(scannedExecutableOrFolder).isDirectory()) {
      if (dir1 === normalizePathForComparison(scannedExecutableOrFolder)) {
        return true
      }
    } else {
      // Se for um caminho de arquivo executável completo
      const dirOfScannedExe = normalizePathForComparison(dirname(scannedExecutableOrFolder))
      if (dir1 === dirOfScannedExe) {
        return true
      }
    }
  }

  return false
}

function findExecutables(dir: string, depth = 0): string[] {
  if (depth > 2) return []
  const results: string[] = []
  try {
    const items = readdirSync(dir)
    for (const item of items) {
      const fullPath = join(dir, item)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        const nameLower = item.toLowerCase()
        // Skip common directories that don't contain game binaries
        if (['engine', 'plugins', 'feature', 'support', 'directx', 'redist', 'uninstall', 'mono', 'dotnet', 'eac', 'easyanticheat', 'subsystem'].includes(nameLower)) {
          continue
        }
        results.push(...findExecutables(fullPath, depth + 1))
      } else if (stat.isFile() && item.toLowerCase().endsWith('.exe')) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

const NON_GAME_PUBLISHERS = [
  'microsoft', 'google', 'adobe', 'mozilla', 'intel', 'nvidia', 'realtek',
  'dropbox', 'github', 'zoom', 'obs studio', 'elgato', 'wireshark', 'winrar',
  '7-zip', 'oracle', 'node.js', 'python', 'git', 'docker', 'valve', 'epic games',
  'gog.com', 'ea', 'ubisoft', 'origin', 'riot games', 'blizzard'
]

const NON_GAME_KEYWORDS = [
  'driver', 'update', 'redistributable', 'sdk', 'runtime', 'framework',
  'control panel', 'support', 'service', 'visual c++', 'tool', 'library',
  'language pack', 'browser', 'antivirus', 'assistant', 'helper', 'patch',
  'client', 'launcher', 'compiler', 'interpreter', 'engine', 'database',
  'server', 'vulkanRT', 'geforce experience'
]

export async function scanInstalledGames(): Promise<{ count: number; games: string[] }> {
  if (process.platform !== 'win32') {
    return { count: 0, games: [] }
  }

  logInfo('Starting registry scan for installed games...')

  const psQuery = `Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.InstallLocation -ne $null -and $_.DisplayName -ne $null } | Select-Object DisplayName, InstallLocation, DisplayIcon | ConvertTo-Json`

  let jsonOutput = ''
  try {
    jsonOutput = await runPowerShell(psQuery)
  } catch (error) {
    logError(['Failed running PowerShell query:', error])
    return { count: 0, games: [] }
  }

  if (!jsonOutput || jsonOutput.trim() === '') {
    return { count: 0, games: [] }
  }

  let rawEntries: RegistryEntry[] = []
  try {
    const parsed = JSON.parse(jsonOutput)
    rawEntries = Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    logError(['Failed parsing registry query JSON output:', error])
    return { count: 0, games: [] }
  }

  const alreadySideloaded = libraryStore.get('games', [])
  const apiKey = getApiKey()
  const addedGames: string[] = []

  for (const entry of rawEntries) {
    const { DisplayName, InstallLocation, DisplayIcon } = entry
    if (!DisplayName || !InstallLocation) continue

    const title = DisplayName.trim()
    const folder = InstallLocation.trim()

    if (!title || !folder || !existsSync(folder)) continue

    // Heuristic filters to skip non-game software
    const titleLower = title.toLowerCase()
    if (NON_GAME_KEYWORDS.some(k => titleLower.includes(k))) continue

    // Check if already in the library
    const existingGame = alreadySideloaded.find(g => isDuplicateGame(g, title, folder))
    if (existingGame) {
      if ((!existingGame.art_cover || existingGame.art_cover.includes('heroic-icon.svg') || existingGame.art_cover.includes('heroic_card.jpg')) && apiKey) {
        try {
          const coverData = await fetchCoverFromSteamGridDB(apiKey, title)
          if (coverData) {
            existingGame.art_square = coverData.art_square
            existingGame.art_cover = coverData.art_cover
            libraryStore.set('games', alreadySideloaded)
            sendFrontendMessage('refreshLibrary', 'sideload')
            logInfo(`Automatically updated missing cover for existing game: ${title}`)
          }
        } catch (err) {
          logError([`Failed fetching missing SteamGridDB cover for existing game ${title}:`, err])
        }
      }
      continue
    }

    // Try to find the game executable
    let executablePath = ''

    // Option 1: Parse DisplayIcon
    if (DisplayIcon) {
      // Clean icon path (remove comma index and quotes)
      const cleanIcon = DisplayIcon.replace(/,\d+$/, '').replace(/"/g, '').trim()
      if (cleanIcon.toLowerCase().endsWith('.exe') && existsSync(cleanIcon)) {
        executablePath = cleanIcon
      }
    }

    // Option 2: Search folder recursively for .exe candidates
    if (!executablePath) {
      const candidates = findExecutables(folder)
      if (candidates.length === 0) continue

      // Filter candidates
      const filtered = candidates.filter(path => {
        const file = basename(path).toLowerCase()
        return !['unins', 'uninstall', 'setup', 'install', 'crash', 'reporter', 'config', 'settings', 'tool', 'cef', 'browser', 'unity', 'easyanticheat', 'eac', 'vc_redist', 'dxsetup', 'touchup', 'gfn', 'geforce'].some(k => file.includes(k))
      })

      if (filtered.length === 0) continue

      // Score candidates to find the best match
      let bestCandidate = filtered[0]
      let bestScore = -1

      for (const path of filtered) {
        const file = basename(path, '.exe').toLowerCase()
        let score = 0

        // High score if filename is similar to the game title
        if (titleLower.includes(file) || file.includes(titleLower)) {
          score += 100
        }

        // Add file size to score (larger is more likely to be the game)
        try {
          const stats = statSync(path)
          score += Math.floor(stats.size / (1024 * 1024)) // 1 point per MB
        } catch {}

        if (score > bestScore) {
          bestScore = score
          bestCandidate = path
        }
      }

      executablePath = bestCandidate
    }

    if (!executablePath) continue

    // Fetch cover image from SteamGridDB if API key exists
    let art_square = ''
    let art_cover = ''

    if (apiKey) {
      try {
        const coverData = await fetchCoverFromSteamGridDB(apiKey, title)
        if (coverData) {
          art_square = coverData.art_square
          art_cover = coverData.art_cover
        }
      } catch (err) {
        logError([`Failed fetching SteamGridDB cover for ${title}:`, err])
      }
    }

    // Add to library
    const app_name = short.generate().toString()
    try {
      addNewApp({
        app_name,
        title,
        runner: 'sideload',
        install: {
          executable: executablePath,
          platform: 'windows',
          is_dlc: false
        },
        art_cover,
        art_square,
        is_installed: true,
        canRunOffline: true
      })

      // Reset configurations to default
      const gameConfig = GameConfig.get(app_name)
      gameConfig.resetToDefaults()

      addedGames.push(title)
      logInfo(`Automatically added detected game: ${title} (${executablePath})`)
    } catch (err) {
      logError([`Failed to add game ${title}:`, err])
    }
  }

  return {
    count: addedGames.length,
    games: addedGames
  }
}

export async function discoverInstalledGames(): Promise<GameCandidate[]> {
  if (process.platform !== 'win32') {
    return []
  }

  logInfo('Starting registry scan for discovering installed games...')

  const psQuery = `Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.InstallLocation -ne $null -and $_.DisplayName -ne $null } | Select-Object DisplayName, InstallLocation, DisplayIcon | ConvertTo-Json`

  let jsonOutput = ''
  try {
    jsonOutput = await runPowerShell(psQuery)
  } catch (error) {
    logError(['Failed running PowerShell query:', error])
    return []
  }

  if (!jsonOutput || jsonOutput.trim() === '') {
    return []
  }

  let rawEntries: RegistryEntry[] = []
  try {
    const parsed = JSON.parse(jsonOutput)
    rawEntries = Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    logError(['Failed parsing registry query JSON output:', error])
    return []
  }

  const alreadySideloaded = libraryStore.get('games', [])
  const blacklist: Array<{ title: string; executable: string }> = libraryStore.get('blacklist', [])
  const apiKey = getApiKey()
  const candidates: GameCandidate[] = []

  for (const entry of rawEntries) {
    const { DisplayName, InstallLocation, DisplayIcon } = entry
    if (!DisplayName || !InstallLocation) continue

    const title = DisplayName.trim()
    const folder = InstallLocation.trim()

    if (!title || !folder || !existsSync(folder)) continue

    // Heuristic filters to skip non-game software
    const titleLower = title.toLowerCase()
    if (NON_GAME_KEYWORDS.some(k => titleLower.includes(k))) continue

    // Try to find the game executable
    let executablePath = ''

    // Option 1: Parse DisplayIcon
    if (DisplayIcon) {
      // Clean icon path (remove comma index and quotes)
      const cleanIcon = DisplayIcon.replace(/,\d+$/, '').replace(/"/g, '').trim()
      if (cleanIcon.toLowerCase().endsWith('.exe') && existsSync(cleanIcon)) {
        executablePath = cleanIcon
      }
    }

    // Option 2: Search folder recursively for .exe candidates
    if (!executablePath) {
      const exeCandidates = findExecutables(folder)
      if (exeCandidates.length === 0) continue

      // Filter candidates
      const filtered = exeCandidates.filter(path => {
        const file = basename(path).toLowerCase()
        return !['unins', 'uninstall', 'setup', 'install', 'crash', 'reporter', 'config', 'settings', 'tool', 'cef', 'browser', 'unity', 'easyanticheat', 'eac', 'vc_redist', 'dxsetup', 'touchup', 'gfn', 'geforce'].some(k => file.includes(k))
      })

      if (filtered.length === 0) continue

      // Score candidates to find the best match
      let bestCandidate = filtered[0]
      let bestScore = -1

      for (const path of filtered) {
        const file = basename(path, '.exe').toLowerCase()
        let score = 0

        // High score if filename is similar to the game title
        if (titleLower.includes(file) || file.includes(titleLower)) {
          score += 100
        }

        // Add file size to score (larger is more likely to be the game)
        try {
          const stats = statSync(path)
          score += Math.floor(stats.size / (1024 * 1024)) // 1 point per MB
        } catch {}

        if (score > bestScore) {
          bestScore = score
          bestCandidate = path
        }
      }

      executablePath = bestCandidate
    }

    if (!executablePath) continue

    // Check if already in the library
    const existingGame = alreadySideloaded.find(g => isDuplicateGame(g, title, executablePath))
    if (existingGame) {
      if ((!existingGame.art_cover || existingGame.art_cover.includes('heroic-icon.svg') || existingGame.art_cover.includes('heroic_card.jpg')) && apiKey) {
        try {
          const coverData = await fetchCoverFromSteamGridDB(apiKey, title)
          if (coverData) {
            existingGame.art_square = coverData.art_square
            existingGame.art_cover = coverData.art_cover
            libraryStore.set('games', alreadySideloaded)
            sendFrontendMessage('refreshLibrary', 'sideload')
            logInfo(`Automatically updated missing cover for existing game: ${title}`)
          }
        } catch (err) {
          logError([`Failed fetching missing SteamGridDB cover for existing game ${title}:`, err])
        }
      }
      continue
    }

    // Check if in blacklist
    const isBlacklisted = blacklist.some(
      b => isDuplicateGame({ title: b.title, install: { executable: b.executable } }, title, executablePath)
    )
    if (isBlacklisted) continue

    // Fetch cover image from SteamGridDB if API key exists
    let art_square = ''
    let art_cover = ''

    if (apiKey) {
      try {
        const coverData = await fetchCoverFromSteamGridDB(apiKey, title)
        if (coverData) {
          art_square = coverData.art_square
          art_cover = coverData.art_cover
        }
      } catch (err) {
        logError([`Failed fetching SteamGridDB cover for ${title}:`, err])
      }
    }

    candidates.push({
      title,
      executable: executablePath,
      art_cover,
      art_square
    })
  }

  return candidates
}

function getDrives(): string[] {
  try {
    const output = execSync('wmic logicaldisk get name', { encoding: 'utf8' })
    return output.split('\r\n')
      .map(line => line.trim())
      .filter(line => /^[A-Z]:$/.test(line))
      .map(drive => drive + '\\')
  } catch {
    return ['C:\\']
  }
}

const IGNORED_DIR_NAMES = new Set([
  'windows',
  'system volume information',
  '$recycle.bin',
  'recovery',
  'appdata',
  'microsoft',
  'google',
  'node_modules',
  '.git',
  'temp',
  'tmp',
  'system32',
  'syswow64',
  'boot',
  'common files'
])

async function scanDirectoryForGamesAsync(
  dir: string,
  searchTitles: string[] | undefined,
  depth: number,
  maxDepth: number,
  results: GameCandidate[]
): Promise<void> {
  if (depth > maxDepth) return

  try {
    const items = await readdir(dir)
    const subdirs: string[] = []
    const exes: string[] = []

    for (const item of items) {
      const fullPath = join(dir, item)
      try {
        const stats = await stat(fullPath)
        if (stats.isDirectory()) {
          const lowerName = item.toLowerCase()
          if (!IGNORED_DIR_NAMES.has(lowerName) && !lowerName.startsWith('.')) {
            subdirs.push(fullPath)
          }
        } else if (stats.isFile() && item.toLowerCase().endsWith('.exe')) {
          exes.push(fullPath)
        }
      } catch {}
    }

    for (const exePath of exes) {
      const fileName = basename(exePath).toLowerCase()
      if (['unins', 'uninstall', 'setup', 'install', 'crash', 'reporter', 'config', 'settings', 'tool', 'cef', 'browser', 'unity', 'easyanticheat', 'eac', 'vc_redist', 'dxsetup', 'touchup', 'gfn', 'geforce'].some(k => fileName.includes(k))) {
        continue
      }

      const dirName = basename(dir)
      const title = dirName

      if (searchTitles && searchTitles.length > 0) {
        const matchesSearch = searchTitles.some(term => {
          const normTerm = term.toLowerCase().trim()
          return title.toLowerCase().includes(normTerm) || fileName.includes(normTerm)
        })
        if (!matchesSearch) continue
      }

      if (!results.some(r => r.executable === exePath)) {
        results.push({
          title,
          executable: exePath,
          art_cover: '',
          art_square: ''
        })
      }
    }

    for (const subdir of subdirs) {
      await scanDirectoryForGamesAsync(subdir, searchTitles, depth + 1, maxDepth, results)
    }
  } catch {}
}

export async function discoverAllGames(searchTitles?: string[]): Promise<GameCandidate[]> {
  if (process.platform !== 'win32') {
    return []
  }

  logInfo(`Starting full PC scan for games... Search terms: ${searchTitles?.join(', ') || 'None'}`)

  const drives = getDrives()
  const results: GameCandidate[] = []

  for (const drive of drives) {
    await scanDirectoryForGamesAsync(drive, searchTitles, 1, 5, results)
  }

  const apiKey = getApiKey()
  if (apiKey) {
    const fetchPromises = results.slice(0, 50).map(async (candidate) => {
      try {
        const coverData = await fetchCoverFromSteamGridDB(apiKey, candidate.title)
        if (coverData) {
          candidate.art_square = coverData.art_square
          candidate.art_cover = coverData.art_cover
        }
      } catch {}
    })
    await Promise.all(fetchPromises)
  }

  return results
}

export async function importSelectedGames({
  gamesToImport,
  gamesToBlacklist
}: {
  gamesToImport: GameCandidate[]
  gamesToBlacklist: GameCandidate[]
}): Promise<string[]> {
  const importedAppNames: string[] = []

  // Handle imports
  for (const game of gamesToImport) {
    const app_name = short.generate().toString()
    try {
      addNewApp({
        app_name,
        title: game.title,
        runner: 'sideload',
        install: {
          executable: game.executable,
          platform: 'windows',
          is_dlc: false
        },
        art_cover: game.art_cover,
        art_square: game.art_square,
        is_installed: true,
        canRunOffline: true
      })

      // Reset configurations to default
      const gameConfig = GameConfig.get(app_name)
      gameConfig.resetToDefaults()

      importedAppNames.push(app_name)
      logInfo(`Imported game via scan: ${game.title} (${game.executable})`)
    } catch (err) {
      logError([`Failed to import game ${game.title}:`, err])
    }
  }

  // Handle blacklist additions
  if (gamesToBlacklist.length > 0) {
    const blacklist: Array<{ title: string; executable: string }> = libraryStore.get('blacklist', [])
    for (const game of gamesToBlacklist) {
      if (!blacklist.some(b => b.executable.toLowerCase() === game.executable.toLowerCase())) {
        blacklist.push({ title: game.title, executable: game.executable })
        logInfo(`Added game to blacklist: ${game.title} (${game.executable})`)
      }
    }
    libraryStore.set('blacklist', blacklist)
  }

  return importedAppNames
}

export async function undoImport(appNames: string[]): Promise<void> {
  logInfo(`Undoing import for appNames: ${appNames.join(', ')}`)
  for (const appName of appNames) {
    try {
      await uninstall({ appName, shouldRemovePrefix: false, deleteFiles: false })
    } catch (err) {
      logError([`Failed to undo import for appName ${appName}:`, err])
    }
  }
}

export async function addGameToBlacklist({
  title,
  executable
}: {
  title: string
  executable: string
}): Promise<void> {
  const blacklist: Array<{ title: string; executable: string }> = libraryStore.get('blacklist', [])
  if (!blacklist.some(b => b.executable.toLowerCase() === executable.toLowerCase())) {
    blacklist.push({ title, executable })
    libraryStore.set('blacklist', blacklist)
    logInfo(`Directly added game to blacklist: ${title} (${executable})`)
  }
}

export async function removeGameFromBlacklist(executable: string): Promise<void> {
  const blacklist: Array<{ title: string; executable: string }> = libraryStore.get('blacklist', [])
  const filtered = blacklist.filter(b => b.executable.toLowerCase() !== executable.toLowerCase())
  libraryStore.set('blacklist', filtered)
  logInfo(`Removed game from blacklist: ${executable}`)
}

export async function clearBlacklist(): Promise<void> {
  libraryStore.set('blacklist', [])
  logInfo('Cleared game scanner blacklist')
}

export async function getBlacklist(): Promise<Array<{ title: string; executable: string }>> {
  return libraryStore.get('blacklist', [])
}
