import React, { useContext, useState, useEffect } from 'react'
import './index.css'
import LibraryContext from '../../LibraryContext'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

const AlphabetFilter: React.FC = () => {
  const {
    alphabetFilterLetter: currentFilter,
    setAlphabetFilterLetter: onFilterChange
  } = useContext(LibraryContext)

  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_bg_opacity')
    return saved !== null ? Number(saved) : 0.08
  })

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

  const [btnHoverOpacity, setBtnHoverOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_hover_opacity')
    return saved !== null ? Number(saved) : 0.13
  })

  const [btnActiveOpacity, setBtnActiveOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_active_opacity')
    return saved !== null ? Number(saved) : 0.85
  })

  const [btnBorderRadius, setBtnBorderRadius] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_border_radius')
    return saved !== null ? Number(saved) : 18
  })

  useEffect(() => {
    const handleSettingsChange = () => {
      const savedBg = localStorage.getItem('heroic_alphabet_bg_opacity')
      setBgOpacity(savedBg !== null ? Number(savedBg) : 0.08)

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

      const savedHoverOp = localStorage.getItem('heroic_alphabet_btn_hover_opacity')
      setBtnHoverOpacity(savedHoverOp !== null ? Number(savedHoverOp) : 0.13)

      const savedActiveOp = localStorage.getItem('heroic_alphabet_btn_active_opacity')
      setBtnActiveOpacity(savedActiveOp !== null ? Number(savedActiveOp) : 0.85)

      const savedRadius = localStorage.getItem('heroic_alphabet_btn_border_radius')
      setBtnBorderRadius(savedRadius !== null ? Number(savedRadius) : 18)
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () => window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [])

  const getButtonClassName = (value: string) => {
    let className = 'alphabet-filter-button'
    if (value === currentFilter) {
      className += ' alphabet-filter-button--active'
    }
    return className
  }

  const handleClick = (value: string) => {
    if (value === currentFilter) {
      onFilterChange(null)
    } else {
      onFilterChange(value)
    }
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

  const alphabetRgb = hexToRgb(btnBgColor)
  const alphabetRgb2 = hexToRgb(btnBgColor2)

  const { r, g, b } = alphabetRgb
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const isLightColor = luminance > 140
  const useDarkText = isLightColor && btnBgOpacity > 0.4

  const btnTextColor = useDarkText ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.7)'
  const btnDisabledTextColor = useDarkText ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.2)'
  const btnHoverTextColor = useDarkText ? '#000000' : '#ffffff'

  const activeBtnBg = bgOpacity > 0.4
    ? (isLightColor ? 'rgba(0, 150, 150, 0.85)' : `rgba(${r}, ${g}, ${b}, 0.85)`)
    : 'rgba(0, 255, 255, 0.08)'

  return (
    <div
      className="alphabet-filter-container"
      style={{
        '--alphabet-filter-container-bg-opacity': bgOpacity,
        '--alphabet-filter-base-r': r,
        '--alphabet-filter-base-g': g,
        '--alphabet-filter-base-b': b,
        '--alphabet-backdrop-filter': bgOpacity === 0 ? 'none' : 'blur(12px)',
        
        // Custom button styles:
        '--alphabet-btn-border-radius': `${btnBorderRadius}px`,
        '--alphabet-btn-border-width': btnBorderEnabled ? '1px' : '0px',
        '--alphabet-btn-bg': btnGradientEnabled
          ? `linear-gradient(135deg, rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnBgOpacity}) 0%, rgba(${alphabetRgb2.r}, ${alphabetRgb2.g}, ${alphabetRgb2.b}, ${btnBgOpacity}) 100%)`
          : `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnBgOpacity})`,
        '--alphabet-btn-border-color': btnBorderEnabled
          ? `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${Math.min(1, btnBgOpacity * 2.5)})`
          : 'transparent',
        '--alphabet-btn-hover-bg': btnGradientEnabled
          ? `linear-gradient(135deg, rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnHoverOpacity}) 0%, rgba(${alphabetRgb2.r}, ${alphabetRgb2.g}, ${alphabetRgb2.b}, ${btnHoverOpacity}) 100%)`
          : `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnHoverOpacity})`,
        '--alphabet-btn-hover-border-color': btnBorderEnabled
          ? `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${Math.min(1, btnHoverOpacity * 2.5)})`
          : 'transparent',
        '--alphabet-btn-active-bg-start': `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnActiveOpacity})`,
        '--alphabet-btn-active-bg-end': btnGradientEnabled
          ? `rgba(${alphabetRgb2.r}, ${alphabetRgb2.g}, ${alphabetRgb2.b}, ${btnActiveOpacity})`
          : `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${btnActiveOpacity})`,
        '--alphabet-btn-active-border-start': `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${Math.min(0.85, btnActiveOpacity * 2)})`,
        '--alphabet-btn-active-border-end': btnGradientEnabled
          ? `rgba(${alphabetRgb2.r}, ${alphabetRgb2.g}, ${alphabetRgb2.b}, ${Math.min(0.85, btnActiveOpacity * 2)})`
          : `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, ${Math.min(0.85, btnActiveOpacity * 2)})`,
        '--alphabet-btn-shadow-color': `rgba(${alphabetRgb.r}, ${alphabetRgb.g}, ${alphabetRgb.b}, 0.2)`,
        '--alphabet-btn-backdrop-filter': btnBgOpacity === 0 ? 'none' : 'blur(12px)',
        '--alphabet-btn-hover-backdrop-filter': btnHoverOpacity === 0 ? 'none' : 'blur(12px)',
        
        // Text color mappings:
        '--alphabet-filter-button-text-color': btnTextColor,
        '--alphabet-filter-button-disabled-text-color': btnDisabledTextColor,
        '--alphabet-filter-button-hover-text-color': btnHoverTextColor,
        '--alphabet-filter-active-btn-bg': activeBtnBg
      } as React.CSSProperties}
    >
      {CHARS.map((char) => {
        return (
          <button
            key={char}
            onClick={() => handleClick(char)}
            className={getButtonClassName(char)}
          >
            <span style={{ position: 'relative', zIndex: 2 }}>{char}</span>
          </button>
        )
      })}
    </div>
  )
}

export default AlphabetFilter
