const fs = require('fs')
const path = require('path')
const target = path.resolve('e2e/library_loading.spec.ts')
let source = fs.readFileSync(target, 'utf8')
const first = source.indexOf("test('library batches")
const last = source.indexOf("test('profile real", first)
if (first < 0 || last < 0) throw new Error('Test boundaries missing')
source = source.slice(0, first) + fs.readFileSync(path.join(__dirname, 'functional-tests.txt'), 'utf8') + source.slice(last)
const fallback = source.indexOf("test('manual loading")
if (fallback < 0) throw new Error('Fallback test boundary missing')
source = source.slice(0, fallback) + `test('native scrolling works without IntersectionObserver and first lanes stay complete', async () => {
  const fixture = await launchFixture(true)
  const { page } = fixture
  try {
    await expect(page.locator('.gameCard').first()).toBeVisible()
    expect(await page.locator('.gameCard').count()).toBeLessThan(80)
    await page.evaluate(() => (window as unknown as { libraryFixture: { goToEnd: () => void } }).libraryFixture.goToEnd())
    await expect(page.locator('[data-app-name="game-1462"]')).toBeFocused()
    expect(await page.locator('.gameCard').count()).toBeLessThan(80)
    await page.evaluate(() => {
      const fixture = (window as unknown as { libraryFixture: { setLibrary: (offset: number, total: number) => void; setFirstLane: (value: boolean) => void } }).libraryFixture
      fixture.setLibrary(0, 12)
      fixture.setFirstLane(true)
    })
    await expect(page.locator('.gameCard')).toHaveCount(12)
  } finally { await fixture.close() }
})
`
fs.writeFileSync(target, source)
