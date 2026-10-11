import { test, expect, _electron } from '@playwright/test'
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { basename, dirname, join, resolve } from 'path'

// Run real cards, menus, virtual rows, CachedImage and CSS in Chromium.
// Isolate store IPC and game actions so no user catalog or installation is touched.
const mocks: Record<string, string> = {
  'frontend/helpers/electronStores':
    'export const configStore = { get: (_, fallback) => fallback, set: () => {} }; export const timestampStore = configStore; export const sideloadLibrary = {}; export const gameOverridesStore = {};',
  'frontend/state/GlobalStateV2':
    'export default { keys: () => ({ gameOverrides: {} }), getState: () => ({}) };',
  'frontend/helpers': `export const getStoreName = (runner) => runner;
    export const getProgress = () => 0; export const getGameInfo = () => ({});
    export const launch = () => Promise.resolve(); export const install = launch; export const sendKill = launch;`,
  'frontend/helpers/library':
    'export const updateGame = () => Promise.resolve();',
  'frontend/state/InstallGameModal':
    'export const openInstallGameModal = () => {};',
  'frontend/components/UI/UninstallModal': 'export default () => null;',
  'frontend/components/UI/EditGameDialog': 'export default () => null;',
  'frontend/components/UI': `export { default as CachedImage } from 'frontend/components/UI/CachedImage';`,
  'frontend/helpers/defaultCustomStores':
    'export const DEFAULT_GHOST_CUSTOM_STORES = [];',
  'react-i18next': String.raw`const t = (key, fallback, values) =>
    (fallback || key).replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? ''));
    export const useTranslation = () => ({ t });`
}

function removeFixture(directory: string) {
  const target = resolve(directory)
  if (
    dirname(target) !== resolve(tmpdir()) ||
    !basename(target).startsWith('ghost-library-loading-')
  ) {
    throw new Error('Unexpected library fixture directory')
  }
  rmSync(target, { recursive: true, force: true })
}

async function launchFixture(noObserver = false) {
  const directory = mkdtempSync(join(tmpdir(), 'ghost-library-loading-'))
  const svgrRequire = createRequire(require.resolve('vite-plugin-svgr'))
  const { transform } = svgrRequire('@svgr/core') as {
    transform: (
      source: string,
      options: Record<string, unknown>
    ) => Promise<string>
  }
  await build({
    entryPoints: [resolve('e2e/fixtures/library-loading.tsx')],
    bundle: true,
    outfile: join(directory, 'ui.js'),
    jsx: 'automatic',
    alias: { frontend: resolve('src/frontend'), common: resolve('src/common') },
    loader: { '.jpg': 'dataurl' },
    plugins: [
      {
        name: 'isolated-library-stores',
        setup(builder) {
          builder.onResolve({ filter: /(?:^|\/)electronStores$/ }, () => ({
            path: 'frontend/helpers/electronStores',
            namespace: 'fixture'
          }))
          if (process.env.LIBRARY_PROFILE_BASELINE) {
            builder.onLoad({ filter: /GamesList[\\/]index\.tsx$/ }, (args) => ({
              contents: readFileSync(args.path, 'utf8').replace(
                "import useVirtualLibrary from './useVirtualLibrary'",
                `import useProgressiveLibrary from ${JSON.stringify(resolve('e2e/fixtures/legacy-library-loading.ts'))}
              function useVirtualLibrary(total: number, key: string, enabled: boolean, _layout: string) {
                const { listRef, visibleCount } = useProgressiveLibrary(total, key, enabled)
                return { listRef, start: 0, end: visibleCount, topSpace: 0, bottomSpace: 0, pinnedIndex: null, pinnedStyle: {} }
              }`
              ),
              loader: 'tsx',
              resolveDir: dirname(args.path)
            }))
          }
          builder.onResolve({ filter: /\.svg\?react$/ }, (args) => ({
            path: args.path.startsWith('frontend/')
              ? resolve('src', args.path.replace('?react', ''))
              : resolve(args.resolveDir, args.path.replace('?react', '')),
            namespace: 'svg-fixture'
          }))
          builder.onLoad(
            { filter: /.*/, namespace: 'svg-fixture' },
            async (args) => ({
              contents: await transform(readFileSync(args.path, 'utf8'), {
                plugins: [svgrRequire.resolve('@svgr/plugin-jsx')]
              }),
              loader: 'jsx',
              resolveDir: process.cwd()
            })
          )
          builder.onResolve({ filter: /.*/ }, (args) =>
            args.path in mocks
              ? { path: args.path, namespace: 'fixture' }
              : undefined
          )
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: mocks[args.path],
            loader: 'tsx',
            resolveDir: process.cwd()
          }))
        }
      }
    ]
  })
  writeFileSync(
    join(directory, 'ui.html'),
    `<!doctype html><meta charset="utf-8">
    <link rel="stylesheet" href="ui.css"><style>
    :root{--space-md-fixed:20px;--space-3xl:30px;--text-default:white;--text-secondary:#aaa;--accent:cyan;--body-background:#111}
    body{margin:0;background:#111;color:white}.gameList{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px;padding:15px 20px 20px}
    .gameListItem{height:45px}.gameListLayout{min-width:0}
    </style><div id="root"></div><script>window.api={onProgressUpdate:()=>{},isGameAvailable:async()=>true};</script>${noObserver ? '<script>delete window.IntersectionObserver</script>' : ''}<script src="ui.js"></script>`
  )
  writeFileSync(
    join(directory, 'main.cjs'),
    `const {app,BrowserWindow}=require('electron');
    app.setPath('userData',${JSON.stringify(join(directory, 'userdata'))});
    app.disableHardwareAcceleration();app.whenReady().then(()=>{
    const win=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{backgroundThrottling:false,offscreen:true}});
    win.loadFile(${JSON.stringify(join(directory, 'ui.html'))});});app.on('window-all-closed',()=>app.quit());`
  )
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await _electron.launch({
    args: [join(directory, 'main.cjs')],
    env
  })
  try {
    const page = await app.firstWindow()
    page.on('pageerror', (error) =>
      console.error('Library fixture runtime error:', error.stack)
    )
    return {
      page,
      close: async () => {
        await app.close()
        removeFixture(directory)
      }
    }
  } catch (error) {
    await app.close()
    removeFixture(directory)
    throw error
  }
}

