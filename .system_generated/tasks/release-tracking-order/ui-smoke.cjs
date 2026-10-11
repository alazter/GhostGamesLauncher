const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')
const { _electron, expect } = require('@playwright/test')
async function main() {
  const alias = { common: path.resolve('src/common'), frontend: path.resolve('src/frontend') }
  await esbuild.build({ entryPoints: [path.join(__dirname, 'ui-fixture.tsx')], bundle: true, outfile: path.join(__dirname, 'ui.js'), alias, jsx: 'automatic' })
  fs.writeFileSync(path.join(__dirname, 'ui.html'), '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="../release-filters/global.css"><link rel="stylesheet" href="ui.css"><style>html,body,#root{margin:0;width:100%;height:100%}</style><div id="root"></div><script src="ui.js"></script></html>')
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  let app
  try {
    app = await _electron.launch({ args: [path.join(__dirname, 'ui-main.cjs')], env })
    const page = await app.firstWindow()
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    const cards = page.locator('.nr-results .nr-card-open')
    const checkPrimary = async name => {
      await expect.poll(() => page.locator('.nr-results').evaluate(panel => {
        const bounds = panel.getBoundingClientRect()
        const card = [...panel.querySelectorAll('.nr-card-open')].find(el => {
          const rect = el.getBoundingClientRect()
          return rect.bottom > bounds.top && rect.top < bounds.bottom
        })
        return card?.getAttribute('aria-label')
      })).toBe(`Detalhes de Jogo ${name}`)
    }
    const currentCard = page.getByRole('button', { name: 'Detalhes de Jogo hoje', exact: true })
    const futureCard = page.getByRole('button', { name: 'Detalhes de Jogo futuro-cinco-dias-a', exact: true })
    await expect(currentCard).toBeInViewport()
    await checkPrimary('hoje')
    await expect(cards.first()).toHaveAttribute('aria-label', 'Detalhes de Jogo antigo')
    expect(await page.locator('.nr-results').evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    await page.screenshot({ path: path.join(__dirname, 'monitorados-hoje.png') })
    for (const name of ['Exibir lista', 'Exibir cartões compactos', 'Exibir cartões']) {
      await page.getByRole('button', { name, exact: true }).click()
      await expect(currentCard).toBeInViewport()
      await checkPrimary('hoje')
    }
    await page.getByRole('textbox', { name: 'Buscar lançamentos' }).fill('Jogo')
    await expect(page.locator('.nr-results .nr-day-heading')).toHaveCount(0)
    await expect(cards).toHaveCount(6)
    await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
    await expect(page.locator('.nr-results .nr-day-heading')).toHaveCount(5)
    await expect(currentCard).toBeInViewport()
    await page.locator('.nr-navigation').getByRole('button', { name: 'Calendário', exact: true }).click()
    await expect(cards.first()).toHaveAttribute('aria-label', 'Detalhes de Jogo antigo')
    await page.locator('.nr-results').evaluate(el => el.scrollTop = el.scrollHeight)
    await page.locator('.nr-navigation > .nr-nav-scroll > .nr-nav-button').filter({ hasText: 'Monitorados' }).click()
    await expect(currentCard).toBeInViewport()
    await checkPrimary('hoje')
    await page.locator('.nr-results').evaluate(el => { el.scrollTop = 0; window.dispatchEvent(new Event('ghostReleaseTrackingChanged')) })
    expect(await page.locator('.nr-results').evaluate(el => el.scrollTop)).toBe(0)
    await page.locator('.nr-navigation > .nr-nav-scroll > .nr-nav-button').filter({ hasText: 'Monitorados' }).click()
    await expect(currentCard).toBeInViewport()
    await page.locator('.nr-navigation').getByRole('button', { name: 'Jogos', exact: true }).click()
    await page.getByRole('button', { name: 'Ver monitorados de PC', exact: true }).click()
    await expect(currentCard).toBeInViewport()
    await checkPrimary('hoje')
    const baseUrl = page.url().split('?')[0]
    await page.goto(baseUrl + '?scenario=near-past')
    await expect(page.getByRole('button', { name: 'Detalhes de Jogo ontem', exact: true })).toBeInViewport()
    await checkPrimary('ontem')
    await page.screenshot({ path: path.join(__dirname, 'monitorados-proximo-passado.png') })
    await page.goto(baseUrl + '?scenario=only-past')
    await checkPrimary('ontem')
    for (const name of ['Exibir lista', 'Exibir cartões compactos', 'Exibir cartões']) {
      await page.getByRole('button', { name, exact: true }).click()
      await checkPrimary('ontem')
    }
    await page.goto(baseUrl + '?scenario=only-future')
    await expect(futureCard).toBeInViewport()
    await checkPrimary('futuro-cinco-dias-a')
    await page.goto(baseUrl + '?scenario=undated')
    await expect(page.getByRole('button', { name: 'Detalhes de Jogo sem-data', exact: true })).toBeInViewport()
    await checkPrimary('sem-data')
    expect(errors).toEqual([])
    console.log('Monitorados: hoje prioritário diante de dois jogos em cinco dias; ontem mais próximo; somente futuros; sem data; entrada direta/reentrada, três formatos, filtros e continuidade da rolagem OK.')
  } finally { if (app) await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
