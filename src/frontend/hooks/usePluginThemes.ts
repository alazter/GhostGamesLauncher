import { useEffect } from 'react'

export function usePluginThemes(): void {
  useEffect(() => {
    const styleElementId = 'ghost-plugins-active-styles'

    const applyCSSMap = (cssMap: Record<string, string>) => {
      let styleTag = document.getElementById(styleElementId) as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = styleElementId
        document.head.appendChild(styleTag)
      }

      const combinedCss = Object.entries(cssMap)
        .filter(([, css]) => Boolean(css && css.trim()))
        .map(([pluginId, css]) => `/* === [Ghost Plugin: ${pluginId}] === */\n${css}`)
        .join('\n\n')

      styleTag.textContent = combinedCss
    }

    // Initial load of active plugins CSS
    if (window.api?.pluginsGetActiveCSS) {
      window.api.pluginsGetActiveCSS()
        .then((cssMap) => {
          applyCSSMap(cssMap || {})
        })
        .catch((err) => {
          console.warn('[usePluginThemes] Failed to load active plugins CSS:', err)
        })
    }

    let removeListener: (() => void) | undefined
    if (window.api?.onPluginsCssChanged) {
      removeListener = window.api.onPluginsCssChanged((event, cssMap) => {
        applyCSSMap(cssMap || {})
      })
    }

    return () => {
      if (typeof removeListener === 'function') {
        removeListener()
      }
    }
  }, [])
}
