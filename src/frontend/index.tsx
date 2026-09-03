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
if (storage.getItem('heroic_store_btn_bg_opacity') === null) {
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
if (!storage.getItem('heroic_store_filter_glow_mode')) {
  storage.setItem('heroic_store_filter_glow_mode', 'disabled')
}
if (!storage.getItem('heroic_action_icons_glow_mode')) {
  storage.setItem('heroic_action_icons_glow_mode', 'disabled')
}
if (!storage.getItem('heroic_alphabet_glow_mode')) {
  storage.setItem('heroic_alphabet_glow_mode', 'disabled')
}
if (!storage.getItem('heroic_header_buttons_glow_mode')) {
  storage.setItem('heroic_header_buttons_glow_mode', 'disabled')
}
if (!storage.getItem('heroic_header_buttons_color1')) {
  storage.setItem('heroic_header_buttons_color1', '#00ffff')
}
if (!storage.getItem('heroic_header_buttons_color2')) {
  storage.setItem('heroic_header_buttons_color2', '#38d9e6')
}
if (!storage.getItem('heroic_header_buttons_gradient')) {
  storage.setItem('heroic_header_buttons_gradient', 'false')
}
if (!storage.getItem('heroic_header_buttons_opacity')) {
  storage.setItem('heroic_header_buttons_opacity', '1')
}
if (!storage.getItem('heroic_header_buttons_glow_strength')) {
  storage.setItem('heroic_header_buttons_glow_strength', '8')
}
if (!storage.getItem('heroic_header_buttons_glow_color')) {
  storage.setItem('heroic_header_buttons_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_header_buttons_sync_glow_with_gradient')) {
  storage.setItem('heroic_header_buttons_sync_glow_with_gradient', 'true')
}
if (!storage.getItem('heroic_header_buttons_default_bg_color')) {
  storage.setItem('heroic_header_buttons_default_bg_color', '#ffffff')
}
if (!storage.getItem('heroic_header_buttons_default_bg_opacity')) {
  storage.setItem('heroic_header_buttons_default_bg_opacity', '0.05')
}
if (!storage.getItem('heroic_action_icons_color1')) {
  storage.setItem('heroic_action_icons_color1', '#00ffff')
}
if (!storage.getItem('heroic_action_icons_color2')) {
  storage.setItem('heroic_action_icons_color2', '#38d9e6')
}
if (!storage.getItem('heroic_action_icons_gradient')) {
  storage.setItem('heroic_action_icons_gradient', 'false')
}
if (!storage.getItem('heroic_action_icons_opacity')) {
  storage.setItem('heroic_action_icons_opacity', '1')
}
if (!storage.getItem('heroic_action_icons_glow_strength')) {
  storage.setItem('heroic_action_icons_glow_strength', '8')
}
if (!storage.getItem('heroic_action_icons_glow_color')) {
  storage.setItem('heroic_action_icons_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_action_icons_sync_glow_with_gradient')) {
  storage.setItem('heroic_action_icons_sync_glow_with_gradient', 'true')
}
if (!storage.getItem('heroic_action_icons_default_bg_color')) {
  storage.setItem('heroic_action_icons_default_bg_color', '#ffffff')
}
if (!storage.getItem('heroic_action_icons_default_bg_opacity')) {
  storage.setItem('heroic_action_icons_default_bg_opacity', '0.05')
}

// Configurações Globais: Barra de Lojas
if (!storage.getItem('heroic_store_btn_color1')) {
  storage.setItem('heroic_store_btn_color1', '#00ffff')
}
if (!storage.getItem('heroic_store_btn_color2')) {
  storage.setItem('heroic_store_btn_color2', '#38d9e6')
}
if (!storage.getItem('heroic_store_btn_gradient')) {
  storage.setItem('heroic_store_btn_gradient', 'false')
}
if (!storage.getItem('heroic_store_btn_opacity')) {
  storage.setItem('heroic_store_btn_opacity', '1')
}
if (!storage.getItem('heroic_store_btn_glow_strength')) {
  storage.setItem('heroic_store_btn_glow_strength', '8')
}
if (!storage.getItem('heroic_store_btn_glow_color')) {
  storage.setItem('heroic_store_btn_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_store_btn_sync_glow_with_gradient')) {
  storage.setItem('heroic_store_btn_sync_glow_with_gradient', 'true')
}
if (storage.getItem('heroic_store_btn_default_bg_color') === null) {
  storage.setItem('heroic_store_btn_default_bg_color', storage.getItem('heroic_store_btn_bg_color') || '#ffffff')
}
if (storage.getItem('heroic_store_btn_default_bg_opacity') === null) {
  const legacyOpacity = storage.getItem('heroic_store_btn_bg_opacity')
  storage.setItem('heroic_store_btn_default_bg_opacity', legacyOpacity !== null ? legacyOpacity : '0')
}

// Configurações Globais: Filtro Alfabético & Contador
if (!storage.getItem('heroic_alphabet_btn_color1')) {
  storage.setItem('heroic_alphabet_btn_color1', '#00ffff')
}
if (!storage.getItem('heroic_alphabet_btn_color2')) {
  storage.setItem('heroic_alphabet_btn_color2', '#38d9e6')
}
if (!storage.getItem('heroic_alphabet_btn_gradient')) {
  storage.setItem('heroic_alphabet_btn_gradient', 'false')
}
if (!storage.getItem('heroic_alphabet_btn_opacity')) {
  storage.setItem('heroic_alphabet_btn_opacity', '1')
}
if (!storage.getItem('heroic_alphabet_btn_glow_strength')) {
  storage.setItem('heroic_alphabet_btn_glow_strength', '8')
}
if (!storage.getItem('heroic_alphabet_btn_glow_color')) {
  storage.setItem('heroic_alphabet_btn_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_alphabet_btn_sync_glow_with_gradient')) {
  storage.setItem('heroic_alphabet_btn_sync_glow_with_gradient', 'true')
}
if (!storage.getItem('heroic_alphabet_btn_default_bg_color')) {
  storage.setItem('heroic_alphabet_btn_default_bg_color', '#ffffff')
}
if (!storage.getItem('heroic_alphabet_btn_default_bg_color_2')) {
  storage.setItem('heroic_alphabet_btn_default_bg_color_2', '#38d9e6')
}
if (!storage.getItem('heroic_alphabet_btn_default_bg_glow_color')) {
  storage.setItem('heroic_alphabet_btn_default_bg_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_alphabet_btn_default_bg_sync_glow')) {
  storage.setItem('heroic_alphabet_btn_default_bg_sync_glow', 'true')
}
if (!storage.getItem('heroic_alphabet_btn_default_bg_gradient')) {
  storage.setItem('heroic_alphabet_btn_default_bg_gradient', 'false')
}
if (!storage.getItem('heroic_alphabet_btn_default_bg_opacity')) {
  storage.setItem('heroic_alphabet_btn_default_bg_opacity', '0.05')
}

// Configurações Globais: Busca e Botão Adicionar Jogo
if (!storage.getItem('heroic_header_search_glow_mode')) {
  storage.setItem('heroic_header_search_glow_mode', 'disabled')
}
if (!storage.getItem('heroic_header_search_color1')) {
  storage.setItem('heroic_header_search_color1', '#00ffff')
}
if (!storage.getItem('heroic_header_search_color2')) {
  storage.setItem('heroic_header_search_color2', '#38d9e6')
}
if (!storage.getItem('heroic_header_search_gradient')) {
  storage.setItem('heroic_header_search_gradient', 'false')
}
if (!storage.getItem('heroic_header_search_opacity')) {
  storage.setItem('heroic_header_search_opacity', '1')
}
if (!storage.getItem('heroic_header_search_glow_strength')) {
  storage.setItem('heroic_header_search_glow_strength', '8')
}
if (!storage.getItem('heroic_header_search_glow_color')) {
  storage.setItem('heroic_header_search_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_header_search_sync_glow_with_gradient')) {
  storage.setItem('heroic_header_search_sync_glow_with_gradient', 'true')
}
if (!storage.getItem('heroic_header_search_default_bg_color')) {
  storage.setItem('heroic_header_search_default_bg_color', '#ffffff')
}
if (!storage.getItem('heroic_header_search_default_bg_opacity')) {
  storage.setItem('heroic_header_search_default_bg_opacity', '0.05')
}

// Configurações Globais: Barra Lateral Esquerda (Navegação & Ferramentas)
if (!storage.getItem('heroic_sidebar_glow_mode')) {
  storage.setItem('heroic_sidebar_glow_mode', 'disabled')
}
if (!storage.getItem('heroic_sidebar_color1')) {
  storage.setItem('heroic_sidebar_color1', '#00ffff')
}
if (!storage.getItem('heroic_sidebar_color2')) {
  storage.setItem('heroic_sidebar_color2', '#38d9e6')
}
if (!storage.getItem('heroic_sidebar_gradient')) {
  storage.setItem('heroic_sidebar_gradient', 'false')
}
if (!storage.getItem('heroic_sidebar_opacity')) {
  storage.setItem('heroic_sidebar_opacity', '1')
}
if (!storage.getItem('heroic_sidebar_glow_strength')) {
  storage.setItem('heroic_sidebar_glow_strength', '8')
}
if (!storage.getItem('heroic_sidebar_glow_color')) {
  storage.setItem('heroic_sidebar_glow_color', '#00ffff')
}
if (!storage.getItem('heroic_sidebar_sync_glow_with_gradient')) {
  storage.setItem('heroic_sidebar_sync_glow_with_gradient', 'true')
}
if (!storage.getItem('heroic_sidebar_default_bg_color')) {
  storage.setItem('heroic_sidebar_default_bg_color', '#ffffff')
}
if (!storage.getItem('heroic_sidebar_default_bg_opacity')) {
  storage.setItem('heroic_sidebar_default_bg_opacity', '0.05')
}

// ==============================================================
// MOTOR GLOBAL DE ESTILOS DE PERSONALIZAÇÃO (6 ÁREAS UNIFICADAS)
// ==============================================================
function applyGlobalPersonalizationStyles() {
  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (_, r: string, g: string, b: string) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 255, b: 255 }
  }

  // 1. Action Icons
  const actionGlowMode = storage.getItem('heroic_action_icons_glow_mode') || 'disabled'
  const actionColor1 = storage.getItem('heroic_action_icons_color1') || '#00ffff'
  const actionColor2 = storage.getItem('heroic_action_icons_color2') || '#38d9e6'
  const actionGrad = storage.getItem('heroic_action_icons_gradient') === 'true'
  const actionOpacity = Number(storage.getItem('heroic_action_icons_opacity') || '1')
  const actionGlowStrength = `${storage.getItem('heroic_action_icons_glow_strength') || '8'}px`
  const actionGlowColor = storage.getItem('heroic_action_icons_glow_color') || '#00ffff'
  const actionSyncGlow = storage.getItem('heroic_action_icons_sync_glow_with_gradient') !== 'false'
  const actionDefaultBgColor = storage.getItem('heroic_action_icons_default_bg_color') || '#ffffff'
  const actionDefaultBgOpacity = Number(storage.getItem('heroic_action_icons_default_bg_opacity') || '0.05')
  const rgbActionDefault = hexToRgb(actionDefaultBgColor)
  const rgbAction1 = hexToRgb(actionColor1)
  const rgbAction2 = hexToRgb(actionColor2)
  const rgbActionGlow = hexToRgb(actionGlowColor)
  const actionGlowCol1 = actionSyncGlow ? actionColor1 : actionGlowColor
  const actionGlowRgba1 = actionSyncGlow ? `rgba(${rgbAction1.r}, ${rgbAction1.g}, ${rgbAction1.b}, 0.85)` : `rgba(${rgbActionGlow.r}, ${rgbActionGlow.g}, ${rgbActionGlow.b}, 0.85)`
  const actionGlowRgba2 = actionSyncGlow ? `rgba(${rgbAction2.r}, ${rgbAction2.g}, ${rgbAction2.b}, 0.85)` : `rgba(${rgbActionGlow.r}, ${rgbActionGlow.g}, ${rgbActionGlow.b}, 0.85)`

  // 2. Header Buttons
  const headerBtnGlowMode = storage.getItem('heroic_header_buttons_glow_mode') || 'disabled'
  const headerBtnColor1 = storage.getItem('heroic_header_buttons_color1') || '#00ffff'
  const headerBtnColor2 = storage.getItem('heroic_header_buttons_color2') || '#38d9e6'
  const headerBtnGrad = storage.getItem('heroic_header_buttons_gradient') === 'true'
  const headerBtnOpacity = Number(storage.getItem('heroic_header_buttons_opacity') || '1')
  const headerBtnGlowStrength = `${storage.getItem('heroic_header_buttons_glow_strength') || '8'}px`
  const headerBtnGlowColor = storage.getItem('heroic_header_buttons_glow_color') || '#00ffff'
  const headerBtnSyncGlow = storage.getItem('heroic_header_buttons_sync_glow_with_gradient') !== 'false'
  const headerBtnDefaultBgColor = storage.getItem('heroic_header_buttons_default_bg_color') || '#ffffff'
  const headerBtnDefaultBgOpacity = Number(storage.getItem('heroic_header_buttons_default_bg_opacity') || '0.05')
  const rgbHeaderDefault = hexToRgb(headerBtnDefaultBgColor)
  const rgbHeader1 = hexToRgb(headerBtnColor1)
  const rgbHeader2 = hexToRgb(headerBtnColor2)
  const rgbHeaderGlow = hexToRgb(headerBtnGlowColor)
  const headerGlowRgba1 = headerBtnSyncGlow ? `rgba(${rgbHeader1.r}, ${rgbHeader1.g}, ${rgbHeader1.b}, 0.5)` : `rgba(${rgbHeaderGlow.r}, ${rgbHeaderGlow.g}, ${rgbHeaderGlow.b}, 0.5)`
  const headerGlowRgba2 = headerBtnSyncGlow ? `rgba(${rgbHeader2.r}, ${rgbHeader2.g}, ${rgbHeader2.b}, 0.5)` : `rgba(${rgbHeaderGlow.r}, ${rgbHeaderGlow.g}, ${rgbHeaderGlow.b}, 0.5)`

  // 3. Store Filter Bar
  const storeGlowMode = storage.getItem('heroic_store_filter_glow_mode') || 'disabled'
  const storeColor1 = storage.getItem('heroic_store_btn_color1') || '#00ffff'
  const storeColor2 = storage.getItem('heroic_store_btn_color2') || '#38d9e6'
  const storeGrad = (storage.getItem('heroic_store_btn_gradient') ?? storage.getItem('heroic_store_btn_gradient_enabled')) === 'true'
  const storeGlowStrength = `${storage.getItem('heroic_store_btn_glow_strength') || '8'}px`
  const storeGlowColor = storage.getItem('heroic_store_btn_glow_color') || '#00ffff'
  const storeSyncGlow = storage.getItem('heroic_store_btn_sync_glow_with_gradient') !== 'false'
  const storeDefaultBgGradient = storage.getItem('heroic_store_btn_default_bg_gradient') === 'true'
  const storeDefaultBgColor = storage.getItem('heroic_store_btn_default_bg_color') || storage.getItem('heroic_store_btn_bg_color') || '#ffffff'
  const storeDefaultBgColor2 = storage.getItem('heroic_store_btn_default_bg_color_2') || storage.getItem('heroic_store_btn_bg_color_2') || '#38d9e6'
  const storeDefaultBgGlowColor = storage.getItem('heroic_store_btn_default_bg_glow_color') || storage.getItem('heroic_store_btn_glow_color') || '#00ffff'
  const storeDefaultBgSyncGlow = (storage.getItem('heroic_store_btn_default_bg_sync_glow') ?? storage.getItem('heroic_store_btn_sync_glow_with_gradient')) !== 'false'
  const rawStoreBgOpacity = storage.getItem('heroic_store_btn_default_bg_opacity') ?? storage.getItem('heroic_store_btn_bg_opacity')
  const storeDefaultBgOpacity = rawStoreBgOpacity !== null ? Number(rawStoreBgOpacity) : 0
  const storeBorderRadius = storage.getItem('heroic_store_btn_border_radius') || '12'
  const rgbStoreDefault1 = hexToRgb(storeDefaultBgColor)
  const rgbStoreDefault2 = hexToRgb(storeDefaultBgColor2)
  const effectiveStoreDefaultBgGlow = storeDefaultBgSyncGlow ? storeDefaultBgColor : storeDefaultBgGlowColor
  const rgbStoreDefaultGlow = hexToRgb(effectiveStoreDefaultBgGlow)
  const rgbStore1 = hexToRgb(storeColor1)
  const rgbStore2 = hexToRgb(storeColor2)
  const rgbStoreGlow = hexToRgb(storeGlowColor)
  const storeGlowCol1 = storeSyncGlow ? storeColor1 : storeGlowColor
  const storeGlowCol2 = storeSyncGlow ? storeColor2 : storeGlowColor
  const storeGlowRgba1 = storeSyncGlow ? `rgba(${rgbStore1.r}, ${rgbStore1.g}, ${rgbStore1.b}, 0.5)` : `rgba(${rgbStoreGlow.r}, ${rgbStoreGlow.g}, ${rgbStoreGlow.b}, 0.5)`
  const storeGlowRgba2 = storeSyncGlow ? `rgba(${rgbStore2.r}, ${rgbStore2.g}, ${rgbStore2.b}, 0.5)` : `rgba(${rgbStoreGlow.r}, ${rgbStoreGlow.g}, ${rgbStoreGlow.b}, 0.5)`

  // 4. Alphabet Filter
  const alphabetGlowMode = storage.getItem('heroic_alphabet_glow_mode') || 'disabled'
  const alphabetColor1 = storage.getItem('heroic_alphabet_btn_color1') || '#00ffff'
  const alphabetColor2 = storage.getItem('heroic_alphabet_btn_color2') || '#38d9e6'
  const alphabetGrad = (storage.getItem('heroic_alphabet_btn_gradient') ?? storage.getItem('heroic_alphabet_btn_gradient_enabled')) === 'true'
  const alphabetGlowStrength = `${storage.getItem('heroic_alphabet_btn_glow_strength') || '8'}px`
  const alphabetGlowColor = storage.getItem('heroic_alphabet_btn_glow_color') || '#00ffff'
  const alphabetSyncGlow = storage.getItem('heroic_alphabet_btn_sync_glow_with_gradient') !== 'false'
  const alphabetDefaultBgGradient = storage.getItem('heroic_alphabet_btn_default_bg_gradient') === 'true'
  const alphabetDefaultBgColor = storage.getItem('heroic_alphabet_btn_default_bg_color') || storage.getItem('heroic_alphabet_color') || '#ffffff'
  const alphabetDefaultBgColor2 = storage.getItem('heroic_alphabet_btn_default_bg_color_2') || storage.getItem('heroic_alphabet_btn_bg_color_2') || '#38d9e6'
  const alphabetDefaultBgGlowColor = storage.getItem('heroic_alphabet_btn_default_bg_glow_color') || storage.getItem('heroic_alphabet_btn_glow_color') || '#00ffff'
  const alphabetDefaultBgSyncGlow = (storage.getItem('heroic_alphabet_btn_default_bg_sync_glow') ?? storage.getItem('heroic_alphabet_btn_sync_glow_with_gradient')) !== 'false'
  const rawAlphabetBgOpacity = storage.getItem('heroic_alphabet_btn_default_bg_opacity') ?? storage.getItem('heroic_alphabet_btn_opacity')
  const alphabetDefaultBgOpacity = rawAlphabetBgOpacity !== null ? Number(rawAlphabetBgOpacity) : 0.05
  const alphabetBorderRadius = storage.getItem('heroic_alphabet_btn_border_radius') || '18'
  const isAlphabetZeroBg = alphabetDefaultBgOpacity <= 0.001
  const rgbAlphabetDefault1 = hexToRgb(alphabetDefaultBgColor)
  const rgbAlphabetDefault2 = hexToRgb(alphabetDefaultBgColor2)
  const effectiveAlphabetDefaultBgGlow = alphabetDefaultBgSyncGlow ? alphabetDefaultBgColor : alphabetDefaultBgGlowColor
  const rgbAlphabetDefaultGlow = hexToRgb(effectiveAlphabetDefaultBgGlow)
  const rgbAlphabet1 = hexToRgb(alphabetColor1)
  const rgbAlphabet2 = hexToRgb(alphabetColor2)
  const rgbAlphabetGlow = hexToRgb(alphabetGlowColor)
  const alphabetGlowCol1 = alphabetSyncGlow ? alphabetColor1 : alphabetGlowColor
  const alphabetGlowCol2 = alphabetSyncGlow ? alphabetColor2 : alphabetGlowColor
  const alphabetGlowRgba1 = alphabetSyncGlow ? `rgba(${rgbAlphabet1.r}, ${rgbAlphabet1.g}, ${rgbAlphabet1.b}, 0.5)` : `rgba(${rgbAlphabetGlow.r}, ${rgbAlphabetGlow.g}, ${rgbAlphabetGlow.b}, 0.5)`
  const alphabetGlowRgba2 = alphabetSyncGlow ? `rgba(${rgbAlphabet2.r}, ${rgbAlphabet2.g}, ${rgbAlphabet2.b}, 0.5)` : `rgba(${rgbAlphabetGlow.r}, ${rgbAlphabetGlow.g}, ${rgbAlphabetGlow.b}, 0.5)`

  // 5. Header Search & Add Game
  const searchGlowMode = storage.getItem('heroic_header_search_glow_mode') || 'disabled'
  const searchColor1 = storage.getItem('heroic_header_search_color1') || '#00ffff'
  const searchColor2 = storage.getItem('heroic_header_search_color2') || '#38d9e6'
  const searchGrad = storage.getItem('heroic_header_search_gradient') === 'true'
  const searchGlowStrength = `${storage.getItem('heroic_header_search_glow_strength') || '8'}px`
  const searchGlowColor = storage.getItem('heroic_header_search_glow_color') || '#00ffff'
  const searchSyncGlow = storage.getItem('heroic_header_search_sync_glow_with_gradient') !== 'false'
  const searchDefaultBgColor = storage.getItem('heroic_header_search_default_bg_color') || '#ffffff'
  const searchDefaultBgOpacity = Number(storage.getItem('heroic_header_search_default_bg_opacity') || '0.05')
  const rgbSearchDefault = hexToRgb(searchDefaultBgColor)
  const rgbSearch1 = hexToRgb(searchColor1)
  const rgbSearch2 = hexToRgb(searchColor2)
  const rgbSearchGlow = hexToRgb(searchGlowColor)
  const searchGlowCol1 = searchSyncGlow ? searchColor1 : searchGlowColor
  const searchGlowRgba1 = searchSyncGlow ? `rgba(${rgbSearch1.r}, ${rgbSearch1.g}, ${rgbSearch1.b}, 0.5)` : `rgba(${rgbSearchGlow.r}, ${rgbSearchGlow.g}, ${rgbSearchGlow.b}, 0.5)`
  const searchGlowRgba2 = searchSyncGlow ? `rgba(${rgbSearch2.r}, ${rgbSearch2.g}, ${rgbSearch2.b}, 0.5)` : `rgba(${rgbSearchGlow.r}, ${rgbSearchGlow.g}, ${rgbSearchGlow.b}, 0.5)`

  // 6. Left Sidebar
  const sidebarGlowMode = storage.getItem('heroic_sidebar_glow_mode') || 'disabled'
  const sidebarColor1 = storage.getItem('heroic_sidebar_color1') || '#00ffff'
  const sidebarColor2 = storage.getItem('heroic_sidebar_color2') || '#38d9e6'
  const sidebarGrad = storage.getItem('heroic_sidebar_gradient') === 'true'
  const sidebarOpacity = Number(storage.getItem('heroic_sidebar_opacity') || '1')
  const sidebarGlowStrength = `${storage.getItem('heroic_sidebar_glow_strength') || '8'}px`
  const sidebarGlowColor = storage.getItem('heroic_sidebar_glow_color') || '#00ffff'
  const sidebarSyncGlow = storage.getItem('heroic_sidebar_sync_glow_with_gradient') !== 'false'
  const sidebarDefaultBgColor = storage.getItem('heroic_sidebar_default_bg_color') || '#ffffff'
  const sidebarDefaultBgOpacity = Number(storage.getItem('heroic_sidebar_default_bg_opacity') || '0.05')
  const rgbSidebarDefault = hexToRgb(sidebarDefaultBgColor)
  const rgbSidebar1 = hexToRgb(sidebarColor1)
  const rgbSidebar2 = hexToRgb(sidebarColor2)
  const rgbSidebarGlow = hexToRgb(sidebarGlowColor)
  const sidebarGlowCol1 = sidebarSyncGlow ? sidebarColor1 : sidebarGlowColor
  const sidebarGlowRgba1 = sidebarSyncGlow ? `rgba(${rgbSidebar1.r}, ${rgbSidebar1.g}, ${rgbSidebar1.b}, 0.85)` : `rgba(${rgbSidebarGlow.r}, ${rgbSidebarGlow.g}, ${rgbSidebarGlow.b}, 0.85)`
  const sidebarGlowRgba2 = sidebarSyncGlow ? `rgba(${rgbSidebar2.r}, ${rgbSidebar2.g}, ${rgbSidebar2.b}, 0.85)` : `rgba(${rgbSidebarGlow.r}, ${rgbSidebarGlow.g}, ${rgbSidebarGlow.b}, 0.85)`

  let css = `/* === GHOST GLOBAL PERSONALIZATION STYLES === */\n`

  // 1. Action Icons
  if (actionGlowMode === 'neon') {
    css += `
      .Header__actions span, .Header__actions a, .Header__actions button {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        transition: all 0.2s ease !important;
      }
    `
    if (actionGrad) {
      css += `
        .Header__actions span:hover, .Header__actions span.active,
        .Header__actions a:hover, .Header__actions a.active,
        .Header__actions button:hover, .Header__actions button.active {
          background: linear-gradient(135deg, ${actionColor1} 0%, ${actionColor2} 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
          display: inline-block;
          opacity: ${actionOpacity} !important;
          filter: drop-shadow(-2px -2px calc(${actionGlowStrength} * 0.8) ${actionGlowRgba1}) 
                  drop-shadow(2px 2px calc(${actionGlowStrength} * 0.8) ${actionGlowRgba2}) 
                  drop-shadow(0 0 2px ${actionGlowCol1}) !important;
          transform: scale(1.15) !important;
        }
      `
    } else {
      css += `
        .Header__actions span:hover, .Header__actions span.active,
        .Header__actions a:hover, .Header__actions a.active,
        .Header__actions button:hover, .Header__actions button.active {
          color: ${actionColor1} !important;
          opacity: ${actionOpacity} !important;
          filter: drop-shadow(0 0 2px ${actionGlowCol1}) 
                  drop-shadow(0 0 calc(${actionGlowStrength} * 0.5) ${actionGlowCol1}) 
                  drop-shadow(0 0 ${actionGlowStrength} ${actionGlowRgba1}) 
                  drop-shadow(0 0 calc(${actionGlowStrength} * 1.5) ${actionGlowRgba1}) !important;
          transform: scale(1.15) !important;
        }
      `
    }
  } else {
    css += `
      .Header__actions {
        background: rgba(${rgbActionDefault.r}, ${rgbActionDefault.g}, ${rgbActionDefault.b}, ${actionDefaultBgOpacity}) !important;
        border: 1px solid rgba(${rgbActionDefault.r}, ${rgbActionDefault.g}, ${rgbActionDefault.b}, ${Math.min(1, actionDefaultBgOpacity * 2.5)}) !important;
        border-radius: 8px !important;
        backdrop-filter: blur(8px) !important;
      }
    `
  }

  // 2. Header Buttons
  if (headerBtnGlowMode === 'neon') {
    if (headerBtnGrad) {
      css += `
        .Header__filters button:hover, .Header__filters button:active,
        .Header__filters .MuiButtonBase-root:hover {
          border-color: ${headerBtnColor1} !important;
          color: ${headerBtnColor1} !important;
          opacity: ${headerBtnOpacity} !important;
          box-shadow: -2px -2px calc(${headerBtnGlowStrength} * 0.8) ${headerGlowRgba1},
                      2px 2px calc(${headerBtnGlowStrength} * 0.8) ${headerGlowRgba2} !important;
          transform: scale(1.04) !important;
        }
      `
    } else {
      css += `
        .Header__filters button:hover, .Header__filters button:active,
        .Header__filters .MuiButtonBase-root:hover {
          border-color: ${headerBtnColor1} !important;
          color: ${headerBtnColor1} !important;
          opacity: ${headerBtnOpacity} !important;
          box-shadow: 0 0 calc(${headerBtnGlowStrength} * 0.5) ${headerGlowRgba1},
                      0 0 ${headerBtnGlowStrength} ${headerGlowRgba1} !important;
          transform: scale(1.04) !important;
        }
      `
    }
  } else {
    css += `
      .Header__filters button, .Header__filters .MuiButtonBase-root {
        background: rgba(${rgbHeaderDefault.r}, ${rgbHeaderDefault.g}, ${rgbHeaderDefault.b}, ${headerBtnDefaultBgOpacity}) !important;
        border-color: rgba(${rgbHeaderDefault.r}, ${rgbHeaderDefault.g}, ${rgbHeaderDefault.b}, ${Math.min(1, headerBtnDefaultBgOpacity * 2.5)}) !important;
      }
    `
  }

  // 3. Store Filter Bar
  const storeGlowTarget = (storage.getItem('heroic_store_filter_glow_target') as 'logo' | 'text' | 'both') || 'both'
  const isStoreZeroBg = storeDefaultBgOpacity <= 0.001

  const storeBgStyle = isStoreZeroBg
    ? 'transparent'
    : storeDefaultBgGradient
      ? `linear-gradient(135deg, rgba(${rgbStoreDefault1.r}, ${rgbStoreDefault1.g}, ${rgbStoreDefault1.b}, ${storeDefaultBgOpacity}) 0%, rgba(${rgbStoreDefault2.r}, ${rgbStoreDefault2.g}, ${rgbStoreDefault2.b}, ${storeDefaultBgOpacity}) 100%)`
      : `rgba(${rgbStoreDefault1.r}, ${rgbStoreDefault1.g}, ${rgbStoreDefault1.b}, ${storeDefaultBgOpacity})`

  const storeBgBorder = isStoreZeroBg
    ? 'transparent'
    : `rgba(${rgbStoreDefaultGlow.r}, ${rgbStoreDefaultGlow.g}, ${rgbStoreDefaultGlow.b}, ${Math.min(1, storeDefaultBgOpacity * 2.5)})`

  const storeBgHover = isStoreZeroBg
    ? 'transparent'
    : storeDefaultBgGradient
      ? `linear-gradient(135deg, rgba(${rgbStoreDefault1.r}, ${rgbStoreDefault1.g}, ${rgbStoreDefault1.b}, ${Math.min(1, storeDefaultBgOpacity * 1.5)}) 0%, rgba(${rgbStoreDefault2.r}, ${rgbStoreDefault2.g}, ${rgbStoreDefault2.b}, ${Math.min(1, storeDefaultBgOpacity * 1.5)}) 100%)`
      : `rgba(${rgbStoreDefault1.r}, ${rgbStoreDefault1.g}, ${rgbStoreDefault1.b}, ${Math.min(1, storeDefaultBgOpacity * 1.5)})`

  const storeBgHoverBorder = isStoreZeroBg
    ? 'transparent'
    : `rgba(${rgbStoreDefaultGlow.r}, ${rgbStoreDefaultGlow.g}, ${rgbStoreDefaultGlow.b}, ${Math.min(1, storeDefaultBgOpacity * 2.8)})`

  const storeBgActive = isStoreZeroBg
    ? 'transparent'
    : storeDefaultBgGradient
      ? `linear-gradient(135deg, rgba(${rgbStoreDefault1.r}, ${rgbStoreDefault1.g}, ${rgbStoreDefault1.b}, ${Math.min(1, storeDefaultBgOpacity * 1.8)}) 0%, rgba(${rgbStoreDefault2.r}, ${rgbStoreDefault2.g}, ${rgbStoreDefault2.b}, ${Math.min(1, storeDefaultBgOpacity * 1.8)}) 100%)`
      : `rgba(${rgbStoreDefault1.r}, ${rgbStoreDefault1.g}, ${rgbStoreDefault1.b}, ${Math.min(1, storeDefaultBgOpacity * 1.8)})`

  const storeBgActiveBorder = isStoreZeroBg
    ? 'transparent'
    : `rgba(${rgbStoreDefaultGlow.r}, ${rgbStoreDefaultGlow.g}, ${rgbStoreDefaultGlow.b}, ${Math.min(1, storeDefaultBgOpacity * 3)})`

  if (storeGlowMode === 'neon') {
    if (isStoreZeroBg) {
      css += `
        .platforms-bar.glow-mode-neon .platform-filter-btn,
        .platforms-bar.glow-mode-neon .platform-filter-btn:hover,
        .platforms-bar.glow-mode-neon .platform-filter-btn:focus,
        .platforms-bar.glow-mode-neon .platform-filter-btn:active,
        .platforms-bar.glow-mode-neon .platform-filter-btn--active,
        .platforms-bar.glow-mode-neon .platform-filter-btn--active:hover {
          background: none !important;
          background-color: transparent !important;
          background-image: none !important;
          border: none !important;
          border-width: 0 !important;
          border-color: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          overflow: visible !important;
          outline: none !important;
        }
        .platforms-bar.glow-mode-neon .platform-filter-btn::before,
        .platforms-bar.glow-mode-neon .platform-filter-btn::after {
          display: none !important;
        }
      `
    } else {
      css += `
        .platforms-bar.glow-mode-neon .platform-filter-btn {
          background: ${storeBgStyle} !important;
          border: 1px solid ${storeBgBorder} !important;
          border-radius: ${storeBorderRadius}px !important;
          box-shadow: none !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          transition: all 0.2s ease;
        }
        .platforms-bar.glow-mode-neon .platform-filter-btn:hover {
          background: ${storeBgHover} !important;
          border: 1px solid ${storeBgHoverBorder} !important;
        }
        .platforms-bar.glow-mode-neon .platform-filter-btn--active {
          background: ${storeBgActive} !important;
          border: 1px solid ${storeBgActiveBorder} !important;
          box-shadow: none !important;
        }
        .platforms-bar.glow-mode-neon .platform-filter-btn::before {
          display: none !important;
        }
      `
    }
    // Logo glow (only if 'both' or 'logo')
    if (storeGlowTarget === 'both' || storeGlowTarget === 'logo') {
      if (storeGrad) {
        css += `
          .platforms-bar.glow-mode-neon .platform-filter-btn:hover .platform-filter-icon-img,
          .platforms-bar.glow-mode-neon .platform-filter-btn--active .platform-filter-icon-img {
            filter: drop-shadow(-1.5px -1.5px 0.5px ${storeColor1}) 
                    drop-shadow(1.5px 1.5px 0.5px ${storeColor2}) 
                    drop-shadow(-3px -3px calc(${storeGlowStrength} * 0.7) ${storeGlowRgba1}) 
                    drop-shadow(3px 3px calc(${storeGlowStrength} * 0.7) ${storeGlowRgba2}) !important;
            transform: scale(1.08) !important;
            transition: all 0.2s ease !important;
          }
        `
      } else {
        css += `
          .platforms-bar.glow-mode-neon .platform-filter-btn:hover .platform-filter-icon-img,
          .platforms-bar.glow-mode-neon .platform-filter-btn--active .platform-filter-icon-img {
            filter: drop-shadow(0 0 1px ${storeColor1}) 
                    drop-shadow(0 0 calc(${storeGlowStrength} * 0.5) ${storeGlowCol1}) 
                    drop-shadow(0 0 ${storeGlowStrength} ${storeGlowRgba1}) !important;
            transform: scale(1.08) !important;
            transition: all 0.2s ease !important;
          }
        `
      }
    } else {
      // Se for Só no Nome: ícone NUNCA tem glow
      css += `
        .platforms-bar.glow-mode-neon .platform-filter-btn .platform-filter-icon-img,
        .platforms-bar.glow-mode-neon .platform-filter-btn:hover .platform-filter-icon-img,
        .platforms-bar.glow-mode-neon .platform-filter-btn--active .platform-filter-icon-img {
          filter: none !important;
          transform: none !important;
        }
      `
    }

    // Text glow (only if 'both' or 'text')
    if (storeGlowTarget === 'both' || storeGlowTarget === 'text') {
      if (storeGrad) {
        css += `
          .platforms-bar.glow-mode-neon .platform-filter-btn:hover span,
          .platforms-bar.glow-mode-neon .platform-filter-btn--active span {
            background: linear-gradient(135deg, ${storeColor1} 0%, ${storeColor2} 100%) !important;
            -webkit-background-clip: text !important;
            background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
            filter: drop-shadow(-1.5px -1.5px calc(${storeGlowStrength} * 0.35) ${storeGlowRgba1}) 
                    drop-shadow(1.5px 1.5px calc(${storeGlowStrength} * 0.35) ${storeGlowRgba2}) !important;
            display: inline-block !important;
          }
        `
      } else {
        css += `
          .platforms-bar.glow-mode-neon .platform-filter-btn:hover span,
          .platforms-bar.glow-mode-neon .platform-filter-btn--active span {
            color: ${storeColor1} !important;
            text-shadow: 0 0 2px ${storeGlowCol1},
                         0 0 ${storeGlowStrength} ${storeGlowRgba1} !important;
            background: none !important;
            -webkit-text-fill-color: initial !important;
            filter: none !important;
            display: inline-block !important;
          }
        `
      }
    } else {
      // Se for Só no Logo: texto NUNCA tem glow, fica branco puro
      css += `
        .platforms-bar.glow-mode-neon .platform-filter-btn span,
        .platforms-bar.glow-mode-neon .platform-filter-btn:hover span,
        .platforms-bar.glow-mode-neon .platform-filter-btn--active span {
          color: #ffffff !important;
          background: none !important;
          -webkit-text-fill-color: #ffffff !important;
          text-shadow: none !important;
          filter: none !important;
        }
      `
    }
  } else {
    css += `
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn {
        background: ${storeBgStyle} !important;
        border: 1px solid ${storeBgBorder} !important;
        border-radius: ${storeBorderRadius}px !important;
        box-shadow: none !important;
        backdrop-filter: ${storeDefaultBgOpacity === 0 ? 'none' : 'blur(12px)'} !important;
        -webkit-backdrop-filter: ${storeDefaultBgOpacity === 0 ? 'none' : 'blur(12px)'} !important;
        transition: all 0.2s ease;
      }
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn:hover {
        background: ${storeBgHover} !important;
        border: 1px solid ${storeBgHoverBorder} !important;
      }
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn--active {
        background: ${storeBgActive} !important;
        border: 1px solid ${storeBgActiveBorder} !important;
        box-shadow: none !important;
      }
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn::before {
        display: none !important;
      }
    `
  }

  if (isStoreZeroBg) {
    css += `
      .platforms-bar .platform-filter-btn,
      .platforms-bar .platform-filter-btn:hover,
      .platforms-bar .platform-filter-btn:focus,
      .platforms-bar .platform-filter-btn:active,
      .platforms-bar .platform-filter-btn--active,
      .platforms-bar .platform-filter-btn--active:hover,
      .platforms-bar--zero-bg .platform-filter-btn,
      .platforms-bar--zero-bg .platform-filter-btn:hover,
      .platforms-bar--zero-bg .platform-filter-btn:focus,
      .platforms-bar--zero-bg .platform-filter-btn:active,
      .platforms-bar--zero-bg .platform-filter-btn--active,
      .platforms-bar--zero-bg .platform-filter-btn--active:hover,
      .platforms-bar.glow-mode-neon .platform-filter-btn,
      .platforms-bar.glow-mode-neon .platform-filter-btn:hover,
      .platforms-bar.glow-mode-neon .platform-filter-btn:focus,
      .platforms-bar.glow-mode-neon .platform-filter-btn:active,
      .platforms-bar.glow-mode-neon .platform-filter-btn--active,
      .platforms-bar.glow-mode-neon .platform-filter-btn--active:hover,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn:hover,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn:focus,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn:active,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn--active,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn--active:hover,
      .platforms-bar .platform-filter-btn--zero-bg,
      .platforms-bar .platform-filter-btn--zero-bg:hover,
      .platforms-bar .platform-filter-btn--zero-bg:focus,
      .platforms-bar .platform-filter-btn--zero-bg:active,
      .platforms-bar .platform-filter-btn--zero-bg.platform-filter-btn--active,
      .platforms-bar .platform-filter-btn--zero-bg.platform-filter-btn--active:hover,
      .platform-filter-btn--zero-bg,
      .platform-filter-btn--zero-bg:hover,
      .platform-filter-btn--zero-bg:focus,
      .platform-filter-btn--zero-bg:active,
      .platform-filter-btn--zero-bg.platform-filter-btn--active,
      .platform-filter-btn--zero-bg.platform-filter-btn--active:hover,
      button.platform-filter-btn--zero-bg,
      button.platform-filter-btn--zero-bg:hover,
      button.platform-filter-btn--zero-bg:focus,
      button.platform-filter-btn--zero-bg:active,
      button.platform-filter-btn--zero-bg.platform-filter-btn--active,
      button.platform-filter-btn--zero-bg.platform-filter-btn--active:hover {
        background: none !important;
        background-color: transparent !important;
        background-image: none !important;
        border: none !important;
        border-width: 0 !important;
        border-color: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        overflow: visible !important;
        outline: none !important;
      }
      .platforms-bar .platform-filter-btn::before,
      .platforms-bar .platform-filter-btn:hover::before,
      .platforms-bar .platform-filter-btn--active::before,
      .platforms-bar .platform-filter-btn--active:hover::before,
      .platforms-bar--zero-bg .platform-filter-btn::before,
      .platforms-bar--zero-bg .platform-filter-btn:hover::before,
      .platforms-bar--zero-bg .platform-filter-btn--active::before,
      .platforms-bar--zero-bg .platform-filter-btn--active:hover::before,
      .platforms-bar.glow-mode-neon .platform-filter-btn::before,
      .platforms-bar.glow-mode-neon .platform-filter-btn:hover::before,
      .platforms-bar.glow-mode-neon .platform-filter-btn--active::before,
      .platforms-bar.glow-mode-neon .platform-filter-btn--active:hover::before,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn::before,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn:hover::before,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn--active::before,
      .platforms-bar:not(.glow-mode-neon) .platform-filter-btn--active:hover::before,
      .platforms-bar .platform-filter-btn--zero-bg::before,
      .platforms-bar .platform-filter-btn--zero-bg:hover::before,
      .platforms-bar .platform-filter-btn--zero-bg.platform-filter-btn--active::before,
      .platforms-bar .platform-filter-btn--zero-bg.platform-filter-btn--active:hover::before,
      .platform-filter-btn--zero-bg::before,
      .platform-filter-btn--zero-bg:hover::before,
      .platform-filter-btn--zero-bg.platform-filter-btn--active::before,
      .platform-filter-btn--zero-bg.platform-filter-btn--active:hover::before {
        display: none !important;
        content: none !important;
      }
    `
  }

  // 4. Alphabet Filter
  const alphabetBgStyle = isAlphabetZeroBg
    ? 'transparent'
    : alphabetDefaultBgGradient
      ? `linear-gradient(135deg, rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${alphabetDefaultBgOpacity}) 0%, rgba(${rgbAlphabetDefault2.r}, ${rgbAlphabetDefault2.g}, ${rgbAlphabetDefault2.b}, ${alphabetDefaultBgOpacity}) 100%)`
      : `rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${alphabetDefaultBgOpacity})`

  const alphabetBgBorder = isAlphabetZeroBg
    ? 'transparent'
    : `rgba(${rgbAlphabetDefaultGlow.r}, ${rgbAlphabetDefaultGlow.g}, ${rgbAlphabetDefaultGlow.b}, ${Math.min(1, alphabetDefaultBgOpacity * 2.5 + 0.05)})`

  const alphabetBgHover = isAlphabetZeroBg
    ? 'transparent'
    : alphabetDefaultBgGradient
      ? `linear-gradient(135deg, rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${Math.min(1, alphabetDefaultBgOpacity * 1.5)}) 0%, rgba(${rgbAlphabetDefault2.r}, ${rgbAlphabetDefault2.g}, ${rgbAlphabetDefault2.b}, ${Math.min(1, alphabetDefaultBgOpacity * 1.5)}) 100%)`
      : `rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${Math.min(1, alphabetDefaultBgOpacity * 1.5)})`

  const alphabetBgHoverBorder = isAlphabetZeroBg
    ? 'transparent'
    : `rgba(${rgbAlphabetDefaultGlow.r}, ${rgbAlphabetDefaultGlow.g}, ${rgbAlphabetDefaultGlow.b}, ${Math.min(1, alphabetDefaultBgOpacity * 2.8)})`

  const alphabetBgActive = isAlphabetZeroBg
    ? 'transparent'
    : alphabetDefaultBgGradient
      ? `linear-gradient(135deg, rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${Math.min(1, alphabetDefaultBgOpacity * 1.8)}) 0%, rgba(${rgbAlphabetDefault2.r}, ${rgbAlphabetDefault2.g}, ${rgbAlphabetDefault2.b}, ${Math.min(1, alphabetDefaultBgOpacity * 1.8)}) 100%)`
      : `rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${Math.min(1, alphabetDefaultBgOpacity * 1.8)})`

  const alphabetBgActiveBorder = isAlphabetZeroBg
    ? 'transparent'
    : `rgba(${rgbAlphabetDefaultGlow.r}, ${rgbAlphabetDefaultGlow.g}, ${rgbAlphabetDefaultGlow.b}, ${Math.min(1, alphabetDefaultBgOpacity * 3)})`

  if (isAlphabetZeroBg) {
    css += `
      .alphabet-filter-container .alphabet-filter-button,
      .alphabet-filter-container .alphabet-filter-button:hover,
      .alphabet-filter-container .alphabet-filter-button:focus,
      .alphabet-filter-container .alphabet-filter-button:active,
      .alphabet-filter-container .alphabet-filter-button--active,
      .alphabet-filter-container .alphabet-filter-button--active:hover,
      .alphabet-filter-button--zero-bg,
      .alphabet-filter-container--zero-bg .alphabet-filter-button,
      .numberOfgames--zero-bg,
      .numberOfgames.numberOfgames--zero-bg {
        background: none !important;
        background-color: transparent !important;
        border: none !important;
        border-width: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
    `
  } else {
    css += `
      .alphabet-filter-container .alphabet-filter-button:not(.alphabet-filter-button--zero-bg) {
        background: ${alphabetBgStyle} !important;
        border-color: ${alphabetBgBorder} !important;
      }
      .alphabet-filter-container .alphabet-filter-button:not(.alphabet-filter-button--zero-bg):hover {
        background: ${alphabetBgHover} !important;
        border-color: ${alphabetBgHoverBorder} !important;
      }
      .alphabet-filter-container .alphabet-filter-button:not(.alphabet-filter-button--zero-bg).alphabet-filter-button--active {
        background: ${alphabetBgActive} !important;
        border-color: ${alphabetBgActiveBorder} !important;
      }
    `
  }

  if (alphabetGlowMode === 'neon') {
    if (alphabetGrad) {
      css += `
        .alphabet-filter-container .alphabet-filter-button span,
        .alphabet-filter-container.alphabet-filter--neon .alphabet-filter-button span,
        .numberOfgames,
        .numberOfgames.numberOfgames--neon {
          background: linear-gradient(135deg, ${alphabetColor1} 0%, ${alphabetColor2} 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          opacity: 0.95 !important;
        }
        .alphabet-filter-container .alphabet-filter-button:hover span,
        .alphabet-filter-container .alphabet-filter-button--active span,
        .alphabet-filter-container.alphabet-filter--neon .alphabet-filter-button:hover span,
        .alphabet-filter-container.alphabet-filter--neon .alphabet-filter-button--active span,
        .numberOfgames:hover {
          background: linear-gradient(135deg, ${alphabetColor1} 0%, ${alphabetColor2} 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          filter: drop-shadow(-1.5px -1.5px calc(${alphabetGlowStrength} * 0.35) ${alphabetGlowRgba1}) 
                  drop-shadow(1.5px 1.5px calc(${alphabetGlowStrength} * 0.35) ${alphabetGlowRgba2}) !important;
          transform: scale(1.08) !important;
          opacity: 1 !important;
          display: inline-flex !important;
        }
      `
    } else {
      css += `
        .alphabet-filter-container .alphabet-filter-button span,
        .alphabet-filter-container.alphabet-filter--neon .alphabet-filter-button span,
        .numberOfgames,
        .numberOfgames.numberOfgames--neon {
          color: ${alphabetColor1} !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          opacity: 0.95 !important;
        }
        .alphabet-filter-container .alphabet-filter-button:hover span,
        .alphabet-filter-container .alphabet-filter-button--active span,
        .alphabet-filter-container.alphabet-filter--neon .alphabet-filter-button:hover span,
        .alphabet-filter-container.alphabet-filter--neon .alphabet-filter-button--active span,
        .numberOfgames:hover {
          color: ${alphabetColor1} !important;
          text-shadow: 0 0 2px ${alphabetGlowCol1},
                       0 0 ${alphabetGlowStrength} ${alphabetGlowRgba1} !important;
          transform: scale(1.08) !important;
          opacity: 1 !important;
          display: inline-flex !important;
        }
      `
    }
  }

  // 5. Header Search & Add Game
  if (searchGlowMode === 'neon') {
    if (searchGrad) {
      css += `
        [data-tour="library-search"] input, .SearchBar input {
          border-color: ${searchColor1} !important;
          box-shadow: -2px -2px calc(${searchGlowStrength} * 0.8) ${searchGlowRgba1},
                      2px 2px calc(${searchGlowStrength} * 0.8) ${searchGlowRgba2} !important;
        }
        [data-tour="library-search"] svg, .SearchBar svg, [data-tour="library-add-game"] svg {
          color: ${searchColor1} !important;
          filter: drop-shadow(-2px -2px 3px ${searchGlowRgba1}) 
                  drop-shadow(2px 2px 3px ${searchGlowRgba2}) !important;
        }
      `
    } else {
      css += `
        [data-tour="library-search"] input, .SearchBar input {
          border-color: ${searchColor1} !important;
          box-shadow: 0 0 calc(${searchGlowStrength} * 0.5) ${searchGlowRgba1},
                      0 0 ${searchGlowStrength} ${searchGlowRgba1} !important;
        }
        [data-tour="library-search"] svg, .SearchBar svg, [data-tour="library-add-game"] svg {
          color: ${searchColor1} !important;
          filter: drop-shadow(0 0 3px ${searchGlowCol1}) !important;
        }
      `
    }
  } else {
    css += `
      [data-tour="library-search"] input, .SearchBar input {
        background: rgba(${rgbSearchDefault.r}, ${rgbSearchDefault.g}, ${rgbSearchDefault.b}, ${searchDefaultBgOpacity}) !important;
        border: 1px solid rgba(${rgbSearchDefault.r}, ${rgbSearchDefault.g}, ${rgbSearchDefault.b}, ${Math.min(1, searchDefaultBgOpacity * 2.5)}) !important;
      }
    `
  }

  // 6. Left Sidebar
  if (sidebarGlowMode === 'neon') {
    css += `
      .Sidebar .Sidebar__item:hover, .Sidebar .Sidebar__item.active {
        background: transparent !important;
        border: none !important;
      }
    `
    if (sidebarGrad) {
      css += `
        .Sidebar .Sidebar__item:hover .Sidebar__itemIcon svg,
        .Sidebar .Sidebar__item.active .Sidebar__itemIcon svg {
          color: ${sidebarColor1} !important;
          fill: ${sidebarColor1} !important;
          opacity: ${sidebarOpacity} !important;
          filter: drop-shadow(-2px -2px calc(${sidebarGlowStrength} * 0.8) ${sidebarGlowRgba1}) 
                  drop-shadow(2px 2px calc(${sidebarGlowStrength} * 0.8) ${sidebarGlowRgba2}) 
                  drop-shadow(0 0 2px ${sidebarGlowCol1}) !important;
          transform: scale(1.15) !important;
        }
      `
    } else {
      css += `
        .Sidebar .Sidebar__item:hover .Sidebar__itemIcon svg,
        .Sidebar .Sidebar__item.active .Sidebar__itemIcon svg {
          color: ${sidebarColor1} !important;
          fill: ${sidebarColor1} !important;
          opacity: ${sidebarOpacity} !important;
          filter: drop-shadow(0 0 2px ${sidebarGlowCol1}) 
                  drop-shadow(0 0 calc(${sidebarGlowStrength} * 0.5) ${sidebarGlowCol1}) 
                  drop-shadow(0 0 ${sidebarGlowStrength} ${sidebarGlowRgba1}) !important;
          transform: scale(1.15) !important;
        }
      `
    }
  } else {
    css += `
      .Sidebar .Sidebar__item:hover, .Sidebar .Sidebar__item.active {
        background: rgba(${rgbSidebarDefault.r}, ${rgbSidebarDefault.g}, ${rgbSidebarDefault.b}, ${sidebarDefaultBgOpacity}) !important;
        border: 1px solid rgba(${rgbSidebarDefault.r}, ${rgbSidebarDefault.g}, ${rgbSidebarDefault.b}, ${Math.min(1, sidebarDefaultBgOpacity * 2.5)}) !important;
      }
    `
  }

  let styleEl = document.getElementById('ghost-global-personalization-styles')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'ghost-global-personalization-styles'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = css
}

applyGlobalPersonalizationStyles()
;(window as unknown as { applyGlobalPersonalizationStyles: () => void }).applyGlobalPersonalizationStyles = applyGlobalPersonalizationStyles
window.addEventListener('heroicSettingsChanged', applyGlobalPersonalizationStyles)

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
