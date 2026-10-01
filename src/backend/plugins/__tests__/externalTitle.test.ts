import {
  externalTitleGroupKey,
  externalTitleKey,
  hasRequestedTitleNumbers
} from 'common/externalTitle'

it('keeps the original game, sequels and platforms in separate source groups', () => {
  const keys = [
    'Transport Fever',
    'Transport Fever 2',
    'Transport Fever 3',
    'Transport Fever 30'
  ].map((title) => externalTitleGroupKey(title))
  expect(new Set(keys).size).toBe(4)
  expect(externalTitleGroupKey('Transport Fever 3', 'switch')).not.toBe(keys[2])
})

it('joins matching titles across release labels without deleting their sequel number', () => {
  expect(externalTitleKey('Transport Fever 3 (v0.3.0) RUNE')).toBe(
    'transport fever 3'
  )
  expect(
    externalTitleKey('Transport Fever 3 Free Download (Build 35720)')
  ).toBe('transport fever 3')
  expect(externalTitleKey('F.E.A.R. 3')).toBe('fear 3')
})

it('does not mistake version or build numbers for the requested sequel', () => {
  for (const title of [
    'Transport Fever',
    'Transport Fever 2',
    'Transport Fever 30',
    'Transport Fever v3.0',
    'Transport Fever (Build 3)'
  ]) {
    expect(hasRequestedTitleNumbers(title, 'Transport Fever 3')).toBe(false)
  }
})
