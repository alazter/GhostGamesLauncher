/**
 * Singleton de Visibilidade de Imagens do Ghost Games Launcher
 * 
 * Substitui a criação de milhares de instâncias de IntersectionObserver por:
 * 1. Um único IntersectionObserver compartilhado (root: null, rootMargin: '1200px 0px')
 * 2. Pré-checagem geométrica instantânea no registro (0ms para cards no viewport)
 * 3. Varredura global passiva em eventos de 'scroll', 'scrollend' e 'resize'
 * 4. Desobservação imediata assim que a imagem entra em visualização
 */

const pendingElements = new Map<Element, () => void>()

let sharedObserver: IntersectionObserver | null = null
let isListenersInitialized = false
let sweepScheduled = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = pendingElements.get(entry.target)
            if (cb) {
              pendingElements.delete(entry.target)
              sharedObserver?.unobserve(entry.target)
              cb()
            }
          }
        }
      },
      {
        root: null, // Viewport global da janela - universal para containers aninhados
        rootMargin: '1200px 0px', // Antecipa o carregamento em 1200px antes de entrar na tela
        threshold: 0
      }
    )
  }
  return sharedObserver!
}

/**
 * Varre os elementos pendentes para acionar qualquer card que esteja dentro
 * da janela de visualização expandida (viewport + 1200px).
 */
export function sweepVisibleImages(): void {
  if (pendingElements.size === 0) return

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // Agenda varredura no próximo quadro de animação
  if (!sweepScheduled) {
    sweepScheduled = true
    requestAnimationFrame(() => {
      sweepScheduled = false
      runSweep()
    })
  }

  // Agenda também uma varredura de repouso (100ms após o término do scroll)
  debounceTimer = setTimeout(() => {
    runSweep()
  }, 100)
}

function runSweep(): void {
  if (pendingElements.size === 0) return

  const windowHeight =
    typeof window !== 'undefined'
      ? window.innerHeight || document.documentElement.clientHeight || 1000
      : 1000

  const topThreshold = -1200
  const bottomThreshold = windowHeight + 1200

  const triggered: Array<() => void> = []

  for (const [el, cb] of pendingElements.entries()) {
    const rect = el.getBoundingClientRect()
    // Elemento está no range de carregamento antecipado
    if (rect.top < bottomThreshold && rect.bottom > topThreshold) {
      triggered.push(() => {
        pendingElements.delete(el)
        sharedObserver?.unobserve(el)
        cb()
      })
    }
  }

  for (const trigger of triggered) {
    trigger()
  }
}

function initGlobalListeners(): void {
  if (isListenersInitialized || typeof window === 'undefined') return
  isListenersInitialized = true

  // Captura eventos de scroll de qualquer container aninhado na aplicação (ex: #games-scroll-area)
  window.addEventListener('scroll', sweepVisibleImages, {
    capture: true,
    passive: true
  })

  // Evento nativo disparado no término da rolagem
  window.addEventListener('scrollend', sweepVisibleImages, {
    capture: true,
    passive: true
  })

  window.addEventListener('resize', sweepVisibleImages, {
    passive: true
  })
}

/**
 * Registra um elemento HTML para ser notificado assim que estiver visível ou próximo
 * da área de visualização.
 * Retorna uma função de limpeza para desregistrar.
 */
export function observeImageVisibility(
  el: Element,
  onVisible: () => void
): () => void {
  initGlobalListeners()

  // 1. Verificação instantânea: se o elemento já estiver dentro da margem visível
  const rect = el.getBoundingClientRect()
  const windowHeight =
    typeof window !== 'undefined'
      ? window.innerHeight || document.documentElement.clientHeight || 1000
      : 1000

  if (
    rect.top < windowHeight + 1200 &&
    rect.bottom > -1200 &&
    (rect.height > 0 || rect.width > 0)
  ) {
    onVisible()
    return () => {}
  }

  // 2. Se estiver fora da margem, adiciona ao observador compartilhado e ao mapa pendente
  pendingElements.set(el, onVisible)
  const observer = getSharedObserver()
  if (observer) {
    observer.observe(el)
  }

  return () => {
    pendingElements.delete(el)
    observer?.unobserve(el)
  }
}
