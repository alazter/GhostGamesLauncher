import { useContext, useEffect, useRef, useState, useMemo, memo } from 'react'
import { GameInfo, Runner } from 'common/types'
import cx from 'classnames'
import GameCard from '../GameCard'
import ContextProvider from 'frontend/state/ContextProvider'
import { useTranslation } from 'react-i18next'
import { sideloadLibrary, gameOverridesStore } from 'frontend/helpers/electronStores'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { CustomStore } from 'frontend/types'
import LibraryContext from 'frontend/screens/Library/LibraryContext'
import {
  isGameAssignedToStore,
  isGameVisibleInAllGames,
  isPlaytestOrDemo
} from 'frontend/helpers/customStoreFiltering'
import CachedImage from 'frontend/components/UI/CachedImage'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import { getStoreName } from 'frontend/helpers'
import { DEFAULT_GHOST_CUSTOM_STORES } from 'frontend/helpers/defaultCustomStores'

interface Props {
  library: GameInfo[]
  layout?: string
  isFirstLane?: boolean
  handleGameCardClick: (
    app_name: string,
    runner: Runner,
    gameInfo: GameInfo
  ) => void
  onlyInstalled?: boolean
  isRecent?: boolean
  isFavourite?: boolean
}

const scrollCardIntoView = (ev: FocusEvent) => {
  const windowHeight = window.innerHeight
  const trgt = ev.target as HTMLElement
  const rect = trgt.getBoundingClientRect()
  const scrollArea =
    document.getElementById('games-scroll-area') || document.body

  if (rect.top < 100) {
    scrollArea.scrollTo({
      top: trgt.parentElement!.offsetTop - 200,
      behavior: 'smooth'
    })
  } else if (rect.bottom > windowHeight - 100) {
    scrollArea.scrollTo({
      top: trgt.parentElement!.offsetTop - windowHeight + rect.height + 150,
      behavior: 'smooth'
    })
  }
}

