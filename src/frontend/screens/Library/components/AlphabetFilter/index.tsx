import React, { useMemo, useContext, useState, useEffect } from 'react'
import './index.css'
import LibraryContext from '../../LibraryContext'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

const AlphabetFilter: React.FC = () => {
  const {
    alphabetFilterLetter: currentFilter,
    setAlphabetFilterLetter: onFilterChange,
    gamesForAlphabetFilter: allGames
  } = useContext(LibraryContext)

  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_bg_opacity')
    return saved !== null ? Number(saved) : 0.08
  })

  const [btnOpacity, setBtnOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('heroic_alphabet_btn_opacity')
    return saved !== null ? Number(saved) : 0.05
  })

  const [baseColor, setBaseColor] = useState<string>(() => {
    const saved = localStorage.getItem('heroic_alphabet_color')
    return saved !== null ? saved : '#ffffff'
  })

  useEffect(() => {
    const handleSettingsChange = () => {
      const savedBg = localStorage.getItem('heroic_alphabet_bg_opacity')
      setBgOpacity(savedBg !== null ? Number(savedBg) : 0.08)

      const savedBtn = localStorage.getItem('heroic_alphabet_btn_opacity')
      setBtnOpacity(savedBtn !== null ? Number(savedBtn) : 0.05)

      const savedColor = localStorage.getItem('heroic_alphabet_color')
      setBaseColor(savedColor !== null ? savedColor : '#ffffff')
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () => window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [])

  const availableChars = useMemo(() => {
    const chars = new Set<string>()
    allGames.forEach((game) => {
      const title = game.overrides?.title || game.title
      if (title) {
        const processedTitle = title.replace(/^the\s/i, '')
        const firstCharMatch = processedTitle.match(/[a-zA-Z0-9]/)
        if (firstCharMatch) {
          const char = firstCharMatch[0]
          if (/[0-9]/.test(char)) {
            chars.add('#')
          } else {
            chars.add(char.toUpperCase())
          }
        }
      }
    })
    return chars
  }, [allGames])

  const getButtonClassName = (value: string) => {
    let className = 'alphabet-filter-button'
    if (value === currentFilter) {
      className += ' alphabet-filter-button--active'
    } else if (!availableChars.has(value)) {
      className += ' alphabet-filter-button--disabled'
    }
    return className
  }

  const handleClick = (value: string) => {
    if (value === currentFilter) {
      onFilterChange(null)
    } else if (availableChars.has(value)) {
      onFilterChange(value)
    }
  }

  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 255, g: 255, b: 255 }
  }

  const { r, g, b } = hexToRgb(baseColor)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const isLightColor = luminance > 140
  const useDarkText = isLightColor && btnOpacity > 0.4

  const btnTextColor = useDarkText ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.7)'
  const btnDisabledTextColor = useDarkText ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.2)'
  const btnHoverTextColor = useDarkText ? '#000000' : '#ffffff'

  // Se a cor for clara, o botão ativo fica ciano escuro/médio para contraste.
  // Se for escura, o botão ativo pega a própria cor base escolhida, porém sólida (0.85) com borda ciano para destacar!
  const activeBtnBg = bgOpacity > 0.4
    ? (isLightColor ? 'rgba(0, 150, 150, 0.85)' : `rgba(${r}, ${g}, ${b}, 0.85)`)
    : 'rgba(0, 255, 255, 0.08)'

  return (
    <div
      className="alphabet-filter-container"
      style={{
        '--alphabet-filter-container-bg-opacity': bgOpacity,
        '--alphabet-filter-button-bg-opacity': btnOpacity,
        '--alphabet-filter-button-text-color': btnTextColor,
        '--alphabet-filter-button-disabled-text-color': btnDisabledTextColor,
        '--alphabet-filter-button-hover-text-color': btnHoverTextColor,
        '--alphabet-filter-active-btn-bg': activeBtnBg,
        '--alphabet-filter-base-r': r,
        '--alphabet-filter-base-g': g,
        '--alphabet-filter-base-b': b
      } as React.CSSProperties}
    >
      {CHARS.map((char) => {
        const isInteractable =
          availableChars.has(char) || char === currentFilter
        return (
          <button
            key={char}
            onClick={() => handleClick(char)}
            className={getButtonClassName(char)}
            disabled={!isInteractable}
          >
            {char}
          </button>
        )
      })}
    </div>
  )
}

export default AlphabetFilter
