/**
 * Singleton de Visibilidade de Imagens de Alta Performance do Ghost Games Launcher
 * 
 * Utiliza exclusivamente a API nativa de C++ do IntersectionObserver do Chromium:
 * 1. Um único IntersectionObserver compartilhado (root: null, rootMargin: '1200px 0px')
 * 2. Zero chamadas síncronas a getBoundingClientRect() (zero layout thrashing)
 * 3. Zero listeners de scroll síncronos na thread de UI
 * 4. Monitoramento bidirecional: ativa a capa ao entrar no buffer (1200px) e descarrega a textura da VRAM ao sair
 */

type VisibilityCallback = (isVisible: boolean) => void

const observedElements = new Map<Element, VisibilityCallback>()

let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          const callback = observedElements.get(entry.target)
          if (callback) {
            callback(entry.isIntersecting)
          }
        }
      },
      {
        root: null, // Viewport global da janela - cobre containers aninhados naturalmente
        rootMargin: '1200px 0px', // Antecipa o carregamento em 1200px antes de entrar na tela e descarrega ao afastar
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
 * Registra um elemento HTML para ser notificado sobre mudanças de visibilidade na área
 * de visualização (margem de 1200px).
 * Retorna uma função de limpeza para desregistrar.
 */
export function observeImageVisibility(
  el: Element,
  onVisibilityChange: (isVisible: boolean) => void
): () => void {
  const observer = getSharedObserver()
  if (!observer) {
    onVisibilityChange(true)
    return () => {}
  }

  observedElements.set(el, onVisibilityChange)
  observer.observe(el)

  return () => {
    observedElements.delete(el)
    observer.unobserve(el)
  }
}

