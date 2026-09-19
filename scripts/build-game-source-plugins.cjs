// Rebuild the distributable Ghost game-source plugins from the shared catalog.
const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function loadTypeScript(relativePath) {
  const filename = path.join(root, relativePath)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(code, filename)
  return loaded.exports
}

async function main() {
  const { builtinGameSources } = loadTypeScript('src/common/builtinGameSources.ts')
  const { PluginPacker } = loadTypeScript('src/backend/plugins/pluginPacker.ts')
  for (const source of builtinGameSources) {
    const folder = source.id.replace('com.ghost.', '')
    const directory = path.join(root, 'plugins', folder)
    fs.mkdirSync(directory, { recursive: true })
    const manifest = {
      id: source.id, name: source.name, version: '1.2.0', author: 'Ghost Community',
      description: 'Catálogo público, busca inteligente, detecção de atualizações, backup de saves e instalação automática.',
      type: 'game-source', entrypoint: 'index.js', permissions: ['network', 'game-sources'],
      tier: 2, allowedDomains: [source.domain], homepage: `https://${source.domain}`, minGhostVersion: '0.2.7-beta'
    }
    fs.writeFileSync(path.join(directory, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n')
    fs.writeFileSync(path.join(directory, 'index.js'), `// Catálogo público com detecção de updates, backup de saves e auto-instalação.\nghost.registerWebsiteSource(${JSON.stringify(source.config, null, 2)})\n`)
    fs.writeFileSync(path.join(directory, 'README.md'), `# ${source.name}\n\nPlugin de catálogo e fonte de jogos para o Ghost Games Launcher com suporte a:\n- Busca inteligente com detecção de jogos instalados e versões.\n- Identificação de atualizações disponíveis.\n- Download e migração entre lojas com preservação e restauração automática de saves (Auto-Discovery & SHA-256 backup).\n- Instalação e atualização 100% automática pós-download.\n\nDocumentação: ../../docs/EXTERNAL_GAMES.md\n`)
    const output = path.join(root, 'plugins', `${folder}-v1.2.0.ghost`)
    const result = await PluginPacker.pack(directory, output)
    if (!result.success) throw new Error(result.error)
    console.log(path.relative(root, output))
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
