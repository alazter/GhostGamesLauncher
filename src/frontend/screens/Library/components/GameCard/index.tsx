import './index.css'

import { useContext, CSSProperties, useMemo, useState, useEffect } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRepeat, faBan } from '@fortawesome/free-solid-svg-icons'

import DownIcon from 'frontend/assets/down-icon.svg?react'
import { FavouriteGame, GameInfo, HiddenGame, Runner } from 'common/types'
import { Link, useNavigate } from 'react-router-dom'
import PlayIcon from 'frontend/assets/play-icon.svg?react'
import SettingsIcon from 'frontend/assets/settings_icon_alt.svg?react'
import StopIcon from 'frontend/assets/stop-icon.svg?react'
import StopIconAlt from 'frontend/assets/stop-icon-alt.svg?react'
import {
  getGameInfo,
  getProgress,
  getStoreName,
  install,
  launch,
  sendKill
} from 'frontend/helpers'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import { updateGame } from 'frontend/helpers/library'
import { CachedImage } from 'frontend/components/UI'
import ContextMenu, { Item } from '../ContextMenu'
import { hasProgress } from 'frontend/hooks/hasProgress'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'

import classNames from 'classnames'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import UninstallModal from 'frontend/components/UI/UninstallModal'
import { getCardStatus, getImageFormatting } from './constants'
import { hasStatus } from 'frontend/hooks/hasStatus'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import LibraryContext from '../../LibraryContext'
import useGlobalState from 'frontend/state/GlobalStateV2'
import {
  Cancel,
  DeleteForever,
  Description,
  Download,
  Edit,
  Favorite,
  FavoriteBorder,
  List,
  OpenInNew,
  PlayArrow,
  PlaylistRemove,
  Settings,
  Upgrade,
  Visibility,
  VisibilityOff
} from '@mui/icons-material'
import EditGameDialog from 'frontend/components/UI/EditGameDialog'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'

interface Card {
  buttonClick: () => void
  hasUpdate: boolean
  isRecent: boolean
  justPlayed: boolean
  gameInfo: GameInfo
  forceCard?: boolean
  dataTour?: string
}

const storage: Storage = window.localStorage

// ===================================================================
// O TRUQUE MESTRE: Transformado em Fantasma para o Gamepad!
// ===================================================================
const NonFocusableButton = ({
  children,
  onClick,
  className,
  title,
  disabled,
  activeController
}: {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLDivElement>
  className?: string
  title?: string
  disabled?: boolean
  activeController?: boolean | string
}) => (
  <div
    // Remove o evento de clique e a interatividade se o controle estiver ativo
    onClick={
      activeController
        ? undefined
        : (e) => {
            if (disabled) return
            onClick?.(e)
          }
    }
    title={title}
    className={`svg-button ${className} ${disabled ? 'iconDisabled' : ''}`}
    style={{
      cursor: disabled ? 'default' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      // Trava de segurança física contra o sistema de foco do Heroic
      pointerEvents: activeController ? 'none' : 'auto'
    }}
    tabIndex={-1}
    data-sn-focusable="false"
  >
    {children}
  </div>
)
// ===================================================================

