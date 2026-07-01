import { exec, execSync } from 'child_process'
import { existsSync, readdirSync, statSync, readFileSync } from 'graceful-fs'
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

interface ScannerRule {
  displayNamePattern: string
  preferred_exe: string
  targetExe: string
  ignore_exes: string[]
}

interface ScannerRules {
  blacklisted_titles: string[]
  blacklisted_exes: string[]
  known_games: ScannerRule[]
}

import loadedRulesJson from './scanner_rules.json'
const loadedRules = loadedRulesJson as ScannerRules

function getSimilarity(s1: string, s2: string): number {
  const norm1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const norm2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  if (norm1 === norm2) return 1.0
  if (!norm1 || !norm2) return 0.0

  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length)
  }

  const track = Array(norm2.length + 1).fill(null).map(() => Array(norm1.length + 1).fill(null))
  for (let i = 0; i <= norm1.length; i += 1) track[0][i] = i
  for (let j = 0; j <= norm2.length; j += 1) track[j][0] = j
  for (let j = 1; j <= norm2.length; j += 1) {
    for (let i = 1; i <= norm1.length; i += 1) {
      const indicator = norm1[i - 1] === norm2[j - 1] ? 0 : 1
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      )
    }
  }
  const distance = track[norm2.length][norm1.length]
  const maxLength = Math.max(norm1.length, norm2.length)
  return (maxLength - distance) / maxLength
}

function isAcronym(exeName: string, folderTitle: string): boolean {
  const normExe = exeName.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normExe.length < 2) return false
  
  // Extract first letter of each word in the folder title
  const words = folderTitle.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)
  if (words.length < 2) return false
  
  const acronym = words.map(w => w[0]).join('')
  if (normExe.startsWith(acronym) || acronym.startsWith(normExe)) {
    return true
  }
  
  // Also check acronym without short stop-words like 'of', 'the', 'a', 'to', 'for', 'and'
  const filteredWords = words.filter(w => !['of', 'the', 'a', 'to', 'for', 'and', 'in', 'on', 'at', 'with', 'by'].includes(w))
  if (filteredWords.length >= 2) {
    const filteredAcronym = filteredWords.map(w => w[0]).join('')
    if (normExe.startsWith(filteredAcronym) || filteredAcronym.startsWith(normExe)) {
      return true
    }
  }
  
  return false
}

function isCandidateExeValid(exePath: string, folderTitle: string, matchedRule?: ScannerRule, bypassStrictFilters = false): boolean {
  const fileName = basename(exePath).toLowerCase()

  // 1. If it's a known game and is the preferred exe, it's always valid
  if (matchedRule) {
    if (matchedRule.preferred_exe && fileName === matchedRule.preferred_exe.toLowerCase()) {
      return true
    }
  }

  // 2. Filter out general installer/updater/tool keywords in the file name
  if (['unins', 'uninstall', 'setup', 'install', 'crash', 'reporter', 'config', 'settings', 'tool', 'cef', 'browser', 'unity', 'easyanticheat', 'eac', 'vc_redist', 'dxsetup', 'touchup', 'gfn', 'geforce'].some(k => fileName.includes(k))) {
    return false
  }

  // 3. Rules-based blacklist and ignore exes
  if (loadedRules.blacklisted_exes && loadedRules.blacklisted_exes.some(k => fileName.includes(k.toLowerCase()))) {
    return false
  }
  if (matchedRule && matchedRule.ignore_exes.some(k => fileName.includes(k.toLowerCase()))) {
    return false
  }

  // 4. Subfolder exclusion: check if file path contains common redist/tools/support/scripts/shims directories
  const pathParts = exePath.toLowerCase().split(/[\\/]/)
  const ignoredSubfolders = ['redist', 'support', 'tools', 'scripts', 'shims', '_redist', '__installer']
  if (pathParts.some(part => ignoredSubfolders.includes(part))) {
    return false
  }

  // If we bypass strict filters (for verified Steam/Registry app folders), skip size and similarity checks
  if (bypassStrictFilters) {
    return true
  }

  // 5. File size filter (must be >= 3 MB for unknown games)
  let sizeInMB = 0
  try {
    const stats = statSync(exePath)
    sizeInMB = stats.size / (1024 * 1024)
    if (sizeInMB < 3) {
      return false
    }
  } catch {
    // Fail-safe to true if stat fails
  }

  // If the executable size is relatively large (>= 15 MB), it is highly likely to be
  // the main game runner, so we bypass similarity check to avoid missing games
  // with non-standard executable filenames.
  if (sizeInMB >= 15) {
    return true
  }

  // 6. Name similarity check between exe name (no extension) and parent folder / title
  const exeBase = basename(exePath, '.exe')
  const similarity = getSimilarity(exeBase, folderTitle)
  if (similarity < 0.12 && !isAcronym(exeBase, folderTitle)) {
    return false
  }

  return true
}

