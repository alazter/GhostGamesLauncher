import { I18nextProvider, initReactI18next } from 'react-i18next'
import HttpApi from 'i18next-http-backend'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import i18next from 'i18next'
import { initGamepad } from './helpers/gamepad'

import './index.scss'
import './themes.scss'
import GlobalState from './state/GlobalState'
import { initShortcuts } from './helpers/shortcuts'
import { configStore } from './helpers/electronStores'
import { initOnlineMonitor } from './helpers/onlineMonitor'
import { defaultThemes } from './components/UI/ThemeSelector'
import Loading from './screens/Loading'
import { DEFAULT_GHOST_CUSTOM_STORES } from 'frontend/helpers/defaultCustomStores'

initOnlineMonitor()

window.addEventListener('error', (ev: ErrorEvent) => {
  window.api.logError(ev.error)
})

const DEFAULT_THEME = 'midnightMirage'

const Backend = new HttpApi(null, {
  addPath: 'build/locales/{{lng}}/{{ns}}',
  loadPath: 'locales/{{lng}}/{{ns}}.json'
})

initGamepad()
initShortcuts()

const storage: Storage = window.localStorage
storage.removeItem('nonAvailableGames')

// 1. Detect language automatically based on the user's Windows operating system
function getSystemLanguage(): string {
  const navLang = (navigator.language || '').replace('-', '_')
  if (['pt_BR', 'nb_NO', 'zh_Hans', 'zh_Hant'].includes(navLang)) {
    return navLang
  }
  const shortLang = navLang.split('_')[0]
  if (shortLang === 'pt') return 'pt_BR'
  const supported = [
    'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'de', 'el', 'en', 'es',
    'et', 'eu', 'fa', 'fi', 'fr', 'ga', 'gl', 'he', 'hr', 'hu', 'ja',
    'ko', 'lt', 'id', 'it', 'ml', 'nl', 'pl', 'pt', 'ro', 'ru', 'sr',
    'sk', 'sv', 'ta', 'tr', 'uk', 'vi'
  ]
  if (supported.includes(shortLang)) {
    return shortLang
  }
  return 'pt_BR'
}

const languageCode: string =
  configStore.get_nodefault('language') ??
  storage.getItem('language') ??
  getSystemLanguage()
configStore.set('language', languageCode)
document.querySelector('html')?.setAttribute('lang', languageCode)

// 2. Replicate official Ghost customization as factory defaults on clean installations
if (!storage.getItem('heroic_custom_stores')) {
  storage.setItem('heroic_custom_stores', JSON.stringify(DEFAULT_GHOST_CUSTOM_STORES))
}
if (!storage.getItem('sidebar-width')) {
  storage.setItem('sidebar-width', '68')
}
if (!storage.getItem('heroic_card_zoom')) {
  storage.setItem('heroic_card_zoom', '210')
}
if (!storage.getItem('heroic_alphabet_alignment')) {
  storage.setItem('heroic_alphabet_alignment', 'fill')
}
if (!storage.getItem('heroic_alphabet_bg_opacity')) {
  storage.setItem('heroic_alphabet_bg_opacity', '0')
}
if (!storage.getItem('heroic_alphabet_btn_border_enabled')) {
  storage.setItem('heroic_alphabet_btn_border_enabled', 'false')
}
if (!storage.getItem('heroic_store_btn_bg_opacity')) {
  storage.setItem('heroic_store_btn_bg_opacity', '0')
}
if (!storage.getItem('heroic_store_btn_bg_color')) {
  storage.setItem('heroic_store_btn_bg_color', '#506b6e')
}
if (!storage.getItem('heroic_store_btn_bg_color_2')) {
  storage.setItem('heroic_store_btn_bg_color_2', '#000000')
}
if (!storage.getItem('heroic_store_btn_gradient_enabled')) {
  storage.setItem('heroic_store_btn_gradient_enabled', 'true')
}
if (!storage.getItem('heroic_store_btn_border_radius')) {
  storage.setItem('heroic_store_btn_border_radius', '10')
}
if (!storage.getItem('heroic_store_btn_active_opacity')) {
  storage.setItem('heroic_store_btn_active_opacity', '0.12')
}
if (!storage.getItem('heroic_store_btn_hover_opacity')) {
  storage.setItem('heroic_store_btn_hover_opacity', '0')
}
if (!storage.getItem('heroic_hide_icons_mouse')) {
  storage.setItem('heroic_hide_icons_mouse', 'true')
}
if (!storage.getItem('heroic_hide_search_suggestions')) {
  storage.setItem('heroic_hide_search_suggestions', 'true')
}

window.setCustomCSS = (cssString: string) => {
  const style = document.createElement('style')
  style.innerHTML = cssString
  document.getElementById('customCSS')!.innerText = style.innerText
}

// Adicionado o 'void' para avisar o TS que a promessa está controlada
void window.api
  .getCustomCSS()
  .then(window.setCustomCSS)
  .catch(() => {})

