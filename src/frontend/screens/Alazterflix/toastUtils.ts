/**
 * Utilitários e regras de exibição para toasts/feedbacks no Alazterflix.
 */

export function computeToastDuration(message: string): number {
  const normalized = message.toLowerCase()
  const isInProgress =
    message.includes('…') ||
    message.includes('...') ||
    normalized.includes('buscando') ||
    normalized.includes('catalogando')

  return isInProgress ? 20000 : 4000
}

export function resolveToastIconType(message: string): 'loading' | 'error' | 'success' {
  if (message.includes('…') || message.includes('...')) {
    return 'loading'
  }
  if (message.toLowerCase().includes('erro')) {
    return 'error'
  }
  return 'success'
}
