import {
  faBorderAll,
  faList,
  faSyncAlt,
  faArrowDownAZ,
  faArrowDownZA,
  faHardDrive as hardDriveSolid,
  faFilter,
  faFilterCircleXmark,
  faImage,
  faRotate,
  faSkullCrossbones,
  faGlobe,
  faChevronDown,
  faBolt,
  faCheck
} from '@fortawesome/free-solid-svg-icons'
import { faHardDrive as hardDriveLight } from '@fortawesome/free-regular-svg-icons'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import FormControl from '../FormControl'
import SteamGridBatchModal from '../SteamGridBatchModal'
import {
  findPiratasStoreInfo,
  findPiratasStoreId,
  syncPiratasStoreAssignments,
  getDefaultDownloadStoreId,
  setDefaultDownloadStoreId,
  getUpdateCheckScope,
  setUpdateCheckScope,
  getUpdateCheckScopeInfo,
  getAvailableCustomStores,
  UpdateCheckScopeInfo
} from 'frontend/helpers/autoStoreAssignments'
import './index.css'
import classNames from 'classnames'
import LibraryContext from 'frontend/screens/Library/LibraryContext'

interface ActionIconsProps {
  'data-tour'?: string
}

export default React.memo(function ActionIcons({
  'data-tour': dataTour
}: ActionIconsProps = {}) {
  const { t } = useTranslation()
  const { refreshLibrary, refreshing, sideloadedLibrary } = useContext(ContextProvider)
  const [showSteamGridModal, setShowSteamGridModal] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isCheckingPiratas, setIsCheckingPiratas] = useState(false)
  const [piratasUpdatesCount, setPiratasUpdatesCount] = useState(0)
  const [piratasStoreName, setPiratasStoreName] = useState(() => findPiratasStoreInfo().name)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [scopeInfo, setScopeInfo] = useState<UpdateCheckScopeInfo>(() => getUpdateCheckScopeInfo())
  const [showScopeMenu, setShowScopeMenu] = useState(false)
  const scopeMenuRef = useRef<HTMLDivElement>(null)

  const updatePiratasState = useCallback(async () => {
    try {
      const info = findPiratasStoreInfo()
      setPiratasStoreName(info.name)
      setScopeInfo(getUpdateCheckScopeInfo())
      if (window.api?.externalGamesState) {
        const state = await window.api.externalGamesState()
        const count = (state?.installations || []).filter((i: any) => Boolean(i.availableUpdate)).length
        setPiratasUpdatesCount(count)
      }
    } catch {}
  }, [])

  const gameCounts = useMemo(() => {
    const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
    let currentAssignments: Record<string, string> = {}
    try { currentAssignments = JSON.parse(rawAssignments) } catch {}

    const counts: Record<string, number> = { all: 0 }
    if (!sideloadedLibrary?.length) return counts

    for (const game of sideloadedLibrary) {
      counts.all++
      const assigned = currentAssignments[game.app_name]
      if (assigned) {
        counts[assigned] = (counts[assigned] || 0) + 1
      } else {
        const defId = findPiratasStoreId()
        counts[defId] = (counts[defId] || 0) + 1
      }
    }
    return counts
  }, [sideloadedLibrary])

  useEffect(() => {
    void updatePiratasState()
    const handleStoreChange = () => void updatePiratasState()
    const handleScopeChange = () => setScopeInfo(getUpdateCheckScopeInfo())

    window.addEventListener('customStoresChanged', handleStoreChange)
    window.addEventListener('defaultDownloadStoreChanged', handleStoreChange)
    window.addEventListener('heroicExternalGamesChanged', handleStoreChange)
    window.addEventListener('ghostUpdateCheckScopeChanged', handleScopeChange)

    let unsub: (() => void) | undefined
    if (window.api?.onExternalGamesUpdated) {
      unsub = window.api.onExternalGamesUpdated(() => {
        void updatePiratasState()
      })
    }
    return () => {
      window.removeEventListener('customStoresChanged', handleStoreChange)
      window.removeEventListener('defaultDownloadStoreChanged', handleStoreChange)
      window.removeEventListener('heroicExternalGamesChanged', handleStoreChange)
      window.removeEventListener('ghostUpdateCheckScopeChanged', handleScopeChange)
      unsub?.()
    }
  }, [updatePiratasState])

  useEffect(() => {
    if (!showScopeMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (scopeMenuRef.current && !scopeMenuRef.current.contains(e.target as Node)) {
        setShowScopeMenu(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowScopeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showScopeMenu])

  const handleSelectScope = (newScope: string) => {
    setUpdateCheckScope(newScope)
    setScopeInfo(getUpdateCheckScopeInfo())
    if (newScope !== 'all') {
      setDefaultDownloadStoreId(newScope)
    }
    setShowScopeMenu(false)
    const updated = getUpdateCheckScopeInfo()
    setToast({
      message: updated.isAll
        ? '🎯 Escopo definido: Busca Completa (todos os jogos não-oficiais).'
        : `🎯 Escopo definido: Loja ${updated.name}.`,
      type: 'info'
    })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  const handleCheckPiratasUpdates = async () => {
    if (isCheckingPiratas) return
    setIsCheckingPiratas(true)
    setToast(null)
    setShowScopeMenu(false)
    try {
      void syncPiratasStoreAssignments()

      const currentScopeInfo = getUpdateCheckScopeInfo()
      const isAll = currentScopeInfo.isAll
      const targetStoreId = isAll ? null : currentScopeInfo.scope

      const rawAssignments = localStorage.getItem('heroic_game_assignments') || '{}'
      let currentAssignments: Record<string, string> = {}
      try { currentAssignments = JSON.parse(rawAssignments) } catch {}

      const eligibleAppNames: string[] = []

      if (window.api?.externalGamesGetOrCreateInstallation && sideloadedLibrary?.length) {
        for (const game of sideloadedLibrary) {
          const assigned = currentAssignments[game.app_name]
          const isEligible = isAll
            ? true
            : (assigned === targetStoreId || (!assigned && (targetStoreId === findPiratasStoreId() || targetStoreId === 'piratas' || targetStoreId?.includes('pirata'))))

          if (isEligible) {
            eligibleAppNames.push(game.app_name)
            try {
              await window.api.externalGamesGetOrCreateInstallation(game.app_name, game)
            } catch {}
          }
        }
      }

      let result: { success: boolean; message: string; updatesFound?: number } | undefined
      if (window.api?.externalGamesCheckPiratasUpdates) {
        result = await window.api.externalGamesCheckPiratasUpdates(true, {
          scope: currentScopeInfo.scope,
          appNames: isAll ? undefined : eligibleAppNames
        })
      }

      await updatePiratasState()
      refreshLibrary({ checkForUpdates: true })
      window.dispatchEvent(new Event('heroicExternalGamesChanged'))

      const count = result?.updatesFound ?? 0
      if (count > 0) {
        setToast({
          message: isAll
            ? `⚡ ${count} nova(s) atualização(ões) encontrada(s) em jogos não-oficiais!`
            : `⚡ ${count} nova(s) atualização(ões) encontrada(s) na loja ${currentScopeInfo.name}!`,
          type: 'success'
        })
      } else {
        setToast({
          message: isAll
            ? `🛡️ Todos os jogos fora das lojas oficiais estão na versão mais recente.`
            : `🛡️ Todos os jogos da loja ${currentScopeInfo.name} estão na versão mais recente.`,
          type: 'info'
        })
      }
    } catch (err) {
      const currentScopeInfo = getUpdateCheckScopeInfo()
      setToast({
        message: currentScopeInfo.isAll
          ? 'Não foi possível consultar as atualizações dos jogos não-oficiais.'
          : `Não foi possível consultar as atualizações da loja ${currentScopeInfo.name}.`,
        type: 'error'
      })
    } finally {
      setIsCheckingPiratas(false)
      setTimeout(() => {
        setToast(null)
      }, 4500)
    }
  }

  const handleReconnectCovers = async () => {
    if (isReconnecting) return
    setIsReconnecting(true)
    try {
      if ((window.api as any)?.clearImageCacheNegative) {
        await (window.api as any).clearImageCacheNegative()
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('heroicReconnectPendingCovers'))
    setTimeout(() => {
      setIsReconnecting(false)
    }, 1500)
  }
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
  const [actionIconsDefaultBgColor, setActionIconsDefaultBgColor] = useState<string>(() => {
    return localStorage.getItem('heroic_action_icons_default_bg_color') || '#ffffff'
  })
  const [actionIconsDefaultBgOpacity, setActionIconsDefaultBgOpacity] = useState<number>(() => {
    return Number(localStorage.getItem('heroic_action_icons_default_bg_opacity') || '0.05')
  })

  useEffect(() => {
    const handleSettingsChange = () => {
      setActionIconsGlowMode(localStorage.getItem('heroic_action_icons_glow_mode') || 'disabled')
      setActionIconsColor1(localStorage.getItem('heroic_action_icons_color1') || '#00ffff')
      setActionIconsColor2(localStorage.getItem('heroic_action_icons_color2') || '#38d9e6')
      setActionIconsGradient(localStorage.getItem('heroic_action_icons_gradient') === 'true')
      setActionIconsOpacity(Number(localStorage.getItem('heroic_action_icons_opacity') || '1'))
      setActionIconsGlowStrength(Number(localStorage.getItem('heroic_action_icons_glow_strength') || '8'))
      setActionIconsGlowColor(localStorage.getItem('heroic_action_icons_glow_color') || '#00ffff')
      setActionIconsSyncGlowWithGradient(localStorage.getItem('heroic_action_icons_sync_glow_with_gradient') !== 'false')
      setActionIconsDefaultBgColor(localStorage.getItem('heroic_action_icons_default_bg_color') || '#ffffff')
      setActionIconsDefaultBgOpacity(Number(localStorage.getItem('heroic_action_icons_default_bg_opacity') || '0.05'))
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () =>
      window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [])

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

  const rgb1 = hexToRgb(actionIconsColor1)
  const rgb2 = hexToRgb(actionIconsColor2)
  const rgbGlow = hexToRgb(actionIconsGlowColor)
  const rgbDefaultBg = hexToRgb(actionIconsDefaultBgColor)

  const effectiveGlow1 = actionIconsSyncGlowWithGradient ? actionIconsColor1 : actionIconsGlowColor
  const effectiveGlow2 = actionIconsSyncGlowWithGradient ? actionIconsColor2 : actionIconsGlowColor
  const effectiveRgbGlow1 = actionIconsSyncGlowWithGradient ? rgb1 : rgbGlow
  const effectiveRgbGlow2 = actionIconsSyncGlowWithGradient ? rgb2 : rgbGlow

  const {
    handleLayout,
    layout,
    sortDescending,
    setSortDescending,
    sortInstalled,
    setSortInstalled,
    showAlphabetFilter,
    onToggleAlphabetFilter
  } = useContext(LibraryContext)

  return (
    <div
      className={classNames('ActionIcons', {
        'action-icons--neon': actionIconsGlowMode === 'neon',
        'action-icons--gradient': actionIconsGradient
      })}
      style={{
        '--action-color-1': actionIconsColor1,
        '--action-color-2': actionIconsColor2,
        '--action-glow-color-1': effectiveGlow1,
        '--action-glow-color-2': effectiveGlow2,
        '--action-opacity': actionIconsOpacity,
        '--action-glow-strength': `${actionIconsGlowStrength}px`,
        '--action-glow-rgba-1': `rgba(${effectiveRgbGlow1.r}, ${effectiveRgbGlow1.g}, ${effectiveRgbGlow1.b}, ${Math.min(1, 0.9 * actionIconsOpacity)})`,
        '--action-glow-rgba-2': `rgba(${effectiveRgbGlow2.r}, ${effectiveRgbGlow2.g}, ${effectiveRgbGlow2.b}, ${Math.min(1, 0.9 * actionIconsOpacity)})`,
        '--action-default-bg-color': `rgba(${rgbDefaultBg.r}, ${rgbDefaultBg.g}, ${rgbDefaultBg.b}, ${actionIconsDefaultBgOpacity})`,
        '--action-default-border-color': `rgba(${rgbDefaultBg.r}, ${rgbDefaultBg.g}, ${rgbDefaultBg.b}, ${Math.min(1, actionIconsDefaultBgOpacity * 2)})`,
        '--action-default-bg-hover': `rgba(${rgbDefaultBg.r}, ${rgbDefaultBg.g}, ${rgbDefaultBg.b}, ${Math.min(1, actionIconsDefaultBgOpacity * 1.6)})`,
        '--action-default-border-hover': `rgba(${rgbDefaultBg.r}, ${rgbDefaultBg.g}, ${rgbDefaultBg.b}, ${Math.min(1, actionIconsDefaultBgOpacity * 4)})`
      } as React.CSSProperties}
      data-tour={dataTour}
    >
      {/* Definição Nativa de Gradiente para Ícones SVG */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <linearGradient id="actionIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={actionIconsColor1} stopOpacity={actionIconsOpacity} />
            <stop offset="100%" stopColor={actionIconsColor2} stopOpacity={actionIconsOpacity} />
          </linearGradient>
        </defs>
      </svg>
      <FormControl segmented small>
        {layout === 'grid' ? (
          <button
            className="FormControl__button"
            title={t('library.toggleLayout.list', 'Toggle to a list layout')}
            onClick={() => handleLayout('list')}
          >
            <FontAwesomeIcon
              className="FormControl__segmentedFaIcon"
              icon={faList}
              data-tour="library-view-toggle"
            />
          </button>
        ) : (
          <button
            className="FormControl__button"
            title={t('library.toggleLayout.grid', 'Toggle to a grid layout')}
            onClick={() => handleLayout('grid')}
          >
            <FontAwesomeIcon
              className="FormControl__segmentedFaIcon"
              icon={faBorderAll}
              data-tour="library-view-toggle"
            />
          </button>
        )}
        <button
          className="FormControl__button"
          title={
            sortDescending
              ? t('library.sortDescending', 'Sort Descending')
              : t('library.sortAscending', 'Sort Ascending')
          }
          onClick={() => setSortDescending(!sortDescending)}
        >
          <FontAwesomeIcon
            className="FormControl__segmentedFaIcon"
            icon={sortDescending ? faArrowDownZA : faArrowDownAZ}
            data-tour="library-sort-az"
          />
        </button>
        <button
          className="FormControl__button"
          title={t('library.sortByStatus', 'Sort by Status')}
          onClick={() => setSortInstalled(!sortInstalled)}
        >
          <FontAwesomeIcon
            className="FormControl__segmentedFaIcon"
            icon={sortInstalled ? hardDriveSolid : hardDriveLight}
            data-tour="library-sort-installed"
          />
        </button>
        <button
          className="FormControl__button"
          title={
            showAlphabetFilter
              ? t('library.hideAlphabetFilter', 'Hide Alphabet Filter')
              : t('library.showAlphabetFilter', 'Show Alphabet Filter')
          }
          onClick={onToggleAlphabetFilter}
        >
          <FontAwesomeIcon
            className="FormControl__segmentedFaIcon"
            icon={showAlphabetFilter ? faFilterCircleXmark : faFilter}
          />
        </button>
        <button
          className="FormControl__button"
          title="Sincronizar Capas no SteamGridDB"
          onClick={() => setShowSteamGridModal(true)}
        >
          <FontAwesomeIcon
            className="FormControl__segmentedFaIcon"
            icon={faImage}
            data-tour="library-steamgriddb-sync"
          />
        </button>
        <button
          className={classNames('FormControl__button', {
            active: isReconnecting
          })}
          title="Reconectar Capas Pendentes (Forçar Carregamento)"
          onClick={handleReconnectCovers}
        >
          <FontAwesomeIcon
            className="FormControl__segmentedFaIcon"
            spin={isReconnecting}
            icon={faRotate}
          />
        </button>
        <button
          className={classNames('FormControl__button', {
            active: refreshing
          })}
          title={t('generic.library.refresh', 'Refresh Library')}
          onClick={async () => {
            try {
              if ((window.api as any)?.clearImageCacheNegative) {
                await (window.api as any).clearImageCacheNegative()
              }
            } catch {}
            window.dispatchEvent(new CustomEvent('heroicReconnectPendingCovers'))
            refreshLibrary({
              checkForUpdates: true
            })
          }}
        >
          <FontAwesomeIcon
            className="FormControl__segmentedFaIcon"
            spin={refreshing}
            data-tour="library-refresh"
            icon={faSyncAlt}
          />
        </button>
        <div className="ActionIcons__updateGroup" ref={scopeMenuRef}>
          <div className="ActionIcons__updateBtnWrapper">
            <button
              className={classNames('FormControl__button', 'FormControl__button--piratas-update', {
                'is-checking': isCheckingPiratas,
                'has-updates': piratasUpdatesCount > 0,
                'is-all-scope': scopeInfo.isAll
              })}
              title={
                isCheckingPiratas
                  ? scopeInfo.isAll
                    ? 'Buscando atualizações em todos os jogos fora das lojas oficiais...'
                    : `Buscando atualizações na loja ${scopeInfo.name}...`
                  : piratasUpdatesCount > 0
                  ? scopeInfo.isAll
                    ? `Buscar atualizações em todos os jogos não-oficiais (${piratasUpdatesCount} atualização disponível!) - Clique direito ou na seta para trocar`
                    : `Buscar atualizações na loja ${scopeInfo.name} (${piratasUpdatesCount} atualização disponível!) - Clique direito ou na seta para trocar`
                  : scopeInfo.isAll
                  ? 'Buscar atualizações em todos os jogos fora das lojas oficiais (Busca Completa) - Clique direito ou na seta para trocar'
                  : `Buscar atualizações na loja ${scopeInfo.name} - Clique direito ou na seta para trocar`
              }
              onClick={handleCheckPiratasUpdates}
              onContextMenu={(e) => {
                e.preventDefault()
                setShowScopeMenu((prev) => !prev)
              }}
              disabled={isCheckingPiratas}
            >
              {scopeInfo.isAll ? (
                <FontAwesomeIcon
                  className={classNames('FormControl__segmentedFaIcon', 'ActionIcons__piratasFaIcon', {
                    'ActionIcons__piratasFaIcon--globe': scopeInfo.isAll
                  })}
                  spin={isCheckingPiratas}
                  icon={faGlobe}
                  data-tour="library-piratas-updates"
                />
              ) : (
                <svg
                  className={classNames(
                    'svg-inline--fa',
                    'fa-skull-crossbones',
                    'FormControl__segmentedFaIcon',
                    'ActionIcons__piratasFaIcon',
                    'ActionIcons__skullCrossbonesSvg'
                  )}
                  viewBox="0 0 448 512"
                  fill="currentColor"
                  data-tour="library-piratas-updates"
                  aria-hidden="true"
                  role="img"
                  focusable="false"
                >
                  <g className={isCheckingPiratas ? 'ActionIcons__skullHead--inertia' : 'ActionIcons__skullHead'}>
                    <path d="M368 128c0 44.4-25.4 83.5-64 106.4l0 21.6c0 17.7-14.3 32-32 32l-96 0c-17.7 0-32-14.3-32-32l0-21.6c-38.6-23-64-62.1-64-106.4C80 57.3 144.5 0 224 0s144 57.3 144 128zM168 176a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm144-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z" />
                  </g>
                  <path
                    className="ActionIcons__skullBones--static"
                    d="M3.4 273.7c7.9-15.8 27.1-22.2 42.9-14.3L224 348.2l177.7-88.8c15.8-7.9 35-1.5 42.9 14.3s1.5 35-14.3 42.9L295.6 384l134.8 67.4c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3L224 419.8 46.3 508.6c-15.8 7.9-35 1.5-42.9-14.3s-1.5-35 14.3-42.9L152.4 384 17.7 316.6C1.9 308.7-4.5 289.5 3.4 273.7z"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              className={classNames('ActionIcons__scopeChevronBtn', {
                'is-open': showScopeMenu
              })}
              title="Definir escopo da busca de atualizações (Loja específica ou Busca Completa)"
              onClick={(e) => {
                e.stopPropagation()
                setShowScopeMenu((prev) => !prev)
              }}
              disabled={isCheckingPiratas}
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
            {piratasUpdatesCount > 0 && !isCheckingPiratas && (
              <span className="ActionIcons__piratasBadge">
                {piratasUpdatesCount}
              </span>
            )}
          </div>

          {showScopeMenu && (
            <div className="ActionIcons__scopePopover animate-popover">
              <div className="ActionIcons__scopeHeader">
                <span className="ActionIcons__scopeTitle">
                  <FontAwesomeIcon icon={faBolt} style={{ color: '#00ffff', marginRight: 6 }} />
                  Escopo de Atualizações
                </span>
                <span className="ActionIcons__scopeSubtitle">
                  Defina onde o Ghost deve buscar novidades:
                </span>
              </div>

              <div className="ActionIcons__scopeList">
                {/* Opção 1: Busca Completa */}
                <button
                  type="button"
                  className={classNames('ActionIcons__scopeItem', {
                    'is-selected': scopeInfo.isAll
                  })}
                  onClick={() => handleSelectScope('all')}
                >
                  <div className="ActionIcons__scopeItemIcon ActionIcons__scopeItemIcon--globe">
                    <FontAwesomeIcon icon={faGlobe} />
                  </div>
                  <div className="ActionIcons__scopeItemContent">
                    <div className="ActionIcons__scopeItemTitle">
                      <span>Busca Completa (Não-Oficiais)</span>
                      {scopeInfo.isAll && (
                        <span className="ActionIcons__scopeBadgeActive">
                          <FontAwesomeIcon icon={faCheck} /> Ativo
                        </span>
                      )}
                    </div>
                    <div className="ActionIcons__scopeItemDesc">
                      Varre todos os downloads e sideloads fora das contas oficiais {gameCounts.all ? `(${gameCounts.all} jogos)` : ''}
                    </div>
                  </div>
                </button>

                <div className="ActionIcons__scopeDivider" />
                <div className="ActionIcons__scopeSectionLabel">Lojas Personalizadas:</div>

                {/* Lojas customizadas */}
                {getAvailableCustomStores().map((store) => {
                  const isSelected = !scopeInfo.isAll && scopeInfo.scope === store.id
                  const count = gameCounts[store.id] || 0
                  return (
                    <button
                      key={store.id}
                      type="button"
                      className={classNames('ActionIcons__scopeItem', {
                        'is-selected': isSelected
                      })}
                      onClick={() => handleSelectScope(store.id)}
                    >
                      <div className="ActionIcons__scopeItemIcon">
                        {store.icon ? (
                          <img src={store.icon} alt={store.name} className="ActionIcons__scopeStoreImg" />
                        ) : (
                          <FontAwesomeIcon icon={faSkullCrossbones} />
                        )}
                      </div>
                      <div className="ActionIcons__scopeItemContent">
                        <div className="ActionIcons__scopeItemTitle">
                          <span>Loja {store.name}</span>
                          {isSelected && (
                            <span className="ActionIcons__scopeBadgeActive">
                              <FontAwesomeIcon icon={faCheck} /> Ativo
                            </span>
                          )}
                        </div>
                        <div className="ActionIcons__scopeItemDesc">
                          {count > 0 ? `${count} jogo(s) atribuído(s)` : 'Nenhum jogo atribuído'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="ActionIcons__scopeFooter">
                <button
                  type="button"
                  className="ActionIcons__scopeCheckNowBtn"
                  onClick={() => {
                    setShowScopeMenu(false)
                    void handleCheckPiratasUpdates()
                  }}
                  disabled={isCheckingPiratas}
                >
                  <FontAwesomeIcon icon={faRotate} spin={isCheckingPiratas} />
                  <span>Buscar Atualizações Agora</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </FormControl>

      {toast && (
        <div
          className={`ActionIcons__toast ActionIcons__toast--${toast.type}`}
          role="status"
          onClick={() => setToast(null)}
        >
          <span>{toast.message}</span>
        </div>
      )}

      <SteamGridBatchModal
        isOpen={showSteamGridModal}
        onClose={() => setShowSteamGridModal(false)}
      />
    </div>
  )
})
