import { useContext, useMemo, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ContextProvider from 'frontend/state/ContextProvider'
import { GameInfo, Runner } from 'common/types'
import SearchBar from '../SearchBar'
import { useTranslation } from 'react-i18next'
import LibraryContext from 'frontend/screens/Library/LibraryContext'
import { normalizeTitle } from 'frontend/helpers/library'
import AddGameButton from 'frontend/screens/Library/components/AddGameButton'
import ActionIcons from 'frontend/components/UI/ActionIcons'
import './index.css'

function fixFilter(text: string) {
  const regex = new RegExp(/([?\\|*|+|(|)|[|]|])+/, 'g')
  return text.replaceAll(regex, '')
}

const RUNNER_TO_STORE: Partial<Record<Runner, string>> = {
  legendary: 'Epic',
  gog: 'GOG',
  nile: 'Amazon',
  zoom: 'Zoom'
}

const DISPLAY_MODE: string = 'icon-text'

// const BRAND_COLORS: Record<string, string> = {
//   steam: '#1b2838',
//   epic: '#333333',
//   gog: '#5c2d91',
//   amazon: '#232f3e',
//   zoom: '#009aeb',
//   sideloaded: '#555555',
//   xbox: '#107c10',
//   ubisoft: '#000000',
//   ea: '#f56c2d',
// }


interface CustomStore {
  id: string
  name: string
  icon: string | null
  isVisible?: boolean
}

export default function LibrarySearchBar({ children, isUnclassifiedActive }: { children?: ReactNode; isUnclassifiedActive?: boolean }) {
  const { epic, gog, sideloadedLibrary, amazon, zoom } =
    useContext(ContextProvider)
  const { handleSearch, filterText } = useContext(LibraryContext)
  const navigate = useNavigate()
  const { t } = useTranslation()

  // =========================================================
  // SISTEMA DINÂMICO DE LOJAS E FILTRO ATIVO
  // =========================================================
  const [customStores, setCustomStores] = useState<CustomStore[]>(() => {
    const saved = localStorage.getItem('heroic_custom_stores')
    if (saved) return JSON.parse(saved) as CustomStore[]

    return [
      { id: 'epic', name: 'Epic Games', icon: null, isVisible: true },
      { id: 'gog', name: 'GOG', icon: null, isVisible: true },
      { id: 'amazon', name: 'Amazon', icon: null, isVisible: true },
      { id: 'zoom', name: 'Zoom', icon: null, isVisible: true },
      { id: 'sideloaded', name: 'Sideloaded', icon: null, isVisible: true },
      { id: 'steam', name: 'Steam', icon: null, isVisible: true }
    ]
  })

  // Estado que guarda qual loja está clicada no momento
  const [activeFilter, setActiveFilter] = useState<string | null>(() => {
    return localStorage.getItem('heroic_active_store_filter')
  })

  const [hideSearchSuggestions, setHideSearchSuggestions] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_search_suggestions')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [storeBtnBgColor, setStoreBtnBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_store_btn_bg_color') || '#ffffff'
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
    return localStorage.getItem('heroic_store_btn_bg_color_2') || '#e08a1e'
  })

  const [storeBtnBorderEnabled, setStoreBtnBorderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_store_btn_border_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })

  useEffect(() => {
    const handleStoresChange = () => {
      const saved = localStorage.getItem('heroic_custom_stores')
      if (saved) setCustomStores(JSON.parse(saved) as CustomStore[])
    }
    window.addEventListener('customStoresChanged', handleStoresChange)
    return () =>
      window.removeEventListener('customStoresChanged', handleStoresChange)
  }, [])

  useEffect(() => {
    const handleSettingsChange = () => {
      const saved = localStorage.getItem('heroic_hide_search_suggestions')
      setHideSearchSuggestions(saved !== null ? (JSON.parse(saved) as boolean) : false)

      setStoreBtnBgColor(localStorage.getItem('heroic_store_btn_bg_color') || '#ffffff')
      
      const bgOpacitySaved = localStorage.getItem('heroic_store_btn_bg_opacity')
      setStoreBtnBgOpacity(bgOpacitySaved !== null ? Number(bgOpacitySaved) : 0.03)

      const hoverOpacitySaved = localStorage.getItem('heroic_store_btn_hover_opacity')
      setStoreBtnHoverOpacity(hoverOpacitySaved !== null ? Number(hoverOpacitySaved) : 0.06)

      const borderRadiusSaved = localStorage.getItem('heroic_store_btn_border_radius')
      setStoreBtnBorderRadius(borderRadiusSaved !== null ? Number(borderRadiusSaved) : 12)

      const gradientEnabledSaved = localStorage.getItem('heroic_store_btn_gradient_enabled')
      setStoreBtnGradientEnabled(gradientEnabledSaved !== null ? (JSON.parse(gradientEnabledSaved) as boolean) : false)

      setStoreBtnBgColor2(localStorage.getItem('heroic_store_btn_bg_color_2') || '#e08a1e')

      const borderEnabledSaved = localStorage.getItem('heroic_store_btn_border_enabled')
      setStoreBtnBorderEnabled(borderEnabledSaved !== null ? (JSON.parse(borderEnabledSaved) as boolean) : true)

      const activeOpacitySaved = localStorage.getItem('heroic_store_btn_active_opacity')
      setStoreBtnActiveOpacity(activeOpacitySaved !== null ? Number(activeOpacitySaved) : 0.25)
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () =>
      window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [])

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
  const storeRgb = hexToRgb(storeBtnBgColor)
  const storeRgb2 = hexToRgb(storeBtnBgColor2)

  // Função que é disparada ao clicar numa loja
  const handleFilterClick = (storeId: string) => {
    const newFilter = activeFilter === storeId ? null : storeId // Se clicar na mesma, desmarca
    setActiveFilter(newFilter)

    if (newFilter) {
      localStorage.setItem('heroic_active_store_filter', newFilter)
    } else {
      localStorage.removeItem('heroic_active_store_filter')
    }

    // Grita para a lista de jogos atualizar
    window.dispatchEvent(new Event('heroicFilterChanged'))
  }
  // =========================================================

  const normalizedFilterText = useMemo(
    () => normalizeTitle(fixFilter(filterText)),
    [filterText]
  )

  const list = useMemo(() => {
    return [
      ...(epic.library ?? []),
      ...(gog.library ?? []),
      ...(sideloadedLibrary ?? []),
      ...(amazon.library ?? []),
      ...(zoom.library ?? [])
    ]
      .filter(Boolean)
      .filter((el) => {
        return (
          !el.install.is_dlc &&
          normalizeTitle(el.title).includes(normalizedFilterText)
        )
      })
      .sort((g1, g2) => (g1.title < g2.title ? -1 : 1))
  }, [
    amazon.library,
    epic.library,
    gog.library,
    sideloadedLibrary,
    zoom.library,
    normalizedFilterText
  ])

  const handleClick = (game: GameInfo) => {
    handleSearch('')
    navigate(`/gamepage/${game.runner}/${game.app_name}`, {
      state: { gameInfo: game }
    })
  }

  const suggestions = list.map((game) => (
    <li onClick={() => handleClick(game)} key={game.app_name}>
      {game.overrides?.title || game.title}{' '}
      <span>({RUNNER_TO_STORE[game.runner] || game.runner})</span>
    </li>
  ))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* A MÁGICA 1: Mantive a barra de pesquisa fixa em 450px 
        para que o campo de busca de jogos tenha bastante espaço! 
      */}
      <style>
        {`
          [data-tour="library-search"] { width: 450px !important; min-width: 450px !important; flex-grow: 0 !important; }
          [data-tour="library-search"] > div { width: 100% !important; max-width: 100% !important; }
        `}
      </style>

      {/* A MÁGICA 2: justify-content: 'flex-start' garante que todos 
        fiquem colados à esquerda, um após o outro.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '15px',
          width: '100%'
        }}
      >
        <div data-tour="library-search" style={isUnclassifiedActive ? { pointerEvents: 'none', opacity: 0.4 } : undefined}>
          <SearchBar
            suggestionsListItems={hideSearchSuggestions ? [] : suggestions}
            onInputChanged={(text) => handleSearch(text)}
            value={filterText}
            placeholder={t('search', 'Search for Games')}
          />
        </div>

        {/* A MÁGICA 3: Tirei o "marginLeft: auto" que jogava eles pra longe */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
            ...(isUnclassifiedActive ? { pointerEvents: 'none', opacity: 0.4 } : {})
          }}
        >
          <AddGameButton data-tour="library-add-game" />
          <ActionIcons />
        </div>

        {/* Inject Header__filters here so it stays on the right */}
        {children}
      </div>

      {/* BARRA DE PLATAFORMAS INTERATIVA */}
      <div
        className="platforms-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          gap: '12px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          ...(isUnclassifiedActive ? { pointerEvents: 'none', opacity: 0.4 } : {}),
          '--store-btn-border-radius': `${storeBtnBorderRadius}px`,
          '--store-btn-border-width': storeBtnBorderEnabled ? '1px' : '0px',
          '--store-btn-bg': storeBtnGradientEnabled
            ? `linear-gradient(135deg, rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnBgOpacity}) 0%, rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${storeBtnBgOpacity}) 100%)`
            : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnBgOpacity})`,
          '--store-btn-hover-bg': storeBtnGradientEnabled
            ? `linear-gradient(135deg, rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnHoverOpacity}) 0%, rgba(${storeRgb2.r}, ${storeRgb2.g}, ${storeRgb2.b}, ${storeBtnHoverOpacity}) 100%)`
            : `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${storeBtnHoverOpacity})`,
          '--store-btn-border-color': storeBtnBorderEnabled
            ? `rgba(${storeRgb.r}, ${storeRgb.g}, ${storeRgb.b}, ${Math.min(1, storeBtnBgOpacity * 2.5)})`
            : 'transparent',
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
        {customStores
          .filter((store) => store.isVisible !== false)
          .map((store) => {
            const imageSource = store.icon
              ? store.icon
              : `/images/${store.id}.png`
            const isActive = activeFilter === store.id

            return (
              <button
                key={store.id}
                onClick={() => handleFilterClick(store.id)}
                className={`platform-filter-btn ${
                  isActive ? 'platform-filter-btn--active' : ''
                }`}
              >
                {(DISPLAY_MODE === 'icon-text' ||
                  DISPLAY_MODE === 'icon-only') && (
                  <img
                    src={imageSource}
                    alt={store.name}
                    className="platform-filter-icon-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                {(DISPLAY_MODE === 'icon-text' ||
                  DISPLAY_MODE === 'text-only') && <span>{store.name}</span>}
              </button>
            )
          })}
      </div>
    </div>
  )
}