test('real library cards remain bounded through scroll, filters, focus and menus', async () => {
  test.setTimeout(90000)
  const fixture = await launchFixture()
  const { page } = fixture
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const control = (action: string, ...args: unknown[]) =>
    page.evaluate(
      ({ action, args }) => {
        ;(
          window as unknown as {
            libraryFixture: Record<string, (...values: unknown[]) => void>
          }
        ).libraryFixture[action](...args)
      },
      { action, args }
    )
  const cards = page.locator('.gameCard')
  const scroll = page.locator('#games-scroll-area')
  try {
    await expect(cards.first()).toBeVisible()
    await expect.poll(() => cards.count()).toBeLessThan(80)
    const originalHeight = await scroll.evaluate((area) => area.scrollHeight)
    expect(originalHeight).toBeGreaterThan(90000)
    expect(
      await cards.first().evaluate((card) => getComputedStyle(card).aspectRatio)
    ).toBe('173 / 275')
    await expect(cards.first().locator('.gameImg')).toHaveAttribute(
      'loading',
      'eager'
    )
    await expect(page.locator('.gameCard style')).toHaveCount(0)
    for (const fraction of [0.1, 0.5, 0.9, 0.5, 0.1, 0]) {
      await scroll.evaluate((area, fraction) => {
        area.scrollTop = (area.scrollHeight - area.clientHeight) * fraction
      }, fraction)
      await expect
        .poll(async () => {
          const index = Number(
            await page
              .locator('[data-library-index]:not([data-library-pinned])')
              .first()
              .getAttribute('data-library-index')
          )
          return Math.abs(index - Math.floor(1463 * fraction))
        })
        .toBeLessThan(65)
      expect(await cards.count()).toBeLessThan(80)
      expect(
        Math.abs(
          (await scroll.evaluate((area) => area.scrollHeight)) - originalHeight
        )
      ).toBeLessThan(2)
    }
    await scroll.evaluate((area) => {
      area.scrollTop = area.scrollHeight / 2
    })
    await expect
      .poll(() =>
        page
          .locator('[data-library-index]')
          .first()
          .getAttribute('data-library-index')
      )
      .not.toBe('0')
    const beforeMetadata = await scroll.evaluate((area) => area.scrollTop)
    await control('refreshMetadata')
    await expect(cards.first()).toContainText('atualizado')
    expect(await scroll.evaluate((area) => area.scrollTop)).toBe(beforeMetadata)
    await control('setLibrary', 0, 240)
    await expect(page.locator('[data-app-name="game-0"]')).toBeVisible()
    await control('goToEnd')
    await expect(page.locator('[data-app-name="game-239"]')).toBeFocused()
    await control('setLibrary', 300, 240)
    await expect(page.locator('[data-app-name="game-300"]')).toBeVisible()
    expect(await cards.count()).toBeLessThan(80)
    await control('setLibrary')
    await control('goToEnd')
    await expect(page.locator('[data-app-name="game-1462"]')).toBeFocused()
    expect(await cards.count()).toBeLessThan(80)
    await page.keyboard.press('Home')
    await expect(page.locator('[data-app-name="game-0"]')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('[data-app-name="game-5"]')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('[data-app-name="game-0"]')).toBeFocused()
    for (let index = 0; index < 40; index++)
      await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-app-name="game-40"]')).toBeFocused()
    expect(await cards.count()).toBeLessThan(80)
    await page.keyboard.press('End')
    await expect(page.locator('[data-app-name="game-1462"]')).toBeFocused()
    await control('goToStart')
    await expect(page.locator('[data-app-name="game-0"]')).toBeFocused()
    await page.locator('[data-app-name="game-0"]').click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    await scroll.evaluate((area) => {
      area.scrollTop = area.scrollHeight / 2
    })
    await expect(
      page.locator('[data-library-pinned] [data-app-name="game-0"]')
    ).toHaveCount(1)
    await expect(page.getByRole('menu')).toBeVisible()
    expect(await cards.count()).toBeLessThan(80)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await control('goToStart')
    await page.setViewportSize({ width: 800, height: 800 })
    await expect
      .poll(() =>
        page
          .locator('.gameList')
          .evaluate(
            (list) =>
              getComputedStyle(list).gridTemplateColumns.split(' ').length
          )
      )
      .toBe(3)
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('[data-app-name="game-3"]')).toBeFocused()
    await page.locator('.gameList').evaluate((list: HTMLElement) => {
      list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(340px, 1fr))'
    })
    await expect
      .poll(() =>
        page
          .locator('.gameList')
          .evaluate(
            (list) =>
              getComputedStyle(list).gridTemplateColumns.split(' ').length
          )
      )
      .toBe(2)
    await control('goToStart')
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('[data-app-name="game-2"]')).toBeFocused()
    expect(await cards.count()).toBeLessThan(80)
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('heroicToggleMassEdit', { detail: { active: true } })
      )
    )
    await page
      .getByRole('button', { name: 'Marcar Todos', exact: true })
      .click()
    await expect(
      page.getByText('1463 jogo(s) selecionado(s)', { exact: true })
    ).toBeVisible()
    expect(await cards.count()).toBeLessThan(80)
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('heroicToggleMassEdit', { detail: { active: false } })
      )
    )
    await control('setLayout', 'list')
    await expect(page.locator('.gameListItem').first()).toBeVisible()
    expect(await page.locator('.gameListItem').count()).toBeLessThan(100)
    await control('goToEnd')
    await expect(
      page.locator('.gameListItem[data-app-name="game-1462"]')
    ).toBeFocused()
    expect(await page.locator('.gameListItem').count()).toBeLessThan(100)
    await control('setLibrary', 0, 0)
    await expect(page.locator('.gameListItem')).toHaveCount(0)
    await expect(page.locator('.libraryVirtualSpacer')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await fixture.close()
  }
})

