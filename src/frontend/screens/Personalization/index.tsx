import React, { useState, useEffect, useContext, useMemo } from 'react'
import ContextProvider from 'frontend/state/ContextProvider'
import './index.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGamepad,
  faSlidersH,
  faStore,
  faUser,
  faUniversalAccess,
  faBarsProgress,
  faTv,
  faPaintBrush,
  faPowerOff,
  faQuestionCircle,
  faClock
} from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import HeroicIcon from 'frontend/assets/heroic-icon.svg?react'
import SteamLogo from 'frontend/assets/steam-logo.svg?react'
import { DEFAULT_GHOST_CUSTOM_STORES } from 'frontend/helpers/defaultCustomStores'

interface CustomStore {
  id: string
  name: string
  icon: string | null
  isVisible?: boolean
}

export default function PersonalizationScreen() {
  const { epic, gog, sideloadedLibrary, amazon, zoom, steam, zoomPercent, setZoomPercent } = useContext(ContextProvider)

  const [bgImage, setBgImage] = useState<string | null>(() => {
    return localStorage.getItem('heroic_custom_bg')
  })

  const [isDraggingBg, setIsDraggingBg] = useState<boolean>(false)
  const [focusedStoreId, setFocusedStoreId] = useState<string | null>(null)
  const [activePreviewStoreId, setActivePreviewStoreId] = useState<string>('')
  const [activePreviewLetter, setActivePreviewLetter] = useState<string>('C')

  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>(() => {
    return (localStorage.getItem('heroic_sidebar_position') as 'left' | 'right') || 'left'
  })
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false)

  // Lógica funcional de Lojas
  const [stores, setStores] = useState<CustomStore[]>(() => {
    const saved = localStorage.getItem('heroic_custom_stores')
    if (saved) {
      try {
        const parsedStores = JSON.parse(saved) as CustomStore[]
        return parsedStores.map((s) => ({
          ...s,
          isVisible: s.isVisible ?? true
        }))
      } catch (err) {
        console.error('Erro ao ler stores:', err)
      }
    }
    return DEFAULT_GHOST_CUSTOM_STORES
  })

  // ==============================================================
  // ESTADOS DOS TOGGLES DE INTERFACE (GAMEPAD / MOUSE)
  // ==============================================================
  const [hideIconsGamepad, setHideIconsGamepad] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_icons_gamepad')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })

  const [hideIconsMouse, setHideIconsMouse] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_icons_mouse')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })

  const [hideSearchSuggestions, setHideSearchSuggestions] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_search_suggestions')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [useInlinePanel, setUseInlinePanel] = useState<boolean>(() => {
    return localStorage.getItem('heroic_use_inline_panel') !== 'false'
  })

  const [alphabetAlignment, setAlphabetAlignment] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_alignment') || 'center'
  })

  const [alphabetBgOpacity, setAlphabetBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_bg_opacity')
    return saved !== null ? Number(saved) : 0.08
  })

  const [alphabetBtnBgOpacity, setAlphabetBtnBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  const [alphabetBtnBgColor, setAlphabetBtnBgColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_color')
    return saved !== null ? saved : '#ffffff'
  })

  const [alphabetBtnBgColor2, setAlphabetBtnBgColor2] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_bg_color_2')
    return saved !== null ? saved : '#00e5ff'
  })

  const [alphabetBtnGradientEnabled, setAlphabetBtnGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_gradient_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [alphabetBtnBorderEnabled, setAlphabetBtnBorderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [alphabetBtnHoverOpacity, setAlphabetBtnHoverOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_hover_opacity')
    return saved !== null ? Number(saved) : 0.13
  })

  const [alphabetBtnActiveOpacity, setAlphabetBtnActiveOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_active_opacity')
    return saved !== null ? Number(saved) : 0.85
  })

  const [alphabetBtnBorderRadius, setAlphabetBtnBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_radius')
    return saved !== null ? Number(saved) : 18
  })

  // ==============================================================
  // ESTADOS DE CUSTOMIZAÇÃO GLOBAL (6 ÁREAS UNIFICADAS)
  // ==============================================================
  const [rightPanelMode, setRightPanelMode] = useState<'default' | 'storeButtons' | 'alphabet' | 'sidebar' | 'headerControls' | 'headerButtons' | 'headerSearch'>('default')

  const [storeFilterGlowMode, setStoreFilterGlowMode] = useState<'disabled' | 'neon'>(() => {
    const saved = localStorage.getItem('heroic_store_filter_glow_mode')
    return saved === 'neon' || saved === 'logo_only' || saved === 'logo_and_text' ? 'neon' : 'disabled'
  })

  const [actionIconsGlowMode, setActionIconsGlowMode] = useState<'disabled' | 'neon'>(() => {
    return (localStorage.getItem('heroic_action_icons_glow_mode') as 'disabled' | 'neon') || 'disabled'
  })

  const [alphabetGlowMode, setAlphabetGlowMode] = useState<'disabled' | 'neon'>(() => {
    return (localStorage.getItem('heroic_alphabet_glow_mode') as 'disabled' | 'neon') || 'disabled'
  })

  const [headerButtonsGlowMode, setHeaderButtonsGlowMode] = useState<'disabled' | 'neon'>(() => {
    return (localStorage.getItem('heroic_header_buttons_glow_mode') as 'disabled' | 'neon') || 'disabled'
  })

  const [headerSearchGlowMode, setHeaderSearchGlowMode] = useState<'disabled' | 'neon'>(() => {
    return (localStorage.getItem('heroic_header_search_glow_mode') as 'disabled' | 'neon') || 'disabled'
  })

  const [sidebarGlowMode, setSidebarGlowMode] = useState<'disabled' | 'neon'>(() => {
    return (localStorage.getItem('heroic_sidebar_glow_mode') as 'disabled' | 'neon') || 'disabled'
  })

  const handleStoreFilterGlowModeChange = (mode: 'disabled' | 'neon') => {
    setStoreFilterGlowMode(mode)
    localStorage.setItem('heroic_store_filter_glow_mode', mode)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleActionIconsGlowModeChange = (mode: 'disabled' | 'neon') => {
    setActionIconsGlowMode(mode)
    localStorage.setItem('heroic_action_icons_glow_mode', mode)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetGlowModeChange = (mode: 'disabled' | 'neon') => {
    setAlphabetGlowMode(mode)
    localStorage.setItem('heroic_alphabet_glow_mode', mode)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderButtonsGlowModeChange = (mode: 'disabled' | 'neon') => {
    setHeaderButtonsGlowMode(mode)
    localStorage.setItem('heroic_header_buttons_glow_mode', mode)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderSearchGlowModeChange = (mode: 'disabled' | 'neon') => {
    setHeaderSearchGlowMode(mode)
    localStorage.setItem('heroic_header_search_glow_mode', mode)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleSidebarGlowModeChange = (mode: 'disabled' | 'neon') => {
    setSidebarGlowMode(mode)
    localStorage.setItem('heroic_sidebar_glow_mode', mode)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  // 1. Barra de Lojas
  const [storeBtnBgColor, setStoreBtnBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_color1') || localStorage.getItem('heroic_store_btn_bg_color') || '#00ffff'
  })
  const [storeBtnBgColor2, setStoreBtnBgColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_color2') || localStorage.getItem('heroic_store_btn_bg_color_2') || '#38d9e6'
  })
  const [storeBtnGradientEnabled, setStoreBtnGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_gradient') || localStorage.getItem('heroic_store_btn_gradient_enabled')
    return saved !== null ? saved === 'true' : false
  })
  const [storeBtnGlowColor, setStoreBtnGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_glow_color') || '#00ffff'
  })
  const [storeBtnSyncGlowWithGradient, setStoreBtnSyncGlowWithGradient] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })
  const [activeStoreColorTab, setActiveStoreColorTab] = useState<'color1' | 'color2' | 'glow'>('color1')
  const [storeBtnOpacity, setStoreBtnOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_opacity')
    return saved !== null ? Number(saved) : 1
  })
  const [storeBtnGlowStrength, setStoreBtnGlowStrength] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_glow_strength')
    return saved !== null ? Number(saved) : 8
  })
  const [storeBtnDefaultBgColor, setStoreBtnDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_default_bg_color') || localStorage.getItem('heroic_store_btn_bg_color') || '#ffffff'
  })
  const [storeBtnDefaultBgColor2, setStoreBtnDefaultBgColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_default_bg_color_2') || localStorage.getItem('heroic_store_btn_bg_color_2') || '#38d9e6'
  })
  const [storeBtnDefaultBgGradientEnabled, setStoreBtnDefaultBgGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_default_bg_gradient') ?? localStorage.getItem('heroic_store_btn_gradient_enabled')
    return saved !== null ? saved === 'true' : false
  })
  const [storeBtnDefaultBgGlowColor, setStoreBtnDefaultBgGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_default_bg_glow_color') || localStorage.getItem('heroic_store_btn_glow_color') || '#00ffff'
  })
  const [storeBtnDefaultBgSyncGlow, setStoreBtnDefaultBgSyncGlow] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_default_bg_sync_glow') ?? localStorage.getItem('heroic_store_btn_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })
  const [activeStoreBgTab, setActiveStoreBgTab] = useState<'color1' | 'color2' | 'glow'>('color1')
  const [storeBtnDefaultBgOpacity, setStoreBtnDefaultBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_default_bg_opacity') ?? localStorage.getItem('heroic_store_btn_bg_opacity')
    return saved !== null ? Number(saved) : 0
  })
  const [showStoreBgColorPicker, setShowStoreBgColorPicker] = useState<boolean>(false)
  const [storeBtnBorderRadius, setStoreBtnBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_border_radius')
    return saved !== null ? Number(saved) : 12
  })
  const [storeBtnBorderEnabled, setStoreBtnBorderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_border_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })
  const [storeFilterGlowTarget, setStoreFilterGlowTarget] = useState<'logo' | 'text' | 'both'>(() => {
    return (localStorage.getItem('heroic_store_filter_glow_target') as 'logo' | 'text' | 'both') || 'both'
  })

  // 2. Filtro Alfabético & Contador
  const [alphabetGlowColor, setAlphabetGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_btn_glow_color') || '#00ffff'
  })
  const [alphabetSyncGlowWithGradient, setAlphabetSyncGlowWithGradient] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })
  const [activeAlphabetColorTab, setActiveAlphabetColorTab] = useState<'color1' | 'color2' | 'glow'>('color1')
  const [alphabetOpacity, setAlphabetOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_opacity_neon') || localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 1
  })
  const [alphabetGlowStrength, setAlphabetGlowStrength] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_glow_strength')
    return saved !== null ? Number(saved) : 8
  })
  const [alphabetDefaultBgColor, setAlphabetDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_btn_default_bg_color') || '#ffffff'
  })
  const [alphabetDefaultBgColor2, setAlphabetDefaultBgColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_btn_default_bg_color_2') || '#38d9e6'
  })
  const [alphabetDefaultBgGlowColor, setAlphabetDefaultBgGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_btn_default_bg_glow_color') || '#00ffff'
  })
  const [alphabetDefaultBgGradientEnabled, setAlphabetDefaultBgGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_gradient')
    return saved !== null ? (saved === 'true') : false
  })
  const [alphabetDefaultBgSyncGlow, setAlphabetDefaultBgSyncGlow] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_sync_glow')
    return saved !== null ? saved !== 'false' : true
  })
  const [showAlphabetBgColorPicker, setShowAlphabetBgColorPicker] = useState<boolean>(false)
  const [activeAlphabetBgTab, setActiveAlphabetBgTab] = useState<'color1' | 'color2' | 'glow'>('color1')
  const [alphabetDefaultBgOpacity, setAlphabetDefaultBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_opacity') ?? localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  // 3. Header Search & Add Game
  const [headerSearchColor1, setHeaderSearchColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_header_search_color1') || '#00ffff'
  })
  const [headerSearchColor2, setHeaderSearchColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_header_search_color2') || '#38d9e6'
  })
  const [headerSearchGradientEnabled, setHeaderSearchGradientEnabled] = useState<boolean>(() => {
    return localStorage.getItem('heroic_header_search_gradient') === 'true'
  })
  const [headerSearchGlowColor, setHeaderSearchGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_header_search_glow_color') || '#00ffff'
  })
  const [headerSearchSyncGlowWithGradient, setHeaderSearchSyncGlowWithGradient] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_header_search_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })
  const [activeHeaderSearchColorTab, setActiveHeaderSearchColorTab] = useState<'color1' | 'color2' | 'glow'>('color1')
  const [headerSearchOpacity, setHeaderSearchOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_header_search_opacity')
    return saved !== null ? Number(saved) : 1
  })
  const [headerSearchGlowStrength, setHeaderSearchGlowStrength] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_header_search_glow_strength')
    return saved !== null ? Number(saved) : 8
  })
  const [headerSearchDefaultBgColor, setHeaderSearchDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_header_search_default_bg_color') || '#ffffff'
  })
  const [headerSearchDefaultBgOpacity, setHeaderSearchDefaultBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_header_search_default_bg_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  // 4. Barra Lateral Esquerda (Sidebar)
  const [sidebarColor1, setSidebarColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_sidebar_color1') || '#00ffff'
  })
  const [sidebarColor2, setSidebarColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_sidebar_color2') || '#38d9e6'
  })
  const [sidebarGradientEnabled, setSidebarGradientEnabled] = useState<boolean>(() => {
    return localStorage.getItem('heroic_sidebar_gradient') === 'true'
  })
  const [sidebarGlowColor, setSidebarGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_sidebar_glow_color') || '#00ffff'
  })
  const [sidebarSyncGlowWithGradient, setSidebarSyncGlowWithGradient] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_sidebar_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })
  const [activeSidebarColorTab, setActiveSidebarColorTab] = useState<'color1' | 'color2' | 'glow'>('color1')
  const [sidebarOpacity, setSidebarOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_sidebar_opacity')
    return saved !== null ? Number(saved) : 1
  })
  const [sidebarGlowStrength, setSidebarGlowStrength] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_sidebar_glow_strength')
    return saved !== null ? Number(saved) : 8
  })
  const [sidebarDefaultBgColor, setSidebarDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_sidebar_default_bg_color') || '#ffffff'
  })
  const [sidebarDefaultBgOpacity, setSidebarDefaultBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_sidebar_default_bg_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  // 5. Ícones de Ação (Action Icons)

  const [actionIconsColor1, setActionIconsColor1] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_action_icons_color1')
    return saved !== null ? saved : '#00ffff'
  })

  const [actionIconsColor2, setActionIconsColor2] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_action_icons_color2')
    return saved !== null ? saved : '#38d9e6'
  })

  const [actionIconsGradientEnabled, setActionIconsGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_action_icons_gradient')
    return saved !== null ? saved === 'true' : false
  })

  const [actionIconsGlowColor, setActionIconsGlowColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_action_icons_glow_color')
    return saved !== null ? saved : '#00ffff'
  })

  const [actionIconsSyncGlowWithGradient, setActionIconsSyncGlowWithGradient] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_action_icons_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })

  const [activeActionIconsColorTab, setActiveActionIconsColorTab] = useState<'color1' | 'color2' | 'glow'>('color1')

  const [actionIconsOpacity, setActionIconsOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_action_icons_opacity')
    return saved !== null ? Number(saved) : 1
  })

  const [actionIconsGlowStrength, setActionIconsGlowStrength] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_action_icons_glow_strength')
    return saved !== null ? Number(saved) : 8
  })

  const [actionIconsDefaultBgColor, setActionIconsDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_action_icons_default_bg_color') || '#ffffff'
  })

  const [actionIconsDefaultBgOpacity, setActionIconsDefaultBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_action_icons_default_bg_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  // ==============================================================
  // ESTADOS DE CUSTOMIZAÇÃO DOS BOTÕES DO CABEÇALHO (EDIÇÃO EM MASSA, CATEGORIAS, FILTROS)
  // ==============================================================
  const [headerButtonsColor1, setHeaderButtonsColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_color1') || '#00ffff'
  })

  const [headerButtonsColor2, setHeaderButtonsColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_color2') || '#38d9e6'
  })

  const [headerButtonsGradientEnabled, setHeaderButtonsGradientEnabled] = useState<boolean>(() => {
    return localStorage.getItem('heroic_header_buttons_gradient') === 'true'
  })

  const [headerButtonsGlowColor, setHeaderButtonsGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_glow_color') || '#00ffff'
  })

  const [headerButtonsSyncGlowWithGradient, setHeaderButtonsSyncGlowWithGradient] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_header_buttons_sync_glow_with_gradient')
    return saved !== null ? saved !== 'false' : true
  })

  const [activeHeaderButtonsColorTab, setActiveHeaderButtonsColorTab] = useState<'color1' | 'color2' | 'glow'>('color1')

  const [headerButtonsOpacity, setHeaderButtonsOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_header_buttons_opacity')
    return saved !== null ? Number(saved) : 1
  })

  const [headerButtonsGlowStrength, setHeaderButtonsGlowStrength] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_header_buttons_glow_strength')
    return saved !== null ? Number(saved) : 8
  })

  const [headerButtonsDefaultBgColor, setHeaderButtonsDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_default_bg_color') || '#ffffff'
  })

  const [headerButtonsDefaultBgOpacity, setHeaderButtonsDefaultBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_header_buttons_default_bg_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  // ==============================================================
  // ESCOLHA ALEATÓRIA DE 6 JOGOS DA BIBLIOTECA REAL COM REPETIÇÃO
  // ==============================================================
  const realGamesList = useMemo(() => {
    return [
      ...(epic?.library ?? []),
      ...(gog?.library ?? []),
      ...(sideloadedLibrary ?? []),
      ...(amazon?.library ?? []),
      ...(zoom?.library ?? []),
      ...(steam?.library ?? [])
    ].filter(Boolean)
  }, [epic, gog, sideloadedLibrary, amazon, zoom, steam])

  const totalRealGamesCount = useMemo(() => {
    return realGamesList.length > 0 ? realGamesList.length : 6
  }, [realGamesList])

  const previewGames = useMemo(() => {
    const result = []
    
    if (realGamesList.length > 0) {
      // Embaralha uma cópia para pegar de forma aleatória sempre que entrar/recarregar a página
      const shuffled = [...realGamesList].sort(() => 0.5 - Math.random())
      
      // Preenche os 6 espaços
      for (let i = 0; i < 6; i++) {
        // Pega com base no resto da divisão se a lista for menor que 6 (repetição)
        const game = shuffled[i % shuffled.length]
        
        // Mapeia o runner para nome da loja amigável
        let storeName = 'Biblioteca'
        if (game.runner === 'legendary') storeName = 'Epic Games'
        else if (game.runner === 'gog') storeName = 'GOG'
        else if (game.runner === 'sideload') storeName = 'Adicionado'
        else if (game.runner === 'nile') storeName = 'Amazon'
        else if (game.runner === 'zoom') storeName = 'Zoom'
        else if (game.runner === 'steam') storeName = 'Steam'

        // Gera um gradiente de fundo elegante baseado no título para jogos sem capa
        const charCodeSum = (game.title || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const hue1 = charCodeSum % 360
        const hue2 = (hue1 + 120) % 360
        const bannerGradient = `linear-gradient(135deg, hsl(${hue1}, 50%, 15%) 0%, hsl(${hue2}, 60%, 25%) 100%)`

        result.push({
          id: `${game.app_name}-${i}`,
          title: game.overrides?.title || game.title || 'Jogo sem Título',
          store: storeName,
          bannerUrl: game.overrides?.art_cover || game.art_cover || null,
          fallbackGradient: bannerGradient
        })
      }
    } else {
      // Caso a biblioteca esteja totalmente vazia, usa backups de alto padrão de capas
      const fallbackBackups = [
        { title: 'Cyberpunk 2077', store: 'Epic Games', gradient: 'linear-gradient(135deg, #1a0f2e 0%, #ffe600 100%)' },
        { title: 'The Witcher 3', store: 'GOG', gradient: 'linear-gradient(135deg, #2a0a05 0%, #8a0303 100%)' },
        { title: 'Hades', store: 'Steam', gradient: 'linear-gradient(135deg, #0e021a 0%, #ff3c00 100%)' },
        { title: 'Elden Ring', store: 'Steam', gradient: 'linear-gradient(135deg, #0c0d12 0%, #c5a059 100%)' },
        { title: 'GTA V', store: 'Epic Games', gradient: 'linear-gradient(135deg, #00100d 0%, #005a05 100%)' },
        { title: 'Red Dead Redemption 2', store: 'GOG', gradient: 'linear-gradient(135deg, #240a00 0%, #ff5100 100%)' }
      ]
      for (let i = 0; i < 6; i++) {
        const item = fallbackBackups[i]
        result.push({
          id: `fallback-${i}`,
          title: item.title,
          store: item.store,
          bannerUrl: null,
          fallbackGradient: item.gradient
        })
      }
    }
    
    return result
  }, [epic?.library, gog?.library, sideloadedLibrary, amazon?.library, zoom?.library])

  // ==============================================================
  // DRAG & DROP PARA ORDENAÇÃO DAS LOJAS
  // ==============================================================
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const updatedStores = [...stores]
    const draggedItem = updatedStores[draggedIndex]
    
    // Rearranja os itens
    updatedStores.splice(draggedIndex, 1)
    updatedStores.splice(index, 0, draggedItem)

    setDraggedIndex(index)
    setStores(updatedStores)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handlePreviewAreaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isDraggingSidebar) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isLeftHalf = x < rect.width / 2
    const newPos = isLeftHalf ? 'left' : 'right'

    if (sidebarPosition !== newPos) {
      setSidebarPosition(newPos)
      localStorage.setItem('heroic_sidebar_position', newPos)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }
  // ==============================================================


  useEffect(() => {
    localStorage.setItem('heroic_custom_stores', JSON.stringify(stores))
    window.dispatchEvent(new Event('customStoresChanged'))
    
    const firstVisible = stores.find((s) => s.isVisible ?? true)
    if (firstVisible && !activePreviewStoreId) {
      setActivePreviewStoreId(firstVisible.id)
    }
  }, [stores, activePreviewStoreId])

  useEffect(() => {
    const handleExternalStoresChange = () => {
      const saved = localStorage.getItem('heroic_custom_stores')
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as CustomStore[]
          if (JSON.stringify(parsed) !== JSON.stringify(stores)) {
            setStores(parsed.map((s) => ({ ...s, isVisible: s.isVisible ?? true })))
          }
        } catch (err) {}
      }
    }
    window.addEventListener('customStoresChanged', handleExternalStoresChange)
    return () => window.removeEventListener('customStoresChanged', handleExternalStoresChange)
  }, [stores])

  useEffect(() => {
    const handleModeChange = () => {
      const active = localStorage.getItem('heroic_use_inline_panel') !== 'false'
      setUseInlinePanel(active)
    }
    window.addEventListener('heroicUseInlinePanelChanged', handleModeChange)
    return () => window.removeEventListener('heroicUseInlinePanelChanged', handleModeChange)
  }, [])

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setBgImage(base64)
      localStorage.setItem('heroic_custom_bg', base64)
      window.dispatchEvent(new Event('customBgChanged'))
    }
    reader.readAsDataURL(file)
  }

  const handleDragOverBg = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingBg(true)
  }

  const handleDragLeaveBg = () => {
    setIsDraggingBg(false)
  }

  const handleDropBg = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingBg(false)
    
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setBgImage(base64)
      localStorage.setItem('heroic_custom_bg', base64)
      window.dispatchEvent(new Event('customBgChanged'))
    }
    reader.readAsDataURL(file)
  }

  const handleIconUpload = (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setStores((prev) =>
        prev.map((s) => (s.id === id ? { ...s, icon: base64 } : s))
      )
    }
    reader.readAsDataURL(file)
  }

  const handleNameChange = (id: string, newName: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
    )
  }

  const handleToggleVisibility = (id: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isVisible: !(s.isVisible ?? true) } : s
      )
    )
  }

  const handleAddStore = () => {
    const newStore: CustomStore = {
      id: 'store-' + Date.now(),
      name: '',
      icon: null,
      isVisible: true
    }
    setStores((prev) => [...prev, newStore])
  }

  const handleRemoveStore = (id: string) => {
    setStores((prev) => prev.filter((s) => s.id !== id))
  }

  // ==============================================================
  // FUNÇÕES DE DISPARO PARA MUDANÇA DE COMPORTAMENTO
  // ==============================================================
  const handleToggleGamepadIcons = () => {
    const newVal = !hideIconsGamepad
    setHideIconsGamepad(newVal)
    localStorage.setItem('heroic_hide_icons_gamepad', JSON.stringify(newVal))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleToggleMouseIcons = () => {
    const newVal = !hideIconsMouse
    setHideIconsMouse(newVal)
    localStorage.setItem('heroic_hide_icons_mouse', JSON.stringify(newVal))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleToggleSearchSuggestions = () => {
    const newVal = !hideSearchSuggestions
    setHideSearchSuggestions(newVal)
    localStorage.setItem('heroic_hide_search_suggestions', JSON.stringify(newVal))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleToggleInlinePanel = () => {
    const newVal = !useInlinePanel
    setUseInlinePanel(newVal)
    localStorage.setItem('heroic_use_inline_panel', newVal ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicUseInlinePanelChanged'))
  }

  const handleToggleAlphabetAlignment = (val: string) => {
    setAlphabetAlignment(val)
    localStorage.setItem('heroic_alphabet_alignment', val)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetBgOpacityChange = (val: number) => {
    setAlphabetBgOpacity(val)
    localStorage.setItem('heroic_alphabet_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetBtnOpacityChange = (val: number) => {
    setAlphabetBtnBgOpacity(val)
    localStorage.setItem('heroic_alphabet_btn_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetHoverOpacityChange = (val: number) => {
    setAlphabetBtnHoverOpacity(val)
    localStorage.setItem('heroic_alphabet_btn_hover_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetActiveOpacityChange = (val: number) => {
    setAlphabetBtnActiveOpacity(val)
    localStorage.setItem('heroic_alphabet_btn_active_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetBorderRadiusChange = (val: number) => {
    setAlphabetBtnBorderRadius(val)
    localStorage.setItem('heroic_alphabet_btn_border_radius', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (_, r: string, g: string, b: string) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 255, g: 255, b: 255 }
  }

  const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (c: number) => {
      const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    }
  }
  const handleAlphabetHexChange = (val: string) => {
    setAlphabetBtnBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetHexChange2 = (val: string) => {
    setAlphabetBtnBgColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_bg_color_2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const hsvToRgb = (h: number, s: number, v: number) => {
    h = h / 360
    s = s / 100
    v = v / 100
    let r = 0, g = 0, b = 0
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break
      case 1: r = q; g = v; b = p; break
      case 2: r = p; g = v; b = t; break
      case 3: r = p; g = q; b = v; break
      case 4: r = t; g = p; b = v; break
      case 5: r = v; g = p; b = q; break
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    }
  }

  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const v = max
    const d = max - min
    s = max === 0 ? 0 : d / max
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    }
  }

  const SVBox = ({ hexColor, onChange }: { hexColor: string; onChange: (hex: string) => void }) => {
    const rgb = hexToRgb(hexColor)
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
    
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const updateColor = (clientX: number, clientY: number) => {
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
        const s = Math.round((x / rect.width) * 100)
        const v = Math.round((1 - y / rect.height) * 100)
        const newRgb = hsvToRgb(hsv.h, s, v)
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
        onChange(newHex)
      }

      updateColor(e.clientX, e.clientY)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateColor(moveEvent.clientX, moveEvent.clientY)
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return (
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: '150px',
          borderRadius: '6px',
          cursor: 'crosshair',
          overflow: 'hidden',
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h}, 100%, 50%)`,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 3px rgba(0,0,0,0.8)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            backgroundColor: 'transparent'
          }}
        />
      </div>
    )
  }

  // 1. Handlers da Barra de Lojas (Store Filter Bar)
  const handleStoreColor1Change = (val: string) => {
    setStoreBtnBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_color1', val)
      localStorage.setItem('heroic_store_btn_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreColor2Change = (val: string) => {
    setStoreBtnBgColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_color2', val)
      localStorage.setItem('heroic_store_btn_bg_color_2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreGradientToggle = (val: boolean) => {
    setStoreBtnGradientEnabled(val)
    localStorage.setItem('heroic_store_btn_gradient', val ? 'true' : 'false')
    localStorage.setItem('heroic_store_btn_gradient_enabled', JSON.stringify(val))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreGlowColorChange = (val: string) => {
    setStoreBtnGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreSyncGlowToggle = (val: boolean) => {
    setStoreBtnSyncGlowWithGradient(val)
    localStorage.setItem('heroic_store_btn_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreOpacityChange = (val: number) => {
    setStoreBtnOpacity(val)
    localStorage.setItem('heroic_store_btn_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreGlowStrengthChange = (val: number) => {
    setStoreBtnGlowStrength(val)
    localStorage.setItem('heroic_store_btn_glow_strength', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreDefaultBgColorChange = (val: string) => {
    setStoreBtnDefaultBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_default_bg_color', val)
      localStorage.setItem('heroic_store_btn_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreDefaultBgColor2Change = (val: string) => {
    setStoreBtnDefaultBgColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_default_bg_color_2', val)
      localStorage.setItem('heroic_store_btn_bg_color_2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreDefaultBgGlowColorChange = (val: string) => {
    setStoreBtnDefaultBgGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_default_bg_glow_color', val)
      localStorage.setItem('heroic_store_btn_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreDefaultBgGradientToggle = (val: boolean) => {
    setStoreBtnDefaultBgGradientEnabled(val)
    localStorage.setItem('heroic_store_btn_default_bg_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreDefaultBgSyncGlowToggle = (val: boolean) => {
    setStoreBtnDefaultBgSyncGlow(val)
    localStorage.setItem('heroic_store_btn_default_bg_sync_glow', val ? 'true' : 'false')
    localStorage.setItem('heroic_store_btn_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreDefaultBgOpacityChange = (val: number) => {
    setStoreBtnDefaultBgOpacity(val)
    localStorage.setItem('heroic_store_btn_default_bg_opacity', val.toString())
    localStorage.setItem('heroic_store_btn_bg_opacity', val.toString())
    localStorage.setItem('heroic_store_btn_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreBorderRadiusChange = (val: number) => {
    setStoreBtnBorderRadius(val)
    localStorage.setItem('heroic_store_btn_border_radius', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreFilterGlowTargetChange = (target: 'logo' | 'text' | 'both') => {
    setStoreFilterGlowTarget(target)
    localStorage.setItem('heroic_store_filter_glow_target', target)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  // 2. Handlers do Filtro Alfabético & Contador (Alphabetical Filter & Counter)
  const handleAlphabetColor1Change = (val: string) => {
    setAlphabetBtnBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_color1', val)
      localStorage.setItem('heroic_alphabet_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetColor2Change = (val: string) => {
    setAlphabetBtnBgColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_color2', val)
      localStorage.setItem('heroic_alphabet_btn_bg_color_2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetGradientToggle = (val: boolean) => {
    setAlphabetBtnGradientEnabled(val)
    localStorage.setItem('heroic_alphabet_btn_gradient', val ? 'true' : 'false')
    localStorage.setItem('heroic_alphabet_btn_gradient_enabled', JSON.stringify(val))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetGlowColorChange = (val: string) => {
    setAlphabetGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetSyncGlowToggle = (val: boolean) => {
    setAlphabetSyncGlowWithGradient(val)
    localStorage.setItem('heroic_alphabet_btn_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetOpacityChange = (val: number) => {
    setAlphabetOpacity(val)
    localStorage.setItem('heroic_alphabet_btn_opacity', val.toString())
    localStorage.setItem('heroic_alphabet_btn_opacity_neon', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetGlowStrengthChange = (val: number) => {
    setAlphabetGlowStrength(val)
    localStorage.setItem('heroic_alphabet_btn_glow_strength', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetDefaultBgColorChange = (val: string) => {
    setAlphabetDefaultBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_default_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetDefaultBgOpacityChange = (val: number) => {
    setAlphabetDefaultBgOpacity(val)
    localStorage.setItem('heroic_alphabet_btn_default_bg_opacity', val.toString())
    localStorage.setItem('heroic_alphabet_btn_opacity', val.toString())
    localStorage.setItem('heroic_alphabet_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetDefaultBgColor2Change = (val: string) => {
    setAlphabetDefaultBgColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_default_bg_color_2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetDefaultBgGlowColorChange = (val: string) => {
    setAlphabetDefaultBgGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_btn_default_bg_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleAlphabetDefaultBgGradientToggle = (val: boolean) => {
    setAlphabetDefaultBgGradientEnabled(val)
    localStorage.setItem('heroic_alphabet_btn_default_bg_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleAlphabetDefaultBgSyncGlowToggle = (val: boolean) => {
    setAlphabetDefaultBgSyncGlow(val)
    localStorage.setItem('heroic_alphabet_btn_default_bg_sync_glow', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  // 3. Handlers de Busca e Botão Adicionar Jogo (Header Search & Add Game)
  const handleHeaderSearchColor1Change = (val: string) => {
    setHeaderSearchColor1(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_search_color1', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderSearchColor2Change = (val: string) => {
    setHeaderSearchColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_search_color2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderSearchGradientToggle = (val: boolean) => {
    setHeaderSearchGradientEnabled(val)
    localStorage.setItem('heroic_header_search_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderSearchGlowColorChange = (val: string) => {
    setHeaderSearchGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_search_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderSearchSyncGlowToggle = (val: boolean) => {
    setHeaderSearchSyncGlowWithGradient(val)
    localStorage.setItem('heroic_header_search_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderSearchOpacityChange = (val: number) => {
    setHeaderSearchOpacity(val)
    localStorage.setItem('heroic_header_search_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderSearchGlowStrengthChange = (val: number) => {
    setHeaderSearchGlowStrength(val)
    localStorage.setItem('heroic_header_search_glow_strength', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderSearchDefaultBgColorChange = (val: string) => {
    setHeaderSearchDefaultBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_search_default_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderSearchDefaultBgOpacityChange = (val: number) => {
    setHeaderSearchDefaultBgOpacity(val)
    localStorage.setItem('heroic_header_search_default_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  // 4. Handlers da Barra Lateral Esquerda (Left Sidebar)
  const handleSidebarColor1Change = (val: string) => {
    setSidebarColor1(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_sidebar_color1', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleSidebarColor2Change = (val: string) => {
    setSidebarColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_sidebar_color2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleSidebarGradientToggle = (val: boolean) => {
    setSidebarGradientEnabled(val)
    localStorage.setItem('heroic_sidebar_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleSidebarGlowColorChange = (val: string) => {
    setSidebarGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_sidebar_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleSidebarSyncGlowToggle = (val: boolean) => {
    setSidebarSyncGlowWithGradient(val)
    localStorage.setItem('heroic_sidebar_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleSidebarOpacityChange = (val: number) => {
    setSidebarOpacity(val)
    localStorage.setItem('heroic_sidebar_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleSidebarGlowStrengthChange = (val: number) => {
    setSidebarGlowStrength(val)
    localStorage.setItem('heroic_sidebar_glow_strength', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleSidebarDefaultBgColorChange = (val: string) => {
    setSidebarDefaultBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_sidebar_default_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleSidebarDefaultBgOpacityChange = (val: number) => {
    setSidebarDefaultBgOpacity(val)
    localStorage.setItem('heroic_sidebar_default_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  // 5. Handlers dos Ícones de Ação (Action Icons)
  const handleActionIconsColor1Change = (val: string) => {
    setActionIconsColor1(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_action_icons_color1', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleActionIconsColor2Change = (val: string) => {
    setActionIconsColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_action_icons_color2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleActionIconsGradientToggle = (val: boolean) => {
    setActionIconsGradientEnabled(val)
    localStorage.setItem('heroic_action_icons_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleActionIconsGlowColorChange = (val: string) => {
    setActionIconsGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_action_icons_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleActionIconsSyncGlowToggle = (val: boolean) => {
    setActionIconsSyncGlowWithGradient(val)
    localStorage.setItem('heroic_action_icons_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleActionIconsOpacityChange = (val: number) => {
    setActionIconsOpacity(val)
    localStorage.setItem('heroic_action_icons_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleActionIconsGlowStrengthChange = (val: number) => {
    setActionIconsGlowStrength(val)
    localStorage.setItem('heroic_action_icons_glow_strength', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleActionIconsDefaultBgColorChange = (val: string) => {
    setActionIconsDefaultBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_action_icons_default_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleActionIconsDefaultBgOpacityChange = (val: number) => {
    setActionIconsDefaultBgOpacity(val)
    localStorage.setItem('heroic_action_icons_default_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  // 6. Handlers dos Botões do Cabeçalho (Header Buttons)
  const handleHeaderButtonsColor1Change = (val: string) => {
    setHeaderButtonsColor1(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_buttons_color1', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderButtonsColor2Change = (val: string) => {
    setHeaderButtonsColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_buttons_color2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderButtonsGradientToggle = (val: boolean) => {
    setHeaderButtonsGradientEnabled(val)
    localStorage.setItem('heroic_header_buttons_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderButtonsGlowColorChange = (val: string) => {
    setHeaderButtonsGlowColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_buttons_glow_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderButtonsSyncGlowToggle = (val: boolean) => {
    setHeaderButtonsSyncGlowWithGradient(val)
    localStorage.setItem('heroic_header_buttons_sync_glow_with_gradient', val ? 'true' : 'false')
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderButtonsOpacityChange = (val: number) => {
    setHeaderButtonsOpacity(val)
    localStorage.setItem('heroic_header_buttons_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderButtonsGlowStrengthChange = (val: number) => {
    setHeaderButtonsGlowStrength(val)
    localStorage.setItem('heroic_header_buttons_glow_strength', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHeaderButtonsDefaultBgColorChange = (val: string) => {
    setHeaderButtonsDefaultBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_header_buttons_default_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleHeaderButtonsDefaultBgOpacityChange = (val: number) => {
    setHeaderButtonsDefaultBgOpacity(val)
    localStorage.setItem('heroic_header_buttons_default_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }
  // ==============================================================

  // Computações de Cores - 1. Barra de Lojas
  let currentEditingStoreColor = storeBtnBgColor
  let currentEditingStoreHandler = handleStoreColor1Change
  if (activeStoreColorTab === 'glow') {
    currentEditingStoreColor = storeBtnGlowColor
    currentEditingStoreHandler = handleStoreGlowColorChange
  } else if (storeBtnGradientEnabled && activeStoreColorTab === 'color2') {
    currentEditingStoreColor = storeBtnBgColor2
    currentEditingStoreHandler = handleStoreColor2Change
  }
  const rgbStore = hexToRgb(currentEditingStoreColor)
  const currentEditingStoreHsl = rgbToHsl(rgbStore.r, rgbStore.g, rgbStore.b)
  const rgbStore1 = hexToRgb(storeBtnBgColor)
  const rgbStore2 = hexToRgb(storeBtnBgColor2)
  const rgbStoreGlow = hexToRgb(storeBtnGlowColor)
  const rgbStoreDefaultBg1 = hexToRgb(storeBtnDefaultBgColor)
  const rgbStoreDefaultBg2 = hexToRgb(storeBtnDefaultBgColor2)
  const effectiveStoreBgGlow = storeBtnDefaultBgSyncGlow ? storeBtnDefaultBgColor : storeBtnDefaultBgGlowColor
  const rgbStoreDefaultBgGlow = hexToRgb(effectiveStoreBgGlow)

  let currentEditingStoreBgColor = storeBtnDefaultBgColor
  let currentEditingStoreBgHandler = handleStoreDefaultBgColorChange
  if (activeStoreBgTab === 'glow') {
    currentEditingStoreBgColor = storeBtnDefaultBgGlowColor
    currentEditingStoreBgHandler = handleStoreDefaultBgGlowColorChange
  } else if (storeBtnDefaultBgGradientEnabled && activeStoreBgTab === 'color2') {
    currentEditingStoreBgColor = storeBtnDefaultBgColor2
    currentEditingStoreBgHandler = handleStoreDefaultBgColor2Change
  }
  const currentEditingStoreBgRgb = hexToRgb(currentEditingStoreBgColor)
  const currentEditingStoreBgHsl = rgbToHsl(currentEditingStoreBgRgb.r, currentEditingStoreBgRgb.g, currentEditingStoreBgRgb.b)
  const effectivePreviewStoreGlow1 = storeBtnSyncGlowWithGradient ? storeBtnBgColor : storeBtnGlowColor
  const effectivePreviewStoreGlow2 = storeBtnSyncGlowWithGradient ? storeBtnBgColor2 : storeBtnGlowColor
  const effectiveRgbPreviewStoreGlow1 = storeBtnSyncGlowWithGradient ? rgbStore1 : rgbStoreGlow
  const effectiveRgbPreviewStoreGlow2 = storeBtnSyncGlowWithGradient ? rgbStore2 : rgbStoreGlow
  const effectiveStoreGlowRgba1 = `rgba(${effectiveRgbPreviewStoreGlow1.r}, ${effectiveRgbPreviewStoreGlow1.g}, ${effectiveRgbPreviewStoreGlow1.b}, ${Math.min(1, 0.5 * storeBtnOpacity)})`
  const effectiveStoreGlowRgba2 = `rgba(${effectiveRgbPreviewStoreGlow2.r}, ${effectiveRgbPreviewStoreGlow2.g}, ${effectiveRgbPreviewStoreGlow2.b}, ${Math.min(1, 0.5 * storeBtnOpacity)})`

  const targetExampleStore = useMemo(() => {
    return (
      stores.find((s) => s.id === activePreviewStoreId) ||
      stores.find((s) => s.id === 'steam' || s.name?.toLowerCase() === 'steam') ||
      DEFAULT_GHOST_CUSTOM_STORES.find((s) => s.id === 'steam' || s.name?.toLowerCase() === 'steam') ||
      stores[0] ||
      DEFAULT_GHOST_CUSTOM_STORES[0]
    )
  }, [stores, activePreviewStoreId])

  // Computações de Cores - 2. Filtro Alfabético & Contador
  let currentEditingAlphabetColor = alphabetBtnBgColor
  let currentEditingAlphabetHandler = handleAlphabetColor1Change
  if (activeAlphabetColorTab === 'glow') {
    currentEditingAlphabetColor = alphabetGlowColor
    currentEditingAlphabetHandler = handleAlphabetGlowColorChange
  } else if (alphabetBtnGradientEnabled && activeAlphabetColorTab === 'color2') {
    currentEditingAlphabetColor = alphabetBtnBgColor2
    currentEditingAlphabetHandler = handleAlphabetColor2Change
  }
  const rgbAlphabet = hexToRgb(currentEditingAlphabetColor)
  const currentEditingAlphabetHsl = rgbToHsl(rgbAlphabet.r, rgbAlphabet.g, rgbAlphabet.b)
  const rgbAlphabet1 = hexToRgb(alphabetBtnBgColor)
  const rgbAlphabet2 = hexToRgb(alphabetBtnBgColor2)
  const rgbAlphabetGlow = hexToRgb(alphabetGlowColor)
  const rgbAlphabetDefault1 = hexToRgb(alphabetDefaultBgColor)
  const rgbAlphabetDefault2 = hexToRgb(alphabetDefaultBgColor2)
  const effectiveAlphabetDefaultBgGlow = alphabetDefaultBgSyncGlow ? alphabetDefaultBgColor : alphabetDefaultBgGlowColor
  const rgbAlphabetDefaultBgGlow = hexToRgb(effectiveAlphabetDefaultBgGlow)

  let currentEditingAlphabetBgColor = alphabetDefaultBgColor
  let currentEditingAlphabetBgHandler = handleAlphabetDefaultBgColorChange
  if (activeAlphabetBgTab === 'glow') {
    currentEditingAlphabetBgColor = alphabetDefaultBgGlowColor
    currentEditingAlphabetBgHandler = handleAlphabetDefaultBgGlowColorChange
  } else if (alphabetDefaultBgGradientEnabled && activeAlphabetBgTab === 'color2') {
    currentEditingAlphabetBgColor = alphabetDefaultBgColor2
    currentEditingAlphabetBgHandler = handleAlphabetDefaultBgColor2Change
  }
  const currentEditingAlphabetBgRgb = hexToRgb(currentEditingAlphabetBgColor)
  const currentEditingAlphabetBgHsl = rgbToHsl(currentEditingAlphabetBgRgb.r, currentEditingAlphabetBgRgb.g, currentEditingAlphabetBgRgb.b)

  const effectivePreviewAlphabetGlow1 = alphabetSyncGlowWithGradient ? alphabetBtnBgColor : alphabetGlowColor
  const effectivePreviewAlphabetGlow2 = alphabetSyncGlowWithGradient ? alphabetBtnBgColor2 : alphabetGlowColor
  const effectiveRgbPreviewAlphabetGlow1 = alphabetSyncGlowWithGradient ? rgbAlphabet1 : rgbAlphabetGlow
  const effectiveRgbPreviewAlphabetGlow2 = alphabetSyncGlowWithGradient ? rgbAlphabet2 : rgbAlphabetGlow
  const effectiveAlphabetGlowRgba1 = `rgba(${effectiveRgbPreviewAlphabetGlow1.r}, ${effectiveRgbPreviewAlphabetGlow1.g}, ${effectiveRgbPreviewAlphabetGlow1.b}, ${Math.min(1, 0.5 * alphabetOpacity)})`
  const effectiveAlphabetGlowRgba2 = `rgba(${effectiveRgbPreviewAlphabetGlow2.r}, ${effectiveRgbPreviewAlphabetGlow2.g}, ${effectiveRgbPreviewAlphabetGlow2.b}, ${Math.min(1, 0.5 * alphabetOpacity)})`

  // Computações de Cores - 3. Header Search & Add Game
  let currentEditingHeaderSearchColor = headerSearchColor1
  let currentEditingHeaderSearchHandler = handleHeaderSearchColor1Change
  if (activeHeaderSearchColorTab === 'glow') {
    currentEditingHeaderSearchColor = headerSearchGlowColor
    currentEditingHeaderSearchHandler = handleHeaderSearchGlowColorChange
  } else if (headerSearchGradientEnabled && activeHeaderSearchColorTab === 'color2') {
    currentEditingHeaderSearchColor = headerSearchColor2
    currentEditingHeaderSearchHandler = handleHeaderSearchColor2Change
  }
  const rgbHeaderSearch = hexToRgb(currentEditingHeaderSearchColor)
  const currentEditingHeaderSearchHsl = rgbToHsl(rgbHeaderSearch.r, rgbHeaderSearch.g, rgbHeaderSearch.b)
  const rgbHeaderSearch1 = hexToRgb(headerSearchColor1)
  const rgbHeaderSearch2 = hexToRgb(headerSearchColor2)
  const rgbHeaderSearchGlow = hexToRgb(headerSearchGlowColor)
  const rgbHeaderSearchDefaultBg = hexToRgb(headerSearchDefaultBgColor)
  const headerSearchDefaultBgHsl = rgbToHsl(rgbHeaderSearchDefaultBg.r, rgbHeaderSearchDefaultBg.g, rgbHeaderSearchDefaultBg.b)
  const effectivePreviewHeaderSearchGlow1 = headerSearchSyncGlowWithGradient ? headerSearchColor1 : headerSearchGlowColor
  const effectivePreviewHeaderSearchGlow2 = headerSearchSyncGlowWithGradient ? headerSearchColor2 : headerSearchGlowColor
  const effectiveRgbPreviewHeaderSearchGlow1 = headerSearchSyncGlowWithGradient ? rgbHeaderSearch1 : rgbHeaderSearchGlow
  const effectiveRgbPreviewHeaderSearchGlow2 = headerSearchSyncGlowWithGradient ? rgbHeaderSearch2 : rgbHeaderSearchGlow

  // Computações de Cores - 4. Barra Lateral Esquerda (Sidebar)
  let currentEditingSidebarColor = sidebarColor1
  let currentEditingSidebarHandler = handleSidebarColor1Change
  if (activeSidebarColorTab === 'glow') {
    currentEditingSidebarColor = sidebarGlowColor
    currentEditingSidebarHandler = handleSidebarGlowColorChange
  } else if (sidebarGradientEnabled && activeSidebarColorTab === 'color2') {
    currentEditingSidebarColor = sidebarColor2
    currentEditingSidebarHandler = handleSidebarColor2Change
  }
  const rgbSidebar = hexToRgb(currentEditingSidebarColor)
  const currentEditingSidebarHsl = rgbToHsl(rgbSidebar.r, rgbSidebar.g, rgbSidebar.b)
  const rgbSidebar1 = hexToRgb(sidebarColor1)
  const rgbSidebar2 = hexToRgb(sidebarColor2)
  const rgbSidebarGlow = hexToRgb(sidebarGlowColor)
  const rgbSidebarDefaultBg = hexToRgb(sidebarDefaultBgColor)
  const sidebarDefaultBgHsl = rgbToHsl(rgbSidebarDefaultBg.r, rgbSidebarDefaultBg.g, rgbSidebarDefaultBg.b)
  const effectivePreviewSidebarGlow1 = sidebarSyncGlowWithGradient ? sidebarColor1 : sidebarGlowColor
  const effectivePreviewSidebarGlow2 = sidebarSyncGlowWithGradient ? sidebarColor2 : sidebarGlowColor
  const effectiveRgbPreviewSidebarGlow1 = sidebarSyncGlowWithGradient ? rgbSidebar1 : rgbSidebarGlow
  const effectiveRgbPreviewSidebarGlow2 = sidebarSyncGlowWithGradient ? rgbSidebar2 : rgbSidebarGlow

  // Computações de Cores - 5. Ícones de Ação (Action Icons)
  let currentEditingActionIconsColor = actionIconsColor1
  let currentEditingActionIconsHandler = handleActionIconsColor1Change

  if (activeActionIconsColorTab === 'glow') {
    currentEditingActionIconsColor = actionIconsGlowColor
    currentEditingActionIconsHandler = handleActionIconsGlowColorChange
  } else if (actionIconsGradientEnabled && activeActionIconsColorTab === 'color2') {
    currentEditingActionIconsColor = actionIconsColor2
    currentEditingActionIconsHandler = handleActionIconsColor2Change
  }

  const rgbActionIcons = hexToRgb(currentEditingActionIconsColor)
  const currentEditingActionIconsHsl = rgbToHsl(rgbActionIcons.r, rgbActionIcons.g, rgbActionIcons.b)
  const rgbAction1 = hexToRgb(actionIconsColor1)
  const rgbAction2 = hexToRgb(actionIconsColor2)
  const rgbActionGlow = hexToRgb(actionIconsGlowColor)
  const rgbActionDefaultBg = hexToRgb(actionIconsDefaultBgColor)
  const actionDefaultBgHsl = rgbToHsl(rgbActionDefaultBg.r, rgbActionDefaultBg.g, rgbActionDefaultBg.b)

  const effectivePreviewGlow1 = actionIconsSyncGlowWithGradient ? actionIconsColor1 : actionIconsGlowColor
  const effectivePreviewGlow2 = actionIconsSyncGlowWithGradient ? actionIconsColor2 : actionIconsGlowColor
  const effectiveRgbPreviewGlow1 = actionIconsSyncGlowWithGradient ? rgbAction1 : rgbActionGlow
  const effectiveRgbPreviewGlow2 = actionIconsSyncGlowWithGradient ? rgbAction2 : rgbActionGlow

  // Computações de Cores - 6. Botões do Cabeçalho (Header Buttons)
  let currentEditingHeaderButtonsColor = headerButtonsColor1
  let currentEditingHeaderButtonsHandler = handleHeaderButtonsColor1Change

  if (activeHeaderButtonsColorTab === 'glow') {
    currentEditingHeaderButtonsColor = headerButtonsGlowColor
    currentEditingHeaderButtonsHandler = handleHeaderButtonsGlowColorChange
  } else if (headerButtonsGradientEnabled && activeHeaderButtonsColorTab === 'color2') {
    currentEditingHeaderButtonsColor = headerButtonsColor2
    currentEditingHeaderButtonsHandler = handleHeaderButtonsColor2Change
  }

  const rgbHeaderButtons = hexToRgb(currentEditingHeaderButtonsColor)
  const currentEditingHeaderButtonsHsl = rgbToHsl(rgbHeaderButtons.r, rgbHeaderButtons.g, rgbHeaderButtons.b)
  const rgbHeader1 = hexToRgb(headerButtonsColor1)
  const rgbHeader2 = hexToRgb(headerButtonsColor2)
  const rgbHeaderGlow = hexToRgb(headerButtonsGlowColor)
  const rgbHeaderDefaultBg = hexToRgb(headerButtonsDefaultBgColor)
  const headerDefaultBgHsl = rgbToHsl(rgbHeaderDefaultBg.r, rgbHeaderDefaultBg.g, rgbHeaderDefaultBg.b)

  const effectivePreviewHeaderGlow1 = headerButtonsSyncGlowWithGradient ? headerButtonsColor1 : headerButtonsGlowColor
  const effectivePreviewHeaderGlow2 = headerButtonsSyncGlowWithGradient ? headerButtonsColor2 : headerButtonsGlowColor
  const effectiveRgbPreviewHeaderGlow1 = headerButtonsSyncGlowWithGradient ? rgbHeader1 : rgbHeaderGlow
  const effectiveRgbPreviewHeaderGlow2 = headerButtonsSyncGlowWithGradient ? rgbHeader2 : rgbHeaderGlow
  
  const { r, g, b } = rgbAlphabet1
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const isLightColor = luminance > 140
  const useDarkText = isLightColor && alphabetBtnBgOpacity > 0.4

  const btnTextColor = useDarkText ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.7)'
  const btnDisabledTextColor = useDarkText ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.2)'
  
  const activeBtnBg = alphabetBgOpacity > 0.4
    ? (isLightColor ? 'rgba(0, 150, 150, 0.85)' : `rgba(${r}, ${g}, ${b}, 0.85)`)
    : 'rgba(0, 255, 255, 0.08)'

  // Estilos CSS Inline
  const styles = {
    screen: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      color: '#fff',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'sans-serif'
    } as React.CSSProperties,

    backgroundBlur: {
      position: 'absolute',
      inset: 0,
      backgroundImage: bgImage ? `url(${bgImage})` : 'none',
      backgroundColor: bgImage ? 'transparent' : '#121212',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(5px) brightness(0.6)',
      zIndex: 0
    } as React.CSSProperties,

    masterContainer: {
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'transparent',
      zIndex: 2,
      display: 'flex',
      overflowX: 'auto',
      overflowY: 'hidden'
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '11px',
      color: '#8a9bb0',
      textTransform: 'uppercase',
      fontWeight: 'bold',
      letterSpacing: '1px',
      marginBottom: '10px',
      display: 'block',
      flexShrink: 0
    } as React.CSSProperties,

    // =========================================
    // 1. COLUNA ESQUERDA (LOJAS)
    // =========================================
    sidebarLeft: {
      width: '380px',
      height: '100%',
      padding: '30px 0 30px 70px',
      background: 'rgba(30, 34, 40, 0.6)',
      backdropFilter: 'blur(8px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      flexShrink: 0
    } as React.CSSProperties,

    storeListContext: {
      flex: '1 1 auto',
      height: 0,
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingRight: '15px'
    } as React.CSSProperties,

    storeBlockCompact: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(0, 0, 0, 0.2)',
      padding: '8px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.05)'
    } as React.CSSProperties,

    dragHandle: {
      cursor: 'grab',
      color: '#8a9bb0',
      fontSize: '18px',
      padding: '0 5px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center'
    } as React.CSSProperties,

    squareIcon: {
      width: '32px',
      height: '32px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      color: '#fff'
    } as React.CSSProperties,

    textInputCompact: {
      flex: 1,
      minWidth: 0,
      height: '32px',
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid #4CAF50',
      borderRadius: '4px',
      color: '#fff',
      padding: '0 8px',
      fontSize: '13px',
      outline: 'none',
      boxSizing: 'border-box'
    } as React.CSSProperties,

    actionBtn: {
      width: '32px',
      height: '32px',
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#fff',
      fontSize: '14px'
    } as React.CSSProperties,

    deleteBtnCompact: {
      width: '32px',
      height: '32px',
      background: '#c62828',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontWeight: 'bold',
      cursor: 'pointer',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    } as React.CSSProperties,

    addStoreBtn: {
      width: '100%',
      height: '45px',
      background: 'rgba(0, 0, 0, 0.4)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '20px',
      flexShrink: 0
    } as React.CSSProperties,

    // =========================================
    // 2. COLUNA CENTRAL (PREVIEW)
    // =========================================
    centerPreview: {
      flex: 1,
      minWidth: '550px',
      flexShrink: 0,
      height: '100%',
      background: 'rgba(20, 24, 30, 0.4)',
      backdropFilter: 'blur(4px)',
      padding: '0px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    } as React.CSSProperties,

    previewArea: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'rgba(0,0,0,0.2)'
    } as React.CSSProperties,

    // =========================================
    // 3. COLUNA DIREITA (BACKGROUND E CONFIGS)
    // =========================================
    sidebarRight: {
      width: '350px',
      height: '100%',
      background: 'rgba(30, 34, 40, 0.6)',
      backdropFilter: 'blur(8px)',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      padding: '20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0
    } as React.CSSProperties,

    dropZone: {
      width: '100%',
      border: isDraggingBg ? '2px dashed #4CAF50' : '2px dashed rgba(255, 255, 255, 0.2)',
      background: isDraggingBg ? 'rgba(76, 175, 80, 0.05)' : 'transparent',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      padding: '20px 15px',
      boxSizing: 'border-box',
      transition: 'all 0.2s ease'
    } as React.CSSProperties,

    dropZoneText: {
      fontSize: '16px',
      color: '#8a9bb0',
      textAlign: 'center'
    } as React.CSSProperties,

    searchFileBtn: {
      background: 'rgba(255, 255, 255, 0.15)',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      padding: '10px 25px',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer'
    } as React.CSSProperties,

    recommendationText: {
      fontSize: '12px',
      color: '#8a9bb0',
      textAlign: 'center',
      marginTop: '12px'
    } as React.CSSProperties,

    // Estilos dos Novos Toggles
    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(0, 0, 0, 0.2)',
      padding: '12px 15px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.05)',
      cursor: 'pointer',
      transition: 'background 0.2s'
    } as React.CSSProperties,

    toggleTextGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    } as React.CSSProperties,

    toggleTitle: {
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#fff'
    } as React.CSSProperties,

    toggleSub: {
      fontSize: '11px',
      color: '#8a9bb0'
    } as React.CSSProperties,

    checkbox: {
      width: '18px',
      height: '18px',
      accentColor: '#4CAF50',
      cursor: 'pointer',
      margin: 0
    } as React.CSSProperties
  }

  const [sidebarItems, setSidebarItems] = useState<{ id: string; icon?: any; isDivider?: boolean; active?: boolean }[]>(() => {
    const saved = localStorage.getItem('heroic_sidebar_order')
    const defaultOrder = [
      { id: 'library', icon: faGamepad, active: false },
      { id: 'releases', icon: faClock, active: false },
      { id: 'personalization', icon: faPaintBrush, active: true },
      { id: 'login', icon: faUser, active: false },
      { id: 'stores', icon: faStore, active: false },
      { id: 'divider-1', isDivider: true },
      { id: 'settings', icon: faSlidersH, active: false },
      { id: 'console', icon: faTv, active: false },
      { id: 'downloads', icon: faBarsProgress, active: false },
      { id: 'accessibility', icon: faUniversalAccess, active: false },
      { id: 'divider-2', isDivider: true },
      { id: 'wiki', icon: faGithub, active: false },
      { id: 'quit', icon: faPowerOff, active: false }
    ]
    if (saved) {
      try {
        const parsedIds = JSON.parse(saved) as string[]
        const orderedList: typeof defaultOrder = []
        parsedIds.forEach(id => {
          const found = defaultOrder.find(item => item.id === id)
          if (found) orderedList.push(found)
        })
        defaultOrder.forEach(item => {
          if (!orderedList.some(o => o.id === item.id)) {
            orderedList.push(item)
          }
        })
        return orderedList
      } catch (err) {
        console.error('Erro ao ler ordem da barra lateral:', err)
      }
    }
    return defaultOrder
  })

  const [draggedSidebarItemIndex, setDraggedSidebarItemIndex] = useState<number | null>(null)

  const handleSidebarItemDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSidebarItemIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleSidebarItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedSidebarItemIndex === null || draggedSidebarItemIndex === index) return

    const updated = [...sidebarItems]
    const draggedItem = updated[draggedSidebarItemIndex]

    updated.splice(draggedSidebarItemIndex, 1)
    updated.splice(index, 0, draggedItem)

    setDraggedSidebarItemIndex(index)
    setSidebarItems(updated)

    localStorage.setItem('heroic_sidebar_order', JSON.stringify(updated.map(item => item.id)))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleSidebarItemDragEnd = () => {
    setDraggedSidebarItemIndex(null)
  }

  return (
    <div style={styles.screen}>
      <style>{`
        input[type='range'].color-picker-range {
          width: 100% !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          background: transparent !important;
          outline: none !important;
          cursor: pointer !important;
          height: 28px !important;
          margin: 0 !important;
          accent-color: transparent !important;
        }
        
        /* HUE SLIDER TRACK */
        input[type='range'].hue-picker-range::-webkit-slider-runnable-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000) !important;
        }
        input[type='range'].hue-picker-range::-moz-range-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000) !important;
        }

        /* ALPHA SLIDER TRACK */
        input[type='range'].alpha-picker-range::-webkit-slider-runnable-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: var(--alpha-track-bg) !important;
        }
        input[type='range'].alpha-picker-range::-moz-range-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: var(--alpha-track-bg) !important;
        }

        /* HUE SLIDER TRACK */
        input[type='range'].hue-picker-range::-webkit-slider-runnable-track {
          width: 100% !important;
          height: 8px !important;
          border-radius: 4px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000) !important;
        }
        input[type='range'].hue-picker-range::-moz-range-track {
          width: 100% !important;
          height: 8px !important;
          border-radius: 4px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000) !important;
        }

        /* HUE THUMB */
        input[type='range'].hue-picker-range::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 16px !important;
          width: 8px !important;
          border-radius: 4px !important;
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.4) !important;
          cursor: pointer !important;
          margin-top: -4px !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4) !important;
        }
        input[type='range'].hue-picker-range::-moz-range-thumb {
          height: 16px !important;
          width: 8px !important;
          border-radius: 4px !important;
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.4) !important;
          cursor: pointer !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4) !important;
        }

        /* ALPHA THUMB */
        input[type='range'].alpha-picker-range::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 28px !important;
          width: 12px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          margin-top: -4px !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].alpha-picker-range::-webkit-slider-thumb:hover {
          transform: scale(1.1) !important;
        }
        input[type='range'].alpha-picker-range::-moz-range-thumb {
          height: 26px !important;
          width: 10px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].alpha-picker-range::-moz-range-thumb:hover {
          transform: scale(1.1) !important;
        }

        /* LIGHTNESS SLIDER TRACK */
        input[type='range'].lightness-picker-range::-webkit-slider-runnable-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: var(--lightness-track-bg) !important;
        }
        input[type='range'].lightness-picker-range::-moz-range-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: var(--lightness-track-bg) !important;
        }

        /* LIGHTNESS THUMB */
        input[type='range'].lightness-picker-range::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 28px !important;
          width: 12px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          margin-top: -4px !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].lightness-picker-range::-webkit-slider-thumb:hover {
          transform: scale(1.1) !important;
        }
        input[type='range'].lightness-picker-range::-moz-range-thumb {
          height: 26px !important;
          width: 10px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].lightness-picker-range::-moz-range-thumb:hover {
          transform: scale(1.1) !important;
        }

        /* GRAYSCALE SLIDER TRACK (White -> Grey -> Black) */
        input[type='range'].grayscale-picker-range::-webkit-slider-runnable-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: linear-gradient(to right, #ffffff, #808080, #000000) !important;
        }
        input[type='range'].grayscale-picker-range::-moz-range-track {
          width: 100% !important;
          height: 20px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: linear-gradient(to right, #ffffff, #808080, #000000) !important;
        }

        /* GRAYSCALE THUMB */
        input[type='range'].grayscale-picker-range::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 28px !important;
          width: 12px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          margin-top: -4px !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].grayscale-picker-range::-webkit-slider-thumb:hover {
          transform: scale(1.1) !important;
        }
        input[type='range'].grayscale-picker-range::-moz-range-thumb {
          height: 26px !important;
          width: 10px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].grayscale-picker-range::-moz-range-thumb:hover {
          transform: scale(1.1) !important;
        }

        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }

        /* SIMULATED SIDEBAR FOR PREVIEW */
        .preview-sidebar {
          width: 56px;
          height: 100%;
          background: #0b0e14;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 0;
          box-sizing: border-box;
          flex-shrink: 0;
          position: relative;
          cursor: grab;
          user-select: none;
          transition: background-color 0.2s, border-color 0.2s;
        }

        .preview-sidebar:active {
          cursor: grabbing;
        }

        .preview-sidebar.sidebar-on-right {
          border-right: none;
          border-left: 1px solid rgba(255, 255, 255, 0.05);
        }

        .preview-sidebar--selected {
          box-shadow: inset 0 0 0 1.5px rgba(230, 126, 34, 0.6);
        }

        .preview-sidebar-logo-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 12px;
          margin-top: 8px;
          position: relative;
        }

        .preview-sidebar-logo {
          width: 38px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .preview-sidebar-logo svg {
          width: 100%;
          height: 100%;
          color: #fff;
        }

        .preview-sidebar-nav {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 100%;
          flex: 1;
        }

        .preview-sidebar-item {
          color: rgba(255, 255, 255, 0.6);
          font-size: 18px;
          cursor: pointer;
          transition: color 0.2s, transform 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
        }

        .preview-sidebar-item:hover {
          color: #fff;
          background-color: rgba(255, 255, 255, 0.05);
          transform: scale(1.1);
        }

        .preview-sidebar-item.active {
          color: #3cf2e6;
          background-color: rgba(60, 242, 230, 0.08);
        }

        .preview-sidebar-divider {
          width: 30px;
          height: 1px;
          background-color: rgba(255, 255, 255, 0.08);
          margin: 4px 0;
        }

        .preview-sidebar-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin-top: auto;
        }

        .preview-sidebar-version {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          line-height: 1.2;
        }

        /* SIMULATED LAUNCHER PREVIEW STYLES */
        .preview-library-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background: rgba(20, 24, 30, 0.25);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          padding: 16px;
          overflow-y: auto;
        }
        
        .preview-top-bar {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 14px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 16px;
          width: 100%;
        }

        .preview-search-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 290px;
        }

        .preview-search-bar {
          display: flex;
          align-items: center;
          height: 48px;
          background: var(--search-bar-background, var(--input-background));
          border-radius: var(--space-md);
          padding: 0 var(--space-sm);
          box-sizing: border-box;
          width: 100%;
          border: none;
          transition: background-color 250ms;
        }

        .preview-search-icon-svg {
          color: var(--text-secondary);
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          padding: var(--space-2xs) var(--space-sm);
          box-sizing: content-box;
        }

        .preview-search-input {
          background: transparent;
          border: none !important;
          outline: none !important;
          color: var(--text-secondary);
          font: var(--font-secondary-bold);
          font-size: 15px;
          padding: 0 var(--space-2xs);
          width: 100%;
          box-sizing: border-box;
          transition: color 250ms;
        }
        .preview-search-input::placeholder {
          color: var(--text-secondary);
          opacity: 0.8;
        }

        .preview-suggestions-dropdown {
          position: absolute;
          top: 40px;
          left: 0;
          right: 0;
          background: var(--input-background);
          border: 1px solid var(--divider, rgba(255, 255, 255, 0.1));
          border-radius: var(--space-md);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          z-index: 10;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .preview-suggestion-item {
          font-size: 13px;
          color: #a0aec0;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
        }
        .preview-suggestion-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .preview-platforms-bar {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          gap: 16px;
          width: 100%;
          box-sizing: border-box;
          padding: 6px;
          border: 1.5px dashed transparent;
          border-radius: 14px;
          transition: border-color 0.2s, background-color 0.2s;
          cursor: pointer;
        }
        .preview-platforms-bar:hover {
          background-color: rgba(255, 255, 255, 0.02);
        }
        .preview-platforms-bar--selected {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }

        .preview-platform-btn {
          box-sizing: border-box !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 4px 6px;
          border-radius: var(--store-btn-border-radius, 12px);
          background: var(--store-btn-bg, rgba(255, 255, 255, 0.03)) padding-box, transparent border-box !important;
          border: 1px solid var(--store-btn-border-color, rgba(255, 255, 255, 0.08)) !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          color: #fff;
          font-size: 18px;
          font-weight: 400;
          cursor: pointer;
          white-space: nowrap;
          transition: transform 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
          flex-shrink: 0;
          backdrop-filter: var(--store-btn-backdrop-filter, blur(12px));
          -webkit-backdrop-filter: var(--store-btn-backdrop-filter, blur(12px));
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translate3d(0, 0, 0) scale(1);
          backface-visibility: hidden;
          will-change: transform, border-color, box-shadow;
          position: relative !important;
          overflow: hidden !important;
          outline: none !important;
        }

        .preview-platform-btn:focus,
        .preview-platform-btn:focus-visible,
        .preview-platform-btn:active {
          outline: none !important;
        }

        .preview-platform-btn:hover {
          transform: translate3d(0, 0, 0) scale(1.08) !important;
        }

        /* Ensure contents stay above the hover overlay */
        .preview-platform-btn > img,
        .preview-platform-btn > div,
        .preview-platform-btn > span {
          position: relative !important;
          z-index: 2 !important;
        }

        /* Hover overlay using ::before pseudo-element */
        .preview-platforms-bar:not(.preview-platforms-bar--neon) .preview-platform-btn::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background: var(--store-btn-hover-bg, rgba(255, 255, 255, 0.06)) padding-box, transparent border-box !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          opacity: 0 !important;
          transition: opacity 0.2s ease-in-out !important;
          z-index: 1 !important;
          pointer-events: none !important;
        }

        .preview-platforms-bar:not(.preview-platforms-bar--neon) .preview-platform-btn:hover::before {
          opacity: 1 !important;
        }

        .preview-platforms-bar:not(.preview-platforms-bar--neon) .preview-platform-btn--active {
          background: linear-gradient(135deg, var(--store-btn-active-bg-start, rgba(20, 24, 30, 0.6)) 0%, var(--store-btn-active-bg-end, rgba(230, 126, 34, 0.06)) 100%) padding-box, linear-gradient(135deg, var(--store-btn-active-border-start, rgba(255, 255, 255, 0.15)) 0%, var(--store-btn-active-border-end, rgba(230, 126, 34, 0.95)) 100%) border-box !important;
          border-color: transparent !important;
          font-weight: 400 !important;
          backdrop-filter: var(--store-btn-backdrop-filter, blur(12px)) !important;
          -webkit-backdrop-filter: var(--store-btn-backdrop-filter, blur(12px)) !important;
          box-shadow: 0 3px 12px 0 var(--store-btn-shadow-color, rgba(230, 126, 34, 0.14)), inset 0 0 8px rgba(255, 255, 255, 0.05) !important;
          position: relative;
          z-index: 2;
          transform: translate3d(0, 0, 0) scale(1.1) !important;
        }

        .preview-platforms-bar:not(.preview-platforms-bar--neon) .preview-platform-btn--active:hover {
          transform: translate3d(0, 0, 0) scale(1.1) !important;
        }

        .preview-platforms-bar--zero-bg .preview-platform-btn,
        .preview-platforms-bar--zero-bg .preview-platform-btn:hover,
        .preview-platforms-bar--zero-bg .preview-platform-btn--active,
        .preview-platforms-bar--zero-bg .preview-platform-btn--active:hover {
          background: transparent !important;
          border: 1px solid transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .preview-platforms-bar--zero-bg .preview-platform-btn::before,
        .preview-platforms-bar--zero-bg .preview-platform-btn:hover::before {
          display: none !important;
        }

        .preview-platform-icon-img {
          width: 40px;
          height: 40px;
          object-fit: contain;
        }

        .preview-platform-icon-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #4CAF50;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: #fff;
          font-weight: bold;
        }

        .preview-header-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-bottom: 10px;
          margin-bottom: 16px;
          width: 100%;
          gap: 20px;
        }

        .preview-title {
          font-size: 18px;
          font-weight: bold;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .preview-title-count {
          font-size: 13px;
          color: #8a9bb0;
          background: rgba(255, 255, 255, 0.08);
          padding: 3px 8px;
          border-radius: 12px;
        }

        /* SIMULATED ALFABETO */
        .preview-alphabet-container {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
          padding: 6px 12px;
          background-color: rgba(var(--base-r), var(--base-g), var(--base-b), var(--bg-op));
          border-radius: 20px;
          border: 1px solid rgba(var(--base-r), var(--base-g), var(--base-b), calc(var(--bg-op) * 0.8));
          outline: 1.5px dashed transparent;
          outline-offset: 2px;
          max-width: 100%;
          overflow-x: auto;
          scrollbar-width: none;
          backdrop-filter: var(--alphabet-backdrop-filter, blur(12px));
          -webkit-backdrop-filter: var(--alphabet-backdrop-filter, blur(12px));
          transition: border-color 0.2s, background-color 0.2s, outline-color 0.2s;
          cursor: pointer;
        }
        .preview-alphabet-container:hover {
          background-color: rgba(255, 255, 255, 0.02);
        }
        .preview-alphabet-container--selected {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        .preview-alphabet-container::-webkit-scrollbar {
          display: none;
        }

        .preview-alphabet-btn {
          box-sizing: border-box !important;
          background: var(--alphabet-btn-bg, rgba(255, 255, 255, 0.03)) padding-box, transparent border-box !important;
          border: var(--alphabet-btn-border-width, 1px) solid var(--alphabet-btn-border-color, rgba(255, 255, 255, 0.08)) !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          color: var(--txt-color);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 600;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--alphabet-btn-border-radius, 50%);
          flex-shrink: 0;
          user-select: none;
          outline: none;
          transition: transform 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
          backdrop-filter: var(--alphabet-btn-backdrop-filter, blur(12px));
          -webkit-backdrop-filter: var(--alphabet-btn-backdrop-filter, blur(12px));
          position: relative !important;
        }
        
        .preview-alphabet-btn:hover {
          transform: scale(1.08) !important;
        }

        .preview-alphabet-container--zero-bg .preview-alphabet-btn,
        .preview-alphabet-btn--zero-bg {
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

        .preview-alphabet-container--zero-bg .preview-alphabet-btn::before,
        .preview-alphabet-btn--zero-bg::before,
        .preview-alphabet-btn--zero-bg:hover::before,
        .preview-alphabet-btn--zero-bg.preview-alphabet-btn--active::before {
          display: none !important;
          content: none !important;
        }

        .preview-alphabet-btn:not(.preview-alphabet-btn--zero-bg)::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background: var(--alphabet-btn-hover-bg, rgba(255, 255, 255, 0.06)) padding-box, transparent border-box !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          opacity: 0 !important;
          transition: opacity 0.2s ease-in-out !important;
          z-index: 1 !important;
          pointer-events: none !important;
        }

        .preview-alphabet-btn:not(.preview-alphabet-btn--zero-bg):hover::before {
          opacity: 1 !important;
        }

        .preview-alphabet-btn:not(.preview-alphabet-btn--zero-bg).preview-alphabet-btn--active {
          background: linear-gradient(135deg, var(--alphabet-btn-active-bg-start, rgba(20, 24, 30, 0.6)) 0%, var(--alphabet-btn-active-bg-end, rgba(230, 126, 34, 0.06)) 100%) padding-box, linear-gradient(135deg, var(--alphabet-btn-active-border-start, rgba(255, 255, 255, 0.2)) 0%, var(--alphabet-btn-active-border-end, rgba(230, 126, 34, 0.95)) 100%) border-box !important;
          border: 2px solid transparent !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 3px 10px 0 var(--alphabet-btn-shadow-color, rgba(230, 126, 34, 0.25)), inset 0 0 4px rgba(255, 255, 255, 0.1) !important;
          transform: scale(1.1) !important;
          z-index: 2;
        }

        .preview-alphabet-btn--disabled {
          color: var(--disabled-txt-color) !important;
          opacity: 0.6;
        }

        /* GRID DE JOGOS PREVIEW */
        .preview-games-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }

        .preview-game-card {
          position: relative;
          aspect-ratio: 173/275;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          transition: transform 0.2s;
        }

        .preview-game-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .preview-game-banner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.85;
        }

        .preview-game-banner-logo {
          font-size: 10px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          text-align: center;
          padding: 10px;
          text-transform: uppercase;
        }

        .preview-game-overlay {
          position: relative;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0) 100%);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 2;
        }

        .preview-game-title {
          font-size: 10px;
          font-weight: bold;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }

        .preview-game-store {
          font-size: 8px;
          color: #a0aec0;
          text-align: left;
        }

        /* OVERLAYS DOS JOGOS REATIVOS */
        .preview-game-badge-container {
          position: absolute;
          top: 6px;
          right: 6px;
          display: flex;
          gap: 4px;
          z-index: 3;
        }

        .preview-game-badge-item {
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Custom thin scrollbar for store list */
        .store-list-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .store-list-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .store-list-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 10px;
        }
        .store-list-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
      <div style={styles.backgroundBlur} />

      <div style={styles.masterContainer}>
        {/* ========================================= */}
        {/* 1. SIDEBAR ESQUERDA (LOJAS)               */}
        {/* ========================================= */}
        <div style={styles.sidebarLeft}>
          <div style={{ paddingRight: '15px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 300, color: '#fff', margin: '0 0 12px 0', fontFamily: 'sans-serif' }}>Lojas</h2>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          <div style={styles.storeListContext} className="store-list-scrollbar">
            {stores.map((store, index) => {
              const isStoreVisible = store.isVisible ?? true
              const isDragged = draggedIndex === index
              const imageSource = store.icon
                ? store.icon
                : ['epic', 'gog', 'amazon', 'zoom', 'sideloaded', 'steam'].includes(store.id)
                  ? `/images/${store.id}.png`
                  : null;

              return (
                <div
                  key={store.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isDragged 
                      ? 'rgba(255, 255, 255, 0.01)' 
                      : focusedStoreId === store.id 
                        ? 'linear-gradient(135deg, rgba(20, 24, 30, 0.6) 0%, rgba(230, 126, 34, 0.06) 100%), linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(230, 126, 34, 0.95) 100%)' 
                        : 'rgba(255, 255, 255, 0.03)',
                    backgroundClip: focusedStoreId === store.id ? 'padding-box, border-box' : 'border-box',
                    backgroundOrigin: focusedStoreId === store.id ? 'padding-box, border-box' : 'border-box',
                    border: isDragged
                      ? '1px dashed rgba(230, 126, 34, 0.6)'
                      : focusedStoreId === store.id
                        ? '1px solid transparent'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isDragged
                      ? 'none'
                      : focusedStoreId === store.id
                        ? '0 3px 12px 0 rgba(230, 126, 34, 0.14), inset 0 0 8px rgba(255, 255, 255, 0.05)'
                        : '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    opacity: isDragged ? 0.35 : (focusedStoreId === store.id || isStoreVisible ? 1 : 0.65),
                    transform: isDragged ? 'scale(0.98)' : 'none',
                    cursor: 'grab',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    boxSizing: 'border-box',
                    position: 'relative',
                    zIndex: focusedStoreId === store.id ? 2 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                    {/* Clickable Icon Label */}
                    <label 
                      style={{
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                        background: 'transparent'
                      }}
                      title="Clique para alterar o ícone"
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <input
                        type="file"
                        accept=".png"
                        onChange={(e) => handleIconUpload(store.id, e)}
                        style={{ display: 'none' }}
                      />
                      {imageSource ? (
                        <img
                          src={imageSource}
                          alt=""
                          style={{
                            width: '34px',
                            height: '34px',
                            objectFit: 'contain'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.4)' }}>
                          📷
                        </span>
                      )}
                    </label>

                    {/* Name Input */}
                    <input
                      type="text"
                      value={store.name}
                      placeholder="Nome da Loja"
                      onChange={(e) => handleNameChange(store.id, e.target.value)}
                      onFocus={() => setFocusedStoreId(store.id)}
                      onBlur={() => setFocusedStoreId(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#fff',
                        fontSize: '15px',
                        fontWeight: 400,
                        width: '100%',
                        padding: '4px 0',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {/* Toggle Visibility Button */}
                    <button
                      onClick={() => handleToggleVisibility(store.id)}
                      title={isStoreVisible ? "Ocultar Loja" : "Mostrar Loja"}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: isStoreVisible ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      {isStoreVisible ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      )}
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleRemoveStore(store.id)}
                      title="Remover Loja"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.85)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(231, 76, 60, 0.12)';
                        e.currentTarget.style.borderColor = 'rgba(231, 76, 60, 0.3)';
                        e.currentTarget.style.color = '#e74c3c';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ paddingRight: '15px', marginTop: '16px' }}>
            <button
              onClick={handleAddStore}
              style={{
                width: '100%',
                padding: '14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '14px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: 300, lineHeight: 1 }}>+</span>
              Nova Loja
            </button>
          </div>
        </div>

        {/* ========================================= */}
        {/* 2. ÁREA CENTRAL (PREVIEW DE PERSONALIZAÇÃO) */}
        {/* ========================================= */}
        <div style={styles.centerPreview}>
          <div 
            style={{
              ...styles.previewArea,
              flexDirection: sidebarPosition === 'left' ? 'row' : 'row-reverse'
            }}
            onDragOver={handlePreviewAreaDragOver}
          >
            {/* SIMULATED SIDEBAR */}
            <div
              className={`preview-sidebar ${sidebarPosition === 'right' ? 'sidebar-on-right' : ''} ${sidebarGlowMode === 'neon' ? 'preview-sidebar--neon' : ''} ${sidebarGradientEnabled ? 'preview-sidebar--gradient' : ''} ${rightPanelMode === 'sidebar' ? 'preview-sidebar--selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setRightPanelMode('sidebar')
              }}
              style={{
                cursor: 'pointer',
                '--preview-sidebar-color-1': sidebarColor1,
                '--preview-sidebar-color-2': sidebarColor2,
                '--preview-sidebar-glow-color-1': effectivePreviewSidebarGlow1,
                '--preview-sidebar-glow-color-2': effectivePreviewSidebarGlow2,
                '--preview-sidebar-opacity': sidebarOpacity,
                '--preview-sidebar-glow-strength': `${sidebarGlowStrength}px`,
                '--preview-sidebar-glow-rgba-1': `rgba(${effectiveRgbPreviewSidebarGlow1.r}, ${effectiveRgbPreviewSidebarGlow1.g}, ${effectiveRgbPreviewSidebarGlow1.b}, ${Math.min(1, 0.9 * sidebarOpacity)})`,
                '--preview-sidebar-glow-rgba-2': `rgba(${effectiveRgbPreviewSidebarGlow2.r}, ${effectiveRgbPreviewSidebarGlow2.g}, ${effectiveRgbPreviewSidebarGlow2.b}, ${Math.min(1, 0.9 * sidebarOpacity)})`,
                '--preview-sidebar-default-bg-color': `rgba(${rgbSidebarDefaultBg.r}, ${rgbSidebarDefaultBg.g}, ${rgbSidebarDefaultBg.b}, ${sidebarDefaultBgOpacity})`,
                '--preview-sidebar-default-border-color': `rgba(${rgbSidebarDefaultBg.r}, ${rgbSidebarDefaultBg.g}, ${rgbSidebarDefaultBg.b}, ${Math.min(1, sidebarDefaultBgOpacity * 2.5)})`
              } as React.CSSProperties}
            >
              <div className="preview-sidebar-logo-container">
                <div 
                  className="preview-sidebar-logo"
                  draggable
                  onDragStart={(e) => {
                    setIsDraggingSidebar(true)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setIsDraggingSidebar(false)
                  }}
                >
                  <HeroicIcon />
                </div>
              </div>
              <div className="preview-sidebar-nav">
                {sidebarItems.map((item, idx) => {
                  if (item.isDivider) {
                    return (
                      <div 
                        key={item.id} 
                        className="preview-sidebar-divider"
                        draggable
                        onDragStart={(e) => handleSidebarItemDragStart(e, idx)}
                        onDragOver={(e) => handleSidebarItemDragOver(e, idx)}
                        onDragEnd={handleSidebarItemDragEnd}
                      />
                    )
                  }
                  return (
                    <div
                      key={item.id}
                      className={`preview-sidebar-item ${item.active ? 'active' : ''}`}
                      draggable
                      onDragStart={(e) => handleSidebarItemDragStart(e, idx)}
                      onDragOver={(e) => handleSidebarItemDragOver(e, idx)}
                      onDragEnd={handleSidebarItemDragEnd}
                    >
                      <FontAwesomeIcon icon={item.icon!} />
                    </div>
                  )
                })}
              </div>
              <div className="preview-sidebar-bottom">
                <span className="preview-sidebar-version">0.0.1<br/>Alpha</span>
                <div 
                  className="preview-sidebar-item" 
                  style={{ width: '30px', height: '30px', fontSize: '16px' }}
                  draggable
                  onDragStart={(e) => {
                    setIsDraggingSidebar(true)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setIsDraggingSidebar(false)
                  }}
                >
                  <FontAwesomeIcon icon={faQuestionCircle} />
                </div>
              </div>
            </div>

            <div 
              className="preview-library-container"
              onClick={() => setRightPanelMode('default')}
              style={{ flex: 1 }}
            >
              {/* 1. TOP BAR */}
              <div className="preview-top-bar">
                {/* LINHA 1: Barra de busca, navegação e botões/filtros mockados */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '15px' }}>
                  {/* Lado Esquerdo: Navegação, Busca, Botão Adicionar e Ícones */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      className={`preview-search-wrapper ${headerSearchGlowMode === 'neon' ? 'preview-search--neon' : ''} ${headerSearchGradientEnabled ? 'preview-search--gradient' : ''} ${rightPanelMode === 'headerSearch' ? 'preview-search--selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setRightPanelMode('headerSearch')
                      }}
                      style={{
                        cursor: 'pointer',
                        '--preview-search-color-1': headerSearchColor1,
                        '--preview-search-color-2': headerSearchColor2,
                        '--preview-search-glow-color-1': effectivePreviewHeaderSearchGlow1,
                        '--preview-search-glow-color-2': effectivePreviewHeaderSearchGlow2,
                        '--preview-search-opacity': headerSearchOpacity,
                        '--preview-search-glow-strength': `${headerSearchGlowStrength}px`,
                        '--preview-search-glow-rgba-1': `rgba(${effectiveRgbPreviewHeaderSearchGlow1.r}, ${effectiveRgbPreviewHeaderSearchGlow1.g}, ${effectiveRgbPreviewHeaderSearchGlow1.b}, ${Math.min(1, 0.9 * headerSearchOpacity)})`,
                        '--preview-search-glow-rgba-2': `rgba(${effectiveRgbPreviewHeaderSearchGlow2.r}, ${effectiveRgbPreviewHeaderSearchGlow2.g}, ${effectiveRgbPreviewHeaderSearchGlow2.b}, ${Math.min(1, 0.9 * headerSearchOpacity)})`,
                        '--preview-search-default-bg-color': `rgba(${rgbHeaderSearchDefaultBg.r}, ${rgbHeaderSearchDefaultBg.g}, ${rgbHeaderSearchDefaultBg.b}, ${headerSearchDefaultBgOpacity})`,
                        '--preview-search-default-border-color': `rgba(${rgbHeaderSearchDefaultBg.r}, ${rgbHeaderSearchDefaultBg.g}, ${rgbHeaderSearchDefaultBg.b}, ${Math.min(1, headerSearchDefaultBgOpacity * 2.5)})`
                      } as React.CSSProperties}
                    >
                      <div className="preview-search-bar">
                        <svg aria-hidden="true" focusable="false" className="preview-search-icon-svg" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                          <path fill="currentColor" d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"></path>
                        </svg>
                        <input
                          type="text"
                          className="preview-search-input"
                          placeholder="Buscar jogos"
                          readOnly
                        />
                      </div>
                      {/* Simulated Search Suggestions Dropdown */}
                      {!hideSearchSuggestions && (
                        <div className="preview-suggestions-dropdown" style={{ top: '52px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', padding: '4px 10px', textAlign: 'left' }}>SUGESTÕES DE BUSCA</span>
                          <div className="preview-suggestion-item">🎮 Cyberpunk 2077</div>
                          <div className="preview-suggestion-item">🎮 The Witcher 3: Wild Hunt</div>
                          <div className="preview-suggestion-item">🎮 Hades</div>
                        </div>
                      )}
                    </div>

                    {/* Botão + ADICIONAR JOGO */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setRightPanelMode('headerSearch')
                      }}
                      style={{
                        fontFamily: 'var(--secondary-font-family)',
                        borderRadius: '24px',
                        color: 'var(--text-tertiary, #151921)',
                        background: 'var(--primary-button, var(--accent, #3cf2e6))',
                        height: '48px',
                        padding: '0 20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      + ADICIONAR JOGO
                    </button>

                    {/* Ícones de Ação mockados */}
                    <div 
                      className={`preview-action-icons ${actionIconsGlowMode === 'neon' ? 'preview-action-icons--neon' : ''} ${actionIconsGradientEnabled ? 'preview-action-icons--gradient' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setRightPanelMode('headerControls')
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '18px',
                        marginLeft: '8px',
                        cursor: 'pointer',
                        '--preview-action-color-1': actionIconsColor1,
                        '--preview-action-color-2': actionIconsColor2,
                        '--preview-action-glow-color-1': effectivePreviewGlow1,
                        '--preview-action-glow-color-2': effectivePreviewGlow2,
                        '--preview-action-opacity': actionIconsOpacity,
                        '--preview-action-glow-strength': `${actionIconsGlowStrength}px`,
                        '--preview-action-glow-rgba-1': `rgba(${effectiveRgbPreviewGlow1.r}, ${effectiveRgbPreviewGlow1.g}, ${effectiveRgbPreviewGlow1.b}, ${Math.min(1, 0.9 * actionIconsOpacity)})`,
                        '--preview-action-glow-rgba-2': `rgba(${effectiveRgbPreviewGlow2.r}, ${effectiveRgbPreviewGlow2.g}, ${effectiveRgbPreviewGlow2.b}, ${Math.min(1, 0.9 * actionIconsOpacity)})`,
                        '--preview-action-default-bg-color': `rgba(${rgbActionDefaultBg.r}, ${rgbActionDefaultBg.g}, ${rgbActionDefaultBg.b}, ${actionIconsDefaultBgOpacity})`,
                        '--preview-action-default-border-color': `rgba(${rgbActionDefaultBg.r}, ${rgbActionDefaultBg.g}, ${rgbActionDefaultBg.b}, ${Math.min(1, actionIconsDefaultBgOpacity * 2)})`
                      } as React.CSSProperties}
                    >
                      <span title="Exibição em Lista">☰</span>
                      <span title="Ordenar">⇅</span>
                      <span title="Exibição em Grade" style={{ color: '#fff' }}>☷</span>
                      <span title="Ocultar Instalados">👁</span>
                      <span title="Recarregar">↻</span>
                    </div>

                    {/* Switch de Layout Novo Modo / Modo Antigo Real */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', zIndex: 10 }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', minWidth: '70px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {useInlinePanel ? 'Novo Modo' : 'Modo Antigo'}
                      </span>
                      <label className="premium-switch" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={useInlinePanel}
                          onChange={handleToggleInlinePanel}
                        />
                        <span className="premium-slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* Lado Direito: Filtros mockados */}
                  <div 
                    className={`preview-header-buttons ${headerButtonsGlowMode === 'neon' ? 'preview-header-buttons--neon' : ''} ${headerButtonsGradientEnabled ? 'preview-header-buttons--gradient' : ''} ${rightPanelMode === 'headerButtons' ? 'preview-header-buttons--selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setRightPanelMode('headerButtons')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      '--preview-header-color-1': headerButtonsColor1,
                      '--preview-header-color-2': headerButtonsColor2,
                      '--preview-header-glow-color-1': effectivePreviewHeaderGlow1,
                      '--preview-header-glow-color-2': effectivePreviewHeaderGlow2,
                      '--preview-header-opacity': headerButtonsOpacity,
                      '--preview-header-glow-strength': `${headerButtonsGlowStrength}px`,
                      '--preview-header-glow-rgba-1': `rgba(${effectiveRgbPreviewHeaderGlow1.r}, ${effectiveRgbPreviewHeaderGlow1.g}, ${effectiveRgbPreviewHeaderGlow1.b}, ${Math.min(1, 0.9 * headerButtonsOpacity)})`,
                      '--preview-header-glow-rgba-2': `rgba(${effectiveRgbPreviewHeaderGlow2.r}, ${effectiveRgbPreviewHeaderGlow2.g}, ${effectiveRgbPreviewHeaderGlow2.b}, ${Math.min(1, 0.9 * headerButtonsOpacity)})`,
                      '--preview-header-default-bg-color': `rgba(${rgbHeaderDefaultBg.r}, ${rgbHeaderDefaultBg.g}, ${rgbHeaderDefaultBg.b}, ${headerButtonsDefaultBgOpacity})`,
                      '--preview-header-default-border-color': `rgba(${rgbHeaderDefaultBg.r}, ${rgbHeaderDefaultBg.g}, ${rgbHeaderDefaultBg.b}, ${Math.min(1, headerButtonsDefaultBgOpacity * 3)})`
                    } as React.CSSProperties}
                  >
                    <button style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.8)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}>
                      Edição em Massa
                    </button>
                    <div style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}>
                      <span>Categorias</span>
                      <span style={{ fontSize: '8px' }}>▼</span>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}>
                      <span>Filtros</span>
                      <span style={{ fontSize: '8px' }}>▼</span>
                    </div>
                  </div>
                </div>

                {/* LINHA 2: Barra de Lojas / Plataformas */}
                <div 
                  className={`preview-platforms-bar ${storeFilterGlowMode === 'neon' ? 'preview-platforms-bar--neon' : ''} ${storeBtnGradientEnabled ? 'preview-platforms-bar--gradient' : ''} preview-platforms-bar--target-${storeFilterGlowTarget} ${rightPanelMode === 'storeButtons' ? 'preview-platforms-bar--selected' : ''} ${storeBtnDefaultBgOpacity === 0 ? 'preview-platforms-bar--zero-bg' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRightPanelMode('storeButtons');
                  }}
                  style={{
                    cursor: 'pointer',
                    '--store-btn-border-radius': `${storeBtnBorderRadius}px`,
                    '--store-btn-border-width': storeBtnBorderEnabled ? '1px' : '0px',
                    '--preview-store-color-1': storeBtnBgColor,
                    '--preview-store-color-2': storeBtnBgColor2,
                    '--preview-store-glow-color-1': effectivePreviewStoreGlow1,
                    '--preview-store-glow-color-2': effectivePreviewStoreGlow2,
                    '--preview-store-opacity': storeBtnOpacity,
                    '--preview-store-glow-strength': `${storeBtnGlowStrength}px`,
                    '--preview-store-glow-rgba-1': `rgba(${effectiveRgbPreviewStoreGlow1.r}, ${effectiveRgbPreviewStoreGlow1.g}, ${effectiveRgbPreviewStoreGlow1.b}, ${Math.min(1, 0.5 * storeBtnOpacity)})`,
                    '--preview-store-glow-rgba-2': `rgba(${effectiveRgbPreviewStoreGlow2.r}, ${effectiveRgbPreviewStoreGlow2.g}, ${effectiveRgbPreviewStoreGlow2.b}, ${Math.min(1, 0.5 * storeBtnOpacity)})`,
                    '--preview-store-default-bg-color': storeBtnDefaultBgOpacity === 0
                      ? 'transparent'
                      : storeBtnDefaultBgGradientEnabled
                        ? `linear-gradient(135deg, rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity}) 0%, rgba(${rgbStoreDefaultBg2.r}, ${rgbStoreDefaultBg2.g}, ${rgbStoreDefaultBg2.b}, ${storeBtnDefaultBgOpacity}) 100%)`
                        : `rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity})`,
                    '--preview-store-default-border-color': storeBtnDefaultBgOpacity === 0
                      ? 'transparent'
                      : `rgba(${rgbStoreDefaultBgGlow.r}, ${rgbStoreDefaultBgGlow.g}, ${rgbStoreDefaultBgGlow.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 2.5 + 0.05)})`,
                    '--preview-store-default-bg-hover': storeBtnDefaultBgOpacity === 0
                      ? 'transparent'
                      : storeBtnDefaultBgGradientEnabled
                        ? `linear-gradient(135deg, rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 1.5 + 0.04)}) 0%, rgba(${rgbStoreDefaultBg2.r}, ${rgbStoreDefaultBg2.g}, ${rgbStoreDefaultBg2.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 1.5 + 0.04)}) 100%)`
                        : `rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 1.5 + 0.04)})`,
                    '--preview-store-default-bg-active': storeBtnDefaultBgOpacity === 0
                      ? 'transparent'
                      : storeBtnDefaultBgGradientEnabled
                        ? `linear-gradient(135deg, rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 1.8 + 0.08)}) 0%, rgba(${rgbStoreDefaultBg2.r}, ${rgbStoreDefaultBg2.g}, ${rgbStoreDefaultBg2.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 1.8 + 0.08)}) 100%)`
                        : `rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 1.8 + 0.08)})`,
                    '--preview-store-default-border-hover': storeBtnDefaultBgOpacity === 0
                      ? 'transparent'
                      : `rgba(${rgbStoreDefaultBgGlow.r}, ${rgbStoreDefaultBgGlow.g}, ${rgbStoreDefaultBgGlow.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 2.8 + 0.08)})`,
                    '--preview-store-default-border-active': storeBtnDefaultBgOpacity === 0
                      ? 'transparent'
                      : `rgba(${rgbStoreDefaultBgGlow.r}, ${rgbStoreDefaultBgGlow.g}, ${rgbStoreDefaultBgGlow.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 3 + 0.12)})`,
                    '--store-btn-bg': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-hover-bg': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-border-color': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-hover-border-color': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-active-bg-start': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-active-bg-end': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-active-border-start': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-active-border-end': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-shadow-color': storeBtnDefaultBgOpacity === 0 ? 'transparent' : undefined,
                    '--store-btn-backdrop-filter': storeBtnDefaultBgOpacity === 0 ? 'none' : undefined,
                    '--preview-store-bg-r': rgbStoreDefaultBg1.r,
                    '--preview-store-bg-g': rgbStoreDefaultBg1.g,
                    '--preview-store-bg-b': rgbStoreDefaultBg1.b,
                    '--preview-store-bg-opacity': storeBtnDefaultBgOpacity
                  } as React.CSSProperties}
                >
                  {stores
                    .filter((s) => s.isVisible ?? true)
                    .map((store, index) => {
                      const imageSource = store.icon
                        ? store.icon
                        : `/images/${store.id}.png`
                      const isActive = activePreviewStoreId === store.id || (!activePreviewStoreId && index === 0)
                      return (
                        <div 
                          key={store.id} 
                          className={`preview-platform-btn ${isActive ? 'preview-platform-btn--active' : ''} ${storeBtnDefaultBgOpacity === 0 ? 'preview-platform-btn--zero-bg' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePreviewStoreId(store.id);
                            setRightPanelMode('storeButtons');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {store.icon || ['epic', 'gog', 'amazon', 'zoom', 'sideloaded', 'steam'].includes(store.id) ? (
                            <img src={imageSource} className="preview-platform-icon-img" alt="" onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }} />
                          ) : (
                            <div className="preview-platform-icon-placeholder" style={{ background: store.id.includes('store') ? '#ab47bc' : '#4CAF50' }}>
                              {store.name.charAt(0)}
                            </div>
                          )}
                          <span>{store.name || 'Nova Loja'}</span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* 2. SUB HEADER (Title and Alphabet Filter) */}
              <div
                className="preview-header-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  width: '100%',
                  paddingBottom: '10px',
                  gap: '20px',
                  flexDirection: 'row',
                  marginBottom: '16px'
                }}
              >
                {/* 1. TÍTULO E TOTAL DE JOGOS (Esquerda) */}
                <div 
                  style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => setRightPanelMode('alphabet')}
                  title="Personalizar Filtro Alfabético & Total de Jogos"
                  className={`preview-games-total-group ${rightPanelMode === 'alphabet' ? 'preview-games-total-group--selected' : ''}`}
                >
                  <h5 className="preview-title" style={{ margin: 0, padding: 0 }}>
                    Todos os Jogos
                    <span 
                      className={`numberOfgames ${alphabetGlowMode === 'neon' ? 'numberOfgames--neon' : ''} ${alphabetDefaultBgOpacity === 0 ? 'numberOfgames--zero-bg' : ''}`}
                      style={{
                        margin: 0,
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '36px',
                        height: '36px',
                        padding: '0 8px',
                        boxSizing: 'border-box',
                        borderRadius: `${alphabetBtnBorderRadius}px`,
                        background: alphabetDefaultBgOpacity === 0 ? 'transparent' : (
                          alphabetDefaultBgGradientEnabled
                            ? `linear-gradient(135deg, ${alphabetDefaultBgColor} 0%, ${alphabetDefaultBgColor2} 100%)`
                            : alphabetDefaultBgColor
                        ),
                        border: alphabetDefaultBgOpacity === 0 ? 'none' : (
                          alphabetBtnBorderEnabled
                            ? `1px solid ${alphabetDefaultBgColor}`
                            : 'none'
                        ),
                        ...(alphabetGlowMode === 'neon' ? (
                          alphabetBtnGradientEnabled ? {
                            background: `linear-gradient(135deg, ${alphabetBtnBgColor} 0%, ${alphabetBtnBgColor2} 100%)`,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: `drop-shadow(-1.5px -1.5px calc(${alphabetGlowStrength}px * 0.35) ${effectiveAlphabetGlowRgba1}) drop-shadow(1.5px 1.5px calc(${alphabetGlowStrength}px * 0.35) ${effectiveAlphabetGlowRgba2})`,
                            display: 'inline-block'
                          } : {
                            color: alphabetBtnBgColor,
                            textShadow: `0 0 2px ${effectivePreviewAlphabetGlow1}, 0 0 ${alphabetGlowStrength}px ${effectiveAlphabetGlowRgba1}`
                          }
                        ) : {
                          color: '#ffffff'
                        }),
                        backdropFilter: alphabetDefaultBgOpacity === 0 ? 'none' : 'blur(12px)',
                        WebkitBackdropFilter: alphabetDefaultBgOpacity === 0 ? 'none' : 'blur(12px)',
                        fontFamily: 'inherit',
                        fontSize: '15px',
                        fontWeight: 600,
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      {totalRealGamesCount}
                    </span>
                  </h5>
                </div>

                {/* 2. ALFABETO (Esticado no resto do espaço) */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: alphabetAlignment === 'left' ? 'flex-start' : alphabetAlignment === 'right' ? 'flex-end' : alphabetAlignment === 'fill' ? 'stretch' : 'center',
                    paddingLeft: alphabetAlignment === 'left' ? '0px' : '10px',
                    paddingRight: '0px',
                    marginLeft: alphabetAlignment === 'left' ? '-10px' : '0px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    className={`preview-alphabet-container ${alphabetGlowMode === 'neon' ? 'preview-alphabet--neon' : ''} ${alphabetBtnGradientEnabled ? 'preview-alphabet--gradient' : ''} ${rightPanelMode === 'alphabet' ? 'preview-alphabet-container--selected' : ''} ${alphabetDefaultBgOpacity === 0 ? 'preview-alphabet-container--zero-bg' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRightPanelMode('alphabet');
                    }}
                    style={{
                      cursor: 'pointer',
                      '--preview-alphabet-color-1': alphabetBtnBgColor,
                      '--preview-alphabet-color-2': alphabetBtnBgColor2,
                      '--preview-alphabet-glow-color-1': effectivePreviewAlphabetGlow1,
                      '--preview-alphabet-glow-color-2': effectivePreviewAlphabetGlow2,
                      '--preview-alphabet-opacity': alphabetOpacity,
                      '--preview-alphabet-glow-strength': `${alphabetGlowStrength}px`,
                      '--preview-alphabet-glow-rgba-1': effectiveAlphabetGlowRgba1,
                      '--preview-alphabet-glow-rgba-2': effectiveAlphabetGlowRgba2,
                      '--preview-alphabet-default-bg-color': alphabetDefaultBgOpacity === 0
                        ? 'transparent'
                        : alphabetDefaultBgGradientEnabled
                          ? `linear-gradient(135deg, rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${alphabetDefaultBgOpacity}) 0%, rgba(${rgbAlphabetDefault2.r}, ${rgbAlphabetDefault2.g}, ${rgbAlphabetDefault2.b}, ${alphabetDefaultBgOpacity}) 100%)`
                          : `rgba(${rgbAlphabetDefault1.r}, ${rgbAlphabetDefault1.g}, ${rgbAlphabetDefault1.b}, ${alphabetDefaultBgOpacity})`,
                      '--preview-alphabet-default-border-color': alphabetDefaultBgOpacity === 0
                        ? 'transparent'
                        : `rgba(${rgbAlphabetDefaultBgGlow.r}, ${rgbAlphabetDefaultBgGlow.g}, ${rgbAlphabetDefaultBgGlow.b}, ${Math.min(1, alphabetDefaultBgOpacity * 2.5 + 0.05)})`,
                      '--preview-alphabet-border-radius': `${alphabetBtnBorderRadius}px`,
                      width: alphabetAlignment === 'fill' ? '100%' : 'auto',
                      justifyContent: alphabetAlignment === 'fill' ? 'space-between' : 'center'
                    } as React.CSSProperties}
                  >
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((char) => {
                      const isActive = char === activePreviewLetter
                      let btnClass = 'preview-alphabet-btn'
                      if (isActive) btnClass += ' preview-alphabet-btn--active'
                      if (alphabetDefaultBgOpacity === 0) btnClass += ' preview-alphabet-btn--zero-bg'
                      return (
                        <div 
                          key={char} 
                          className={btnClass}
                          onClick={() => setActivePreviewLetter(char)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span style={{ position: 'relative', zIndex: 2 }}>{char}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 3. GAMES GRID */}
              <div className="preview-games-grid">
                {previewGames.map((game) => (
                  <div key={game.id} className="preview-game-card">
                    {/* Game Cover Art Image or Gradient */}
                    <div
                      className="preview-game-banner"
                      style={{
                        background: game.bannerUrl ? 'none' : game.fallbackGradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      {game.bannerUrl ? (
                        <img
                          src={game.bannerUrl}
                          alt={game.title}
                          className="preview-game-banner-img"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <span className="preview-game-banner-logo">{game.title}</span>
                      )}
                    </div>

                    {/* Platforms/Gamepad Overlay Badges reflecting Right Sidebar checked toggles */}
                    <div className="preview-game-badge-container">
                      {!hideIconsGamepad && (
                        <div className="preview-game-badge-item" style={{ color: '#00ffff' }}>
                          🎮
                        </div>
                      )}
                      {!hideIconsMouse && (
                        <div className="preview-game-badge-item" style={{ color: '#4CAF50' }}>
                          🖱️
                        </div>
                      )}
                    </div>

                    <div className="preview-game-overlay">
                      <span className="preview-game-title">{game.title}</span>
                      <span className="preview-game-store">{game.store}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* 3. SIDEBAR DIREITA (CONFIGS E BACKGROUND) */}
        {/* ========================================= */}
        <div style={styles.sidebarRight}>
          {rightPanelMode === 'default' ? (
            <>
              {/* SEÇÃO 1: BACKGROUND */}
              <span style={styles.sectionTitle}>PERSONALIZAÇÃO DO BACKGROUND</span>
              <div
                style={styles.dropZone}
                onDragOver={handleDragOverBg}
                onDragLeave={handleDragLeaveBg}
                onDrop={handleDropBg}
              >
                <span style={styles.dropZoneText}>
                  Arraste e solte o Background
                </span>
                <span style={{ fontSize: '14px', color: '#8a9bb0' }}>ou</span>

                <label style={styles.searchFileBtn}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgUpload}
                    style={{ display: 'none' }}
                  />
                  Pesquisar Arquivo
                </label>

                <p style={styles.recommendationText}>
                  Nós recomendamos usar uma imagem com a resolução de 1860x950 para
                  um melhor preenchimento.
                </p>
              </div>

              {/* SEÇÃO 2: COMPORTAMENTO DA INTERFACE */}
              <div style={{ marginTop: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '15px 0 0 0',
                    overflow: 'hidden'
                  }}
                >
                  {/* Cabeçalho Unificado */}
                  <div style={{ ...styles.toggleTextGroup, padding: '0 15px 15px 15px' }}>
                    <span style={styles.toggleTitle}>
                      Comportamento da Grade de Jogos
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize a exibição de ícones e busca na biblioteca
                    </span>
                  </div>

                  {/* Divisor */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)' }} />
                  {/* Opção Gamepad */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 15px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <div style={styles.toggleTextGroup}>
                      <span style={styles.toggleTitle}>
                        Ocultar ícones no Gamepad
                      </span>
                      <span style={styles.toggleSub}>
                        Deixa a interface limpa usando controle
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideIconsGamepad}
                      onChange={handleToggleGamepadIcons}
                      style={styles.checkbox}
                    />
                  </label>

                  {/* Divisor */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '0 15px' }} />

                  {/* Opção Mouse */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 15px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <div style={styles.toggleTextGroup}>
                      <span style={styles.toggleTitle}>
                        Ocultar ícones no Mouse
                      </span>
                      <span style={styles.toggleSub}>
                        Deixa a interface limpa usando o mouse
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideIconsMouse}
                      onChange={handleToggleMouseIcons}
                      style={styles.checkbox}
                    />
                  </label>

                  {/* Divisor */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '0 15px' }} />

                  {/* Opção Sugestões de Busca */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 15px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <div style={styles.toggleTextGroup}>
                      <span style={styles.toggleTitle}>
                        Ocultar sugestões na busca
                      </span>
                      <span style={styles.toggleSub}>
                        Deixa a barra de busca limpa ao pesquisar por jogos
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideSearchSuggestions}
                      onChange={handleToggleSearchSuggestions}
                      style={styles.checkbox}
                    />
                  </label>
                </div>
              </div>

              {/* Escalonamento da Interface (UI Scale) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  marginTop: '20px'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={styles.toggleTitle}>
                      Escalonamento da Interface (UI Scale)
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#50e3c2', background: 'rgba(80, 227, 194, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                      {zoomPercent || 100}%
                    </span>
                  </div>
                  <span style={styles.toggleSub}>
                    Ajuste a escala dos elementos para monitores menores e evite a rolagem lateral
                  </span>
                </div>

                {/* Botões Rápidos de Escala */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[75, 85, 90, 100, 110, 125].map((scaleVal) => {
                    const isSelected = (zoomPercent || 100) === scaleVal
                    return (
                      <button
                        key={scaleVal}
                        onClick={() => setZoomPercent(scaleVal)}
                        style={{
                          flex: 1,
                          minWidth: '42px',
                          height: '30px',
                          background: isSelected ? '#50e3c2' : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#12161a' : '#fff',
                          border: isSelected ? '1px solid #50e3c2' : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {scaleVal}%
                      </button>
                    )
                  })}
                </div>

                {/* Range Slider de Escala */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>70%</span>
                  <input
                    type="range"
                    min={70}
                    max={130}
                    step={5}
                    value={zoomPercent || 100}
                    onChange={(e) => setZoomPercent(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: '#50e3c2', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>130%</span>
                </div>
              </div>

              {/* Configurações do Filtro de Alfabeto Unificado */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  marginTop: '20px'
                }}
              >
                {/* Cabeçalho Unificado */}
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Filtro de Alfabeto (A-Z)
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o alinhamento e opacidade do painel de letras
                  </span>
                </div>

                {/* Sub-seção 1: Alinhamento */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Alinhamento do Filtro
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '6px',
                      padding: '3px',
                      gap: '4px'
                    }}
                  >
                    {(
                      [
                        { id: 'left', label: 'Esquerda' },
                        { id: 'center', label: 'Centro' },
                        { id: 'right', label: 'Direita' },
                        { id: 'fill', label: 'Preencher' }
                      ] as const
                    ).map((opt) => {
                      const isSelected = alphabetAlignment === opt.id
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleToggleAlphabetAlignment(opt.id)}
                          style={{
                            flex: 1,
                            height: '28px',
                            background: isSelected ? '#4CAF50' : 'transparent',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Divisor Sutil */}
                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                {/* Sub-seção 2: Transparência */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Slider 1: Fundo do Painel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff', fontSize: '12px' }}>Opacidade do Fundo do Painel</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(alphabetBgOpacity * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={alphabetBgOpacity}
                        onChange={(e) => handleAlphabetBgOpacityChange(Number(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#4CAF50',
                          background: 'rgba(255, 255, 255, 0.1)',
                          height: '6px',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Botão de Atalho para Customização dos Botões */}
                <button
                  onClick={() => setRightPanelMode('alphabet')}
                  style={{
                    background: '#00e5ff',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    marginTop: '8px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#00b3cc'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#00e5ff'
                  }}
                >
                  ⚙️ Personalizar Botões do Alfabeto
                </button>
              </div>

              {/* SEÇÃO 3: ATALHOS PARA CUSTOMIZAÇÃO VISUAL UNIFICADA */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '20px'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Personalização de Elementos da Interface
                </span>

                {/* 1. Atalho Barra de Lojas */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={styles.toggleTextGroup}>
                    <span style={styles.toggleTitle}>
                      🏪 Barra de Filtro de Lojas
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize estilo padrão vs neon suave, cores, degradê e bordas dos botões de lojas
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelMode('storeButtons')}
                    style={{
                      background: '#00e5ff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#00b3cc'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#00e5ff'
                    }}
                  >
                    🏪 Personalizar Filtro de Lojas
                  </button>
                </div>

                {/* 2. Atalho Filtro Alfabético & Contador */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={styles.toggleTextGroup}>
                    <span style={styles.toggleTitle}>
                      🔤 Filtro Alfabético & Total de Jogos (Contador)
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize estilo padrão vs neon suave, cores, degradê e background das letras A-Z e do contador de total de jogos
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelMode('alphabet')}
                    style={{
                      background: '#00e5ff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#00b3cc'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#00e5ff'
                    }}
                  >
                    🔤 Personalizar Letras A-Z e Total de Jogos
                  </button>
                </div>

                {/* 3. Atalho Busca & Botão Adicionar Jogo */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={styles.toggleTextGroup}>
                    <span style={styles.toggleTitle}>
                      🔍 Barra de Busca & Adicionar Jogos
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize estilo padrão vs neon suave, cores e degradê da barra de busca e botão de adicionar
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelMode('headerSearch')}
                    style={{
                      background: '#00e5ff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#00b3cc'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#00e5ff'
                    }}
                  >
                    🔍 Personalizar Busca & Adicionar
                  </button>
                </div>

                {/* 4. Atalho Barra Lateral Esquerda */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={styles.toggleTextGroup}>
                    <span style={styles.toggleTitle}>
                      📑 Barra Lateral (Navegação & Ferramentas)
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize estilo padrão vs neon suave, cores, degradê e brilho dos ícones da barra lateral
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelMode('sidebar')}
                    style={{
                      background: '#00e5ff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#00b3cc'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#00e5ff'
                    }}
                  >
                    📑 Personalizar Barra Lateral
                  </button>
                </div>

                {/* 5. Atalho Ícones de Ação */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={styles.toggleTextGroup}>
                    <span style={styles.toggleTitle}>
                      🎛️ Ícones de Ação (Grade, Ordenação, etc.)
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize as cores, degradê, transparência e força do brilho dos ícones do topo
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelMode('headerControls')}
                    style={{
                      background: '#00e5ff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#00b3cc'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#00e5ff'
                    }}
                  >
                    🎛️ Personalizar Ícones de Ação
                  </button>
                </div>

                {/* 6. Atalho Botões de Ação */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={styles.toggleTextGroup}>
                    <span style={styles.toggleTitle}>
                      🏷️ Botões de Ação (Edição, Categorias, Filtros)
                    </span>
                    <span style={styles.toggleSub}>
                      Personalize o estilo neon, degradê vetorial e fundo dos botões do cabeçalho
                    </span>
                  </div>
                  <button
                    onClick={() => setRightPanelMode('headerButtons')}
                    style={{
                      background: '#00e5ff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#00b3cc'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#00e5ff'
                    }}
                  >
                    🏷️ Personalizar Botões de Ação
                  </button>
                </div>
              </div>
            </>
          ) : rightPanelMode === 'storeButtons' ? (
            <>
              {/* PAINEL 1: BARRA DE FILTRO DE LOJAS */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>BARRA DE FILTRO DE LOJAS</span>
                <button
                  onClick={() => setRightPanelMode('default')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  ← Voltar
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Estilo dos Botões de Lojas
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o estilo padrão vs neon suave, cores, degradê e brilho dos botões de lojas
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleStoreFilterGlowModeChange('disabled')}
                      style={{
                        background: storeFilterGlowMode === 'disabled' ? '#00e5ff' : 'transparent',
                        color: storeFilterGlowMode === 'disabled' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: storeFilterGlowMode === 'disabled' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚪ Padrão (Manter como está)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStoreFilterGlowModeChange('neon')}
                      style={{
                        background: storeFilterGlowMode === 'neon' ? '#00e5ff' : 'transparent',
                        color: storeFilterGlowMode === 'neon' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: storeFilterGlowMode === 'neon' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Novo Estilo Neon Suave
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {storeFilterGlowMode === 'disabled'
                      ? 'Mantém o estilo padrão dos botões de lojas com cápsula translúcida customizável.'
                      : 'Aplica iluminação neon suave e contorno brilhante nos botões de lojas.'}
                  </span>

                  {/* Configurações Modo Neon */}
                  {storeFilterGlowMode === 'neon' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      {/* Seletor de Alvo do Efeito Neon (Só no Logo / Só no Nome / Em Ambos) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Alvo do Efeito Neon
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Escolha onde o efeito visual será aplicado ao passar o mouse ou selecionar uma loja:
                        </span>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                          {/* Card 1: Só no Logo */}
                          <div
                            onClick={() => handleStoreFilterGlowTargetChange('logo')}
                            className={`target-effect-card ${storeFilterGlowTarget === 'logo' ? 'target-effect-card--selected' : ''}`}
                            style={{
                              cursor: 'pointer',
                              background: storeFilterGlowTarget === 'logo' ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                              border: storeFilterGlowTarget === 'logo' ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '10px 6px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.25s ease',
                              boxShadow: storeFilterGlowTarget === 'logo' ? '0 0 12px rgba(0, 229, 255, 0.25)' : 'none',
                              position: 'relative'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '5px 8px',
                                borderRadius: `${Math.min(storeBtnBorderRadius, 8)}px`,
                                background: storeBtnDefaultBgOpacity === 0
                                  ? 'transparent'
                                  : storeBtnDefaultBgGradientEnabled
                                    ? `linear-gradient(135deg, rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity}) 0%, rgba(${rgbStoreDefaultBg2.r}, ${rgbStoreDefaultBg2.g}, ${rgbStoreDefaultBg2.b}, ${storeBtnDefaultBgOpacity}) 100%)`
                                    : `rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity})`,
                                border: storeBtnDefaultBgOpacity === 0
                                  ? '1px solid transparent'
                                  : `1px solid rgba(${rgbStoreDefaultBgGlow.r}, ${rgbStoreDefaultBgGlow.g}, ${rgbStoreDefaultBgGlow.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 2.5 + 0.05)})`,
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                            >
                              {targetExampleStore?.icon ? (
                                <img
                                  src={targetExampleStore.icon}
                                  alt=""
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    objectFit: 'contain',
                                    filter: storeBtnGradientEnabled
                                      ? `drop-shadow(-1.5px -1.5px 0.5px ${storeBtnBgColor}) drop-shadow(1.5px 1.5px 0.5px ${storeBtnBgColor2}) drop-shadow(-3px -3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba1}) drop-shadow(3px 3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba2})`
                                      : `drop-shadow(0 0 1px ${storeBtnBgColor}) drop-shadow(0 0 calc(${storeBtnGlowStrength}px * 0.5) ${effectivePreviewStoreGlow1}) drop-shadow(0 0 ${storeBtnGlowStrength}px ${effectiveStoreGlowRgba1})`,
                                    transform: 'scale(1.1)',
                                    transition: 'all 0.2s ease'
                                  }}
                                />
                              ) : (
                                <SteamLogo
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    fill: '#ffffff',
                                    filter: storeBtnGradientEnabled
                                      ? `drop-shadow(-1.5px -1.5px 0.5px ${storeBtnBgColor}) drop-shadow(1.5px 1.5px 0.5px ${storeBtnBgColor2}) drop-shadow(-3px -3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba1}) drop-shadow(3px 3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba2})`
                                      : `drop-shadow(0 0 1px ${storeBtnBgColor}) drop-shadow(0 0 calc(${storeBtnGlowStrength}px * 0.5) ${effectivePreviewStoreGlow1}) drop-shadow(0 0 ${storeBtnGlowStrength}px ${effectiveStoreGlowRgba1})`,
                                    transform: 'scale(1.1)',
                                    transition: 'all 0.2s ease'
                                  }}
                                />
                              )}
                              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 500 }}>
                                {targetExampleStore?.name || 'Steam'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: storeFilterGlowTarget === 'logo' ? 'bold' : 'normal',
                                color: storeFilterGlowTarget === 'logo' ? '#00e5ff' : '#ddd'
                              }}>
                                Só no Logo
                              </span>
                              {storeFilterGlowTarget === 'logo' && (
                                <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                          </div>

                          {/* Card 2: Só no Nome */}
                          <div
                            onClick={() => handleStoreFilterGlowTargetChange('text')}
                            className={`target-effect-card ${storeFilterGlowTarget === 'text' ? 'target-effect-card--selected' : ''}`}
                            style={{
                              cursor: 'pointer',
                              background: storeFilterGlowTarget === 'text' ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                              border: storeFilterGlowTarget === 'text' ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '10px 6px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.25s ease',
                              boxShadow: storeFilterGlowTarget === 'text' ? '0 0 12px rgba(0, 229, 255, 0.25)' : 'none',
                              position: 'relative'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '5px 8px',
                                borderRadius: `${Math.min(storeBtnBorderRadius, 8)}px`,
                                background: storeBtnDefaultBgOpacity === 0
                                  ? 'transparent'
                                  : storeBtnDefaultBgGradientEnabled
                                    ? `linear-gradient(135deg, rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity}) 0%, rgba(${rgbStoreDefaultBg2.r}, ${rgbStoreDefaultBg2.g}, ${rgbStoreDefaultBg2.b}, ${storeBtnDefaultBgOpacity}) 100%)`
                                    : `rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity})`,
                                border: storeBtnDefaultBgOpacity === 0
                                  ? '1px solid transparent'
                                  : `1px solid rgba(${rgbStoreDefaultBgGlow.r}, ${rgbStoreDefaultBgGlow.g}, ${rgbStoreDefaultBgGlow.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 2.5 + 0.05)})`,
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                            >
                              {targetExampleStore?.icon ? (
                                <img
                                  src={targetExampleStore.icon}
                                  alt=""
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    objectFit: 'contain'
                                  }}
                                />
                              ) : (
                                <SteamLogo
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    fill: '#ffffff'
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  ...(storeBtnGradientEnabled
                                    ? {
                                        background: `linear-gradient(135deg, ${storeBtnBgColor} 0%, ${storeBtnBgColor2} 100%)`,
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        filter: `drop-shadow(-1.5px -1.5px calc(${storeBtnGlowStrength}px * 0.35) ${effectiveStoreGlowRgba1}) drop-shadow(1.5px 1.5px calc(${storeBtnGlowStrength}px * 0.35) ${effectiveStoreGlowRgba2})`
                                      }
                                    : {
                                        color: storeBtnBgColor,
                                        textShadow: `0 0 1px ${effectivePreviewStoreGlow1}, 0 0 4px ${effectiveStoreGlowRgba1}`
                                      })
                                }}
                              >
                                {targetExampleStore?.name || 'Steam'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: storeFilterGlowTarget === 'text' ? 'bold' : 'normal',
                                color: storeFilterGlowTarget === 'text' ? '#00e5ff' : '#ddd'
                              }}>
                                Só no Nome
                              </span>
                              {storeFilterGlowTarget === 'text' && (
                                <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                          </div>

                          {/* Card 3: Em Ambos */}
                          <div
                            onClick={() => handleStoreFilterGlowTargetChange('both')}
                            className={`target-effect-card ${storeFilterGlowTarget === 'both' ? 'target-effect-card--selected' : ''}`}
                            style={{
                              cursor: 'pointer',
                              background: storeFilterGlowTarget === 'both' ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                              border: storeFilterGlowTarget === 'both' ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '10px 6px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.25s ease',
                              boxShadow: storeFilterGlowTarget === 'both' ? '0 0 12px rgba(0, 229, 255, 0.25)' : 'none',
                              position: 'relative'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '5px 8px',
                                borderRadius: `${Math.min(storeBtnBorderRadius, 8)}px`,
                                background: storeBtnDefaultBgOpacity === 0
                                  ? 'transparent'
                                  : storeBtnDefaultBgGradientEnabled
                                    ? `linear-gradient(135deg, rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity}) 0%, rgba(${rgbStoreDefaultBg2.r}, ${rgbStoreDefaultBg2.g}, ${rgbStoreDefaultBg2.b}, ${storeBtnDefaultBgOpacity}) 100%)`
                                    : `rgba(${rgbStoreDefaultBg1.r}, ${rgbStoreDefaultBg1.g}, ${rgbStoreDefaultBg1.b}, ${storeBtnDefaultBgOpacity})`,
                                border: storeBtnDefaultBgOpacity === 0
                                  ? '1px solid transparent'
                                  : `1px solid rgba(${rgbStoreDefaultBgGlow.r}, ${rgbStoreDefaultBgGlow.g}, ${rgbStoreDefaultBgGlow.b}, ${Math.min(1, storeBtnDefaultBgOpacity * 2.5 + 0.05)})`,
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                            >
                              {targetExampleStore?.icon ? (
                                <img
                                  src={targetExampleStore.icon}
                                  alt=""
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    objectFit: 'contain',
                                    filter: storeBtnGradientEnabled
                                      ? `drop-shadow(-1.5px -1.5px 0.5px ${storeBtnBgColor}) drop-shadow(1.5px 1.5px 0.5px ${storeBtnBgColor2}) drop-shadow(-3px -3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba1}) drop-shadow(3px 3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba2})`
                                      : `drop-shadow(0 0 1px ${storeBtnBgColor}) drop-shadow(0 0 calc(${storeBtnGlowStrength}px * 0.5) ${effectivePreviewStoreGlow1}) drop-shadow(0 0 ${storeBtnGlowStrength}px ${effectiveStoreGlowRgba1})`,
                                    transform: 'scale(1.1)',
                                    transition: 'all 0.2s ease'
                                  }}
                                />
                              ) : (
                                <SteamLogo
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    fill: '#ffffff',
                                    filter: storeBtnGradientEnabled
                                      ? `drop-shadow(-1.5px -1.5px 0.5px ${storeBtnBgColor}) drop-shadow(1.5px 1.5px 0.5px ${storeBtnBgColor2}) drop-shadow(-3px -3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba1}) drop-shadow(3px 3px calc(${storeBtnGlowStrength}px * 0.7) ${effectiveStoreGlowRgba2})`
                                      : `drop-shadow(0 0 1px ${storeBtnBgColor}) drop-shadow(0 0 calc(${storeBtnGlowStrength}px * 0.5) ${effectivePreviewStoreGlow1}) drop-shadow(0 0 ${storeBtnGlowStrength}px ${effectiveStoreGlowRgba1})`,
                                    transform: 'scale(1.1)',
                                    transition: 'all 0.2s ease'
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  ...(storeBtnGradientEnabled
                                    ? {
                                        background: `linear-gradient(135deg, ${storeBtnBgColor} 0%, ${storeBtnBgColor2} 100%)`,
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        filter: `drop-shadow(-1.5px -1.5px calc(${storeBtnGlowStrength}px * 0.35) ${effectiveStoreGlowRgba1}) drop-shadow(1.5px 1.5px calc(${storeBtnGlowStrength}px * 0.35) ${effectiveStoreGlowRgba2})`
                                      }
                                    : {
                                        color: storeBtnBgColor,
                                        textShadow: `0 0 1px ${effectivePreviewStoreGlow1}, 0 0 4px ${effectiveStoreGlowRgba1}`
                                      })
                                }}
                              >
                                {targetExampleStore?.name || 'Steam'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: storeFilterGlowTarget === 'both' ? 'bold' : 'normal',
                                color: storeFilterGlowTarget === 'both' ? '#00e5ff' : '#ddd'
                              }}>
                                Em Ambos
                              </span>
                              {storeFilterGlowTarget === 'both' && (
                                <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {storeBtnGradientEnabled ? 'Cor do Efeito (Degradê)' : 'Cor do Efeito Neon'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                          <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={storeBtnGradientEnabled}
                              onChange={(e) => handleStoreGradientToggle(e.target.checked)}
                            />
                            <span className="premium-slider"></span>
                          </label>
                        </label>
                      </div>

                      {storeBtnGradientEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              background: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: '6px',
                              padding: '3px',
                              gap: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveStoreColorTab('color1')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeStoreColorTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeStoreColorTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeBtnBgColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Inicial
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveStoreColorTab('color2')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeStoreColorTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeStoreColorTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeBtnBgColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Final
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveStoreColorTab('glow')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeStoreColorTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeStoreColorTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: storeBtnSyncGlowWithGradient
                                    ? (storeBtnGradientEnabled ? `linear-gradient(135deg, ${storeBtnBgColor}, ${storeBtnBgColor2})` : storeBtnBgColor)
                                    : storeBtnGlowColor,
                                  border: '1px solid rgba(255,255,255,0.3)'
                                }}
                              />
                              Cor Glow
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                            <button
                              type="button"
                              onClick={() => handleStoreSyncGlowToggle(!storeBtnSyncGlowWithGradient)}
                              style={{
                                background: storeBtnSyncGlowWithGradient ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                color: storeBtnSyncGlowWithGradient ? '#00e5ff' : '#fff',
                                border: storeBtnSyncGlowWithGradient ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: storeBtnSyncGlowWithGradient ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {storeBtnSyncGlowWithGradient ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                            </button>
                          </div>
                        </div>
                      )}

                      <SVBox hexColor={currentEditingStoreColor} onChange={currentEditingStoreHandler} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={currentEditingStoreHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(currentEditingStoreColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              currentEditingStoreHandler(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': currentEditingStoreColor,
                              '--thumb-border-color': currentEditingStoreColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={currentEditingStoreColor.replace('#', '')}
                            onChange={(e) => currentEditingStoreHandler('#' + e.target.value)}
                            placeholder="00ffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              background: (activeStoreColorTab === 'glow' && storeBtnSyncGlowWithGradient && storeBtnGradientEnabled)
                                ? `linear-gradient(135deg, ${storeBtnBgColor}, ${storeBtnBgColor2})`
                                : currentEditingStoreColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>


                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Força do Efeito Neon (Glow)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{storeBtnGlowStrength}px</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={storeBtnGlowStrength}
                            onChange={(e) => handleStoreGlowStrengthChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Divisor antes do Background */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

                  {/* 3. BACKGROUND INDIVIDUAL DA LOJA */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Background Individual da Loja
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Cor e transparência do fundo de cada cápsula de loja
                        </span>
                      </div>

                      {/* Botão para trocar a cor do background */}
                      <button
                        type="button"
                        onClick={() => setShowStoreBgColorPicker(!showStoreBgColorPicker)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: showStoreBgColorPicker ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          border: showStoreBgColorPicker ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: showStoreBgColorPicker ? '#00e5ff' : '#fff',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: showStoreBgColorPicker ? '0 0 10px rgba(0, 229, 255, 0.2)' : 'none'
                        }}
                      >
                        <div
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '3px',
                            background: storeBtnDefaultBgGradientEnabled
                              ? `linear-gradient(135deg, ${storeBtnDefaultBgColor}, ${storeBtnDefaultBgColor2})`
                              : storeBtnDefaultBgColor,
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            boxShadow: `0 0 6px ${storeBtnDefaultBgColor}55`
                          }}
                        />
                        <span>🎨 Trocar Cor do Fundo</span>
                        <span style={{ fontSize: '10px', opacity: 0.7, fontFamily: 'monospace' }}>
                          {storeBtnDefaultBgGradientEnabled ? 'Degradê' : storeBtnDefaultBgColor.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '8px', transform: showStoreBgColorPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                          ▼
                        </span>
                      </button>
                    </div>

                    {/* Módulo Réplica da Imagem para o Background ao Clicar no Botão */}
                    {showStoreBgColorPicker && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          padding: '14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        {/* Header com Toggle Degradê */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {storeBtnDefaultBgGradientEnabled ? 'COR DO BACKGROUND (DEGRADÊ)' : 'COR DO BACKGROUND'}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                            <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={storeBtnDefaultBgGradientEnabled}
                                onChange={(e) => handleStoreDefaultBgGradientToggle(e.target.checked)}
                              />
                              <span className="premium-slider"></span>
                            </label>
                          </label>
                        </div>

                        {/* Abas Degradê (Cor Inicial, Cor Final, Cor Glow) */}
                        {storeBtnDefaultBgGradientEnabled && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div
                              style={{
                                display: 'flex',
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: '6px',
                                padding: '3px',
                                gap: '4px',
                                border: '1px solid rgba(255, 255, 255, 0.05)'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setActiveStoreBgTab('color1')}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  background: activeStoreBgTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                  color: '#fff',
                                  border: activeStoreBgTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeBtnDefaultBgColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                                Cor Inicial
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveStoreBgTab('color2')}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  background: activeStoreBgTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                  color: '#fff',
                                  border: activeStoreBgTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeBtnDefaultBgColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                                Cor Final
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveStoreBgTab('glow')}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  background: activeStoreBgTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                  color: '#fff',
                                  border: activeStoreBgTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <div
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: storeBtnDefaultBgSyncGlow
                                      ? (storeBtnDefaultBgGradientEnabled ? `linear-gradient(135deg, ${storeBtnDefaultBgColor}, ${storeBtnDefaultBgColor2})` : storeBtnDefaultBgColor)
                                      : storeBtnDefaultBgGlowColor,
                                    border: '1px solid rgba(255,255,255,0.3)'
                                  }}
                                />
                                Cor Glow
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                              <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                              <button
                                type="button"
                                onClick={() => handleStoreDefaultBgSyncGlowToggle(!storeBtnDefaultBgSyncGlow)}
                                style={{
                                  background: storeBtnDefaultBgSyncGlow ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                  color: storeBtnDefaultBgSyncGlow ? '#00e5ff' : '#fff',
                                  border: storeBtnDefaultBgSyncGlow ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '4px',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  fontWeight: storeBtnDefaultBgSyncGlow ? 'bold' : 'normal',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                {storeBtnDefaultBgSyncGlow ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SVBox */}
                        <SVBox hexColor={currentEditingStoreBgColor} onChange={currentEditingStoreBgHandler} />

                        {/* Hue Slider */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={currentEditingStoreBgHsl.h}
                              onChange={(e) => {
                                const hVal = Number(e.target.value)
                                const rgbVal = hexToRgb(currentEditingStoreBgColor)
                                const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                                const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                                const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                                currentEditingStoreBgHandler(hex)
                              }}
                              className="color-picker-range hue-picker-range"
                              style={{
                                '--thumb-color': currentEditingStoreBgColor,
                                '--thumb-border-color': currentEditingStoreBgColor
                              } as React.CSSProperties}
                            />
                          </div>
                        </div>

                        {/* Hex input com thumbnail */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              gap: '10px',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                            <input
                              type="text"
                              value={currentEditingStoreBgColor.replace('#', '')}
                              onChange={(e) => currentEditingStoreBgHandler('#' + e.target.value)}
                              placeholder="ffffff"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '14px',
                                outline: 'none',
                                width: '100%',
                                fontFamily: 'monospace'
                              }}
                            />
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                background: (activeStoreBgTab === 'glow' && storeBtnDefaultBgSyncGlow && storeBtnDefaultBgGradientEnabled)
                                  ? `linear-gradient(135deg, ${storeBtnDefaultBgColor}, ${storeBtnDefaultBgColor2})`
                                  : currentEditingStoreBgColor,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                flexShrink: 0
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Slider de Transparência do Background */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#fff' }}>Transparência do Background</span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                          {Math.round(storeBtnDefaultBgOpacity * 100)}%{storeBtnDefaultBgOpacity === 0 ? ' (0% - Totalmente Transparente)' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={storeBtnDefaultBgOpacity}
                          onChange={(e) => handleStoreDefaultBgOpacityChange(Number(e.target.value))}
                          style={{
                            width: '100%',
                            accentColor: '#4CAF50',
                            background: 'rgba(255, 255, 255, 0.1)',
                            height: '6px',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Arredondamento das Bordas comum a ambos os modos */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff' }}>Arredondamento das Bordas</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{storeBtnBorderRadius}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={storeBtnBorderRadius}
                        onChange={(e) => handleStoreBorderRadiusChange(Number(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#4CAF50',
                          background: 'rgba(255, 255, 255, 0.1)',
                          height: '6px',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : rightPanelMode === 'alphabet' ? (
            <>
              {/* PAINEL 2: FILTRO ALFABÉTICO & TOTAL DE JOGOS (CONTADOR) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>FILTRO ALFABÉTICO & TOTAL DE JOGOS</span>
                <button
                  onClick={() => setRightPanelMode('default')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  ← Voltar
                </button>
              </div>

              {/* CARD DE DEMONSTRAÇÃO EM TEMPO REAL: TOTAL DE JOGOS & LETRAS A-Z */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Preview:
                  </span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>
                    Todos os Jogos
                  </span>
                  <span
                    className={`numberOfgames ${alphabetGlowMode === 'neon' ? 'numberOfgames--neon' : ''} ${alphabetDefaultBgOpacity === 0 ? 'numberOfgames--zero-bg' : ''}`}
                    style={{
                      margin: 0,
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '36px',
                      height: '36px',
                      padding: '0 8px',
                      boxSizing: 'border-box',
                      borderRadius: `${alphabetBtnBorderRadius}px`,
                      background: alphabetDefaultBgOpacity === 0 ? 'transparent' : (
                        alphabetDefaultBgGradientEnabled
                          ? `linear-gradient(135deg, ${alphabetDefaultBgColor} 0%, ${alphabetDefaultBgColor2} 100%)`
                          : alphabetDefaultBgColor
                      ),
                      border: alphabetDefaultBgOpacity === 0 ? 'none' : (
                        alphabetBtnBorderEnabled ? `1px solid ${alphabetDefaultBgColor}` : 'none'
                      ),
                      ...(alphabetGlowMode === 'neon' ? (
                        alphabetBtnGradientEnabled ? {
                          background: `linear-gradient(135deg, ${alphabetBtnBgColor} 0%, ${alphabetBtnBgColor2} 100%)`,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: `drop-shadow(-1.5px -1.5px calc(${alphabetGlowStrength}px * 0.35) ${effectiveAlphabetGlowRgba1}) drop-shadow(1.5px 1.5px calc(${alphabetGlowStrength}px * 0.35) ${effectiveAlphabetGlowRgba2})`,
                          display: 'inline-block'
                        } : {
                          color: alphabetBtnBgColor,
                          textShadow: `0 0 2px ${effectivePreviewAlphabetGlow1}, 0 0 ${alphabetGlowStrength}px ${effectiveAlphabetGlowRgba1}`
                        }
                      ) : {
                        color: '#ffffff'
                      }),
                      backdropFilter: alphabetDefaultBgOpacity === 0 ? 'none' : 'blur(12px)',
                      WebkitBackdropFilter: alphabetDefaultBgOpacity === 0 ? 'none' : 'blur(12px)',
                      fontFamily: 'inherit',
                      fontSize: '15px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {totalRealGamesCount}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Letra:</span>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: `${alphabetBtnBorderRadius}px`,
                      background: alphabetDefaultBgOpacity === 0 ? 'transparent' : (
                        alphabetDefaultBgGradientEnabled
                          ? `linear-gradient(135deg, ${alphabetDefaultBgColor} 0%, ${alphabetDefaultBgColor2} 100%)`
                          : alphabetDefaultBgColor
                      ),
                      border: alphabetDefaultBgOpacity === 0 ? 'none' : (
                        alphabetBtnBorderEnabled ? `1px solid ${alphabetDefaultBgColor}` : 'none'
                      ),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '15px',
                      backdropFilter: alphabetDefaultBgOpacity === 0 ? 'none' : 'blur(12px)',
                      WebkitBackdropFilter: alphabetDefaultBgOpacity === 0 ? 'none' : 'blur(12px)',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <span
                      style={alphabetGlowMode === 'neon' ? (
                        alphabetBtnGradientEnabled ? {
                          background: `linear-gradient(135deg, ${alphabetBtnBgColor} 0%, ${alphabetBtnBgColor2} 100%)`,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: `drop-shadow(-1.5px -1.5px calc(${alphabetGlowStrength}px * 0.35) ${effectiveAlphabetGlowRgba1}) drop-shadow(1.5px 1.5px calc(${alphabetGlowStrength}px * 0.35) ${effectiveAlphabetGlowRgba2})`,
                          display: 'inline-block'
                        } : {
                          color: alphabetBtnBgColor,
                          textShadow: `0 0 2px ${effectivePreviewAlphabetGlow1}, 0 0 ${alphabetGlowStrength}px ${effectiveAlphabetGlowRgba1}`
                        }
                      ) : {
                        color: '#ffffff'
                      }}
                    >
                      A
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Estilo das Letras A-Z e Contador
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o estilo padrão vs neon suave, cores, degradê e brilho do filtro alfabético
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleAlphabetGlowModeChange('disabled')}
                      style={{
                        background: alphabetGlowMode === 'disabled' ? '#00e5ff' : 'transparent',
                        color: alphabetGlowMode === 'disabled' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: alphabetGlowMode === 'disabled' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚪ Padrão (Manter como está)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlphabetGlowModeChange('neon')}
                      style={{
                        background: alphabetGlowMode === 'neon' ? '#00e5ff' : 'transparent',
                        color: alphabetGlowMode === 'neon' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: alphabetGlowMode === 'neon' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Novo Estilo Neon Suave
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {alphabetGlowMode === 'disabled'
                      ? 'Mantém a aparência padrão das letras A-Z com fundo customizável.'
                      : 'Aplica iluminação neon suave e contorno brilhante nas letras e contador.'}
                  </span>

                  {/* Configurações Modo Neon */}
                  {alphabetGlowMode === 'neon' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {alphabetBtnGradientEnabled ? 'Cor do Efeito (Degradê)' : 'Cor do Efeito Neon'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                          <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={alphabetBtnGradientEnabled}
                              onChange={(e) => handleAlphabetGradientToggle(e.target.checked)}
                            />
                            <span className="premium-slider"></span>
                          </label>
                        </label>
                      </div>

                      {alphabetBtnGradientEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              background: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: '6px',
                              padding: '3px',
                              gap: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveAlphabetColorTab('color1')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeAlphabetColorTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeAlphabetColorTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alphabetBtnBgColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Inicial
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveAlphabetColorTab('color2')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeAlphabetColorTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeAlphabetColorTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alphabetBtnBgColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Final
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveAlphabetColorTab('glow')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeAlphabetColorTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeAlphabetColorTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alphabetGlowColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Glow
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                            <button
                              type="button"
                              onClick={() => handleAlphabetSyncGlowToggle(!alphabetSyncGlowWithGradient)}
                              style={{
                                background: alphabetSyncGlowWithGradient ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                color: alphabetSyncGlowWithGradient ? '#00e5ff' : '#fff',
                                border: alphabetSyncGlowWithGradient ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: alphabetSyncGlowWithGradient ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {alphabetSyncGlowWithGradient ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                            </button>
                          </div>
                        </div>
                      )}

                      <SVBox hexColor={currentEditingAlphabetColor} onChange={currentEditingAlphabetHandler} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={currentEditingAlphabetHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(currentEditingAlphabetColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              currentEditingAlphabetHandler(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': currentEditingAlphabetColor,
                              '--thumb-border-color': currentEditingAlphabetColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={currentEditingAlphabetColor.replace('#', '')}
                            onChange={(e) => currentEditingAlphabetHandler('#' + e.target.value)}
                            placeholder="00ffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              background: (activeAlphabetColorTab === 'glow' && alphabetSyncGlowWithGradient && alphabetBtnGradientEnabled)
                                ? `linear-gradient(135deg, ${alphabetBtnBgColor}, ${alphabetBtnBgColor2})`
                                : currentEditingAlphabetColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Efeito (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(alphabetOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={alphabetOpacity}
                            onChange={(e) => handleAlphabetOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Força do Efeito Neon (Glow)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{alphabetGlowStrength}px</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={alphabetGlowStrength}
                            onChange={(e) => handleAlphabetGlowStrengthChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Divisor antes do Background */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

                  {/* 3. BACKGROUND INDIVIDUAL DO FILTRO ALFABÉTICO & CONTADOR */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Background Individual das Letras / Botões
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Cor e transparência do fundo de cada botão do filtro alfabético
                        </span>
                      </div>

                      {/* Botão para trocar a cor do background */}
                      <button
                        type="button"
                        onClick={() => setShowAlphabetBgColorPicker(!showAlphabetBgColorPicker)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: showAlphabetBgColorPicker ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          border: showAlphabetBgColorPicker ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: showAlphabetBgColorPicker ? '#00e5ff' : '#fff',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: showAlphabetBgColorPicker ? '0 0 10px rgba(0, 229, 255, 0.2)' : 'none'
                        }}
                      >
                        <div
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '3px',
                            background: alphabetDefaultBgGradientEnabled
                              ? `linear-gradient(135deg, ${alphabetDefaultBgColor}, ${alphabetDefaultBgColor2})`
                              : alphabetDefaultBgColor,
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            boxShadow: `0 0 6px ${alphabetDefaultBgColor}55`
                          }}
                        />
                        <span>🎨 Trocar Cor do Fundo</span>
                        <span style={{ fontSize: '10px', opacity: 0.7, fontFamily: 'monospace' }}>
                          {alphabetDefaultBgGradientEnabled ? 'Degradê' : alphabetDefaultBgColor.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '8px', transform: showAlphabetBgColorPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                          ▼
                        </span>
                      </button>
                    </div>

                    {/* Módulo Réplica para o Background ao Clicar no Botão */}
                    {showAlphabetBgColorPicker && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          padding: '14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        {/* Header com Toggle Degradê */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {alphabetDefaultBgGradientEnabled ? 'COR DO BACKGROUND (DEGRADÊ)' : 'COR DO BACKGROUND'}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                            <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={alphabetDefaultBgGradientEnabled}
                                onChange={(e) => handleAlphabetDefaultBgGradientToggle(e.target.checked)}
                              />
                              <span className="premium-slider"></span>
                            </label>
                          </label>
                        </div>

                        {/* Abas Degradê (Cor Inicial, Cor Final, Cor Glow) */}
                        {alphabetDefaultBgGradientEnabled && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div
                              style={{
                                display: 'flex',
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: '6px',
                                padding: '3px',
                                gap: '4px',
                                border: '1px solid rgba(255, 255, 255, 0.05)'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setActiveAlphabetBgTab('color1')}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  background: activeAlphabetBgTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                  color: '#fff',
                                  border: activeAlphabetBgTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alphabetDefaultBgColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                                Cor Inicial
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveAlphabetBgTab('color2')}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  background: activeAlphabetBgTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                  color: '#fff',
                                  border: activeAlphabetBgTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alphabetDefaultBgColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                                Cor Final
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveAlphabetBgTab('glow')}
                                style={{
                                  flex: 1,
                                  height: '28px',
                                  background: activeAlphabetBgTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                  color: '#fff',
                                  border: activeAlphabetBgTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                <div
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: alphabetDefaultBgSyncGlow
                                      ? (alphabetDefaultBgGradientEnabled ? `linear-gradient(135deg, ${alphabetDefaultBgColor}, ${alphabetDefaultBgColor2})` : alphabetDefaultBgColor)
                                      : alphabetDefaultBgGlowColor,
                                    border: '1px solid rgba(255,255,255,0.3)'
                                  }}
                                />
                                Cor Glow
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                              <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                              <button
                                type="button"
                                onClick={() => handleAlphabetDefaultBgSyncGlowToggle(!alphabetDefaultBgSyncGlow)}
                                style={{
                                  background: alphabetDefaultBgSyncGlow ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                  color: alphabetDefaultBgSyncGlow ? '#00e5ff' : '#fff',
                                  border: alphabetDefaultBgSyncGlow ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '4px',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  fontWeight: alphabetDefaultBgSyncGlow ? 'bold' : 'normal',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                {alphabetDefaultBgSyncGlow ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SVBox */}
                        <SVBox hexColor={currentEditingAlphabetBgColor} onChange={currentEditingAlphabetBgHandler} />

                        {/* Hue Slider */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={currentEditingAlphabetBgHsl.h}
                              onChange={(e) => {
                                const hVal = Number(e.target.value)
                                const rgbVal = hexToRgb(currentEditingAlphabetBgColor)
                                const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                                const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                                const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                                currentEditingAlphabetBgHandler(hex)
                              }}
                              className="color-picker-range hue-picker-range"
                              style={{
                                '--thumb-color': currentEditingAlphabetBgColor,
                                '--thumb-border-color': currentEditingAlphabetBgColor
                              } as React.CSSProperties}
                            />
                          </div>
                        </div>

                        {/* Hex input com thumbnail */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              gap: '10px',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                            <input
                              type="text"
                              value={currentEditingAlphabetBgColor.replace('#', '')}
                              onChange={(e) => currentEditingAlphabetBgHandler('#' + e.target.value)}
                              placeholder="ffffff"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '14px',
                                outline: 'none',
                                width: '100%',
                                fontFamily: 'monospace'
                              }}
                            />
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                background: (activeAlphabetBgTab === 'glow' && alphabetDefaultBgSyncGlow && alphabetDefaultBgGradientEnabled)
                                  ? `linear-gradient(135deg, ${alphabetDefaultBgColor}, ${alphabetDefaultBgColor2})`
                                  : currentEditingAlphabetBgColor,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                flexShrink: 0
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Slider de Transparência do Background */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#fff' }}>Transparência do Background</span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                          {Math.round(alphabetDefaultBgOpacity * 100)}%{alphabetDefaultBgOpacity === 0 ? ' (0% - Totalmente Transparente)' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={alphabetDefaultBgOpacity}
                          onChange={(e) => handleAlphabetDefaultBgOpacityChange(Number(e.target.value))}
                          style={{
                            width: '100%',
                            accentColor: '#4CAF50',
                            background: 'rgba(255, 255, 255, 0.1)',
                            height: '6px',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Arredondamento das Bordas comum a ambos os modos */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff' }}>Arredondamento das Bordas</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{alphabetBtnBorderRadius}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={alphabetBtnBorderRadius}
                        onChange={(e) => handleAlphabetBorderRadiusChange(Number(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#4CAF50',
                          background: 'rgba(255, 255, 255, 0.1)',
                          height: '6px',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : rightPanelMode === 'headerSearch' ? (
            <>
              {/* PAINEL 3: BARRA DE BUSCA & ADICIONAR JOGO */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>BUSCA E ADICIONAR JOGOS</span>
                <button
                  onClick={() => setRightPanelMode('default')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  ← Voltar
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Estilo da Busca e Botão Adicionar Jogo
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o estilo padrão vs neon suave, cores, degradê e glow da busca e botão adicionar
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleHeaderSearchGlowModeChange('disabled')}
                      style={{
                        background: headerSearchGlowMode === 'disabled' ? '#00e5ff' : 'transparent',
                        color: headerSearchGlowMode === 'disabled' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: headerSearchGlowMode === 'disabled' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚪ Padrão (Manter como está)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHeaderSearchGlowModeChange('neon')}
                      style={{
                        background: headerSearchGlowMode === 'neon' ? '#00e5ff' : 'transparent',
                        color: headerSearchGlowMode === 'neon' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: headerSearchGlowMode === 'neon' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Novo Estilo Neon Suave
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {headerSearchGlowMode === 'disabled'
                      ? 'Mantém a barra de busca e botão adicionar com o fundo padrão customizável.'
                      : 'Aplica iluminação neon suave e contornos brilhantes nos campos de busca e botões de adicionar.'}
                  </span>

                  {/* Configurações Modo Neon */}
                  {headerSearchGlowMode === 'neon' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {headerSearchGradientEnabled ? 'Cor do Efeito (Degradê)' : 'Cor do Efeito Neon'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                          <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={headerSearchGradientEnabled}
                              onChange={(e) => handleHeaderSearchGradientToggle(e.target.checked)}
                            />
                            <span className="premium-slider"></span>
                          </label>
                        </label>
                      </div>

                      {headerSearchGradientEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              background: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: '6px',
                              padding: '3px',
                              gap: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveHeaderSearchColorTab('color1')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeHeaderSearchColorTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeHeaderSearchColorTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: headerSearchColor1, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Inicial
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveHeaderSearchColorTab('color2')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeHeaderSearchColorTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeHeaderSearchColorTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: headerSearchColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Final
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveHeaderSearchColorTab('glow')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeHeaderSearchColorTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeHeaderSearchColorTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: headerSearchGlowColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Glow
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                            <button
                              type="button"
                              onClick={() => handleHeaderSearchSyncGlowToggle(!headerSearchSyncGlowWithGradient)}
                              style={{
                                background: headerSearchSyncGlowWithGradient ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                color: headerSearchSyncGlowWithGradient ? '#00e5ff' : '#fff',
                                border: headerSearchSyncGlowWithGradient ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: headerSearchSyncGlowWithGradient ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {headerSearchSyncGlowWithGradient ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                            </button>
                          </div>
                        </div>
                      )}

                      <SVBox hexColor={currentEditingHeaderSearchColor} onChange={currentEditingHeaderSearchHandler} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={currentEditingHeaderSearchHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(currentEditingHeaderSearchColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              currentEditingHeaderSearchHandler(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': currentEditingHeaderSearchColor,
                              '--thumb-border-color': currentEditingHeaderSearchColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={currentEditingHeaderSearchColor.replace('#', '')}
                            onChange={(e) => currentEditingHeaderSearchHandler('#' + e.target.value)}
                            placeholder="00ffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: currentEditingHeaderSearchColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Efeito (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(headerSearchOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={headerSearchOpacity}
                            onChange={(e) => handleHeaderSearchOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Força do Efeito Neon (Glow)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{headerSearchGlowStrength}px</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={headerSearchGlowStrength}
                            onChange={(e) => handleHeaderSearchGlowStrengthChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configurações Modo Padrão */}
                  {headerSearchGlowMode === 'disabled' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Cor do Fundo Padrão
                        </span>
                      </div>

                      <SVBox hexColor={headerSearchDefaultBgColor} onChange={handleHeaderSearchDefaultBgColorChange} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={headerSearchDefaultBgHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(headerSearchDefaultBgColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              handleHeaderSearchDefaultBgColorChange(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': headerSearchDefaultBgColor,
                              '--thumb-border-color': headerSearchDefaultBgColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={headerSearchDefaultBgColor.replace('#', '')}
                            onChange={(e) => handleHeaderSearchDefaultBgColorChange('#' + e.target.value)}
                            placeholder="ffffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: headerSearchDefaultBgColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Fundo (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(headerSearchDefaultBgOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={headerSearchDefaultBgOpacity}
                            onChange={(e) => handleHeaderSearchDefaultBgOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : rightPanelMode === 'sidebar' ? (
            <>
              {/* PAINEL 4: BARRA LATERAL ESQUERDA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>BARRA LATERAL (NAVEGAÇÃO)</span>
                <button
                  onClick={() => setRightPanelMode('default')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  ← Voltar
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Estilo dos Ícones da Barra Lateral
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o estilo padrão vs neon suave, cores, degradê e glow dos ícones da barra lateral
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleSidebarGlowModeChange('disabled')}
                      style={{
                        background: sidebarGlowMode === 'disabled' ? '#00e5ff' : 'transparent',
                        color: sidebarGlowMode === 'disabled' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: sidebarGlowMode === 'disabled' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚪ Padrão (Manter como está)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSidebarGlowModeChange('neon')}
                      style={{
                        background: sidebarGlowMode === 'neon' ? '#00e5ff' : 'transparent',
                        color: sidebarGlowMode === 'neon' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: sidebarGlowMode === 'neon' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Novo Estilo Neon Suave
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {sidebarGlowMode === 'disabled'
                      ? 'Mantém os ícones da barra lateral com estilo padrão e fundo customizável.'
                      : 'No hover e no estado ativo, os ícones acendem com iluminação neon suave e contorno brilhante.'}
                  </span>

                  {/* Configurações Modo Neon */}
                  {sidebarGlowMode === 'neon' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {sidebarGradientEnabled ? 'Cor do Efeito (Degradê)' : 'Cor do Efeito Neon'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                          <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={sidebarGradientEnabled}
                              onChange={(e) => handleSidebarGradientToggle(e.target.checked)}
                            />
                            <span className="premium-slider"></span>
                          </label>
                        </label>
                      </div>

                      {sidebarGradientEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              background: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: '6px',
                              padding: '3px',
                              gap: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveSidebarColorTab('color1')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeSidebarColorTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeSidebarColorTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sidebarColor1, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Inicial
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveSidebarColorTab('color2')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeSidebarColorTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeSidebarColorTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sidebarColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Final
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveSidebarColorTab('glow')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeSidebarColorTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeSidebarColorTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sidebarGlowColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Glow
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                            <button
                              type="button"
                              onClick={() => handleSidebarSyncGlowToggle(!sidebarSyncGlowWithGradient)}
                              style={{
                                background: sidebarSyncGlowWithGradient ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                color: sidebarSyncGlowWithGradient ? '#00e5ff' : '#fff',
                                border: sidebarSyncGlowWithGradient ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: sidebarSyncGlowWithGradient ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {sidebarSyncGlowWithGradient ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                            </button>
                          </div>
                        </div>
                      )}

                      <SVBox hexColor={currentEditingSidebarColor} onChange={currentEditingSidebarHandler} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={currentEditingSidebarHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(currentEditingSidebarColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              currentEditingSidebarHandler(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': currentEditingSidebarColor,
                              '--thumb-border-color': currentEditingSidebarColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={currentEditingSidebarColor.replace('#', '')}
                            onChange={(e) => currentEditingSidebarHandler('#' + e.target.value)}
                            placeholder="00ffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: currentEditingSidebarColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Efeito (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(sidebarOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={sidebarOpacity}
                            onChange={(e) => handleSidebarOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Força do Efeito Neon (Glow)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{sidebarGlowStrength}px</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={sidebarGlowStrength}
                            onChange={(e) => handleSidebarGlowStrengthChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configurações Modo Padrão */}
                  {sidebarGlowMode === 'disabled' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Cor do Fundo Padrão
                        </span>
                      </div>

                      <SVBox hexColor={sidebarDefaultBgColor} onChange={handleSidebarDefaultBgColorChange} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={sidebarDefaultBgHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(sidebarDefaultBgColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              handleSidebarDefaultBgColorChange(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': sidebarDefaultBgColor,
                              '--thumb-border-color': sidebarDefaultBgColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={sidebarDefaultBgColor.replace('#', '')}
                            onChange={(e) => handleSidebarDefaultBgColorChange('#' + e.target.value)}
                            placeholder="ffffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: sidebarDefaultBgColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Fundo (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(sidebarDefaultBgOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={sidebarDefaultBgOpacity}
                            onChange={(e) => handleSidebarDefaultBgOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : rightPanelMode === 'headerControls' ? (
            <>
              {/* SEÇÃO 3: ÍCONES DE AÇÃO DO CABEÇALHO */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>ÍCONES DE AÇÃO DO CABEÇALHO</span>
                <button
                  onClick={() => setRightPanelMode('default')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  ← Voltar
                </button>
              </div>

              {/* Controles dos Ícones de Ação */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Ícones de Ação (Grade, Ordenação, Filtros, Atualizar)
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o estilo neon, cores, degradê e glow dos 6 ícones de ação da biblioteca
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleActionIconsGlowModeChange('disabled')}
                      style={{
                        background: actionIconsGlowMode === 'disabled' ? '#00e5ff' : 'transparent',
                        color: actionIconsGlowMode === 'disabled' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: actionIconsGlowMode === 'disabled' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚪ Padrão (Manter como está)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActionIconsGlowModeChange('neon')}
                      style={{
                        background: actionIconsGlowMode === 'neon' ? '#00e5ff' : 'transparent',
                        color: actionIconsGlowMode === 'neon' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: actionIconsGlowMode === 'neon' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Novo Estilo Neon Suave
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {actionIconsGlowMode === 'disabled'
                      ? 'Mantém o estilo padrão atual dos 6 ícones de ação da biblioteca.'
                      : 'No hover e no estado ativo, os ícones acendem com o efeito neon totalmente customizado abaixo.'}
                  </span>

                  {/* Personalização Avançada de Cores, Transparência, Força e Degradê dos Ícones de Ação */}
                  {actionIconsGlowMode === 'neon' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      {/* Top Bar: Título + Switch de Degradê */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {actionIconsGradientEnabled ? 'Cor do Efeito (Degradê)' : 'Cor do Efeito Neon'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                          <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={actionIconsGradientEnabled}
                              onChange={(e) => handleActionIconsGradientToggle(e.target.checked)}
                            />
                            <span className="premium-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Tabs de Seleção de Cores em caso de Degradê Ativo */}
                      {actionIconsGradientEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              background: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: '6px',
                              padding: '3px',
                              gap: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveActionIconsColorTab('color1')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeActionIconsColorTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeActionIconsColorTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                outline: 'none'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: actionIconsColor1, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Inicial
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveActionIconsColorTab('color2')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeActionIconsColorTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeActionIconsColorTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                outline: 'none'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: actionIconsColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Final
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionIconsColorTab('glow')
                                if (actionIconsSyncGlowWithGradient) {
                                  handleActionIconsSyncGlowToggle(false)
                                }
                              }}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeActionIconsColorTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeActionIconsColorTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                outline: 'none'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: actionIconsSyncGlowWithGradient ? `linear-gradient(135deg, ${actionIconsColor1}, ${actionIconsColor2})` : actionIconsGlowColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor do Glow
                            </button>
                          </div>

                          {/* Botão de Sincronizar Cor do Glow com o Degradê das duas primeiras cores */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                            <button
                              type="button"
                              onClick={() => handleActionIconsSyncGlowToggle(!actionIconsSyncGlowWithGradient)}
                              style={{
                                background: actionIconsSyncGlowWithGradient ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                color: actionIconsSyncGlowWithGradient ? '#00e5ff' : '#fff',
                                border: actionIconsSyncGlowWithGradient ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: actionIconsSyncGlowWithGradient ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {actionIconsSyncGlowWithGradient ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2D SV Box */}
                      <SVBox hexColor={currentEditingActionIconsColor} onChange={currentEditingActionIconsHandler} />

                      {/* Hue Slider */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={currentEditingActionIconsHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(currentEditingActionIconsColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              currentEditingActionIconsHandler(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': currentEditingActionIconsColor,
                              '--thumb-border-color': currentEditingActionIconsColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Hex Input and Color Preview */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={currentEditingActionIconsColor.replace('#', '')}
                            onChange={(e) => currentEditingActionIconsHandler('#' + e.target.value)}
                            placeholder="00ffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: currentEditingActionIconsColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      {/* Slider 1: Transparência (Opacidade do Efeito) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Efeito (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(actionIconsOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={actionIconsOpacity}
                            onChange={(e) => handleActionIconsOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>

                      {/* Slider 2: Força do Efeito Neon (Intensidade do Glow) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Força do Efeito Neon (Glow)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{actionIconsGlowStrength}px</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={actionIconsGlowStrength}
                            onChange={(e) => handleActionIconsGlowStrengthChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personalização do Fundo Padrão (Background e Transparência) */}
                  {actionIconsGlowMode === 'disabled' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Cor do Fundo Padrão
                        </span>
                      </div>

                      {/* 2D SV Box */}
                      <SVBox hexColor={actionIconsDefaultBgColor} onChange={handleActionIconsDefaultBgColorChange} />

                      {/* Hue Slider */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={actionDefaultBgHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(actionIconsDefaultBgColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              handleActionIconsDefaultBgColorChange(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': actionIconsDefaultBgColor,
                              '--thumb-border-color': actionIconsDefaultBgColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Hex Input and Color Preview */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={actionIconsDefaultBgColor.replace('#', '')}
                            onChange={(e) => handleActionIconsDefaultBgColorChange('#' + e.target.value)}
                            placeholder="ffffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: actionIconsDefaultBgColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      {/* Slider: Transparência do Fundo (Alpha) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Fundo (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(actionIconsDefaultBgOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={actionIconsDefaultBgOpacity}
                            onChange={(e) => handleActionIconsDefaultBgOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : rightPanelMode === 'headerButtons' ? (
            <>
              {/* SEÇÃO 4: BOTÕES DE AÇÃO DO CABEÇALHO */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>BOTÕES DE AÇÃO DO CABEÇALHO</span>
                <button
                  onClick={() => setRightPanelMode('default')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  ← Voltar
                </button>
              </div>

              {/* Controles dos Botões de Ação */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Botões de Ação (Edição em Massa, Categorias, Filtros)
                  </span>
                  <span style={styles.toggleSub}>
                    Personalize o estilo e contorno neon dos botões de ação e menus superiores
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleHeaderButtonsGlowModeChange('disabled')}
                      style={{
                        background: headerButtonsGlowMode === 'disabled' ? '#00e5ff' : 'transparent',
                        color: headerButtonsGlowMode === 'disabled' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: headerButtonsGlowMode === 'disabled' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚪ Padrão (Manter como está)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHeaderButtonsGlowModeChange('neon')}
                      style={{
                        background: headerButtonsGlowMode === 'neon' ? '#00e5ff' : 'transparent',
                        color: headerButtonsGlowMode === 'neon' ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: headerButtonsGlowMode === 'neon' ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Novo Estilo Neon Suave
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {headerButtonsGlowMode === 'disabled'
                      ? 'Mantém o estilo padrão dos botões de ação e menus de filtros.'
                      : 'No hover e quando abertos, os botões e ícones acendem com o efeito neon totalmente customizado abaixo.'}
                  </span>

                  {/* Personalização Avançada de Cores, Transparência, Força e Degradê dos Botões de Ação */}
                  {headerButtonsGlowMode === 'neon' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      {/* Top Bar: Título + Switch de Degradê */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {headerButtonsGradientEnabled ? 'Cor do Efeito (Degradê)' : 'Cor do Efeito Neon'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Degradê</span>
                          <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={headerButtonsGradientEnabled}
                              onChange={(e) => handleHeaderButtonsGradientToggle(e.target.checked)}
                            />
                            <span className="premium-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Tabs de Seleção de Cores em caso de Degradê Ativo */}
                      {headerButtonsGradientEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              background: 'rgba(0, 0, 0, 0.3)',
                              borderRadius: '6px',
                              padding: '3px',
                              gap: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveHeaderButtonsColorTab('color1')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeHeaderButtonsColorTab === 'color1' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeHeaderButtonsColorTab === 'color1' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                outline: 'none'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: headerButtonsColor1, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Inicial
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveHeaderButtonsColorTab('color2')}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeHeaderButtonsColorTab === 'color2' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeHeaderButtonsColorTab === 'color2' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                outline: 'none'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: headerButtonsColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor Final
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveHeaderButtonsColorTab('glow')
                                if (headerButtonsSyncGlowWithGradient) {
                                  handleHeaderButtonsSyncGlowToggle(false)
                                }
                              }}
                              style={{
                                flex: 1,
                                height: '28px',
                                background: activeHeaderButtonsColorTab === 'glow' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: '#fff',
                                border: activeHeaderButtonsColorTab === 'glow' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                outline: 'none'
                              }}
                            >
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: headerButtonsSyncGlowWithGradient ? `linear-gradient(135deg, ${headerButtonsColor1}, ${headerButtonsColor2})` : headerButtonsGlowColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                              Cor do Glow
                            </button>
                          </div>

                          {/* Botão de Sincronizar Cor do Glow com o Degradê */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                            <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Sincronizar Glow com Degradê</span>
                            <button
                              type="button"
                              onClick={() => handleHeaderButtonsSyncGlowToggle(!headerButtonsSyncGlowWithGradient)}
                              style={{
                                background: headerButtonsSyncGlowWithGradient ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                color: headerButtonsSyncGlowWithGradient ? '#00e5ff' : '#fff',
                                border: headerButtonsSyncGlowWithGradient ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: headerButtonsSyncGlowWithGradient ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {headerButtonsSyncGlowWithGradient ? '✓ Glow Sincronizado' : '🔄 Sincronizar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2D SV Box */}
                      <SVBox hexColor={currentEditingHeaderButtonsColor} onChange={currentEditingHeaderButtonsHandler} />

                      {/* Hue Slider */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={currentEditingHeaderButtonsHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(currentEditingHeaderButtonsColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              currentEditingHeaderButtonsHandler(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': currentEditingHeaderButtonsColor,
                              '--thumb-border-color': currentEditingHeaderButtonsColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Hex Input and Color Preview */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={currentEditingHeaderButtonsColor.replace('#', '')}
                            onChange={(e) => currentEditingHeaderButtonsHandler('#' + e.target.value)}
                            placeholder="00ffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: currentEditingHeaderButtonsColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      {/* Slider 1: Transparência do Efeito (Alpha) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Efeito (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(headerButtonsOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={headerButtonsOpacity}
                            onChange={(e) => handleHeaderButtonsOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>

                      {/* Slider 2: Força do Efeito Neon (Intensidade do Glow) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Força do Efeito Neon (Glow)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{headerButtonsGlowStrength}px</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={headerButtonsGlowStrength}
                            onChange={(e) => handleHeaderButtonsGlowStrengthChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personalização do Fundo Padrão dos Botões de Ação */}
                  {headerButtonsGlowMode === 'disabled' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Cor do Fundo Padrão
                        </span>
                      </div>

                      {/* 2D SV Box */}
                      <SVBox hexColor={headerButtonsDefaultBgColor} onChange={handleHeaderButtonsDefaultBgColorChange} />

                      {/* Hue Slider */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={headerDefaultBgHsl.h}
                            onChange={(e) => {
                              const hVal = Number(e.target.value)
                              const rgbVal = hexToRgb(headerButtonsDefaultBgColor)
                              const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                              const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                              const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                              handleHeaderButtonsDefaultBgColorChange(hex)
                            }}
                            className="color-picker-range hue-picker-range"
                            style={{
                              '--thumb-color': headerButtonsDefaultBgColor,
                              '--thumb-border-color': headerButtonsDefaultBgColor
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Hex Input and Color Preview */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            gap: '10px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'monospace' }}>#</span>
                          <input
                            type="text"
                            value={headerButtonsDefaultBgColor.replace('#', '')}
                            onChange={(e) => handleHeaderButtonsDefaultBgColorChange('#' + e.target.value)}
                            placeholder="ffffff"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: headerButtonsDefaultBgColor,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              flexShrink: 0
                            }}
                          />
                        </div>
                      </div>

                      {/* Slider: Transparência do Fundo (Alpha) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#fff' }}>Transparência do Fundo (Alpha)</span>
                          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(headerButtonsDefaultBgOpacity * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={headerButtonsDefaultBgOpacity}
                            onChange={(e) => handleHeaderButtonsDefaultBgOpacityChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#4CAF50',
                              background: 'rgba(255, 255, 255, 0.1)',
                              height: '6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