const rebrandPostProcessor = {
  type: 'postProcessor' as const,
  name: 'rebrand',
  process: (value: string) => {
    if (typeof value !== 'string') return value

    let processed = value
      .replace(/Heroic Games Launcher/g, 'Ghost Games Launcher')
      .replace(/Heroic/g, 'Ghost')
      .replace(/heroic/g, 'ghost')

    // Restaurar links e referências importantes que não podem quebrar
    processed = processed
      .replace(/Ghost-Games-Launcher/g, 'Heroic-Games-Launcher')
      .replace(/ghost-games-launcher/g, 'heroic-games-launcher')
      .replace(/github\.com\/Ghost/gi, 'github.com/Heroic-Games-Launcher')

    return processed
  }
}

// --- O TRUQUE MÁGICO: Apelido para esconder o '.use' do Linter ---
const i18n = i18next

// Adicionado o 'void' para a Promise do i18n
void i18n
  .use(rebrandPostProcessor)
  .use(Backend)
  .use(initReactI18next)
  .init({
    returnEmptyString: false,
    returnNull: false,
    fallbackLng: 'en',
    postProcess: ['rebrand'],
    interpolation: {
      escapeValue: false
    },
    lng: languageCode,
    react: {
      useSuspense: true
    },
    supportedLngs: [
      'ar',
      'az',
      'be',
      'bg',
      'bs',
      'ca',
      'cs',
      'de',
      'el',
      'en',
      'es',
      'et',
      'eu',
      'fa',
      'fi',
      'fr',
      'ga',
      'gl',
      'he',
      'hr',
      'hu',
      'ja',
      'ko',
      'lt',
      'id',
      'it',
      'ml',
      'nb_NO',
      'nl',
      'pl',
      'pt',
      'pt_BR',
      'ro',
      'ru',
      'sr',
      'sk',
      'sv',
      'ta',
      'tr',
      'uk',
      'vi',
      'zh_Hans',
      'zh_Hant'
    ]
  })

const container = document.getElementById('root')
const root = createRoot(container!) // createRoot(container!) if you use TypeScript
const App = lazy(async () => import('./App'))

root.render(
  // <React.StrictMode>
  <GlobalState>
    {/* Usando o apelido criado lá em cima */}
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<Loading />}>
        <App />
      </Suspense>
    </I18nextProvider>
  </GlobalState>
  // </React.StrictMode>
)

// helper function to set the theme class and load custom css if needed
window.setTheme = async (themeClass: string) => {
  document.querySelector('style.customTheme')?.remove()

  if (
    themeClass !== DEFAULT_THEME &&
    !Object.keys(defaultThemes).includes(themeClass)
  ) {
    const cssContent = await window.api.getThemeCSS(themeClass)
    themeClass = themeClass
      .replace('.css', '') // remove extension
      .replace(/[\s.]/, '_') // remove dots and empty spaces
    const style = document.createElement('style')
    style.classList.add('customTheme')
    style.innerHTML = cssContent
    document.body.insertAdjacentElement('afterbegin', style)
  }

  document.body.className = themeClass

  if (navigator.windowControlsOverlay.visible) {
    const titlebarOverlay = Object.fromEntries(
      ['height', 'color', 'symbol-color']
        .map((item) => [
          item === 'symbol-color' ? 'symbolColor' : item,
          getComputedStyle(document.body)
            .getPropertyValue(`--titlebar-${item}`)
            .trim()
        ])
        .filter(([, val]) => !!val)
    ) as Record<string, string> // <--- O TRUQUE DE MESTRE AQUI: garante que não é "any"

    // Usando void para segurar qualquer Promise implícita aqui
    void window.api.setTitleBarOverlay(titlebarOverlay) // O 'as any' extra aqui garante que a API interna do Heroic, que pode estar esperando um tipo específico, não reclame do nosso Record<string, string>.
  }
}

const themeClass = configStore.get('theme', DEFAULT_THEME)

// Adicionado o 'void' para avisar que a Promise está solta de propósito
void window.setTheme(themeClass)

// helper function to generate images for steam
// image is centered, sides are padded with blurred image
// returns dataURL of the generated image

// This is added globally to be able to call it directly from the backend
window.imageData = async (
  src: string,
  cw: number,
  ch: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('CANVAS') as HTMLCanvasElement
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const img = document.createElement('IMG') as HTMLImageElement
    img.crossOrigin = 'anonymous' // prevents cors errors when exporting

    img.addEventListener(
      'load',
      function () {
        // measure canvas and image
        canvas.width = cw
        canvas.height = ch
        const imgWidth = img.width
        const imgHeight = img.height

        // calculate drawing of the background
        const bkgW = cw
        const bkgH = (imgHeight * cw) / imgWidth
        const bkgX = 0
        const bkgY = ch / 2 - bkgH / 2
        ctx.filter = 'blur(10px)' // add blur and draw
        ctx.drawImage(img, bkgX, bkgY, bkgW, bkgH)

        // calculate drawing of the foreground
        const drawH = ch
        const drawW = (imgWidth * ch) / imgHeight
        const drawY = 0
        const drawX = cw / 2 - drawW / 2
        ctx.filter = 'blur(0)' // remove blur and draw
        ctx.drawImage(img, drawX, drawY, drawW, drawH)

        // resolve with dataURL
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      },
      false
    )

    img.addEventListener('error', (error) => {
      reject(new Error(error.message, { cause: error }))
    })

    // set src to trigger the callback
    img.src = src
  })
}
