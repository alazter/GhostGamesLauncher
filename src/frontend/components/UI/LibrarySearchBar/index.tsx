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

const BRAND_COLORS: Record<string, string> = {
  steam: '#1b2838',
  epic: '#333333',
  gog: '#5c2d91',
  amazon: '#232f3e',
  zoom: '#009aeb',
  sideloaded: '#555555',
  xbox: '#107c10',
  ubisoft: '#000000',
  ea: '#f56c2d',
}


interface CustomStore {
  id: string
  name: string
  icon: string | null
  isVisible?: boolean
}

export default function LibrarySearchBar({ children }: { children?: ReactNode }) {
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

  useEffect(() => {
    const handleStoresChange = () => {
      const saved = localStorage.getItem('heroic_custom_stores')
      if (saved) setCustomStores(JSON.parse(saved) as CustomStore[])
    }
    window.addEventListener('customStoresChanged', handleStoresChange)
    return () =>
      window.removeEventListener('customStoresChanged', handleStoresChange)
  }, [])

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
      {game.title} <span>({RUNNER_TO_STORE[game.runner] || game.runner})</span>
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
        para que ela não esmague os botões que vêm ao lado! 
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
        <div data-tour="library-search">
          <SearchBar
            suggestionsListItems={suggestions}
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
            flexShrink: 0
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
          boxSizing: 'border-box'
        }}
      >
        {customStores
          .filter((store) => store.isVisible !== false)
          .map((store) => {
            const imageSource = store.icon
              ? store.icon
              : `/images/${store.id}.png`
            const isActive = activeFilter === store.id
            const brandColor = BRAND_COLORS[store.id] || '#444'

            return (
              <button
                key={store.id}
                onClick={() => handleFilterClick(store.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: isActive ? '500' : '400',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  opacity: isActive ? 1.0 : 0.55,
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '0.9'
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '0.55'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                {(DISPLAY_MODE === 'icon-text' ||
                  DISPLAY_MODE === 'icon-only') && (
                  <img
                    src={imageSource}
                    alt={store.name}
                    style={{
                      width: '20px',
                      height: '20px',
                      objectFit: 'contain'
                    }}
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
