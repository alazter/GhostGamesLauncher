import { memo, useContext, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GameInfo } from 'common/types'
import { CustomStore } from 'frontend/types'
import LibraryContext from '../../LibraryContext'
import AlphabetFilter from '../AlphabetFilter'
import useSetting from 'frontend/hooks/useSetting'
import {
  isGameAssignedToStore,
  isGameVisibleInAllGames,
  isPlaytestOrDemo
} from 'frontend/helpers/customStoreFiltering'
import { DEFAULT_GHOST_CUSTOM_STORES } from 'frontend/helpers/defaultCustomStores'
import './index.css'

type Props = {
  list: GameInfo[]
  fullList?: GameInfo[]
}

export default memo(function LibraryHeader({ list, fullList }: Props) {
  const { t } = useTranslation()
  const {
    showFavourites,
    showAlphabetFilter,
    showUnclassifiedOnly,
    sortByNewlyAdded,
    sortByMostPlayed,
    storesFilters,
    filterText
  } = useContext(LibraryContext)

  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(
    () => localStorage.getItem('heroic_active_store_filter')
  )
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    return JSON.parse(
      localStorage.getItem('heroic_game_assignments') || '{}'
    ) as Record<string, string>
  })
  const [customStores, setCustomStores] = useState<CustomStore[]>(() => {
    const saved = localStorage.getItem('heroic_custom_stores')
    return saved ? (JSON.parse(saved) as CustomStore[]) : DEFAULT_GHOST_CUSTOM_STORES
  })

  const [showPlaytestsAndDemos, setShowPlaytestsAndDemos] = useState<boolean>(() => {
    return localStorage.getItem('heroic_show_playtests_demos') === 'true'
  })

  const [alignment, setAlignment] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_alignment') || 'fill'
  })

  // Alphabet styling synchronization
  const [btnBgOpacity, setBtnBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_opacity') ?? localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  const [btnBgColor, setBtnBgColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_color_1') || localStorage.getItem('heroic_alphabet_color')
    return saved !== null ? saved : '#ffffff'
  })

  const [btnBgColor2, setBtnBgColor2] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_color_2') || localStorage.getItem('heroic_alphabet_btn_bg_color_2')
    return saved !== null ? saved : '#00e5ff'
  })

  const [btnGradientEnabled, setBtnGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_default_bg_gradient') ?? localStorage.getItem('heroic_alphabet_btn_gradient_enabled')
    return saved !== null ? saved === 'true' || saved === '1' : false
  })

  const [btnBorderEnabled, setBtnBorderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [btnBorderRadius, setBtnBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_radius')
    return saved !== null ? Number(saved) : 18
  })

  const [alphabetGlowMode, setAlphabetGlowMode] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_glow_mode') || 'disabled'
  })

  const [alphabetColor1, setAlphabetColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_color_1') || localStorage.getItem('heroic_alphabet_color') || '#00ffff'
  })

  const [alphabetColor2, setAlphabetColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_color_2') || '#38d9e6'
  })

  const [alphabetGradEnabled, setAlphabetGradEnabled] = useState<boolean>(() => {
    return localStorage.getItem('heroic_alphabet_gradient') === 'true'
  })

  const [alphabetGlowColor1, setAlphabetGlowColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_glow_color_1') || '#00ffff'
  })

  const [alphabetGlowStrength, setAlphabetGlowStrength] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_alphabet_glow_strength') || '8')
  })

  useEffect(() => {
    const handleSettingsChange = () => {
      setAlignment(localStorage.getItem('heroic_alphabet_alignment') || 'center')

      const savedBtn = localStorage.getItem('heroic_alphabet_btn_default_bg_opacity') ?? localStorage.getItem('heroic_alphabet_btn_opacity')
      setBtnBgOpacity(savedBtn !== null ? Number(savedBtn) : 0.05)

      const savedColor = localStorage.getItem('heroic_alphabet_btn_default_bg_color_1') || localStorage.getItem('heroic_alphabet_color')
      setBtnBgColor(savedColor !== null ? savedColor : '#ffffff')

      const savedColor2 = localStorage.getItem('heroic_alphabet_btn_default_bg_color_2') || localStorage.getItem('heroic_alphabet_btn_bg_color_2')
      setBtnBgColor2(savedColor2 !== null ? savedColor2 : '#00e5ff')

      const savedGrad = localStorage.getItem('heroic_alphabet_btn_default_bg_gradient') ?? localStorage.getItem('heroic_alphabet_btn_gradient_enabled')
      setBtnGradientEnabled(savedGrad !== null ? savedGrad === 'true' || savedGrad === '1' : false)

      const savedBrd = localStorage.getItem('heroic_alphabet_btn_border_enabled')
      setBtnBorderEnabled(savedBrd !== null ? (JSON.parse(savedBrd) as boolean) : false)

      const savedRadius = localStorage.getItem('heroic_alphabet_btn_border_radius')
      setBtnBorderRadius(savedRadius !== null ? Number(savedRadius) : 18)

      setAlphabetGlowMode(localStorage.getItem('heroic_alphabet_glow_mode') || 'disabled')
      setAlphabetColor1(localStorage.getItem('heroic_alphabet_color_1') || localStorage.getItem('heroic_alphabet_color') || '#00ffff')
      setAlphabetColor2(localStorage.getItem('heroic_alphabet_color_2') || '#38d9e6')
      setAlphabetGradEnabled(localStorage.getItem('heroic_alphabet_gradient') === 'true')
      setAlphabetGlowColor1(localStorage.getItem('heroic_alphabet_glow_color_1') || '#00ffff')
      setAlphabetGlowStrength(Number(localStorage.getItem('heroic_alphabet_glow_strength') || '8'))
    }

    const handleFilterChange = () =>
      setActiveStoreFilter(localStorage.getItem('heroic_active_store_filter'))
    const handleAssignmentsChange = () =>
      setAssignments(
        JSON.parse(
          localStorage.getItem('heroic_game_assignments') || '{}'
        ) as Record<string, string>
      )
    const handleStoresChange = () => {
      const saved = localStorage.getItem('heroic_custom_stores')
      if (saved) setCustomStores(JSON.parse(saved) as CustomStore[])
    }
    const handlePlaytestsChange = () => {
      setShowPlaytestsAndDemos(localStorage.getItem('heroic_show_playtests_demos') === 'true')
    }

    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    window.addEventListener('heroicFilterChanged', handleFilterChange)
    window.addEventListener('gameAssignmentsChanged', handleAssignmentsChange)
    window.addEventListener('customStoresChanged', handleStoresChange)
    window.addEventListener('heroicPlaytestsFilterChanged', handlePlaytestsChange)

    return () => {
      window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
      window.removeEventListener('heroicFilterChanged', handleFilterChange)
      window.removeEventListener(
        'gameAssignmentsChanged',
        handleAssignmentsChange
      )
      window.removeEventListener('customStoresChanged', handleStoresChange)
      window.removeEventListener('heroicPlaytestsFilterChanged', handlePlaytestsChange)
    }
  }, [])

  const [includeHiddenInGameCount] = useSetting(
    'includeHiddenInGameCount',
    false
  )

  const numberOfGames = useMemo(() => {
    const targetList = (includeHiddenInGameCount && fullList) ? fullList : list
    if (!targetList) return 0
    let effectiveList = targetList.filter(
      (lib) => lib.runner === 'sideload' || !lib.install?.is_dlc
    )

    if (filterText && filterText.trim().length > 0) {
      return effectiveList.length > 0 ? `${effectiveList.length}` : 0
    }

    if (!showPlaytestsAndDemos) {
      effectiveList = effectiveList.filter((game) => !isPlaytestOrDemo(game))
    }

    if (activeStoreFilter) {
      const activeFilterLower = activeStoreFilter.toLowerCase()
      const activeStoreObj = customStores.find(
        (s) => s.id.toLowerCase() === activeFilterLower
      ) || {
        id: activeStoreFilter,
        name: activeStoreFilter,
        icon: null,
        isVisible: true
      }

      effectiveList = effectiveList.filter((game) =>
        isGameAssignedToStore(game, activeStoreObj, assignments)
      )
    } else {
      effectiveList = effectiveList.filter((game) =>
        isGameVisibleInAllGames(game, customStores, assignments, storesFilters)
      )
    }

    return effectiveList.length > 0 ? `${effectiveList.length}` : 0
  }, [
    list,
    fullList,
    includeHiddenInGameCount,
    activeStoreFilter,
    customStores,
    assignments,
    storesFilters,
    showPlaytestsAndDemos,
    filterText
  ])

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

  const alphabetRgb = hexToRgb(btnBgColor)
  const alphabetRgb2 = hexToRgb(btnBgColor2)

  const { r, g, b } = alphabetRgb
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const isLightColor = luminance > 140
  const useDarkText = isLightColor && btnBgOpacity > 0.4

  const btnTextColor = useDarkText ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.7)'

  const isZeroBg = btnBgOpacity <= 0.001

  const badgeBg = isZeroBg
    ? 'transparent'
    : btnGradientEnabled
    ? `linear-gradient(135deg, rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnBgOpacity}) 0%, rgba(${alphabetRgb2.r}, ${alphabetRgb2.g}, ${alphabetRgb2.b}, ${btnBgOpacity}) 100%)`
    : `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnBgOpacity})`

  const badgeBorder = isZeroBg
    ? 'none'
    : btnBorderEnabled
    ? `1px solid rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${Math.min(1, btnBgOpacity * 2.5)})`
    : 'none'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        paddingTop: '0px',
        paddingBottom: '4px',
        paddingLeft: '35px',
        gap: '20px',
        position: 'sticky',
        top: 'var(--header-height, 82px)',
        zIndex: 9,
        background: 'transparent'
      }}
    >
      {/* 1. TÍTULO (Esquerda) */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <h5
          className="libraryHeader"
          data-tour="library-header"
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            top: '0px'
          }}
        >
          <span
            className="libraryTitle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: 1
            }}
          >
            {showFavourites
              ? t('favourites', 'Favourites')
              : sortByNewlyAdded
              ? '✨ Adicionados Recentemente'
              : sortByMostPlayed
              ? '⏱️ Mais Jogados'
              : t('title.allGames', 'All Games')}
            <span
              className={`numberOfgames ${alphabetGlowMode === 'neon' ? 'numberOfgames--neon' : ''} ${isZeroBg ? 'numberOfgames--zero-bg' : ''}`}
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
                borderRadius: `${btnBorderRadius}px`,
                background: alphabetGlowMode === 'neon' && alphabetGradEnabled
                  ? `linear-gradient(135deg, ${alphabetColor1} 0%, ${alphabetColor2} 100%)`
                  : badgeBg,
                border: badgeBorder,
                ...(alphabetGlowMode === 'neon' ? (
                  alphabetGradEnabled ? {
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: `drop-shadow(-1.5px -1.5px calc(${alphabetGlowStrength}px * 0.35) ${alphabetGlowColor1}) drop-shadow(1.5px 1.5px calc(${alphabetGlowStrength}px * 0.35) ${alphabetColor2})`
                  } : {
                    color: alphabetColor1,
                    textShadow: `0 0 2px ${alphabetGlowColor1}, 0 0 ${alphabetGlowStrength}px ${alphabetGlowColor1}`
                  }
                ) : {
                  color: btnTextColor
                }),
                backdropFilter: isZeroBg ? 'none' : 'blur(12px)',
                WebkitBackdropFilter: isZeroBg ? 'none' : 'blur(12px)',
                fontFamily: 'inherit',
                fontSize: '15px',
                fontWeight: 600,
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {numberOfGames}
            </span>
          </span>
        </h5>
      </div>

      {/* 2. ALFABETO (Agora esticado por todo o resto do espaço) */}
      <div
        className="custom-alphabet-wrapper"
        style={{
          flexGrow: 1,
          paddingTop: '0px',
          paddingBottom: '0px',
          paddingLeft: alignment === 'left' ? '6px' : '10px',
          paddingRight: '10px',
          '--alphabet-alignment': alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : alignment === 'fill' ? 'space-between' : 'center',
          '--alphabet-padding-left': alignment === 'left' ? '8px' : '12px',
          ...(showUnclassifiedOnly ? { pointerEvents: 'none', opacity: 0.4 } : {})
        } as React.CSSProperties}
      >
        {showAlphabetFilter && <AlphabetFilter />}
      </div>
    </div>
  )
})
