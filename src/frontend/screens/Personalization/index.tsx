import React, { useState, useEffect, useContext, useMemo } from 'react'
import ContextProvider from 'frontend/state/ContextProvider'

interface CustomStore {
  id: string
  name: string
  icon: string | null
  isVisible?: boolean
}

export default function PersonalizationScreen() {
  const { epic, gog, sideloadedLibrary, amazon, zoom } = useContext(ContextProvider)

  const [bgImage, setBgImage] = useState<string | null>(() => {
    return localStorage.getItem('heroic_custom_bg')
  })

  const [isDraggingBg, setIsDraggingBg] = useState<boolean>(false)
  const [focusedStoreId, setFocusedStoreId] = useState<string | null>(null)
  const [activePreviewStoreId, setActivePreviewStoreId] = useState<string>('')
  const [activePreviewLetter, setActivePreviewLetter] = useState<string>('C')

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
    return [
      { id: 'epic', name: 'Epic Games', icon: null, isVisible: true },
      { id: 'gog', name: 'GOG', icon: null, isVisible: true }
    ]
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
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [hideSearchSuggestions, setHideSearchSuggestions] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_search_suggestions')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [alphabetAlignment, setAlphabetAlignment] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_alignment') || 'center'
  })

  const [alphabetBgOpacity, setAlphabetBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_bg_opacity')
    return saved !== null ? Number(saved) : 0.08
  })

  const [alphabetBtnOpacity, setAlphabetBtnOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  const [alphabetColor, setAlphabetColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_color')
    return saved !== null ? saved : '#ffffff'
  })

  // ==============================================================
  // ESCOLHA ALEATÓRIA DE 6 JOGOS DA BIBLIOTECA REAL COM REPETIÇÃO
  // ==============================================================
  const previewGames = useMemo(() => {
    const realGamesList = [
      ...(epic?.library ?? []),
      ...(gog?.library ?? []),
      ...(sideloadedLibrary ?? []),
      ...(amazon?.library ?? []),
      ...(zoom?.library ?? [])
    ].filter(Boolean)

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
  // ==============================================================


  useEffect(() => {
    localStorage.setItem('heroic_custom_stores', JSON.stringify(stores))
    window.dispatchEvent(new Event('customStoresChanged'))
    
    const firstVisible = stores.find((s) => s.isVisible ?? true)
    if (firstVisible && !activePreviewStoreId) {
      setActivePreviewStoreId(firstVisible.id)
    }
  }, [stores, activePreviewStoreId])

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
    setAlphabetBtnOpacity(val)
    localStorage.setItem('heroic_alphabet_btn_opacity', val.toString())
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

  const hslToRgb = (h: number, s: number, l: number) => {
    h /= 360
    s /= 100
    l /= 100
    let r = l
    let g = l
    let b = l

    if (s !== 0) {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1 / 3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1 / 3)
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    }
  }

  const handleHexChange = (val: string) => {
    setAlphabetColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleRgbFieldChange = (field: 'r' | 'g' | 'b', valStr: string) => {
    const rgbValues = hexToRgb(alphabetColor)
    const val = Math.max(0, Math.min(255, parseInt(valStr) || 0))
    const newRgb = { ...rgbValues, [field]: val }
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
    setAlphabetColor(hex)
    localStorage.setItem('heroic_alphabet_color', hex)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleHueSliderChange = (hVal: number) => {
    const rgbValues = hexToRgb(alphabetColor)
    const hslValues = rgbToHsl(rgbValues.r, rgbValues.g, rgbValues.b)
    const s = hslValues.s < 10 ? 100 : hslValues.s
    const l = (hslValues.l < 15 || hslValues.l > 85) ? 50 : hslValues.l
    const newRgb = hslToRgb(hVal, s, l)
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
    setAlphabetColor(hex)
    localStorage.setItem('heroic_alphabet_color', hex)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleGrayscaleSliderChange = (val: number) => {
    const v = 255 - val
    const hex = rgbToHex(v, v, v)
    setAlphabetColor(hex)
    localStorage.setItem('heroic_alphabet_color', hex)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleLightnessSliderChange = (lVal: number) => {
    const rgbValues = hexToRgb(alphabetColor)
    const hslValues = rgbToHsl(rgbValues.r, rgbValues.g, rgbValues.b)
    const newRgb = hslToRgb(hslValues.h, hslValues.s, lVal)
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
    setAlphabetColor(hex)
    localStorage.setItem('heroic_alphabet_color', hex)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }
  // ==============================================================

  const rgbValues = hexToRgb(alphabetColor)
  const hslValues = rgbToHsl(rgbValues.r, rgbValues.g, rgbValues.b)
  const pureRgb = hslToRgb(hslValues.h, hslValues.s < 10 ? 100 : hslValues.s, 50)
  const currentGrayscaleValue = 255 - Math.round((rgbValues.r + rgbValues.g + rgbValues.b) / 3)
  const pureColorHex = rgbToHex(pureRgb.r, pureRgb.g, pureRgb.b)
  
  const { r, g, b } = rgbValues
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const isLightColor = luminance > 140
  const useDarkText = isLightColor && alphabetBtnOpacity > 0.4

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
      overflow: 'hidden'
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
      boxSizing: 'border-box'
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
      overflowY: 'auto'
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

        /* HUE THUMB */
        input[type='range'].hue-picker-range::-webkit-slider-thumb {
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
        input[type='range'].hue-picker-range::-webkit-slider-thumb:hover {
          transform: scale(1.1) !important;
        }
        input[type='range'].hue-picker-range::-moz-range-thumb {
          height: 26px !important;
          width: 10px !important;
          border-radius: 6px !important;
          background: var(--thumb-color, #ffffff) !important;
          border: 2.5px solid var(--thumb-border-color, #ffffff) !important;
          cursor: pointer !important;
          box-shadow: 0 0 10px var(--thumb-border-color, rgba(255, 255, 255, 0.5)) !important;
          transition: transform 0.1s !important;
        }
        input[type='range'].hue-picker-range::-moz-range-thumb:hover {
          transform: scale(1.1) !important;
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
          padding-top: 6px;
        }

        .preview-platform-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 5px 11px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 14px;
          font-weight: 400;
          cursor: default;
          white-space: nowrap;
          transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
          flex-shrink: 0;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .preview-platform-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .preview-platform-btn--active {
          background: linear-gradient(135deg, rgba(20, 24, 30, 0.6) 0%, rgba(230, 126, 34, 0.06) 100%) padding-box, linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(230, 126, 34, 0.95) 100%) border-box !important;
          border: 1px solid transparent !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          font-weight: 600 !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 3px 12px 0 rgba(230, 126, 34, 0.14), inset 0 0 8px rgba(255, 255, 255, 0.05) !important;
          position: relative;
          z-index: 2;
        }

        .preview-platform-icon-img {
          width: 26px;
          height: 26px;
          object-fit: contain;
        }

        .preview-platform-icon-placeholder {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #4CAF50;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
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
          max-width: 100%;
          overflow-x: auto;
          scrollbar-width: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .preview-alphabet-container::-webkit-scrollbar {
          display: none;
        }

        .preview-alphabet-btn {
          background-color: rgba(var(--base-r), var(--base-g), var(--base-b), var(--btn-op));
          border: 1px solid rgba(var(--base-r), var(--base-g), var(--base-b), var(--btn-op));
          color: var(--txt-color);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 600;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          flex-shrink: 0;
          user-select: none;
          outline: none;
          transition: all 0.2s ease-in-out;
        }

        .preview-alphabet-btn--active {
          background: linear-gradient(135deg, rgba(20, 24, 30, 0.6) 0%, rgba(230, 126, 34, 0.06) 100%) padding-box, linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(230, 126, 34, 0.95) 100%) border-box !important;
          border: 2px solid transparent !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 3px 10px 0 rgba(230, 126, 34, 0.25), inset 0 0 4px rgba(255, 255, 255, 0.1) !important;
          transform: scale(1.1);
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
        .preview-game-card.gamepad {
          aspect-ratio: 3/4;
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
          <div style={styles.previewArea}>
            <div className="preview-library-container">
              {/* 1. TOP BAR */}
              <div className="preview-top-bar">
                {/* LINHA 1: Barra de busca, navegação e botões/filtros mockados */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '15px' }}>
                  {/* Lado Esquerdo: Navegação, Busca, Botão Adicionar e Ícones */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="preview-search-wrapper">
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
                    <button style={{
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
                      cursor: 'default',
                      textTransform: 'uppercase',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      + ADICIONAR JOGO
                    </button>

                    {/* Ícones de Ação mockados */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '18px', marginLeft: '8px' }}>
                      <span title="Exibição em Lista" style={{ cursor: 'default' }}>☰</span>
                      <span title="Ordenar" style={{ cursor: 'default' }}>⇅</span>
                      <span title="Exibição em Grade" style={{ cursor: 'default', color: '#fff' }}>☷</span>
                      <span title="Ocultar Instalados" style={{ cursor: 'default' }}>👁</span>
                      <span title="Recarregar" style={{ cursor: 'default' }}>↻</span>
                    </div>
                  </div>

                  {/* Lado Direito: Filtros mockados */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.8)',
                      cursor: 'default',
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
                      cursor: 'default'
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
                      cursor: 'default'
                    }}>
                      <span>Filtros</span>
                      <span style={{ fontSize: '8px' }}>▼</span>
                    </div>
                  </div>
                </div>

                {/* LINHA 2: Barra de Lojas / Plataformas */}
                <div className="preview-platforms-bar">
                  {stores
                    .filter((s) => s.isVisible ?? true)
                    .slice(0, 6)
                    .map((store, index) => {
                      const imageSource = store.icon
                        ? store.icon
                        : `/images/${store.id}.png`
                      const isActive = activePreviewStoreId === store.id || (!activePreviewStoreId && index === 0)
                      return (
                        <div 
                          key={store.id} 
                          className={`preview-platform-btn ${isActive ? 'preview-platform-btn--active' : ''}`}
                          onClick={() => setActivePreviewStoreId(store.id)}
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
                {/* 1. TÍTULO (Esquerda) */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <h5 className="preview-title" style={{ margin: 0, padding: 0 }}>
                    Todos os Jogos
                    <span className="preview-title-count">6</span>
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
                    className="preview-alphabet-container"
                    style={{
                      '--base-r': r,
                      '--base-g': g,
                      '--base-b': b,
                      '--bg-op': alphabetBgOpacity,
                      '--btn-op': alphabetBtnOpacity,
                      '--txt-color': btnTextColor,
                      '--disabled-txt-color': btnDisabledTextColor,
                      '--active-bg': activeBtnBg,
                      width: alphabetAlignment === 'fill' ? '100%' : 'auto',
                      justifyContent: alphabetAlignment === 'fill' ? 'space-between' : 'center'
                    } as React.CSSProperties}
                  >
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((char) => {
                      const isActive = char === activePreviewLetter
                      let btnClass = 'preview-alphabet-btn'
                      if (isActive) btnClass += ' preview-alphabet-btn--active'
                      return (
                        <div 
                          key={char} 
                          className={btnClass}
                          onClick={() => setActivePreviewLetter(char)}
                          style={{ cursor: 'pointer' }}
                        >
                          {char}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 3. GAMES GRID */}
              <div className="preview-games-grid">
                {previewGames.map((game) => (
                  <div key={game.id} className={`preview-game-card ${hideIconsMouse ? 'gamepad' : ''}`}>
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
                Personalize o alinhamento e transparência das letras
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
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Transparência do Fundo
              </span>

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

              {/* Slider 2: Fundo das Letras */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#fff', fontSize: '12px' }}>Opacidade do Fundo das Letras</span>
                  <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(alphabetBtnOpacity * 100)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={alphabetBtnOpacity}
                    onChange={(e) => handleAlphabetBtnOpacityChange(Number(e.target.value))}
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

            {/* Divisor Sutil */}
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Sub-seção 3: Alterar Cores */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Alterar cores do filtro
              </span>

              {/* Hex Input and Color Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    gap: '10px',
                    width: '150px'
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      backgroundColor: alphabetColor,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      flexShrink: 0
                    }}
                  />
                  <input
                    type="text"
                    value={alphabetColor}
                    onChange={(e) => handleHexChange(e.target.value)}
                    placeholder="#ffffff"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                      width: '100%',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              {/* RGB / Alpha Box Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Labels Row */}
                <div style={{ display: 'flex', gap: '10px', paddingLeft: '4px' }}>
                  <span style={{ flex: 1, fontSize: '11px', color: '#8a9bb0', textAlign: 'center' }}>R</span>
                  <span style={{ flex: 1, fontSize: '11px', color: '#8a9bb0', textAlign: 'center' }}>G</span>
                  <span style={{ flex: 1, fontSize: '11px', color: '#8a9bb0', textAlign: 'center' }}>B</span>
                  <span style={{ flex: 1, fontSize: '11px', color: '#8a9bb0', textAlign: 'center' }}>A</span>
                  <div style={{ width: '28px' }} /> {/* Spacer */}
                </div>
                {/* Inputs Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgbValues.r}
                    onChange={(e) => handleRgbFieldChange('r', e.target.value)}
                    style={{
                      flex: 1,
                      height: '32px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgbValues.g}
                    onChange={(e) => handleRgbFieldChange('g', e.target.value)}
                    style={{
                      flex: 1,
                      height: '32px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgbValues.b}
                    onChange={(e) => handleRgbFieldChange('b', e.target.value)}
                    style={{
                      flex: 1,
                      height: '32px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(alphabetBgOpacity * 100)}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                      handleAlphabetBgOpacityChange(val / 100)
                    }}
                    style={{
                      flex: 1,
                      height: '32px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  {/* Colored Alpha Overlay Preview */}
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: `repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px`,
                      position: 'relative',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '5px',
                        backgroundColor: `rgba(${rgbValues.r}, ${rgbValues.g}, ${rgbValues.b}, ${alphabetBgOpacity})`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Hue Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Matiz (Hue)</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hslValues.h}
                    onChange={(e) => handleHueSliderChange(Number(e.target.value))}
                    className="color-picker-range hue-picker-range"
                    style={{
                      '--thumb-color': alphabetColor,
                      '--thumb-border-color': alphabetColor
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Lightness Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Luminosidade (Escuro a Claro)</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hslValues.l}
                    onChange={(e) => handleLightnessSliderChange(Number(e.target.value))}
                    className="color-picker-range lightness-picker-range"
                    style={{
                      '--lightness-track-bg': `linear-gradient(to right, #000000, ${pureColorHex}, #ffffff)`,
                      '--thumb-color': alphabetColor,
                      '--thumb-border-color': alphabetColor
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Grayscale Slider (White -> Grey -> Black) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Tons Neutros (Branco a Preto)</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={currentGrayscaleValue}
                    onChange={(e) => handleGrayscaleSliderChange(Number(e.target.value))}
                    className="color-picker-range grayscale-picker-range"
                    style={{
                      '--thumb-color': alphabetColor,
                      '--thumb-border-color': alphabetColor
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Alpha Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Opacidade do Fundo (Alpha)</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={alphabetBgOpacity}
                    onChange={(e) => handleAlphabetBgOpacityChange(Number(e.target.value))}
                    className="color-picker-range alpha-picker-range"
                    style={{
                      '--alpha-track-bg': `linear-gradient(to right, rgba(${rgbValues.r}, ${rgbValues.g}, ${rgbValues.b}, 0), rgb(${rgbValues.r}, ${rgbValues.g}, ${rgbValues.b})), repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 10px 10px`,
                      '--thumb-color': `rgba(${rgbValues.r}, ${rgbValues.g}, ${rgbValues.b}, ${alphabetBgOpacity})`,
                      '--thumb-border-color': alphabetColor
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
