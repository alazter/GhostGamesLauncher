import './index.scss'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSpinner,
  faSearch,
  faTimes,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons'
import CachedImage from 'frontend/components/UI/CachedImage'
import TextInputWithIconField from 'frontend/components/UI/TextInputWithIconField'
import { SGDBGame, SGDBGrid } from 'common/types'

interface Props {
  initialTitle: string
  onSelect: (url: string) => void
  onClose: () => void
  mode?: 'grids' | 'heroes'
  dimensions?: string[]
  styles?: string[]
  hideCloseButton?: boolean
}

const DEFAULT_GRID_DIMENSIONS = ['600x900', '342x482', '660x930']
const DEFAULT_GRID_STYLES = ['material', 'alternate', 'blurred']

export default function SteamGridDBPicker({
  initialTitle,
  onSelect,
  onClose,
  mode = 'grids',
  dimensions,
  styles,
  hideCloseButton = false
}: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(initialTitle)
  const [games, setGames] = useState<SGDBGame[]>([])
  const [grids, setGrids] = useState<SGDBGrid[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelectGame = useCallback(
    async (gameId: number) => {
      setSelectedGameId(gameId)
      setLoading(true)
      setError(null)
      setGrids([])
      try {
        const fetcher =
          mode === 'heroes'
            ? window.api.steamgriddb.getHeroes
            : window.api.steamgriddb.getGrids
        const fetchDims =
          dimensions ?? (mode === 'heroes' ? [] : DEFAULT_GRID_DIMENSIONS)
        const fetchStyles =
          styles ?? (mode === 'heroes' ? [] : DEFAULT_GRID_STYLES)
        const results = await fetcher({
          gameId,
          styles: fetchStyles,
          dimensions: fetchDims
        })
        setGrids(results)
        if (results.length === 0) {
          setError(
            t('steamgriddb.error.no-grids', 'No covers found for this game.')
          )
        }
      } catch (err) {
        setError(t('steamgriddb.error.grids', 'Failed to fetch grids'))
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [t, mode, dimensions, styles]
  )

  const searchGames = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery) return
      setLoading(true)
      setError(null)
      setGrids([])
      setGames([])
      setSelectedGameId(null)
      try {
        const results = await window.api.steamgriddb.searchGame(searchQuery)
        setGames(results)
        if (results.length === 1) {
          void handleSelectGame(results[0].id)
        } else if (results.length === 0) {
          setError(t('steamgriddb.error.no-games', 'No games found.'))
        }
      } catch (err) {
        setError(
          t(
            'steamgriddb.error.search',
            'Failed to search for games, please check your SteamGridDB API key and try again'
          )
        )
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [t, handleSelectGame]
  )

  const goBack = () => {
    setSelectedGameId(null)
    setGrids([])
    setError(null)
  }

  useEffect(() => {
    if (initialTitle) {
      void searchGames(initialTitle)
    }
  }, [initialTitle, searchGames])

  useEffect(() => {
    if (selectedGameId !== null) {
      void handleSelectGame(selectedGameId)
    }
  }, [mode, selectedGameId, handleSelectGame])

  return (
    <div className={`SteamGridDBPicker SteamGridDBPicker--${mode}`}>
      <div className="SteamGridDBPicker__header">
        <div className="SteamGridDBPicker__title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(selectedGameId || hideCloseButton) && (
            <button 
              className="button is-ghost" 
              onClick={selectedGameId ? goBack : onClose}
              style={{
                backgroundColor: 'var(--accent, #3cf2e6)',
                color: '#12161a',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'transform 0.2s, background-color 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)'
                e.currentTarget.style.backgroundColor = 'var(--accent-hover, #2ad1c5)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.backgroundColor = 'var(--accent, #3cf2e6)'
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ color: '#12161a', fontSize: '14px' }} />
            </button>
          )}
          <h3 style={{ margin: 0 }}>{t('steamgriddb.picker.title', 'SteamGridDB Covers')}</h3>
          {!hideCloseButton && (
            <button
              className="SteamGridDBPicker__back-btn"
              onClick={onClose}
              title={t('button.back', 'Go Back')}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      </div>

      {!selectedGameId && (
        <div style={{ paddingLeft: '12px', paddingRight: '12px' }}>
          <TextInputWithIconField
            htmlId="steamgriddb-search"
            label={t('steamgriddb.picker.search', 'Search Game')}
            value={query}
            onChange={setQuery}
            icon={<FontAwesomeIcon icon={faSearch} />}
            onIconClick={() => void searchGames(query)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void searchGames(query)
              }
            }}
          />
        </div>
      )}

      {loading && (
        <div className="SteamGridDBPicker__loading">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
        </div>
      )}

      {error && <div className="SteamGridDBPicker__error">{error}</div>}

      {!loading && games.length > 1 && !selectedGameId && (
        <div className="SteamGridDBPicker__games">
          <h4>{t('steamgriddb.picker.select-game', 'Select a Game:')}</h4>
          <ul>
            {games.map((game) => (
              <li key={game.id} onClick={() => void handleSelectGame(game.id)}>
                {game.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && grids.length > 0 && (
        <div className="SteamGridDBPicker__grids">
          {grids.map((grid) => (
            <div
              key={grid.id}
              className="SteamGridDBPicker__grid-item"
              onClick={() => onSelect(grid.url)}
            >
              <CachedImage src={grid.thumb} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
