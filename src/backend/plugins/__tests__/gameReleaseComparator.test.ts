import { parseDateToIso, isNewerGameRelease } from 'common/utils'

describe('Universal Date Parser and Composite Release Comparator', () => {
  describe('parseDateToIso', () => {
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

  describe('isNewerGameRelease (Tupla Instalada vs Tupla do Site)', () => {
    it('Cenário 1: Confirma update quando a data do site for posterior, mesmo com formatos de versão diferentes', () => {
      const installed = {
        version: 'Build 25134257',
        sourceDate: '2026-09-10'
      }
      const site = {
        version: 'v1.0.4',
        sourceDate: '2026-09-29'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(true)
      expect(res.reason).toBe('date')
    })

    it('Cenário 2: Confirma update em hotfix/repack com crack novo mantendo a mesma versão textual', () => {
      const installed = {
        version: 'v1.0.2',
        sourceDate: '2026-09-15'
      }
      const site = {
        version: 'v1.0.2',
        sourceDate: '2026-09-29'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(true)
      expect(res.reason).toBe('date')
    })

    it('Cenário 3: Desempata pela versão quando as datas forem idênticas (mesmo dia)', () => {
      const installed = {
        version: 'Build 25000000',
        sourceDate: '2026-09-29'
      }
      const site = {
        version: 'Build 25513890',
        sourceDate: '2026-09-29'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(true)
      expect(res.reason).toBe('version')
    })

    it('Cenário 4: Identifica jogo perfeitamente atualizado quando versão e data forem idênticas', () => {
      const installed = {
        version: 'v0.61d',
        sourceDate: '2026-09-29'
      }
      const site = {
        version: 'v0.61d',
        sourceDate: '2026-09-29'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(false)
      expect(res.reason).toBe('same')
    })

    it('Cenário 5: Rejeita quando a data da fonte for anterior à instalada', () => {
      const installed = {
        version: 'v1.2.0',
        sourceDate: '2026-09-29'
      }
      const site = {
        version: 'v1.1.0',
        sourceDate: '2026-09-10'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(false)
      expect(res.reason).toBe('date')
    })

    it('Cenário 6: Utiliza uploadDate como fallback seguro quando sourceDate não estiver preenchido', () => {
      const installed = {
        version: 'v1.0',
        uploadDate: 'September 10, 2026'
      }
      const site = {
        version: 'v1.0',
        uploadDate: 'September 29, 2026'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(true)
      expect(res.reason).toBe('date')
    })

    it('Cenário 7: Fallback para comparação semântica tradicional quando datas estiverem ausentes', () => {
      const installed = {
        version: 'v1.0.0'
      }
      const site = {
        version: 'v1.1.0'
      }
      const res = isNewerGameRelease(installed, site)
      expect(res.isNewer).toBe(true)
      expect(res.reason).toBe('version')

      const resReverse = isNewerGameRelease(site, installed)
      expect(resReverse.isNewer).toBe(false)
      expect(resReverse.reason).toBe('version')
    })
  })
})
