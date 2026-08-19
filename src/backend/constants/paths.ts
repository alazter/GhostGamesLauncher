import { app, nativeImage, NativeImage } from 'electron'
import { mkdirSync } from 'graceful-fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { env } from 'process'
import { dirSync } from 'tmp'
import { isWindows } from './environment'

let configFolder = app.getPath('appData')
// If we're running tests, we want a config folder independent of the normal
// user configuration
if (process.env.CI === 'e2e') {
  const temp_dir = dirSync({ unsafeCleanup: true })
  console.log(
    `CI is set to "e2e", storing Ghost config files in ${temp_dir.name}`
  )
  configFolder = temp_dir.name
  mkdirSync(join(configFolder, 'ghost'))
}

export const flatpakHome = env.XDG_DATA_HOME?.replace('/data', '') || homedir()
export const userHome = homedir()

export const appFolder = join(configFolder, 'ghost')
export const userDataPath = app.getPath('userData')
export const toolsPath = join(appFolder, 'tools')
export const runtimePath = join(toolsPath, 'runtimes')
export const defaultUmuPath = join(runtimePath, 'umu', 'umu_run.py')
export const configPath = join(appFolder, 'config.json')
export const gamesConfigPath = join(appFolder, 'GamesConfig')
export const heroicIconFolder = join(appFolder, 'icons')
export const heroicInstallPath = join(userHome, 'Games', 'Ghost')
export const defaultWinePrefixDir = join(
  userHome,
  'Games',
  'Ghost',
  'Prefixes'
)
export const sharedWinePrefix = join(defaultWinePrefixDir, 'shared')
export const defaultWinePrefix = join(defaultWinePrefixDir, 'default')
export const fixesPath = join(appFolder, 'fixes')

export const publicDir = resolve(
  __dirname,
  '..',
  app.isPackaged || process.env.CI === 'e2e' ? '' : '../public'
)

// Built preload scripts live next to the main process bundle
// (`build/preload/`). The webview preload is built from
// `src/webviewPreload/index.ts` — see `electron.vite.config.ts`.
const preloadDir = resolve(__dirname, '..', 'preload')

export const mainPreloadPath = join(preloadDir, 'index.js')

export const fakeEpicExePath = fixAsarPath(
  join(publicDir, 'bin', 'x64', 'win32', 'EpicGamesLauncher.exe')
)

export const galaxyCommunicationExePath = fixAsarPath(
  join(publicDir, 'bin', 'x64', 'win32', 'GalaxyCommunication.exe')
)

export const webviewPreloadPath = fixAsarPath(
  join('file://', preloadDir, 'webviewPreload.js')
)

/**
 * Fix path for packed files with asar, else will do nothing.
 * @param origin  original path
 * @returns fixed path
 */
export function fixAsarPath(origin: string): string {
  if (!origin.includes('app.asar.unpacked')) {
    return origin.replace('app.asar', 'app.asar.unpacked')
  }
  return origin
}

import { existsSync } from 'fs'

export const windowIcon = fixAsarPath(
  join(publicDir, isWindows ? 'win_icon.ico' : 'icon.png')
)

export function ensurePermanentAppIcon(): string {
  if (!isWindows) {
    return windowIcon
  }

  const permanentIconPath = join(userDataPath, 'win_icon.ico')
  const possibleSources = [
    join(process.resourcesPath || '', 'app.asar.unpacked', 'build', 'win_icon.ico'),
    join(process.resourcesPath || '', 'app.asar.unpacked', 'public', 'win_icon.ico'),
    windowIcon,
    join(publicDir, 'win_icon.ico'),
    join(app.getAppPath(), 'public', 'win_icon.ico'),
    join(app.getAppPath(), 'build', 'win_icon.ico'),
    resolve(__dirname, '..', 'public', 'win_icon.ico'),
    resolve(__dirname, '../..', 'public', 'win_icon.ico')
  ]

  for (const src of possibleSources) {
    if (src && existsSync(src)) {
      try {
        require('fs').copyFileSync(src, permanentIconPath)
        return permanentIconPath
      } catch {}
    }
  }

  if (existsSync(permanentIconPath)) {
    return permanentIconPath
  }

  return process.execPath
}

export function getAppNativeIcon(): NativeImage {
  const possiblePngSources = [
    join(publicDir, 'icon.png'),
    join(publicDir, 'icon-dark.png'),
    join(publicDir, 'logo.png'),
    join(app.getAppPath(), 'public', 'icon.png'),
    join(app.getAppPath(), 'build', 'icon.png'),
    join(process.resourcesPath || '', 'app.asar.unpacked', 'public', 'icon.png'),
    join(userDataPath, 'icon.png')
  ]

  for (const src of possiblePngSources) {
    if (src && existsSync(src)) {
      try {
        const img = nativeImage.createFromPath(src)
        if (!img.isEmpty()) {
          return img
        }
      } catch {}
    }
  }

  const icoPath = ensurePermanentAppIcon()
  return nativeImage.createFromPath(icoPath)
}
