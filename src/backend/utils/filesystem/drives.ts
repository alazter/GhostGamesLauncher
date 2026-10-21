import { execSync } from 'child_process'
import { existsSync, statfsSync } from 'graceful-fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import type { StorageDrive } from 'common/types/ipc'
import type { Runner } from 'common/types'
import { SteamDownloader } from '../../storeManagers/steam/downloader'
import { configStore } from '../../constants/key_value_stores'

export async function getFolderSize(folderPath: string): Promise<number> {
  if (!folderPath || !existsSync(folderPath)) return 0
  let totalBytes = 0
  let filesVisited = 0
  const maxFiles = 50000

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > 12 || filesVisited >= maxFiles) return
    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (filesVisited >= maxFiles) break
      const fullPath = join(currentDir, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        filesVisited++
        try {
          const st = await stat(fullPath)
          totalBytes += st.size
        } catch {}
      }
    }
  }

  try {
    const rootStat = await stat(folderPath)
    if (rootStat.isFile()) return rootStat.size
    await walk(folderPath, 0)
  } catch {}

  return totalBytes
}

let cachedVolumeLabels: Record<string, string> = {}
let lastLabelsFetch = 0

function getVolumeLabels(): Record<string, string> {
  const now = Date.now()
  if (Object.keys(cachedVolumeLabels).length > 0 && now - lastLabelsFetch < 60000) {
    return cachedVolumeLabels
  }

  if (process.platform === 'win32') {
    try {
      const psCommand =
        'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName | ConvertTo-Json'
      const output = execSync(`powershell -NoProfile -Command "${psCommand}"`, {
        windowsHide: true,
        timeout: 3000
      })
        .toString()
        .trim()
      if (output) {
        const parsed = JSON.parse(output)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          if (item.DeviceID) {
            cachedVolumeLabels[item.DeviceID.toUpperCase()] =
              item.VolumeName?.trim() || 'Disco Local'
          }
        }
        lastLabelsFetch = now
      }
    } catch {}
  }
  return cachedVolumeLabels
}

export async function getAvailableStorageDrives(
  runner?: Runner
): Promise<StorageDrive[]> {
  const drives: StorageDrive[] = []
  const isWindows = process.platform === 'win32'

  if (isWindows) {
    const labels = getVolumeLabels()
    const seenLetters = new Set<string>()
    const userConfiguredPaths = configStore.get_nodefault('moveGameDrivePaths') || {}

    // 1. Para jogos da Steam, incluir bibliotecas do libraryfolders.vdf primeiro
    if (runner === 'steam') {
      try {
        const steamLibraries = await SteamDownloader.getSteamLibraryFolders()
        for (const libPath of steamLibraries) {
          const letter = libPath.substring(0, 2).toUpperCase()
          const root = `${letter}\\`
          let freeSpace = 0
          let totalSpace = 0
          try {
            const stats = statfsSync(root)
            freeSpace = stats.bfree * stats.bsize
            totalSpace = stats.blocks * stats.bsize
          } catch {}

          const label = labels[letter] || 'Disco Local'
          const userCustomPath = userConfiguredPaths[letter]?.trim()
          const targetPath = userCustomPath || join(libPath, 'steamapps', 'common')

          drives.push({
            letter,
            label,
            name: `${label} (${letter})`,
            freeSpace,
            totalSpace,
            path: targetPath
          })
          seenLetters.add(letter)
        }
      } catch (err) {
        console.error('Error resolving Steam library folders:', err)
      }
    }

    // 2. Detectar todos os drives montados no sistema (C:..Z:)
    const letters = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    for (const char of letters) {
      const letter = `${char}:`
      if (seenLetters.has(letter)) continue
      const root = `${letter}\\`
      if (existsSync(root)) {
        let freeSpace = 0
        let totalSpace = 0
        try {
          const stats = statfsSync(root)
          freeSpace = stats.bfree * stats.bsize
          totalSpace = stats.blocks * stats.bsize
        } catch {}

        const label = labels[letter] || 'Disco Local'
        const userCustomPath = userConfiguredPaths[letter]?.trim()
        let targetPath =
          userCustomPath ||
          (runner === 'steam'
            ? join(letter, 'SteamLibrary', 'steamapps', 'common')
            : join(letter, 'Games', 'Ghost'))
        if (!userCustomPath) {
          if (existsSync(join(letter, 'SteamLibrary', 'steamapps', 'common'))) {
            targetPath = join(letter, 'SteamLibrary', 'steamapps', 'common')
          } else if (existsSync(join(letter, 'Steam', 'steamapps', 'common'))) {
            targetPath = join(letter, 'Steam', 'steamapps', 'common')
          }
        }

        drives.push({
          letter,
          label,
          name: `${label} (${letter})`,
          freeSpace,
          totalSpace,
          path: targetPath
        })
      }
    }
  } else {
    const userHome = process.env.USERPROFILE || process.env.HOME || ''
    drives.push({
      letter: '/',
      label: 'Home',
      name: 'Armazenamento Principal',
      freeSpace: 0,
      totalSpace: 0,
      path: join(userHome, 'Games', 'Ghost')
    })
  }

  return drives
}
