import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { faFolderOpen, faFileExport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UpdateComponent } from 'frontend/components/UI'
import SettingsContext from '../../SettingsContext'
import './index.css'
import ContextProvider from 'frontend/state/ContextProvider'
import { GameInfo } from 'common/types'
import classNames from 'classnames'

import type { GetLogFileArgs } from 'backend/logger/paths'

interface LogBoxProps {
  logFileContent: string
}

const MAX_DISPLAY_LINE_CHARS = 2000

const LogBox: React.FC<LogBoxProps> = React.memo(({ logFileContent }) => {
  const { t } = useTranslation()
  const maxLines = 1000

  const { lines, sliced } = useMemo(() => {
    let rawLines = logFileContent.split('\n')
    let isSliced = rawLines[0] === '...'
    if (rawLines.length > maxLines) {
      rawLines = ['...', ...rawLines.slice(-maxLines)]
      isSliced = true
    }
    const safeLines = rawLines.map((line) =>
      line.length > MAX_DISPLAY_LINE_CHARS
        ? `${line.slice(0, MAX_DISPLAY_LINE_CHARS)}... [line truncated]`
        : line
    )
    return { lines: safeLines, sliced: isSliced }
  }, [logFileContent])

  return (
    <>
      {sliced && (
        <span className="setting long-log-hint">
          {t(
            'settings.log.long-log-hint',
            'Log truncated, last 1000 lines are shown!'
          )}
        </span>
      )}
      <span className="setting log-box">
        {lines.map((line, key) => {
          const lower = line.toLowerCase()
          if (lower.includes(' err')) {
            return (
              <p key={key} className="log-error">
                {line}
              </p>
            )
          } else if (lower.includes(' warn')) {
            return (
              <p key={key} className="log-warning">
                {line}
              </p>
            )
          } else {
            return (
              <p key={key} className="log-info">
                {line}
              </p>
            )
          }
        })}
      </span>
    </>
  )
})

LogBox.displayName = 'LogBox'

