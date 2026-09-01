import { execSync } from 'child_process'
import { existsSync, readFileSync, statfsSync } from 'graceful-fs'
import { join } from 'path'
import type { StorageDrive } from 'common/types/ipc'
import type { Runner } from 'common/types'
import { SteamDownloader } from '../../storeManagers/steam/downloader'

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

    // 1. Para jogos da Steam, ler o libraryfolders.vdf atualizado dinamicamente
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
          const targetPath = join(libPath, 'steamapps', 'common')

          drives.push({
            letter,
            label,
            name: `${label} (${letter})`,
            freeSpace,
            totalSpace,
            path: targetPath
          })
        }
        return drives
      } catch (err) {
        console.error('Error resolving Steam library folders:', err)
      }
    }

    // 2. Para jogos independentes / outros launchers, detectar todos os drives montados
    const letters = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    for (const char of letters) {
      const letter = `${char}:`
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
        let targetPath = join(letter, 'Games', 'Ghost')
        if (existsSync(join(letter, 'SteamLibrary', 'steamapps', 'common'))) {
          targetPath = join(letter, 'SteamLibrary', 'steamapps', 'common')
        } else if (existsSync(join(letter, 'Steam', 'steamapps', 'common'))) {
          targetPath = join(letter, 'Steam', 'steamapps', 'common')
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