async function discoverSteamGames(): Promise<GameCandidate[]> {
  const candidates: GameCandidate[] = []
  try {
    // 1. Get Steam path from Registry
    const rawSteamPath = await runPowerShell('(Get-ItemProperty -Path HKCU:\\Software\\Valve\\Steam).SteamPath').catch(() => '')
    const steamPath = rawSteamPath.trim().replace(/\//g, '\\')
    if (!steamPath || !existsSync(steamPath)) {
      return []
    }

    // 2. Locate libraryfolders.vdf
    const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
    if (!existsSync(vdfPath)) {
      return []
    }

    const vdfContent = readFileSync(vdfPath, 'utf8')
    const libraryPaths: string[] = []

    // Match all "path" values
    const pathRegex = /"path"\s+"([^"]+)"/g
    let match: RegExpExecArray | null
    while ((match = pathRegex.exec(vdfContent)) !== null) {
      const libPath = match[1].replace(/\\\\/g, '\\')
      if (existsSync(libPath)) {
        libraryPaths.push(libPath)
      }
    }

    // 3. For each library path, look in steamapps for appmanifest_*.acf files
    for (const libPath of libraryPaths) {
      const steamappsDir = join(libPath, 'steamapps')
      if (!existsSync(steamappsDir)) continue

      const files = readdirSync(steamappsDir)
      const acfFiles = files.filter(f => f.toLowerCase().startsWith('appmanifest_') && f.toLowerCase().endsWith('.acf'))

      for (const acfFile of acfFiles) {
        try {
          const acfPath = join(steamappsDir, acfFile)
          const acfContent = readFileSync(acfPath, 'utf8')

          const nameMatch = acfContent.match(/"name"\s+"([^"]+)"/i)
          const dirMatch = acfContent.match(/"installdir"\s+"([^"]+)"/i)

          if (nameMatch && dirMatch) {
            const title = nameMatch[1].trim()
            const installDir = dirMatch[1].trim()
            const gameFolder = join(steamappsDir, 'common', installDir)

            if (existsSync(gameFolder)) {
              const exeCandidates = findExecutables(gameFolder)
              if (exeCandidates.length === 0) continue

              // Filter out invalid candidates using our smart validator
              const matchedRule = loadedRules.known_games.find(rule => 
                title.toLowerCase().includes(rule.displayNamePattern.toLowerCase())
              )
              const filtered = exeCandidates.filter(path => isCandidateExeValid(path, title, matchedRule, true))
              if (filtered.length === 0) continue

              // Determine the best executable
              let executablePath = ''
              if (matchedRule) {
                const preferred = filtered.find(path => 
                  basename(path).toLowerCase() === matchedRule.preferred_exe.toLowerCase()
                )
                if (preferred) executablePath = preferred
              }

              if (!executablePath) {
                let bestCandidate = filtered[0]
                let bestScore = -1
                for (const path of filtered) {
                  const file = basename(path, '.exe').toLowerCase()
                  let score = 0
                  if (title.toLowerCase().includes(file) || file.includes(title.toLowerCase())) {
                    score += 100
                  }
                  try {
                    const stats = statSync(path)
                    score += Math.floor(stats.size / (1024 * 1024))
                  } catch {}
                  if (score > bestScore) {
                    bestScore = score
                    bestCandidate = path
                  }
                }
                executablePath = bestCandidate
              }

              if (executablePath) {
                candidates.push({
                  title,
                  executable: executablePath,
                  art_cover: '',
                  art_square: ''
                })
              }
            }
          }
        } catch (err) {
          logError([`Failed parsing ACF file ${acfFile}:`, err])
        }
      }
    }
  } catch (err) {
    logError(['Failed discovering Steam games:', err])
  }

  return candidates
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

    // Heuristic and database filters to skip non-game software
    const titleLower = title.toLowerCase()
    if (NON_GAME_KEYWORDS.some(k => titleLower.includes(k))) continue
    if (loadedRules.blacklisted_titles.some(k => titleLower.includes(k.toLowerCase()))) continue

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

    const matchedRule = loadedRules.known_games.find(rule => 
      titleLower.includes(rule.displayNamePattern.toLowerCase())
    )

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
      const filtered = candidates.filter(path => isCandidateExeValid(path, title, matchedRule, true))

      if (filtered.length === 0) continue

      // Try to find preferred_exe first
      if (matchedRule) {
        const preferred = filtered.find(path => 
          basename(path).toLowerCase() === matchedRule.preferred_exe.toLowerCase()
        )
        if (preferred) {
          executablePath = preferred
        }
      }

      if (!executablePath) {
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

      // Save targetExe override if matched
      if (matchedRule && matchedRule.targetExe) {
        gameConfig.setSetting('targetExe', join(dirname(executablePath), matchedRule.targetExe))
      }

      addedGames.push(title)
      logInfo(`Automatically added detected game: ${title} (${executablePath})`)
    } catch (err) {
      logError([`Failed to add game ${title}:`, err])
    }
  }

  // Discover and automatically add Steam games
  const steamGames = await discoverSteamGames()
  for (const sGame of steamGames) {
    const existingGame = alreadySideloaded.find(g => isDuplicateGame(g, sGame.title, sGame.executable))
    if (existingGame) {
      if ((!existingGame.art_cover || existingGame.art_cover.includes('heroic-icon.svg') || existingGame.art_cover.includes('heroic_card.jpg')) && apiKey) {
        try {
          const coverData = await fetchCoverFromSteamGridDB(apiKey, sGame.title)
          if (coverData) {
            existingGame.art_square = coverData.art_square
            existingGame.art_cover = coverData.art_cover
            libraryStore.set('games', alreadySideloaded)
            sendFrontendMessage('refreshLibrary', 'sideload')
            logInfo(`Automatically updated missing cover for existing Steam game: ${sGame.title}`)
          }
        } catch (err) {
          logError([`Failed fetching missing SteamGridDB cover for existing Steam game ${sGame.title}:`, err])
        }
      }
      continue
    }

    let art_square = ''
    let art_cover = ''

    if (apiKey) {
      try {
        const coverData = await fetchCoverFromSteamGridDB(apiKey, sGame.title)
        if (coverData) {
          art_square = coverData.art_square
          art_cover = coverData.art_cover
        }
      } catch (err) {
        logError([`Failed fetching SteamGridDB cover for Steam game ${sGame.title}:`, err])
      }
    }

    const app_name = short.generate().toString()
    try {
      addNewApp({
        app_name,
        title: sGame.title,
        runner: 'sideload',
        install: {
          executable: sGame.executable,
          platform: 'windows',
          is_dlc: false
        },
        art_cover,
        art_square,
        is_installed: true,
        canRunOffline: true
      })

      const gameConfig = GameConfig.get(app_name)
      gameConfig.resetToDefaults()

      const matchedRule = loadedRules.known_games.find(rule => 
        sGame.title.toLowerCase().includes(rule.displayNamePattern.toLowerCase())
      )
      if (matchedRule && matchedRule.targetExe) {
        gameConfig.setSetting('targetExe', join(dirname(sGame.executable), matchedRule.targetExe))
      }

      addedGames.push(sGame.title)
      logInfo(`Automatically added detected Steam game: ${sGame.title} (${sGame.executable})`)
    } catch (err) {
      logError([`Failed to add Steam game ${sGame.title}:`, err])
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

  logInfo(`Starting registry scan for discovering installed games... Loaded ${loadedRules.blacklisted_titles.length} blacklisted titles and ${loadedRules.blacklisted_exes.length} blacklisted exes.`)

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

    // Heuristic and database filters to skip non-game software
    const titleLower = title.toLowerCase()
    if (NON_GAME_KEYWORDS.some(k => titleLower.includes(k))) continue
    if (loadedRules.blacklisted_titles.some(k => titleLower.includes(k.toLowerCase()))) continue

    const matchedRule = loadedRules.known_games.find(rule => 
      titleLower.includes(rule.displayNamePattern.toLowerCase())
    )

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
      const filtered = exeCandidates.filter(path => isCandidateExeValid(path, title, matchedRule, true))

      if (filtered.length === 0) continue

      // Try to find preferred_exe first
      if (matchedRule) {
        const preferred = filtered.find(path => 
          basename(path).toLowerCase() === matchedRule.preferred_exe.toLowerCase()
        )
        if (preferred) {
          executablePath = preferred
        }
      }

      if (!executablePath) {
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

  // Discover and merge Steam games
  const steamGames = await discoverSteamGames()
  for (const sGame of steamGames) {
    const alreadyInCandidates = candidates.some(c => c.executable.toLowerCase() === sGame.executable.toLowerCase())
    if (alreadyInCandidates) continue

    const existingGame = alreadySideloaded.find(g => isDuplicateGame(g, sGame.title, sGame.executable))
    if (existingGame) {
      if ((!existingGame.art_cover || existingGame.art_cover.includes('heroic-icon.svg') || existingGame.art_cover.includes('heroic_card.jpg')) && apiKey) {
        try {
          const coverData = await fetchCoverFromSteamGridDB(apiKey, sGame.title)
          if (coverData) {
            existingGame.art_square = coverData.art_square
            existingGame.art_cover = coverData.art_cover
            libraryStore.set('games', alreadySideloaded)
            sendFrontendMessage('refreshLibrary', 'sideload')
            logInfo(`Automatically updated missing cover for existing Steam game: ${sGame.title}`)
          }
        } catch (err) {
          logError([`Failed fetching missing SteamGridDB cover for existing Steam game ${sGame.title}:`, err])
        }
      }
      continue
    }

    const isBlacklisted = blacklist.some(
      b => isDuplicateGame({ title: b.title, install: { executable: b.executable } }, sGame.title, sGame.executable)
    )
    if (isBlacklisted) continue

    let art_square = ''
    let art_cover = ''

    if (apiKey) {
      try {
        const coverData = await fetchCoverFromSteamGridDB(apiKey, sGame.title)
        if (coverData) {
          art_square = coverData.art_square
          art_cover = coverData.art_cover
        }
      } catch (err) {
        logError([`Failed fetching SteamGridDB cover for Steam game ${sGame.title}:`, err])
      }
    }

    candidates.push({
      title: sGame.title,
      executable: sGame.executable,
      art_cover,
      art_square
    })
  }

  return candidates
}

export function getDrives(): string[] {
  try {
    // 1. Try modern PowerShell method (supported on Win 10 & 11, robust and handles ready status)
    const output = execSync('powershell -Command "[System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady } | Select-Object -ExpandProperty Name"', { encoding: 'utf8', timeout: 3000 })
    const drives = output.split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => /^[A-Z]:\\$/.test(line))
    if (drives.length > 0) {
      return drives
    }
  } catch {}

  try {
    // 2. Fallback to wmic (if available)
    const output = execSync('wmic logicaldisk get name', { encoding: 'utf8', timeout: 3000 })
    const drives = output.split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => /^[A-Z]:$/.test(line))
      .map(drive => drive + '\\')
    if (drives.length > 0) {
      return drives
    }
  } catch {}

  return ['C:\\']
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
  'common files',
  'emuladores',
  'emulators',
  'retrobat',
  'hyperspin',
  'es-de',
  'retroarch',
  'programdata',
  'downloads'
])

