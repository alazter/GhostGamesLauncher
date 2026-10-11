const fs = require('fs')
const path = require('path')
const urls = ['https://www.skidrowreloaded.com/', 'https://ankergames.net/game/minecraft-dungeons-ii', 'https://hizsearch.pages.dev/']
async function main() {
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(18000), redirect: 'error' })
      const html = await response.text()
      fs.writeFileSync(path.join(__dirname, `source-${index}.html`), html)
      const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)/gi)].map((match) => new URL(match[1], url).href)
      const forms = [...html.matchAll(/<form[^>]*>/gi)].map((match) => match[0])
      console.log(JSON.stringify({ url, status: response.status, bytes: html.length, scripts: scripts.slice(0, 18), forms: forms.slice(0, 4) }))
    } catch (error) { console.log(JSON.stringify({ url, error: error.message })) }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
