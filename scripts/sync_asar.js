const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const asarPath = path.resolve('dist/win-unpacked/resources/app.asar');
const tmpDir = path.resolve('dist/asar_tmp');

if (fs.existsSync(asarPath)) {
  console.log('Extracting asar...');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  execSync(`npx asar extract "${asarPath}" "${tmpDir}"`, { stdio: 'inherit' });
  
  console.log('Copying build to extracted asar...');
  function cp(src, dst) {
    if (!fs.existsSync(src)) return;
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const item of fs.readdirSync(src)) cp(path.join(src, item), path.join(dst, item));
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
  cp('build', path.join(tmpDir, 'build'));

  console.log('Packing asar...');
  execSync(`npx asar pack "${tmpDir}" "${asarPath}"`, { stdio: 'inherit' });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('app.asar successfully updated with latest build!');
} else {
  console.log('app.asar not found, skipping asar pack.');
}
