/**
 * Singleton de Visibilidade de Imagens de Alta Performance do Ghost Games Launcher
 *
 * Utiliza exclusivamente a API nativa de C++ do IntersectionObserver do Chromium:
 * 1. Um IntersectionObserver compartilhado por área de rolagem (rootMargin: '1200px 0px')
 * 2. Zero chamadas síncronas a getBoundingClientRect() (zero layout thrashing)
 * 3. Zero listeners de scroll síncronos na thread de UI
 * 4. Monitoramento bidirecional: ativa a capa ao entrar no buffer (1200px) e descarrega a textura da VRAM ao sair
 */

type VisibilityCallback = (isVisible: boolean) => void

const observedElements = new Map<Element, VisibilityCallback>()

interface ObserverState {
  observer: IntersectionObserver
  count: number
}
const sharedObservers = new Map<Element | null, ObserverState>()

function getSharedObserver(root: Element | null): ObserverState | null {
  if (
    typeof window === 'undefined' ||
    typeof IntersectionObserver === 'undefined'
  ) {
    return null
  }

  let state = sharedObservers.get(root)
  if (!state) {
    const observer = new IntersectionObserver(
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
        root,
        rootMargin: '1200px 0px', // Antecipa o carregamento em 1200px antes de entrar na tela e descarrega ao afastar
        threshold: 0
      }
    )
    state = { observer, count: 0 }
    sharedObservers.set(root, state)
  }

  return state
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
  // An explicit root lets the preload margin extend inside the nested library
  // scroll area. A window-root margin would still be clipped by that container.
  const root = el.closest('#games-scroll-area')
  const state = getSharedObserver(root)
  if (!state) {
    onVisibilityChange(true)
    return () => {}
  }

  observedElements.set(el, onVisibilityChange)
  state.count++
  state.observer.observe(el)

  return () => {
    observedElements.delete(el)
    state.observer.unobserve(el)
    if (--state.count === 0) {
      state.observer.disconnect()
      sharedObservers.delete(root)
    }
  }
}
