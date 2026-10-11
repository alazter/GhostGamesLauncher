const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const Store = require('electron-store')
const esbuild = require('esbuild')

esbuild.buildSync({
  entryPoints: ['src/backend/backup/preferenceSync.ts'],
  outfile: path.join(__dirname, 'preferenceSync.cjs'),
  platform: 'node',
  format: 'cjs',
  bundle: true
})
const { createBackupPreferenceSync } = require('./preferenceSync.cjs')

async function check() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-backup-lock-'))
  let locker
  let closed
  try {
    const store = new Store({ cwd: directory, name: 'config', projectVersion: '1.0.0' })
    store.set('settings', { language: 'pt', localStorageBackup: { heroic_custom_bg: 'old' } })
    const command = `$stream = [System.IO.File]::Open('${store.path.replace(/'/g, "''")}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite); try { [Console]::WriteLine('LOCKED'); [System.Threading.Thread]::Sleep(650) } finally { $stream.Dispose() }`
    locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true })
    closed = new Promise((resolve, reject) => {
      locker.once('error', reject)
      locker.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Locker exited ${code}`)))
    })
    await new Promise((resolve, reject) => {
      locker.once('error', reject)
      locker.stdout.once('data', (data) => data.toString().includes('LOCKED') ? resolve() : reject(new Error('Lock not confirmed')))
    })
    const failures = []
    let writes = 0
    const sync = createBackupPreferenceSync((snapshot) => {
      writes++
      try {
        store.set('settings', { ...store.get('settings'), localStorageBackup: snapshot })
      } catch (error) {
        failures.push(error.code)
        assert.equal(JSON.parse(fs.readFileSync(store.path, 'utf8')).settings.localStorageBackup.heroic_custom_bg, 'old')
        throw error
      }
    })
    await sync({ heroic_custom_bg: 'new' })
    await closed
    assert.ok(failures.includes('EPERM') || failures.includes('EBUSY') || failures.includes('EACCES'))
    assert.deepEqual(JSON.parse(fs.readFileSync(store.path, 'utf8')).settings, { language: 'pt', localStorageBackup: { heroic_custom_bg: 'new' } })
    console.log(JSON.stringify({ passed: true, realWindowsSharingFailures: failures, writeAttempts: writes, originalPreservedUntilSuccess: true }))
  } finally {
    if (locker && locker.exitCode === null) locker.kill()
    if (closed) await closed.catch(() => undefined)
    fs.rmSync(directory, { recursive: true, force: true })
  }
}
check().catch((error) => { console.error(error); process.exitCode = 1 })
