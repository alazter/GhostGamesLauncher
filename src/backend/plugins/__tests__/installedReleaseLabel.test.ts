import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import InstalledReleaseLabel from 'frontend/screens/Library/components/InlineGameSettings/InstalledReleaseLabel'
import { installedReleaseCandidate } from 'common/externalReleaseInfo'
import type { GhostSearchResult } from 'common/types/plugins'

it('shows the installed version and source release date in the settings label', () => {
  const html = renderToStaticMarkup(
    createElement(InstalledReleaseLabel, {
      version: 'v1.0.0.1',
      sourceDate: '2026-10-16'
    })
  )
  expect(html).toContain('v1.0.0.1')
  expect(html).toContain('LAST UPDATE: 16/10/26')
})

it('does not replace a missing source date with the installation date or today', () => {
  const html = renderToStaticMarkup(
    createElement(InstalledReleaseLabel, { version: 'v0.9' })
  )
  expect(html).toContain('Data não registrada')
})

it('offers an accessible edit tag even when no date was recorded', () => {
  const html = renderToStaticMarkup(
    createElement(InstalledReleaseLabel, {
      version: 'v0.9',
      onSaveDate: () => Promise.resolve()
    })
  )
  expect(html).toContain('<button')
  expect(html).toContain(
    'Editar data da release instalada: Data não registrada'
  )
  expect(html).toContain('O Ghost compara esta data e a versão com o site')
})

it('treats the historical sideload 1.0 placeholder as unknown without changing identified releases', () => {
  const game = { providerId: 'sideload', version: '1.0' } as GhostSearchResult
  expect(installedReleaseCandidate(game).version).toBeUndefined()
  expect(game.version).toBe('1.0')
  expect(
    installedReleaseCandidate({
      ...game,
      providerId: 'com.ghost.ankergames-source'
    }).version
  ).toBe('1.0')
  expect(
    installedReleaseCandidate({ ...game, sourceDate: '24/07/26' }).sourceDate
  ).toBe('2026-07-24')
})
