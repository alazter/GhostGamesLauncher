const fs = require('node:fs')
const path = require('node:path')
const esbuild = require('esbuild')
const sass = require('sass')
const { _electron, expect } = require('@playwright/test')

async function main() {
  const previous = path.resolve('.system_generated/tasks/alazterflix-cards')
  const fixture = fs.readFileSync(path.join(previous, 'ui-fixture.tsx'), 'utf8')
    .replace("fileName: 'Aika.S01E01.mkv'", "progressSeconds: 300, fileName: 'Aika.S01E01.mkv'")
    .replace("  { ...base, id: 'film'", [
      "  ...['series', 'documentary', 'cartoon'].map((mediaCategory) => ({ ...base, id: mediaCategory, title: mediaCategory, cleanTitle: mediaCategory, showTitle: mediaCategory, showDirectory: `T:/${mediaCategory}`, mediaCategory, isSeries: mediaCategory === 'series', fileName: `${mediaCategory}.mkv`, filePath: `T:/${mediaCategory}/${mediaCategory}.mkv` })),",
      "  { ...base, id: 'film'"
    ].join('\n'))
  fs.writeFileSync(path.join(__dirname, 'ui-fixture.tsx'), fixture)
  fs.copyFileSync(path.join(previous, 'ui-main.cjs'), path.join(__dirname, 'ui-main.cjs'))
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'ui-fixture.tsx')], bundle: true,
    outfile: path.join(__dirname, 'ui.js'), external: ['/heroic_background.jpg'],
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl', '.woff': 'dataurl' },
    alias: { common: path.resolve('src/common'), frontend: path.resolve('src/frontend') },
    plugins: [{ name: 'scss', setup(build) { build.onLoad({ filter: /\.scss$/ }, async args => ({ contents: sass.compile(args.path, { logger: sass.Logger.silent }).css, loader: 'css' })) } }]
  })
  fs.copyFileSync(path.join(previous, 'ui.html'), path.join(__dirname, 'ui.html'))
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  let app
  try {
    app = await _electron.launch({ args: [path.join(__dirname, 'ui-main.cjs')], env })
    const page = await app.firstWindow()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('https://**', route => route.abort())
    await page.getByRole('navigation', { name: 'Categorias do catálogo' }).waitFor()
    const navigation = page.getByRole('navigation', { name: 'Categorias do catálogo' })
    const categories = [
      ['Todos', 'Todos os títulos'], ['Animes', 'Animes'], ['Séries', 'Séries'],
      ['Filmes', 'Filmes'], ['Documentários', 'Documentários'], ['Desenhos', 'Desenhos']
    ]
    const results = []
    for (const [label, heading] of categories) {
      // Verify both the requested absence and restoration when returning to Para você.
      await navigation.getByRole('button', { name: /^Para você \(/ }).click()
      await expect(page.locator('.hero-banner')).toBeVisible()
      await expect(page.locator('.continue-section')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Continuar Agent Aika', exact: true })).toBeVisible()
      await navigation.getByRole('button', { name: new RegExp(`^${label} \\(`) }).click()
      await expect(page.locator('.hero-banner')).toHaveCount(0)
      await expect(page.locator('.continue-section')).toHaveCount(0)
      await expect(page.locator('.home-catalog-section .section-title')).toHaveText(heading)
      await expect(page.locator('.movies-grid > *').first()).toBeVisible()
      if (label === 'Todos') await expect(page.locator('.category-shortcuts-section')).toBeVisible()
      results.push({ category: label, hero: false, continueWatching: false, catalogVisible: true })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await navigation.getByRole('button', { name: /^Todos \(/ }).click()
    await expect(page.locator('.hero-banner')).toHaveCount(0)
    await expect(page.locator('.continue-section')).toHaveCount(0)
    await navigation.getByRole('button', { name: /^Para você \(/ }).click()
    await expect(page.locator('.hero-banner')).toBeVisible()
    await expect(page.locator('.continue-section')).toBeVisible()
    expect(errors).toEqual([])
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({ passed: true, results, forYouRestored: true, mobileChecked: true, pageErrors: errors }, null, 2))
    console.log('PASS: seis categorias sem destaque/continuação; Para você mantém ambos; desktop e 390 px.')
  } finally { if (app) await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