export default function LogSettings() {
  const { t } = useTranslation()
  const { appName, runner } = useContext(SettingsContext)
  const isInSettingsMenu = appName === 'default'

  const [logFileContent, setLogFileContent] = useState<string>('')
  const [logFileExist, setLogFileExist] = useState<boolean>(false)
  const [showLogOf, setShowLogOf] = useState<GetLogFileArgs>(
    !runner ? {} : { appName, runner }
  )
  const [refreshing, setRefreshing] = useState<boolean>(true)
  const [isVisible, setIsVisible] = useState<boolean>(!isInSettingsMenu)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef<boolean>(false)

  const { epic, gog, amazon, zoom, sideloadedLibrary } =
    useContext(ContextProvider)
  const [installedGames, setInstalledGames] = useState<GameInfo[]>([])

  useEffect(() => {
    let games: GameInfo[] = []
    games = games.concat(epic.library.filter((game) => game.is_installed))
    games = games.concat(gog.library.filter((game) => game.is_installed))
    games = games.concat(amazon.library.filter((game) => game.is_installed))
    games = games.concat(zoom.library.filter((game) => game.is_installed))
    games = games.concat(sideloadedLibrary.filter((game) => game.is_installed))
    games = games.sort((game1, game2) => game1.title.localeCompare(game2.title))

    setInstalledGames(games)
  }, [
    epic.library,
    gog.library,
    amazon.library,
    sideloadedLibrary,
    zoom.library
  ])

  useEffect(() => {
    if (!isInSettingsMenu || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }
    const target = wrapperRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) {
          setIsVisible(entry.isIntersecting)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [isInSettingsMenu])

  const getLogContent = useCallback(() => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    void window.api
      .getLogContent(showLogOf)
      .then((content: string) => {
        if (!content) {
          const emptyMsg = t('setting.log.no-file', 'No log file found.')
          setLogFileContent((prev) => (prev === emptyMsg ? prev : emptyMsg))
          setLogFileExist(false)
          setRefreshing(false)
          return
        }
        setLogFileContent((prev) => (prev === content ? prev : content))
        setLogFileExist(true)
        setRefreshing(false)
      })
      .finally(() => {
        isFetchingRef.current = false
      })
  }, [showLogOf, t])

  useEffect(() => {
    getLogContent()
    if (!isVisible) return
    const interval = setInterval(() => {
      getLogContent()
    }, 3000)
    return () => clearInterval(interval)
  }, [getLogContent, isVisible])

  function showLogFileInFolder() {
    window.api.showLogFileInFolder(showLogOf)
  }

  const handleExportInstalledGamesLog = async () => {
    const dateStr = new Date().toLocaleString()
    let logText = `Ghost Game Launcher - Installed Games Log - ${dateStr}\n`
    logText += `============================================================\n\n`
    logText += `Total de Jogos Instalados: ${installedGames.length}\n\n`
    logText += `--- LISTA DE JOGOS INSTALADOS ---\n`

    const gamesWithSettings = await Promise.all(
      installedGames.map(async (g) => {
        try {
          const settings = await window.api.getGameSettings(g.app_name, g.runner)
          return { game: g, settings }
        } catch {
          return { game: g, settings: null }
        }
      })
    )

    gamesWithSettings.forEach(({ game: g, settings }) => {
      const platform = g.runner.toUpperCase()
      const installPath = g.install?.install_path || (g.install?.executable ? g.install.executable.substring(0, Math.max(g.install.executable.lastIndexOf('/'), g.install.executable.lastIndexOf('\\'))) : '')
      const exe = g.install?.executable || ''
      const launcherArgs = settings?.launcherArgs || ''
      const targetExe = settings?.targetExe || ''

      logText += `- Título: ${g.title}\n`
      logText += `  Plataforma: ${platform}\n`
      logText += `  Pasta de Instalação: ${installPath}\n`
      logText += `  Executável: ${exe}\n`
      if (launcherArgs) {
        logText += `  Argumentos de Inicialização: ${launcherArgs}\n`
      }
      if (targetExe) {
        logText += `  Executável Alvo (targetExe): ${targetExe}\n`
      }
      logText += `\n`
    })

    logText += `============================================================\n`

    await window.api.exportScanLog(logText)
  }

  const descriptiveLogFileName = useMemo(() => {
    if (!showLogOf.runner)
      return t('setting.log.descriptiveNames.ghost', 'General Ghost log')
    if (showLogOf.appName) {
      const gameTitle = installedGames.find(
        ({ app_name }) => app_name === showLogOf.appName
      )?.title
      return t(
        'setting.log.descriptiveNames.game-log',
        'Game log of {{gameTitle}}',
        { gameTitle }
      )
    }
    if (showLogOf.runner === 'legendary')
      return t(
        'setting.log.descriptiveNames.legendary',
        'Epic Games / Legendary log'
      )
    if (showLogOf.runner === 'gog')
      return t('setting.log.descriptiveNames.gog', 'GOG log')
    if (showLogOf.runner === 'nile')
      return t('setting.log.descriptiveNames.nile', 'Amazon / Nile log')
    if (showLogOf.runner === 'zoom')
      return t('setting.log.descriptiveNames.zoom', 'Zoom log')
    return ''
  }, [showLogOf, installedGames, t])

  const logFilesToShow = useMemo(() => {
    const baseFiles: { title: string; args: GetLogFileArgs }[] = [
      { title: 'Ghost', args: {} },
      { title: 'Epic/Legendary', args: { runner: 'legendary' } },
      { title: 'GOG', args: { runner: 'gog' } },
      { title: 'Amazon/Nile', args: { runner: 'nile' } }
    ]
    if (zoom.enabled) {
      baseFiles.push({ title: 'Zoom', args: { runner: 'zoom' } })
    }
    const logsForInstalledGames = installedGames.map((game) => ({
      title: game.overrides?.title || game.title,
      args: {
        appName: game.app_name,
        runner: game.runner
      }
    }))
    return baseFiles.concat(logsForInstalledGames)
  }, [installedGames, zoom.enabled])

  return (
    <>
      <h3>{t('setting.log.instructions_title', 'How to report a problem?')}</h3>
      <p className="report-problem-instructions">
        {t(
          'setting.log.instructions',
          'Check these logs to identify errors. You can share them with the Ghost developers or community when reporting issues.'
        )}
      </p>
      <div
        ref={wrapperRef}
        className={classNames('logs-wrapper', {
          'game-log': !isInSettingsMenu
        })}
      >
        {isInSettingsMenu && (
          <span className="log-buttongroup">
            {logFilesToShow.map(({ title, args }, i) => {
              const isSelected =
                args.appName === showLogOf.appName &&
                args.runner === showLogOf.runner
              return (
                <a
                  key={i}
                  className={`log-buttons ${isSelected ? 'log-choosen' : ''}`}
                  onClick={() => {
                    setRefreshing(true)
                    setShowLogOf(args)
                  }}
                  title={title}
                >
                  {title}
                </a>
              )
            })}
          </span>
        )}

        {refreshing ? (
          <span className="setting log-box">
            <UpdateComponent />
          </span>
        ) : (
          <LogBox logFileContent={logFileContent} />
        )}
      </div>
      <span className="footerFlex">
        {logFileExist && (
          <a
            onClick={showLogFileInFolder}
            title={t('setting.log.show-in-folder', 'Show log file in folder')}
            className="button is-footer"
          >
            <div className="button-icontext-flex">
              <div className="button-icon-flex">
                <FontAwesomeIcon icon={faFolderOpen} />
              </div>
              <span className="button-icon-text">
                {t('setting.log.show-in-folder', 'Show log file in folder')}
              </span>
            </div>
          </a>
        )}
        <a
          onClick={handleExportInstalledGamesLog}
          title={t('setting.log.export-search-log', 'Export Search Log')}
          className="button is-footer"
          style={{ marginLeft: '12px' }}
        >
          <div className="button-icontext-flex">
            <div className="button-icon-flex">
              <FontAwesomeIcon icon={faFileExport} />
            </div>
            <span className="button-icon-text">
              {t('setting.log.export-search-log', 'Export Search Log')}
            </span>
          </div>
        </a>
      </span>
    </>
  )
}
