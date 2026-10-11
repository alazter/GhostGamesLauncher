const fs = require('node:fs')
const path = require('node:path')
const { chromium, expect } = require('@playwright/test')
async function main() {
  const app = await chromium.launch({channel:'msedge',headless:true})
  try {
    const page = await app.newPage()
    await page.goto('file:///' + path.join(__dirname,'preview.html').replaceAll('\\','/'))
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') console.log('browser:',message.text().slice(0,500)) })
    await page.reload()
    const frame = page.frameLocator('iframe')
    await expect(frame.locator('#af-header-styles')).toBeVisible()
    const results=[]
    for (const width of [1024,736,390,320]) {
      await page.setViewportSize({ width, height:1000 })
      for (const style of ['pills','segmented','tiles']) {
        await frame.locator('#af-header-styles').evaluate((root,style) => {
          root.querySelectorAll('section').forEach(section => section.hidden = section.querySelector('.af-product').dataset.style !== style)
        },style)
        const product=frame.locator(`[data-style="${style}"]`)
        const tabs=product.getByRole('navigation')
        await expect(tabs.getByRole('button')).toHaveCount(7)
        await tabs.getByRole('button',{name:'Animes',exact:true}).click()
        await expect(product.locator('.af-context strong')).toHaveText('Animes')
        await expect(tabs.getByRole('button',{name:'Animes',exact:true})).toHaveAttribute('aria-pressed','true')
        await tabs.getByRole('button',{name:'Todos',exact:true}).click()
        const settings=product.getByRole('button',{name:'Configurações',exact:true})
        await expect(settings).toHaveText('')
        await settings.click()
        await expect(product.locator('.af-settings-menu')).toBeVisible()
        await settings.press('Escape')
        await expect(product.locator('.af-settings-menu')).toBeHidden()
        const search=product.getByRole('searchbox')
        await search.fill('Matrix')
        await search.press('Enter')
        await expect(product.locator('.af-context strong')).toHaveText('Busca: Matrix')
        await search.fill('')
        await search.press('Enter')
        const bounds=await product.evaluate(product => {
          const box=product.getBoundingClientRect()
          const buttons=[...product.querySelectorAll('.af-category')]
          const search=product.querySelector('.af-search').getBoundingClientRect()
          return { overflow:document.documentElement.scrollWidth > innerWidth, searchLeft:search.left-box.left, labelsFit:buttons.every(button=>button.querySelector('span').getBoundingClientRect().width <= button.getBoundingClientRect().width-10), icons:product.querySelectorAll('.af-settings svg').length }
        })
        expect(bounds.overflow).toBe(false)
        expect(bounds.labelsFit).toBe(true)
        expect(bounds.searchLeft).toBeLessThan(28)
        expect(bounds.icons).toBe(1)
        results.push({width,style,...bounds})
        if(width===736 || width===320) await page.screenshot({path:path.join(__dirname,`${style}-${width}.png`)})
      }
    }
    expect(errors).toEqual([])
    fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({passed:true,results,pageErrors:errors},null,2))
    console.log('PASS: 3 mockups, 4 widths, category/search/settings interaction, no overflow or errors.')
  } finally { await app.close() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
