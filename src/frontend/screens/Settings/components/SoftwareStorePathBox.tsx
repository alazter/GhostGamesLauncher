import React, {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBackspace,
  faFolderOpen,
  faToolbox
} from '@fortawesome/free-solid-svg-icons'
import ContextProvider from 'frontend/state/ContextProvider'
import { CustomStore } from 'frontend/types'
import { GameInfo } from 'common/types'
import {
  findMatchingSoftwareByPath,
  findPrimarySoftwareStore,
  getSoftwareStoreItems,
  normalizeExecutablePathComparison
} from 'frontend/helpers/softwareStoreItems'
import CachedImage from 'frontend/components/UI/CachedImage'
import { gameOverridesStore } from 'frontend/helpers/electronStores'
import './SoftwareStorePathBox.scss'

interface SoftwareThumbnailProps {
  src?: string
  fallback?: string
  alt?: string
  className?: string
}

const SoftwareThumbnail: React.FC<SoftwareThumbnailProps> = ({
  src,
  fallback,
  alt = '',
  className
}) => {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src, fallback])

  if (!src || hasError) {
    return (
      <span className="SoftwareStorePathBox__defaultIcon" aria-hidden="true">
        🧰
      </span>
    )
  }

  return (
    <CachedImage
      src={src}
      fallback={fallback}
      alt={alt}
      loading="eager"
      hideOnError={false}
      className={className}
      onError={() => setHasError(true)}
    />
  )
}

