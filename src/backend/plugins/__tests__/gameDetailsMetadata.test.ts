import { detailsGenres, detailsVersion, freeSpaceLabel, installedSizeBytes, translatedCompatibility } from '../../../frontend/screens/ExternalGames/gameDetailsMetadata'
import { extractGameMetadataFromHtml } from '../websiteSource'
import type { GhostSearchResult } from 'common/types/plugins'

const game = (version?: string): GhostSearchResult => ({ id: 'game', title: 'Game', providerId: 'anker', providerName: 'AnkerGames', version })

it('displays real builds and versions without inventing a default version', () => {
  expect(detailsVersion(game('Build 24561262'))).toBe('B 24561262')
  expect(detailsVersion(game('v1.2a'))).toBe('v1.2a')
  expect(detailsVersion(game())).toBe('Versão não informada')
})

it('translates and deduplicates actual genre tags, without guessing a genre', () => {
  expect(detailsGenres('Action, Adventure, Multiplayer', 'Multiplayer, Singleplayer')).toEqual(['Ação', 'Aventura', 'Multiplayer', 'Um jogador'])
  expect(detailsGenres()).toEqual([])
  expect(translatedCompatibility('Unsupported')).toBe('Não compatível')
  expect(translatedCompatibility('Full')).toBe('Completo')
  expect(translatedCompatibility()).toBe('Não informado')
})

it('distinguishes unavailable space from zero and rejects ambiguous installed sizes', () => {
  expect(installedSizeBytes('30 GB')).toBe(30 * 1024 ** 3)
  expect(installedSizeBytes('2,5 GiB')).toBe(2.5 * 1024 ** 3)
  for (const size of [undefined, '30', 'não informado', '-4 GB', '30 GB + DLC']) expect(installedSizeBytes(size)).toBeUndefined()
  expect(freeSpaceLabel(undefined)).toBe('Espaço indisponível')
  expect(freeSpaceLabel(0)).toBe('0 MB livres')
  expect(freeSpaceLabel(214 * 1024 ** 3)).toBe('214 GB livres')
})

it('keeps the publication date separate from the update and extracts a real rating count', () => {
  const meta = extractGameMetadataFromHtml('<script type="application/ld+json">{"datePublished":"2025-08-05","dateModified":"2026-10-18","aggregateRating":{"ratingCount":2}}</script><p>5.0/5</p>')
  expect(meta.publicationDate).toBe('2025-08-05')
  expect(meta.sourceDate).toBe('2026-10-18')
  expect(meta.ratingCount).toBe(2)
  const absent = extractGameMetadataFromHtml('<p>LAST UPDATE 18/10/26</p>')
  expect(absent.publicationDate).toBeUndefined()
  expect(absent.ratingCount).toBeUndefined()
})
