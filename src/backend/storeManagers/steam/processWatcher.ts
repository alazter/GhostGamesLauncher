import { exec, spawnSync } from 'child_process'
import { promisify } from 'util'
import { existsSync, readdirSync } from 'graceful-fs'
import { join } from 'path'
import { isWindows } from 'backend/constants/environment'
import { LogPrefix, logInfo } from 'backend/logger'
import type LogWriter from 'backend/logger/log_writer'
import { killPattern } from 'backend/utils'

const execAsync = promisify(exec)

export interface ActiveProcess {
  pid: number
  exe: string
}

/**
 * Reads Steam's RunningAppID on Windows via registry query.
 * Runs in ~20ms and has negligible CPU overhead.
 */
export async function getSteamRunningAppId(): Promise<string | null> {
  if (!isWindows) {
    return null
  }

  try {
    const { stdout } = await execAsync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v RunningAppID'
    )
    const match = stdout.match(/RunningAppID\s+REG_DWORD\s+(0x[0-9a-fA-F]+)/i)
    if (match && match[1]) {
      const numeric = parseInt(match[1], 16)
      if (numeric > 0) {
        return numeric.toString()
      }
    }
  } catch {}

  return null
}

/**
 * Discovers game executables in the game installation directory up to 3 levels deep.
 */
export function findGameExecutables(installDir: string): string[] {
  if (!installDir || !existsSync(installDir)) {
    return []
  }

  const exes: string[] = []

  function scan(currentDir: string, depth: number) {
    if (depth > 3) return
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
          const low = entry.name.toLowerCase()
          if (
            !low.includes('unins') &&
            !low.includes('crash') &&
            !low.includes('reporter') &&
            !low.includes('vcredist') &&
            !low.includes('dxsetup')
          ) {
            exes.push(entry.name)
          }
        } else if (entry.isDirectory() && depth < 3) {
          const lowDir = entry.name.toLowerCase()
          if (
            !lowDir.startsWith('.') &&
            lowDir !== '_commonredist' &&
            lowDir !== 'redist' &&
            lowDir !== 'node_modules'
          ) {
            scan(join(currentDir, entry.name), depth + 1)
          }
        }
      }
    } catch {}
  }

  scan(installDir, 0)
  return [...new Set(exes)]
}

/**
 * Scans currently running processes matching the game executables on Windows.
 */
