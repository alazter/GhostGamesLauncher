import {
  faGamepad,
  faSlidersH,
  faStore,
  faUser,
  faUniversalAccess,
  faUserAlt,
  faWineGlass,
  faBarsProgress,
  faTv,
  faPaintBrush,
  faClock
} from '@fortawesome/free-solid-svg-icons'
import { useLocation } from 'react-router-dom'
import { useContext, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  faGithub,
  faSteam,
  faAmazon
} from '@fortawesome/free-brands-svg-icons'

import EpicLogo from 'frontend/assets/epic-logo.svg?react'
import GOGLogo from 'frontend/assets/gog-logo.svg?react'
import ZoomLogo from 'frontend/assets/zoom-logo.svg?react'
import ContextProvider from 'frontend/state/ContextProvider'
import QuitButton from '../QuitButton'
import { SHOW_EXTERNAL_LINK_DIALOG_STORAGE_KEY } from 'frontend/components/UI/ExternalLinkDialog'
import SidebarItem from '../SidebarItem'
import StoreHoverMenu from '../StoreHoverMenu'
import { checkTodayReleases } from 'frontend/helpers/releasesScanner'
import { hasProgress } from 'frontend/hooks/hasProgress'
import type { DMQueueElement } from 'common/types'

type PathSplit = [a: undefined, b: undefined, type: string]

