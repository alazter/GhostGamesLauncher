import './index.scss'
import short from 'short-uuid'
import {
  faSpinner,
  faSearch,
  faPlay,
  faCog,
  faTimes,
  faTrash,
  faCheck,
  faBan,
  faFileAlt,
  faSyncAlt
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InstallPlatform, WineInstallation, GameInfo, GameCandidate } from 'common/types'
import {
  CachedImage,
  TextInputField,
  PathSelectionBox,
  ToggleSwitch,
  InfoBox,
  SteamGridDBPicker,
  WarningMessage
} from 'frontend/components/UI'
import { DialogContent } from 'frontend/components/UI/Dialog'
import {
  getGameInfo,
  getGameSettings,
  removeSpecialcharacters,
  writeConfig
} from 'frontend/helpers'
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AvailablePlatforms } from '..'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import ContextProvider from 'frontend/state/ContextProvider'
import classNames from 'classnames'
import axios from 'axios'
import { NavLink, useNavigate } from 'react-router-dom'


type Props = {
  availablePlatforms: AvailablePlatforms
  winePrefix: string
  crossoverBottle: string
  wineVersion: WineInstallation | undefined
  setWinePrefix: React.Dispatch<React.SetStateAction<string>>
  children: React.ReactNode
  platformToInstall: InstallPlatform
  backdropClick: () => void
  appName?: string
  initialSgdbTarget?: 'cover' | 'square' | null
}

