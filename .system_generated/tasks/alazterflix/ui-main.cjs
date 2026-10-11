const { app, BrowserWindow, nativeImage } = require('electron')
const path = require('path')
app.setPath('userData', path.join(__dirname, 'isolated-userdata'))
app.disableHardwareAcceleration()
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, width: 1560, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } })
  win.loadFile(path.join(__dirname, 'ui.html'))
  const png = nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 }).toPNG()
  const image = nativeImage.createFromBuffer(png)
  global.smokeNativeImage = { valid: !image.isEmpty(), jpegMagic: image.toJPEG(92).subarray(0, 3).toString('hex') }
})
app.on('window-all-closed', () => app.quit())
