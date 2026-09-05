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
  faRotate
} from '@fortawesome/free-solid-svg-icons'
import { faHardDrive as hardDriveLight } from '@fortawesome/free-regular-svg-icons'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import FormControl from '../FormControl'
import SteamGridBatchModal from '../SteamGridBatchModal'
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
  const { refreshLibrary, refreshing } = useContext(ContextProvider)
  const [showSteamGridModal, setShowSteamGridModal] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)

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
      </FormControl>

      <SteamGridBatchModal
        isOpen={showSteamGridModal}
        onClose={() => setShowSteamGridModal(false)}
      />
    </div>
  )
})