function getGameTitleFromPath(exePath: string): string {
  const parts = exePath.split(/[\\/]/).filter(Boolean)
  if (parts.length < 2) {
    return 'Unknown Game'
  }
  
  const ROOT_CATEGORIES = new Set([
    'games',
    'jogos',
    'program files',
    'program files (x86)',
    'programdata',
    'epic games',
    'steamlibrary',
    'steamapps',
    'common',
    'riot games',
    'riotgames',
    'ubisoft game launcher',
    'ea games',
    'gog galaxy',
    'gog games',
    'xboxgames',
    'origin games'
  ])

  for (let i = 1; i < parts.length - 1; i++) {
    const lowerPart = parts[i].toLowerCase()
    if (
      !ROOT_CATEGORIES.has(lowerPart) &&
      !lowerPart.includes('games') &&
      !lowerPart.includes('jogos') &&
      !lowerPart.includes('backups') &&
      !lowerPart.includes('programas') &&
      !lowerPart.includes('downloads')
    ) {
      return parts[i]
    }
  }

  return parts[parts.length - 2] || 'Unknown Game'
}

async function findExecutableInFolder(
  folderPath: string,
  exeName: string,
  currentDepth = 1,
  maxDepth = 20
): Promise<string | null> {
  if (currentDepth > maxDepth) return null
  try {
    const items = await readdir(folderPath)
    const subdirs: string[] = []
    
    // First, check if the executable is directly in the folder
    for (const item of items) {
      const fullPath = join(folderPath, item)
      try {
        const stats = await stat(fullPath)
        if (stats.isFile() && item.toLowerCase() === exeName.toLowerCase()) {
          return fullPath
        } else if (stats.isDirectory()) {
          const lowerName = item.toLowerCase()
          if (!IGNORED_DIR_NAMES.has(lowerName) && !lowerName.startsWith('.')) {
            subdirs.push(fullPath)
          }
        }
      } catch {}
    }

    // If not found, check subdirectories
    for (const subdir of subdirs) {
      const found = await findExecutableInFolder(subdir, exeName, currentDepth + 1, maxDepth)
      if (found) return found
    }
  } catch {}
  return null
}