export default function SidebarLinks() {
  const { t } = useTranslation()
  const [currentDMElement, setCurrentDMElement] = useState<DMQueueElement>()

  useEffect(() => {
    window.api
      .getDMQueueInformation()
      .then(({ elements }) => {
        setCurrentDMElement(elements[0])
      })
      .catch(() => {})

    const removeHandleDMQueueInformation = window.api.handleDMQueueInformation(
      (e, elements) => {
        setCurrentDMElement(elements[0])
      }
    )

    return () => {
      removeHandleDMQueueInformation()
    }
  }, [])

  const { libraryStatus } = useContext(ContextProvider)
  const isDownloading = Boolean(
    libraryStatus?.some(
      (g) => g.status === 'installing' || g.status === 'updating'
    )
  )

  const [currentDownloadProgress] = hasProgress(
    currentDMElement?.params?.appName || '',
    currentDMElement?.params?.runner || 'legendary'
  )
  const downloadBadgeText =
    isDownloading && currentDMElement
      ? `${Math.round(currentDownloadProgress?.percent ?? 0)}%`
      : undefined
  const [isStoreHovered, setIsStoreHovered] = useState(false)
  const [storeAnchorRect, setStoreAnchorRect] = useState<DOMRect | null>(null)
  const hoverTimeoutRef = useState<{ timer: NodeJS.Timeout | null }>({ timer: null })[0]

  const handleStoreMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverTimeoutRef.timer) clearTimeout(hoverTimeoutRef.timer)
    if (e.currentTarget) {
      setStoreAnchorRect(e.currentTarget.getBoundingClientRect())
    }
    setIsStoreHovered(true)
  }

  const handleStoreMouseLeave = () => {
    hoverTimeoutRef.timer = setTimeout(() => {
      setIsStoreHovered(false)
    }, 200)
  }
  const location = useLocation() as { pathname: string }
  const [, , type] = location.pathname.split('/') as PathSplit

  const {
    amazon,
    epic,
    gog,
    zoom,
    platform,
    refreshLibrary,
    handleExternalLinkDialog
  } = useContext(ContextProvider)

  const getSidebarOrder = () => {
    const saved = localStorage.getItem('heroic_sidebar_order')
    const defaultOrder = [
      'library',
      'releases',
      'personalization',
      'login',
      'stores',
      'divider-1',
      'settings',
      'console',
      'downloads',
      'wine-manager',
      'accessibility',
      'divider-2',
      'wiki',
      'quit'
    ]
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[]
        const orderedList: string[] = []
        parsed.forEach(id => {
          if (defaultOrder.includes(id)) {
            orderedList.push(id)
          }
        })
        defaultOrder.forEach(id => {
          if (!orderedList.includes(id)) {
            orderedList.push(id)
          }
        })
        return orderedList
      } catch (err) {
        console.error('Erro ao ler ordem do sidebar:', err)
      }
    }
    return defaultOrder
  }

  const [releasesBadgeCount, setReleasesBadgeCount] = useState<number>(() => {
    localStorage.removeItem('ghost_releases_last_cleared_date')
    return parseInt(localStorage.getItem('ghost_releases_badge_count') || '0', 10) || 0
  })

  useEffect(() => {
    // Consulta silenciosa em segundo plano após o launcher estabilizar (3 segundos)
    const timer = setTimeout(() => {
      checkTodayReleases()
    }, 3000)

    const handleBadgeChange = () => {
      const count = parseInt(localStorage.getItem('ghost_releases_badge_count') || '0', 10) || 0
      setReleasesBadgeCount(count)
    }
    window.addEventListener('ghostReleasesBadgeChanged', handleBadgeChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('ghostReleasesBadgeChanged', handleBadgeChange)
    }
  }, [])

  const handleClearReleasesBadge = () => {
    // Zera o badge na sessão ao clicar
    setReleasesBadgeCount(0)
    localStorage.setItem('ghost_releases_badge_count', '0')
  }

  const [sidebarOrder, setSidebarOrder] = useState<string[]>(getSidebarOrder)

  useEffect(() => {
    const handleSettingsChange = () => {
      const saved = localStorage.getItem('heroic_sidebar_order')
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[]
          if (JSON.stringify(parsed) !== JSON.stringify(sidebarOrder)) {
            setSidebarOrder(getSidebarOrder())
          }
        } catch (e) {
          setSidebarOrder(getSidebarOrder())
        }
      } else {
        setSidebarOrder(getSidebarOrder())
      }
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () => window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [sidebarOrder])

  const inWebviewScreen =
    location.pathname.includes('store') ||
    location.pathname.includes('last-url')
  const isSettings = location.pathname.includes('settings')
  const isWin = platform === 'win32'

  const loggedIn =
    epic.username || gog.username || amazon.user_id || zoom.username

  async function handleRefresh() {
    localStorage.setItem('scrollPosition', '0')

    const shouldRefresh =
      (epic.username && !epic.library.length) ||
      (gog.username && !gog.library.length) ||
      (amazon.user_id && !amazon.library.length) ||
      (zoom.username && !zoom.library.length)
    if (shouldRefresh) {
      return refreshLibrary({ runInBackground: true })
    }
    return
  }

  function handleExternalLink(linkCallback: () => void) {
    const showDialogSetting = localStorage.getItem(
      SHOW_EXTERNAL_LINK_DIALOG_STORAGE_KEY
    )
    const showExternalLinkDialog = showDialogSetting
      ? (JSON.parse(showDialogSetting) as boolean)
      : true

    if (showExternalLinkDialog) {
      handleExternalLinkDialog({ showDialog: true, linkCallback })
    } else {
      linkCallback()
    }
  }

  // By default, open Epic Store
  let defaultStore = 'epic'
  if (
    zoom.enabled &&
    !epic.username &&
    !gog.username &&
    !amazon.user_id &&
    zoom.username
  ) {
    // Prioritize Zoom if only Zoom is logged in
    defaultStore = 'zoom'
  } else if (!epic.username && !gog.username && amazon.user_id) {
    // If only logged in to Amazon Games, open Amazon Gaming
    defaultStore = 'amazon'
  } else if (!epic.username && gog.username) {
    // Otherwise, if not logged in to Epic Games, open GOG Store
    defaultStore = 'gog'
  }

  // if we have a stored last-url, default to the `/last-url` route
  const lastStore = sessionStorage.getItem('last-store')
  if (lastStore) {
    defaultStore = lastStore
  }

  const renderItem = (id: string, index: number) => {
    const dragProps = {
      draggable: false
    }

    switch (id) {
      case 'library':
        return (
          <SidebarItem
            key="library"
            isActiveFallback={location.pathname.includes('gamepage')}
            url="/"
            icon={faGamepad}
            label={t('Library')}
            onClick={async () => handleRefresh()}
            dataTour="sidebar-library"
            {...dragProps}
          />
        )
      case 'personalization':
        return (
          <SidebarItem
            key="personalization"
            url="/personalization"
            icon={faPaintBrush}
            label="Personalização"
            dataTour="sidebar-personalization"
            {...dragProps}
          />
        )
      case 'login':
        return (
          <SidebarItem
            key="login"
            url="/login"
            icon={loggedIn ? faUserAlt : faUser}
            label={
              loggedIn
                ? t('userselector.manageaccounts', 'Manage Accounts')
                : t('button.login', 'Login')
            }
            dataTour={loggedIn ? 'sidebar-manage-accounts' : 'sidebar-login'}
            {...dragProps}
          />
        )
      case 'stores': {
        const lastSelectedStore =
          localStorage.getItem('ghost_last_selected_store') || defaultStore || 'epic'
        return (
          <div
            key="stores"
            className="SidebarItemWithSubmenu"
            onMouseEnter={handleStoreMouseEnter}
            onMouseLeave={handleStoreMouseLeave}
            {...dragProps}
          >
            <SidebarItem
              isActiveFallback={location.pathname.includes('store')}
              url={`/store/${lastSelectedStore}`}
              icon={faStore}
              label={t('stores', 'Lojas')}
              dataTour="sidebar-stores"
            />
            {isStoreHovered && !inWebviewScreen && (
              <StoreHoverMenu
                anchorRect={storeAnchorRect}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.timer) clearTimeout(hoverTimeoutRef.timer)
                  setIsStoreHovered(true)
                }}
                onMouseLeave={handleStoreMouseLeave}
                onClose={() => setIsStoreHovered(false)}
              />
            )}
            {inWebviewScreen && (
              <div className="SidebarSubmenu">
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/epic"
                  customIcon={<EpicLogo />}
                  label="Epic Games"
                  onClick={() =>
                    localStorage.setItem('ghost_last_selected_store', 'epic')
                  }
                />
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/steam"
                  icon={faSteam}
                  label="Steam"
                  onClick={() =>
                    localStorage.setItem('ghost_last_selected_store', 'steam')
                  }
                />
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/gog"
                  customIcon={<GOGLogo />}
                  label="GOG"
                  onClick={() =>
                    localStorage.setItem('ghost_last_selected_store', 'gog')
                  }
                />
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/amazon"
                  icon={faAmazon}
                  label="Amazon Games"
                  onClick={() =>
                    localStorage.setItem('ghost_last_selected_store', 'amazon')
                  }
                />
                {zoom.enabled && (
                  <SidebarItem
                    className="SidebarLinks__subItem"
                    url="/store/zoom"
                    customIcon={<ZoomLogo />}
                    label="Zoom Platform"
                    onClick={() =>
                      localStorage.setItem('ghost_last_selected_store', 'zoom')
                    }
                  />
                )}
              </div>
            )}
          </div>
        )
      }
      case 'releases':
        return (
          <SidebarItem
            key="releases"
            url="/releases"
            state={releasesBadgeCount > 0 ? { targetUrl: 'https://www.releases.com/tracking' } : undefined}
            icon={faClock}
            label={t('sidebar.releases', 'Lançamentos')}
            dataTour="sidebar-releases"
            badgeCount={releasesBadgeCount}
            onClick={handleClearReleasesBadge}
            {...dragProps}
          />
        )
      case 'divider-1':
      case 'divider-2':
        return <div key={id} className="divider" {...dragProps} />
      case 'settings':
        return (
          <SidebarItem
            key="settings"
            isActiveFallback={location.pathname.includes('settings')}
            icon={faSlidersH}
            label={t('Settings', 'Settings')}
            url="/settings/general"
            dataTour="sidebar-settings"
            {...dragProps}
          />
        )
      case 'console':
        return (
          <SidebarItem
            key="console"
            url="/console"
            icon={faTv}
            label={t('sidebar.console', 'Console Mode')}
            dataTour="sidebar-console"
            {...dragProps}
          />
        )
      case 'downloads':
        return (
          <SidebarItem
            key="downloads"
            url="/download-manager"
            icon={faBarsProgress}
            label={t('download-manager.link', 'Downloads')}
            dataTour="sidebar-downloads"
            badgeText={downloadBadgeText}
            badgeVariant={downloadBadgeText ? 'percent' : undefined}
            {...dragProps}
          />
        )
      case 'wine-manager':
        return !isWin ? (
          <SidebarItem
            key="wine-manager"
            url="/wine-manager"
            icon={faWineGlass}
            label={t('wine.manager.link', 'Wine Manager')}
            dataTour="sidebar-wine"
            {...dragProps}
          />
        ) : null
      case 'accessibility':
        return (
          <SidebarItem
            key="accessibility"
            url="/accessibility"
            icon={faUniversalAccess}
            label={t('accessibility.title', 'Accessibility')}
            dataTour="sidebar-accessibility"
            {...dragProps}
          />
        )
      case 'wiki':
        return (
          <SidebarItem
            key="wiki"
            url="/wiki"
            icon={faGithub}
            label={t('docs', 'Documentation')}
            dataTour="sidebar-docs"
            {...dragProps}
          />
        )
      case 'quit':
        return <QuitButton key="quit" dataTour="sidebar-quit" {...dragProps} />
      default:
        return null
    }
  }

  return (
    <div className="SidebarLinks Sidebar__section" data-tour="sidebar-menu">
      {sidebarOrder.map((id, index) => renderItem(id, index))}
    </div>
  )
}
