const { app, BrowserWindow } = require('electron')
const path = require('path')
app.setPath('userData', path.join(__dirname, 'isolated-userdata'))
app.disableHardwareAcceleration()
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, width: 1500, height: 950,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } })
  win.loadFile(path.join(__dirname, 'ui.html'))
})
app.on('window-all-closed', () => app.quit())
