import { useState, useEffect, useContext, useMemo } from 'react'
import LibrarySearchBar from '../LibrarySearchBar'
import CategoryFilter from '../CategoryFilter'
import LibraryFilters from '../LibraryFilters'
import ContextProvider from 'frontend/state/ContextProvider'
import { getDuplicateGameIds } from 'frontend/helpers/library'
import './index.css'

export default function Header() {
  const [isMassEditMode, setIsMassEditMode] = useState(false)

  // 1. O novo estado isolado que não interfere no Heroic
  const [isUnclassifiedActive, setIsUnclassifiedActive] = useState(false)
  const [isDuplicatesActive, setIsDuplicatesActive] = useState(false)

  const { epic, gog, amazon, zoom, sideloadedLibrary, customCategories } =
    useContext(ContextProvider)
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAssignments = () => {
      setAssignments(
        JSON.parse(localStorage.getItem('heroic_game_assignments') || '{}')
      )
    }
    loadAssignments()
    window.addEventListener('gameAssignmentsChanged', loadAssignments)
    return () =>
      window.removeEventListener('gameAssignmentsChanged', loadAssignments)
  }, [])

  const [duplicatesVersion, setDuplicatesVersion] = useState(0)
  const [headerButtonsGlowMode, setHeaderButtonsGlowMode] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_glow_mode') || 'disabled'
  })
  const [headerButtonsColor1, setHeaderButtonsColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_color1') || '#00ffff'
  })
  const [headerButtonsColor2, setHeaderButtonsColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_color2') || '#38d9e6'
  })
  const [headerButtonsGradient, setHeaderButtonsGradient] = useState<boolean>(() => {
    return localStorage.getItem('heroic_header_buttons_gradient') === 'true'
  })
  const [headerButtonsOpacity, setHeaderButtonsOpacity] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_header_buttons_opacity') || '1')
  })
  const [headerButtonsGlowStrength, setHeaderButtonsGlowStrength] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_header_buttons_glow_strength') || '8')
  })
  const [headerButtonsGlowColor, setHeaderButtonsGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_glow_color') || '#00ffff'
  })
  const [headerButtonsSyncGlowWithGradient, setHeaderButtonsSyncGlowWithGradient] = useState<boolean>(() => {
    return localStorage.getItem('heroic_header_buttons_sync_glow_with_gradient') !== 'false'
  })
  const [headerButtonsDefaultBgColor, setHeaderButtonsDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_header_buttons_default_bg_color') || '#ffffff'
  })
  const [headerButtonsDefaultBgOpacity, setHeaderButtonsDefaultBgOpacity] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_header_buttons_default_bg_opacity') || '0.05')
  })

  useEffect(() => {
    const handleDupChange = () => setDuplicatesVersion((v) => v + 1)
    const handleSettingsChange = () => {
      setHeaderButtonsGlowMode(localStorage.getItem('heroic_header_buttons_glow_mode') || 'disabled')
      setHeaderButtonsColor1(localStorage.getItem('heroic_header_buttons_color1') || '#00ffff')
      setHeaderButtonsColor2(localStorage.getItem('heroic_header_buttons_color2') || '#38d9e6')
      setHeaderButtonsGradient(localStorage.getItem('heroic_header_buttons_gradient') === 'true')
      setHeaderButtonsOpacity(Number(localStorage.getItem('heroic_header_buttons_opacity') || '1'))
      setHeaderButtonsGlowStrength(Number(localStorage.getItem('heroic_header_buttons_glow_strength') || '8'))
      setHeaderButtonsGlowColor(localStorage.getItem('heroic_header_buttons_glow_color') || '#00ffff')
      setHeaderButtonsSyncGlowWithGradient(localStorage.getItem('heroic_header_buttons_sync_glow_with_gradient') !== 'false')
      setHeaderButtonsDefaultBgColor(localStorage.getItem('heroic_header_buttons_default_bg_color') || '#ffffff')
      setHeaderButtonsDefaultBgOpacity(Number(localStorage.getItem('heroic_header_buttons_default_bg_opacity') || '0.05'))
    }
    window.addEventListener('heroicDuplicatesChanged', handleDupChange)
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () => {
      window.removeEventListener('heroicDuplicatesChanged', handleDupChange)
      window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
    }
  }, [])

  const duplicateGameIds = useMemo(() => {
    const allGames = [
      ...(epic?.library || []),
      ...(gog?.library || []),
      ...(amazon?.library || []),
      ...(zoom?.library || []),
      ...(sideloadedLibrary || [])
    ]
    return getDuplicateGameIds(allGames)
  }, [epic, gog, amazon, zoom, sideloadedLibrary, duplicatesVersion])

  const hasDuplicateGames = duplicateGameIds.size > 0

  const hasUnclassifiedGames = useMemo(() => {
    const allGames = [
      ...(epic?.library || []),
      ...(gog?.library || []),
      ...(amazon?.library || []),
      ...(zoom?.library || []),
      ...(sideloadedLibrary || [])
    ]

    const categorizedGames = new Set(
      Object.values(customCategories?.list || {}).flat()
    )

    return allGames.some((game) => {
      if (!game || game.install?.is_dlc) return false
      const runner = game.runner || 'sideload'
      const gameId = `${game.app_name}_${runner}`
      const hasCategory =
        categorizedGames.has(gameId) ||
        categorizedGames.has(game.app_name) ||
        categorizedGames.has(`${game.app_name}_sideload`)
      const hasAssignment = !!assignments[game.app_name]
      return !hasCategory && !hasAssignment
    })
  }, [
    epic,
    gog,
    amazon,
    zoom,
    sideloadedLibrary,
    customCategories,
    assignments
  ])

  const toggleMassEdit = () => {
    const newState = !isMassEditMode
    setIsMassEditMode(newState)
    window.dispatchEvent(
      new CustomEvent('heroicToggleMassEdit', { detail: { active: newState } })
    )

    // Desliga nossos filtros se o usuário cancelar a edição
    if (!newState) {
      if (isUnclassifiedActive) {
        setIsUnclassifiedActive(false)
        window.dispatchEvent(
          new CustomEvent('heroicToggleUnclassifiedFilter', {
            detail: { active: false }
          })
        )
      }
      if (isDuplicatesActive) {
        setIsDuplicatesActive(false)
        window.dispatchEvent(
          new CustomEvent('heroicToggleDuplicatesFilter', {
            detail: { active: false }
          })
        )
      }
    }
  }

  // 2. Dispara o evento limpo desmarcando qualquer filtro de loja ativo
  const toggleUnclassifiedFilter = () => {
    const newState = !isUnclassifiedActive
    setIsUnclassifiedActive(newState)

    if (newState) {
      if (isDuplicatesActive) {
        setIsDuplicatesActive(false)
        window.dispatchEvent(
          new CustomEvent('heroicToggleDuplicatesFilter', {
            detail: { active: false }
          })
        )
      }
      localStorage.removeItem('heroic_active_store_filter')
      window.dispatchEvent(
        new CustomEvent('heroicFilterChanged', {
          detail: { storeFilter: null }
        })
      )
    }

    window.dispatchEvent(
      new CustomEvent('heroicToggleUnclassifiedFilter', {
        detail: { active: newState }
      })
    )

    // Entra/sai do modo de edição em massa automaticamente
    setIsMassEditMode(newState)
    window.dispatchEvent(
      new CustomEvent('heroicToggleMassEdit', { detail: { active: newState } })
    )
  }

  const toggleDuplicatesFilter = () => {
    const newState = !isDuplicatesActive
    setIsDuplicatesActive(newState)

    if (newState) {
      if (isUnclassifiedActive) {
        setIsUnclassifiedActive(false)
        window.dispatchEvent(
          new CustomEvent('heroicToggleUnclassifiedFilter', {
            detail: { active: false }
          })
        )
      }
      localStorage.removeItem('heroic_active_store_filter')
      window.dispatchEvent(
        new CustomEvent('heroicFilterChanged', {
          detail: { storeFilter: null }
        })
      )
    }

    window.dispatchEvent(
      new CustomEvent('heroicToggleDuplicatesFilter', {
        detail: { active: newState }
      })
    )

    // Entra/sai do modo de edição em massa automaticamente
    setIsMassEditMode(newState)
    window.dispatchEvent(
      new CustomEvent('heroicToggleMassEdit', { detail: { active: newState } })
    )
  }

  useEffect(() => {
    const handleExternalCancel = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>
      if (customEvent.detail?.active === false) {
        setIsMassEditMode(false)
        if (isUnclassifiedActive) {
          setIsUnclassifiedActive(false)
          window.dispatchEvent(
            new CustomEvent('heroicToggleUnclassifiedFilter', {
              detail: { active: false }
            })
          )
        }
        if (isDuplicatesActive) {
          setIsDuplicatesActive(false)
          window.dispatchEvent(
            new CustomEvent('heroicToggleDuplicatesFilter', {
              detail: { active: false }
            })
          )
        }
      }
    }
    const handleFilterChanged = () => {
      const activeStore = localStorage.getItem('heroic_active_store_filter')
      if (activeStore) {
        if (isUnclassifiedActive) {
          setIsUnclassifiedActive(false)
          window.dispatchEvent(
            new CustomEvent('heroicToggleUnclassifiedFilter', {
              detail: { active: false }
            })
          )
        }
        if (isDuplicatesActive) {
          setIsDuplicatesActive(false)
          window.dispatchEvent(
            new CustomEvent('heroicToggleDuplicatesFilter', {
              detail: { active: false }
            })
          )
        }
      }
    }

    window.addEventListener('heroicToggleMassEdit', handleExternalCancel)
    window.addEventListener('heroicFilterChanged', handleFilterChanged)
    return () => {
      window.removeEventListener('heroicToggleMassEdit', handleExternalCancel)
      window.removeEventListener('heroicFilterChanged', handleFilterChanged)
    }
  }, [isUnclassifiedActive, isDuplicatesActive])


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
      : { r: 0, g: 255, b: 255 }
  }

  const rgbHeader1 = hexToRgb(headerButtonsColor1)
  const rgbHeader2 = hexToRgb(headerButtonsColor2)
  const rgbHeaderGlow = hexToRgb(headerButtonsGlowColor)
  const rgbHeaderDefaultBg = hexToRgb(headerButtonsDefaultBgColor)

  const effectiveHeaderGlow1 = headerButtonsSyncGlowWithGradient ? headerButtonsColor1 : headerButtonsGlowColor
  const effectiveHeaderGlow2 = headerButtonsSyncGlowWithGradient ? headerButtonsColor2 : headerButtonsGlowColor
  const effectiveRgbHeaderGlow1 = headerButtonsSyncGlowWithGradient ? rgbHeader1 : rgbHeaderGlow
  const effectiveRgbHeaderGlow2 = headerButtonsSyncGlowWithGradient ? rgbHeader2 : rgbHeaderGlow

  return (
    <>
      <div className="Header" style={{ display: 'block' }}>
        <LibrarySearchBar isUnclassifiedActive={isUnclassifiedActive || isDuplicatesActive}>
          <span 
            className={`Header__filters ${headerButtonsGlowMode === 'neon' ? 'header-buttons--neon' : ''} ${headerButtonsGradient ? 'header-buttons--gradient' : ''}`}
            style={{
              '--header-btn-color-1': headerButtonsColor1,
              '--header-btn-color-2': headerButtonsColor2,
              '--header-btn-glow-color-1': effectiveHeaderGlow1,
              '--header-btn-glow-color-2': effectiveHeaderGlow2,
              '--header-btn-opacity': headerButtonsOpacity,
              '--header-btn-glow-strength': `${headerButtonsGlowStrength}px`,
              '--header-btn-glow-rgba-1': `rgba(${effectiveRgbHeaderGlow1.r}, ${effectiveRgbHeaderGlow1.g}, ${effectiveRgbHeaderGlow1.b}, ${Math.min(1, 0.9 * headerButtonsOpacity)})`,
              '--header-btn-glow-rgba-2': `rgba(${effectiveRgbHeaderGlow2.r}, ${effectiveRgbHeaderGlow2.g}, ${effectiveRgbHeaderGlow2.b}, ${Math.min(1, 0.9 * headerButtonsOpacity)})`,
              '--header-btn-default-bg-color': `rgba(${rgbHeaderDefaultBg.r}, ${rgbHeaderDefaultBg.g}, ${rgbHeaderDefaultBg.b}, ${headerButtonsDefaultBgOpacity})`,
              '--header-btn-default-border-color': `rgba(${rgbHeaderDefaultBg.r}, ${rgbHeaderDefaultBg.g}, ${rgbHeaderDefaultBg.b}, ${Math.min(1, headerButtonsDefaultBgOpacity * 3)})`
            } as React.CSSProperties}
          >
            {hasDuplicateGames && (
              <button
                onClick={toggleDuplicatesFilter}
                style={{
                  background: isDuplicatesActive
                    ? 'rgba(156, 39, 176, 0.85)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  border: isDuplicatesActive
                    ? '1px solid #ab47bc'
                    : '1px solid rgba(255, 255, 255, 0.25)',
                  padding: '0 18px',
                  height: '42px',
                  borderRadius: '20px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(5px)',
                  transition: 'all 0.2s',
                  boxShadow: isDuplicatesActive
                    ? '0 0 10px rgba(156, 39, 176, 0.4)'
                    : 'none'
                }}
              >
                {isDuplicatesActive
                  ? 'Sair da Edição'
                  : 'Jogos Duplicados'}
              </button>
            )}

            {hasUnclassifiedGames && !isDuplicatesActive && (
              <button
                onClick={toggleUnclassifiedFilter}
                style={{
                  background: isUnclassifiedActive
                    ? 'rgba(255, 152, 0, 0.8)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  border: isUnclassifiedActive
                    ? '1px solid rgba(255, 152, 0, 1)'
                    : '1px solid rgba(255, 255, 255, 0.25)',
                  padding: '0 18px',
                  height: '42px',
                  borderRadius: '20px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(5px)',
                  transition: 'all 0.2s'
                }}
              >
                {isUnclassifiedActive
                  ? 'Sair da Edição'
                  : 'Jogos Sem Classificação'}
              </button>
            )}

            {!isUnclassifiedActive && !isDuplicatesActive && (
              <button
                onClick={toggleMassEdit}
                style={{
                  background: isMassEditMode
                    ? 'rgba(229, 57, 53, 0.85)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  border: isMassEditMode
                    ? '1px solid #ef5350'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '0 18px',
                  height: '42px',
                  borderRadius: '20px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(5px)',
                  transition: 'all 0.2s ease',
                  boxShadow: isMassEditMode
                    ? '0 0 10px rgba(229, 57, 53, 0.4)'
                    : 'none'
                }}
                onMouseOver={(e) => {
                  if (!isMassEditMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  } else {
                    e.currentTarget.style.background = 'rgba(229, 57, 53, 0.95)'
                  }
                }}
                onMouseOut={(e) => {
                  if (!isMassEditMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  } else {
                    e.currentTarget.style.background = 'rgba(229, 57, 53, 0.85)'
                  }
                }}
              >
                {isMassEditMode ? 'Cancelar Edição' : 'Edição em Massa'}
              </button>
            )}

            <div style={isUnclassifiedActive || isDuplicatesActive ? { pointerEvents: 'none', opacity: 0.4, display: 'flex', gap: 'inherit', alignItems: 'center' } : { display: 'flex', gap: 'inherit', alignItems: 'center' }}>
              <CategoryFilter />
              <LibraryFilters />
            </div>
          </span>
        </LibrarySearchBar>
      </div>
    </>
  )
}
