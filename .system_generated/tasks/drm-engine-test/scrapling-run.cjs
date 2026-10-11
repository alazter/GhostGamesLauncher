const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const python = path.join(__dirname, 'venv/Scripts/python.exe')
const runName = process.argv[2] || 'initial'
async function run(site) {
  return new Promise((resolve) => {
    const child = spawn(python, ['-u', path.join(__dirname, 'scrapling-test.py'), site, runName], { windowsHide: true, shell: false, cwd: __dirname, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    let output = '', diagnostic = '', timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      // Only terminate the process tree launched by this test.
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false })
    }, 90000)
    child.stdout.on('data', (data) => { output += data.toString(); if (output.length > 200000) output = output.slice(-200000) })
    child.stderr.on('data', (data) => { diagnostic += data.toString(); if (diagnostic.length > 20000) diagnostic = diagnostic.slice(-20000) })
    child.on('close', (exitCode) => {
      clearTimeout(timer)
      const file = path.join(__dirname, `scrapling-${site}-${runName}-result.json`)
      let result
      if (!timedOut && fs.existsSync(file)) result = JSON.parse(fs.readFileSync(file, 'utf8'))
      else result = { engine: 'Scrapling 0.4.15', site, mode: 'stealth-auto-verification', timedOut, exitCode, output: output.slice(-1000) }
      result.diagnostics = diagnostic.slice(-3000)
      fs.writeFileSync(path.join(__dirname, `scrapling-${site}-${runName}-run.json`), JSON.stringify(result, null, 2))
      console.log(JSON.stringify({site,run:runName,status:result.status,page:result.page,error:result.error,timedOut:result.timedOut,seconds:result.seconds,diagnostics:result.diagnostics}))
      resolve(result)
    })
    child.on('error', (error) => { clearTimeout(timer); resolve({ site, error: error.message }) })
  })
}
async function main() {
  const results = []
  for (const site of ['AnkerGames', 'HizSearch']) results.push(await run(site))
  fs.writeFileSync(path.join(__dirname, `scrapling-${runName}-result.json`), JSON.stringify(results, null, 2))
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
