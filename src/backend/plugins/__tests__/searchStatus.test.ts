import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SearchStatus from 'frontend/screens/ExternalGames/SearchStatus'

it('announces a running search before any source replies', () => {
  const html = renderToStaticMarkup(createElement(SearchStatus, {
    loading: true, detailsLoading: false, term: 'HELLCARD', resultCount: 0
  }))
  expect(html).toContain('role="status"')
  expect(html).toContain('aria-live="polite"')
  expect(html).toContain('Buscando “HELLCARD”…')
  expect(html).toContain('Consultando as fontes habilitadas')
})

it('shows completed sources, partial results and pending stores together', () => {
  const html = renderToStaticMarkup(createElement(SearchStatus, {
    loading: true, detailsLoading: false, term: 'BALL x PIT', resultCount: 2,
    progress: { completed: 2, total: 6, games: [], errors: [], pendingProviders: [{ id: 'anker', name: 'AnkerGames' }] }
  }))
  expect(html).toContain('2 de 6 fontes consultadas')
  expect(html).toContain('2 resultados disponíveis')
  expect(html).toContain('Aguardando: AnkerGames')
  expect(html).toContain('value="2" max="6"')
})

it('removes the indicator when finished and separately reports loading game details', () => {
  const props = { loading: false, detailsLoading: false, term: 'test', resultCount: 0 }
  expect(renderToStaticMarkup(createElement(SearchStatus, props))).toBe('')
  expect(renderToStaticMarkup(createElement(SearchStatus, { ...props, detailsLoading: true })))
    .toContain('Carregando informações do jogo')
})
