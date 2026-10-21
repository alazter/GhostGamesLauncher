import React, { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHardDrive,
  faCog,
  faFolderOpen,
  faStar,
  faTimes,
  faArrowRight,
  faCheckCircle,
  faExclamationTriangle,
  faShieldAlt,
  faExchangeAlt,
  faTrashAlt,
  faCheck,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons'
import { CircularProgress } from '@mui/material'
import { GameInfo } from 'common/types'
import { StorageDrive } from 'common/types/ipc'
import CachedImage from 'frontend/components/UI/CachedImage'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import { openGameFolder } from 'frontend/utils/pathUtils'

export const DRIVE_PATHS_STORAGE_KEY = 'ghost_move_game_drive_paths'

interface MoveGameModalProps {
  isOpen: boolean
  game: GameInfo
  currentTitle: string
  currentExecutable?: string
  onClose: () => void
  onMoved?: (newInstallPath: string, newExecutable?: string) => void
}

export function formatBytesCompact(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let val = bytes
  let unitIdx = 0
  while (val >= 1024 && unitIdx < units.length - 1) {
    val /= 1024
    unitIdx++
  }
  return `${val.toFixed(unitIdx >= 3 ? 2 : 1).replace('.', ',')} ${units[unitIdx]}`
}

export function formatFreeSpaceSteam(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 GB LIVRE(S)'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1024) {
    const tb = (gb / 1024).toFixed(2).replace('.', ',')
    return `${tb} TB LIVRE(S)`
  }
  return `${gb.toFixed(2).replace('.', ',')} GB LIVRE(S)`
}

export function getDirectoryFromPath(filePath: string): string {
  if (!filePath) return ''
  const norm = filePath.replace(/[/\\]+$/, '')
  const lastSep = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  if (lastSep <= 0) return norm
  if (lastSep === 2 && norm[1] === ':') return `${norm.slice(0, 2)}\\`
  return norm.slice(0, lastSep)
}

export function getBaseNameFromPath(filePath: string): string {
  if (!filePath) return ''
  const norm = filePath.replace(/[/\\]+$/, '')
  const lastSep = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  return lastSep >= 0 ? norm.slice(lastSep + 1) : norm
}

export function getDriveLetter(pathStr: string): string {
  if (!pathStr) return ''
  const match = pathStr.trim().match(/^([a-zA-Z]:)/)
  return match ? match[1].toUpperCase() : ''
}

export function buildDestinationPreview(parentPath: string, sourceFolder: string): string {
  if (!parentPath) return ''
  const folderName = getBaseNameFromPath(sourceFolder)
  if (!folderName) return parentPath
  const parentBase = getBaseNameFromPath(parentPath)
  if (parentBase.toLowerCase() === folderName.toLowerCase()) {
    return parentPath
  }
  const sep = parentPath.includes('/') && !parentPath.includes('\\') ? '/' : '\\'
  return `${parentPath.replace(/[/\\]+$/, '')}${sep}${folderName}`
}

export function normalizeDrivePathsMap(
  raw: Record<string, string> | null | undefined
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return result
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val !== 'string') continue
    const trimmed = val.trim()
    if (!trimmed) continue
    const letter = getDriveLetter(key) || key.trim().toUpperCase()
    if (letter) {
      result[letter] = trimmed
    }
  }
  return result
}

export function loadConfiguredDrivePaths(): Record<string, string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DRIVE_PATHS_STORAGE_KEY)
      if (raw) {
        const parsed = normalizeDrivePathsMap(JSON.parse(raw))
        if (Object.keys(parsed).length > 0) {
          return parsed
        }
      }
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.api?.storeGet) {
      const storedFromConfig = window.api.storeGet(
        'configStore',
        'moveGameDrivePaths'
      ) as Record<string, string> | undefined
      if (storedFromConfig && typeof storedFromConfig === 'object') {
        const normalized = normalizeDrivePathsMap(storedFromConfig)
        if (Object.keys(normalized).length > 0 && window.localStorage) {
          window.localStorage.setItem(DRIVE_PATHS_STORAGE_KEY, JSON.stringify(normalized))
        }
        return normalized
      }
    }
  } catch {}
  return {}
}

export function saveConfiguredDrivePaths(
  paths: Record<string, string>
): Record<string, string> {
  const normalized = normalizeDrivePathsMap(paths)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DRIVE_PATHS_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.api?.storeSet) {
      window.api.storeSet('configStore', 'moveGameDrivePaths', normalized)
    }
  } catch {}
  return normalized
}

export function filterConfiguredDrives(
  drives: StorageDrive[],
  configuredPaths: Record<string, string>
): StorageDrive[] {
  if (!Array.isArray(drives) || !configuredPaths) return []
  const normalizedMap = normalizeDrivePathsMap(configuredPaths)
  const result: StorageDrive[] = []
  for (const drive of drives) {
    const key = (getDriveLetter(drive.letter) || drive.letter.trim()).toUpperCase()
    const userPath = normalizedMap[key]
    if (userPath && userPath.trim()) {
      result.push({
        ...drive,
        letter: key,
        path: userPath.trim()
      })
    }
  }
  return result
}

