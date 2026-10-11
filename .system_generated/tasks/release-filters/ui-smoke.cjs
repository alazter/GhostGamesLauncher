const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')
const sass = require('sass')
const { _electron, expect } = require('@playwright/test')
async function main() {
  const globals = ['src/frontend/index.scss', 'src/frontend/themes.scss', 'src/frontend/screens/Settings/sections/GamesSettings/index.scss'].map(file => sass.compile(file, { silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'legacy-js-api'], logger: sass.Logger.silent }).css).join('\n')
  fs.writeFileSync(path.join(__dirname, 'global.css'), globals + fs.readFileSync('src/frontend/App.css', 'utf8').replace(/^@import .*;$/gm, ''))
  await esbuild.build({ entryPoints: [path.join(__dirname, 'ui-fixture.tsx')], bundle: true, outfile: path.join(__dirname, 'ui.js'), jsx: 'automatic' })
  fs.writeFileSync(path.join(__dirname, 'ui.html'), '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="global.css"><link rel="stylesheet" href="ui.css"><style>html,body,#root{margin:0;width:100%;height:100%}#state{padding:30px}</style><div id="root"></div><script src="ui.js"></script></html>')
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  let app
  try {
    app = await _electron.launch({ args: [path.join(__dirname, 'ui-main.cjs')], env })
    const page = await app.firstWindow()
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    const filters = page.locator('.nr-nav-filters')
    const input = page.getByRole('textbox', { name: 'Filtrar por gênero' })
    await expect(input).toBeVisible()
    await filters.scrollIntoViewIfNeeded()
    const arrows = await page.evaluate(() => ({ filters: document.querySelector('.nr-nav-filters summary > svg:last-child').getBoundingClientRect().toJSON(), category: document.querySelector('.nr-category .nr-nav-chevron').getBoundingClientRect().toJSON(), summary: document.querySelector('.nr-nav-filters summary').getBoundingClientRect().toJSON() }))
    console.log('Setas:', JSON.stringify(arrows))
    const checkArrows = async () => {
      const positions = await page.evaluate(() => {
        const filter = document.querySelector('.nr-nav-filters summary > svg:last-child').getBoundingClientRect()
        const categories = [...document.querySelectorAll('.nr-category .nr-nav-chevron')].map(el => el.getBoundingClientRect())
        return { filter: { x: filter.x, width: filter.width }, categories: categories.map(box => ({ x: box.x, width: box.width })) }
      })
      for (const category of positions.categories) {
        expect(Math.abs(positions.filter.x - category.x)).toBeLessThan(0.5)
        expect(Math.abs(positions.filter.width - category.width)).toBeLessThan(0.5)
      }
    }
    await checkArrows()
    await filters.locator('summary').click()
    await expect(input).toBeHidden()
    await checkArrows()
    await page.locator('.nr-navigation').screenshot({ path: path.join(__dirname, 'arrow-aligned.png') })
    await filters.locator('summary').click()
    await expect(input).toBeVisible()
    await checkArrows()
    const geometry = await filters.evaluate(el => {
      const box = el.getBoundingClientRect()
      const input = el.querySelector('input').getBoundingClientRect()
      const buttons = [...el.querySelectorAll('.nr-genre-options button')].map(button => ({ label: button.textContent, box: button.getBoundingClientRect().toJSON(), check: button.querySelector('.nr-filter-check').getBoundingClientRect().toJSON(), justify: getComputedStyle(button).justifyContent }))
      return { box: box.toJSON(), input: input.toJSON(), buttons, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
    })
    fs.writeFileSync(path.join(__dirname, process.argv.includes('--baseline') ? 'before.json' : 'after.json'), JSON.stringify(geometry, null, 2))
    await filters.screenshot({ path: path.join(__dirname, process.argv.includes('--baseline') ? 'before.png' : 'after.png') })
    if (process.argv.includes('--baseline')) return
    for (const width of [1500, 1100, 900, 650]) {
      await page.setViewportSize({ width, height: 950 })
      if (width > 820) expect((await page.locator('.nr-navigation').boundingBox()).width).toBe(280)
      for (const category of ['Jogos', 'Filmes', 'Séries']) {
        const categoryButton = page.getByRole('button', { name: category, exact: true })
        await categoryButton.click()
        await filters.scrollIntoViewIfNeeded()
        await checkArrows()
        expect(await filters.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        const bounds = await filters.boundingBox(), field = await input.boundingBox()
        expect(field.x).toBeGreaterThanOrEqual(bounds.x)
        expect(field.x + field.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
        const positions = await page.locator('.nr-genre-options .nr-filter-check').evaluateAll(els => els.map(el => el.getBoundingClientRect().x))
        for (let i = 2; i < positions.length; i++) expect(Math.abs(positions[i] - positions[i % 2])).toBeLessThan(1)
      }
    }
    await page.setViewportSize({ width: 1500, height: 950 })
    await page.getByRole('button', { name: 'Jogos', exact: true }).click()
    const action = filters.getByRole('button', { name: 'Ação', exact: true })
    await action.click()
    await expect(input).toHaveValue('')
    await action.click()
    await expect(input).toHaveValue('Action')
    await expect(action).toHaveAttribute('aria-pressed', 'true')
    await input.fill('RPG')
    await expect(filters.getByRole('button', { name: 'RPG', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await filters.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(input).toHaveValue('')
    await expect(page.locator('#state')).toContainText('"platforms":[]')
    await expect(filters.getByRole('button', { name: 'Limpar filtros' })).toHaveCount(0)
    await action.click()
    await filters.screenshot({ path: path.join(__dirname, 'after.png') })
    await page.getByRole('button', { name: /Tema claro/ }).click()
    expect(await input.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(227, 223, 239)')
    await filters.screenshot({ path: path.join(__dirname, 'light.png') })
    await page.evaluate(() => document.documentElement.style.zoom = '1.25')
    await filters.scrollIntoViewIfNeeded()
    await checkArrows()
    expect(await filters.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(errors).toEqual([])
    console.log('Filtros: alinhamento, quatro larguras, gêneros, limpeza, temas e zoom OK')
  } finally { if (app) await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