async function scanDirectoryForGamesAsync(
  dir: string,
  searchTerms: string[] | undefined,
  depth: number,
  maxDepth: number,
  results: GameCandidate[]
): Promise<void> {
  if (depth > maxDepth) return

  // Fast directory-name rule matching optimization
  try {
    const dirName = basename(dir)
    const dirNameLower = dirName.toLowerCase()
    const isDriveRoot = dir.endsWith(':\\') || dir.endsWith(':/') || dir === '/'
    
    if (!isDriveRoot && !IGNORED_DIR_NAMES.has(dirNameLower) && !dirNameLower.startsWith('.')) {
      if (!loadedRules.blacklisted_titles.some(k => dirNameLower.includes(k.toLowerCase()))) {
        const matchedRule = loadedRules.known_games.find(rule => 
          dirNameLower.includes(rule.displayNamePattern.toLowerCase())
        )

        if (matchedRule && matchedRule.preferred_exe) {
          const exePath = await findExecutableInFolder(dir, matchedRule.preferred_exe)
          if (exePath) {
            const title = getGameTitleFromPath(exePath)
            const titleLower = title.toLowerCase()

            let passesSearch = true
            if (searchTerms && searchTerms.length > 0) {
              passesSearch = searchTerms.some(term => {
                return titleLower.includes(term) || basename(exePath).toLowerCase().includes(term)
              })
            }

            if (passesSearch) {
              if (!results.some(r => r.executable === exePath)) {
                results.push({
                  title,
                  executable: exePath,
                  art_cover: '',
                  art_square: ''
                })
              }
              // Found the preferred game executable, skip scanning subdirectories
              return
            }
          }
        }
      }
    }
  } catch (err) {
    logError([`Error during directory-name matching optimization for ${dir}:`, err])
  }

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
          
          // Check if we are directly inside Program Files / Program Files (x86)
          const dirLower = dir.toLowerCase()
          const isInsideProgramFiles = dirLower.endsWith('program files') || dirLower.endsWith('program files (x86)')
          
          if (isInsideProgramFiles) {
            // Whitelisted game launcher subdirectories to descend into
            const ALLOWED_PROGRAM_FILES_SUBDIRS = new Set([
              'epic games',
              'gog galaxy',
              'gog games',
              'steam',
              'steamapps',
              'common',
              'ubisoft',
              'ubisoft game launcher',
              'ea games',
              'origin games',
              'rockstar games',
              'riot games',
              'riotgames',
              'xboxgames'
            ])
            
            // If it is in the whitelist, or matches searchTerms, descend
            const matchesSearch = searchTerms && searchTerms.length > 0 && searchTerms.some(term => lowerName.includes(term))
            if (!ALLOWED_PROGRAM_FILES_SUBDIRS.has(lowerName) && !matchesSearch) {
              continue
            }
          } else {
            // General ignore check for other directories
            if (IGNORED_DIR_NAMES.has(lowerName) || lowerName.startsWith('.')) {
              // If searchTerms are active and matches this ignored directory name, we can override and scan it
              const matchesSearch = searchTerms && searchTerms.length > 0 && searchTerms.some(term => lowerName.includes(term))
              if (!matchesSearch) {
                continue
              }
            }
          }
          subdirs.push(fullPath)
        } else if (stats.isFile() && item.toLowerCase().endsWith('.exe')) {
          exes.push(fullPath)
        }
      } catch {}
    }

    for (const exePath of exes) {
      const fileName = basename(exePath).toLowerCase()
      const title = getGameTitleFromPath(exePath)
      const titleLower = title.toLowerCase()

      // Rules-based blacklist check for directory scan folder names
      if (loadedRules.blacklisted_titles.some(k => titleLower.includes(k.toLowerCase()))) {
        continue
      }

      // Rules-based ignore_exes check for directory scan
      const matchedRule = loadedRules.known_games.find(rule => 
        titleLower.includes(rule.displayNamePattern.toLowerCase())
      )

      // Run smart validator
      const bypassStrict = !!(searchTerms && searchTerms.length > 0)
      if (!isCandidateExeValid(exePath, title, matchedRule, bypassStrict)) {
        continue
      }

      if (searchTerms && searchTerms.length > 0) {
        const matchesSearch = searchTerms.some(term => {
          return titleLower.includes(term) || fileName.includes(term)
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
      await scanDirectoryForGamesAsync(subdir, searchTerms, depth + 1, maxDepth, results)
    }
  } catch {}
}

export async function discoverAllGames(searchTitles?: string[], selectedDrives?: string[]): Promise<GameCandidate[]> {
  if (process.platform !== 'win32') {
    return []
  }

  // Normalize search terms: split by commas and/or semicolons, lowercase, and trim
  const searchTerms: string[] = []
  if (searchTitles) {
    const rawTerms = Array.isArray(searchTitles) ? searchTitles : [searchTitles]
    for (const term of rawTerms) {
      if (typeof term === 'string') {
        const parts = term.split(/[;,]/)
        for (const p of parts) {
          const cleaned = p.toLowerCase().trim()
          if (cleaned) {
            searchTerms.push(cleaned)
          }
        }
      }
    }
  }

  const drivesToScan = selectedDrives && selectedDrives.length > 0 ? selectedDrives : getDrives()
  logInfo(`Starting PC scan for games on drives: ${drivesToScan.join(', ')}... Search terms: ${searchTerms.join(', ') || 'None'}`)

  const results: GameCandidate[] = []

  // 1. Retrieve Steam and Windows Registry installed games
  try {
    const installed = await discoverInstalledGames()
    
    // Filter them by search titles if searchTitles is provided
    const filteredInstalled = installed.filter(game => {
      if (searchTerms.length === 0) return true
      return searchTerms.some(term => {
        const fileName = basename(game.executable).toLowerCase()
        return game.title.toLowerCase().includes(term) || fileName.includes(term)
      })
    })

    // Add them to results
    for (const game of filteredInstalled) {
      if (!results.some(r => r.executable.toLowerCase() === game.executable.toLowerCase())) {
        results.push(game)
      }
    }
  } catch (err) {
    logError([`Failed to fetch installed games during discoverAllGames:`, err])
  }

  // 2. Perform the directory scan to discover loose/DRM-free games
  for (const drive of drivesToScan) {
    await scanDirectoryForGamesAsync(drive, searchTerms, 1, 8, results)
  }

  const alreadySideloaded = libraryStore.get('games', [])
  const blacklist: Array<{ title: string; executable: string }> = libraryStore.get('blacklist', [])

  const filteredResults = results.filter(candidate => {
    const isAdded = alreadySideloaded.some(g => isDuplicateGame(g, candidate.title, candidate.executable))
    const isBlacklisted = blacklist.some(b => isDuplicateGame({ title: b.title, install: { executable: b.executable } }, candidate.title, candidate.executable))
    return !isAdded && !isBlacklisted
  })

  const apiKey = getApiKey()
  if (apiKey) {
    const fetchPromises = filteredResults.slice(0, 50).map(async (candidate) => {
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

  return filteredResults
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

      // Save targetExe override if matched
      const titleLower = game.title.toLowerCase()
      const matchedRule = loadedRules.known_games.find(rule => 
        titleLower.includes(rule.displayNamePattern.toLowerCase())
      )
      if (matchedRule && matchedRule.targetExe) {
        gameConfig.setSetting('targetExe', join(dirname(game.executable), matchedRule.targetExe))
      }

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
