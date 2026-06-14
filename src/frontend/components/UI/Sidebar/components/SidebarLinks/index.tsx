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
  faPaintBrush
} from '@fortawesome/free-solid-svg-icons'
import { useLocation } from 'react-router-dom'
import { useContext, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  faGithub
} from '@fortawesome/free-brands-svg-icons'

import ContextProvider from 'frontend/state/ContextProvider'
import QuitButton from '../QuitButton'
import { SHOW_EXTERNAL_LINK_DIALOG_STORAGE_KEY } from 'frontend/components/UI/ExternalLinkDialog'
import SidebarItem from '../SidebarItem'

type PathSplit = [a: undefined, b: undefined, type: string]

export default function SidebarLinks() {
  const { t } = useTranslation()
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
      case 'stores':
        return (
          <div key="stores" className="SidebarItemWithSubmenu" {...dragProps}>
            <SidebarItem
              isActiveFallback={location.pathname.includes('store')}
              url={`/store/${defaultStore}`}
              icon={faStore}
              label={t('stores', 'Stores')}
              dataTour="sidebar-stores"
            />
            {inWebviewScreen && (
              <div className="SidebarSubmenu">
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/epic"
                  label={t('store', 'Epic Store')}
                />
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/gog"
                  label={t('gog-store', 'GOG Store')}
                />
                <SidebarItem
                  className="SidebarLinks__subItem"
                  url="/store/amazon"
                  label={t('amazon-luna', 'Amazon Luna')}
                />
                {zoom.enabled && (
                  <SidebarItem
                    className="SidebarLinks__subItem"
                    url="/store/zoom"
                    label={t('zoom-store', 'Zoom Store')}
                  />
                )}
              </div>
            )}
          </div>
        )
      case 'divider-1':
      case 'divider-2':
        return <div key={id} className="divider" {...dragProps} />
      case 'settings':
        return (
          <div key="settings" className="SidebarItemWithSubmenu" {...dragProps}>
            <SidebarItem
              isActiveFallback={location.pathname.includes('settings')}
              icon={faSlidersH}
              label={t('Settings', 'Settings')}
              url="/settings/general"
              dataTour="sidebar-settings"
            />
            {isSettings && (
              <div className="SidebarSubmenu settings">
                <SidebarItem
                  url="/settings/general"
                  isActiveFallback={type === 'general'}
                  className="SidebarLinks__subItem"
                  label={t('settings.navbar.general')}
                />
                {!isWin && (
                  <SidebarItem
                    url="/settings/games_settings"
                    isActiveFallback={type === 'games_settings'}
                    className="SidebarLinks__subItem"
                    label={t(
                      'settings.navbar.games_settings_defaults',
                      'Game Defaults'
                    )}
                  />
                )}
                <SidebarItem
                  url="/settings/advanced"
                  isActiveFallback={type === 'advanced'}
                  className="SidebarLinks__subItem"
                  label={t('settings.navbar.advanced', 'Advanced')}
                />
                <SidebarItem
                  url="/settings/systeminfo"
                  isActiveFallback={type === 'systeminfo'}
                  className="SidebarLinks__subItem"
                  label={t(
                    'settings.navbar.systemInformation',
                    'System Information'
                  )}
                />
                <SidebarItem
                  url="/settings/log"
                  isActiveFallback={type === 'log'}
                  className="SidebarLinks__subItem"
                  label={t('settings.navbar.log', 'Log')}
                />
              </div>
            )}
          </div>
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