export default function MoveGameModal({
  isOpen,
  game,
  currentTitle,
  currentExecutable,
  onClose,
  onMoved
}: MoveGameModalProps) {
  const [drives, setDrives] = useState<StorageDrive[]>([])
  const [loadingDrives, setLoadingDrives] = useState<boolean>(true)
  const [configuredPaths, setConfiguredPaths] = useState<Record<string, string>>(() =>
    loadConfiguredDrivePaths()
  )
  const [isConfiguringDrives, setIsConfiguringDrives] = useState<boolean>(false)
  const [configFeedback, setConfigFeedback] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [customPathActive, setCustomPathActive] = useState<boolean>(false)
  const [folderSizeBytes, setFolderSizeBytes] = useState<number>(0)
  const [loadingSize, setLoadingSize] = useState<boolean>(true)
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [movePercent, setMovePercent] = useState<number>(0)
  const [moveCurrentFile, setMoveCurrentFile] = useState<string>('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moveCompletedPath, setMoveCompletedPath] = useState<string | null>(null)

  const currentInstallDir = useMemo(() => {
    if (game.install?.install_path && game.install.install_path.trim()) {
      return game.install.install_path.trim()
    }
    if (game.folder_name && game.folder_name.trim()) {
      return game.folder_name.trim()
    }
    const exe = currentExecutable || game.install?.executable || ''
    if (exe.trim()) {
      return getDirectoryFromPath(exe.trim())
    }
    return ''
  }, [game.install?.install_path, game.folder_name, currentExecutable, game.install?.executable])

  const currentDriveLetter = useMemo(
    () => getDriveLetter(currentInstallDir),
    [currentInstallDir]
  )

  // Apenas os HDs/NVMes cujo caminho foi pré-definido pelo usuário
  const configuredDrives = useMemo(
    () => filterConfiguredDrives(drives, configuredPaths),
    [drives, configuredPaths]
  )

  // Reidratação das configurações salvas (localStorage + configStore) e detecção de discos físicos
  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    setLoadingDrives(true)
    setMoveError(null)
    setMoveCompletedPath(null)
    setIsMoving(false)
    setMovePercent(0)
    setMoveCurrentFile('')
    setConfigFeedback(null)

    let currentMap = loadConfiguredDrivePaths()
    if (Object.keys(currentMap).length === 0 && window.api?.storeGet) {
      try {
        const storedFromConfig = window.api.storeGet(
          'configStore',
          'moveGameDrivePaths'
        ) as Record<string, string> | undefined
        if (storedFromConfig && Object.keys(storedFromConfig).length > 0) {
          currentMap = saveConfiguredDrivePaths(storedFromConfig)
        }
      } catch {}
    }
    setConfiguredPaths(currentMap)
    setIsConfiguringDrives(false)

    window.api
      .getAvailableStorageDrives(game.runner)
      .then((detected) => {
        if (!mounted) return
        setDrives(detected)
        setLoadingDrives(false)

        const userDrives = filterConfiguredDrives(detected, currentMap)
        if (userDrives.length > 0) {
          const otherDrive = userDrives.find(
            (d) => d.letter.toUpperCase() !== currentDriveLetter
          )
          const initialDrive = otherDrive || userDrives[0]
          setSelectedPath(initialDrive.path)
          setCustomPathActive(false)
        } else {
          setSelectedPath('')
          setCustomPathActive(false)
        }
      })
      .catch(() => {
        if (mounted) setLoadingDrives(false)
      })

    return () => {
      mounted = false
    }
  }, [isOpen, game.runner, game.app_name, currentDriveLetter])

  // Sempre que configuredDrives mudar (ex: usuário acabou de configurar um HD na engrenagem), selecionar automaticamente
  useEffect(() => {
    if (!isOpen || customPathActive) return
    if (configuredDrives.length === 0) {
      setSelectedPath('')
      return
    }
    const stillValid = configuredDrives.some(
      (d) => d.path.toLowerCase() === selectedPath.toLowerCase()
    )
    if (!selectedPath || !stillValid) {
      const otherDrive = configuredDrives.find(
        (d) => d.letter.toUpperCase() !== currentDriveLetter
      )
      const target = otherDrive || configuredDrives[0]
      setSelectedPath(target.path)
    }
  }, [isOpen, configuredDrives, customPathActive, selectedPath, currentDriveLetter])

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    if (!currentInstallDir) {
      setFolderSizeBytes(0)
      setLoadingSize(false)
      return
    }
    setLoadingSize(true)
    window.api
      .getGameFolderSize(currentInstallDir)
      .then((bytes) => {
        if (!mounted) return
        setFolderSizeBytes(bytes || 0)
        setLoadingSize(false)
      })
      .catch(() => {
        if (mounted) setLoadingSize(false)
      })

    return () => {
      mounted = false
    }
  }, [isOpen, currentInstallDir])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isMoving) {
        if (isConfiguringDrives) {
          setIsConfiguringDrives(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isMoving, isConfiguringDrives, onClose])

  useEffect(() => {
    if (!isOpen || !isMoving) return
    const removeListener = window.api.onProgressUpdate((_e, data) => {
      if (data?.appName === game.app_name && data?.status === 'moving') {
        if (typeof data.progress?.percent === 'number' && data.progress.percent > 0) {
          setMovePercent(Math.min(100, Math.max(1, Math.round(data.progress.percent))))
        }
        if (data.progress?.file) {
          setMoveCurrentFile(data.progress.file)
        }
      }
    })
    return () => {
      removeListener()
    }
  }, [isOpen, isMoving, game.app_name])

  if (!isOpen) return null

  const effectiveCover =
    game.overrides?.art_cover ||
    game.overrides?.art_square ||
    game.art_cover ||
    game.art_square ||
    fallbackImage

  const destinationFullPreview = buildDestinationPreview(selectedPath, currentInstallDir)

  const isSameDestination =
    Boolean(currentInstallDir && destinationFullPreview) &&
    currentInstallDir.replace(/[/\\]+$/, '').toLowerCase() ===
      destinationFullPreview.replace(/[/\\]+$/, '').toLowerCase()

  const selectedDriveObj = drives.find(
    (d) => getDriveLetter(selectedPath) === d.letter.toUpperCase()
  )

  const isMovingAcrossDrives =
    Boolean(selectedDriveObj && currentDriveLetter) &&
    selectedDriveObj!.letter.toUpperCase() !== currentDriveLetter

  const hasInsufficientSpace =
    isMovingAcrossDrives &&
    folderSizeBytes > 0 &&
    selectedDriveObj !== undefined &&
    selectedDriveObj.freeSpace > 0 &&
    selectedDriveObj.freeSpace < folderSizeBytes

  const handleSelectDrive = (drive: StorageDrive) => {
    if (isMoving) return
    setCustomPathActive(false)
    setSelectedPath(drive.path)
    setMoveError(null)
  }

  const handleUpdateDrivePresetPath = (driveLetter: string, newPath: string) => {
    const key = (getDriveLetter(driveLetter) || driveLetter.trim()).toUpperCase()
    const next = { ...configuredPaths }
    if (!newPath.trim()) {
      delete next[key]
    } else {
      next[key] = newPath
    }
    const saved = saveConfiguredDrivePaths(next)
    setConfiguredPaths(saved)
    setConfigFeedback(null)
  }

  const handleBrowseDrivePresetFolder = async (drive: StorageDrive) => {
    const key = (getDriveLetter(drive.letter) || drive.letter.trim()).toUpperCase()
    const currentPreset = configuredPaths[key]?.trim()
    const defaultStartPath = currentPreset || `${key}\\`

    const result = await window.api.openDialog({
      buttonLabel: `Definir Pasta para (${key})`,
      properties: ['openDirectory', 'createDirectory'],
      title: `Pré-definir pasta de jogos para ${drive.name}`,
      defaultPath: defaultStartPath
    })

    if (result && typeof result === 'string') {
      const chosenLetter = getDriveLetter(result)
      const targetKey = chosenLetter || key
      const next = {
        ...configuredPaths,
        [targetKey]: result.trim()
      }
      const saved = saveConfiguredDrivePaths(next)
      setConfiguredPaths(saved)
      if (chosenLetter && chosenLetter !== key) {
        setConfigFeedback(
          `Pasta selecionada pertence à unidade ${chosenLetter} e foi vinculada automaticamente a (${chosenLetter}).`
        )
      } else {
        setConfigFeedback(`Caminho pré-definido salvo para ${drive.name}!`)
      }
    }
  }

  const handleBrowseCustomFolder = async () => {
    if (isMoving) return
    const result = await window.api.openDialog({
      buttonLabel: 'Selecionar Pasta de Destino',
      properties: ['openDirectory', 'createDirectory'],
      title: 'Selecionar pasta avulsa para mover este jogo',
      defaultPath: selectedPath || currentInstallDir || undefined
    })
    if (result && typeof result === 'string') {
      setCustomPathActive(true)
      setSelectedPath(result)
      setMoveError(null)
    }
  }

  const handleStartMove = async () => {
    if (
      isMoving ||
      !selectedPath ||
      !currentInstallDir ||
      isSameDestination ||
      hasInsufficientSpace
    ) {
      return
    }

    setIsMoving(true)
    setMoveError(null)
    setMovePercent(2)
    setMoveCurrentFile('Preparando transferência de arquivos...')

    try {
      const res = await window.api.moveInstall({
        appName: game.app_name,
        path: selectedPath,
        runner: game.runner
      })

      if (res && res.status === 'error') {
        setMoveError(
          res.error ||
            'Não foi possível mover os arquivos do jogo. Verifique se o jogo está fechado e tente novamente.'
        )
        setIsMoving(false)
        return
      }

      const finalPath =
        (res && 'installPath' in res && res.installPath) || destinationFullPreview

      let newExe: string | undefined
      const oldExe = currentExecutable || game.install?.executable || ''
      if (oldExe && currentInstallDir) {
        const normOldDir = currentInstallDir.replace(/[/\\]+$/, '')
        if (oldExe.toLowerCase().startsWith(normOldDir.toLowerCase())) {
          const relSuffix = oldExe.slice(normOldDir.length).replace(/^[/\\]+/, '')
          const sep = finalPath.includes('/') && !finalPath.includes('\\') ? '/' : '\\'
          newExe = relSuffix ? `${finalPath}${sep}${relSuffix}` : finalPath
        }
      }

      setMovePercent(100)
      setMoveCompletedPath(finalPath)
      setIsMoving(false)

      if (onMoved) {
        onMoved(finalPath, newExe)
      }
    } catch (err: any) {
      setMoveError(
        err?.message || 'Erro inesperado durante a transferência dos arquivos.'
      )
      setIsMoving(false)
    }
  }

  const displaySize =
    folderSizeBytes > 0
      ? formatBytesCompact(folderSizeBytes)
      : game.install?.install_size
      ? String(game.install.install_size)
      : loadingSize
      ? 'Calculando tamanho...'
      : 'Tamanho variável'

  return (
    <div
      className="ghostMoveGameModalOverlay"
      onClick={() => !isMoving && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(6, 10, 18, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}
    >
      <div
        className="ghostMoveGameModalCard"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          background: 'linear-gradient(180deg, #1b2838 0%, #131a24 100%)',
          borderRadius: '14px',
          border: '1px solid rgba(102, 192, 244, 0.35)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(42, 128, 235, 0.2)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#e5e7eb',
          position: 'relative',
          animation: 'ghostFadeInScale 0.2s ease-out'
        }}
      >
        {/* Botão Fechar Sem Moldura (Regra Canônica 12) */}
        <button
          type="button"
          onClick={() => !isMoving && onClose()}
          disabled={isMoving}
          title="Fechar (Esc)"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            padding: '4px',
            cursor: isMoving ? 'not-allowed' : 'pointer',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s ease, filter 0.2s ease',
            opacity: isMoving ? 0.35 : 1
          }}
          onMouseOver={(e) => {
            if (!isMoving) {
              e.currentTarget.style.color = '#66c0f4'
              e.currentTarget.style.filter = 'drop-shadow(0 0 8px #66c0f4)'
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
            e.currentTarget.style.filter = 'none'
          }}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* Cabeçalho Inspirado na Steam */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '28px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: isConfiguringDrives
                ? 'rgba(16, 185, 129, 0.18)'
                : 'rgba(42, 128, 235, 0.18)',
              border: isConfiguringDrives
                ? '1px solid rgba(16, 185, 129, 0.45)'
                : '1px solid rgba(102, 192, 244, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConfiguringDrives ? '#34d399' : '#66c0f4',
              fontSize: '18px',
              flexShrink: 0,
              boxShadow: isConfiguringDrives
                ? '0 0 15px rgba(16, 185, 129, 0.25)'
                : '0 0 15px rgba(42, 128, 235, 0.25)'
            }}
          >
            <FontAwesomeIcon icon={isConfiguringDrives ? faCog : faExchangeAlt} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.2px'
              }}
            >
              {isConfiguringDrives
                ? 'Configurar Caminhos dos HDs / NVMe'
                : 'Mover Pasta de Instalação'}
            </h3>
            <div style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: '2px' }}>
              {isConfiguringDrives
                ? 'Pré-defina a pasta de destino para cada HD ou NVMe. Após configurar, os discos aparecerão na tela.'
                : 'Transfira os arquivos do jogo para outro HD ou NVMe configurado'}
            </div>
          </div>
        </div>

        {/* 1. Card Superior do Jogo (Estilo Steam) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: 'rgba(0, 0, 0, 0.38)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '10px 14px'
          }}
        >
          <div
            style={{
              width: '96px',
              height: '48px',
              borderRadius: '6px',
              overflow: 'hidden',
              flexShrink: 0,
              background: '#0f1318',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <CachedImage
              src={effectiveCover}
              alt={currentTitle}
              fallback={fallbackImage}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentTitle}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '4px',
                flexWrap: 'wrap'
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#66c0f4',
                  background: 'rgba(102, 192, 244, 0.12)',
                  border: '1px solid rgba(102, 192, 244, 0.3)',
                  borderRadius: '5px',
                  padding: '1px 8px'
                }}
              >
                {displaySize}
              </span>
              {currentDriveLetter && (
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.75)'
                  }}
                >
                  Unidade Atual: <strong style={{ color: '#fff' }}>{currentDriveLetter}</strong>
                </span>
              )}
            </div>
          </div>
          {currentInstallDir && (
            <button
              type="button"
              onClick={() => openGameFolder(currentInstallDir, false)}
              title="Abrir pasta atual no Windows Explorer"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '7px',
                padding: '6px 10px',
                color: '#d1d5db',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(102, 192, 244, 0.15)'
                e.currentTarget.style.borderColor = '#66c0f4'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)'
                e.currentTarget.style.color = '#d1d5db'
              }}
            >
              <FontAwesomeIcon icon={faFolderOpen} style={{ color: '#66c0f4' }} />
              <span>Pasta Atual</span>
            </button>
          )}
        </div>

        {!currentInstallDir ? (
          <div
            style={{
              background: 'rgba(255, 82, 82, 0.1)',
              border: '1px solid rgba(255, 82, 82, 0.35)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#fca5a5',
              fontSize: '13px'
            }}
          >
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#ff5252', fontSize: '16px' }} />
            <span>
              Este jogo não possui uma pasta de instalação local configurada ou seus arquivos não estão instalados no computador.
            </span>
          </div>
        ) : isConfiguringDrives ? (
          /* =========================================================================
           * MODO ENGRENAGEM (⚙️): PRÉ-DEFINIÇÃO DOS CAMINHOS PARA CADA HD / NVMe
           * ========================================================================= */
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginTop: '2px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    color: '#66c0f4',
                    textTransform: 'uppercase'
                  }}
                >
                  UNIDADES DETECTADAS NO COMPUTADOR ({drives.length}):
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background:
                      configuredDrives.length > 0
                        ? 'rgba(16, 185, 129, 0.16)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color: configuredDrives.length > 0 ? '#6ee7b7' : '#9ca3af',
                    border:
                      configuredDrives.length > 0
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  {configuredDrives.length} configurada(s)
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsConfiguringDrives(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  padding: '5px 11px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 192, 244, 0.18)'
                  e.currentTarget.style.borderColor = '#66c0f4'
                  e.currentTarget.style.color = '#66c0f4'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)'
                  e.currentTarget.style.color = '#ffffff'
                }}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Voltar para Unidades</span>
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '280px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}
            >
              {loadingDrives ? (
                <div
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <CircularProgress size={16} style={{ color: '#66c0f4' }} />
                  <span>Detectando todos os HDs e NVMes instalados...</span>
                </div>
              ) : (
                drives.map((drive) => {
                  const key = (getDriveLetter(drive.letter) || drive.letter.trim()).toUpperCase()
                  const userPresetPath = configuredPaths[key] || ''
                  const isConfigured = Boolean(userPresetPath.trim())
                  const isCurrentDrive = key === currentDriveLetter

                  const usedBytes = Math.max(0, drive.totalSpace - drive.freeSpace)
                  const usedPercent =
                    drive.totalSpace > 0
                      ? Math.min(100, Math.round((usedBytes / drive.totalSpace) * 100))
                      : 0

                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: isConfigured
                          ? 'rgba(26, 43, 62, 0.85)'
                          : 'rgba(24, 31, 41, 0.75)',
                        border: isConfigured
                          ? '1px solid rgba(102, 192, 244, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.09)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Topo da Unidade */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '9px',
                            minWidth: 0
                          }}
                        >
                          <FontAwesomeIcon
                            icon={faHardDrive}
                            style={{
                              fontSize: '15px',
                              color: isConfigured ? '#66c0f4' : '#9ca3af'
                            }}
                          />
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: '#ffffff'
                            }}
                          >
                            {drive.name}
                          </span>
                          {isCurrentDrive && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(102, 192, 244, 0.14)',
                                color: '#66c0f4',
                                border: '1px solid rgba(102, 192, 244, 0.3)'
                              }}
                            >
                              UNIDADE ATUAL
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: '#cbd5e1'
                            }}
                          >
                            {formatFreeSpaceSteam(drive.freeSpace)}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              background: isConfigured
                                ? 'rgba(16, 185, 129, 0.18)'
                                : 'rgba(255, 255, 255, 0.07)',
                              color: isConfigured ? '#34d399' : '#9ca3af',
                              border: isConfigured
                                ? '1px solid rgba(16, 185, 129, 0.4)'
                                : '1px solid rgba(255, 255, 255, 0.12)'
                            }}
                          >
                            {isConfigured ? '✓ Configurado' : 'Não Configurado'}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Ocupação da Unidade */}
                      {drive.totalSpace > 0 && (
                        <div
                          style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(0, 0, 0, 0.45)',
                            borderRadius: '999px',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${usedPercent}%`,
                              height: '100%',
                              background:
                                usedPercent > 90
                                  ? '#ff5252'
                                  : isConfigured
                                  ? '#66c0f4'
                                  : '#64748b',
                              borderRadius: '999px'
                            }}
                          />
                        </div>
                      )}

                      {/* Caixa de Caminho Pré-Definido pelo Usuário + Botão Selecionar Pasta */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '2px'
                        }}
                      >
                        <input
                          type="text"
                          value={userPresetPath}
                          onChange={(e) =>
                            handleUpdateDrivePresetPath(key, e.target.value)
                          }
                          placeholder={`Ex: ${key}\\Alazter Games — Clique em "Definir Pasta" para configurar (${key})...`}
                          style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.42)',
                            border: isConfigured
                              ? '1px solid rgba(102, 192, 244, 0.38)'
                              : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '7px',
                            padding: '7px 11px',
                            color: '#ffffff',
                            fontSize: '12px',
                            outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleBrowseDrivePresetFolder(drive)}
                          title={`Escolher pasta padrão para ${drive.name}`}
                          style={{
                            background: 'rgba(42, 128, 235, 0.2)',
                            border: '1px solid rgba(102, 192, 244, 0.45)',
                            borderRadius: '7px',
                            padding: '7px 12px',
                            color: '#66c0f4',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexShrink: 0,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#2a80eb'
                            e.currentTarget.style.color = '#ffffff'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(42, 128, 235, 0.2)'
                            e.currentTarget.style.color = '#66c0f4'
                          }}
                        >
                          <FontAwesomeIcon icon={faFolderOpen} />
                          <span>Definir Pasta</span>
                        </button>

                        {isConfigured && (
                          <button
                            type="button"
                            onClick={() => handleUpdateDrivePresetPath(key, '')}
                            title={`Remover caminho pré-definido da unidade (${key})`}
                            style={{
                              background: 'rgba(255, 82, 82, 0.12)',
                              border: '1px solid rgba(255, 82, 82, 0.35)',
                              borderRadius: '7px',
                              padding: '7px 10px',
                              color: '#fca5a5',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 82, 82, 0.25)'
                              e.currentTarget.style.color = '#ffffff'
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 82, 82, 0.12)'
                              e.currentTarget.style.color = '#fca5a5'
                            }}
                          >
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {configFeedback && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#6ee7b7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#10b981' }} />
                <span>{configFeedback}</span>
              </div>
            )}
          </>
        ) : (
          /* =========================================================================
           * TELA PRINCIPAL: EXIBE APENAS OS HDs / NVMes PRÉ-DEFINIDOS PELO USUÁRIO
           * ========================================================================= */
          <>
            {/* 2. Cabeçalho da Seção com Engrenagem (⚙️) para Pré-Definir Caminhos dos HDs/NVMe */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginTop: '2px'
              }}
            >
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textTransform: 'uppercase'
                }}
              >
                MOVER PARA A UNIDADE DE ARMAZENAMENTO:
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  disabled={isMoving}
                  onClick={handleBrowseCustomFolder}
                  title="Escolher outra pasta avulsa para este jogo"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#d1d5db',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: isMoving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    if (!isMoving) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                      e.currentTarget.style.color = '#ffffff'
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                    e.currentTarget.style.color = '#d1d5db'
                  }}
                >
                  <FontAwesomeIcon icon={faFolderOpen} />
                  <span>Outra pasta...</span>
                </button>

                {/* Botão de Engrenagem (⚙️) Solicitado pelo Usuário */}
                <button
                  type="button"
                  disabled={isMoving}
                  onClick={() => setIsConfiguringDrives(true)}
                  title="Pré-definir os caminhos padrão para cada HD / NVMe"
                  style={{
                    background: 'rgba(42, 128, 235, 0.16)',
                    border: '1px solid rgba(102, 192, 244, 0.45)',
                    color: '#66c0f4',
                    padding: '5px 11px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: isMoving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    if (!isMoving) {
                      e.currentTarget.style.background = '#2a80eb'
                      e.currentTarget.style.borderColor = '#66c0f4'
                      e.currentTarget.style.color = '#ffffff'
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(42, 128, 235, 0.16)'
                    e.currentTarget.style.borderColor = 'rgba(102, 192, 244, 0.45)'
                    e.currentTarget.style.color = '#66c0f4'
                  }}
                >
                  <FontAwesomeIcon icon={faCog} />
                  <span>Configurar HDs</span>
                </button>
              </div>
            </div>

            {/* 3. Lista de Unidades HD / NVMe Configuradas pelo Usuário */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '2px'
              }}
            >
              {loadingDrives ? (
                <div
                  style={{
                    padding: '18px',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <CircularProgress size={16} style={{ color: '#66c0f4' }} />
                  <span>Carregando unidades configuradas...</span>
                </div>
              ) : configuredDrives.length === 0 && !customPathActive ? (
                /* Estado Inicial quando o usuário ainda não pré-definiu os caminhos dos HDs/NVMes */
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.32)',
                    border: '1px dashed rgba(102, 192, 244, 0.4)',
                    borderRadius: '10px',
                    padding: '20px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(42, 128, 235, 0.16)',
                      border: '1px solid rgba(102, 192, 244, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#66c0f4',
                      fontSize: '17px'
                    }}
                  >
                    <FontAwesomeIcon icon={faCog} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    Nenhum caminho de HD / NVMe pré-definido
                  </div>
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#9ca3af',
                      maxWidth: '470px',
                      lineHeight: 1.45
                    }}
                  >
                    Pré-defina a pasta de jogos para cada HD ou NVMe que você possui. Após configurar, seus discos aparecerão aqui prontos para mover qualquer jogo com 1 clique.
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsConfiguringDrives(true)}
                    style={{
                      marginTop: '4px',
                      background: 'linear-gradient(90deg, #2a80eb 0%, #1a9fff 100%)',
                      border: '1px solid rgba(102, 192, 244, 0.5)',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(42, 128, 235, 0.4)'
                    }}
                  >
                    <FontAwesomeIcon icon={faCog} />
                    <span>Pré-definir Caminhos dos HDs / NVMe</span>
                  </button>
                </div>
              ) : (
                configuredDrives.map((drive) => {
                  const isCurrentDrive =
                    drive.letter.toUpperCase() === currentDriveLetter
                  const isSelected =
                    !customPathActive &&
                    selectedPath.toLowerCase() === drive.path.toLowerCase()

                  const usedBytes = Math.max(0, drive.totalSpace - drive.freeSpace)
                  const usedPercent =
                    drive.totalSpace > 0
                      ? Math.min(100, Math.round((usedBytes / drive.totalSpace) * 100))
                      : 0

                  return (
                    <div
                      key={drive.letter}
                      onClick={() => handleSelectDrive(drive)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        background: isSelected ? '#2a80eb' : '#212934',
                        border: isSelected
                          ? '1px solid #66c0f4'
                          : '1px solid rgba(255, 255, 255, 0.09)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        cursor: isMoving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected
                          ? '0 4px 14px rgba(42, 128, 235, 0.4)'
                          : 'none',
                        userSelect: 'none'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minWidth: 0
                          }}
                        >
                          <FontAwesomeIcon
                            icon={faHardDrive}
                            style={{
                              fontSize: '16px',
                              color: isSelected ? '#ffffff' : '#66c0f4'
                            }}
                          />
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: '#ffffff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {drive.name}
                          </span>
                          {isCurrentDrive && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isSelected
                                  ? 'rgba(0, 0, 0, 0.28)'
                                  : 'rgba(102, 192, 244, 0.15)',
                                color: isSelected ? '#fff' : '#66c0f4',
                                border: isSelected
                                  ? '1px solid rgba(255, 255, 255, 0.35)'
                                  : '1px solid rgba(102, 192, 244, 0.35)'
                              }}
                            >
                              UNIDADE ATUAL
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            flexShrink: 0
                          }}
                        >
                          {isSelected && (
                            <FontAwesomeIcon
                              icon={faStar}
                              style={{ fontSize: '12px', color: '#ffffff' }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              color: '#ffffff',
                              letterSpacing: '0.3px'
                            }}
                          >
                            {formatFreeSpaceSteam(drive.freeSpace)}
                          </span>
                        </div>
                      </div>

                      {/* Barra Visual de Espaço do HD/SSD Estilo Steam + Caminho Pré-Definido pelo Usuário */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        {drive.totalSpace > 0 && (
                          <div
                            style={{
                              flex: 1,
                              height: '5px',
                              background: isSelected
                                ? 'rgba(0, 0, 0, 0.35)'
                                : 'rgba(0, 0, 0, 0.45)',
                              borderRadius: '999px',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${usedPercent}%`,
                                height: '100%',
                                background: isSelected
                                  ? '#ffffff'
                                  : usedPercent > 90
                                  ? '#ff5252'
                                  : '#66c0f4',
                                borderRadius: '999px',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            color: isSelected
                              ? 'rgba(255, 255, 255, 0.92)'
                              : 'rgba(255, 255, 255, 0.6)',
                            flexShrink: 0
                          }}
                        >
                          Pasta: {drive.path}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}

              {customPathActive && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#2a80eb',
                    border: '1px solid #66c0f4',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(42, 128, 235, 0.4)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      minWidth: 0
                    }}
                  >
                    <FontAwesomeIcon icon={faFolderOpen} style={{ fontSize: '16px' }} />
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {destinationFullPreview}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <FontAwesomeIcon icon={faStar} style={{ fontSize: '12px' }} />
                    <span style={{ fontSize: '11.5px', fontWeight: 800 }}>PASTA AVULSA</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Resumo de Origem ➔ Destino */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.32)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '9px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                <strong style={{ color: '#cbd5e1', minWidth: '58px' }}>Origem:</strong>
                <span style={{ wordBreak: 'break-all', color: '#e2e8f0' }}>{currentInstallDir}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                <strong style={{ color: '#66c0f4', minWidth: '58px' }}>Destino:</strong>
                <FontAwesomeIcon icon={faArrowRight} style={{ color: '#66c0f4', fontSize: '11px' }} />
                <span style={{ wordBreak: 'break-all', color: '#ffffff', fontWeight: 600 }}>
                  {destinationFullPreview || 'Configure ou selecione uma unidade de destino'}
                </span>
              </div>
            </div>

            {/* Avisos de Validação */}
            {isSameDestination && !moveCompletedPath && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: '#fcd34d'
                }}
              >
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#f59e0b' }} />
                <span>
                  O jogo já está instalado nesta pasta. Selecione outro HD/NVMe ou configure outra unidade na engrenagem (⚙️).
                </span>
              </div>
            )}

            {hasInsufficientSpace && (
              <div
                style={{
                  background: 'rgba(255, 82, 82, 0.12)',
                  border: '1px solid rgba(255, 82, 82, 0.35)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: '#fca5a5'
                }}
              >
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#ff5252' }} />
                <span>
                  Espaço livre insuficiente na unidade selecionada ({formatBytesCompact(selectedDriveObj?.freeSpace || 0)} livres para {displaySize}).
                </span>
              </div>
            )}

            {/* Barra de Progresso ao Vivo durante a Transferência */}
            {isMoving && (
              <div
                style={{
                  background: 'rgba(42, 128, 235, 0.12)',
                  border: '1px solid rgba(102, 192, 244, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CircularProgress size={14} style={{ color: '#66c0f4' }} />
                    <span>Movendo arquivos do jogo...</span>
                  </div>
                  <span style={{ color: '#66c0f4' }}>{movePercent}%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(0, 0, 0, 0.45)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${movePercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #2a80eb 0%, #00e5ff 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.25s ease'
                    }}
                  />
                </div>
                {moveCurrentFile && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    Arquivo: {moveCurrentFile}
                  </div>
                )}
              </div>
            )}

            {/* Sucesso */}
            {moveCompletedPath && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#6ee7b7'
                }}
              >
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#10b981', fontSize: '18px' }} />
                <div>
                  <strong>Jogo movido com sucesso!</strong>
                  <div style={{ fontSize: '12px', color: '#a7f3d0', marginTop: '2px' }}>
                    Nova pasta: {moveCompletedPath}
                  </div>
                </div>
              </div>
            )}

            {/* Erro */}
            {moveError && (
              <div
                style={{
                  background: 'rgba(255, 82, 82, 0.12)',
                  border: '1px solid rgba(255, 82, 82, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  color: '#fca5a5'
                }}
              >
                {moveError}
              </div>
            )}

            {/* Garantias GhostShield */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.07)',
                border: '1px solid rgba(16, 185, 129, 0.22)',
                borderRadius: '8px',
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px',
                color: '#6ee7b7'
              }}
            >
              <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#10b981', fontSize: '14px', flexShrink: 0 }} />
              <span>
                Capas personalizadas, executável principal, configurações e saves do GhostShield são atualizados e preservados automaticamente.
              </span>
            </div>
          </>
        )}

        {/* Rodapé com Botões Estilo Steam */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '4px'
          }}
        >
          {isConfiguringDrives ? (
            <button
              type="button"
              onClick={() => setIsConfiguringDrives(false)}
              style={{
                background: 'linear-gradient(90deg, #2a80eb 0%, #1a9fff 100%)',
                border: '1px solid rgba(102, 192, 244, 0.5)',
                borderRadius: '8px',
                padding: '10px 22px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(42, 128, 235, 0.45)',
                transition: 'all 0.2s ease'
              }}
            >
              <FontAwesomeIcon icon={faCheck} />
              <span>Concluir Configuração ({configuredDrives.length} HD/NVMe)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isMoving}
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: '#e5e7eb',
                  cursor: isMoving ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isMoving) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'
                }}
                onMouseOut={(e) => {
                  if (!isMoving) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'
                }}
              >
                {moveCompletedPath ? 'Concluir' : 'Cancelar'}
              </button>

              {currentInstallDir && !moveCompletedPath && (
                <button
                  type="button"
                  disabled={
                    isMoving ||
                    !selectedPath ||
                    isSameDestination ||
                    hasInsufficientSpace
                  }
                  onClick={handleStartMove}
                  style={{
                    background:
                      isMoving || !selectedPath || isSameDestination || hasInsufficientSpace
                        ? 'rgba(42, 128, 235, 0.3)'
                        : 'linear-gradient(90deg, #2a80eb 0%, #1a9fff 100%)',
                    border: '1px solid rgba(102, 192, 244, 0.5)',
                    borderRadius: '8px',
                    padding: '10px 22px',
                    color: '#ffffff',
                    cursor:
                      isMoving || !selectedPath || isSameDestination || hasInsufficientSpace
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow:
                      isMoving || !selectedPath || isSameDestination || hasInsufficientSpace
                        ? 'none'
                        : '0 4px 15px rgba(42, 128, 235, 0.45)',
                    transition: 'all 0.2s ease',
                    opacity:
                      isMoving || !selectedPath || isSameDestination || hasInsufficientSpace
                        ? 0.55
                        : 1
                  }}
                >
                  {isMoving ? (
                    <>
                      <CircularProgress size={15} style={{ color: '#fff' }} />
                      <span>Movendo Jogo...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faHardDrive} />
                      <span>Mover Conteúdo</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
