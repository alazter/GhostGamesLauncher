import React, { useContext, useState, useEffect } from 'react'
import './App.css'
import {
  createHashRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation
} from 'react-router-dom'
import Sidebar from './components/UI/Sidebar'
import ContextProvider from './state/ContextProvider'
import { ControllerHints, Help, OfflineMessage } from './components/UI'
import DialogHandler from './components/UI/DialogHandler'
import ExternalLinkDialog from './components/UI/ExternalLinkDialog'
import WindowControls from './components/UI/WindowControls'
import classNames from 'classnames'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import LogFileUploadDialog from './components/UI/LogFileUploadDialog'
import UploadedLogFilesList from './screens/Settings/sections/LogSettings/components/UploadedLogFilesList'
import { TourProvider } from './state/TourContext'
import { InstallGameWrapper } from './screens/Library/components/InstallModal'
import { SettingsModalWrapper } from './screens/Settings/components/SettingsModal'
import AnalyticsDialog from './screens/Settings/components/AnalyticsDialog'

interface HeroicAppContext {
  isRTL: boolean
  isFullscreen: boolean
  isFrameless: boolean
  experimentalFeatures: { enableHelp?: boolean }
  help: { items: React.ComponentProps<typeof Help>['items'] }
  disableAnimations: boolean
}

function Root() {
  const context = useContext(ContextProvider) as unknown as HeroicAppContext

  const {
    isRTL,
    isFullscreen,
    isFrameless,
    experimentalFeatures,
    help,
    disableAnimations
  } = context

  const nav = navigator as unknown as Record<string, Record<string, boolean>>
  const hasNativeOverlayControls =
    typeof nav.windowControlsOverlay === 'object' &&
    nav.windowControlsOverlay.visible
  const showOverlayControls = isFrameless && !hasNativeOverlayControls

  const [globalBg, setGlobalBg] = useState<string | null>(() => {
    return localStorage.getItem('heroic_custom_bg')
  })

  useEffect(() => {
    const handleBgChange = () =>
      setGlobalBg(localStorage.getItem('heroic_custom_bg'))
    window.addEventListener('customBgChanged', handleBgChange)
    return () => window.removeEventListener('customBgChanged', handleBgChange)
  }, [])

  useEffect(() => {
    const styleId = 'custom-heroic-vars'
    let styleTag = document.getElementById(styleId) as HTMLStyleElement
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = styleId
      document.head.appendChild(styleTag)
    }

    if (globalBg) {
      styleTag.innerHTML = `
        :root {
          --background: transparent !important;
        }

        /* 1. O CAMPEÃO: Background 100% aplicado no container principal */
        #app {
          background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url("${globalBg}") !important;
          background-size: cover !important;
          background-position: center !important;
          background-attachment: fixed !important;
          background-repeat: no-repeat !important;
          background-color: #121212 !important;
        }

        /* 2. TRANSPARÊNCIA DA ESTRUTURA GERAL */
        .App, 
        main.content, 
        main.content > div,
        nav[class*="TitleBar"],
        .window-controls {
          background-color: transparent !important;
          background: transparent !important;
          background-image: none !important;
        }

        /* ========================================================= */
        /* CORREÇÃO DO CABEÇALHO ("Todos os jogos")                  */
        /* ========================================================= */
        main.content h1, 
        main.content h2, 
        main.content [class*="Header"],
        main.content [class*="Title"],
        .library-header,
        .library-header > div {
          background-color: transparent !important;
          background: transparent !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        /* ========================================================= */
        /* BARRA LATERAL COM CINZA SEMI-TRANSPARENTE                 */
        /* ========================================================= */
        aside, 
        .sidebar-container {
          background-color: rgba(30, 34, 40, 0.6) !important; /* Cinza escuro com 60% de opacidade */
          background: rgba(30, 34, 40, 0.6) !important;
          backdrop-filter: blur(8px) !important; /* Efeito de vidro */
        }

        /* 3. JANELAS SÓLIDAS EM #131a20 */
        .MuiDialog-paper, 
        .MuiPaper-elevation24, 
        .MuiPopover-paper,
        [role="dialog"] {
          background-color: #131a20 !important;
          background: #131a20 !important;
          background-image: none !important;
          backdrop-filter: none !important;
          opacity: 1 !important;
        }

        /* ========================================================= */
        /* AJUSTES CIRÚRGICOS (17 E ÍCONE ATIVO)                     */
        /* ========================================================= */

        /* A) O número 17 (Quantidade de jogos) */
        .numberOfgames {
          --input-background: rgba(255, 255, 255, 0.15) !important;
          background: rgba(255, 255, 255, 0.15) !important;
          background-color: rgba(255, 255, 255, 0.15) !important;
        }

        /* B) Fundo do ícone ativo na barra lateral */
        #app aside .active,
        #app .sidebar-container .active,
        #app aside [aria-current="page"] {
          background-color: rgba(255, 255, 255, 0.08) !important;
          background: rgba(255, 255, 255, 0.08) !important;
          border-radius: 8px !important;
        }
      `
    } else {
      styleTag.innerHTML = ''
    }
  }, [globalBg])

  const isConsoleMode = useLocation().pathname.startsWith('/console')

  const theme = createTheme({
    direction: isRTL ? 'rtl' : 'ltr',
    typography: { fontFamily: 'var(--primary-font-family)' },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            color: 'var(--text-default)',
            backgroundColor: globalBg ? '#131a20' : 'var(--background)'
          }
        }
      }
    }
  })

  const helpItems =
    help?.items || ({} as React.ComponentProps<typeof Help>['items'])

  return (
    <div
      id="app"
      className={classNames('App', {
        isRTL,
        frameless: isFrameless,
        fullscreen: isFullscreen,
        disableAnimations,
        consoleMode: isConsoleMode
      })}
    >
      <ThemeProvider theme={theme}>
        {isConsoleMode ? (
          <main className="content consoleContent">
            <Outlet />
          </main>
        ) : (
          <TourProvider>
            <OfflineMessage />
            <Sidebar />
            <main className="content">
              <DialogHandler />
              <InstallGameWrapper />
              <SettingsModalWrapper />
              <ExternalLinkDialog />
              <LogFileUploadDialog />
              <UploadedLogFilesList />
              <Outlet />
              <AnalyticsDialog />
            </main>
            <div className="controller">
              <ControllerHints />
              <dialog className="simple-keyboard-wrapper">
                <div className="simple-keyboard"></div>
              </dialog>
            </div>
            {showOverlayControls && <WindowControls />}
            {experimentalFeatures?.enableHelp && <Help items={helpItems} />}
          </TourProvider>
        )}
      </ThemeProvider>
    </div>
  )
}