const GamesList = ({
  library = [],
  layout = 'grid',
  handleGameCardClick,
  isFirstLane = false,
  onlyInstalled = false,
  isRecent = false,
  isFavourite = false
}: Props): JSX.Element => {
  const { gameUpdates, allTilesInColor, titlesAlwaysVisible, refreshLibrary, hiddenGames, customCategories } =
    useContext(ContextProvider)
  const { gameOverrides } = useGlobalState.keys('gameOverrides')
  const { storesFilters, showPlaytestsAndDemos, filterText } = useContext(LibraryContext)
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement | null>(null)
  const { activeController } = useContext(ContextProvider)

  const [isMassEditMode, setIsMassEditMode] = useState(false)
  const [isDuplicatesMode, setIsDuplicatesMode] = useState(false)
  const [massEditTab, setMassEditTab] = useState<'library' | 'hidden'>('library')
  const [selectedGames, setSelectedGames] = useState<GameInfo[]>([])
  const [selectedHiddenGames, setSelectedHiddenGames] = useState<string[]>([])
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(
    () => localStorage.getItem('heroic_active_store_filter')
  )

  const [customStores] = useState<CustomStore[]>(() => {
    const saved = localStorage.getItem('heroic_custom_stores')
    return saved ? (JSON.parse(saved) as CustomStore[]) : DEFAULT_GHOST_CUSTOM_STORES
  })

  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    return JSON.parse(
      localStorage.getItem('heroic_game_assignments') || '{}'
    ) as Record<string, string>
  })

  // 1 único listener centralizado de seleção inline para todos os cards
  const [selectedInlineId, setSelectedInlineId] = useState<string | null>(null)

  useEffect(() => {
    const handleSelectedChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ appName: string | null; runner: Runner | null }>
      const { appName: selAppName, runner: selRunner } = customEvent.detail || {}
      setSelectedInlineId(selAppName && selRunner ? `${selAppName}_${selRunner}` : null)
    }
    window.addEventListener('heroicSelectedGameChanged', handleSelectedChange)
    return () =>
      window.removeEventListener('heroicSelectedGameChanged', handleSelectedChange)
  }, [])

  // 1 único listener centralizado de configurações para todos os cards
  const [hideIconsGamepad, setHideIconsGamepad] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_icons_gamepad')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })
  const [hideIconsMouse, setHideIconsMouse] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_icons_mouse')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  useEffect(() => {
    const handleStorageChange = () => {
      const savedGamepad = localStorage.getItem('heroic_hide_icons_gamepad')
      const savedMouse = localStorage.getItem('heroic_hide_icons_mouse')
      if (savedGamepad !== null) setHideIconsGamepad(JSON.parse(savedGamepad) as boolean)
      if (savedMouse !== null) setHideIconsMouse(JSON.parse(savedMouse) as boolean)
    }

    window.addEventListener('heroicSettingsChanged', handleStorageChange)
    return () =>
      window.removeEventListener('heroicSettingsChanged', handleStorageChange)
  }, [])

  const shouldShowIcons = activeController ? !hideIconsGamepad : !hideIconsMouse

  // Pré-indexação O(1) de categorias para eliminar loops aninhados em 1.463 cards
  const categoryByGameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!customCategories || !customCategories.list) return map

    for (const [categoryName, gamesArray] of Object.entries(customCategories.list)) {
      if (Array.isArray(gamesArray)) {
        for (const gameKey of gamesArray) {
          if (typeof gameKey === 'string') {
            map.set(gameKey, categoryName)
          }
        }
      }
    }
    return map
  }, [customCategories])

  // CORREÇÃO DOS ERROS DE TIPAGEM (ANY)
  useEffect(() => {
    const handleMassEditEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>
      setIsMassEditMode(customEvent.detail.active)
      if (!customEvent.detail.active) {
        setSelectedGames([])
        setSelectedHiddenGames([])
        setMassEditTab('library')
      }
    }
    window.addEventListener('heroicToggleMassEdit', handleMassEditEvent)
    return () =>
      window.removeEventListener('heroicToggleMassEdit', handleMassEditEvent)
  }, [])

  useEffect(() => {
    const handleFilterChange = () =>
      setActiveStoreFilter(localStorage.getItem('heroic_active_store_filter'))
    const handleAssignmentsChange = () =>
      setAssignments(
        JSON.parse(
          localStorage.getItem('heroic_game_assignments') || '{}'
        ) as Record<string, string>
      )
    const handleDupFilter = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>
      setIsDuplicatesMode(!!customEvent.detail?.active)
    }

    window.addEventListener('heroicFilterChanged', handleFilterChange)
    window.addEventListener('gameAssignmentsChanged', handleAssignmentsChange)
    window.addEventListener('heroicToggleDuplicatesFilter', handleDupFilter)

    return () => {
      window.removeEventListener('heroicFilterChanged', handleFilterChange)
      window.removeEventListener(
        'gameAssignmentsChanged',
        handleAssignmentsChange
      )
      window.removeEventListener('heroicToggleDuplicatesFilter', handleDupFilter)
    }
  }, [])

  const handleAssign = () => {
    if (!selectedStore) {
      alert('Por favor, selecione uma loja primeiro!')
      return
    }

    if (
      selectedStore === '__hide__' ||
      selectedStore === '__hide_from_duplicates__'
    ) {
      hiddenGames.addMultiple(
        selectedGames.map((game) => {
          const override = gameOverrides?.[game.app_name]
          const activeArtCover =
            override?.art_cover !== undefined
              ? override.art_cover
              : game.overrides?.art_cover ?? game.art_cover
          const activeArtSquare =
            override?.art_square !== undefined
              ? override.art_square
              : game.overrides?.art_square ?? game.art_square

          return {
            appName: game.app_name,
            title: override?.title || game.overrides?.title || game.title,
            runner: game.runner,
            art_cover: activeArtCover,
            art_square: activeArtSquare
          }
        })
      )

      if (selectedStore === '__hide_from_duplicates__') {
        const existingHidden: string[] = JSON.parse(
          localStorage.getItem('heroic_hidden_duplicate_ids') || '[]'
        )
        const hiddenSet = new Set(existingHidden)
        selectedGames.forEach((game) => {
          const runner = (game.runner || 'sideload').toLowerCase()
          hiddenSet.add(`${game.app_name}_${runner}`)
          hiddenSet.add(game.app_name)
        })
        localStorage.setItem(
          'heroic_hidden_duplicate_ids',
          JSON.stringify(Array.from(hiddenSet))
        )
        window.dispatchEvent(new Event('heroicDuplicatesChanged'))
      }

      window.dispatchEvent(
        new CustomEvent('heroicToggleMassEdit', { detail: { active: false } })
      )
      setSelectedGames([])
      setSelectedStore('')
      return
    }

    const newAssignments = { ...assignments }
    selectedGames.forEach((game) => {
      newAssignments[game.app_name] = selectedStore
    })

    // If the game was hidden and is now assigned to a store, restore it
    hiddenGames.removeMultiple(selectedGames.map((g) => g.app_name))

    const existingHidden: string[] = JSON.parse(
      localStorage.getItem('heroic_hidden_duplicate_ids') || '[]'
    )
    if (existingHidden.length > 0) {
      const hiddenSet = new Set(existingHidden)
      selectedGames.forEach((game) => {
        const runner = (game.runner || 'sideload').toLowerCase()
        hiddenSet.delete(`${game.app_name}_${runner}`)
        hiddenSet.delete(game.app_name)
      })
      localStorage.setItem(
        'heroic_hidden_duplicate_ids',
        JSON.stringify(Array.from(hiddenSet))
      )
      window.dispatchEvent(new Event('heroicDuplicatesChanged'))
    }

    localStorage.setItem(
      'heroic_game_assignments',
      JSON.stringify(newAssignments)
    )
    setAssignments(newAssignments)
    window.dispatchEvent(new Event('gameAssignmentsChanged'))

    window.dispatchEvent(
      new CustomEvent('heroicToggleMassEdit', { detail: { active: false } })
    )
    setSelectedStore('')
  }

  const isSearching = Boolean(filterText && filterText.trim().length > 0)

  const filteredLibrary = useMemo(() => {
    if (isSearching) {
      return library
    }

    let list = library
    if (!showPlaytestsAndDemos) {
      list = list.filter((game) => !isPlaytestOrDemo(game))
    }

    // 1. When a specific Custom Store is active: show all games belonging to that store
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

      return list.filter((game) =>
        isGameAssignedToStore(game, activeStoreObj, assignments)
      )
    }

    // 2. When in "Todos os Jogos": filter games based on storesFilters toggle state
    return list.filter((game) =>
      isGameVisibleInAllGames(game, customStores, assignments, storesFilters)
    )
  }, [library, isSearching, activeStoreFilter, assignments, customStores, storesFilters, showPlaytestsAndDemos])

  const INITIAL_BATCH_SIZE = 80
  const [renderLimit, setRenderLimit] = useState<number>(INITIAL_BATCH_SIZE)

  useEffect(() => {
    if (filteredLibrary.length > INITIAL_BATCH_SIZE) {
      setRenderLimit(INITIAL_BATCH_SIZE)
      const handle = requestAnimationFrame(() => {
        setRenderLimit(filteredLibrary.length)
      })
      return () => {
        cancelAnimationFrame(handle)
      }
    }
    setRenderLimit(filteredLibrary.length)
    return () => {}
  }, [filteredLibrary.length])

  const visibleLibrary = useMemo(() => {
    if (filteredLibrary.length <= renderLimit) {
      return filteredLibrary
    }
    return filteredLibrary.slice(0, renderLimit)
  }, [filteredLibrary, renderLimit])

  useEffect(() => {
    (window as any).heroicActiveLibrary = filteredLibrary
  }, [filteredLibrary])

  const allSelected =
    massEditTab === 'library'
      ? selectedGames.length === filteredLibrary.length &&
        filteredLibrary.length > 0
      : selectedHiddenGames.length === hiddenGames.list.length &&
        hiddenGames.list.length > 0

  const handleToggleSelectAll = () => {
    if (massEditTab === 'library') {
      if (allSelected) {
        setSelectedGames([])
      } else {
        setSelectedGames(filteredLibrary)
      }
    } else {
      if (allSelected) {
        setSelectedHiddenGames([])
      } else {
        setSelectedHiddenGames(hiddenGames.list.map((g) => g.appName))
      }
    }
  }

  const handleRestoreSelectedHidden = () => {
    if (selectedHiddenGames.length === 0) return
    hiddenGames.removeMultiple(selectedHiddenGames)
    setSelectedHiddenGames([])
  }

  const handleRestoreAllHidden = () => {
    if (hiddenGames.list.length === 0) return
    const confirmRestore = window.confirm(
      `Deseja realmente restaurar todos os ${hiddenGames.list.length} jogo(s) ocultado(s)?`
    )
    if (!confirmRestore) return
    hiddenGames.removeMultiple(hiddenGames.list.map((g) => g.appName))
    setSelectedHiddenGames([])
  }

  const handleBulkUninstall = async () => {
    if (selectedGames.length === 0) return
    const confirmUninstall = window.confirm(
      `Deseja realmente desinstalar/remover da biblioteca o(s) ${selectedGames.length} jogo(s) selecionado(s)?`
    )
    if (!confirmUninstall) return

    const shouldRemovePrefix = window.confirm(
      `Deseja remover também os arquivos de prefixo (Wineprefix) dos jogos selecionados (se existirem)?`
    )
    const shouldRemoveSetting = window.confirm(
      `Deseja remover também as configurações e logs dos jogos selecionados?`
    )

    try {
      window.api.logInfo(`handleBulkUninstall: Iniciando desinstalação de ${selectedGames.length} jogo(s)`)
      
      const appsToUninstall = selectedGames.map((g) => ({
        appName: g.app_name,
        runner: g.runner
      }))

      await window.api.bulkUninstall(
        appsToUninstall,
        shouldRemovePrefix,
        shouldRemoveSetting
      )

      const storeGamesToHide = selectedGames
        .filter((g) => g.runner !== 'sideload')
        .map((g) => {
          const override = gameOverrides?.[g.app_name]
          const activeArtCover =
            override?.art_cover !== undefined
              ? override.art_cover
              : g.overrides?.art_cover ?? g.art_cover
          const activeArtSquare =
            override?.art_square !== undefined
              ? override.art_square
              : g.overrides?.art_square ?? g.art_square

          return {
            appName: g.app_name,
            title: override?.title || g.overrides?.title || g.title,
            runner: g.runner,
            art_cover: activeArtCover,
            art_square: activeArtSquare
          }
        })

      if (storeGamesToHide.length > 0) {
        hiddenGames.addMultiple(storeGamesToHide)
      }

      window.dispatchEvent(
        new CustomEvent('heroicToggleMassEdit', { detail: { active: false } })
      )
      window.dispatchEvent(
        new CustomEvent('heroicSelectGameInline', { detail: { gameInfo: null } })
      )
    } catch (err) {
      window.api.logError(`Error during bulk uninstall: ${String(err)}`)
    }
  }

  useEffect(() => {
    if (filteredLibrary.length) {
      const options = { rootMargin: '500px', threshold: 0 }
      const callback: IntersectionObserverCallback = (entries, observer) => {
        const entered: string[] = []
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0) {
            const appName = (entry.target as HTMLDivElement).dataset
              .appName as string
            if (appName) entered.push(appName)
            observer.unobserve(entry.target)
          }
        })
        if (entered.length > 0) {
          window.dispatchEvent(
            new CustomEvent('visible-cards', { detail: { appNames: entered } })
          )
        }
      }
      const observer = new IntersectionObserver(callback, options)
      document
        .querySelectorAll('[data-invisible]')
        .forEach((card) => observer.observe(card))
      return () => observer.disconnect()
    }
    return () => ({})
  }, [filteredLibrary])

  useEffect(() => {
    const listNode = listRef.current
    if (listNode && activeController) {
      listNode.addEventListener('focus', scrollCardIntoView, { capture: true })
      return () =>
        listNode.removeEventListener('focus', scrollCardIntoView, {
          capture: true
        })
    }
    return () => ({})
  }, [activeController])

  return (
    <>
      {isMassEditMode && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 0 20px 0',
            width: '100%'
          }}
        >
          <button
            onClick={() => {
              setMassEditTab('library')
              setSelectedHiddenGames([])
            }}
            style={{
              background:
                massEditTab === 'library'
                  ? '#6c5ce7'
                  : 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border:
                massEditTab === 'library'
                  ? '1px solid #a29bfe'
                  : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '8px 22px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow:
                massEditTab === 'library'
                  ? '0 0 12px rgba(108, 92, 231, 0.5)'
                  : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🎮</span> Seleção de Jogos ({filteredLibrary.length})
          </button>

          <button
            onClick={() => {
              setMassEditTab('hidden')
              setSelectedGames([])
            }}
            style={{
              background:
                massEditTab === 'hidden'
                  ? '#6c5ce7'
                  : 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border:
                massEditTab === 'hidden'
                  ? '1px solid #a29bfe'
                  : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '8px 22px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow:
                massEditTab === 'hidden'
                  ? '0 0 12px rgba(108, 92, 231, 0.5)'
                  : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>👁️</span> Jogos Ocultados ({hiddenGames.list.length})
          </button>
        </div>
      )}

      {isMassEditMode && massEditTab === 'library' && (
        <div
          style={{
            position: 'fixed',
            bottom: '15px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 34, 40, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '8px 24px',
            borderRadius: '8px',
            zIndex: 9999,
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff'
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
            {selectedGames.length} jogo(s) selecionado(s)
          </span>
          <button
            onClick={handleToggleSelectAll}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            }}
          >
            {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
          </button>
          <button
            onClick={handleBulkUninstall}
            disabled={selectedGames.length === 0}
            style={{
              background:
                selectedGames.length === 0
                  ? 'rgba(244, 67, 54, 0.3)'
                  : '#f44336',
              color:
                selectedGames.length === 0
                  ? 'rgba(255,255,255,0.4)'
                  : '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor:
                selectedGames.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (selectedGames.length > 0) {
                e.currentTarget.style.background = '#d32f2f'
              }
            }}
            onMouseOut={(e) => {
              if (selectedGames.length > 0) {
                e.currentTarget.style.background = '#f44336'
              }
            }}
          >
            Desinstalar
          </button>
          <div
            style={{
              width: '1px',
              height: '24px',
              background: 'rgba(255, 255, 255, 0.15)'
            }}
          />
          <select
            value={selectedStore}
            disabled={selectedGames.length === 0}
            onChange={(e) => setSelectedStore(e.target.value)}
            style={{
              background: '#13171c',
              color:
                selectedGames.length === 0
                  ? 'rgba(255,255,255,0.4)'
                  : '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '6px 12px',
              borderRadius: '6px',
              outline: 'none',
              fontSize: '12px',
              cursor:
                selectedGames.length === 0 ? 'not-allowed' : 'pointer',
              minWidth: '160px',
              width: 'auto'
            }}
          >
            <option value="">Atribuir à Loja...</option>
            <option value="__hide__">Ocultar</option>
            {isDuplicatesMode && (
              <option value="__hide_from_duplicates__">
                Ocultar dos Duplicados
              </option>
            )}
            {customStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={selectedGames.length === 0 || !selectedStore}
            style={{
              background:
                selectedGames.length === 0 || !selectedStore
                  ? 'rgba(76, 175, 80, 0.3)'
                  : '#4CAF50',
              color:
                selectedGames.length === 0 || !selectedStore
                  ? 'rgba(255,255,255,0.4)'
                  : '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor:
                selectedGames.length === 0 || !selectedStore
                  ? 'not-allowed'
                  : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (selectedGames.length > 0 && selectedStore) {
                e.currentTarget.style.background = '#388E3C'
              }
            }}
            onMouseOut={(e) => {
              if (selectedGames.length > 0 && selectedStore) {
                e.currentTarget.style.background = '#4CAF50'
              }
            }}
          >
            Aplicar
          </button>
        </div>
      )}

      {isMassEditMode && massEditTab === 'hidden' && (
        <div
          style={{
            position: 'fixed',
            bottom: '15px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 34, 40, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '8px 24px',
            borderRadius: '8px',
            zIndex: 9999,
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff'
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
            {selectedHiddenGames.length} jogo(s) selecionado(s)
          </span>
          <button
            onClick={handleToggleSelectAll}
            disabled={hiddenGames.list.length === 0}
            style={{
              background:
                hiddenGames.list.length === 0
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.1)',
              color:
                hiddenGames.list.length === 0
                  ? 'rgba(255, 255, 255, 0.3)'
                  : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor:
                hiddenGames.list.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (hiddenGames.list.length > 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              }
            }}
            onMouseOut={(e) => {
              if (hiddenGames.list.length > 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
          </button>
          <div
            style={{
              width: '1px',
              height: '24px',
              background: 'rgba(255, 255, 255, 0.15)'
            }}
          />
          <button
            onClick={handleRestoreSelectedHidden}
            disabled={selectedHiddenGames.length === 0}
            style={{
              background:
                selectedHiddenGames.length === 0
                  ? 'rgba(108, 92, 231, 0.2)'
                  : '#6c5ce7',
              color:
                selectedHiddenGames.length === 0
                  ? 'rgba(255,255,255,0.4)'
                  : '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor:
                selectedHiddenGames.length === 0
                  ? 'not-allowed'
                  : 'pointer',
              transition: 'background 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseOver={(e) => {
              if (selectedHiddenGames.length > 0) {
                e.currentTarget.style.background = '#5844e3'
              }
            }}
            onMouseOut={(e) => {
              if (selectedHiddenGames.length > 0) {
                e.currentTarget.style.background = '#6c5ce7'
              }
            }}
          >
            <span>🔄</span> Restaurar Selecionados
          </button>
          <button
            onClick={handleRestoreAllHidden}
            disabled={hiddenGames.list.length === 0}
            style={{
              background:
                hiddenGames.list.length === 0
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.12)',
              color:
                hiddenGames.list.length === 0
                  ? 'rgba(255,255,255,0.3)'
                  : '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor:
                hiddenGames.list.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (hiddenGames.list.length > 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
              }
            }}
            onMouseOut={(e) => {
              if (hiddenGames.list.length > 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
              }
            }}
          >
            Restaurar Todos
          </button>
        </div>
      )}

      {isMassEditMode && massEditTab === 'hidden' ? (
        hiddenGames.list.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              color: 'rgba(255, 255, 255, 0.5)',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '48px' }}>👁️</span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#fff'
              }}
            >
              Nenhum jogo ocultado
            </span>
            <span style={{ fontSize: '14px' }}>
              Para ocultar jogos, selecione-os na aba "Seleção de Jogos" e
              escolha "Ocultar" na lista de lojas.
            </span>
          </div>
        ) : (
          <div
            className={cx({
              gameList: layout === 'grid',
              gameListLayout: layout === 'list',
              firstLane: isFirstLane,
              allTilesInColor,
              titlesAlwaysVisible
            })}
          >
            {hiddenGames.list.map((item) => {
              const isSelected = selectedHiddenGames.includes(item.appName)
              const override = gameOverrides?.[item.appName]
              const coverSrc =
                item.art_square ||
                item.art_cover ||
                override?.art_square ||
                override?.art_cover ||
                fallBackImage
              const runner = (item.runner || 'other') as Runner
              const storeLabel = getStoreName(runner, 'Outro')

              return (
                <div
                  key={`hidden_${item.appName}`}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#14151a',
                    border: isSelected
                      ? '2px solid #6c5ce7'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: isSelected
                      ? '0 0 15px rgba(108, 92, 231, 0.4)'
                      : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isSelected) {
                      setSelectedHiddenGames(
                        selectedHiddenGames.filter((id) => id !== item.appName)
                      )
                    } else {
                      setSelectedHiddenGames([
                        ...selectedHiddenGames,
                        item.appName
                      ])
                    }
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      zIndex: 10,
                      background: isSelected ? '#6c5ce7' : 'rgba(0,0,0,0.6)',
                      border: '2px solid #fff',
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 'bold',
                      pointerEvents: 'none',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                    }}
                  >
                    {isSelected && '✓'}
                  </div>

                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '2/3',
                      overflow: 'hidden'
                    }}
                  >
                    <CachedImage
                      src={coverSrc}
                      fallback={fallBackImage}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      {storeLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      flex: 1,
                      justifyContent: 'space-between'
                    }}
                  >
                    <span
                      style={{
                        color: '#fff',
                        fontWeight: '600',
                        fontSize: '13px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={item.title}
                    >
                      {item.title}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        hiddenGames.remove(item.appName)
                        setSelectedHiddenGames(
                          selectedHiddenGames.filter((id) => id !== item.appName)
                        )
                      }}
                      style={{
                        background: 'rgba(108, 92, 231, 0.2)',
                        color: '#a29bfe',
                        border: '1px solid #6c5ce7',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#6c5ce7'
                        e.currentTarget.style.color = '#fff'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background =
                          'rgba(108, 92, 231, 0.2)'
                        e.currentTarget.style.color = '#a29bfe'
                      }}
                    >
                      <span>🔄</span> Restaurar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div
          style={
            !filteredLibrary.length ? { backgroundColor: 'transparent' } : {}
          }
          className={cx({
            gameList: layout === 'grid',
            gameListLayout: layout === 'list',
            firstLane: isFirstLane,
            allTilesInColor,
            titlesAlwaysVisible
          })}
          ref={listRef}
        >
          {layout === 'list' && (
            <div className="gameListHeader">
              <span>{t('game.title', 'Game Title')}</span>
              <span>{t('game.status', 'Status')}</span>
              <span>{t('game.store', 'Store')}</span>
              <span>{t('wine.actions', 'Action')}</span>
            </div>
          )}
          {!!visibleLibrary.length &&
            visibleLibrary.map((gameInfo, index) => {
              const { app_name, is_installed, runner } = gameInfo
              const isJustPlayed = (isFavourite || isRecent) && index === 0
              let is_dlc = false
              if (gameInfo.runner !== 'sideload')
                is_dlc = gameInfo.install.is_dlc ?? false
              if (is_dlc || (!is_installed && onlyInstalled)) return null

              const hasUpdate = is_installed && gameUpdates?.includes(app_name)
              const isSelected = selectedGames.some(
                (g) => g.app_name === app_name
              )

              const mainKey = `${app_name}_${runner}`
              const assignedCategory = categoryByGameMap.get(mainKey) || categoryByGameMap.get(app_name) || null
              const isSelectedInline = selectedInlineId === mainKey

              return (
                <div
                  key={`${runner}_${app_name}${isFirstLane ? '_firstlane' : ''}`}
                  style={{
                    position: 'relative',
                    cursor: isMassEditMode ? 'pointer' : 'default',
                    display: 'flex',
                    width: '100%',
                    height: '100%'
                  }}
                  onClickCapture={(e) => {
                    if (isMassEditMode) {
                      e.stopPropagation()
                      e.preventDefault()
                      if (isSelected) {
                        setSelectedGames(
                          selectedGames.filter((g) => g.app_name !== app_name)
                        )
                      } else {
                        setSelectedGames([...selectedGames, gameInfo])
                      }

                      // Dispatch event so HeroPanel updates to display the LAST clicked game!
                      window.dispatchEvent(
                        new CustomEvent('heroicSelectInlineGame', {
                          detail: { game: gameInfo }
                        })
                      )
                    }
                  }}
                >
                  {isMassEditMode && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        zIndex: 10,
                        background: isSelected ? '#4CAF50' : 'rgba(0,0,0,0.6)',
                        border: '2px solid #fff',
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        pointerEvents: 'none',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                      }}
                    >
                      {isSelected && '✓'}
                    </div>
                  )}
                  <div
                    style={{
                      pointerEvents: isMassEditMode ? 'none' : 'auto',
                      opacity: isMassEditMode && !isSelected ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                      width: '100%',
                      height: '100%'
                    }}
                  >
                    <GameCard
                      hasUpdate={hasUpdate}
                      handleGameCardClick={handleGameCardClick}
                      forceCard={layout === 'grid'}
                      isRecent={isRecent}
                      gameInfo={gameInfo}
                      justPlayed={isJustPlayed}
                      dataTour={index === 0 ? 'library-game-card' : undefined}
                      isSelectedInline={isSelectedInline}
                      assignedCategory={assignedCategory}
                      shouldShowIcons={shouldShowIcons}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </>
  )
}

export default memo(GamesList)
