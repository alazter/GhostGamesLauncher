import { parseDateToIso, isNewerGameRelease } from 'common/utils'

describe('Universal Date Parser and Composite Release Comparator', () => {
  describe('parseDateToIso', () => {
    it('reads short source dates without accepting invalid calendar dates', () => {
      expect(parseDateToIso('LAST UPDATE 16/10/26')).toBe('2026-10-16')
      expect(parseDateToIso('24/07/26')).toBe('2026-07-24')
      expect(parseDateToIso('31/02/26')).toBeUndefined()
    })
    it('handles ISO strings with or without timestamp', () => {
      expect(parseDateToIso('2026-09-29T14:30:00Z')).toBe('2026-09-29')
      expect(parseDateToIso('2026-09-29T12:00:00.000Z')).toBe('2026-09-29')
      expect(parseDateToIso('2026-09-29')).toBe('2026-09-29')
      expect(parseDateToIso('2026/09/29')).toBe('2026-09-29')
      expect(parseDateToIso('2026.09.29')).toBe('2026-09-29')
    })

    it('handles English month names (Month Day, Year and Day Month, Year)', () => {
      expect(parseDateToIso('September 29, 2026')).toBe('2026-09-29')
      expect(parseDateToIso('Sep 11, 2026')).toBe('2026-09-11')
      expect(parseDateToIso('March 29, 2025')).toBe('2025-03-29')
      expect(parseDateToIso('29 September 2026')).toBe('2026-09-29')
      expect(parseDateToIso('11 Sep 2026')).toBe('2026-09-11')
    })

    it('handles Portuguese month names and separators', () => {
      expect(parseDateToIso('29 de Setembro de 2026')).toBe('2026-09-29')
      expect(parseDateToIso('15 de Agosto de 2026')).toBe('2026-08-15')
      expect(parseDateToIso('29/09/2026')).toBe('2026-09-29')
      expect(parseDateToIso('05/01/2026')).toBe('2026-01-05')
    })

    it('handles Russian month names and formats', () => {
      expect(parseDateToIso('29 сентября 2026')).toBe('2026-09-29')
      expect(parseDateToIso('26-08-2025')).toBe('2025-08-26')
      expect(parseDateToIso('29.09.2026')).toBe('2026-09-29')
    })

    it('sanitizes prefixes and trailing times', () => {
      expect(parseDateToIso('Last Updated: September 29, 2026 at 15:30:00')).toBe('2026-09-29')
      expect(parseDateToIso('Updated on 29 September 2026 às 18:45')).toBe('2026-09-29')
      expect(parseDateToIso('Data de atualização: 29/09/2026')).toBe('2026-09-29')
    })

    it('returns undefined for invalid or empty inputs', () => {
      expect(parseDateToIso(undefined)).toBeUndefined()
      expect(parseDateToIso('')).toBeUndefined()
      expect(parseDateToIso('not a date')).toBeUndefined()
    })
  })

  describe('isNewerGameRelease: source release date before version', () => {
    it.each([
      ['v1.0', '2026-07-24', 'v0.9.1.2', '2026-10-16', true, 'date'],
      ['v0.9.1.2', '24/07/26', 'v1.0.0.1', '16/10/26', true, 'date'],
      ['v1.009.1', '2026-10-08', 'v1.009.1', '2026-10-14', true, 'date'],
      ['v0.107.7832', '2026-10-13', 'v0.107.7756', '2026-10-14', true, 'date'],
      ['Build 25134257', '2026-09-10', 'v1.0.4', '2026-09-29', true, 'date'],
      ['v1.009.1', '2026-10-14', 'v1.010', '2026-10-08', false, 'date'],
      ['v1.0', '2026-10-16', 'v1.1', '2026-10-16', true, 'version'],
      ['v1.0', '2026-10-16', 'v0.9', '2026-10-16', false, 'version'],
      ['v1.0', '2026-10-16', 'v1.0.0', '2026-10-16', false, 'same'],
      ['v1.0', undefined, 'v1.1', undefined, true, 'version'],
      ['v0.61d', undefined, 'v0.61e', undefined, true, 'version'],
      ['v0.61e', undefined, 'v0.61d', undefined, false, 'version'],
      ['v1.0 (Build 100)', undefined, 'v1.0 (Build 101)', undefined, true, 'version'],
      ['Build 100', undefined, 'Build 101', undefined, true, 'version'],
      ['Build 100', undefined, 'v1.1', undefined, false, 'unknown']
    ])('compares %s / %s to %s / %s', (version, sourceDate, nextVersion, nextDate, isNewer, reason) => {
      expect(isNewerGameRelease({ version, sourceDate }, { version: nextVersion, sourceDate: nextDate }))
        .toEqual({ isNewer, reason })
    })

    it('uses recorded upload dates when canonical release dates are absent', () => {
      expect(isNewerGameRelease({ version: 'v1.0', uploadDate: 'July 24, 2026' },
        { version: 'v0.9', uploadDate: 'October 16, 2026' })).toEqual({ isNewer: true, reason: 'date' })
    })

    it('does not use installation timestamps as source release dates', () => {
      const installed = { version: 'v1.0', installedAt: '2026-10-17' }
      expect(isNewerGameRelease(installed, { version: 'v1.1', sourceDate: '2026-10-16' }))
        .toEqual({ isNewer: true, reason: 'version' })
    })
  })
})