export default function SideloadDialog({
  availablePlatforms,
  backdropClick,
  winePrefix,
  crossoverBottle,
  wineVersion,
  platformToInstall,
  setWinePrefix,
  children,
  appName,
  initialSgdbTarget = null
}: Props) {
  const { t, i18n } = useTranslation(['gamepage', 'translation'])
  const [title, setTitle] = useState<string>(t('sideload.field.title', 'Title'))
  const [selectedExe, setSelectedExe] = useState('')
  const [gameUrl, setGameUrl] = useState('')
  const [customUserAgent, setCustomUserAgent] = useState('')
  const [launchFullScreen, setLaunchFullScreen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [heroUrl, setHeroUrl] = useState('')
  const [searching, setSearching] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [app_name, setApp_name] = useState(appName ?? '')
  const [runningSetup, setRunningSetup] = useState(false)
  const [gameInfo, setGameInfo] = useState<Partial<GameInfo>>({})
  const [addingApp, setAddingApp] = useState(false)
  const [sgdbTarget, setSgdbTarget] = useState<'cover' | 'square' | null>(
    initialSgdbTarget
  )
  const [hasSgdbKey, setHasSgdbKey] = useState(false)
  const [launcherArgs, setLauncherArgs] = useState('')
  const [launcherArgsError, setLauncherArgsError] = useState('')
  const editMode = Boolean(appName)

  const { refreshLibrary, platform, showDialogModal, sideloadedLibrary, epic, gog, amazon, zoom } = useContext(ContextProvider)
  const navigate = useNavigate()
  const goToAdvancedSettings = () => {
    backdropClick()
    navigate('/settings/advanced')
  }

  // Active tab state: 'manual' or 'scanner'
  const [activeTab, setActiveTab] = useState<'manual' | 'scanner'>('manual')

  // Auto-scanner states
  const [scannedCandidates, setScannedCandidates] = useState<GameCandidate[]>([])
  const [scanningCandidates, setScanningCandidates] = useState(false)
  const [scanPhase, setScanPhase] = useState<'initial' | 'registry_done' | 'full_done'>('initial')
  const [searchTitlesInput, setSearchTitlesInput] = useState('')
  const [searchOnlyByName, setSearchOnlyByName] = useState(true)
  const [importSelection, setImportSelection] = useState<Record<string, 'import' | 'blacklist' | 'none'>>({})
  const [blacklistCount, setBlacklistCount] = useState(0)
  const [scannedImports, setScannedImports] = useState<GameCandidate[]>([])
  const [scannedBlacklist, setScannedBlacklist] = useState<GameCandidate[]>([])
  const [hideDuplicates, setHideDuplicates] = useState(true)
  const [showBlacklistModal, setShowBlacklistModal] = useState(false)
  const [blacklistItems, setBlacklistItems] = useState<Array<{ title: string; executable: string }>>([])

  function handleTitle(value: string) {
    value = removeSpecialcharacters(value)
    setTitle(value)
  }

  const appPlatform = gameInfo.install?.platform || platformToInstall

  useEffect(() => {
    window.api.steamgriddb.hasApiKey().then(setHasSgdbKey)
    window.api.getBlacklist().then((list) => setBlacklistCount(list.length))

    if (appName) {
      void getGameInfo(appName, 'sideload').then((info) => {
        if (!info || info.runner !== 'sideload') {
          return
        }
        setGameInfo(info)
        const {
          art_cover,
          art_square,
          install: { executable, platform },
          title,
          browserUrl,
          customUserAgent,
          launchFullScreen
        } = info

        if (executable && platform) {
          setSelectedExe(executable)
        }

        if (browserUrl) {
          setGameUrl(browserUrl)
        }

        if (customUserAgent) {
          setCustomUserAgent(customUserAgent)
        }

        if (launchFullScreen !== undefined) {
          setLaunchFullScreen(launchFullScreen)
        }

        setTitle(title)
        setImageUrl(art_square || '')
        setHeroUrl(art_cover && art_cover !== art_square ? art_cover : '')
      })

      void getGameSettings(appName, 'sideload').then((settings) => {
        if (settings?.launcherArgs) {
          setLauncherArgs(settings.launcherArgs)
        }
      })
    } else {
      setApp_name(short.generate().toString())
    }
  }, [])

  // Suggest default Wine prefix if we're adding a new app
  useEffect(() => {
    if (editMode) return
    window.api.requestAppSettings().then(({ defaultWinePrefixDir }) => {
      const suggestedWinePrefix = `${defaultWinePrefixDir}/${title}`
      setWinePrefix(suggestedWinePrefix)
    })
  }, [title, editMode])

  useEffect(() => {
    if (launcherArgs.match(/%command/)) {
      setLauncherArgsError(
        t(
          'translation:options.gameargs.error.command',
          'The %command% syntax from Steam is not valid as game arguments.'
        )
      )
    } else if (launcherArgs.match(/[A-Z_]+=\S/)) {
      setLauncherArgsError(
        t(
          'translation:options.gameargs.error.env',
          'Environment variables must be configured in the table below.'
        )
      )
    } else {
      setLauncherArgsError('')
    }
  }, [launcherArgs, t])

  async function searchImage() {
    if (hasSgdbKey) {
      setSgdbTarget('square')
      return
    }
    setSearching(true)

    try {
      const response = await axios.get(
        `https://steamgrid.usebottles.com/api/search/${title}`,
        { timeout: 3500 }
      )

      if (response.status === 200) {
        const steamGridImage = response.data as string

        if (steamGridImage && steamGridImage.startsWith('http')) {
          setImageUrl(steamGridImage)
        }
      } else {
        throw new Error('Fetch failed')
      }
    } catch (error) {
      window.api.logError(`${error}`)
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectLocalImage(target: 'cover' | 'square') {
    const path = await window.api.openDialog({
      buttonLabel: t('box.select.button', 'Select'),
      properties: ['openFile'],
      title: t('box.select.image', 'Select Image'),
      filters: [
        {
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
        },
        { name: 'All', extensions: ['*'] }
      ]
    })

    if (!path) return
    if (target === 'cover') setHeroUrl(`file://${path}`)
    else setImageUrl(`file://${path}`)
  }

  async function handleInstall(): Promise<void> {
    setAddingApp(true)
    window.api.addNewApp({
      runner: 'sideload',
      app_name,
      title,
      install: {
        executable: selectedExe,
        platform: gameInfo.install?.platform ?? platformToInstall
      },
      art_cover: heroUrl || imageUrl || fallbackImage,
      is_installed: true,
      art_square: imageUrl || heroUrl || fallbackImage,
      canRunOffline: true,
      browserUrl: gameUrl,
      customUserAgent,
      launchFullScreen
    })
    const gameSettings = await getGameSettings(app_name, 'sideload')
    if (gameSettings) {
      const updatedConfig: any = {
        ...gameSettings,
        launcherArgs
      }
      if (!editMode) {
        updatedConfig.winePrefix = winePrefix
        updatedConfig.wineVersion = wineVersion
        updatedConfig.wineCrossoverBottle = crossoverBottle
      }
      window.api.writeConfig({
        appName: app_name,
        config: updatedConfig
      })
    }

    await refreshLibrary({
      library: 'sideload',
      runInBackground: true,
      checkForUpdates: true
    })
    setAddingApp(false)
    return backdropClick()
  }

  const fileFilters = useCallback((platform: InstallPlatform) => {
    switch (platform) {
      case 'Windows':
      case 'windows':
      case 'Win32':
        return [
          { name: 'Executables', extensions: ['exe', 'msi'] },
          { name: 'Scripts', extensions: ['bat'] },
          { name: 'All', extensions: ['*'] }
        ]
      case 'linux':
        return [
          { name: 'AppImages', extensions: ['AppImage'] },
          { name: 'Other Binaries', extensions: ['sh', 'py', 'bin'] },
          { name: 'All', extensions: ['*'] }
        ]
      case 'osx':
      case 'Mac':
        return [
          { name: 'Apps', extensions: ['App'] },
          { name: 'Other Binaries', extensions: ['sh', 'py', 'bin'] },
          { name: 'All', extensions: ['*'] }
        ]
      case 'Android':
      case 'iOS':
      case 'Browser':
        return []
    }
  }, [])

  const handleRunExe = async () => {
    let exeToRun = ''
    const path = await window.api.openDialog({
      buttonLabel: t('box.select.button', 'Select'),
      properties: ['openFile'],
      title: t('box.runexe.title', 'Select EXE to Run'),
      filters: fileFilters(appPlatform)
    })
    if (path) {
      exeToRun = path
      try {
        setRunningSetup(true)
        const gameSettings = await getGameSettings(app_name, 'sideload')
        if (!gameSettings) {
          return
        }
        await writeConfig({
          appName: app_name,
          config: { ...gameSettings, winePrefix, wineVersion }
        })
        await window.api.runWineCommand({
          commandParts: [exeToRun],
          wait: true,
          protonVerb: 'runinprefix',
          gameSettings: {
            ...gameSettings,
            winePrefix,
            wineVersion: wineVersion || gameSettings.wineVersion
          }
        })
        setRunningSetup(false)
      } catch (error) {
        console.log('finished with error', error)
        setRunningSetup(false)
      }
    }
    return
  }

  function handleGameUrl(url: string) {
    if (!url.startsWith('https://')) {
      return setGameUrl(`https://${url}`)
    }

    setGameUrl(url)
  }

  function platformIcon() {
    const pIcon = availablePlatforms.filter(
      (p) => p.name === appPlatform.replace('Mac', 'macOS')
    )[0]?.icon

    if (!pIcon) return null

    return (
      <FontAwesomeIcon
        className="InstallModal__platformIcon"
        icon={pIcon}
      />
    )
  }

  const showSideloadExe = appPlatform !== 'Browser'

  const shouldShowRunExe =
    platform !== 'win32' &&
    appPlatform !== 'Mac' &&
    appPlatform !== 'linux' &&
    appPlatform !== 'Browser'

  // Helper to check if a scanned candidate is already in the sideloaded library store
  const isCandidateAlreadyAdded = useCallback((candidate: GameCandidate) => {
    // Helper para normalizar caminhos
    const normalizePath = (p: string) => {
      if (!p) return ''
      return p.replace(/\\/g, '/').toLowerCase().trim()
    }

    // Helper para extrair o diretório pai
    const getDirName = (p: string) => {
      const parts = p.split('/')
      if (parts.length > 1) {
        parts.pop()
        return parts.join('/')
      }
      return p
    }

    // Helper para normalizar títulos de forma fuzzy alfanumérica
    const normalizeTitle = (t: string) => {
      if (!t) return ''
      return t
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[®™©]/g, '') // Remove símbolos especiais
        .replace(/[^a-z0-9]/gi, '') // Mantém apenas letras e números
        .toLowerCase()
        .trim()
    }

    const normExecutable = normalizePath(candidate.executable)
    const normTitle = normalizeTitle(candidate.title)
    const scannedDir = getDirName(normExecutable)

    const isMatch = (g: GameInfo) => {
      const gTitle = normalizeTitle(g.title || '')
      if (gTitle && gTitle === normTitle) {
        return true
      }

      const gExe = g.install?.executable ? normalizePath(g.install.executable) : ''
      if (gExe && scannedDir) {
        const gDir = getDirName(gExe)
        if (gDir === scannedDir) {
          return true
        }
      }
      return false
    }

    return sideloadedLibrary?.some(isMatch) || false
  }, [sideloadedLibrary]);

  // Auto-scanner functions
  const handleScanCandidates = async () => {
    setScanningCandidates(true)
    try {
      const results = await window.api.discoverInstalledGames()
      results.sort((a, b) => a.title.localeCompare(b.title))
      setScannedCandidates(results)

      // Pre-calculate already added maps for fast lookup
      const addedExes = new Set<string>();
      const addedTitles = new Set<string>();
      const addKeys = (g: GameInfo) => {
        if (g.install?.executable) addedExes.add(g.install.executable.replace(/\\/g, '/').toLowerCase());
        if (g.title) addedTitles.add(g.title.trim().toLowerCase());
      };
      sideloadedLibrary?.forEach(addKeys);
      epic?.library?.forEach(addKeys);
      gog?.library?.forEach(addKeys);
      amazon?.library?.forEach(addKeys);
      zoom?.library?.forEach(addKeys);

      const initialSelection: Record<string, 'import' | 'blacklist' | 'none'> = {}
      const defaultImports: GameCandidate[] = []

      results.forEach((c) => {
        const normExe = c.executable.replace(/\\/g, '/').toLowerCase();
        const normTitle = c.title.trim().toLowerCase();
        const isDuplicate = addedExes.has(normExe) || addedTitles.has(normTitle);

        if (isDuplicate) {
          initialSelection[c.executable] = 'none'
        } else {
          initialSelection[c.executable] = 'import'
          defaultImports.push(c)
        }
      })

      setImportSelection(initialSelection)
      setScannedImports(defaultImports)
      setScannedBlacklist([])
      setScanPhase('registry_done')
    } catch (err) {
      window.api.logError(`Error discovering games: ${err}`)
    } finally {
      setScanningCandidates(false)
    }
  }

  const handleScanAll = async () => {
    setScanningCandidates(true)
    try {
      const searchTitles = (searchOnlyByName && searchTitlesInput)
        ? searchTitlesInput.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined

      const results = await window.api.discoverAllGames(searchTitles)
      results.sort((a, b) => a.title.localeCompare(b.title))
      setScannedCandidates(results)

      // Pre-calculate already added maps for fast lookup
      const addedExes = new Set<string>();
      const addedTitles = new Set<string>();
      const addKeys = (g: GameInfo) => {
        if (g.install?.executable) addedExes.add(g.install.executable.replace(/\\/g, '/').toLowerCase());
        if (g.title) addedTitles.add(g.title.trim().toLowerCase());
      };
      sideloadedLibrary?.forEach(addKeys);
      epic?.library?.forEach(addKeys);
      gog?.library?.forEach(addKeys);
      amazon?.library?.forEach(addKeys);
      zoom?.library?.forEach(addKeys);

      const initialSelection: Record<string, 'import' | 'blacklist' | 'none'> = {}
      const defaultImports: GameCandidate[] = []

      results.forEach((c) => {
        const normExe = c.executable.replace(/\\/g, '/').toLowerCase();
        const normTitle = c.title.trim().toLowerCase();
        const isDuplicate = addedExes.has(normExe) || addedTitles.has(normTitle);

        if (isDuplicate) {
          initialSelection[c.executable] = 'none'
        } else {
          initialSelection[c.executable] = 'import'
          defaultImports.push(c)
        }
      })

      setImportSelection(initialSelection)
      setScannedImports(defaultImports)
      setScannedBlacklist([])
      setScanPhase('full_done')
    } catch (err) {
      window.api.logError(`Error scanning all games: ${err}`)
    } finally {
      setScanningCandidates(false)
    }
  }

  const handleSelectAll = (action: 'import' | 'none') => {
    const newSelection: Record<string, 'import' | 'blacklist' | 'none'> = {}
    const toImport: GameCandidate[] = []

    scannedCandidates.forEach((c) => {
      if (action === 'import') {
        if (!isCandidateAlreadyAdded(c)) {
          newSelection[c.executable] = 'import'
          toImport.push(c)
        } else {
          newSelection[c.executable] = 'none'
        }
      } else {
        newSelection[c.executable] = 'none'
      }
    })

    setImportSelection(newSelection)
    setScannedImports(toImport)
    setScannedBlacklist([])
  }

  const handleToggleSelection = (executable: string, target: 'import' | 'blacklist') => {
    setImportSelection((prev) => {
      const current = prev[executable] || 'none'
      let next: 'import' | 'blacklist' | 'none' = 'none'

      if (target === 'import') {
        next = current === 'import' ? 'none' : 'import'
      } else {
        next = current === 'blacklist' ? 'none' : 'blacklist'
      }

      const newSelection = { ...prev, [executable]: next }

      const toImport: GameCandidate[] = []
      const toBlacklist: GameCandidate[] = []

      scannedCandidates.forEach((c) => {
        const sel = newSelection[c.executable] || 'none'
        if (sel === 'import') {
          toImport.push(c)
        } else if (sel === 'blacklist') {
          toBlacklist.push(c)
        }
      })

      setScannedImports(toImport)
      setScannedBlacklist(toBlacklist)

      return newSelection
    })
  }

  const displayedCandidates = React.useMemo(() => {
    if (!hideDuplicates) {
      return scannedCandidates
    }
    return scannedCandidates.filter((c) => !isCandidateAlreadyAdded(c))
  }, [scannedCandidates, hideDuplicates, isCandidateAlreadyAdded])

  const handleExportLog = async () => {
    const dateStr = new Date().toLocaleString()
    let logText = `Heroic Game Scanner Log - ${dateStr}\n`
    logText += `========================================\n\n`
    logText += `Jogos Escaneados: ${scannedCandidates.length}\n`
    logText += `Jogos Selecionados para Importar: ${scannedImports.length}\n`
    logText += `Jogos Selecionados para Blacklist: ${scannedBlacklist.length}\n\n`

    logText += `--- LISTA DE IMPORTAÇÃO ---\n`
    if (scannedImports.length === 0) {
      logText += `(Nenhum jogo selecionado para importação)\n`
    } else {
      scannedImports.forEach((g) => {
        logText += `- Título: ${g.title}\n  Executável: ${g.executable}\n`
      })
    }
    logText += `\n`

    logText += `--- LISTA NEGRA (BLACKLIST) ---\n`
    if (scannedBlacklist.length === 0) {
      logText += `(Nenhum jogo selecionado para blacklist)\n`
    } else {
      scannedBlacklist.forEach((g) => {
        logText += `- Título: ${g.title}\n  Executável: ${g.executable}\n`
      })
    }
    logText += `\n========================================\n`

    await window.api.exportScanLog(logText)
  }

  const handleClearBlacklist = async () => {
    await window.api.clearBlacklist()
    setBlacklistCount(0)
    setBlacklistItems([])
  }

  const handleViewBlacklist = async () => {
    const list = await window.api.getBlacklist()
    list.sort((a, b) => a.title.localeCompare(b.title))
    setBlacklistItems(list)
    setShowBlacklistModal(true)
  }

  const handleRemoveFromBlacklist = async (executable: string) => {
    await window.api.removeGameFromBlacklist(executable)
    const list = await window.api.getBlacklist()
    list.sort((a, b) => a.title.localeCompare(b.title))
    setBlacklistItems(list)
    setBlacklistCount(list.length)
  }

  const handleImportSelectedGames = async () => {
    setAddingApp(true)
    try {
      const gamesToImport = scannedCandidates.filter(
        (c) => importSelection[c.executable] === 'import'
      )
      const gamesToBlacklist = scannedCandidates.filter(
        (c) => importSelection[c.executable] === 'blacklist'
      )

      await window.api.importSelectedGames({
        gamesToImport,
        gamesToBlacklist
      })

      const list = await window.api.getBlacklist()
      setBlacklistCount(list.length)

      await refreshLibrary({
        library: 'sideload',
        runInBackground: true,
        checkForUpdates: true
      })
      backdropClick()
    } catch (err) {
      window.api.logError(`Error importing games: ${err}`)
    } finally {
      setAddingApp(false)
    }
  }

  const handleDeleteApp = () => {
    if (!appName) return
    showDialogModal({
      title: t('button.uninstall', 'Uninstall'),
      message: `Tem certeza de que deseja remover/desinstalar "${title}"?`,
      buttons: [
        {
          text: 'Cancelar',
          onClick: () => null
        },
        {
          text: 'Remover',
          onClick: async () => {
            setAddingApp(true)
            try {
              await window.api.bulkUninstall([{ appName, runner: 'sideload' }], true, true)
              await refreshLibrary({
                library: 'sideload',
                runInBackground: true,
                checkForUpdates: true
              })
              backdropClick()
            } catch (err) {
              window.api.logError(`Error deleting app ${appName}: ${err}`)
            } finally {
              setAddingApp(false)
            }
          }
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

  return (
    <DialogContent className="sideloadDialogContent">
      <div className="sideloadGrid">
        {/* Simulated HeroPanel (left panel) */}
        <div className="simulated-hero-panel">
          {/* Capa Vertical */}
          <div
            className={classNames('appImageContainer', {
              hasSgdbKey,
              searching,
              loading: imageLoading
            })}
            style={{
              position: 'relative',
              cursor: 'pointer',
              borderRadius: '16px 0px 0px 0px',
              border: 'none',
              width: 'calc(100% + 30px)',
              height: '420px',
              marginTop: '-15px',
              marginLeft: '-15px',
              marginRight: '-15px',
              overflow: 'hidden',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
              marginBottom: 0
            }}
            onClick={() => (hasSgdbKey ? setSgdbTarget('square') : handleSelectLocalImage('square'))}
          >
            <CachedImage
              className={classNames('appImage', {
                blackWhiteImage: searching
              })}
              src={imageUrl ? imageUrl : fallbackImage}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
            {(searching || imageLoading) && (
              <div className="imageLoadingOverlay">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" />
              </div>
            )}
            {hasSgdbKey && !searching && !imageLoading && (
              <div className="imageHoverOverlay">
                <FontAwesomeIcon icon={faSearch} size="3x" />
              </div>
            )}
          </div>

          {/* Title & Info */}
          <div style={{ flex: 1, padding: '10px 0 0 0', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff', textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>
              {title || 'Novo Jogo'}
            </h3>

            {/* Action Row */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.7)'
              }} title={appPlatform}>
                {platformIcon()}
              </div>
            </div>
          </div>
        </div>

        {/* Right simulated Settings Panel */}
        <div className="simulated-settings-panel">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
                {editMode ? `${title} (Configurações)` : t('sideload.add_title', 'Adicionar Jogo')}
              </h2>
              {editMode && (
                <button
                  type="button"
                  onClick={handleDeleteApp}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ff4444',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('button.delete', 'Excluir Jogo')}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={backdropClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* SteamGridDB Picker Mode */}
          {sgdbTarget ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SteamGridDBPicker
                initialTitle={title}
                mode={sgdbTarget === 'cover' ? 'heroes' : 'grids'}
                hideCloseButton={!!initialSgdbTarget}
                onClose={() => setSgdbTarget(null)}
                onSelect={(url: string) => {
                  if (sgdbTarget === 'cover') {
                    setHeroUrl(url)
                  } else if (url !== imageUrl) {
                    setImageLoading(true)
                    setImageUrl(url)
                  }
                  setSgdbTarget(null)
                }}
              />
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'manual' ? '2px solid #00e5ff' : '2px solid transparent',
                    color: activeTab === 'manual' ? '#00e5ff' : 'rgba(255, 255, 255, 0.4)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                >
                  {editMode ? t('button.settings', 'Configurações') : t('button.add_manual', 'Adicionar Manual')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('scanner')
                    if (scannedCandidates.length === 0) {
                      handleScanCandidates()
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'scanner' ? '2px solid #00e5ff' : '2px solid transparent',
                    color: activeTab === 'scanner' ? '#00e5ff' : 'rgba(255, 255, 255, 0.4)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                >
                  {t('button.auto_scanner', 'Auto-Scanner')}
                </button>
              </div>

              {/* Scrollable Content Form */}
              <div className={classNames('sideloadForm', { scannerTab: activeTab === 'scanner' })}>
                {activeTab === 'manual' ? (
                  <>
                    {/* Secao 1: Titulo e Imagens */}
                    <div>
                      <div style={sectionHeaderStyle}>
                        1. {t('sideload.section.info', 'Informações Gerais')}
                      </div>
                      <TextInputField
                        label={t('sideload.info.title', 'Game/App Title')}
                        placeholder={t(
                          'sideload.placeholder.title',
                          'Add a title to your Game/App'
                        )}
                        onChange={(newValue) => handleTitle(newValue)}
                        onBlur={async () => searchImage()}
                        htmlId="sideload-title"
                        value={title}
                        maxLength={40}
                      />

                      {!hasSgdbKey && (
                        <div style={{ marginTop: '12px' }}>
                          <WarningMessage>
                            {t(
                              'edit-game.sgdb.no-key-prefix',
                              'To search SteamGridDB for cover art, add an API key in'
                            )}{' '}
                            <a
                              role="button"
                              tabIndex={0}
                              onClick={goToAdvancedSettings}
                              className="sgdbWarningLink"
                            >
                              {t('edit-game.sgdb.no-key-link', 'Settings → Advanced')}
                            </a>
                            .
                          </WarningMessage>
                        </div>
                      )}
                    </div>

                    {/* Secao 2: Executavel / URL do jogo */}
                    <div>
                      <div style={sectionHeaderStyle}>
                        2. {t('sideload.section.path', 'Caminho do Jogo')}
                      </div>

                      {showSideloadExe && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '-10px' }}>
                              <label htmlFor="sideload-exe" style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                                {t('sideload.info.exe', 'Select Executable')}
                              </label>
                              <InfoBox
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
                            </div>
                            <PathSelectionBox
                              type="file"
                              onPathChange={setSelectedExe}
                              path={selectedExe}
                              placeholder={t('sideload.info.exe', 'Select Executable')}
                              pathDialogTitle={t('box.sideload.exe', 'Select Executable')}
                              pathDialogDefaultPath={winePrefix}
                              pathDialogFilters={fileFilters(platformToInstall)}
                              htmlId="sideload-exe"
                              noDeleteButton
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '-10px' }}>
                              <label htmlFor="sideload-args" style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                                {t('translation:options.gameargs.title')}
                              </label>
                              <InfoBox text={t('translation:infobox.help', 'Help')} align="right">
                                <span>
                                  {t('translation:help.other.part4')}
                                  <strong>{t('translation:help.other.part5')}</strong>
                                  {t('translation:help.other.part6')}
                                  <strong>{` -nolauncher `}</strong>
                                  {t('translation:help.other.part7')}
                                </span>
                              </InfoBox>
                            </div>
                            <TextInputField
                              htmlId="sideload-args"
                              placeholder={t('translation:options.gameargs.placeholder')}
                              value={launcherArgs}
                              onChange={(newValue: string) => setLauncherArgs(newValue)}
                              afterInput={
                                launcherArgsError ? (
                                  <p className="error">{launcherArgsError}</p>
                                ) : undefined
                              }
                            />
                          </div>
                        </div>
                      )}

                      {!showSideloadExe && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <TextInputField
                            label={t('sideload.info.broser', 'BrowserURL')}
                            placeholder={t(
                              'sideload.placeholder.url',
                              'Paste the Game URL here'
                            )}
                            onChange={(newValue: string) => handleGameUrl(newValue)}
                            htmlId="sideload-game-url"
                            value={gameUrl}
                          />
                          <TextInputField
                            label={t('sideload.info.useragent', 'Custom User Agent')}
                            placeholder={t(
                              'sideload.placeholder.useragent',
                              'Write a custom user agent here to be used on this browser app/game'
                            )}
                            onChange={(newValue: string) => setCustomUserAgent(newValue)}
                            htmlId="sideload-user-agent"
                            value={customUserAgent}
                          />
                          <ToggleSwitch
                            htmlId="launch-fullscreen"
                            value={launchFullScreen}
                            handleChange={() => setLaunchFullScreen(!launchFullScreen)}
                            title={t(
                              'sideload.info.fullscreen',
                              'Launch Fullscreen (F11 to exit)'
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {/* Secao 3: Plataforma & Wine (children) */}
                    {!editMode && children && (
                      <div>
                        <div style={sectionHeaderStyle}>
                          3. {t('sideload.section.wine', 'Runner e Configurações')}
                        </div>
                        {children}
                      </div>
                    )}
                  </>
                ) : (
                  /* AUTO-SCANNER TAB CONTENT */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                        {scannedCandidates.length > 0 ? (
                          hideDuplicates ? (
                            `Mostrando ${displayedCandidates.length} de ${scannedCandidates.length} candidatos (ocultando ${scannedCandidates.length - displayedCandidates.length} já adicionados)`
                          ) : (
                            `Encontrado(s) ${scannedCandidates.length} jogo(s) candidatos.`
                          )
                        ) : (
                          'Use o scanner para procurar jogos instalados no seu PC.'
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={handleViewBlacklist}
                          className="button is-warning is-outlined"
                          style={{ padding: '4px 12px', fontSize: '12px', height: '32px' }}
                        >
                          Ver Blacklist ({blacklistCount})
                        </button>
                        <button
                          type="button"
                          onClick={scanPhase === 'initial' ? handleScanCandidates : handleScanAll}
                          className="button is-secondary"
                          style={{ padding: '4px 12px', fontSize: '12px', height: '32px' }}
                          disabled={
                            scanningCandidates ||
                            (scanPhase !== 'initial' && searchOnlyByName && !searchTitlesInput.trim())
                          }
                        >
                          {scanningCandidates ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '6px' }} />
                              Escaneando...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faSyncAlt} style={{ marginRight: '6px' }} />
                              {scanPhase === 'initial' ? 'Escanear PC' : 'Escanear Tudo'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {scanPhase !== 'initial' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          color: 'rgba(255, 255, 255, 0.75)',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}>
                          <input
                            type="checkbox"
                            checked={searchOnlyByName}
                            onChange={(e) => setSearchOnlyByName(e.target.checked)}
                            style={{
                              width: '16px',
                              height: '16px',
                              accentColor: '#00ffff',
                              cursor: 'pointer'
                            }}
                          />
                          Desabilitar escaneamento completo (buscar apenas pelos nomes digitados)
                        </label>

                        {searchOnlyByName && (
                          <TextInputField
                            label="Buscar Jogos Específicos (separados por vírgula)"
                            placeholder="Digite o nome dos jogos, ex: GTA, Cyberpunk, Witcher"
                            onChange={(newValue) => setSearchTitlesInput(newValue)}
                            htmlId="scanner-search-titles"
                            value={searchTitlesInput}
                          />
                        )}
                      </div>
                    )}
         
                    {scannedCandidates.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginTop: '-8px', marginBottom: '-4px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          color: 'rgba(255, 255, 255, 0.75)',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}>
                          <input
                            type="checkbox"
                            checked={hideDuplicates}
                            onChange={(e) => setHideDuplicates(e.target.checked)}
                            style={{
                              width: '16px',
                              height: '16px',
                              accentColor: '#00ffff',
                              cursor: 'pointer'
                            }}
                          />
                          Ocultar itens escaneados que já estão adicionados no Heroic
                        </label>

                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectAll('import')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#00ffff',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              padding: 0,
                              outline: 'none'
                            }}
                          >
                            Marcar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectAll('none')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ff4444',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              padding: 0,
                              outline: 'none'
                            }}
                          >
                            Desmarcar Todos
                          </button>
                        </div>
                      </div>
                    )}

                    {scanningCandidates && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px', flex: 1 }}>
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: '#00e5ff' }} />
                        <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          {scanPhase === 'initial'
                            ? 'Escaneando o registro do Windows por executáveis de jogos...'
                            : 'Escaneando discos locais por jogos (isso pode levar alguns segundos)...'}
                        </span>
                      </div>
                    )}

                    {!scanningCandidates && scannedCandidates.length === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.1)', flex: 1 }}>
                        <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {scanPhase === 'initial'
                            ? 'Nenhum candidato encontrado. Clique em "Escanear PC" acima.'
                            : 'Nenhum candidato encontrado. Clique em "Escanear Tudo" acima.'}
                        </span>
                      </div>
                    )}

                    {!scanningCandidates && scannedCandidates.length > 0 && displayedCandidates.length === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.1)', flex: 1 }}>
                        <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                          Todos os candidatos escaneados já foram adicionados ao Heroic.
                          <br />
                          Desmarque "Ocultar itens escaneados..." acima para visualizá-los.
                        </span>
                      </div>
                    )}

                    {!scanningCandidates && displayedCandidates.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, minHeight: 0, paddingRight: '4px' }}>
                        {displayedCandidates.map((c) => {
                          const selection = importSelection[c.executable] || 'none'
                          return (
                            <div
                              key={c.executable}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CachedImage
                                src={c.art_square || fallbackImage}
                                alt={c.title}
                                style={{ width: '40px', height: '54px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {c.title}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={c.executable}>
                                  {c.executable}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                                {isCandidateAlreadyAdded(c) && (
                                  <span style={{
                                    fontSize: '11px',
                                    color: '#ffcc00',
                                    background: 'rgba(255, 204, 0, 0.1)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 204, 0, 0.3)',
                                    fontWeight: 'bold',
                                    marginRight: '4px'
                                  }}>
                                    Já Adicionado
                                  </span>
                                )}
                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  background: selection === 'import' ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${selection === 'import' ? '#00e5ff' : 'rgba(255,255,255,0.1)'}`,
                                  color: selection === 'import' ? '#00e5ff' : 'rgba(255, 255, 255, 0.6)',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  userSelect: 'none',
                                  transition: 'all 0.2s ease'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={selection === 'import'}
                                    onChange={() => handleToggleSelection(c.executable, 'import')}
                                    style={{ display: 'none' }}
                                  />
                                  <FontAwesomeIcon icon={faCheck} style={{ width: '12px', opacity: selection === 'import' ? 1 : 0.3 }} />
                                  Importar
                                </label>

                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  background: selection === 'blacklist' ? 'rgba(255, 68, 68, 0.12)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${selection === 'blacklist' ? '#ff4444' : 'rgba(255,255,255,0.1)'}`,
                                  color: selection === 'blacklist' ? '#ff4444' : 'rgba(255, 255, 255, 0.6)',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  userSelect: 'none',
                                  transition: 'all 0.2s ease'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={selection === 'blacklist'}
                                    onChange={() => handleToggleSelection(c.executable, 'blacklist')}
                                    style={{ display: 'none' }}
                                  />
                                  <FontAwesomeIcon icon={faBan} style={{ width: '12px', opacity: selection === 'blacklist' ? 1 : 0.3 }} />
                                  Blacklist
                                </label>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dialog Footer Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '12px',
                marginTop: 'auto'
              }}>
                <div>
                  {activeTab === 'scanner' && scannedCandidates.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportLog}
                      className="button is-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <FontAwesomeIcon icon={faFileAlt} />
                      Salvar Log
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  {activeTab === 'manual' && shouldShowRunExe && (
                    <button
                      type="button"
                      onClick={async () => handleRunExe()}
                      className={`button is-secondary`}
                      disabled={runningSetup || !title.length}
                    >
                      {runningSetup
                        ? t('button.running-setup', 'Running Setup')
                        : t('button.run-exe-first', 'Run Installer First')}
                    </button>
                  )}

                  {activeTab === 'manual' ? (
                    <button
                      type="button"
                      onClick={async () => handleInstall()}
                      className={`button is-success`}
                      disabled={
                        (!selectedExe.length && !gameUrl) ||
                        addingApp ||
                        searching ||
                        Boolean(launcherArgsError)
                      }
                    >
                      {addingApp && <FontAwesomeIcon icon={faSpinner} spin />}
                      {!addingApp && t('button.finish', 'Finish')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleImportSelectedGames}
                      className={`button is-success`}
                      disabled={scannedCandidates.length === 0 || addingApp}
                    >
                      {addingApp && <FontAwesomeIcon icon={faSpinner} spin />}
                      {!addingApp && t('button.finish', 'Terminar')}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showBlacklistModal && (
        <div className="blacklist-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="blacklist-modal-content" style={{
            background: 'var(--body-background, #1a1b26)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            width: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#fff' }}>
                Jogos na Blacklist ({blacklistItems.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowBlacklistModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px'
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '6px' }}>
              {blacklistItems.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', padding: '40px 0' }}>
                  A blacklist está vazia.
                </div>
              ) : (
                blacklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500', color: '#fff', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {item.executable}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button outline"
                      onClick={() => handleRemoveFromBlacklist(item.executable)}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        color: '#ff4444',
                        cursor: 'pointer',
                        minWidth: '32px',
                        height: '32px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'transparent'
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} style={{ width: '12px' }} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '16px'
            }}>
              <div>
                {blacklistItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBlacklist}
                    className="button is-danger is-outlined"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    Limpar Blacklist
                  </button>
                )}
              </div>
              <button
                type="button"
                className="button is-secondary"
                onClick={() => setShowBlacklistModal(false)}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContent>
  )
}
