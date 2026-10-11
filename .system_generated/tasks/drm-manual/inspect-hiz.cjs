const fs = require('fs')
const path = require('path')
const { parse } = require('@babel/parser')
async function main() {
  const root = await fetch('https://hizsearch.pages.dev/', { signal: AbortSignal.timeout(12000) })
  const html = await root.text()
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => new URL(match[1], root.url)).filter(url => url.origin === 'https://hizsearch.pages.dev' && /^\/assets\/[^/]+\.js$/.test(url.pathname))
  const rows = []
  for (const url of scripts) {
    const source = await (await fetch(url, { signal: AbortSignal.timeout(12000) })).text()
    if (source.length > 3 * 1024 * 1024) throw new Error('Asset too large')
    const tree = parse(source, { sourceType: 'module' })
    function walk(node) {
      if (!node || typeof node !== 'object') return
      if (node.type === 'CallExpression' && node.arguments[0]?.type === 'StringLiteral' && node.arguments[1]?.type === 'ObjectExpression') {
        const tag = node.arguments[0].value
        const props = node.arguments[1].properties
        const child = props.find(prop => prop.key?.name === 'children')?.value
        const className = props.find(prop => prop.key?.name === 'className')?.value
        if (child?.type === 'MemberExpression' && /^(?:name|title|game_name)$/.test(child.property?.name || '') && rows.length < 30) rows.push({ tag, className: className?.type === 'StringLiteral' ? className.value : '', titleField: child.property.name })
      }
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value)
    }
    walk(tree)
  }
  fs.writeFileSync(path.join(__dirname, 'hiz-dom-schema.json'), JSON.stringify(rows, null, 2))
  console.log(JSON.stringify(rows))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
