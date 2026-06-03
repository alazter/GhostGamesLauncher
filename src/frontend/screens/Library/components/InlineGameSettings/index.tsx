import React, { useState, useEffect, useContext, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faGlobe, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { faSteam, faApple, faLinux, faWindows } from '@fortawesome/free-brands-svg-icons'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import { CircularProgress } from '@mui/material'
import { useTranslation, Trans } from 'react-i18next'
import { GameInfo } from 'common/types'
import { UpdateComponent, PathSelectionBox, InfoBox, TextInputField, SteamGridDBPicker, CachedImage, WarningMessage } from 'frontend/components/UI'
import useSettingsContext from 'frontend/hooks/useSettingsContext'
import SettingsContext from 'frontend/screens/Settings/SettingsContext'
import useSetting from 'frontend/hooks/useSetting'
import LauncherArgs from 'frontend/screens/Settings/components/LauncherArgs'
import BeforeLaunchScriptPath from 'frontend/screens/Settings/components/BeforeLaunchScriptPath'
import AfterLaunchScriptPath from 'frontend/screens/Settings/components/AfterLaunchScriptPath'
import EnvVariablesTable from 'frontend/screens/Settings/components/EnvVariablesTable'
import AlternativeExe from 'frontend/screens/Settings/components/AlternativeExe'
import { sideloadLibrary, gameOverridesStore } from 'frontend/helpers/electronStores'

// Material Icons para as Ações do Jogo e Visibilidade
import {
  Edit as EditIcon,
  Shortcut as ShortcutIcon,
  Delete as DeleteIcon,
  FormatListBulleted as FormatListBulletedIcon,
  Folder as FolderIcon,
  Visibility as EyeIcon,
  VisibilityOff as EyeOffIcon,
  Terminal as TerminalIcon,
  Title as TitleIcon
} from '@mui/icons-material'

// Componentes Globais do Heroic
import ContextProvider from 'frontend/state/ContextProvider'
import useGlobalState from 'frontend/state/GlobalStateV2'
import EditGameDialog from 'frontend/components/UI/EditGameDialog'
import UninstallModal from 'frontend/components/UI/UninstallModal'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'

interface Props {
  game: GameInfo
  onClose: () => void
}

interface ActionItem {
  id: string
  name: string
  iconKey: string
  isVisible: boolean
}

const DEFAULT_ACTIONS: ActionItem[] = [
  { id: 'rename', name: 'Nome de jogo', iconKey: 'rename', isVisible: true },
  { id: 'edit', name: 'Editar App/Jogo', iconKey: 'edit', isVisible: true },
  { id: 'shortcut', name: 'Adicionar atalho', iconKey: 'shortcut', isVisible: true },
  { id: 'browse', name: 'Navegar pelos arquivos', iconKey: 'browse', isVisible: true },
  { id: 'categories', name: 'Categorias', iconKey: 'categories', isVisible: true },
  { id: 'steam', name: 'Adicionar ao Steam', iconKey: 'steam', isVisible: true },
  { id: 'logs', name: 'Logs detalhados', iconKey: 'logs', isVisible: true },
  { id: 'uninstall', name: 'Desinstalar', iconKey: 'uninstall', isVisible: true }
]

const syncFrontendStoreForSideload = (updatedGame: GameInfo) => {
  try {
    const games = sideloadLibrary.get('games', [])
    const idx = games.findIndex((g) => g.app_name === updatedGame.app_name)
    if (idx !== -1) {
      games[idx] = { ...games[idx], ...updatedGame }
    } else {
      games.push(updatedGame)
    }
    sideloadLibrary.set('games', games)

    if (updatedGame.title) {
      const overrides = gameOverridesStore.get('overrides', {})
      overrides[updatedGame.app_name] = {
        ...overrides[updatedGame.app_name],
        title: updatedGame.title,
        art_cover: updatedGame.art_cover || overrides[updatedGame.app_name]?.art_cover || '',
        art_square: updatedGame.art_square || overrides[updatedGame.app_name]?.art_square || ''
      }
      gameOverridesStore.set('overrides', overrides)
      useGlobalState.getState().setGameOverrides(overrides)
    }
  } catch (err) {
    console.error('Error syncing frontend stores for sideload:', err)
  }
}

const syncFrontendStoreForOverride = (
  appName: string,
  title: string,
  artCover?: string,
  artSquare?: string
) => {
  try {
    const overrides = gameOverridesStore.get('overrides', {})
    if (!title && !artCover && !artSquare) {
      delete overrides[appName]
    } else {
      overrides[appName] = {
        ...overrides[appName],
        title: title || overrides[appName]?.title || '',
        art_cover: artCover || overrides[appName]?.art_cover || '',
        art_square: artSquare || overrides[appName]?.art_square || ''
      }
    }
    gameOverridesStore.set('overrides', overrides)
    useGlobalState.getState().setGameOverrides(overrides)
  } catch (err) {
    console.error('Error syncing frontend overrides:', err)
  }
}

export default function InlineGameSettings({ game, onClose }: Props) {
  const { t, i18n } = useTranslation('gamepage')
  const { showDialogModal, refreshLibrary } = useContext(ContextProvider)
  const { openGameCategoriesModal } = useGlobalState.keys('openGameCategoriesModal')

  const [isEditingTitle, setIsEditingTitle] = useState(false)

  const [sideloadExe, setSideloadExe] = useState<string>(() => {
    return game.install?.executable || ''
  })

  useEffect(() => {
    setSideloadExe(game.install?.executable || '')
  }, [game])

  const [inlineSgdbTarget, setInlineSgdbTarget] = useState<'cover' | 'square' | null>(null)
  const [editCover, setEditCover] = useState('')
  const [editSquare, setEditSquare] = useState('')

  useEffect(() => {
    if (inlineSgdbTarget) {
      setEditCover(game.overrides?.art_cover || game.art_cover || '')
      setEditSquare(game.overrides?.art_square || game.art_square || '')
    }
  }, [inlineSgdbTarget, game])

  const handleSideloadExeChange = async (newPath: string) => {
    setSideloadExe(newPath)
    try {
      const updatedGame: GameInfo = {
        runner: 'sideload',
        app_name: game.app_name,
        title: game.title,
        install: {
          executable: newPath,
          platform: game.install?.platform || 'windows',
          is_dlc: false
        },
        art_cover: game.art_cover || '',
        is_installed: true,
        art_square: game.art_square || '',
        canRunOffline: true,
        browserUrl: game.browserUrl || '',
        customUserAgent: game.customUserAgent || '',
        launchFullScreen: game.launchFullScreen || false
      }
      
      syncFrontendStoreForSideload(updatedGame)

      await window.api.addNewApp(updatedGame)

      if (refreshLibrary) {
        await refreshLibrary({
          library: 'sideload',
          runInBackground: true,
          checkForUpdates: true
        })
      }
    } catch (err) {
      console.error('Error updating sideload executable:', err)
    }
  }

  const settingsContextValues = useSettingsContext({
    appName: game.app_name,
    gameInfo: game,
    runner: game.runner
  })

  const [addedToSteam, setAddedToSteam] = useState<boolean>(false)
  const [steamRefresh, setSteamRefresh] = useState<boolean>(false)
  const [hasShortcuts, setHasShortcuts] = useState<boolean>(false)
  const [showUninstallModal, setShowUninstallModal] = useState<boolean>(false)
  
  const verboseLogs = settingsContextValues ? settingsContextValues.getSetting('verboseLogs', true) : true
  const setVerboseLogs = (newVal: boolean) => {
    if (settingsContextValues) {
      settingsContextValues.setSetting('verboseLogs', newVal)
    }
  }

  const getInitialTitle = () => {
    if (game.runner === 'sideload') {
      return game.title
    }
    return game.overrides?.title || game.title
  }

  const [currentTitle, setCurrentTitle] = useState(getInitialTitle())
  const isFocusedTitle = useRef(false)

  useEffect(() => {
    if (!isFocusedTitle.current) {
      setCurrentTitle(getInitialTitle())
    }
  }, [game])

  // Dispatch custom event to notify GameCard of real-time title changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('heroicGameTitleChanged', {
        detail: {
          appName: game.app_name,
          runner: game.runner,
          title: currentTitle
        }
      })
    )
  }, [currentTitle, game.app_name, game.runner])

  // Customização da aba de ações
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false)
  const [actions, setActions] = useState<ActionItem[]>(() => {
    const saved = localStorage.getItem('heroic_inline_settings_actions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ActionItem[]
        const ids = new Set(parsed.map(a => a.id))
        const missing = DEFAULT_ACTIONS.filter(a => !ids.has(a.id))
        return [...parsed, ...missing]
      } catch (err) {
        console.error('Error parsing inline settings actions:', err)
      }
    }
    return DEFAULT_ACTIONS
  })

  // Persistir ordem e visibilidade das ações do grid
  useEffect(() => {
    localStorage.setItem('heroic_inline_settings_actions', JSON.stringify(actions))
  }, [actions])

  // Drag and drop para ordenação das ações
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (hoveredIndex !== index) {
      setHoveredIndex(index)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) return
    
    const newActions = [...actions]
    const temp = newActions[draggedIndex]
    newActions[draggedIndex] = newActions[targetIndex]
    newActions[targetIndex] = temp
    setActions(newActions)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setHoveredIndex(null)
  }

  const toggleActionVisibility = (index: number) => {
    const newActions = [...actions]
    newActions[index].isVisible = !newActions[index].isVisible
    setActions(newActions)
  }

  // Carregar atalhos do Steam e do Sistema na inicialização
  useEffect(() => {
    let isMounted = true
    window.api.isAddedToSteam(game.app_name, game.runner).then((added) => {
      if (isMounted) setAddedToSteam(added)
    })
    window.api.shortcutsExists(game.app_name, game.runner).then((added) => {
      if (isMounted) setHasShortcuts(added)
    })
    return () => {
      isMounted = false
    }
  }, [game.app_name, game.runner])

  const handleToggleSteam = async () => {
    if (steamRefresh) return
    setSteamRefresh(true)
    try {
      if (addedToSteam) {
        await window.api.removeFromSteam(game.app_name, game.runner)
        setAddedToSteam(false)
      } else {
        const added = await window.api.addToSteam(game.app_name, game.runner)
        setAddedToSteam(added)
      }
    } catch (err) {
      console.error('Error toggling Steam shortcut:', err)
    } finally {
      setSteamRefresh(false)
    }
  }

  const handleShortcuts = () => {
    if (hasShortcuts) {
      window.api.removeShortcut(game.app_name, game.runner)
      setHasShortcuts(false)
    } else {
      window.api.addShortcut(game.app_name, game.runner, true)
      setHasShortcuts(true)
    }
  }

  const onBrowseFiles = () => {
    const path = game.install?.install_path || game.folder_name
    if (path) {
      window.api.openFolder(path)
    }
  }

  const handleEdit = () => {
    // Para a interface nova e linda, a página de capas do SteamGridDB ocupará toda a interface
    setInlineSgdbTarget('square')
  }

  const handleDeleteCover = async () => {
    try {
      if (game.runner === 'sideload') {
        const updatedGame: GameInfo = {
          runner: 'sideload',
          app_name: game.app_name,
          title: game.title,
          install: {
            executable: game.install?.executable || '',
            platform: game.install?.platform || 'windows',
            is_dlc: false
          },
          art_cover: '',
          is_installed: true,
          art_square: game.art_square || '',
          canRunOffline: true,
          browserUrl: game.browserUrl || '',
          customUserAgent: game.customUserAgent || '',
          launchFullScreen: game.launchFullScreen || false
        }

        syncFrontendStoreForSideload(updatedGame)

        await window.api.addNewApp(updatedGame)
        await window.api.setGameMetadataOverride({
          appName: game.app_name,
          title: game.title,
          art_cover: '',
          art_square: game.overrides?.art_square || ''
        })
      } else {
        syncFrontendStoreForOverride(
          game.app_name,
          game.overrides?.title || '',
          '',
          game.overrides?.art_square || ''
        )

        await window.api.setGameMetadataOverride({
          appName: game.app_name,
          title: game.overrides?.title || '',
          art_cover: '',
          art_square: game.overrides?.art_square || ''
        })
      }

      if (refreshLibrary) {
        await refreshLibrary({
          library: game.runner,
          runInBackground: true,
          checkForUpdates: true
        })
      }
    } catch (err) {
      console.error('Error deleting cover art:', err)
    }
  }

  const confirmDeleteCover = () => {
    showDialogModal({
      title: t('delete_cover.title', 'Deletar Capa'),
      message: t('delete_cover.message', 'Você gostaria de deletar essa capa de jogo?'),
      buttons: [
        {
          text: t('delete_cover.confirm', 'Deletar'),
          onClick: handleDeleteCover
        },
        {
          text: t('delete_cover.cancel', 'Cancelar'),
          onClick: () => null
        }
      ]
    })
  }

  const sectionHeaderStyle = {
    fontFamily: 'var(--secondary-font-family)',
    fontSize: '15px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '6px'
  }

  const renderActionButton = (id: string) => {
    switch (id) {
      case 'rename':
        return isEditingTitle ? (
          <GameTitleInput
            key="rename"
            game={game}
            title={currentTitle}
            setTitle={setCurrentTitle}
            isFocusedRef={isFocusedTitle}
            onBlur={() => setIsEditingTitle(false)}
          />
        ) : (
          <ActionButton
            key="rename"
            icon={<TitleIcon />}
            label={`Nome de jogo: ${currentTitle || 'inserir nome'}`}
            onClick={() => setIsEditingTitle(true)}
          />
        )
      case 'edit':
        return (
          <ActionButton
            key="edit"
            icon={<EditIcon />}
            label={game.runner === 'sideload' ? t('button.sideload.edit', 'Editar App/Jogo') : t('button.edit-game', 'Editar Jogo')}
            onClick={handleEdit}
          />
        )
      case 'shortcut':
        return (
          <ActionButton
            key="shortcut"
            icon={<ShortcutIcon />}
            label={hasShortcuts ? t('submenu.removeShortcut', 'Remover atalhos') : t('submenu.addShortcut', 'Adicionar atalho')}
            onClick={handleShortcuts}
            steamBrandColor={hasShortcuts}
          />
        )
      case 'browse':
        return (
          <ActionButton
            key="browse"
            icon={<FolderIcon />}
            label={t('button.browse_files', 'Navegar pelos arquivos')}
            onClick={onBrowseFiles}
          />
        )
      case 'categories':
        return (
          <ActionButton
            key="categories"
            icon={<FormatListBulletedIcon />}
            label={t('submenu.categories', 'Categorias')}
            onClick={() => openGameCategoriesModal(game)}
          />
        )
      case 'steam':
        return (
          <ActionButton
            key="steam"
            icon={
              steamRefresh ? (
                <CircularProgress size={18} style={{ color: '#66c0f4' }} />
              ) : (
                <FontAwesomeIcon icon={faSteam} style={{ fontSize: '18px' }} />
              )
            }
            label={addedToSteam ? t('submenu.removeFromSteam', 'Remover do Steam') : t('submenu.addToSteam', 'Adicionar ao Steam')}
            onClick={handleToggleSteam}
            steamBrandColor={addedToSteam}
          />
        )
      case 'logs':
        return (
          <ActionButton
            key="logs"
            icon={<TerminalIcon />}
            label={verboseLogs ? t('button.verboseLogs.disable', 'Desativar logs detalhados') : t('button.verboseLogs.enable', 'Ativar logs detalhados')}
            onClick={() => setVerboseLogs(!verboseLogs)}
            steamBrandColor={verboseLogs}
          />
        )
      case 'uninstall':
        return (
          <ActionButton
            key="uninstall"
            icon={<DeleteIcon />}
            label={t('button.uninstall', 'Desinstalar')}
            onClick={() => setShowUninstallModal(true)}
            danger
          />
        )
      default:
        return null
    }
  }

  const renderCustomizerButton = (act: ActionItem, idx: number) => {
    const isDanger = act.id === 'uninstall'
    let isSteamBrand = false
    if (act.id === 'steam') isSteamBrand = addedToSteam
    else if (act.id === 'logs') isSteamBrand = verboseLogs
    else if (act.id === 'shortcut') isSteamBrand = hasShortcuts
    
    let iconNode = null
    if (act.id === 'rename') iconNode = <TitleIcon />
    else if (act.id === 'edit') iconNode = <EditIcon />
    else if (act.id === 'shortcut') iconNode = <ShortcutIcon />
    else if (act.id === 'browse') iconNode = <FolderIcon />
    else if (act.id === 'categories') iconNode = <FormatListBulletedIcon />
    else if (act.id === 'steam') iconNode = <FontAwesomeIcon icon={faSteam} />
    else if (act.id === 'logs') iconNode = <TerminalIcon />
    else if (act.id === 'uninstall') iconNode = <DeleteIcon />

    const isHoveredTarget = hoveredIndex === idx && draggedIndex !== idx

    return (
      <div
        key={act.id}
        draggable
        onDragStart={(e) => handleDragStart(e, idx)}
        onDragOver={(e) => handleDragOver(e, idx)}
        onDrop={(e) => handleDrop(e, idx)}
        onDragEnd={handleDragEnd}
        onClick={() => toggleActionVisibility(idx)}
        style={{
          position: 'relative',
          cursor: 'grab',
          opacity: act.isVisible ? (draggedIndex === idx ? 0.4 : 1) : 0.25,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHoveredTarget ? 'scale(1.02)' : 'scale(1)',
          outline: isHoveredTarget ? '2px dashed #00ffff' : '2px dashed transparent',
          outlineOffset: '-2px',
          borderRadius: '10px'
        }}
      >
        <ActionButton
          icon={iconNode}
          label={act.id === 'rename' ? 'Nome de jogo' : (act.id === 'edit' && game.runner === 'sideload' ? t('button.sideload.edit', 'Editar App/Jogo') : t(`button.${act.id}`, act.name))}
          onClick={() => {}} // Clique gerenciado pela div pai
          danger={isDanger}
          steamBrandColor={isSteamBrand}
        />
        {/* Indicador de olho vetorizado perfeitamente alinhado e centralizado no canto superior direito */}
        <div style={{
          position: 'absolute',
          top: '6px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: act.isVisible ? '#00ffff' : 'rgba(255, 255, 255, 0.4)',
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '50%',
          width: '22px',
          height: '22px',
          pointerEvents: 'none',
          userSelect: 'none',
          border: act.isVisible ? '1px solid rgba(0, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          zIndex: 10
        }}>
          {act.isVisible ? (
            <EyeIcon style={{ fontSize: '13px' }} />
          ) : (
            <EyeOffIcon style={{ fontSize: '13px' }} />
          )}
        </div>
      </div>
    )
  }

  if (!settingsContextValues) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(30, 34, 40, 0.4)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '24px',
        marginTop: '-9px',
        marginRight: '15px',
        height: '100%',
        minHeight: 0
      }}>
        <UpdateComponent />
      </div>
    )
  }

  if (inlineSgdbTarget) {
    const platformIcon = () => {
      const appPlatform = (game.install?.platform || 'windows').toLowerCase()
      let icon = faGlobe
      if (appPlatform.includes('win')) icon = faWindows
      else if (appPlatform.includes('linux')) icon = faLinux
      else if (appPlatform.includes('mac') || appPlatform.includes('osx')) icon = faApple
      
      return (
        <FontAwesomeIcon
          style={{ opacity: 0.6, fontSize: '16px' }}
          icon={icon}
        />
      )
    }

    return (
      <div 
        className="inline-game-settings-container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(20, 24, 30, 0.45)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          padding: '16px',
          marginTop: '-9px',
          marginRight: '15px',
          marginBottom: '20px',
          height: 'calc(100% - 11px)',
          minHeight: 0,
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', gap: '0px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Coluna Esquerda: Previews (Imagem 1) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '180px',
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            paddingRight: '12px',
            height: '100%',
            overflowY: 'auto'
          }}>
            {/* Capa Vertical */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
                Capa Vertical
              </span>
              <div
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: inlineSgdbTarget === 'square' ? '3px solid #3cf2e6' : '3px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                  transform: inlineSgdbTarget === 'square' ? 'scale(1.02)' : 'none',
                  boxShadow: inlineSgdbTarget === 'square' ? '0 0 15px rgba(60, 242, 230, 0.35)' : 'none'
                }}
                onClick={() => setInlineSgdbTarget('square')}
              >
                <CachedImage
                  style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }}
                  src={editSquare || fallbackImage}
                />
              </div>
            </div>

            {/* Banner Horizontal */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
                Banner Horizontal
              </span>
              <div
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: inlineSgdbTarget === 'cover' ? '3px solid #3cf2e6' : '3px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                  transform: inlineSgdbTarget === 'cover' ? 'scale(1.02)' : 'none',
                  boxShadow: inlineSgdbTarget === 'cover' ? '0 0 15px rgba(60, 242, 230, 0.35)' : 'none'
                }}
                onClick={() => setInlineSgdbTarget('cover')}
              >
                <CachedImage
                  style={{ width: '100%', aspectRatio: '1600/650', objectFit: 'cover', display: 'block' }}
                  src={editCover || editSquare || fallbackImage}
                />
              </div>
            </div>

            {/* Informações do Jogo */}
            <div style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                {currentTitle}
              </span>
              {platformIcon()}
            </div>
          </div>

          {/* Coluna Direita: SteamGridDBPicker */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
            <SteamGridDBPicker
              initialTitle={currentTitle}
              mode={inlineSgdbTarget === 'cover' ? 'heroes' : 'grids'}
              hideCloseButton={true}
              onClose={() => setInlineSgdbTarget(null)}
              onSelect={(url: string) => {
                if (inlineSgdbTarget === 'cover') {
                  setEditCover(url)
                } else {
                  setEditSquare(url)
                }
              }}
            />
          </div>
        </div>

        {/* Footer com botões Terminar / Cancelar */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '16px',
          width: '100%',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '16px'
        }}>
          <button
            onClick={() => setInlineSgdbTarget(null)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              try {
                if (game.runner === 'sideload') {
                  const updatedGame: GameInfo = {
                    runner: 'sideload',
                    app_name: game.app_name,
                    title: game.title,
                    install: {
                      executable: game.install?.executable || '',
                      platform: game.install?.platform || 'windows',
                      is_dlc: false
                    },
                    art_cover: editCover || game.art_cover || '',
                    is_installed: true,
                    art_square: editSquare || game.art_square || '',
                    canRunOffline: true,
                    browserUrl: game.browserUrl || '',
                    customUserAgent: game.customUserAgent || '',
                    launchFullScreen: game.launchFullScreen || false
                  }

                  syncFrontendStoreForSideload(updatedGame)
                  await window.api.addNewApp(updatedGame)

                  await window.api.setGameMetadataOverride({
                    appName: game.app_name,
                    title: game.overrides?.title || game.title,
                    art_cover: editCover,
                    art_square: editSquare
                  })
                } else {
                  const finalCover = editCover === game.art_cover ? '' : editCover
                  const finalSquare = editSquare === game.art_square ? '' : editSquare

                  syncFrontendStoreForOverride(
                    game.app_name,
                    game.overrides?.title || '',
                    finalCover,
                    finalSquare
                  )

                  await window.api.setGameMetadataOverride({
                    appName: game.app_name,
                    title: game.overrides?.title || '',
                    art_cover: finalCover,
                    art_square: finalSquare
                  })
                }

                if (refreshLibrary) {
                  await refreshLibrary({
                    library: game.runner,
                    runInBackground: true,
                    checkForUpdates: true
                  })
                }
              } catch (err) {
                console.error('Error saving inline SteamGridDB art:', err)
              } finally {
                setInlineSgdbTarget(null)
              }
            }}
            style={{
              backgroundColor: '#50e3c2',
              color: '#12161a',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.03)'
              e.currentTarget.style.backgroundColor = '#40d3b2'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.backgroundColor = '#50e3c2'
            }}
          >
            Terminar
          </button>
        </div>
      </div>
    )
  }

  return (
    <SettingsContext.Provider value={settingsContextValues}>
      <div 
        className="inline-game-settings-container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(20, 24, 30, 0.45)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          padding: '16px',
          marginTop: '-9px',
          marginRight: '15px',
          marginBottom: '20px',
          height: 'calc(100% - 11px)',
          minHeight: 0,
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          #root .inline-game-settings-container .helpLink {
            height: auto !important;
            margin-block-start: 0 !important;
          }
          #root .inline-game-settings-container .textInputFieldWrapper label,
          #root .inline-game-settings-container .tableFieldWrapper label {
            font-size: var(--text-md) !important;
          }
        `}} />
        {showUninstallModal && (
          <UninstallModal
            appName={game.app_name}
            runner={game.runner}
            isDlc={Boolean(game.install?.is_dlc)}
            onClose={() => setShowUninstallModal(false)}
          />
        )}

        {/* Cabeçalho */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#fff',
              margin: 0
            }}>
              {currentTitle} (Configurações)
            </h2>
            <button
              onClick={confirmDeleteCover}
              title={t('delete_cover.title', 'Deletar Capa')}
              style={{
                background: 'rgba(255, 75, 75, 0.05)',
                border: '1px solid rgba(255, 75, 75, 0.2)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff5252',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 75, 75, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(255, 75, 75, 0.4)'
                e.currentTarget.style.color = '#ff6e6e'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 75, 75, 0.05)'
                e.currentTarget.style.borderColor = 'rgba(255, 75, 75, 0.2)'
                e.currentTarget.style.color = '#ff5252'
              }}
            >
              <DeleteIcon style={{ fontSize: '18px' }} />
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
            }}
          >
            <FontAwesomeIcon icon={faTimes} style={{ fontSize: '14px' }} />
          </button>
        </div>

        {/* Abas e Personalizar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '24px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div 
              onClick={() => setIsCustomizing(false)}
              style={{
                color: !isCustomizing ? '#00ffff' : 'rgba(255, 255, 255, 0.6)',
                fontWeight: '700',
                fontSize: '13px',
                letterSpacing: '1px',
                paddingBottom: '12px',
                borderBottom: !isCustomizing ? '2px solid #00ffff' : '2px solid transparent',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s ease'
              }}
            >
              Avançado
            </div>
            <div 
              onClick={() => setIsCustomizing(true)}
              style={{
                color: isCustomizing ? '#00ffff' : 'rgba(255, 255, 255, 0.6)',
                fontWeight: '700',
                fontSize: '13px',
                letterSpacing: '1px',
                paddingBottom: '12px',
                borderBottom: isCustomizing ? '2px solid #00ffff' : '2px solid transparent',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s ease'
              }}
            >
              ⚙️ Organizar Seções
            </div>
          </div>
        </div>

        {/* Área de rolagem para o conteúdo */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {isCustomizing ? (
            /* TELA DE CUSTOMIZAÇÃO ALINHADA 100% COM A ESTÉTICA REAL */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '12px', lineHeight: '1.4' }}>
                Arraste os botões para reordená-los. Clique em qualquer um deles para alternar sua visibilidade na página principal (botões ocultos ficam opacos).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {actions.map((act, idx) => renderCustomizerButton(act, idx))}
              </div>
            </div>
          ) : (
            /* RENDEREIZAÇÃO DAS SEÇÕES ORDENADAS E VISÍVEIS */
            <>
              {/* AÇÕES DO JOGO (CUSTOMIZÁVEL) */}
              <div>
                <h3 style={sectionHeaderStyle}>Ações do Jogo</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {actions
                    .filter(act => act.isVisible)
                    .map(act => renderActionButton(act.id))}
                </div>
              </div>

              {/* Executável Alternativo (Selecionar Executável) */}
              <AlternativeExe />

              {/* Executável para Sideloaded Games */}
              {game.runner === 'sideload' && game.install?.platform !== 'Browser' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', rowGap: '4px' }}>
                  <label htmlFor="sideload-exe-inline" style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'normal', color: 'var(--text-secondary)', justifySelf: 'start', textAlign: 'left' }}>
                    {t('sideload.info.exe', 'Select Executable')}
                  </label>
                  <InfoBox
                    align="right"
                    text={t(
                      'sideload.import-hint.title',
                      'Important! Are you adding a game from Epic/GOG/Amazon? Click here!'
                    )}
                  >
                    <div className="sideloadImportHint">
                      <Trans i18n={i18n} ns="gamepage" i18nKey="sideload.import-hint.content">
                        Do NOT use this feature for that.
                        <br />
                        Instead, <NavLink to={'/login'}>log into</NavLink> the
                        store, look for the game in your library, open the
                        installation dialog, and click the &quot;Import Game&quot;
                        button
                      </Trans>
                    </div>
                  </InfoBox>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <PathSelectionBox
                      type="file"
                      onPathChange={handleSideloadExeChange}
                      path={sideloadExe}
                      placeholder={t('sideload.info.exe', 'Select Executable')}
                      pathDialogTitle={t('box.sideload.exe', 'Select Executable')}
                      pathDialogDefaultPath={game.install?.install_path || ''}
                      htmlId="sideload-exe-inline"
                      noDeleteButton
                    />
                  </div>
                </div>
              )}

              {/* Argumentos */}
              <div>
                <LauncherArgs />
              </div>

              {/* Scripts */}
              <div>
                <h3 style={sectionHeaderStyle}>Scripts</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <BeforeLaunchScriptPath />
                  <AfterLaunchScriptPath />
                </div>
              </div>

              {/* Variáveis de Ambiente */}
              <div style={{ paddingBottom: '10px' }}>
                <EnvVariablesTable />
              </div>
            </>
          )}
        </div>
      </div>
    </SettingsContext.Provider>
  )
}

function GameTitleInput({
  game,
  title,
  setTitle,
  isFocusedRef,
  onBlur
}: {
  game: GameInfo
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  isFocusedRef: React.MutableRefObject<boolean>
  onBlur: () => void
}) {
  const { t } = useTranslation('gamepage')
  const { refreshLibrary } = useContext(ContextProvider)

  // Mantém a referência do título mais recente para salvamento imediato no unmount
  const titleRef = useRef(title)
  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    return () => {
      const finalTitle = titleRef.current.trim()
      const currentTitle = game.runner === 'sideload' ? game.title : (game.overrides?.title || game.title)
      if (finalTitle && finalTitle !== currentTitle) {
        try {
          if (game.runner === 'sideload') {
            const updatedGame: GameInfo = {
              runner: 'sideload',
              app_name: game.app_name,
              title: finalTitle,
              install: {
                executable: game.install?.executable || '',
                platform: game.install?.platform || 'windows',
                is_dlc: false
              },
              art_cover: game.art_cover || '',
              is_installed: true,
              art_square: game.art_square || '',
              canRunOffline: true,
              browserUrl: game.browserUrl || '',
              customUserAgent: game.customUserAgent || '',
              launchFullScreen: game.launchFullScreen || false
            }

            syncFrontendStoreForSideload(updatedGame)

            window.api.addNewApp(updatedGame)
            window.api.setGameMetadataOverride({
              appName: game.app_name,
              title: finalTitle,
              art_cover: game.overrides?.art_cover || '',
              art_square: game.overrides?.art_square || ''
            })
          } else {
            syncFrontendStoreForOverride(
              game.app_name,
              finalTitle === game.title ? '' : finalTitle,
              game.overrides?.art_cover || '',
              game.overrides?.art_square || ''
            )

            window.api.setGameMetadataOverride({
              appName: game.app_name,
              title: finalTitle === game.title ? '' : finalTitle,
              art_cover: game.overrides?.art_cover || '',
              art_square: game.overrides?.art_square || ''
            })
          }
          if (refreshLibrary) {
            refreshLibrary({
              library: game.runner,
              runInBackground: true,
              checkForUpdates: true
            })
          }
        } catch (err) {
          console.error('Error saving game title on unmount:', err)
        }
      }
    }
  }, [game, refreshLibrary])

  // Efeito para salvamento automático com debounce de 350ms
  useEffect(() => {
    const currentTitle = game.runner === 'sideload' ? game.title : (game.overrides?.title || game.title)
    if (title === currentTitle) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const delayDebounceFn = setTimeout(async () => {
      try {
        if (game.runner === 'sideload') {
          // Para sideload, atualizamos o título no banco de dados do sideload
          const updatedGame: GameInfo = {
            runner: 'sideload',
            app_name: game.app_name,
            title: trimmedTitle,
            install: {
              executable: game.install?.executable || '',
              platform: game.install?.platform || 'windows',
              is_dlc: false
            },
            art_cover: game.art_cover || '',
            is_installed: true,
            art_square: game.art_square || '',
            canRunOffline: true,
            browserUrl: game.browserUrl || '',
            customUserAgent: game.customUserAgent || '',
            launchFullScreen: game.launchFullScreen || false
          }

          syncFrontendStoreForSideload(updatedGame)

          await window.api.addNewApp(updatedGame)
          // Também atualizamos no sistema de overrides do Heroic para garantir sincronia em todo o app
          await window.api.setGameMetadataOverride({
            appName: game.app_name,
            title: trimmedTitle,
            art_cover: game.overrides?.art_cover || '',
            art_square: game.overrides?.art_square || ''
          })
        } else {
          // Para outros runners, usamos o sistema de overrides padrão do Heroic
          syncFrontendStoreForOverride(
            game.app_name,
            trimmedTitle === game.title ? '' : trimmedTitle,
            game.overrides?.art_cover || '',
            game.overrides?.art_square || ''
          )

          await window.api.setGameMetadataOverride({
            appName: game.app_name,
            title: trimmedTitle === game.title ? '' : trimmedTitle,
            art_cover: game.overrides?.art_cover || '',
            art_square: game.overrides?.art_square || ''
          })
        }

        if (refreshLibrary) {
          await refreshLibrary({
            library: game.runner,
            runInBackground: true,
            checkForUpdates: true
          })
        }
      } catch (err) {
        console.error('Error saving game title:', err)
      }
    }, 350) // Debounce de 350ms

    return () => clearTimeout(delayDebounceFn)
  }, [title, game, refreshLibrary])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      background: 'rgba(0, 255, 255, 0.05)',
      border: '1px solid rgba(0, 255, 255, 0.3)',
      borderRadius: '10px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 
        - **Remoção de Bordas e Contornos (Visual Premium)**: O navegador/sistema ou a biblioteca global (Bulma) aplicavam por padrão um contorno verde arredondado de alta especificidade na caixa de edição ativa do texto. Para anular isso de forma definitiva e impecável, criamos uma regra CSS local com **especificidade ultra-alta** (`#root .inline-game-settings-container input.inline-title-input`) que redefine de forma forçada (`!important`) as propriedades `outline: none`, `border: none` e `box-shadow: none` em todos os estados de foco e interação (`:focus`, `:focus-visible` e `:active`) ao focar, deixando a edição com um visual premium, limpo, totalmente desobstruído e perfeitamente integrado à estética original do Heroic.
        - **Sincronização de Altura e Padding (Sem Desvio de Layout)**: Anteriormente, a caixa de input possuía uma altura fixa e padding de tamanho diferente em comparação com os botões normais (`ActionButton`), o que causava uma mudança de tamanho (encolhimento) visual desagradável ao alternar para o modo de edição. Corrigimos isso igualando o padding do container de input exatamente com o do botão (`padding: 12px 16px`) e eliminando a altura fixa (`height: 46px`). Agora ambos possuem as mesmas dimensões dinâmicas exatas, mantendo a estabilidade de layout perfeita ao clicar.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        #root .inline-game-settings-container input.inline-title-input,
        #root .inline-game-settings-container input.inline-title-input:focus,
        #root .inline-game-settings-container input.inline-title-input:focus-visible,
        #root .inline-game-settings-container input.inline-title-input:active {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}} />
      <TitleIcon style={{ color: '#00ffff', fontSize: '24px', marginRight: '12px' }} />
      <span style={{
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        marginRight: 0,
        whiteSpace: 'pre',
        userSelect: 'none'
      }}>
        Nome de jogo:{" "}
      </span>
      <input
        autoFocus
        className="inline-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true
        }}
        onBlur={() => {
          isFocusedRef.current = false
          onBlur()
        }}
        onKeyDown={handleKeyDown}
        maxLength={40}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '500',
          fontFamily: 'inherit',
          lineHeight: 'inherit',
          width: '100%',
          padding: 0,
          margin: 0
        }}
        placeholder="Digite o nome..."
      />
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  danger,
  steamBrandColor
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  steamBrandColor?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  
  const getHoverBg = () => {
    if (steamBrandColor) return 'rgba(102, 192, 244, 0.12)'
    return 'rgba(255, 255, 255, 0.08)'
  }

  const getHoverBorder = () => {
    if (steamBrandColor) return '1px solid rgba(102, 192, 244, 0.4)'
    return '1px solid rgba(255, 255, 255, 0.15)'
  }

  const getHoverColor = () => {
    if (danger) return '#ff5252'
    if (steamBrandColor) return '#66c0f4'
    return '#00ffff'
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: hovered ? getHoverBg() : 'rgba(255, 255, 255, 0.03)',
        border: hovered ? getHoverBorder() : '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '10px',
        color: hovered ? getHoverColor() : 'rgba(255, 255, 255, 0.8)',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'left',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        opacity: hovered ? 1 : 0.7,
        transition: 'opacity 0.2s ease',
        color: hovered ? getHoverColor() : (steamBrandColor ? '#66c0f4' : 'rgba(255, 255, 255, 0.7)')
      }}>
        {icon}
      </div>
      <span style={{ transition: 'color 0.2s ease' }}>{label}</span>
    </button>
  )
}