function readCustomStoresFromStorage(): CustomStore[] {
  try {
    const raw = localStorage.getItem('heroic_custom_stores')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readAssignmentsFromStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem('heroic_game_assignments')
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function useSoftwareStoreCatalog(excludeAppName?: string) {
  const { sideloadedLibrary, epic, gog, amazon, zoom, steam } =
    useContext(ContextProvider)

  const [customStores, setCustomStores] = useState<CustomStore[]>(() =>
    readCustomStoresFromStorage()
  )
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    readAssignmentsFromStorage()
  )

  useEffect(() => {
    const syncStorage = () => {
      setCustomStores(readCustomStoresFromStorage())
      setAssignments(readAssignmentsFromStorage())
    }
    window.addEventListener('storage', syncStorage)
    window.addEventListener('customStoresChanged', syncStorage)
    window.addEventListener('gameAssignmentsChanged', syncStorage)
    return () => {
      window.removeEventListener('storage', syncStorage)
      window.removeEventListener('customStoresChanged', syncStorage)
      window.removeEventListener('gameAssignmentsChanged', syncStorage)
    }
  }, [])

  const allGames = useMemo<GameInfo[]>(() => {
    const combined: GameInfo[] = [
      ...(sideloadedLibrary || []),
      ...(epic?.library || []),
      ...(gog?.library || []),
      ...(amazon?.library || []),
      ...(zoom?.library || []),
      ...(steam?.library || [])
    ]
    return combined
  }, [
    sideloadedLibrary,
    epic?.library,
    gog?.library,
    amazon?.library,
    zoom?.library,
    steam?.library
  ])

  const primarySoftwareStore = useMemo(
    () => findPrimarySoftwareStore(customStores),
    [customStores]
  )

  const gameOverrides = useMemo(() => {
    try {
      return (
        (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}
      )
    } catch {
      return {}
    }
  }, [])

  const softwareStoreItems = useMemo(
    () =>
      getSoftwareStoreItems({
        allGames,
        customStores,
        assignments,
        storeFilter: 'softwares',
        excludeAppName,
        gameOverrides
      }),
    [allGames, customStores, assignments, excludeAppName, gameOverrides]
  )

  const allAvailableItems = useMemo(
    () =>
      getSoftwareStoreItems({
        allGames,
        customStores,
        assignments,
        storeFilter: 'all',
        excludeAppName,
        gameOverrides
      }),
    [allGames, customStores, assignments, excludeAppName, gameOverrides]
  )

  return {
    allGames,
    customStores,
    assignments,
    primarySoftwareStore,
    primaryStoreName: primarySoftwareStore?.name || 'Softwares',
    softwareStoreItems,
    allAvailableItems
  }
}

interface SoftwareStorePathBoxProps {
  htmlId: string
  label: ReactNode
  path: string
  onPathChange: (newPath: string) => void
  placeholder?: string
  pathDialogTitle: string
  pathDialogDefaultPath?: string
  excludeAppName?: string
  children?: ReactNode
}

const SoftwareStorePathBox: React.FC<SoftwareStorePathBoxProps> = ({
  htmlId,
  label,
  path,
  onPathChange,
  placeholder,
  pathDialogTitle,
  pathDialogDefaultPath,
  excludeAppName,
  children
}) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    allGames,
    customStores,
    assignments,
    primaryStoreName,
    softwareStoreItems,
    allAvailableItems
  } = useSoftwareStoreCatalog(excludeAppName)

  const [tmpPath, setTmpPath] = useState(path)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState<string>('softwares')

  useEffect(() => {
    setTmpPath(path)
  }, [path])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredItems = useMemo(
    () =>
      getSoftwareStoreItems({
        allGames,
        customStores,
        assignments,
        storeFilter,
        searchQuery: searchFilter,
        excludeAppName
      }),
    [allGames, customStores, assignments, storeFilter, searchFilter, excludeAppName]
  )

  const matchedSoftware = useMemo(
    () => findMatchingSoftwareByPath(tmpPath || path, allAvailableItems),
    [tmpPath, path, allAvailableItems]
  )

  const localFileName = useMemo(() => {
    const active = (tmpPath || path || '').trim()
    if (!active || matchedSoftware) return ''
    const parts = active.split(/[\\/]/)
    return parts[parts.length - 1] || active
  }, [tmpPath, path, matchedSoftware])

  const handleBrowseFolder = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const effectiveDefaultPath =
      tmpPath || path || pathDialogDefaultPath || undefined

    window.api
      .openDialog({
        buttonLabel: t('box.choose', 'Escolher'),
        properties: ['openFile'],
        title: pathDialogTitle,
        defaultPath: effectiveDefaultPath
      })
      .then((selectedPath) => {
        if (selectedPath) {
          setTmpPath(selectedPath)
          onPathChange(selectedPath)
          setDropdownOpen(false)
        }
      })
  }

  const handleSelectSoftwarePath = (executablePath: string) => {
    setTmpPath(executablePath)
    onPathChange(executablePath)
    setDropdownOpen(false)
    setSearchFilter('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setTmpPath('')
    onPathChange('')
    setSearchFilter('')
  }

  const currentNormPath = normalizeExecutablePathComparison(tmpPath || path)

  return (
    <div className="SoftwareStorePathBox" ref={containerRef}>
      <label htmlFor={htmlId} className="SoftwareStorePathBox__subLabel">
        <span>{label}</span>
      </label>

      {matchedSoftware && (
        <div
          className="SoftwareStorePathBox__linkedBadge"
          data-testid={`${htmlId}-linked-badge`}
        >
          <SoftwareThumbnail
            src={matchedSoftware.iconUrl}
            fallback={matchedSoftware.fallbackIconUrl}
            alt={matchedSoftware.title}
            className="SoftwareStorePathBox__badgeIcon"
          />
          <span>
            Vinculado da{' '}
            <span className="store-tag">Loja {matchedSoftware.storeName}</span>:{' '}
            <strong>{matchedSoftware.title}</strong>
          </span>
        </div>
      )}

      {!matchedSoftware && Boolean(localFileName) && (
        <div
          className="SoftwareStorePathBox__linkedBadge"
          data-testid={`${htmlId}-local-badge`}
        >
          <span>📁</span>
          <span>
            Selecionado via <span className="store-tag">Pasta Local</span>:{' '}
            <strong>{localFileName}</strong>
          </span>
        </div>
      )}

      <div className="SoftwareStorePathBox__inputRow">
        <input
          id={htmlId}
          type="text"
          className="SoftwareStorePathBox__input"
          value={tmpPath}
          placeholder={
            placeholder ||
            t(
              'box.select.script',
              'Selecionar software (.exe) da Loja Softwares ou procurar no PC...'
            )
          }
          onChange={(e) => {
            const val = e.target.value
            setTmpPath(val)
          }}
          onFocus={() => {
            if (softwareStoreItems.length > 0 || allAvailableItems.length > 0) {
              setDropdownOpen(true)
            }
          }}
          onBlur={(e) => {
            if (e.target.value !== path) {
              onPathChange(e.target.value)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onPathChange(tmpPath)
              setDropdownOpen(false)
            } else if (e.key === 'Escape') {
              setDropdownOpen(false)
            }
          }}
        />

        <div className="SoftwareStorePathBox__actions">
          <button
            type="button"
            className={`SoftwareStorePathBox__storePickerBtn ${dropdownOpen ? 'is-open' : ''}`}
            title={`Selecionar um aplicativo cadastrado na sua Loja ${primaryStoreName}`}
            aria-label={`Abrir lista da Loja ${primaryStoreName}`}
            aria-expanded={dropdownOpen}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDropdownOpen((prev) => !prev)
            }}
          >
            <FontAwesomeIcon icon={faToolbox} />
            <span>Loja {primaryStoreName} ▾</span>
          </button>

          <button
            type="button"
            className="SoftwareStorePathBox__iconBtn"
            title={
              pathDialogTitle ||
              t(
                'box.choose',
                'Procurar executável no computador (Explorador de Arquivos)'
              )
            }
            aria-label={
              pathDialogTitle ||
              t(
                'box.choose',
                'Procurar executável no computador (Explorador de Arquivos)'
              )
            }
            onClick={handleBrowseFolder}
          >
            <FontAwesomeIcon icon={faFolderOpen} />
          </button>

          {Boolean(tmpPath || path) && (
            <button
              type="button"
              className="SoftwareStorePathBox__iconBtn SoftwareStorePathBox__iconBtn--clear"
              title={t('box.clear', 'Limpar caminho')}
              aria-label={t('box.clear', 'Limpar caminho')}
              onClick={handleClear}
            >
              <FontAwesomeIcon icon={faBackspace} />
            </button>
          )}
        </div>

        {dropdownOpen && (
          <div
            className="SoftwareStorePathBox__dropdown"
            role="listbox"
            aria-label={`Softwares disponíveis na Loja ${primaryStoreName}`}
          >
            <div
              className="SoftwareStorePathBox__dropdownHeader"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                className="SoftwareStorePathBox__dropdownSearch"
                placeholder="🔍 Filtrar software pelo nome ou caminho..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              <select
                className="SoftwareStorePathBox__storeSelect"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                aria-label="Filtrar por loja personalizada"
              >
                <option value="softwares">
                  🏪 Loja: {primaryStoreName} ({softwareStoreItems.length})
                </option>
                <option value="all">
                  Todas as Lojas Personalizadas ({allAvailableItems.length})
                </option>
                {customStores
                  .filter(
                    (s) =>
                      !s.name.toLowerCase().includes('software') &&
                      !s.id.toLowerCase().includes('software')
                  )
                  .map((store) => (
                    <option key={store.id} value={store.id}>
                      🏪 Loja: {store.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="SoftwareStorePathBox__list">
              {filteredItems.length === 0 ? (
                <div className="SoftwareStorePathBox__emptyState">
                  <span>
                    {storeFilter === 'softwares'
                      ? `Nenhum software encontrado na Loja "${primaryStoreName}"${searchFilter ? ' com esse filtro' : ''}.`
                      : 'Nenhum aplicativo ou executável encontrado com esse filtro.'}
                  </span>
                  {storeFilter === 'softwares' &&
                    allAvailableItems.length > 0 && (
                      <button
                        type="button"
                        className="SoftwareStorePathBox__emptyActionBtn"
                        onClick={() => setStoreFilter('all')}
                      >
                        Ver itens de todas as lojas ({allAvailableItems.length})
                      </button>
                    )}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isActive =
                    currentNormPath ===
                    normalizeExecutablePathComparison(item.executablePath)
                  return (
                    <button
                      key={`${item.appName}-${item.executablePath}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`SoftwareStorePathBox__item ${isActive ? 'is-active' : ''}`}
                      onClick={() =>
                        handleSelectSoftwarePath(item.executablePath)
                      }
                    >
                      <div className="SoftwareStorePathBox__itemInfo">
                        <div className="SoftwareStorePathBox__itemIcon">
                          <SoftwareThumbnail
                            src={item.iconUrl}
                            fallback={item.fallbackIconUrl}
                            alt={item.title}
                          />
                        </div>
                        <div className="SoftwareStorePathBox__itemText">
                          <span className="SoftwareStorePathBox__itemName">
                            {item.title}
                          </span>
                          <span
                            className="SoftwareStorePathBox__itemPath"
                            title={item.executablePath}
                          >
                            {item.executablePath}
                          </span>
                        </div>
                      </div>
                      <span className="SoftwareStorePathBox__useBadge">
                        {isActive ? '✓ Selecionado' : 'Usar este'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {Boolean(path) && children && (
        <div className="SoftwareStorePathBox__toggleContainer">{children}</div>
      )}
    </div>
  )
}

export default SoftwareStorePathBox
