import { isNewerRelease } from 'common/utils'
import { extractVersionFromText } from '../websiteSource'

describe('Game Version & Update Integrity', () => {
  describe('isNewerRelease comparator', () => {
    it('corretamente identifica que v1.0.4 e v1.0.5 são mais novos que v0.94', () => {
      expect(isNewerRelease('v0.94', 'V 1.0.4')).toBe(true)
      expect(isNewerRelease('v0.94', 'v1.0.5')).toBe(true)
      expect(isNewerRelease('v1.0.4', 'v1.0.5')).toBe(true)
    })

    it('rejeita regressões para versões mais antigas', () => {
      expect(isNewerRelease('v1.0.5', 'v0.94')).toBe(false)
      expect(isNewerRelease('V 1.0.4', 'v0.94')).toBe(false)
      expect(isNewerRelease('v1.0.5', 'v1.0.4')).toBe(false)
    })

    it('compara builds numéricas e datas de lançamento', () => {
      expect(isNewerRelease('Build 24000000', 'Build 25442319')).toBe(true)
      expect(isNewerRelease('Build 25442319', 'Build 24000000')).toBe(false)
      expect(isNewerRelease('2025-08-25', '2026-07-27')).toBe(true)
      expect(isNewerRelease('2026-07-27', '2025-08-25')).toBe(false)
    })
  })

  describe('extractVersionFromText', () => {
    it('extrai versões com prefixo V e espaços ou pontuação', () => {
      expect(extractVersionFromText('Assassin\'s Creed Black Flag Resynced V 1.0.4')).toBe('v1.0.4')
      expect(extractVersionFromText('<span title="V 1.0.5">V 1.0.5</span>')).toBe('v1.0.5')
      expect(extractVersionFromText('Dune Awakening (Build 25442319)')).toBe('Build 25442319')
      expect(extractVersionFromText('White Knuckle Free Download (v0.61d) | AnkerGames')).toBe('v0.61d')
      expect(extractVersionFromText('<span title="V 0.61d">V 0.61d</span>')).toBe('v0.61d')
      expect(extractVersionFromText('STAR WARS Zero Company Free Download (Build 25513890) | AnkerGames')).toBe('Build 25513890')
      expect(extractVersionFromText('B 25513890')).toBe('Build 25513890')
    })

    it('rejeita versões espúrias de requisitos de hardware (DirectX, Shader Model, OpenGL)', () => {
      expect(extractVersionFromText('DirectX: Version 9.0')).toBeUndefined()
      expect(extractVersionFromText('DirectX: Version 9.0c')).toBeUndefined()
      expect(extractVersionFromText('DirectX 12')).toBeUndefined()
      expect(extractVersionFromText('OpenGL 4.5, DirectX 11')).toBeUndefined()
      expect(extractVersionFromText('Shader Model 5.0')).toBeUndefined()
      expect(extractVersionFromText('Version: v1.0.4 | DirectX 11')).toBe('v1.0.4')
    })

    it('mantém a versão mais recente ao encontrar múltiplos candidatos', () => {
      const candidates = ['v0.94', 'v1.0.4', 'v1.0.5']
      let best = candidates[0]
      for (const c of candidates) {
        if (isNewerRelease(best, c)) {
          best = c
        }
      }
      expect(best).toBe('v1.0.5')
    })
  })
})