test('profile real library cards across the whole collection', async () => {
  test.setTimeout(120000)
  const fixture = await launchFixture()
  try {
    await expect(fixture.page.locator('.gameCard').first()).toBeVisible()
    await fixture.page.evaluate(() => {
      Object.assign(window, { libraryLongTasks: [] })
      new PerformanceObserver((list) =>
        (
          window as unknown as { libraryLongTasks: number[] }
        ).libraryLongTasks.push(
          ...list.getEntries().map((entry) => entry.duration)
        )
      ).observe({ type: 'longtask', buffered: true })
      ;(
        window as unknown as { libraryFixture: { goToEnd: () => void } }
      ).libraryFixture.goToEnd()
    })
    await expect(
      fixture.page.locator('[data-app-name="game-1462"]')
    ).toBeFocused({ timeout: 60000 })
    const stats = await fixture.page.evaluate(() => ({
      cards: document.querySelectorAll('.gameCard').length,
      elements: document.querySelectorAll('*').length,
      styles: document.querySelectorAll('.gameCard style').length,
      longTasks: (window as unknown as { libraryLongTasks: number[] })
        .libraryLongTasks
    }))
    mkdirSync(resolve('.system_generated/tasks/library-performance'), {
      recursive: true
    })
    writeFileSync(
      resolve(
        `.system_generated/tasks/library-performance/${process.env.LIBRARY_PROFILE_BASELINE ? 'before' : 'after'}.json`
      ),
      JSON.stringify(stats, null, 2)
    )
    console.log(
      JSON.stringify({
        ...stats,
        longTasks: {
          count: stats.longTasks.length,
          maximumMs: Math.max(0, ...stats.longTasks),
          totalMs: stats.longTasks.reduce((sum, value) => sum + value, 0)
        }
      })
    )
  } finally {
    await fixture.close()
  }
})

test('native scrolling works without IntersectionObserver and first lanes stay complete', async () => {
  const fixture = await launchFixture(true)
  const { page } = fixture
  try {
    await expect(page.locator('.gameCard').first()).toBeVisible()
    expect(await page.locator('.gameCard').count()).toBeLessThan(80)
    await page.evaluate(() =>
      (
        window as unknown as { libraryFixture: { goToEnd: () => void } }
      ).libraryFixture.goToEnd()
    )
    await expect(page.locator('[data-app-name="game-1462"]')).toBeFocused()
    expect(await page.locator('.gameCard').count()).toBeLessThan(80)
    await page.evaluate(() => {
      const fixture = (
        window as unknown as {
          libraryFixture: {
            setLibrary: (offset: number, total: number) => void
            setFirstLane: (value: boolean) => void
          }
        }
      ).libraryFixture
      fixture.setLibrary(0, 12)
      fixture.setFirstLane(true)
    })
    await expect(page.locator('.gameCard')).toHaveCount(12)
  } finally {
    await fixture.close()
  }
})
