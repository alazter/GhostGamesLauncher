const fs = require('fs')
const path = require('path')
for (const file of fs.readdirSync(__dirname).filter((name) => name.endsWith('.json'))) {
  const target = path.join(__dirname, file)
  const result = JSON.parse(fs.readFileSync(target, 'utf8'))
  function clean(value) {
    if (!value || typeof value !== 'object') return
    if (typeof value.path === 'string' && value.path.startsWith('/cdn-cgi/challenge-platform/')) value.path = '/cdn-cgi/challenge-platform/[redacted]'
    if (value.page?.title === 'Just a moment...') value.page.challenge = true
    for (const item of Object.values(value)) clean(item)
  }
  clean(result)
  fs.writeFileSync(target, JSON.stringify(result, null, 2))
}
console.log('Registros de teste preparados sem dados de sessão.')