const GameCard = ({
  hasUpdate,
  buttonClick,
  forceCard,
  isRecent = false,
  justPlayed = false,
  gameInfo: gameInfoFromProps,
  dataTour
}: Card) => {
  const { app_name: appName, runner } = gameInfoFromProps
  const [gameInfo, setGameInfo] = useState<GameInfo>(gameInfoFromProps)
  const [showUninstallModal, setShowUninstallModal] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)

  const [isSelectedInline, setIsSelectedInline] = useState<boolean>(false)

  // Listen to active selected game changes reactively
  useEffect(() => {
    const handleSelectedChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ appName: string | null; runner: Runner | null }>
      const { appName: selAppName, runner: selRunner } = customEvent.detail
      setIsSelectedInline(selAppName === appName && selRunner === runner)
    }
    window.addEventListener('heroicSelectedGameChanged', handleSelectedChange)
    return () =>
      window.removeEventListener('heroicSelectedGameChanged', handleSelectedChange)
  }, [appName, runner])

  const [cardTitle, setCardTitle] = useState<string>(
    () => gameInfoFromProps.overrides?.title || gameInfoFromProps.title
  )

  // Keep card title synchronized with props
  useEffect(() => {
    setCardTitle(gameInfoFromProps.overrides?.title || gameInfoFromProps.title)
  }, [gameInfoFromProps.title, gameInfoFromProps.overrides?.title])

  // Listen to real-time title changes dispatched from settings panel
  useEffect(() => {
    const handleTitleChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        appName: string
        runner: Runner
        title: string
      }>
      const { appName: eventAppName, runner: eventRunner, title: eventTitle } = customEvent.detail
      if (eventAppName === appName && eventRunner === runner) {
        setCardTitle(eventTitle)
      }
    }
    window.addEventListener('heroicGameTitleChanged', handleTitleChanged)
    return () =>
      window.removeEventListener('heroicGameTitleChanged', handleTitleChanged)
  }, [appName, runner])

  // ESTADOS DAS CONFIGURAÇÕES DE PERSONALIZAÇÃO
  const [hideIconsGamepad, setHideIconsGamepad] = useState<boolean>(() => {
    const saved = storage.getItem('heroic_hide_icons_gamepad')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })

  const [hideIconsMouse, setHideIconsMouse] = useState<boolean>(() => {
    const saved = storage.getItem('heroic_hide_icons_mouse')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  // Escuta as mudanças de configuração
  useEffect(() => {
    const handleStorageChange = () => {
      const savedGamepad = storage.getItem('heroic_hide_icons_gamepad')
      const savedMouse = storage.getItem('heroic_hide_icons_mouse')
      if (savedGamepad !== null) setHideIconsGamepad(JSON.parse(savedGamepad) as boolean)
      if (savedMouse !== null) setHideIconsMouse(JSON.parse(savedMouse) as boolean)
    }

    window.addEventListener('heroicSettingsChanged', handleStorageChange)
    return () =>
      window.removeEventListener('heroicSettingsChanged', handleStorageChange)
  }, [])

  const { t } = useTranslation('gamepage')
  const { t: t2 } = useTranslation()

  const navigate = useNavigate()

  const {
    hiddenGames,
    favouriteGames,
    showDialogModal,
    activeController,
    connectivity,
    customCategories
  } = useContext(ContextProvider)

  // A LÓGICA MESTRA DE EXIBIÇÃO
  const shouldShowIcons = activeController ? !hideIconsGamepad : !hideIconsMouse

  const { openGameSettingsModal, openGameLogsModal, openGameCategoriesModal } =
    useGlobalState.keys(
      'openGameSettingsModal',
      'openGameLogsModal',
      'openGameCategoriesModal'
    )

  const { layout } = useContext(LibraryContext)

  const {
    art_logo: logo = undefined,
    is_installed: isInstalled,
    install: gameInstallInfo
  } = { ...gameInfoFromProps }
  const title = cardTitle
  const art_cover =
    gameInfoFromProps.overrides?.art_cover || gameInfoFromProps.art_cover
  const cover =
    gameInfoFromProps.overrides?.art_square || gameInfoFromProps.art_square

  const isInstallable =
    gameInfo.installable === undefined || gameInfo.installable

  const [progress, previousProgress] = hasProgress(appName, runner)
  const { install_size: size = '0' } = {
    ...gameInstallInfo
  }

  const { status, folder, label } = hasStatus(gameInfo, size)
  const isBrowserGame = gameInfo.install.platform === 'Browser'

  const assignedCategory = useMemo(() => {
    if (!customCategories || !customCategories.list) return null

    const gameId = `${appName}_${runner}`

    for (const [categoryName, gamesArray] of Object.entries(
      customCategories.list
    )) {
      if (Array.isArray(gamesArray) && gamesArray.includes(gameId)) {
        return categoryName
      }
    }
    return null
  }, [customCategories, appName, runner])

  const effectiveStore = assignedCategory || runner

  const renderCustomStoreLogo = (storeOrCategory: string) => {
    const key = storeOrCategory.toLowerCase()
    const svgStyle = { width: '100%', height: '100%', fill: 'currentColor' }

    switch (key) {
      case 'indies':
      case 'xbox':
        return (
          <svg viewBox="0 0 512 512" style={svgStyle}>
            <path d="M480 128H32C14.3 128 0 142.3 0 160v192c0 17.7 14.3 32 32 32h448c17.7 0 32-14.3 32-32V160c0-17.7-14.3-32-32-32zm-336 48h32v32h32v32h-32v32h-32v-32h-32v-32h32v-32zm208 112c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm80-48c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z" />
          </svg>
        )

      case 'steam':
        return (
          <svg viewBox="0 0 496 512" style={svgStyle}>
            <path d="M496 256c0 137-111 248-248 248-25.6 0-50.2-3.9-73.4-11.1l-16.3-22.6c-4.4-6.1-13.4-6.8-18.7-1.4l-57.1 57.1c-6.1 6.1-15.8 4.7-19.9-2.9l-22.8-42.3c-2.3-4.2-7.5-6.1-12-4.4-44.5 16.5-93.5 17.3-138.8 2.2C1.7 465.1-4.8 447.4 3.7 427.6c27-63.1 79.1-112.5 142.1-136.2l35.8-66.4c2.8-5.2 8.7-8 14.7-7.4l60.2 6c5.7.6 10.9-2.8 12.8-8.2l12.7-36.6c-27.1-26.7-27.4-70.5-.8-97.5 27.2-27.6 71.8-27.6 99 0 27.3 27.5 27.3 71.9 0 99.5-23.7 23.9-60.5 27.2-87.7 9.8l-12.8 36.8c-1.3 3.8-4.7 6.4-8.7 6.8l-59 5.9c-4.1.4-8-1.5-10.2-4.9l-34.5-54.8c-24-38.1-18.7-88.6 13.5-120.8 33-33.4 87.2-33.4 120.2 0s33 87.2 0 120.6c-29.2 29.5-74.1 33.3-107.6 11.2l34.2 54.3c2 3.2 1.3 7.4-1.6 9.8l-56.1 46c-3.1 2.5-7.5 2.5-10.6.1l-22-16.5c-3.1-2.3-7.4-2.2-10.4.3-39.6 33.5-94.8 44.7-145 28.5C39.6 373.1 8 327.3 8 274.6c0-128.8 111.9-234.6 248-234.6S504 145.8 504 274.6c0 15.6-1.7 30.9-4.9 45.7l-41.4-56.5c-4.1-5.6-12.2-6.5-17.4-1.9l-61.1 53.6c-5.8 5.1-6.5 13.9-1.5 19.8l61.6 71.6c4.6 5.3 12.6 6.1 18.2 1.9l40-29.7c8.1-6 10.1-17.1 4.5-25.3l-16-23z" />
          </svg>
        )

      case 'piratas':
        return (
          <svg viewBox="0 0 512 512" style={svgStyle}>
            <path d="M256 0C114.6 0 0 100.3 0 224c0 70.1 36.9 132.6 94.5 173.7 9.6 6.9 15.2 18.1 13.5 29.9l-9.4 66.2c-1.4 9.6 6 18.2 15.7 18.2H192v-48c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32v48h77.7c9.7 0 17.1-8.6 15.7-18.2l-9.4-66.2c-1.7-11.7 3.8-23 13.5-29.9C475.1 356.6 512 294.1 512 224 512 100.3 397.4 0 256 0zM176 256c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm160 0c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48z" />
          </svg>
        )

      default:
        return <StoreLogos runner={storeOrCategory as Runner} />
    }
  }

  useEffect(() => {
    setIsLaunching(false)
    const updateGameInfo = async () => {
      const newInfo = await getGameInfo(appName, runner)
      if (newInfo) {
        setGameInfo(newInfo)
      }
    }
    void updateGameInfo()
  }, [status, appName, runner])

  // Sync gameInfo state with new props when library updates
  useEffect(() => {
    setGameInfo(gameInfoFromProps)
  }, [gameInfoFromProps])

  async function handleUpdate() {
    if (gameInfo.runner !== 'sideload')
      await updateGame({ appName, runner, gameInfo })
  }

  const grid = forceCard || layout === 'grid'

  const {
    isInstalling,
    notSupportedGame,
    isUninstalling,
    isQueued,
    isPlaying,
    notAvailable,
    isUpdating,
    haveStatus
  } = getCardStatus(status, isInstalled, layout)

  const installingGrayscale = isInstalling
    ? `${125 - getProgress(progress)}%`
    : '100%'

  const handleRemoveFromQueue = () => {
    window.api.removeFromDMQueue(appName)
  }

  const renderIcon = () => {
    if (!isInstallable) {
      return (
        <FontAwesomeIcon
          title={t(
            'label.game.not-installable-game',
            'Game is NOT Installable'
          )}
          className="downIcon"
          icon={faBan}
        />
      )
    }

    if (notSupportedGame) {
      return (
        <FontAwesomeIcon
          title={t(
            'label.game.third-party-game',
            'Third-Party Game NOT Supported'
          )}
          className="downIcon"
          icon={faBan}
        />
      )
    }
    if (isUninstalling) {
      return (
        <NonFocusableButton disabled activeController={activeController}>
          <svg />
        </NonFocusableButton>
      )
    }
    if (isQueued) {
      return (
        <NonFocusableButton
          title={t('button.queue.remove', 'Remove from Queue')}
          className="queueIcon"
          activeController={activeController}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            handleRemoveFromQueue()
          }}
        >
          <RemoveCircleIcon />
        </NonFocusableButton>
      )
    }
    if (isPlaying) {
      return (
        <NonFocusableButton
          className="cancelIcon"
          activeController={activeController}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            void handlePlay(runner)
          }}
          title={`${t('label.playing.stop')} (${title})`}
        >
          <StopIconAlt />
        </NonFocusableButton>
      )
    }
    if (isInstalling || isQueued) {
      return (
        <NonFocusableButton
          className="cancelIcon"
          activeController={activeController}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            void handlePlay(runner)
          }}
          title={`${t('button.cancel')} (${title})`}
        >
          <StopIcon />
        </NonFocusableButton>
      )
    }
    if (isInstalled) {
      const disabled =
        isLaunching ||
        ['syncing-saves', 'launching', 'winetricks', 'redist'].includes(status!)
      return (
        <NonFocusableButton
          className={!notAvailable ? 'playIcon' : 'notAvailableIcon'}
          activeController={activeController}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            void handlePlay(runner)
          }}
          title={`${t('label.playing.start')} (${title})`}
          disabled={disabled}
        >
          {justPlayed ? <span>{t('button.play', 'PLAY')}</span> : <PlayIcon />}
        </NonFocusableButton>
      )
    } else {
      return (
        <NonFocusableButton
          className="downIcon"
          activeController={activeController}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            buttonClick()
          }}
          title={`${t('button.install')} (${title})`}
        >
          <DownIcon />
        </NonFocusableButton>
      )
    }
  }

  const isHiddenGame = useMemo(() => {
    return !!hiddenGames.list.find(
      (hiddenGame: HiddenGame) => hiddenGame.appName === appName
    )
  }, [hiddenGames, appName])

  const isFavouriteGame = useMemo(() => {
    return !!favouriteGames.list.find(
      (favouriteGame: FavouriteGame) => favouriteGame.appName === appName
    )
  }, [favouriteGames, appName])

  const onUninstallClick = function () {
    setShowUninstallModal(true)
  }

  const isSideloaded = runner === 'sideload'

  const handleEdit = () => {
    if (isSideloaded) {
      openInstallGameModal({ appName, runner, gameInfo })
      return
    }

    showDialogModal({
      showDialog: true,
      title: t('edit-game.title', 'Edit Game'),
      message: (
        <EditGameDialog
          gameInfo={gameInfo}
          backdropClick={() => showDialogModal({ showDialog: false })}
        />
      )
    })
  }

  const items: Item[] = [
    {
      label: t('button.queue.remove'),
      onclick: () => handleRemoveFromQueue(),
      show: isQueued && !isInstalling,
      icon: <Cancel />
    },
    {
      label: t('label.playing.stop'),
      onclick: () => void handlePlay(runner),
      show: isPlaying,
      icon: <Cancel />
    },
    {
      label: t('label.playing.start'),
      onclick: () => void handlePlay(runner),
      show: isInstalled && !isPlaying && !isUpdating && !isQueued,
      icon: <PlayArrow />
    },
    {
      label: t('button.update', 'Update'),
      onclick: () => void handleUpdate(),
      show: hasUpdate && !isUpdating && !isQueued,
      icon: <Upgrade />
    },
    {
      label: t('button.install'),
      onclick: () => buttonClick(),
      show: !isInstalled && !isQueued && isInstallable,
      icon: <Download />
    },
    {
      label: t('button.cancel'),
      onclick: () => void handlePlay(runner),
      show: isInstalling || isUpdating,
      icon: <Cancel />
    },
    {
      label: t('button.details', 'Details'),
      onclick: () =>
        navigate(`/gamepage/${runner}/${appName}`, { state: { gameInfo } }),
      show: true,
      icon: <OpenInNew />
    },
    {
      label: t('submenu.settings', 'Settings'),
      onclick: () => openGameSettingsModal(gameInfo),
      show: isInstalled && !isUninstalling && !isBrowserGame,
      icon: <Settings />
    },
    {
      label: t('submenu.logs', 'Logs'),
      onclick: () => openGameLogsModal(gameInfo),
      show: isInstalled && !isUninstalling && !isBrowserGame,
      icon: <Description />
    },
    {
      label: isSideloaded
        ? t('button.sideload.edit', 'Edit App/Game')
        : t('edit-game.title', 'Edit Game'),
      onclick: handleEdit,
      show: true,
      icon: <Edit />
    },
    {
      label: t('button.hide_game', 'Hide Game'),
      onclick: () => hiddenGames.add(appName, title),
      show: !isHiddenGame,
      icon: <VisibilityOff />
    },
    {
      label: t('button.unhide_game', 'Unhide Game'),
      onclick: () => hiddenGames.remove(appName),
      show: isHiddenGame,
      icon: <Visibility />
    },
    {
      label: t('button.add_to_favourites', 'Add To Favourites'),
      onclick: () => favouriteGames.add(appName, title),
      show: !isFavouriteGame,
      icon: <Favorite />
    },
    {
      label: t('submenu.categories', 'Categories'),
      onclick: () => openGameCategoriesModal(gameInfo),
      show: true,
      icon: <List />
    },
    {
      label: t('button.remove_from_favourites', 'Remove From Favourites'),
      onclick: () => favouriteGames.remove(appName),
      show: isFavouriteGame,
      icon: <FavoriteBorder />
    },
    {
      label: t('button.remove_from_recent', 'Remove From Recent'),
      onclick: async () => window.api.removeRecentGame(appName),
      show: isRecent,
      icon: <PlaylistRemove />
    },
    {
      label: t('button.uninstall'),
      onclick: onUninstallClick,
      show: isInstalled && !isUpdating && !isPlaying,
      icon: <DeleteForever />
    }
  ]

  const wrapperClasses = classNames(grid ? 'gameCard' : 'gameListItem', {
    installed: isInstalled,
    hidden: isHiddenGame,
    notAvailable: notAvailable,
    gamepad: !shouldShowIcons,
    justPlayed: justPlayed,
    selectedInline: isSelectedInline
  })

  const imgClasses = classNames('gameImg', { installed: isInstalled })
  const logoClasses = classNames('gameLogo', { installed: isInstalled })

  const showUpdateButton =
    hasUpdate && !isUpdating && !isQueued && !notAvailable

  const showSettingsButton = isInstalled && !isUninstalling && !isBrowserGame
  const showUpdateBadge =
    hasUpdate && !isUpdating && !isQueued && activeController

  return (
    <div>
      {showUninstallModal && (
        <UninstallModal
          appName={appName}
          runner={runner}
          isDlc={Boolean(gameInfo.install.is_dlc)}
          onClose={() => setShowUninstallModal(false)}
        />
      )}
      <ContextMenu items={items}>
        <div
          className={wrapperClasses}
          data-app-name={appName}
          data-tour={dataTour}
          tabIndex={0}
          data-sn-focusable="true"
          onFocus={(e) => {
            if (activeController) {
              e.currentTarget.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
              })
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const active = localStorage.getItem('heroic_use_inline_panel') !== 'false'
              if (active) {
                e.preventDefault()
                window.dispatchEvent(new CustomEvent('heroicSelectGameInline', {
                  detail: { gameInfo }
                }))
              } else if (activeController) {
                e.preventDefault()
                navigate(`/gamepage/${runner}/${appName}`, {
                  state: { gameInfo }
                })
              }
            }
          }}
        >
          {haveStatus && <span className="gameCardStatus">{label}</span>}
          {showUpdateBadge && (
            <span className="gameCardUpdateBadge">
              {t('status.hasUpdates')}
            </span>
          )}

          <Link
            to={`/gamepage/${runner}/${appName}`}
            state={{ gameInfo }}
            tabIndex={-1}
            data-sn-focusable="false"
            style={
              { '--installing-effect': installingGrayscale } as CSSProperties
            }
            onClick={(e) => {
              const active = localStorage.getItem('heroic_use_inline_panel') !== 'false'
              if (active) {
                e.preventDefault()
                window.dispatchEvent(new CustomEvent('heroicSelectGameInline', {
                  detail: { gameInfo }
                }))
              }
            }}
          >
            {justPlayed ? (
              <CachedImage
                src={art_cover || fallBackImage}
                className="justPlayedImg"
                alt={title}
              />
            ) : (
              <CachedImage
                src={getImageFormatting(cover, runner)}
                className={imgClasses}
                alt="cover"
              />
            )}
            {(justPlayed || runner !== 'nile') && logo && (
              <CachedImage
                alt="logo"
                src={`${logo}?h=400&resize=1&w=300`}
                className={logoClasses}
              />
            )}
            {haveStatus && (
              <span
                className={classNames('gameListInfo', {
                  active: haveStatus,
                  installed: isInstalled
                })}
              >
                {label}
              </span>
            )}
            <span
              className={classNames('gameTitle', {
                active: haveStatus,
                installed: isInstalled
              })}
            >
              <span>{title}</span>
            </span>
            <span
              className={classNames('runner', {
                active: haveStatus,
                installed: isInstalled
              })}
            >
              {getStoreName(runner, t2('Other'))}
            </span>
          </Link>

          {/* ========================================================= */}
          {/* LÓGICA DE EXIBIÇÃO DINÂMICA LIGADA ÀS CONFIGURAÇÕES       */}
          {/* ========================================================= */}
          {shouldShowIcons && (
            <span
              className="icons"
              data-sn-focusable="false"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '6px 10px 2px 10px',
                boxSizing: 'border-box',
                // Essa linha barra fisicamente o foco do controle
                pointerEvents: activeController ? 'none' : 'auto'
              }}
            >
              <div
                className="bottom-store-logo"
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'flex-start'
                }}
              >
                {renderCustomStoreLogo(effectiveStore)}
              </div>

              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {showUpdateButton && (
                  <NonFocusableButton
                    className="updateIcon"
                    title={`${t('button.update')} (${title})`}
                    activeController={activeController}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      void handleUpdate()
                    }}
                  >
                    <FontAwesomeIcon size={'2x'} icon={faRepeat} />
                  </NonFocusableButton>
                )}
                {showSettingsButton && (
                  <NonFocusableButton
                    title={`${t('submenu.settings')} (${title})`}
                    className="settingsIcon"
                    activeController={activeController}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      openGameSettingsModal(gameInfo)
                    }}
                  >
                    <SettingsIcon />
                  </NonFocusableButton>
                )}
              </div>

              <div
                style={{ display: 'flex', flex: 1, justifyContent: 'flex-end' }}
                onClick={(e) => e.stopPropagation()}
              >
                {renderIcon()}
              </div>
            </span>
          )}

          {/* ========================================================= */}
          {/* CSS INJETADO (SEMPRE RENDERIZADO)                         */}
          {/* ========================================================= */}
          <style>{`
            .bottom-store-logo > * {
              position: static !important;
              width: 45px !important;      
              height: 45px !important;     
              margin: 0 !important;
              opacity: 0.85;
              transition: opacity 0.2s ease;
            }
            .bottom-store-logo:hover > * {
              opacity: 1;
            }
          `}</style>
        </div>
      </ContextMenu>
    </div>
  )

  async function handlePlay(runner: Runner) {
    if (!isInstalled && !isQueued && gameInfo.runner !== 'sideload') {
      return install({
        gameInfo,
        installPath: folder || 'default',
        isInstalling,
        previousProgress,
        progress,
        t,
        showDialogModal
      })
    }

    if (isPlaying || isUpdating) {
      return sendKill(appName, runner)
    }

    if (isQueued) {
      storage.removeItem(appName)
      return window.api.removeFromDMQueue(appName)
    }

    if (isInstalled) {
      setIsLaunching(true)
      const isOffline = connectivity.status !== 'online'
      const notPlayableOffline = isOffline && !gameInfo.canRunOffline
      await launch({
        appName,
        t,
        runner,
        hasUpdate,
        showDialogModal,
        notPlayableOffline
      })
      setIsLaunching(false)
    }
    return
  }
}

export default GameCard
