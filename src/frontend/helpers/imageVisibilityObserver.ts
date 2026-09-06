/**
 * Singleton de Visibilidade de Imagens de Alta Performance do Ghost Games Launcher
 * 
 * Utiliza exclusivamente a API nativa de C++ do IntersectionObserver do Chromium:
 * 1. Um único IntersectionObserver compartilhado (root: null, rootMargin: '1000px 0px')
 * 2. Zero chamadas síncronas a getBoundingClientRect() (zero layout thrashing)
 * 3. Zero listeners de scroll síncronos na thread de UI
 * 4. Desobservação imediata assim que a imagem entra na margem de visualização
 */

const pendingElements = new Map<Element, () => void>()

let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target
            const callback = pendingElements.get(target)
            if (callback) {
              pendingElements.delete(target)
              sharedObserver?.unobserve(target)
              callback()
            }
          }
        }
      },
      {
        root: null, // Viewport global da janela - cobre containers aninhados naturalmente
        rootMargin: '1000px 0px', // Antecipa o carregamento em 1000px antes de entrar na tela
        threshold: 0
      }
    )
  }

  return sharedObserver
}

/**
 * Stub leve mantido para compatibilidade retroativa, sem overhead de CPU.
 */
export function sweepVisibleImages(): void {
  // O IntersectionObserver nativo gerencia a visibilidade de forma assíncrona em C++.
}

/**
 * Registra um elemento HTML para ser notificado assim que estiver visível ou próximo
 * da área de visualização (1000px).
 * Retorna uma função de limpeza para desregistrar.
 */
export function observeImageVisibility(
  el: Element,
  onVisible: () => void
): () => void {
  const observer = getSharedObserver()
  if (!observer) {
    onVisible()
    return () => {}
  }

  pendingElements.set(el, onVisible)
  observer.observe(el)

  return () => {
    pendingElements.delete(el)
    observer.unobserve(el)
  }
}