export async function findActiveGameProcesses(
  executables: string[]
): Promise<ActiveProcess[]> {
  if (!isWindows || !executables.length) {
    return []
  }

  const active: ActiveProcess[] = []

  for (const exe of executables) {
    try {
      const { stdout } = await execAsync(
        `tasklist /FO CSV /NH /FI "IMAGENAME eq ${exe}"`
      )
      if (stdout && !stdout.includes('No tasks are running')) {
        const lines = stdout.trim().split('\n')
        for (const line of lines) {
          const parts = line
            .split('","')
            .map((p) => p.replace(/"/g, '').trim())
          if (parts.length >= 2) {
            const exeName = parts[0]
            const pid = parseInt(parts[1], 10)
            if (pid && !isNaN(pid)) {
              active.push({ pid, exe: exeName })
            }
          }
        }
      }
    } catch {}
  }

  return active
}

/**
 * Terminates all tracked game processes using taskkill and killPattern.
 */
export async function killSteamGameProcesses(
  pids: number[],
  executables: string[]
): Promise<void> {
  logInfo(
    `Terminating Steam game processes: PIDs [${pids.join(', ')}]`,
    LogPrefix.Steam
  )

  for (const pid of pids) {
    try {
      if (isWindows) {
        spawnSync('taskkill', ['/F', '/T', '/PID', pid.toString()])
      } else {
        spawnSync('kill', ['-9', pid.toString()])
      }
    } catch {}
  }

  for (const exe of executables) {
    try {
      killPattern(exe)
    } catch {}
  }
}

/**
 * Monitors the Steam game session from launch until process exit or user cancellation.
 * Resolves only when the game has exited, allowing launcher.ts to accurately compute playtime.
 */
export async function watchSteamGameSession(options: {
  appId: string
  gameTitle: string
  installDir: string
  logWriter?: LogWriter
  isStoppingRequested: () => boolean
  onProcessDetected?: (pids: number[]) => void
}): Promise<boolean> {
  const { appId, gameTitle, installDir, logWriter, isStoppingRequested, onProcessDetected } =
    options

  const startTime = new Date()
  const header = [
    '================================================================================',
    'GHOST GAMES LAUNCHER - STEAM GAME LAUNCH & MONITORING SESSION',
    '================================================================================',
    `Game:               ${gameTitle}`,
    `Steam App ID:       ${appId}`,
    `Runner:             steam`,
    `Install Directory:  ${installDir || 'N/A'}`,
    `Launch Protocol:    steam://rungameid/${appId}`,
    `Session Start:      ${startTime.toISOString()}`,
    '================================================================================\n'
  ].join('\n')

  await logWriter?.writeString(header, true)

  const exes = findGameExecutables(installDir)
  if (exes.length) {
    await logWriter?.writeString(
      `[INFO] Discovered ${exes.length} potential executable(s): ${exes.join(', ')}`,
      true
    )
  }

  await logWriter?.writeString(
    '[INFO] Invoking Steam protocol. Awaiting game process startup...',
    true
  )

  const trackedPids = new Set<number>()
  let isGameRunning = false

  // 1. Grace period: wait up to 60 seconds for game startup
  const maxStartupAttempts = 40 // 40 * 1.5s = 60s
  for (let i = 0; i < maxStartupAttempts; i++) {
    if (isStoppingRequested()) {
      await logWriter?.writeString(
        '[INFO] Launch aborted by user before game started.',
        true
      )
      return true
    }

    const runningAppId = await getSteamRunningAppId()
    const active = await findActiveGameProcesses(exes)

    if (runningAppId === appId || active.length > 0) {
      isGameRunning = true
      for (const p of active) {
        trackedPids.add(p.pid)
      }
      if (onProcessDetected) {
        onProcessDetected([...trackedPids])
      }

      const pidsStr = [...trackedPids].length
        ? `Tracked PIDs: ${[...trackedPids].join(', ')}`
        : 'Active via Steam RunningAppID'
      await logWriter?.writeString(
        `[INFO] Game detected as running! (${pidsStr}). Starting active monitoring session...`,
        true
      )
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  if (!isGameRunning) {
    await logWriter?.writeString(
      '[WARNING] Game process was not detected within 60 seconds. Finalizing monitoring session.',
      true
    )
    return true
  }

  // 2. Active monitoring loop: checks every 2.5 seconds
  while (true) {
    if (isStoppingRequested()) {
      await logWriter?.writeString(
        '[INFO] Force-stop signal received from Ghost Launcher. Terminating game...',
        true
      )
      await killSteamGameProcesses([...trackedPids], exes)
      await logWriter?.writeString(
        '[INFO] Game terminated successfully by user.',
        true
      )
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 2500))

    const runningAppId = await getSteamRunningAppId()
    const active = await findActiveGameProcesses(exes)

    for (const p of active) {
      trackedPids.add(p.pid)
    }
    if (onProcessDetected) {
      onProcessDetected([...trackedPids])
    }

    const isStillActive = runningAppId === appId || active.length > 0

    if (!isStillActive) {
      // Buffer check (2.5s) to prevent false exit during launcher-to-game handover
      await new Promise((resolve) => setTimeout(resolve, 2500))
      const recheckAppId = await getSteamRunningAppId()
      const recheckActive = await findActiveGameProcesses(exes)

      if (recheckAppId === appId || recheckActive.length > 0) {
        continue
      }

      const endTime = new Date()
      const elapsedMinutes = (
        (endTime.getTime() - startTime.getTime()) /
        1000 /
        60
      ).toFixed(1)
      await logWriter?.writeString(
        `[INFO] Game process exit detected. Total session duration: ${elapsedMinutes} minute(s).`,
        true
      )
      break
    }
  }

  return true
}
