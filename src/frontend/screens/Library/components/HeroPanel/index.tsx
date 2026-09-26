import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay,
  faCog,
  faStop,
  faDownload,
  faSpinner,
  faTimes,
  faRepeat,
  faStore,
  faNewspaper,
  faUsers,
  faUser,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons'
import { GameInfo, Runner } from 'common/types'
import { accountProviderNames } from 'common/types/connectedAccounts'
import { useContext, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import { hasStatus } from 'frontend/hooks/hasStatus'
import { launch, sendKill, updateGame } from 'frontend/helpers'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'
import { timestampStore } from 'frontend/helpers/electronStores'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import ExternalStoreLogo from 'frontend/screens/DownloadManager/components/ExternalStoreLogo'
import ankerLogo from 'frontend/assets/ankergames-logo.png'
import steamripLogo from 'frontend/assets/steamrip-logo.png'
import onlineFixLogo from 'frontend/assets/onlinefix-logo.png'
import { useExternalGames } from 'frontend/screens/ExternalGames/shared'
import CachedImage from 'frontend/components/UI/CachedImage'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import { getImageFormatting } from 'frontend/screens/Library/components/GameCard/constants'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { isPirateOrNonOfficialGame } from 'frontend/helpers/customStoreFiltering'
import { getDefaultDownloadStoreId, findPiratasStoreId } from 'frontend/helpers/autoStoreAssignments'

interface Props {
  game: GameInfo
  onClose: () => void
  onSettingsClick?: () => void
}

export default function HeroPanel({ game, onClose, onSettingsClick }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation('gamepage')
  const { showDialogModal, connectivity, gameUpdates } = useContext(ContextProvider)

  const { status } = hasStatus(game)
  const [isLaunching, setIsLaunching] = useState(false)
  const isInstalled = game.accountProvider
    ? Boolean(game.is_installed && game.install?.executable && game.install.executable.trim() !== '')
    : Boolean(game.is_installed)
  const hasUpdate = Boolean(isInstalled && gameUpdates?.includes(game.app_name))

  const { gameOverrides } = useGlobalState.keys('gameOverrides')
  const gameOverride = gameOverrides[game.app_name]

  const [tsInfo, setTsInfo] = useState(() => timestampStore.get_nodefault(game.app_name))
  const [panelTitle, setPanelTitle] = useState<string>(
    () => gameOverride?.title || game.overrides?.title || game.title
  )

  const { state: extState } = useExternalGames()

  const matchedInstallation = useMemo(() => {
    const gameAppName = String(game.app_name || '').toLowerCase()
    const gameTitle = String(game.title || '').trim().toLowerCase()
    const gameFolder = String(game.folder_name || game.install?.install_path || '').trim().toLowerCase()
    const gameExe = String(game.install?.executable || '').trim().toLowerCase()

    return extState.installations?.find((i) => {
      if (!i) return false
      const instAppName = String(i.appName || '').toLowerCase()
      const instId = String(i.id || '').toLowerCase()

      // 1. Direct AppName or ID match
      if (gameAppName && (instAppName === gameAppName || instId === gameAppName)) return true
      if (gameAppName && instAppName && (gameAppName.includes(instId) || instAppName.includes(gameAppName))) return true

      // 2. Folder / Directory match (critical for sideload/piratas where install_path is in folder_name)
      const instDir = String(i.directory || '').trim().toLowerCase()
      if (gameFolder && instDir && (gameFolder === instDir || gameFolder.replace(/[/\\]+$/, '') === instDir.replace(/[/\\]+$/, ''))) return true

      // 3. Executable match
      const instExe = String(i.executable || '').trim().toLowerCase()
      if (gameExe && instExe && gameExe === instExe) return true

      // 4. Title match
      const instTitle = String(i.game?.title || '').trim().toLowerCase()
      if (gameTitle && instTitle && gameTitle === instTitle) return true

      return false
    })
  }, [extState.installations, game.app_name, game.folder_name, game.install?.install_path, game.install?.executable, game.title])

  const externalSource = useMemo(() => {
    if (matchedInstallation?.game) {
      const pName = matchedInstallation.game.providerName || ''
      const pId = matchedInstallation.game.providerId || ''
      const isOnlineFix =
        pId.includes('online') ||
        pName.toLowerCase().includes('online') ||
        matchedInstallation.game.id?.includes('online-fix') ||
        matchedInstallation.game.pageUrl?.includes('online-fix')
      const isAnker =
        pId.includes('anker') ||
        pName.toLowerCase().includes('anker') ||
        matchedInstallation.game.pageUrl?.includes('anker')
      const isSteamrip =
        pId.includes('steamrip') ||
        pName.toLowerCase().includes('steamrip') ||
        matchedInstallation.game.pageUrl?.includes('steamrip')

      const resolvedName = isOnlineFix ? 'Online-Fix' : isAnker ? 'AnkerGames' : isSteamrip ? 'SteamRIP' : pName || 'Fonte Externa'
      const resolvedIcon = isOnlineFix ? onlineFixLogo : isAnker ? ankerLogo : isSteamrip ? steamripLogo : (matchedInstallation.game.providerIcon || undefined)

      return {
        name: resolvedName,
        icon: resolvedIcon,
        pageUrl: matchedInstallation.game.pageUrl,
        homepage: matchedInstallation.game.pageUrl ? new URL(matchedInstallation.game.pageUrl).origin : undefined
      }
    }

    const fullText = `${game.title || ''} ${game.app_name || ''} ${game.folder_name || ''} ${game.install?.install_path || ''} ${game.install?.executable || ''} ${game.store_url || ''}`.toLowerCase()
    if (fullText.includes('steamrip')) {
      return {
        name: 'SteamRIP',
        icon: steamripLogo,
        pageUrl: game.store_url?.includes('steamrip') ? game.store_url : 'https://steamrip.com',
        homepage: 'https://steamrip.com'
      }
    }
    if (fullText.includes('ankergames') || fullText.includes('anker')) {
      return {
        name: 'AnkerGames',
        icon: ankerLogo,
        pageUrl: game.store_url?.includes('ankergames') ? game.store_url : 'https://ankergames.net',
        homepage: 'https://ankergames.net'
      }
    }
    if (fullText.includes('online-fix') || fullText.includes('onlinefix') || (fullText.includes('online') && fullText.includes('fix'))) {
      return {
        name: 'Online-Fix',
        icon: onlineFixLogo,
        pageUrl: game.store_url?.includes('online-fix') ? game.store_url : 'https://online-fix.me',
        homepage: 'https://online-fix.me'
      }
    }

    return null
  }, [matchedInstallation, game.app_name, game.folder_name, game.install?.install_path, game.install?.executable, game.title, game.store_url])

  const getEffectiveSquare = () =>
    gameOverride?.art_square !== undefined
      ? gameOverride.art_square
      : game.overrides?.art_square !== undefined
      ? game.overrides.art_square
      : game.art_square || ''

  const getEffectiveCover = () =>
    gameOverride?.art_cover !== undefined
      ? gameOverride.art_cover
      : game.overrides?.art_cover !== undefined
      ? game.overrides.art_cover
      : game.art_cover || ''

  const [panelSquare, setPanelSquare] = useState<string>(getEffectiveSquare)
  const [panelCover, setPanelCover] = useState<string>(getEffectiveCover)

  useEffect(() => {
    setTsInfo(timestampStore.get_nodefault(game.app_name))
    setPanelTitle(gameOverride?.title || game.overrides?.title || game.title)
    setPanelSquare(getEffectiveSquare())
    setPanelCover(getEffectiveCover())
  }, [
    game.app_name,
    status,
    game.title,
    game.overrides?.title,
    game.art_square,
    game.overrides?.art_square,
    game.art_cover,
    game.overrides?.art_cover,
    gameOverride
  ])

  useEffect(() => {
    const handleTitleChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        appName: string
        runner: Runner
        title: string
      }>
      const { appName: eventAppName, runner: eventRunner, title: eventTitle } = customEvent.detail
      if (eventAppName === game.app_name && eventRunner === game.runner) {
        setPanelTitle(eventTitle)
      }
    }
    window.addEventListener('heroicGameTitleChanged', handleTitleChanged)
    return () =>
      window.removeEventListener('heroicGameTitleChanged', handleTitleChanged)
  }, [game.app_name, game.runner])

  useEffect(() => {
    const handleCoverChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        appName: string
        runner: Runner
        art_cover: string
        art_square: string
      }>
      const { appName: eventAppName, runner: eventRunner, art_cover, art_square } = customEvent.detail
      if (eventAppName === game.app_name && eventRunner === game.runner) {
        setPanelSquare(art_square)
        setPanelCover(art_cover)
      }
    }
    window.addEventListener('heroicGameCoverChanged', handleCoverChanged)
    return () =>
      window.removeEventListener('heroicGameCoverChanged', handleCoverChanged)
  }, [game.app_name, game.runner])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const playTimeStr = useMemo(() => {
    if (!tsInfo || !tsInfo.totalPlayed) return t('game.neverPlayed', 'Never')
    const hours = Math.floor(tsInfo.totalPlayed / 60)
    if (hours > 0) {
      return `${hours}h`
    }
    return `${tsInfo.totalPlayed}m`
  }, [tsInfo, t])

  const lastPlayedStr = useMemo(() => {
    if (!tsInfo || !tsInfo.lastPlayed) return t('game.neverPlayed', 'Never')
    try {
      const date = new Date(tsInfo.lastPlayed)
      return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(date)
    } catch {
      return t('game.neverPlayed', 'Never')
    }
  }, [tsInfo, t])

  useEffect(() => {
    setIsLaunching(false)
  }, [status, game.app_name])

  const handlePlay = async () => {
    if (game.accountProvider) {
      try { await window.api.openAccountGame(game.app_name) }
      catch { showDialogModal({ title: 'Não foi possível abrir a loja', message: 'Verifique sua conexão e tente novamente.', buttons: [{ text: 'OK', onClick: () => {} }] }) }
      return
    }
    if (status !== 'playing' && isLaunching) return
    if (status === 'notAvailable') {
      handleSettings()
      return
    }

    const appName = game.app_name
    const runner = game.runner

    if (!isInstalled && status !== 'queued' && runner !== 'sideload') {
      if (runner === 'steam') {
        void window.api.openExternalUrl(`steam://install/${appName}`)
        return
      }
      openInstallGameModal({ appName, runner, gameInfo: game })
      return
    }

    if (status === 'playing' || status === 'updating' || status === 'installing') {
      await sendKill(appName, runner)
      return
    }

    if (status === 'queued') {
      window.localStorage.removeItem(appName)
      await window.api.removeFromDMQueue(appName)
      return
    }

    if (isInstalled) {
      setIsLaunching(true)
      const isOffline = connectivity.status !== 'online'
      const notPlayableOffline = isOffline && !game.canRunOffline
      const hasUpdate = isInstalled && gameUpdates?.includes(appName)

      void launch({
        appName,
        t,
        runner,
        hasUpdate,
        showDialogModal,
        notPlayableOffline
      }).finally(() => {
        setIsLaunching(false)
      })
      setTimeout(() => setIsLaunching(false), 3000)
    }
  }

  const handleSettings = () => {
    if (onSettingsClick) {
      onSettingsClick()
    } else {
      navigate(`/gamepage/${game.runner}/${game.app_name}`, { state: { gameInfo: game } })
    }
  }

  const isPiratasOrExternalStore = useMemo(() => {
    if (game.accountProvider) return false
    // 1. Possui correspondência em instalações externas registradas
    if (matchedInstallation) return true

    // 2. Detectada fonte comunitária/externa (SteamRIP, AnkerGames, Online-Fix, etc.)
    if (externalSource) return true

    // 3. Jogo marcado como pirata ou não-oficial (sem DRM de lojas oficiais)
    if (isPirateOrNonOfficialGame(game)) return true

    // 4. Runner sideload (todos os sideloads são jogos externos/comunitários no Ghost)
    if (game.runner === 'sideload') return true

    // 5. Atribuído explicitamente à loja padrão de downloads / Piratas
    try {
      const rawAssignments = localStorage.getItem('heroic_game_assignments')
      if (rawAssignments) {
        const assignments = JSON.parse(rawAssignments)
        const assigned = (assignments[game.app_name] || '').toLowerCase()
        const defaultStore = getDefaultDownloadStoreId().toLowerCase()
        const piratasStore = findPiratasStoreId().toLowerCase()
        if (
          assigned === 'piratas' ||
          assigned.includes('pirata') ||
          assigned === defaultStore ||
          assigned === piratasStore
        ) {
          return true
        }
      }
    } catch {}

    // 6. Visualizando a biblioteca pela loja padrão dos jogos vindos da página buscar jogos ("Piratas")
    try {
      const activeFilter = localStorage.getItem('heroic_active_store_filter')
      if (activeFilter) {
        const filterLower = activeFilter.toLowerCase()
        const defaultStore = getDefaultDownloadStoreId().toLowerCase()
        const piratasStore = findPiratasStoreId().toLowerCase()
        if (
          filterLower === 'piratas' ||
          filterLower.includes('pirata') ||
          filterLower === defaultStore ||
          filterLower === piratasStore
        ) {
          return true
        }
      }
    } catch {}

    return false
  }, [matchedInstallation, externalSource, game])

  const handleStore = () => {
    if (game.accountProvider) {
      void handlePlay()
      return
    }
    if (isPiratasOrExternalStore) {
      const targetTitle =
        matchedInstallation?.game?.title ||
        gameOverride?.title ||
        game.overrides?.title ||
        game.title ||
        game.app_name

      const instParam = matchedInstallation?.id
        ? `&installation=${encodeURIComponent(matchedInstallation.id)}`
        : ''

      navigate(`/external-games?q=${encodeURIComponent(targetTitle)}${instParam}`)
      return
    }

    let storeParam = 'epic'
    if (game.runner === 'gog') storeParam = 'gog'
    if (game.runner === 'nile') storeParam = 'amazon'
    if (game.runner === 'zoom') storeParam = 'zoom'
    if (game.runner === 'steam') {
      window.api.openExternalUrl(game.store_url || `https://store.steampowered.com/app/${game.app_name}/`)
      return
    }
    navigate(`/store/${storeParam}`)
  }

  const playButtonTitle = useMemo(() => {
    if (game.accountProvider) return t('accounts.openStore', 'Abrir {{store}}', { store: accountProviderNames[game.accountProvider] })
    if (status === 'playing') return t('label.playing.stop', 'Stop Game')
    if (isLaunching) return t('label.launching', 'Launching...')
    if (status === 'installing' || status === 'updating') return t('button.cancel', 'Cancel')
    if (status === 'queued') return t('button.queue.remove', 'Remove from Queue')
    if (status === 'notAvailable') return t('gamepage:status.gameNotAvailable', 'Arquivos indisponíveis')
    if (!isInstalled && game.runner !== 'sideload') return t('button.install', 'Install')
    return t('label.playing.start', 'Play')
  }, [status, isLaunching, isInstalled, game.runner, game.accountProvider, t])

  const renderPlayIcon = () => {
    if (game.accountProvider) return <FontAwesomeIcon icon={faStore} />
    if (status === 'playing') {
      return <FontAwesomeIcon icon={faStop} style={{ fontSize: '16px' }} />
    }
    if (isLaunching) {
      return <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '16px' }} />
    }
    if (status === 'installing' || status === 'updating') {
      return <FontAwesomeIcon icon={faTimes} style={{ fontSize: '16px' }} />
    }
    if (status === 'queued') {
      return <FontAwesomeIcon icon={faTimes} style={{ fontSize: '16px' }} />
    }
    if (status === 'notAvailable') {
      return <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '16px' }} />
    }
    if (!isInstalled && game.runner !== 'sideload') {
      return <FontAwesomeIcon icon={faDownload} style={{ fontSize: '16px' }} />
    }
    return <FontAwesomeIcon icon={faPlay} style={{ fontSize: '16px', marginLeft: '2px' }} />
  }

  return (
    <div style={{
      width: '310px',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      height: 'calc(100% - 4px)',
      marginBottom: '4px',
      boxSizing: 'border-box',
      flexShrink: 0,
      background: 'rgba(30, 34, 40, 0.4)',
      backdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '15px 15px 10px 15px',
      marginLeft: '15px',
      marginRight: '15px',
      marginTop: '0px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Imagem com a mesma proporção oficial (173/275) e a mesma capa do card da biblioteca */}
      <CachedImage
        src={getImageFormatting(panelSquare || panelCover, game.runner)}
        fallback={fallbackImage}
        alt={panelTitle}
        style={{
          width: 'calc(100% + 30px)',
          aspectRatio: '173 / 275',
          marginTop: '-15px',
          marginLeft: '-15px',
          marginRight: '-15px',
          objectFit: 'cover',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          filter: status === 'notAvailable' ? 'sepia(100%) opacity(0.7)' : !isInstalled ? 'grayscale(100%)' : 'none',
          transition: 'filter 0.25s ease'
        }}
        onClick={onClose}
      />

      {status === 'notAvailable' && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.75)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '4px',
          padding: '4px 8px',
          color: '#00ffff',
          fontWeight: 700,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          zIndex: 5
        }}>
          {t('gamepage:status.gameNotAvailable', 'Arquivos indisponíveis')}
        </div>
      )}

      {/* Titulo */}
      <h2 style={{
        fontSize: '18px',
        fontWeight: '700',
        color: '#fff',
        margin: '6px 0 2px 0',
        textAlign: 'center'
      }}>
        {panelTitle}
      </h2>

      {/* Selo de Atualização Disponível */}
      {hasUpdate && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          alignSelf: 'center',
          background: 'linear-gradient(135deg, rgba(255, 153, 0, 0.25), rgba(255, 85, 0, 0.15))',
          border: '1px solid rgba(255, 153, 0, 0.6)',
          borderRadius: '20px',
          padding: '4px 12px',
          color: '#ffbb33',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          boxShadow: '0 0 10px rgba(255, 153, 0, 0.3)',
          marginTop: '2px',
          marginBottom: '4px'
        }}>
          <FontAwesomeIcon icon={faRepeat} style={{ fontSize: '11px' }} />
          <span>{t('status.hasUpdates', 'Atualização Disponível')}</span>
        </div>
      )}

      {/* Ações primárias (Botoes Redondos do Mockup) */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center', margin: '6px 0' }}>
        {/* 1. Ícone da Loja (Badge informativo, sem link, sem zoom, tamanho ampliado) */}
        <div
          className="heroPanelStaticBadge"
          style={{
            background: 'transparent',
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            borderRadius: '0',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'default',
            transition: 'filter 0.2s ease',
            padding: '0',
            color: '#fff',
            transform: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.45))'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.filter = 'none'
          }}
          title={t('button.store', 'Store')}
        >
          <div style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StoreLogos runner={game.runner} appName={game.app_name} />
          </div>
        </div>

        {/* 1.1 Ícone da Fonte de Origem Externa (Badge informativo, sem link, sem zoom, tamanho ampliado, luz equilibrada) */}
        {externalSource && (
          <div
            className="heroPanelStaticBadge"
            style={{
              background: 'transparent',
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              borderRadius: '0',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default',
              transition: 'filter 0.2s ease',
              padding: '0',
              color: '#fff',
              transform: 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.filter = 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.45))'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.filter = 'none'
            }}
            title={`Origem: ${externalSource.name}`}
          >
            <ExternalStoreLogo
              name={externalSource.name}
              icon={externalSource.icon}
              size={38}
            />
          </div>
        )}

        {/* 2. Botão de Configurações do Jogo */}
        <div
          role="button"
          tabIndex={0}
          className="heroPanelActionIcon"
          onClick={handleSettings}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSettings()}
          style={{
            background: 'transparent',
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            borderRadius: '0',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.85)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease, filter 0.2s ease, color 0.2s ease',
            padding: '0'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.2)'
            e.currentTarget.style.color = '#00e5ff'
            e.currentTarget.style.filter = 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.9))'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
            e.currentTarget.style.filter = 'none'
          }}
          title={t('submenu.settings', 'Settings')}
        >
          <FontAwesomeIcon icon={faCog} style={{ fontSize: '20px' }} />
        </div>

        {/* 3. Botão de Atualizar (quando houver update) */}
        {hasUpdate && (
          <button
            onClick={() => {
              void updateGame({ appName: game.app_name, runner: game.runner, gameInfo: game })
              navigate('/download-manager')
            }}
            style={{
              background: 'linear-gradient(135deg, #ff9900, #ff5500)',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 12px rgba(255, 100, 0, 0.6)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)'
              e.currentTarget.style.boxShadow = '0 0 18px rgba(255, 100, 0, 0.8)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 100, 0, 0.6)'
            }}
            title={t('button.update', 'Atualizar jogo')}
          >
            <FontAwesomeIcon icon={faRepeat} style={{ fontSize: '16px' }} />
          </button>
        )}

        {/* 4. Botão de Play */}
        <button
          onClick={handlePlay}
          disabled={status !== 'playing' && isLaunching}
          style={{
            background: status === 'playing' ? '#ff4d4f' : status === 'notAvailable' ? '#f59e0b' : '#00ffff',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            cursor: status !== 'playing' && isLaunching ? 'default' : 'pointer',
            opacity: status !== 'playing' && isLaunching ? 0.7 : 1,
            transition: 'all 0.2s ease',
            boxShadow:
              status === 'playing'
                ? '0 0 12px rgba(255, 77, 79, 0.6)'
                : status === 'notAvailable'
                ? '0 0 12px rgba(245, 158, 11, 0.6)'
                : '0 0 10px rgba(0, 255, 255, 0.4)'
          }}
          onMouseOver={(e) => {
            if (status === 'playing' || !isLaunching) {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow =
                status === 'playing'
                  ? '0 0 18px rgba(255, 77, 79, 0.8)'
                  : status === 'notAvailable'
                  ? '0 0 18px rgba(245, 158, 11, 0.8)'
                  : '0 0 15px rgba(0, 255, 255, 0.6)'
            }
          }}
          onMouseOut={(e) => {
            if (status === 'playing' || !isLaunching) {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow =
                status === 'playing'
                  ? '0 0 12px rgba(255, 77, 79, 0.6)'
                  : status === 'notAvailable'
                  ? '0 0 12px rgba(245, 158, 11, 0.6)'
                  : '0 0 10px rgba(0, 255, 255, 0.4)'
            }
          }}
          title={playButtonTitle}
        >
          {renderPlayIcon()}
        </button>
      </div>

      {/* Infos de tempo */}
      <div style={{
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '13px',
        textAlign: 'center',
        margin: '6px 0',
        lineHeight: '1.4'
      }}>
        <div>{t('game.totalPlayed', 'Time Played')}: {playTimeStr}</div>
        <div>{t('game.lastPlayed', 'Last Played')}: {lastPlayedStr}</div>
      </div>

      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

      {/* Links de Sistema (Novo Layout de 2 Colunas com Separador) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
          {/* Coluna 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRight: '1px solid rgba(255, 255, 255, 0.1)', paddingRight: '4px' }}>
            <HeroLink
              icon={faStore}
              label="Loja"
              onClick={handleStore}
              title={isPiratasOrExternalStore ? `Abrir página de ${panelTitle || game.title || 'jogo'} em Buscar Jogos` : 'Abrir Loja'}
            />
            <HeroLink icon={faDownload} label="Downloads" onClick={() => navigate('/download-manager')} />
            <HeroLink icon={faNewspaper} label="Notícias" onClick={() => {}} />
          </div>
          {/* Coluna 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
            <HeroLink icon={faUsers} label="Comunidade" onClick={() => window.api.openExternalUrl('https://discord.gg/heroicgameslauncher')} />
            <HeroLink icon={faUser} label="Perfil do Usuário" onClick={() => navigate('/login')} />
            <HeroLink icon={faNewspaper} label="Notícias" onClick={() => {}} />
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroLink({ icon, label, onClick, center, title }: { icon: any, label: string, onClick: () => void, center?: boolean, title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
        gap: '8px',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
        width: '100%',
        whiteSpace: 'nowrap'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
      }}
    >
      <div style={{
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        flexShrink: 0
      }}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <span>{label}</span>
    </button>
  )
}
