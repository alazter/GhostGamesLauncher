import './index.css'

import { useContext, useEffect, useState } from 'react'

import { DMQueueElement, DownloadManagerState, Runner, GameInfo } from 'common/types'
import { CachedImage } from 'frontend/components/UI'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import { handleStopInstallation } from 'frontend/helpers/library'
import { getGameInfo, getStoreName } from 'frontend/helpers'
import { useTranslation } from 'react-i18next'
import { hasProgress } from 'frontend/hooks/hasProgress'
import ContextProvider from 'frontend/state/ContextProvider'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { gameOverridesStore } from 'frontend/helpers/electronStores'
import { getImageFormatting } from 'frontend/screens/Library/components/GameCard/constants'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay,
  faPause,
  faTimes,
  faCheck
} from '@fortawesome/free-solid-svg-icons'

type Props = {
  element?: DMQueueElement
  current: boolean
  state?: DownloadManagerState
  handleClearItem?: (appName: string) => void
  onOpenCoverPicker?: (gameInfo: GameInfo) => void
}

const options: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: 'numeric'
}

function convertToTime(time: number) {
  const date = time ? new Date(time) : new Date()
  const hour = new Intl.DateTimeFormat(undefined, options).format(date)
  return {
    hour,
    date: date.toLocaleDateString(),
    fullDate: date.toLocaleString()
  }
}

