import { useState, useEffect, useContext, useMemo } from 'react'
import LibrarySearchBar from '../LibrarySearchBar'
import CategoryFilter from '../CategoryFilter'
import LibraryFilters from '../LibraryFilters'
import ContextProvider from 'frontend/state/ContextProvider'
import './index.css'

export default function Header() {
  const [isMassEditMode, setIsMassEditMode] = useState(false)

  // 1. O novo estado isolado que não interfere no Heroic
  const [isUnclassifiedActive, setIsUnclassifiedActive] = useState(false)

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
      const gameId = `${game.app_name}_${game.runner}`
      const hasCategory = categorizedGames.has(gameId)
      const hasAssignment = !!assignments[game.app_name]
      return !hasCategory && !hasAssignment && !game.install?.is_dlc
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

    // Desliga nosso filtro se o usuário cancelar a edição
    if (!newState && isUnclassifiedActive) {
      setIsUnclassifiedActive(false)
      window.dispatchEvent(
        new CustomEvent('heroicToggleUnclassifiedFilter', {
          detail: { active: false }
        })
      )
    }
  }

  // 2. Dispara o evento limpo sem tocar no activeStoreFilter do sistema
  const toggleUnclassifiedFilter = () => {
    const newState = !isUnclassifiedActive
    setIsUnclassifiedActive(newState)
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
      }
    }
    window.addEventListener('heroicToggleMassEdit', handleExternalCancel)
    return () =>
      window.removeEventListener('heroicToggleMassEdit', handleExternalCancel)
  }, [isUnclassifiedActive])


  return (
    <>
      <div className="Header" style={{ display: 'block' }}>
        <LibrarySearchBar>
          <span className="Header__filters">
            {hasUnclassifiedGames && (
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
                  ? 'Mostrar Todos'
                  : 'Jogos Sem Classificação'}
              </button>
            )}
            {!isUnclassifiedActive && (
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

             <CategoryFilter />
             <LibraryFilters />
          </span>
        </LibrarySearchBar>
      </div>
    </>
  )
}
