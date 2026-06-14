import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faCog, faStop, faDownload, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons'
import { GameInfo, Runner } from 'common/types'
import { useContext, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import { hasStatus } from 'frontend/hooks/hasStatus'
import { launch, sendKill } from 'frontend/helpers'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'
import { timestampStore } from 'frontend/helpers/electronStores'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import CachedImage from 'frontend/components/UI/CachedImage'
import fallbackImage from 'frontend/assets/heroic_card.jpg'

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

  const [tsInfo, setTsInfo] = useState(() => timestampStore.get_nodefault(game.app_name))
  const [panelTitle, setPanelTitle] = useState<string>(
    () => game.overrides?.title || game.title
  )
  const [panelSquare, setPanelSquare] = useState<string>(
    () => game.overrides?.art_square || game.art_square || ''
  )
  const [panelCover, setPanelCover] = useState<string>(
    () => game.overrides?.art_cover || game.art_cover || ''
  )

  useEffect(() => {
    setTsInfo(timestampStore.get_nodefault(game.app_name))
    setPanelTitle(game.overrides?.title || game.title)
    setPanelSquare(game.overrides?.art_square || game.art_square || '')
    setPanelCover(game.overrides?.art_cover || game.art_cover || '')
  }, [
    game.app_name,
    status,
    game.title,
    game.overrides?.title,
    game.art_square,
    game.overrides?.art_square,
    game.art_cover,
    game.overrides?.art_cover
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

  const handlePlay = async () => {
    if (isLaunching) return

    const appName = game.app_name
    const runner = game.runner

    if (!game.is_installed && status !== 'queued' && runner !== 'sideload') {
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

    if (game.is_installed) {
      setIsLaunching(true)
      const isOffline = connectivity.status !== 'online'
      const notPlayableOffline = isOffline && !game.canRunOffline
      const hasUpdate = game.is_installed && gameUpdates?.includes(appName)

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
  }

  const handleSettings = () => {
    if (onSettingsClick) {
      onSettingsClick()
    } else {
      navigate(`/gamepage/${game.runner}/${game.app_name}`, { state: { gameInfo: game } })
    }
  }

  const handleStore = () => {
    let storeParam = 'epic'
    if (game.runner === 'gog') storeParam = 'gog'
    if (game.runner === 'nile') storeParam = 'amazon'
    if (game.runner === 'zoom') storeParam = 'zoom'
    navigate(`/store/${storeParam}`)
  }

  const playButtonTitle = useMemo(() => {
    if (isLaunching) return t('label.launching', 'Launching...')
    if (status === 'playing') return t('label.playing.stop', 'Stop Game')
    if (status === 'installing' || status === 'updating') return t('button.cancel', 'Cancel')
    if (status === 'queued') return t('button.queue.remove', 'Remove from Queue')
    if (!game.is_installed && game.runner !== 'sideload') return t('button.install', 'Install')
    return t('label.playing.start', 'Play')
  }, [status, isLaunching, game.is_installed, game.runner, t])

  const renderPlayIcon = () => {
    if (isLaunching) {
      return <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '16px' }} />
    }
    if (status === 'playing') {
      return <FontAwesomeIcon icon={faStop} style={{ fontSize: '16px' }} />
    }
    if (status === 'installing' || status === 'updating') {
      return <FontAwesomeIcon icon={faTimes} style={{ fontSize: '16px' }} />
    }
    if (status === 'queued') {
      return <FontAwesomeIcon icon={faTimes} style={{ fontSize: '16px' }} />
    }
    if (!game.is_installed && game.runner !== 'sideload') {
      return <FontAwesomeIcon icon={faDownload} style={{ fontSize: '16px' }} />
    }
    return <FontAwesomeIcon icon={faPlay} style={{ fontSize: '16px', marginLeft: '2px' }} />
  }

  return (
    <div style={{
      width: '380px',
      height: 'fit-content',
      alignSelf: 'flex-start',
      boxSizing: 'border-box',
      flexShrink: 0,
      background: 'rgba(30, 34, 40, 0.4)',
      backdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '15px 15px 8px 15px',
      marginLeft: '15px',
      marginRight: '15px',
      marginTop: '-9px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
    }}>
      {/* Imagem */}
      <CachedImage
        src={panelSquare || panelCover || fallbackImage}
        alt={panelTitle}
        style={{
          width: 'calc(100% + 30px)',
          height: '460px',
          marginTop: '-15px',
          marginLeft: '-15px',
          marginRight: '-15px',
          objectFit: 'cover',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          cursor: 'pointer'
        }}
        onClick={onClose}
      />

      {/* Titulo */}
      <h2 style={{
        fontSize: '18px',
        fontWeight: '700',
        color: '#fff',
        margin: '6px 0',
        textAlign: 'center'
      }}>
        {panelTitle}
      </h2>

      {/* Ações primárias (Botoes Redondos do Mockup) */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '2px 0' }}>
        {/* 1. Botão da Loja */}
        <button
          onClick={handleStore}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            padding: '8px',
            color: '#fff'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
          }}
          title={t('button.store', 'Store')}
        >
          <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StoreLogos runner={game.runner} appName={game.app_name} />
          </div>
        </button>

        {/* 2. Botão de Configurações do Jogo */}
        <button
          onClick={handleSettings}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
          }}
          title={t('submenu.settings', 'Settings')}
        >
          <FontAwesomeIcon icon={faCog} style={{ fontSize: '18px' }} />
        </button>

        {/* 3. Botão de Play */}
        <button
          onClick={handlePlay}
          disabled={isLaunching}
          style={{
            background: '#00ffff',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            cursor: isLaunching ? 'default' : 'pointer',
            opacity: isLaunching ? 0.7 : 1,
            transition: 'all 0.2s ease',
            boxShadow: '0 0 10px rgba(0, 255, 255, 0.4)'
          }}
          onMouseOver={(e) => {
            if (!isLaunching) {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.6)'
            }
          }}
          onMouseOut={(e) => {
            if (!isLaunching) {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.4)'
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
            <HeroLink emoji="🛒" label="Loja" onClick={handleStore} />
            <HeroLink emoji="📥" label="Downloads" onClick={() => navigate('/download-manager')} />
            <HeroLink emoji="📰" label="Notícias" onClick={() => {}} />
          </div>
          {/* Coluna 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
            <HeroLink emoji="👥" label="Comunidade" onClick={() => window.api.openExternalUrl('https://discord.gg/heroicgameslauncher')} />
            <HeroLink emoji="👤" label="Perfil do Usuário" onClick={() => navigate('/login')} />
            <HeroLink emoji="📰" label="Notícias" onClick={() => {}} />
          </div>
        </div>

        {/* Item Centralizado na Base */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '0px' }}>
          <HeroLink emoji="⚙️" label="Configurações do Launcher" onClick={() => navigate('/settings/general')} center />
        </div>
      </div>
    </div>
  )
}

function HeroLink({ emoji, label, onClick, center }: { emoji: string, label: string, onClick: () => void, center?: boolean }) {
  return (
    <button
      onClick={onClick}
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
        fontSize: '18px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        flexShrink: 0
      }}>
        {emoji}
      </div>
      <span>{label}</span>
    </button>
  )
}
