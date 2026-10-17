import type { ReleaseDrmSource } from 'common/releaseDrm'
import { preserveDrmSources } from '../drmContinuity'

const listing: ReleaseDrmSource = {
  name: 'HizSearch',
  url: 'https://hizsearch.pages.dev/?q=test',
  title: 'Test',
  availability: 'listed',
  observedAt: '2026-10-17T12:00:00Z'
}

it('retains the dated listing and current verification requirement when access expires', () => {
  const result = preserveDrmSources(
    [
      {
        name: 'HizSearch',
        url: listing.url,
        requiresVerification: true,
        notice: 'A verificação expirou.'
      }
    ],
    [listing]
  )
  expect(result.preserved).toBe(true)
  expect(result.sources).toEqual([
    expect.objectContaining({
      ...listing,
      requiresVerification: true,
      notice: 'Último resultado válido preservado. A verificação expirou.'
    })
  ])
  expect(result.sources[0].status).toBeUndefined()
})

it.each(['AnkerGames', 'SkidrowReloaded'] as const)(
  'keeps %s available from cache during a rate limit or outage',
  (name) => {
    const previous = { ...listing, name }
    const result = preserveDrmSources(
      [
        {
          name,
          url: listing.url,
          notice: 'Consulta indisponível: limite temporário.'
        }
      ],
      [previous]
    )
    expect(result.sources[0]).toMatchObject({
      name,
      availability: 'listed',
      observedAt: listing.observedAt
    })
    expect(result.sources[0].notice).toContain('Último resultado válido')
  }
)

it('replaces old listings with fresh results and permits explicit status revisions', () => {
  const fresh = { ...listing, observedAt: '2026-10-18T12:00:00Z' }
  expect(preserveDrmSources([fresh], [listing])).toEqual({
    sources: [fresh],
    preserved: false
  })
  const cracked = { ...listing, status: 'cracked' as const }
  const uncracked = { ...fresh, status: 'uncracked' as const }
  expect(preserveDrmSources([uncracked], [cracked])).toEqual({
    sources: [uncracked],
    preserved: false
  })
})

it('does not invent evidence for an unseen game or keep a listing when a fresh search has no match', () => {
  const current = [
    {
      name: 'HizSearch' as const,
      url: listing.url,
      notice: 'Título ou status não confirmado nesta fonte.'
    }
  ]
  expect(preserveDrmSources(current, [])).toEqual({
    sources: current,
    preserved: false
  })
  expect(preserveDrmSources(current, [listing])).toEqual({
    sources: current,
    preserved: false
  })
})

it('keeps independent source results and never upgrades a listing into a crack', () => {
  const fresh: ReleaseDrmSource = {
    name: 'IsItCracked',
    url: 'https://isitcracked.com/game/test',
    status: 'uncracked'
  }
  const failure: ReleaseDrmSource = {
    name: 'HizSearch',
    url: listing.url,
    notice: 'HizSearch indisponível.'
  }
  const result = preserveDrmSources([fresh, failure], [listing])
  expect(result.sources).toContainEqual(fresh)
  expect(
    result.sources.find((source) => source.name === 'HizSearch')?.status
  ).toBeUndefined()
})

it('retains known evidence when the fresh status is unknown or the source is manual-only', () => {
  const cracked = { ...listing, status: 'cracked' as const }
  expect(
    preserveDrmSources([{ ...listing, status: 'unknown' }], [cracked])
      .sources[0].status
  ).toBe('cracked')
  const current: ReleaseDrmSource = {
    name: 'HizSearch',
    url: listing.url,
    notice: 'A consulta exige verificação manual.'
  }
  expect(preserveDrmSources([current], [listing]).sources[0]).toMatchObject({
    availability: 'listed',
    observedAt: listing.observedAt
  })
})
