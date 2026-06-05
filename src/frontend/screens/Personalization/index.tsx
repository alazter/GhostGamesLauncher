import React, { useState, useEffect, useContext, useMemo } from 'react'
import ContextProvider from 'frontend/state/ContextProvider'
import './index.css'

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

  const [alphabetBtnOpacity, setAlphabetBtnOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  const [alphabetColor, setAlphabetColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_color')
    return saved !== null ? saved : '#ffffff'
  })

  // ==============================================================
  // ESTADOS DE CUSTOMIZAÇÃO DAS LOJAS
  // ==============================================================
  const [rightPanelMode, setRightPanelMode] = useState<'default' | 'storeButtons'>('default')

  const [storeBtnBgColor, setStoreBtnBgColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_store_btn_bg_color')
    return saved !== null ? saved : '#ffffff'
  })

  const [storeBtnBgOpacity, setStoreBtnBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_bg_opacity')
    return saved !== null ? Number(saved) : 0.03
  })

  const [storeBtnHoverOpacity, setStoreBtnHoverOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_hover_opacity')
    return saved !== null ? Number(saved) : 0.06
  })

  const [storeBtnActiveOpacity, setStoreBtnActiveOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_active_opacity')
    return saved !== null ? Number(saved) : 0.25
  })

  const [storeBtnBorderRadius, setStoreBtnBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_store_btn_border_radius')
    return saved !== null ? Number(saved) : 12
  })

  const [storeBtnGradientEnabled, setStoreBtnGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_gradient_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [storeBtnBgColor2, setStoreBtnBgColor2] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_store_btn_bg_color_2')
    return saved !== null ? saved : '#e08a1e'
  })

  const [activeStoreColorTab, setActiveStoreColorTab] = useState<'color1' | 'color2'>('color1')

  const [storeBtnBorderEnabled, setStoreBtnBorderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_border_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
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
  const handleHexChange = (val: string) => {
    setAlphabetColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_alphabet_color', val)
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

  const handleStoreHexChange = (val: string) => {
    setStoreBtnBgColor(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_bg_color', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreHexChange2 = (val: string) => {
    setStoreBtnBgColor2(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      localStorage.setItem('heroic_store_btn_bg_color_2', val)
      window.dispatchEvent(new Event('heroicSettingsChanged'))
    }
  }

  const handleStoreGradientToggle = (val: boolean) => {
    setStoreBtnGradientEnabled(val)
    localStorage.setItem('heroic_store_btn_gradient_enabled', JSON.stringify(val))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreBorderToggle = (val: boolean) => {
    setStoreBtnBorderEnabled(val)
    localStorage.setItem('heroic_store_btn_border_enabled', JSON.stringify(val))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }



  const handleStoreBgOpacityChange = (val: number) => {
    setStoreBtnBgOpacity(val)
    localStorage.setItem('heroic_store_btn_bg_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreHoverOpacityChange = (val: number) => {
    setStoreBtnHoverOpacity(val)
    localStorage.setItem('heroic_store_btn_hover_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreActiveOpacityChange = (val: number) => {
    setStoreBtnActiveOpacity(val)
    localStorage.setItem('heroic_store_btn_active_opacity', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleStoreBorderRadiusChange = (val: number) => {
    setStoreBtnBorderRadius(val)
    localStorage.setItem('heroic_store_btn_border_radius', val.toString())
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }
  // ==============================================================

  const rgbValues = hexToRgb(alphabetColor)
  const hslValues = rgbToHsl(rgbValues.r, rgbValues.g, rgbValues.b)

  const storeRgb = hexToRgb(storeBtnBgColor)
  const storeHsl = rgbToHsl(storeRgb.r, storeRgb.g, storeRgb.b)
  const storeRgb2 = hexToRgb(storeBtnBgColor2)
  const storeHsl2 = rgbToHsl(storeRgb2.r, storeRgb2.g, storeRgb2.b)

  const isEditingColor2 = storeBtnGradientEnabled && activeStoreColorTab === 'color2'
  const currentEditingColor = isEditingColor2 ? storeBtnBgColor2 : storeBtnBgColor
  const currentEditingHsl = isEditingColor2 ? storeHsl2 : storeHsl
  const currentEditingHandler = isEditingColor2 ? handleStoreHexChange2 : handleStoreHexChange
  
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
          border-color: rgba(230, 126, 34, 0.4);
          background-color: rgba(255, 255, 255, 0.02);
        }
        .preview-platforms-bar--selected {
          border-color: rgba(230, 126, 34, 0.8) !important;
          background-color: rgba(230, 126, 34, 0.04) !important;
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
        .preview-platform-btn::before {
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

        .preview-platform-btn:hover::before {
          opacity: 1 !important;
        }

        .preview-platform-btn--active {
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

        .preview-platform-btn--active:hover {
          transform: translate3d(0, 0, 0) scale(1.1) !important;
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
          background: linear-gradient(135deg, var(--store-btn-active-bg-start, rgba(20, 24, 30, 0.6)) 0%, var(--store-btn-active-bg-end, rgba(230, 126, 34, 0.06)) 100%) padding-box, linear-gradient(135deg, var(--store-btn-active-border-start, rgba(255, 255, 255, 0.2)) 0%, var(--store-btn-active-border-end, rgba(230, 126, 34, 0.95)) 100%) border-box !important;
          border: 2px solid transparent !important;
          background-clip: padding-box, border-box !important;
          background-origin: padding-box, border-box !important;
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 3px 10px 0 var(--store-btn-shadow-color, rgba(230, 126, 34, 0.25)), inset 0 0 4px rgba(255, 255, 255, 0.1) !important;
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
            <div 
              className="preview-library-container"
              onClick={() => setRightPanelMode('default')}
            >
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
                <div 
                  className={`preview-platforms-bar ${rightPanelMode === 'storeButtons' ? 'preview-platforms-bar--selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRightPanelMode('storeButtons');
                  }}
                  style={{
                    '--store-btn-border-radius': `${storeBtnBorderRadius}px`,
                    '--store-btn-border-width': storeBtnBorderEnabled ? '1px' : '0px',
                    '--store-btn-bg': storeBtnGradientEnabled
                      ? `linear-gradient(135deg, rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnBgOpacity}) 0%, rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${storeBtnBgOpacity}) 100%)`
                      : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnBgOpacity})`,
                    '--store-btn-border-color': storeBtnBorderEnabled
                      ? `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(1, storeBtnBgOpacity * 2.5)})`
                      : 'transparent',
                    '--store-btn-hover-bg': storeBtnGradientEnabled
                      ? `linear-gradient(135deg, rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnHoverOpacity}) 0%, rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${storeBtnHoverOpacity}) 100%)`
                      : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnHoverOpacity})`,
                    '--store-btn-hover-border-color': storeBtnBorderEnabled
                      ? `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(1, storeBtnHoverOpacity * 2.5)})`
                      : 'transparent',
                    '--store-btn-active-bg-start': `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnActiveOpacity})`,
                    '--store-btn-active-bg-end': storeBtnGradientEnabled
                      ? `rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${storeBtnActiveOpacity})`
                      : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnActiveOpacity})`,
                    '--store-btn-active-border-start': `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(0.85, storeBtnActiveOpacity * 2)})`,
                    '--store-btn-active-border-end': storeBtnGradientEnabled
                      ? `rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${Math.min(0.85, storeBtnActiveOpacity * 2)})`
                      : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(0.85, storeBtnActiveOpacity * 2)})`,
                    '--store-btn-shadow-color': `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, 0.2)`,
                    '--store-btn-backdrop-filter': storeBtnBgOpacity === 0 ? 'none' : 'blur(12px)',
                    '--store-btn-hover-backdrop-filter': storeBtnHoverOpacity === 0 ? 'none' : 'blur(12px)'
                  } as React.CSSProperties}
                >
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
                      '--store-btn-active-bg-start': `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnActiveOpacity})`,
                      '--store-btn-active-bg-end': storeBtnGradientEnabled
                        ? `rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${storeBtnActiveOpacity})`
                        : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnActiveOpacity})`,
                      '--store-btn-active-border-start': `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(0.85, storeBtnActiveOpacity * 2)})`,
                      '--store-btn-active-border-end': storeBtnGradientEnabled
                        ? `rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${Math.min(0.85, storeBtnActiveOpacity * 2)})`
                        : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(0.85, storeBtnActiveOpacity * 2)})`,
                      '--store-btn-shadow-color': `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, 0.2)`,
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

                {/*                {/* Sub-seção 3: Alterar Cores */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Alterar cores do filtro
                  </span>

                  {/* 2D SV Box */}
                  <SVBox hexColor={alphabetColor} onChange={handleHexChange} />

                  {/* Hue Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hslValues.h}
                        onChange={(e) => {
                          const hVal = Number(e.target.value)
                          const rgbValues = hexToRgb(alphabetColor)
                          const hsvValues = rgbToHsv(rgbValues.r, rgbValues.g, rgbValues.b)
                          const newRgb = hsvToRgb(hVal, hsvValues.s, hsvValues.v)
                          const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                          setAlphabetColor(hex)
                          localStorage.setItem('heroic_alphabet_color', hex)
                          window.dispatchEvent(new Event('heroicSettingsChanged'))
                        }}
                        className="color-picker-range hue-picker-range"
                        style={{
                          '--thumb-color': alphabetColor,
                          '--thumb-border-color': alphabetColor
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
                        value={alphabetColor.replace('#', '')}
                        onChange={(e) => handleHexChange('#' + e.target.value)}
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
                          backgroundColor: alphabetColor,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          flexShrink: 0
                        }}
                      />
                    </div>
                  </div>

                  {/* Opacidade do Fundo (Alpha) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff' }}>Opacidade do Fundo (Alpha)</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(alphabetBgOpacity * 100)}%</span>
                    </div>
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
            </>
          ) : (
            <>
              {/* SEÇÃO 1: PERSONALIZAÇÃO DAS LOJAS */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={styles.sectionTitle}>PERSONALIZAÇÃO DAS LOJAS</span>
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

              {/* Controles das Lojas */}
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
                    Personalize a cor, opacidade e o arredondamento das bordas
                  </span>
                </div>

                {/* Sub-seção 1: Arredondamento */}
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

                {/* Divisor Sutil */}
                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                {/* Sub-seção 3: Cores */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {storeBtnGradientEnabled ? 'Configuração de Cores' : 'Alterar cor de fundo'}
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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#8a9bb0' }}>Borda do Botão</span>
                      <label className="premium-switch" style={{ cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={storeBtnBorderEnabled}
                          onChange={(e) => handleStoreBorderToggle(e.target.checked)}
                        />
                        <span className="premium-slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* Tabs de seleção de cores em caso de degrade ativo */}
                  {storeBtnGradientEnabled && (
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
                          gap: '6px',
                          outline: 'none'
                        }}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeBtnBgColor, border: '1px solid rgba(255,255,255,0.3)' }} />
                        Cor Inicial
                      </button>
                      <button
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
                          gap: '6px',
                          outline: 'none'
                        }}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: storeBtnBgColor2, border: '1px solid rgba(255,255,255,0.3)' }} />
                        Cor Final
                      </button>
                    </div>
                  )}

                  {/* 2D SV Box */}
                  <SVBox hexColor={currentEditingColor} onChange={currentEditingHandler} />

                  {/* Hue Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={currentEditingHsl.h}
                        onChange={(e) => {
                          const hVal = Number(e.target.value)
                          const rgbVal = hexToRgb(currentEditingColor)
                          const hsvVal = rgbToHsv(rgbVal.r, rgbVal.g, rgbVal.b)
                          const newRgb = hsvToRgb(hVal, hsvVal.s, hsvVal.v)
                          const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                          currentEditingHandler(hex)
                        }}
                        className="color-picker-range hue-picker-range"
                        style={{
                          '--thumb-color': currentEditingColor,
                          '--thumb-border-color': currentEditingColor
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
                        value={currentEditingColor.replace('#', '')}
                        onChange={(e) => currentEditingHandler('#' + e.target.value)}
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
                          backgroundColor: currentEditingColor,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          flexShrink: 0
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Divisor Sutil */}
                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                {/* Sub-seção 2: Transparência */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Slider 1: Opacidade do Fundo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff' }}>Opacidade do Fundo (Alpha)</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(storeBtnBgOpacity * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={storeBtnBgOpacity}
                        onChange={(e) => handleStoreBgOpacityChange(Number(e.target.value))}
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

                  {/* Slider 2: Opacidade no Hover */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff' }}>Opacidade no Hover</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(storeBtnHoverOpacity * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={storeBtnHoverOpacity}
                        onChange={(e) => handleStoreHoverOpacityChange(Number(e.target.value))}
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

                  {/* Slider 3: Opacidade Selecionada */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#fff' }}>Opacidade Selecionada (Alpha)</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{Math.round(storeBtnActiveOpacity * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '20px', paddingTop: '10px', paddingBottom: '10px' }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={storeBtnActiveOpacity}
                        onChange={(e) => handleStoreActiveOpacityChange(Number(e.target.value))}
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
          )}
        </div>
      </div>
    </div>
  )
}
