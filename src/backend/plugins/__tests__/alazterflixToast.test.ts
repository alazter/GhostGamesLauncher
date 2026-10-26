import {
  computeToastDuration,
  resolveToastIconType
} from '../../../frontend/screens/Alazterflix/toastUtils'

describe('Alazterflix Toast Utils', () => {
  describe('computeToastDuration', () => {
    test('returns 4000ms for standard success feedback messages', () => {
      const message =
        '✓ Capa e informações salvas para Police Squad - Esquadrão de Polícia!'
      expect(computeToastDuration(message)).toBe(4000)
    })

    test('returns 4000ms for short messages and errors without ellipses', () => {
      expect(computeToastDuration('Erro ao salvar informações')).toBe(4000)
      expect(computeToastDuration('Informações salvas')).toBe(4000)
    })

    test('returns 20000ms safe timeout for in-progress operations with ellipses or keywords', () => {
      expect(computeToastDuration('Buscando informações do TMDb…')).toBe(20000)
      expect(computeToastDuration('Sincronizando catálogo...')).toBe(20000)
      expect(computeToastDuration('Buscando capas')).toBe(20000)
      expect(computeToastDuration('Catalogando pasta de vídeos')).toBe(20000)
    })
  })

  describe('resolveToastIconType', () => {
    test('resolves to loading when text has ellipses', () => {
      expect(resolveToastIconType('Buscando metadados...')).toBe('loading')
      expect(resolveToastIconType('Processando…')).toBe('loading')
    })

    test('resolves to error when text includes error keyword', () => {
      expect(resolveToastIconType('Erro ao conectar ao servidor')).toBe('error')
      expect(resolveToastIconType('Houve um erro inesperado')).toBe('error')
    })

    test('resolves to success for normal confirmation messages', () => {
      expect(
        resolveToastIconType(
          '✓ Capa e informações salvas para Police Squad - Esquadrão de Polícia!'
        )
      ).toBe('success')
      expect(resolveToastIconType('Arquivo excluído com sucesso')).toBe('success')
    })
  })
})
