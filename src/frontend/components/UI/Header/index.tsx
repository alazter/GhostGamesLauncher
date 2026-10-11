import { useState, useEffect, useContext, useMemo } from 'react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTags,
  faPenToSquare,
  faClone
} from '@fortawesome/free-solid-svg-icons'
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

  // Sincronização e herança das configurações de ActionIcons (ícones da esquerda usados como modelo)
  const [actionIconsGlowMode, setActionIconsGlowMode] = useState<string>(() => {
    return localStorage.getItem('heroic_action_icons_glow_mode') || 'disabled'
  })
  const [actionIconsColor1, setActionIconsColor1] = useState<string>(() => {
    return localStorage.getItem('heroic_action_icons_color1') || '#00ffff'
  })
  const [actionIconsColor2, setActionIconsColor2] = useState<string>(() => {
    return localStorage.getItem('heroic_action_icons_color2') || '#38d9e6'
  })
  const [actionIconsGradient, setActionIconsGradient] = useState<boolean>(() => {
    return localStorage.getItem('heroic_action_icons_gradient') === 'true'
  })
  const [actionIconsOpacity, setActionIconsOpacity] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_action_icons_opacity') || '1')
  })
  const [actionIconsGlowStrength, setActionIconsGlowStrength] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_action_icons_glow_strength') || '8')
  })
  const [actionIconsGlowColor, setActionIconsGlowColor] = useState<string>(() => {
    return localStorage.getItem('heroic_action_icons_glow_color') || '#00ffff'
  })
  const [actionIconsSyncGlowWithGradient, setActionIconsSyncGlowWithGradient] = useState<boolean>(() => {
    return localStorage.getItem('heroic_action_icons_sync_glow_with_gradient') !== 'false'
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

      setActionIconsGlowMode(localStorage.getItem('heroic_action_icons_glow_mode') || 'disabled')
      setActionIconsColor1(localStorage.getItem('heroic_action_icons_color1') || '#00ffff')
      setActionIconsColor2(localStorage.getItem('heroic_action_icons_color2') || '#38d9e6')
      setActionIconsGradient(localStorage.getItem('heroic_action_icons_gradient') === 'true')
      setActionIconsOpacity(Number(localStorage.getItem('heroic_action_icons_opacity') || '1'))
      setActionIconsGlowStrength(Number(localStorage.getItem('heroic_action_icons_glow_strength') || '8'))
      setActionIconsGlowColor(localStorage.getItem('heroic_action_icons_glow_color') || '#00ffff')
      setActionIconsSyncGlowWithGradient(localStorage.getItem('heroic_action_icons_sync_glow_with_gradient') !== 'false')
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

  // Paridade Absoluta: Adota as cores e modo do ActionIcons para garantir que ambos os lados repliquem exatamente o mesmo efeito
  const isNeon = actionIconsGlowMode === 'neon' || headerButtonsGlowMode === 'neon'
  const isGradient = actionIconsGradient || headerButtonsGradient

  const effectiveColor1 = actionIconsGradient ? actionIconsColor1 : (headerButtonsColor1 || actionIconsColor1)
  const effectiveColor2 = actionIconsGradient ? actionIconsColor2 : (headerButtonsColor2 || actionIconsColor2)
  const effectiveGlowColor = actionIconsGlowColor || headerButtonsGlowColor
  const effectiveOpacity = actionIconsOpacity || headerButtonsOpacity
  const effectiveGlowStrength = actionIconsGlowStrength || headerButtonsGlowStrength
  const effectiveSyncGlow = actionIconsSyncGlowWithGradient

  const rgb1 = hexToRgb(effectiveColor1)
  const rgb2 = hexToRgb(effectiveColor2)
  const rgbGlow = hexToRgb(effectiveGlowColor)
  const rgbHeaderDefaultBg = hexToRgb(headerButtonsDefaultBgColor)

  const effectiveGlow1 = effectiveSyncGlow ? effectiveColor1 : effectiveGlowColor
  const effectiveGlow2 = effectiveSyncGlow ? effectiveColor2 : effectiveGlowColor
  const effectiveRgbGlow1 = effectiveSyncGlow ? rgb1 : rgbGlow
  const effectiveRgbGlow2 = effectiveSyncGlow ? rgb2 : rgbGlow

  return (
    <>
      <div className="Header" style={{ display: 'block' }}>
        <LibrarySearchBar isUnclassifiedActive={isUnclassifiedActive || isDuplicatesActive}>
          <span 
            className={classNames('Header__filters', {
              'header-buttons--neon': isNeon,
              'header-buttons--gradient': isGradient,
              'action-icons--neon': isNeon,
              'action-icons--gradient': isGradient
            })}
            style={{
              '--action-color-1': effectiveColor1,
              '--action-color-2': effectiveColor2,
              '--action-glow-color-1': effectiveGlow1,
              '--action-glow-color-2': effectiveGlow2,
              '--action-opacity': effectiveOpacity,
              '--action-glow-strength': `${effectiveGlowStrength}px`,
              '--action-glow-rgba-1': `rgba(${effectiveRgbGlow1.r}, ${effectiveRgbGlow1.g}, ${effectiveRgbGlow1.b}, ${Math.min(1, 0.9 * effectiveOpacity)})`,
              '--action-glow-rgba-2': `rgba(${effectiveRgbGlow2.r}, ${effectiveRgbGlow2.g}, ${effectiveRgbGlow2.b}, ${Math.min(1, 0.9 * effectiveOpacity)})`,
              '--header-btn-color-1': effectiveColor1,
              '--header-btn-color-2': effectiveColor2,
              '--header-btn-glow-color-1': effectiveGlow1,
              '--header-btn-glow-color-2': effectiveGlow2,
              '--header-btn-opacity': effectiveOpacity,
              '--header-btn-glow-strength': `${effectiveGlowStrength}px`,
              '--header-btn-glow-rgba-1': `rgba(${effectiveRgbGlow1.r}, ${effectiveRgbGlow1.g}, ${effectiveRgbGlow1.b}, ${Math.min(1, 0.9 * effectiveOpacity)})`,
              '--header-btn-glow-rgba-2': `rgba(${effectiveRgbGlow2.r}, ${effectiveRgbGlow2.g}, ${effectiveRgbGlow2.b}, ${Math.min(1, 0.9 * effectiveOpacity)})`,
              '--header-btn-default-bg-color': `rgba(${rgbHeaderDefaultBg.r}, ${rgbHeaderDefaultBg.g}, ${rgbHeaderDefaultBg.b}, ${headerButtonsDefaultBgOpacity})`,
              '--header-btn-default-border-color': `rgba(${rgbHeaderDefaultBg.r}, ${rgbHeaderDefaultBg.g}, ${rgbHeaderDefaultBg.b}, ${Math.min(1, headerButtonsDefaultBgOpacity * 3)})`
            } as React.CSSProperties}
          >
            {/* Definição Nativa de Gradiente para Ícones SVG do Header */}
            <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
              <defs>
                <linearGradient id="headerIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={effectiveColor1} stopOpacity={effectiveOpacity} />
                  <stop offset="100%" stopColor={effectiveColor2} stopOpacity={effectiveOpacity} />
                </linearGradient>
              </defs>
            </svg>

            {hasDuplicateGames && (
              <button
                type="button"
                className={classNames('Header__actionBtn', {
                  'is-active': isDuplicatesActive,
                  'is-duplicates': true
                })}
                onClick={toggleDuplicatesFilter}
                title={isDuplicatesActive ? 'Sair da Edição (Duplicados Ativo)' : 'Jogos Duplicados'}
                aria-label={isDuplicatesActive ? 'Sair da Edição' : 'Jogos Duplicados'}
              >
                <FontAwesomeIcon icon={faClone} className="Header__actionIcon" />
              </button>
            )}

            {hasUnclassifiedGames && !isDuplicatesActive && (
              <button
                type="button"
                className={classNames('Header__actionBtn', {
                  'is-active': isUnclassifiedActive,
                  'is-unclassified': true
                })}
                onClick={toggleUnclassifiedFilter}
                title={isUnclassifiedActive ? 'Sair da Edição (Sem Classificação Ativo)' : 'Jogos Sem Classificação'}
                aria-label={isUnclassifiedActive ? 'Sair da Edição' : 'Jogos Sem Classificação'}
              >
                <FontAwesomeIcon icon={faTags} className="Header__actionIcon" />
              </button>
            )}

            {!isUnclassifiedActive && !isDuplicatesActive && (
              <button
                type="button"
                className={classNames('Header__actionBtn', {
                  'is-active': isMassEditMode,
                  'is-mass-edit': true
                })}
                onClick={toggleMassEdit}
                title={isMassEditMode ? 'Cancelar Edição em Massa' : 'Edição em Massa'}
                aria-label={isMassEditMode ? 'Cancelar Edição' : 'Edição em Massa'}
              >
                <FontAwesomeIcon icon={faPenToSquare} className="Header__actionIcon" />
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
