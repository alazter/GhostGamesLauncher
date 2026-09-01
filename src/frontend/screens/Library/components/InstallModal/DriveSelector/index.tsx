import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHardDrive, faCog, faCheck, faFolderOpen, faStar } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { StorageDrive } from 'common/types/ipc'
import { GameInfo } from 'common/types'
import { size } from 'frontend/helpers'
import CachedImage from 'frontend/components/UI/CachedImage'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import './index.css'

interface Props {
  gameInfo: GameInfo
  installSizeStr?: string
  diskSizeNumber?: number
  selectedPath: string
  onPathChange: (newPath: string) => void
  desktopShortcut: boolean
  onDesktopShortcutChange: (val: boolean) => void
  startMenuShortcut: boolean
  onStartMenuShortcutChange: (val: boolean) => void
}

function formatFreeSpace(bytes: number): string {
  if (!bytes) return '0 GB LIVRE(S)'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1024) {
    const tb = (gb / 1024).toFixed(2).replace('.', ',')
    return `${tb} TB LIVRE(S)`
  }
  return `${gb.toFixed(2).replace('.', ',')} GB LIVRE(S)`
}

export default function DriveSelector({
  gameInfo,
  installSizeStr,
  diskSizeNumber,
  selectedPath,
  onPathChange,
  desktopShortcut,
  onDesktopShortcutChange,
  startMenuShortcut,
  onStartMenuShortcutChange
}: Props) {
  const { t } = useTranslation()
  const [drives, setDrives] = useState<StorageDrive[]>([])
  const [loadingDrives, setLoadingDrives] = useState(true)
  const [customPathActive, setCustomPathActive] = useState(false)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAvailableStorageDrives(gameInfo.runner)
      .then((detected) => {
        if (!isMounted) return
        setDrives(detected)
        setLoadingDrives(false)

        // If no path is selected or default is set, pick first drive or drive matching current selectedPath
        if (detected.length > 0) {
          const match = detected.find((d) =>
            selectedPath.toLowerCase().startsWith(d.letter.toLowerCase())
          )
          if (!selectedPath || !match) {
            onPathChange(detected[0].path)
          }
        }
      })
      .catch(() => {
        if (isMounted) setLoadingDrives(false)
      })

    return () => {
      isMounted = false
    }
  }, [gameInfo.runner, gameInfo.app_name])

  const handleSelectDrive = (drive: StorageDrive) => {
    setCustomPathActive(false)
    onPathChange(drive.path)
  }

  const handleBrowseCustomFolder = async () => {
    const result = await window.api.openDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: selectedPath || undefined
    })
    if (result && typeof result === 'string') {
      setCustomPathActive(true)
      onPathChange(result)
    }
  }

  const effectiveCover =
    gameInfo.overrides?.art_cover ||
    gameInfo.overrides?.art_square ||
    gameInfo.art_cover ||
    gameInfo.art_square ||
    fallbackImage

  return (
    <div className="steamDriveSelector">
      {/* 1. Card do Topo com Imagem, Nome e Tamanho */}
      <div className="steamDriveSelector__gameHeader">
        <div className="steamDriveSelector__gameCover">
          <CachedImage
            src={effectiveCover}
            alt={gameInfo.title}
            fallback={fallbackImage}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
          />
        </div>
        <div className="steamDriveSelector__gameInfo">
          <div className="steamDriveSelector__gameTitle">{gameInfo.title}</div>
          <div className="steamDriveSelector__gameSize">
            {installSizeStr || (diskSizeNumber ? size(diskSizeNumber) : 'Calculando...')}
          </div>
        </div>
      </div>

      {/* 2. Checkboxes de Atalhos */}
      <div className="steamDriveSelector__shortcuts">
        <label className="steamDriveSelector__checkboxLabel">
          <input
            type="checkbox"
            checked={desktopShortcut}
            onChange={(e) => onDesktopShortcutChange(e.target.checked)}
            className="steamDriveSelector__checkbox"
          />
          <span>{t('install.createDesktopShortcut', 'Criar atalho na área de trabalho')}</span>
        </label>

        <label className="steamDriveSelector__checkboxLabel">
          <input
            type="checkbox"
            checked={startMenuShortcut}
            onChange={(e) => onStartMenuShortcutChange(e.target.checked)}
            className="steamDriveSelector__checkbox"
          />
          <span>{t('install.createStartMenuShortcut', 'Criar atalho no menu Iniciar')}</span>
        </label>
      </div>

      {/* 3. Seção Instalar Em */}
      <div className="steamDriveSelector__sectionHeader">
        <span>{t('install.installIn', 'INSTALAR EM:')}</span>
        <button
          type="button"
          onClick={handleBrowseCustomFolder}
          className="steamDriveSelector__gearButton"
          title={t('install.chooseCustomFolder', 'Escolher pasta personalizada')}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      </div>

      {/* 4. Lista de Unidades de Disco */}
      <div className="steamDriveSelector__drivesList">
        {loadingDrives ? (
          <div className="steamDriveSelector__loading">Carregando unidades disponíveis...</div>
        ) : (
          drives.map((drive) => {
            const isSelected =
              !customPathActive &&
              selectedPath.toLowerCase().startsWith(drive.letter.toLowerCase())

            return (
              <div
                key={drive.letter}
                onClick={() => handleSelectDrive(drive)}
                className={`steamDriveSelector__driveCard ${
                  isSelected ? 'steamDriveSelector__driveCard--selected' : ''
                }`}
              >
                <div className="steamDriveSelector__driveLeft">
                  <FontAwesomeIcon icon={faHardDrive} className="steamDriveSelector__driveIcon" />
                  <span className="steamDriveSelector__driveName">{drive.name}</span>
                </div>
                <div className="steamDriveSelector__driveRight">
                  {isSelected && (
                    <FontAwesomeIcon icon={faStar} className="steamDriveSelector__starIcon" />
                  )}
                  <span className="steamDriveSelector__freeSpace">
                    {formatFreeSpace(drive.freeSpace)}
                  </span>
                </div>
              </div>
            )
          })
        )}

        {customPathActive && (
          <div className="steamDriveSelector__driveCard steamDriveSelector__driveCard--selected">
            <div className="steamDriveSelector__driveLeft">
              <FontAwesomeIcon icon={faFolderOpen} className="steamDriveSelector__driveIcon" />
              <span className="steamDriveSelector__driveName" style={{ fontSize: '12px' }}>
                {selectedPath}
              </span>
            </div>
            <div className="steamDriveSelector__driveRight">
              <span className="steamDriveSelector__freeSpace">Personalizado</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
