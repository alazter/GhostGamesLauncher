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
import PathSelectionBox from '../PathSelectionBox'
import { SGDBGame, SGDBGrid } from 'common/types'

interface Props {
  initialTitle: string
  onSelect: (url: string) => void
  onClose: () => void
  mode?: 'grids' | 'heroes'
  dimensions?: string[]
  styles?: string[]
  hideCloseButton?: boolean
  onCancel?: () => void
  onFinish?: () => void
  isFinishDisabled?: boolean
}

const DEFAULT_GRID_DIMENSIONS = ['600x900', '342x482', '660x930']
const DEFAULT_GRID_STYLES = [
  'material',
  'alternate',
  'blurred',
  'white_logo',
  'no_logo'
]

export default function SteamGridDBPicker({
  initialTitle,
  onSelect,
  onClose,
  mode = 'grids',
  dimensions,
  styles,
  hideCloseButton = false,
  onCancel,
  onFinish,
  isFinishDisabled = false
}: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(initialTitle)
  const [games, setGames] = useState<SGDBGame[]>([])
  const [grids, setGrids] = useState<SGDBGrid[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [fetchingMore, setFetchingMore] = useState(false)

  const handleSelectGame = useCallback(
    async (gameId: number) => {
      setSelectedGameId(gameId)
      setLoading(true)
      setError(null)
      setGrids([])
      setPage(0)
      setHasMore(true)
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
          dimensions: fetchDims,
          page: 0
        })
        setGrids(results)
        if (results.length === 0) {
          setError(
            t('steamgriddb.error.no-grids', 'No covers found for this game.')
          )
        }
        if (results.length < 50) {
          setHasMore(false)
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

  const handleLoadMore = useCallback(async () => {
    if (selectedGameId === null || fetchingMore || !hasMore) return
    setFetchingMore(true)
    const nextPage = page + 1
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
        gameId: selectedGameId,
        styles: fetchStyles,
        dimensions: fetchDims,
        page: nextPage
      })
      if (results.length > 0) {
        setGrids((prev) => [...prev, ...results])
        setPage(nextPage)
      }
      if (results.length < 50) {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to load more grids:', err)
    } finally {
      setFetchingMore(false)
    }
  }, [selectedGameId, page, fetchingMore, hasMore, mode, dimensions, styles])

  const [hasApiKey, setHasApiKey] = useState(true)

  const searchGames = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery) return

      const keyExists = await window.api.steamgriddb.hasApiKey()
      setHasApiKey(keyExists)
      if (!keyExists) {
        setError(
          t(
            'steamgriddb.error.missing-key',
            'Chave de API do SteamGridDB não configurada. Por favor, adicione sua chave de API nas Configurações Gerais do Launcher.'
          )
        )
        return
      }

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
        </div>
        {!hideCloseButton && (
          <button
            className="SteamGridDBPicker__close-btn"
            onClick={onClose}
            title={t('button.back', 'Go Back')}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
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
        <div className="SteamGridDBPicker__scroll-container">
          <div className="SteamGridDBPicker__grids">
            {grids.map((grid) => {
              const cleanThumb = grid.thumb.split('?')[0].toLowerCase();
              const isVideo = cleanThumb.endsWith('.webm') || cleanThumb.endsWith('.mp4');
              return (
                <div
                  key={grid.id}
                  className="SteamGridDBPicker__grid-item"
                  onClick={() => onSelect(grid.url)}
                >
                  {isVideo ? (
                    <video
                      src={grid.thumb}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ) : (
                    <CachedImage src={grid.thumb} />
                  )}
                </div>
              );
            })}
          </div>

          {selectedGameId && hasMore && (
            <div className="SteamGridDBPicker__load-more" style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 20px 0' }}>
              <button
                type="button"
                className="button outline"
                disabled={fetchingMore}
                onClick={handleLoadMore}
                style={{
                  padding: '8px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderColor: 'var(--accent, #3cf2e6)',
                  color: 'var(--accent, #3cf2e6)',
                  background: 'transparent',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => {
                  if (!fetchingMore) {
                    e.currentTarget.style.background = 'var(--accent, #3cf2e6)';
                    e.currentTarget.style.color = '#12161a';
                  }
                }}
                onMouseOut={(e) => {
                  if (!fetchingMore) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--accent, #3cf2e6)';
                  }
                }}
              >
                {fetchingMore ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    {t('steamgriddb.picker.loading-more', 'Loading...')}
                  </span>
                ) : (
                  t('steamgriddb.picker.load-more', 'Carregar mais capas')
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {!selectedGameId && (
        <div className="SteamGridDBPicker__manual-selection">
          <PathSelectionBox
            htmlId="steamgriddb-manual-cover"
            type="file"
            path=""
            placeholder={t(
              'steamgriddb.picker.manual-cover',
              'Select image manually...'
            )}
            pathDialogTitle={t(
              'steamgriddb.picker.select-image-title',
              'Select Image'
            )}
            pathDialogFilters={[
              {
                name: 'Images',
                extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp']
              }
            ]}
            onPathChange={(selectedPath) => {
              if (selectedPath) {
                onSelect(selectedPath)
              }
            }}
            noDeleteButton={true}
          />
        </div>
      )}

      {/* Picker Footer Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        paddingTop: '12px',
        marginTop: 'auto',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingBottom: '4px',
        gap: '12px'
      }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="button is-secondary"
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {t('button.cancel', 'Cancelar')}
          </button>
        )}
        {onFinish && (
          <button
            type="button"
            onClick={onFinish}
            className="button is-success"
            disabled={isFinishDisabled}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {t('button.finish', 'Terminar')}
          </button>
        )}
      </div>
    </div>
  )
}
