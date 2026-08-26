const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rceditExe = path.join(__dirname, 'rcedit.exe');
const electronExe = path.join(__dirname, '../node_modules/electron/dist/electron.exe');
const iconIco = path.join(__dirname, '../public/win_icon.ico');

if (process.platform === 'win32' && fs.existsSync(electronExe) && fs.existsSync(iconIco)) {
  if (fs.existsSync(rceditExe)) {
    try {
      spawnSync(
        rceditExe,
        [
          electronExe,
          '--set-icon',
          iconIco,
          '--set-version-string',
          'FileDescription',
          'Ghost Games Launcher',
          '--set-version-string',
          'ProductName',
          'Ghost Games Launcher',
          '--set-version-string',
          'InternalName',
          'Ghost Games Launcher',
          '--set-version-string',
          'CompanyName',
          'Ghost Games Launcher'
        ],
        { stdio: 'ignore' }
      );
    } catch {}
  }
}