const DownloadManagerItem = ({
  element,
  current,
  state,
  handleClearItem,
  onOpenCoverPicker
}: Props) => {
  const { amazon, epic, gog, steam, zoom, sideloadedLibrary, showDialogModal } =
    useContext(ContextProvider)
  const { t } = useTranslation('gamepage')
  const { t: t2 } = useTranslation('translation')
  const isPaused = state && ['idle', 'paused'].includes(state)

  const navigate = useNavigate()

  const { gameOverrides } = useGlobalState.keys('gameOverrides')

  const library = [
    ...(epic?.library || []),
    ...(gog?.library || []),
    ...(amazon?.library || []),
    ...(steam?.library || []),
    ...(zoom?.library || []),
    ...(sideloadedLibrary || [])
  ]

  const { params, addToQueueTime = 0, endTime = 0, type = 'install', startTime = 0 } = element || {}
  const {
    appName = '',
    runner = 'legendary',
    path = '',
    gameInfo: DmGameInfo,
    size = '',
    platformToInstall = 'Windows'
  } = params || {}

  const [gameInfo, setGameInfo] = useState(DmGameInfo)
  const [coverVersion, setCoverVersion] = useState(0)

  useEffect(() => {
    setGameInfo(DmGameInfo)
  }, [DmGameInfo])

  useEffect(() => {
    if (!appName) return
    const handleCoverChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        appName: string
        runner?: Runner
        art_cover?: string
        art_square?: string
      }>
      if (!customEvent?.detail?.appName || customEvent.detail.appName === appName) {
        setCoverVersion((v) => v + 1)
      }
    }

    const handleTitleChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        appName: string
        runner?: Runner
        title?: string
      }>
      if (!customEvent?.detail?.appName || customEvent.detail.appName === appName) {
        setCoverVersion((v) => v + 1)
      }
    }

    window.addEventListener('heroicGameCoverChanged', handleCoverChanged)
    window.addEventListener('heroicGameTitleChanged', handleTitleChanged)
    return () => {
      window.removeEventListener('heroicGameCoverChanged', handleCoverChanged)
      window.removeEventListener('heroicGameTitleChanged', handleTitleChanged)
    }
  }, [appName])

  useEffect(() => {
    if (!appName || !runner) return
    const getNewInfo = async () => {
      const newInfo = await getGameInfo(appName, runner)
      if (newInfo && newInfo.runner !== 'sideload') {
        setGameInfo(newInfo)
      }
    }
    getNewInfo()
  }, [element, appName, runner])

  const [progress] = hasProgress(appName, runner)

  if (!element) {
    return (
      <div className="dmEmptyCard">
        <FontAwesomeIcon icon={faCheck} className="dmEmptyIcon" />
        <span>
          {current
            ? t2('queue.label.no-active-download', 'Nenhum download em andamento')
            : t2('queue.label.empty', 'Fila de downloads vazia')}
        </span>
      </div>
    )
  }

  const currentApp = library.find(
    (val) => val.app_name === appName && val.runner === runner
  )
  const activeApp = currentApp || gameInfo || DmGameInfo
  const is_dlc = Boolean(gameInfo?.install?.is_dlc ?? activeApp?.install?.is_dlc)

  const { status } = element
  const finished = status === 'done' || (!current && Boolean(endTime))
  const canceled = status === 'error' || (status === 'abort' && !current)

  const stopInstallation = async () => {
    return handleStopInstallation(
      appName,
      path,
      t,
      progress,
      runner,
      showDialogModal
    )
  }

  const goToGamePage = () => {
    if (is_dlc) {
      return
    }
    return navigate(`/gamepage/${runner}/${appName}`, {
      state: { fromDM: true, gameInfo: gameInfo || activeApp }
    })
  }

  const handleMainActionClick = () => {
    if (finished) {
      return goToGamePage()
    } else if (canceled && handleClearItem) {
      handleClearItem(appName)
    }

    if (current) stopInstallation()
    else window.api.removeFromDMQueue(appName)
  }

  const handleSecondaryActionClick = () => {
    if (isPaused) {
      window.api.resumeCurrentDownload()
    } else if (state === 'running') {
      window.api.pauseCurrentDownload()
    }
  }

  const getTime = () => {
    if (finished) {
      return convertToTime(endTime)
    }
    if (current) {
      return convertToTime(startTime)
    }
    return convertToTime(addToQueueTime)
  }

  const mainIconTitle = () => {
    const { status } = element
    if (status === 'done' || status === 'error') {
      return t('Open')
    }

    return current
      ? t('button.cancel', 'Cancel')
      : t('queue.label.remove', 'Remove from Downloads')
  }

  const secondaryIconTitle = () => {
    if (isPaused) {
      return t('queue.label.resume', 'Resume download')
    } else if (state === 'running') {
      return t('queue.label.pause', 'Pause download')
    } else {
      return ''
    }
  }

  if (!activeApp) {
    return null
  }

  const storeOverrides =
    (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}
  const gameOverride = gameOverrides?.[appName] || storeOverrides[appName]

  const title =
    gameOverride?.title ||
    activeApp?.overrides?.title ||
    activeApp?.title ||
    DmGameInfo?.title ||
    appName

  const steamSquare =
    runner === 'steam' && appName
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appName}/library_600x900.jpg`
      : ''
  const steamHero =
    runner === 'steam' && appName
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appName}/library_hero.jpg`
      : ''
  const steamBanner =
    runner === 'steam' && appName
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appName}/header.jpg`
      : ''

  const rawSquare =
    (gameOverride?.art_square !== undefined && gameOverride?.art_square !== ''
      ? gameOverride.art_square
      : activeApp?.overrides?.art_square ||
        activeApp?.art_square ||
        gameInfo?.art_square ||
        DmGameInfo?.art_square ||
        steamSquare ||
        '')

  const rawArtCover =
    (gameOverride?.art_cover !== undefined && gameOverride?.art_cover !== ''
      ? gameOverride.art_cover
      : activeApp?.overrides?.art_cover ||
        activeApp?.art_cover ||
        gameInfo?.art_cover ||
        DmGameInfo?.art_cover ||
        steamBanner ||
        '')

  // Primary cover art (portrait/square, exactly matching GameCard in Library)
  const rawCover = rawSquare || rawArtCover || ''
  const cover = rawCover ? getImageFormatting(rawCover, runner) : fallbackImage
  const art_cover = rawArtCover || ''

  // Banner horizontal (hero) para o background de TODOS os cards da página de downloads
  const heroBgImage =
    (gameOverride as any)?.art_background ||
    (activeApp?.overrides as any)?.art_background ||
    (gameOverride?.art_cover !== undefined && gameOverride?.art_cover !== ''
      ? gameOverride.art_cover
      : '') ||
    (activeApp?.overrides?.art_cover !== undefined &&
    activeApp?.overrides?.art_cover !== ''
      ? activeApp.overrides.art_cover
      : '') ||
    steamHero ||
    rawArtCover ||
    steamBanner ||
    gameInfo?.art_background ||
    activeApp?.art_background ||
    DmGameInfo?.art_background ||
    cover

  const activeGameInfo: GameInfo = {
    ...activeApp,
    is_installed: Boolean(activeApp?.is_installed || finished),
    canRunOffline: Boolean(activeApp?.canRunOffline),
    app_name: appName,
    runner,
    title,
    art_cover,
    art_square: rawSquare,
    overrides:
      activeApp?.overrides ||
      (gameOverrides?.[appName] ? gameOverrides[appName] : undefined),
    install: activeApp?.install || gameInfo?.install
  }

  const handleCoverClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenCoverPicker) {
      onOpenCoverPicker(activeGameInfo)
    } else {
      goToGamePage()
    }
  }

  const translatedTypes = {
    install: t2('download-manager.install-type.install', 'Install'),
    update: t2('download-manager.install-type.update', 'Update')
  }

  const { fullDate, hour, date } = getTime()
  const platformLabel = platformToInstall
    ? platformToInstall === 'osx'
      ? 'Mac'
      : platformToInstall
    : ''

  // 1. Caso Ativo: Card de destaque com background desfocado do jogo, capa vertical e controles integrados
  if (current) {
    return (
      <div className="dmActiveCard">
        {heroBgImage ? (
          <div className="dmGlassBgContainer">
            <CachedImage
              key={`${heroBgImage}_${coverVersion}`}
              src={heroBgImage}
              fallback={
                steamHero && steamHero !== heroBgImage
                  ? [steamHero, cover]
                  : cover
              }
              alt=""
              className="dmGlassBgImg"
            />
            <div className="dmGlassOverlay" />
          </div>
        ) : null}

        <div
          className="dmActiveCoverWrapper"
          onClick={handleCoverClick}
          title="Clique para trocar a capa no SteamGridDB"
          style={{ cursor: 'pointer' }}
        >
          {cover ? (
            <CachedImage
              key={`${cover}_${coverVersion}`}
              src={cover}
              fallback={
                art_cover && art_cover !== cover
                  ? [art_cover, fallbackImage]
                  : fallbackImage
              }
              alt={title}
              className="dmActiveCoverImg"
            />
          ) : (
            <div className="dmCoverPlaceholder" />
          )}
        </div>

        <div className="dmActiveContent">
          <div className="dmActiveTopRow">
            <h4
              className="dmActiveTitle"
              onClick={() => goToGamePage()}
              style={{ cursor: is_dlc ? 'default' : 'pointer' }}
              title={title}
            >
              {title}
            </h4>
            <div
              className="dmStoreLogoFloating"
              title={getStoreName(runner, t2('Other'))}
            >
              <StoreLogos
                runner={runner}
                appName={appName}
                className="dmStoreLogoSvg"
              />
            </div>
          </div>

          <div className="dmActiveBottomRow">
            <div className="dmActiveProgressCol">
              <div className="dmProgressBarTrack">
                <div
                  className="dmProgressBarFill"
                  style={{
                    width: `${Math.min(100, Math.max(0, progress.percent || 0))}%`,
                    opacity: (progress.percent || 0) > 0 ? 1 : 0
                  }}
                />
              </div>

              <div className="dmActiveProgressStats">
                <span className="dmPercentText">{progress.percent || 0}%</span>
                {progress.bytes && (
                  <span className="dmBytesText">{progress.bytes}</span>
                )}
                <span className="dmEtaText">
                  - ETA:{' '}
                  {isPaused
                    ? t2('download-manager.paused', 'Pausado')
                    : progress.eta || '00:00:00'}
                </span>
              </div>
            </div>

            <div className="dmActiveActions">
              <button
                type="button"
                className="dmNeonCircleBtn dmNeonPauseBtn"
                onClick={handleSecondaryActionClick}
                title={secondaryIconTitle()}
              >
                {isPaused ? (
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle
                      cx="19"
                      cy="19"
                      r="16.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    />
                    <polygon
                      points="15,12 27,19 15,26"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle
                      cx="19"
                      cy="19"
                      r="16.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    />
                    <line
                      x1="15"
                      y1="13"
                      x2="15"
                      y2="25"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1="23"
                      y1="13"
                      x2="23"
                      y2="25"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="dmNeonCircleBtn dmNeonCancelBtn"
                onClick={handleMainActionClick}
                title={mainIconTitle()}
              >
                <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                  <circle
                    cx="19"
                    cy="19"
                    r="16.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  />
                  <line
                    x1="13.5"
                    y1="13.5"
                    x2="24.5"
                    y2="24.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="24.5"
                    y1="13.5"
                    x2="13.5"
                    y2="24.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 2. Caso Concluído: Card com Capa, Info, Logo da Loja + Tag Concluído ao lado e Botões [X] [Jogar]
  if (finished) {
    return (
      <div className="dmFinishedCard">
        {heroBgImage ? (
          <div className="dmGlassBgContainer">
            <CachedImage
              key={`${heroBgImage}_${coverVersion}`}
              src={heroBgImage}
              fallback={
                steamHero && steamHero !== heroBgImage
                  ? [steamHero, cover]
                  : cover
              }
              alt=""
              className="dmGlassBgImg"
            />
            <div className="dmGlassOverlay" />
          </div>
        ) : null}
        <div
          className="dmFinishedCoverWrapper"
          onClick={handleCoverClick}
          title="Clique para trocar a capa no SteamGridDB"
          style={{ cursor: 'pointer' }}
        >
          {cover ? (
            <CachedImage
              key={`${cover}_${coverVersion}`}
              src={cover}
              fallback={
                art_cover && art_cover !== cover
                  ? [art_cover, fallbackImage]
                  : fallbackImage
              }
              alt={title}
              className="dmFinishedCoverImg"
            />
          ) : (
            <div className="dmCoverPlaceholder" />
          )}
        </div>
        <div className="dmFinishedContent">
          <div className="dmFinishedTopRow">
            <span
              className="dmFinishedTitle"
              onClick={() => goToGamePage()}
              style={{ cursor: is_dlc ? 'default' : 'pointer' }}
              title={title}
            >
              {title}
            </span>
            <div
              className="dmStoreLogoFloating"
              title={getStoreName(runner, t2('Other'))}
            >
              <StoreLogos
                runner={runner}
                appName={appName}
                className="dmStoreLogoSvg"
              />
            </div>
          </div>
          <div className="dmFinishedBottomRow">
            <div className="dmFinishedMetaCol">
              <span className="dmFinishedTime" title={fullDate}>
                {t2('download-manager.queue.end-time', 'Finalizou às')} {hour}
              </span>
              <span className="dmCompletedBadge">
                {t2('queue.label.finished', 'Concluído')}
              </span>
            </div>
            <div className="dmFinishedActions">
              {handleClearItem && (
                <button
                  type="button"
                  className="dmNeonCircleBtn dmNeonCancelBtn dmFinishedRemoveBtn"
                  onClick={() => handleClearItem(appName)}
                  title={t2('queue.label.clear', 'Remover')}
                >
                  <svg viewBox="0 0 38 38" className="dmNeonBtnSvg">
                    <circle
                      cx="19"
                      cy="19"
                      r="16.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    />
                    <line
                      x1="13.5"
                      y1="13.5"
                      x2="24.5"
                      y2="24.5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1="24.5"
                      y1="13.5"
                      x2="13.5"
                      y2="24.5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="dmPlayBtn"
                onClick={() => goToGamePage()}
                title={t('Open', 'Jogar')}
              >
                <span>{t('button.play', 'Jogar')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 3. Caso Na Fila: Card em Vidro Fosco Translúcido com Capa, Info, Logo da Loja flutuante e Cancelar
  return (
    <div className="dmQueueCard">
      {heroBgImage ? (
        <div className="dmGlassBgContainer">
          <CachedImage
            key={`${heroBgImage}_${coverVersion}`}
            src={heroBgImage}
            fallback={
              steamHero && steamHero !== heroBgImage
                ? [steamHero, cover]
                : cover
            }
            alt=""
            className="dmGlassBgImg"
          />
          <div className="dmGlassOverlay" />
        </div>
      ) : null}
      <div
        className="dmQueueLeft"
        onClick={() => goToGamePage()}
        style={{ cursor: is_dlc ? 'default' : 'pointer' }}
      >
        <div
          className="dmQueueCoverWrapper"
          onClick={handleCoverClick}
          title="Clique para trocar a capa no SteamGridDB"
          style={{ cursor: 'pointer' }}
        >
          {cover ? (
            <CachedImage
              key={`${cover}_${coverVersion}`}
              src={cover}
              fallback={
                art_cover && art_cover !== cover
                  ? [art_cover, fallbackImage]
                  : fallbackImage
              }
              alt={title}
              className="dmQueueCoverImg"
            />
          ) : (
            <div className="dmCoverPlaceholder" />
          )}
        </div>
        <div className="dmQueueInfo">
          <span className="dmQueueTitle" title={title}>{title}</span>
        </div>
      </div>
      <div className="dmQueueRight">
        <div
          className="dmStoreLogoFloating"
          title={getStoreName(runner, t2('Other'))}
        >
          <StoreLogos
            runner={runner}
            appName={appName}
            className="dmStoreLogoSvg"
          />
        </div>
        <button
          type="button"
          className="dmCircularBtn dmCancelBtn dmQueueCancelBtn"
          onClick={handleMainActionClick}
          title={mainIconTitle()}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    </div>
  )
}

export default DownloadManagerItem

