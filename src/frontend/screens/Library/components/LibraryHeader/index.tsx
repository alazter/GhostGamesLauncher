import { memo, useContext, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GameInfo } from 'common/types'
import LibraryContext from '../../LibraryContext'
import AlphabetFilter from '../AlphabetFilter'
import './index.css'

type Props = {
  list: GameInfo[]
}

export default memo(function LibraryHeader({ list }: Props) {
  const { t } = useTranslation()
  const { showFavourites, showAlphabetFilter, showUnclassifiedOnly } = useContext(LibraryContext)

  const [alignment, setAlignment] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_alignment') || 'center'
  })

  // Alphabet styling synchronization
  const [btnBgOpacity, setBtnBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  const [btnBgColor, setBtnBgColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_color')
    return saved !== null ? saved : '#ffffff'
  })

  const [btnBgColor2, setBtnBgColor2] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_bg_color_2')
    return saved !== null ? saved : '#00e5ff'
  })

  const [btnGradientEnabled, setBtnGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_gradient_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [btnBorderEnabled, setBtnBorderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_enabled')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [btnBorderRadius, setBtnBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_radius')
    return saved !== null ? Number(saved) : 18
  })

  useEffect(() => {
    const handleSettingsChange = () => {
      setAlignment(localStorage.getItem('heroic_alphabet_alignment') || 'center')

      const savedBtn = localStorage.getItem('heroic_alphabet_btn_opacity')
      setBtnBgOpacity(savedBtn !== null ? Number(savedBtn) : 0.05)

      const savedColor = localStorage.getItem('heroic_alphabet_color')
      setBtnBgColor(savedColor !== null ? savedColor : '#ffffff')

      const savedColor2 = localStorage.getItem('heroic_alphabet_btn_bg_color_2')
      setBtnBgColor2(savedColor2 !== null ? savedColor2 : '#00e5ff')

      const savedGrad = localStorage.getItem('heroic_alphabet_btn_gradient_enabled')
      setBtnGradientEnabled(savedGrad !== null ? (JSON.parse(savedGrad) as boolean) : false)

      const savedBrd = localStorage.getItem('heroic_alphabet_btn_border_enabled')
      setBtnBorderEnabled(savedBrd !== null ? (JSON.parse(savedBrd) as boolean) : false)

      const savedRadius = localStorage.getItem('heroic_alphabet_btn_border_radius')
      setBtnBorderRadius(savedRadius !== null ? Number(savedRadius) : 18)
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () => window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [])

  const numberOfGames = useMemo(() => {
    if (!list) return 0
    const dlcCount = list.filter(
      (lib) => lib.runner !== 'sideload' && lib.install.is_dlc
    ).length
    const total = list.length - dlcCount
    return total > 0 ? `${total}` : 0
  }, [list])

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

  const badgeBg = btnGradientEnabled
    ? `linear-gradient(135deg, rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnBgOpacity}) 0%, rgba(${alphabetRgb2.r}, ${alphabetRgb2.g}, ${alphabetRgb2.b}, ${btnBgOpacity}) 100%)`
    : `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnBgOpacity})`

  const badgeBorder = btnBorderEnabled
    ? `1px solid rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${Math.min(1, btnBgOpacity * 2.5)})`
    : 'none'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        paddingTop: '6px',
        paddingBottom: '10px',
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
              : t('title.allGames', 'All Games')}
            <span
              className="numberOfgames"
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
                background: badgeBg,
                border: badgeBorder,
                color: btnTextColor,
                backdropFilter: btnBgOpacity === 0 ? 'none' : 'blur(12px)',
                WebkitBackdropFilter: btnBgOpacity === 0 ? 'none' : 'blur(12px)',
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
