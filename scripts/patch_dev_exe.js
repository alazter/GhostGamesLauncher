const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronDir = path.join(__dirname, '../node_modules/electron');
const pathFile = path.join(electronDir, 'path.txt');
const electronExe = path.join(electronDir, 'dist/electron.exe');
const rceditExe = path.join(__dirname, 'rcedit.exe');
const iconIco = path.join(__dirname, '../public/win_icon.ico');
const stampFile = path.join(electronDir, 'dist/.ghost_patched');

// Auto-cura do binário Electron se path.txt ou electron.exe estiverem ausentes
if (!fs.existsSync(pathFile) || !fs.existsSync(electronExe)) {
  try {
    console.log('[Ghost Dev] Binário do Electron não detectado em node_modules. Instalando automaticamente...');
    require('electron');
  } catch (err) {
    console.error('[Ghost Dev] Falha ao auto-instalar binário do Electron:', err);
  }
}

if (process.platform === 'win32' && fs.existsSync(electronExe) && fs.existsSync(iconIco)) {
  if (fs.existsSync(rceditExe) && !fs.existsSync(stampFile)) {
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
      fs.writeFileSync(stampFile, Date.now().toString(), 'utf8');
    } catch {}
  }
}
