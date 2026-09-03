import { app, shell } from 'electron'
import { existsSync, readdirSync } from 'graceful-fs'
import path from 'path'
import { exec } from 'child_process'
import { isWindows, isMac } from './constants/environment'
import { logInfo, logError, LogPrefix } from './logger'

/**
 * Resolves the permanent executable of Ghost Games Launcher.
 * Prevents ephemeral paths (such as extracted Temp folders for Portable builds)
 * from being mistakenly registered into Windows startup.
 */
export function getPermanentAppExecutable(): string {
  if (!isWindows) {
    return process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')
  }

  // 1. If PORTABLE_EXECUTABLE_FILE is set by electron-builder and physically exists, use it
  if (
    process.env.PORTABLE_EXECUTABLE_FILE &&
    existsSync(process.env.PORTABLE_EXECUTABLE_FILE)
  ) {
    return process.env.PORTABLE_EXECUTABLE_FILE
  }

  const currentExe = app.getPath('exe')
  const lowerCurrentExe = currentExe.toLowerCase()
  const isTempPath =
    lowerCurrentExe.includes('\\appdata\\local\\temp\\') ||
    lowerCurrentExe.includes('/temp/')

  // 2. If the current executable is not in Temp, it is a permanent installation/build
  if (!isTempPath) {
    return currentExe
  }

  // 3. If running from Temp without PORTABLE_EXECUTABLE_FILE (e.g. nested extraction),
  // search well-known install locations or desktop/start menu shortcuts
  try {
    const desktopShortcut = path.join(
      app.getPath('desktop'),
      'Ghost Games Launcher.lnk'
    )
    if (existsSync(desktopShortcut)) {
      const resolved = shell.readShortcutLink(desktopShortcut)
      if (
        resolved.target &&
        existsSync(resolved.target) &&
        resolved.target.toLowerCase().endsWith('.exe')
      ) {
        return resolved.target
      }
    }
  } catch {}

  try {
    const programsDir = path.join(
      app.getPath('appData'),
      '..',
      'Local',
      'Programs',
      'Ghost Games Launcher'
    )
    if (existsSync(programsDir)) {
      const files = readdirSync(programsDir) as string[]
      const ghostExe = files.find(
        (f) =>
          f.toLowerCase().endsWith('.exe') && f.toLowerCase().includes('ghost')
      )
      if (ghostExe) {
        return path.join(programsDir, ghostExe)
      }
    }
  } catch {}

  return currentExe
}

/**
 * Synchronizes Ghost's startup registration across platforms (Windows / macOS).
 * Ensures clean registry state, unblocks Task Manager disable blocks on Windows,
 * and handles development mode safely without wiping the user's permanent launcher.
 */
export function syncAutoStartSettings(
  openAtLogin: boolean,
  startInTray: boolean
): void {
  if (isMac) {
    try {
      app.setLoginItemSettings({
        openAtLogin,
        openAsHidden: startInTray,
        args: startInTray ? ['--hidden'] : []
      })
      logInfo(
        `macOS login item settings updated (openAtLogin: ${openAtLogin}, startInTray: ${startInTray})`,
        LogPrefix.Backend
      )
    } catch (err) {
      logError(
        `Failed to update macOS login item settings: ${err}`,
        LogPrefix.Backend
      )
    }
    return
  }

  if (!isWindows) {
    return
  }

  const permanentExe = getPermanentAppExecutable()
  const lowerExe = permanentExe.toLowerCase()
  const isDevOrNodeModules =
    !app.isPackaged ||
    lowerExe.includes('node_modules') ||
    lowerExe.includes('electron.exe')

  // In dev mode (pnpm start), only clean up dev/electron registry entries
  // NEVER wipe out the user's real installed/portable Ghost launcher
  if (isDevOrNodeModules) {
    try {
      exec(
        'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Electron" /f',
        () => {}
      )
    } catch {}
    return
  }

  // Always delete legacy/conflicting keys to prevent collisions
  try {
    exec(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "com.ghostgameslauncher.ghost" /f',
      () => {}
    )
    exec(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Electron" /f',
      () => {}
    )
  } catch {}

  if (openAtLogin) {
    // If the path is still in Temp (could not resolve permanent exe), do not register ephemeral path
    if (
      lowerExe.includes('\\appdata\\local\\temp\\') ||
      lowerExe.includes('/temp/')
    ) {
      logError(
        'Cannot register Windows autostart: executable is running from temporary folder without permanent reference.',
        LogPrefix.Backend
      )
      return
    }

    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        name: 'Ghost Games Launcher',
        path: permanentExe,
        args: startInTray ? ['--hidden'] : []
      })

      // Unblock any stale "Disabled" flag in Windows Task Manager (StartupApproved\\Run)
      exec(
        'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run" /v "Ghost Games Launcher" /f',
        () => {}
      )
      exec(
        'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run" /v "com.ghostgameslauncher.ghost" /f',
        () => {}
      )

      logInfo(
        `Windows autostart enabled: "${permanentExe}" (startInTray: ${startInTray})`,
        LogPrefix.Backend
      )
    } catch (err) {
      logError(`Failed to enable Windows autostart: ${err}`, LogPrefix.Backend)
    }
  } else {
    try {
      app.setLoginItemSettings({
        openAtLogin: false,
        name: 'Ghost Games Launcher',
        path: permanentExe
      })
      exec(
        'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Ghost Games Launcher" /f',
        () => {}
      )
      logInfo('Windows autostart disabled', LogPrefix.Backend)
    } catch (err) {
      logError(`Failed to disable Windows autostart: ${err}`, LogPrefix.Backend)
    }
  }
}
