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

  useEffect(() => {
    const handleDupChange = () => setDuplicatesVersion((v) => v + 1)
    window.addEventListener('heroicDuplicatesChanged', handleDupChange)
    return () =>
      window.removeEventListener('heroicDuplicatesChanged', handleDupChange)
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


  return (
    <>
      <div className="Header" style={{ display: 'block' }}>
        <LibrarySearchBar isUnclassifiedActive={isUnclassifiedActive || isDuplicatesActive}>
          <span className="Header__filters">
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