function makeLazyFunc(
  importedFile: Promise<{
    default: React.ComponentType<Record<string, unknown>>
  }>
) {
  return async () => {
    const component = await importedFile
    return { Component: component.default }
  }
}

const router = createHashRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, lazy: makeLazyFunc(import('./screens/Library')) },
      { path: 'login', lazy: makeLazyFunc(import('./screens/Login')) },
      { path: 'store/:store', lazy: makeLazyFunc(import('./screens/WebView')) },
      { path: 'wiki', lazy: makeLazyFunc(import('./screens/WebView')) },
      {
        path: 'gamepage/:runner/:appName',
        lazy: makeLazyFunc(import('./screens/Game/GamePage'))
      },
      { path: 'store-page', lazy: makeLazyFunc(import('./screens/WebView')) },
      {
        path: 'discounts',
        lazy: makeLazyFunc(import('./screens/Discounts'))
      },
      {
        path: 'loginweb/:runner',
        lazy: makeLazyFunc(import('./screens/WebView'))
      },
      {
        path: 'settings/:type',
        lazy: makeLazyFunc(import('./screens/Settings'))
      },
      {
        path: 'wine-manager',
        lazy: makeLazyFunc(import('./screens/WineManager'))
      },
      {
        path: 'download-manager',
        lazy: makeLazyFunc(import('./screens/DownloadManager'))
      },
      {
        path: 'accessibility',
        lazy: makeLazyFunc(import('./screens/Accessibility'))
      },
      {
        path: 'personalization',
        lazy: makeLazyFunc(import('./screens/Personalization'))
      },
      {
        path: 'console',
        lazy: makeLazyFunc(import('./screens/ConsoleMode'))
      },
      {
        path: '*',
        element: <Navigate replace to="/" />
      }
    ]
  }
])

export default function App() {
  return <RouterProvider router={router} />
}
