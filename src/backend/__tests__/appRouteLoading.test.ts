import { build } from 'esbuild'
import { runInNewContext } from 'vm'
import { resolve } from 'path'

it('loads only the selected screen instead of importing every route at startup', async () => {
  // Compile the real route declarations; screen stubs record module evaluation.
  const output = await build({
    entryPoints: [resolve('src/frontend/App.tsx')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'transform',
    plugins: [
      {
        name: 'route-fixture',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) =>
            args.kind === 'entry-point'
              ? undefined
              : { path: args.path, namespace: 'fixture' }
          )
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: `
        ${args.path.includes('/screens/') && !args.path.includes('/components/') ? `globalThis.loadedScreens.push(${JSON.stringify(args.path)});` : ''}
        export default { createElement: () => null };
        export const jsx = () => null, jsxs = () => null, Fragment = () => null;
        export const createHashRouter = routes => { globalThis.routes = routes; return routes; };
        export const useContext = () => ({}), useState = () => [], useEffect = () => {};
        export const Navigate = () => null, Outlet = () => null, RouterProvider = () => null, useLocation = () => ({});
        export const ThemeProvider = () => null, createTheme = () => ({});
        export const ControllerHints = () => null, Help = () => null, OfflineMessage = () => null;
        export const TourProvider = () => null, InstallGameWrapper = () => null, SettingsModalWrapper = () => null;
        export const ChooseDownloadModalWrapper = () => null, usePluginThemes = () => {}, syncLocalStorageToBackend = async () => {};
      `
          }))
        }
      }
    ]
  })
  const context = {
    module: { exports: {} },
    exports: {},
    loadedScreens: [] as string[],
    routes: [] as Array<{
      children: Array<{
        index?: boolean
        path?: string
        lazy?: () => Promise<unknown>
      }>
    }>
  }
  runInNewContext(output.outputFiles[0].text, context)
  await Promise.resolve()
  expect(context.loadedScreens).toEqual([])
  const routes = context.routes[0].children
  await routes.find((route) => route.index)?.lazy?.()
  expect(context.loadedScreens).toEqual(['./screens/Library'])
  await routes.find((route) => route.path === 'external-games')?.lazy?.()
  expect(context.loadedScreens).toEqual([
    './screens/Library',
    './screens/ExternalGames'
  ])
  expect(context.loadedScreens).not.toContain('./screens/Alazterflix')
})
