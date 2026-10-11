const fs = require('node:fs')
const path = require('node:path')
const esbuild = require('esbuild')
const sass = require('sass')
const { _electron, expect } = require('@playwright/test')

async function main() {
  const previous = path.resolve('.system_generated/tasks/alazterflix-sections')
  let fixture = fs.readFileSync(path.join(previous, 'ui-fixture.tsx'), 'utf8')
    .replace("  { ...base, id: 'film'", "  ...Array.from({ length: 13 }, (_, index) => ({ ...base, id: `progress-${index}`, title: `Continuar ${index}`, cleanTitle: `Continuar ${index}`, showTitle: `Continuar ${index}`, showDirectory: `T:/Progress/${index}`, isSeries: false, mediaCategory: 'movie', progressSeconds: 120 + index, fileName: `${index}.mkv`, filePath: `T:/Progress/${index}.mkv` })),\n  { ...base, id: 'film'")
    .replace('const clone = (value: any)', "state.playbackHistory = JSON.parse(sessionStorage.getItem('fixture_history') || '{}')\nconst clone = (value: any)")
    .replace('updates: [], streams: [],', 'updates: [], streams: [], backups: [], clearFails: false,')
    .replace('onPluginsUpdated: () => () => {}', "onPluginsUpdated: (callback: any) => { (window as any).smoke.reload = callback; return () => {} },\n  syncLocalStorageBackup: async (data: any) => { (window as any).smoke.backups.push(clone(data)) },\n  cinemaClearContinueWatching: async () => {\n    await new Promise(resolve => setTimeout(resolve, 100));\n    if ((window as any).smoke.clearFails) throw new Error('Falha simulada ao salvar');\n    for (const movie of state.movies) if (movie.progressSeconds && !movie.isWatched) state.playbackHistory[movie.id] = { progressSeconds: movie.progressSeconds, durationSeconds: movie.duration, lastWatched: '2026-01-01', continueHidden: true };\n    sessionStorage.setItem('fixture_history', JSON.stringify(state.playbackHistory));\n    return clone(state);\n  }")
  fixture += "\n;(window as any).smoke.resume = () => { const record = state.playbackHistory['aika-1']; delete record.continueHidden; record.progressSeconds = 350; sessionStorage.setItem('fixture_history', JSON.stringify(state.playbackHistory)); (window as any).smoke.reload() }\n"
  fs.writeFileSync(path.join(__dirname, 'ui-fixture.tsx'), fixture)
  for (const file of ['ui-main.cjs', 'ui.html']) fs.copyFileSync(path.join(previous, file), path.join(__dirname, file))
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'ui-fixture.tsx')], bundle: true,
    outfile: path.join(__dirname, 'ui.js'), external: ['/heroic_background.jpg'],
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl', '.woff': 'dataurl' },
    alias: { common: path.resolve('src/common'), frontend: path.resolve('src/frontend') },
    plugins: [{ name: 'scss', setup(build) { build.onLoad({ filter: /\.scss$/ }, async args => ({ contents: sass.compile(args.path, { logger: sass.Logger.silent }).css, loader: 'css' })) } }]
  })
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  let app
  try {
    app = await _electron.launch({ args: [path.join(__dirname, 'ui-main.cjs')], env })
    const page = await app.firstWindow()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ghost_alazterflix_cover_size', '1') })
    await page.reload()
    const navigation = page.getByRole('navigation', { name: 'Categorias do catálogo' })
    const slider = page.getByRole('slider', { name: 'Tamanho das capas' })
    const categories = [['Todos', 'all', 4], ['Para você', 'forYou', 3], ['Animes', 'anime', 0], ['Séries', 'series', 1], ['Filmes', 'movie', 2], ['Documentários', 'documentary', 4], ['Desenhos', 'cartoon', 0]]
    for (const [label, key, size] of categories) {
      await navigation.getByRole('button', { name: new RegExp(`^${label} \\(`) }).click()
      await expect(slider).toHaveValue('1')
      while (Number(await slider.inputValue()) !== size) {
        const increase = Number(await slider.inputValue()) < size
        await page.getByRole('button', { name: increase ? 'Aumentar capas' : 'Diminuir capas', exact: true }).click()
      }
      await expect(page.locator('.movies-grid')).toHaveAttribute('data-cover-size', String(size))
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem('ghost_alazterflix_cover_sizes'))[key], key)).toBe(size)
    }
    await page.reload()
    for (const [label, , size] of categories) {
      await navigation.getByRole('button', { name: new RegExp(`^${label} \\(`) }).click()
      await expect(slider).toHaveValue(String(size))
      await expect(page.locator('.movies-grid')).toHaveAttribute('data-cover-size', String(size))
    }
    await page.evaluate(() => { localStorage.setItem('ghost_alazterflix_cover_sizes', JSON.stringify({ all: 2, anime: 4 })); window.dispatchEvent(new Event('heroicSettingsChanged')) })
    await navigation.getByRole('button', { name: /^Animes \(/ }).click()
    await expect(slider).toHaveValue('4')
    await navigation.getByRole('button', { name: /^Todos \(/ }).click()
    await expect(slider).toHaveValue('2')
    await page.getByRole('button', { name: 'Aumentar capas', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.smoke.backups.length)).toBeGreaterThan(0)
    expect(await page.evaluate(() => JSON.parse(window.smoke.backups.at(-1).ghost_alazterflix_cover_sizes).anime)).toBe(4)

    await navigation.getByRole('button', { name: /^Para você \(/ }).click()
    const section = page.locator('.continue-section')
    const cards = section.locator('.continue-card')
    const clear = section.getByRole('button', { name: 'Limpar lista', exact: true })
    await expect(cards).toHaveCount(3)
    await expect(clear).toHaveCount(0)
    await section.getByRole('button', { name: 'Ver todos', exact: true }).click()
    await expect(cards).toHaveCount(14)
    await expect(clear).toBeVisible()
    await section.getByRole('button', { name: 'Mostrar menos', exact: true }).click()
    await expect(cards).toHaveCount(3)
    await expect(clear).toHaveCount(0)
    await section.getByRole('button', { name: 'Ver todos', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: path.join(__dirname, 'expanded-mobile.png') })
    await page.evaluate(() => window.smoke.clearFails = true)
    await clear.click()
    await expect(clear).toBeEnabled()
    await expect(cards).toHaveCount(14)
    await expect(page.getByText('Falha simulada ao salvar', { exact: true })).toBeVisible()
    await page.evaluate(() => window.smoke.clearFails = false)
    await clear.click()
    await expect(section).toHaveCount(0)
    expect(await page.evaluate(() => window.smoke.state().movies.find(movie => movie.id === 'aika-1').progressSeconds)).toBe(300)
    await page.reload()
    await navigation.getByRole('button', { name: /^Para você \(/ }).click()
    await expect(section).toHaveCount(0)
    await page.evaluate(() => window.smoke.resume())
    await expect(cards).toHaveCount(1)
    await expect(section.getByRole('button', { name: 'Continuar Agent Aika', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1400, height: 1000 })
    await section.getByRole('button', { name: 'Ver todos', exact: true }).click()
    await page.screenshot({ path: path.join(__dirname, 'expanded-desktop.png') })
    expect(errors).toEqual([])
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({ passed: true, categories, legacyMigration: true, reload: true, backup: true, restore: true, allFourteenEntries: true, clearOnlyWhenExpanded: true, failedClearPreservesList: true, clearPersists: true, resumePreserved: true, newPlaybackRestoresEntry: true, mobile: true, pageErrors: errors }, null, 2))
    console.log('PASS: independent sizes, reload/backup/restore; complete continuation list, clear, failure, resume, mobile.')
  } finally { if (app) await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
