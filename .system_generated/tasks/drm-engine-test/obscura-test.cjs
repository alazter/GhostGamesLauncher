const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const binary = 'C:/Users/alazt/AppData/Roaming/ghost/source-engines/obscura/0.2.3-781a1b8bd12b/obscura.exe'
const targets = [
  { name: 'AnkerGames', url: 'https://ankergames.net/game/minecraft-dungeons-ii' },
  { name: 'HizSearch', url: 'https://hizsearch.pages.dev/' }
]
const longWait = process.argv.includes('--long-wait')
const metadata = `JSON.stringify({title:document.title,headings:Array.from(document.querySelectorAll('h1,h2')).slice(0,8).map(e=>e.textContent.trim().slice(0,160)),hasSearch:!!document.querySelector('input[type="search"],input[placeholder*="Search"],input[placeholder*="search"]'),challenge:/just a moment|verification required|verify.*human|checking your browser|verification challenge|performing security verification/i.test(document.title+' '+(document.body?.innerText||'')),turnstile:!!document.querySelector('iframe[src*="challenges.cloudflare.com"],.cf-turnstile'),matchedGame:document.querySelector('h1')?.textContent.trim()==='Minecraft Dungeons II',textLength:(document.body?.innerText||'').length})`
function run(target, stealth) {
  return new Promise((resolve) => {
    const mode = stealth ? 'stealth' : 'normal'
    const storage = path.join(__dirname, `obscura-${target.name}-${mode}`)
    fs.mkdirSync(storage, { recursive: true })
    const args = ['fetch', target.url, '--timeout', '30', '--wait', longWait ? '25' : '8', '--storage-dir', storage, '--eval', metadata, '--quiet', ...(stealth ? ['--stealth'] : [])]
    const started = Date.now()
    const child = spawn(binary, args, { windowsHide: true, cwd: __dirname, shell: false })
    let output = '', errors = '', timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill() }, 45000)
    child.stdout.on('data', (data) => { if (output.length < 200000) output += data.toString() })
    child.stderr.on('data', (data) => { if (errors.length < 20000) errors += data.toString() })
    child.on('error', (error) => { clearTimeout(timer); resolve({ engine: 'Obscura 0.2.3', site: target.name, mode, error: error.message }) })
    child.on('close', (exitCode) => {
      clearTimeout(timer)
      let page
      try { page = JSON.parse(output.trim()) } catch { }
      resolve({ engine: 'Obscura 0.2.3', site: target.name, mode, seconds: Number(((Date.now()-started)/1000).toFixed(1)), exitCode, timedOut, ...(page ? { page } : { output: output.slice(-1500) }), diagnostics: errors.slice(-2000) })
    })
  })
}
async function main() {
  const results = []
  for (const target of targets) {
    for (const mode of longWait ? [true] : [false, true]) {
      const result = await run(target, mode)
      results.push(result)
      fs.writeFileSync(path.join(__dirname, longWait ? 'obscura-long-result.json' : 'obscura-result.json'), JSON.stringify(results, null, 2))
      console.log(JSON.stringify(result))
    }
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
