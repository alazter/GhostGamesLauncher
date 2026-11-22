import {
  computeCloudBackupVisualStatus,
  MS_PER_DAY
} from '../../../frontend/helpers/cloudBackupStatus'

describe('computeCloudBackupVisualStatus', () => {
  const baseNow = new Date('2026-11-22T12:00:00Z').getTime()

  it('returns inactive when provider is none', () => {
    expect(
      computeCloudBackupVisualStatus({
        provider: 'none',
        lastSuccess: baseNow,
        now: baseNow
      })
    ).toEqual({ state: 'inactive', daysSinceBackup: 0 })
  })

  it('returns inactive when connected but never backed up and no error', () => {
    expect(
      computeCloudBackupVisualStatus({
        provider: 'google',
        lastSuccess: 0,
        now: baseNow
      })
    ).toEqual({ state: 'inactive', daysSinceBackup: 0 })
  })

  it('returns error only when never backed up and an error occurred', () => {
    expect(
      computeCloudBackupVisualStatus({
        provider: 'google',
        lastSuccess: 0,
        lastError: 'Network error',
        now: baseNow
      })
    ).toEqual({ state: 'error', daysSinceBackup: 0 })
  })

  it.each([0, 1, 2, 3])(
    'returns updated (green) for %i day(s) since last backup, even if a background attempt errored',
    (days) => {
      const lastSuccess = baseNow - days * MS_PER_DAY - 1000
      expect(
        computeCloudBackupVisualStatus({
          provider: 'google',
          lastSuccess,
          lastError: 'RangeError: Invalid string length',
          now: baseNow
        })
      ).toEqual({ state: 'updated', daysSinceBackup: days })
    }
  )

  it.each([4, 5, 6])(
    'returns warning (yellow) for %i days since last backup',
    (days) => {
      const lastSuccess = baseNow - days * MS_PER_DAY - 1000
      expect(
        computeCloudBackupVisualStatus({
          provider: 'google',
          lastSuccess,
          now: baseNow
        })
      ).toEqual({ state: 'warning', daysSinceBackup: days })
    }
  )

  it.each([7, 8, 14, 30])(
    'returns overdue (red) for %i days since last backup',
    (days) => {
      const lastSuccess = baseNow - days * MS_PER_DAY - 1000
      expect(
        computeCloudBackupVisualStatus({
          provider: 'google',
          lastSuccess,
          now: baseNow
        })
      ).toEqual({ state: 'overdue', daysSinceBackup: days })
    }
  )
})
