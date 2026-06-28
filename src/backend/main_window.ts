import { AppSettings, WindowProps } from 'common/types'
import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { configStore } from './constants/key_value_stores'
import { windowIcon } from './constants/paths'

let mainWindow: BrowserWindow | null = null

export const getMainWindow = () => {
  if (mainWindow) return mainWindow
  return BrowserWindow.getAllWindows().at(0)
}

let windowProps: WindowProps | null = null

export const isFrameless = () => {
  return windowProps?.frame === false || windowProps?.titleBarStyle === 'hidden'
}

// creates the mainWindow based on the configuration
export const createMainWindow = () => {
  let props = {
    height: 690,
    width: 1200,
    x: 0,
    y: 0,
    maximized: false
  } as WindowProps

  if (configStore.has('window-props')) {
    props = configStore.get('window-props', props)
    // Fix Windows minimized/offscreen bounds bug (e.g. x/y = -32000 or tiny dimensions)
    if (
      props.x === -32000 ||
      props.y === -32000 ||
      props.width < 100 ||
      props.height < 100
    ) {
      props.x = 0
      props.y = 0
      props.width = 1200
      props.height = 690
      props.maximized = false
    }

    // Ensure window is placed within bounds of currently connected displays
    const displays = screen.getAllDisplays()
    const isVisible = displays.some((display) => {
      const bounds = display.bounds
      return (
        props.x >= bounds.x &&
        props.x < bounds.x + bounds.width &&
        props.y >= bounds.y &&
        props.y < bounds.y + bounds.height
      )
    })
    if (!isVisible) {
      props.x = 0
      props.y = 0
    }
  } else {
    // make sure initial screen size is not bigger than the available screen space
    const screenInfo = screen.getPrimaryDisplay()

    if (screenInfo?.workAreaSize?.height < props.height) {
      props.height = screenInfo.workAreaSize.height * 0.8
    }

    if (screenInfo?.workAreaSize?.width < props.width) {
      props.width = screenInfo.workAreaSize.width * 0.8
    }
  }

  // Set up frameless window if enabled in settings
  const settings = configStore.get('settings', <AppSettings>{})
  if (settings?.framelessWindow) {
    // use native overlay controls where supported
    if (['darwin', 'win32'].includes(process.platform)) {
      props.titleBarStyle = 'hidden'
      props.titleBarOverlay = true
    } else {
      props.frame = false
    }
  }

  windowProps = props

  // Create the browser window.
  mainWindow = new BrowserWindow({
    ...props,
    icon: windowIcon,
    minHeight: 345,
    minWidth: 600,
    show: false,

    webPreferences: {
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: true,
      // sandbox: false,
      preload: path.join(__dirname, '../preload/index.js')
    }
  })

  return mainWindow
}
