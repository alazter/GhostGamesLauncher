import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, useParams } from 'react-router-dom'

import { ToggleSwitch, UpdateComponent } from 'frontend/components/UI'
import WebviewControls from 'frontend/components/UI/WebviewControls'
import ContextProvider from 'frontend/state/ContextProvider'
import {
  isUsingGamepad,
  setWebviewInputTarget,
  toggleWebviewFocus
} from 'frontend/helpers/gamepad'
import './index.css'
import LoginWarning from '../Login/components/LoginWarning'
import { NileLoginData } from 'common/types/nile'
import {
  Dialog,
  DialogContent,
  DialogHeader
} from 'frontend/components/UI/Dialog'

const validStoredUrl = (url: string, store: string) => {
  switch (store) {
    case 'epic':
      return url.includes('epicgames.com')
    case 'gog':
      return url.includes('gog.com')
    case 'amazon':
      return url.includes('gaming.amazon.com')
    case 'zoom':
      return url.includes('zoom-platform.com')
    case 'steam':
      return url.includes('steampowered.com') || url.includes('steamcommunity.com')
    default:
      return false
  }
}

export default function WebView() {
  const { i18n } = useTranslation()
  const { pathname, search } = useLocation()
  const { t } = useTranslation()
  const { epic, gog, amazon, zoom, connectivity } = useContext(ContextProvider)
  const [loading, setLoading] = useState<{
    refresh: boolean
    message: string
  }>(() => ({
    refresh: true,
    message: t('loading.website', 'Loading Website')
  }))
  const [amazonLoginData, setAmazonLoginData] = useState<NileLoginData | null>(
    null
  )
  const navigate = useNavigate()
  // Keep the webview element in state (via a callback ref) instead of a plain
  // ref so that mounting/remounting it — e.g. when switching stores — triggers
  // a re-render and propagates the live element to children like
  // WebviewControls. A mutable ref wouldn't, leaving them with a stale webview.
  const [webview, setWebview] = useState<Electron.WebviewTag | null>(null)
  const webviewRef = useCallback((node: Electron.WebviewTag | null) => {
    setWebview(node)
  }, [])

  // `store` is set to epic/gog/amazon depending on which storefront we're
  // supposed to show, `runner` is set to a runner if we're supposed to show its
  // login prompt
  const { store, runner } = useParams()

  let lang = i18n.language
  if (i18n.language === 'pt') {
    lang = 'pt-BR'
  }

  const epicLoginUrl = 'https://legendary.gl/epiclogin'

  const epicStore = `https://www.epicgames.com/store/${lang}/`
  const gogStore = `https://af.gog.com?as=1838482841`
  const amazonStore = `https://gaming.amazon.com`
  const zoomStore = `https://www.zoom-platform.com`
  const steamStore = `https://store.steampowered.com/`
  const wikiURL =
    'https://github.com/alazter/HeroicGamesLauncher/wiki'
  const gogEmbedRegExp = new RegExp('https://embed.gog.com/on_login_success?')
  const gogLoginUrl =
    'https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient&response_type=code&layout=galaxy'
  const zoomLoginUrl =
    'https://www.zoom-platform.com/login?li=heroic&return_li_token=true'

  const trueAsStr = 'true' as unknown as boolean | undefined

  const urls: { [pathname: string]: string } = {
    '/store/epic': epicStore,
    '/store/gog': gogStore,
    '/store/amazon': amazonStore,
    '/store/zoom': zoomStore,
    '/store/steam': steamStore,
    '/wiki': wikiURL,
    '/loginEpic': epicLoginUrl,
    '/loginGOG': gogLoginUrl,
    '/loginweb/legendary': epicLoginUrl,
    '/loginweb/gog': gogLoginUrl,
    '/loginweb/nile': amazonLoginData ? amazonLoginData.url : '',
    '/loginweb/zoom': zoomLoginUrl
  }
  let startUrl = urls[pathname]

  if (store) {
    sessionStorage.setItem('last-store', store)
    const lastUrl = sessionStorage.getItem(`last-url-${store}`)
    if (lastUrl && validStoredUrl(lastUrl, store)) {
      startUrl = lastUrl
    }
  }

  if (pathname.match(/store-page/)) {
    const searchParams = new URLSearchParams(search)
    const queryParam = searchParams.get('store-url')
    if (queryParam) {
      startUrl = queryParam
    }
  }

  useEffect(() => {
    if (pathname !== '/loginweb/nile') return
    console.log('Loading amazon login data')

    setLoading({
      refresh: true,
      message: t('status.preparing_login', 'Preparing Login...')
    })
    amazon.getLoginData().then((data) => {
      setAmazonLoginData(data)
      setLoading({
        ...loading,
        refresh: false
      })
    })
  }, [pathname])

  const handleAmazonLogin = (code: string) => {
    if (!amazonLoginData) {
      console.error('Could not login to Amazon because login data is missing')
      return
    }

    setLoading({
      refresh: true,
      message: t('status.logging', 'Logging In...')
    })
    amazon
      .login({
        client_id: amazonLoginData.client_id,
        code: code,
        code_verifier: amazonLoginData.code_verifier,
        serial: amazonLoginData.serial
      })
      .then(() => {
        handleSuccessfulLogin()
      })
  }

  const handleSuccessfulLogin = () => {
    navigate('/login')
  }

  const [webviewPreloadPath, setWebviewPreloadPath] = useState('')
  useEffect(() => {
    const fetchWebviewPreloadPath = async () => {
      const path = await window.api.getWebviewPreloadPath()
      setWebviewPreloadPath(path)
    }

    void fetchWebviewPreloadPath()
  }, [])

  useLayoutEffect(() => {
    if (webview) {
      const loadstop = () => {
        setLoading({ ...loading, refresh: false })
        if (isUsingGamepad()) {
          toggleWebviewFocus(true)
          webview.send('heroic-webview', { type: 'enter' })
        }
        // Ignore the login handling if not on login page
        if (!runner) {
          return
        } else if (runner === 'gog') {
          const pageUrl = webview.getURL()
          if (pageUrl.match(gogEmbedRegExp)) {
            const parsedURL = new URL(pageUrl)
            const code = parsedURL.searchParams.get('code')
            if (code) {
              setLoading({
                refresh: true,
                message: t('status.logging', 'Logging In...')
              })
              gog.login(code).then(() => handleSuccessfulLogin())
            }
          }
        } else if (runner === 'nile') {
          const pageURL = webview.getURL()
          const parsedURL = new URL(pageURL)
          const code = parsedURL.searchParams.get(
            'openid.oa2.authorization_code'
          )
          if (code) {
            handleAmazonLogin(code)
          }
        } else if (runner == 'legendary') {
          const pageUrl = webview.getURL()
          const parsedUrl = new URL(pageUrl)
          let code = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('sid')

          if (!code && parsedUrl.hash) {
            const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''))
            code = hashParams.get('code') || hashParams.get('sid')
          }

          if (code) {
            setLoading({
              refresh: true,
              message: t('status.logging', 'Logging In...')
            })
            epic.login(code).then(() => handleSuccessfulLogin())
            return
          }

          webview
            .executeJavaScript('document.body.innerText')
            .then((text: string) => {
              if (text && text.includes('authorizationCode')) {
                try {
                  const data = JSON.parse(text)
                  const extractedCode =
                    data.authorizationCode ||
                    data.sid ||
                    (data.redirectUrl
                      ? new URL(data.redirectUrl).searchParams.get('code')
                      : null)
                  if (extractedCode) {
                    setLoading({
                      refresh: true,
                      message: t('status.logging', 'Logging In...')
                    })
                    epic.login(extractedCode).then(() => handleSuccessfulLogin())
                  }
                } catch {
                  // Not valid JSON
                }
              }
            })
            .catch(() => {})
        }
      }

      const onerror = ({ validatedURL }: Electron.DidFailLoadEvent) => {
        if (validatedURL && validatedURL.match(/track\.adtraction\.com/)) {
          const parsedUrl = new URL(validatedURL)
          const redirectUrl = parsedUrl.searchParams.get('url')
          const url = new URL(redirectUrl || 'https://gog.com')
          // Remove any port definitions
          // Recently GOG made a change where they started to provide a port
          // in a URL that adtraction is supposed to redirect to.
          // This leads to urls like https://gog.com:80
          // That address is unreachable
          //
          // Add a entry below if you notice this line of code and cringe
          // - username - DD/MM/YY
          // - imLinguin - 01/07/24
          url.port = ''
          webview.loadURL(url.toString())
          if (!localStorage.getItem('adtraction-warning')) {
            setShowAdtractionWarning(true)
          }
        }
      }

      webview.addEventListener('dom-ready', loadstop)
      webview.addEventListener('did-fail-load', onerror)
      // if the page title changed it's because the store loaded so there's
      // connectivity, we can update the status without waiting for the checks
      const updateConnectivity = () => {
        if (connectivity.status !== 'online') {
          window.api.setConnectivityOnline()
        }
      }
      webview.addEventListener('page-title-updated', updateConnectivity)

      return () => {
        webview.removeEventListener('dom-ready', loadstop)
        webview.removeEventListener('did-fail-load', onerror)
        webview.removeEventListener('page-title-updated', updateConnectivity)
      }
    }
    return
  }, [webview, amazonLoginData, runner, webviewPreloadPath])

  useEffect(() => {
    if (webview) {
      const onNavigate = () => {
        if (store) {
          const url = webview.getURL()
          if (validStoredUrl(url, store)) {
            sessionStorage.setItem(`last-url-${store}`, webview.getURL())
          }
        }
      }

      const onLoginNavigate = () => {
        if (runner === 'zoom') {
          const pageURL = webview.getURL()
          const parsedURL = new URL(pageURL)
          const token = parsedURL.searchParams.get('li_token')
          if (token) {
            setLoading({
              refresh: true,
              message: t('status.logging', 'Logging In...')
            })
            zoom.login(pageURL).then(() => handleSuccessfulLogin())
          }
        }
      }

      // this one is needed for gog/amazon
      webview.addEventListener('did-navigate', onNavigate)
      // this one is needed for epic
      webview.addEventListener('did-navigate-in-page', onNavigate)
      webview.addEventListener('did-navigate', onLoginNavigate)

      return () => {
        webview.removeEventListener('did-navigate', onNavigate)
        webview.removeEventListener('did-navigate-in-page', onNavigate)
        webview.removeEventListener('did-navigate', onLoginNavigate)
      }
    }

    return
  }, [webview, store, runner])

  const [showLoginWarningFor, setShowLoginWarningFor] = useState<
    null | 'epic' | 'gog' | 'amazon' | 'zoom'
  >(null)

  const [showAdtractionWarning, setShowAdtractionWarning] =
    useState<boolean>(false)

  const [dontShowAdtractionWarning, setDontShowAdtractionWarning] =
    useState<boolean>(false)

  useEffect(() => {
    const checkWarning = (targetStore: 'epic' | 'gog' | 'amazon' | 'zoom') => {
      if (localStorage.getItem(`ghost_dont_show_login_warning_${targetStore}`) === 'true') {
        return null
      }
      return targetStore
    }

    const isEpicLoggedIn = !!epic.username
    const isGogLoggedIn = !!gog.username
    const isAmazonLoggedIn = !!(amazon.username || amazon.user_id)
    const isZoomLoggedIn = !!zoom.username

    if (
      (store === 'epic' || (startUrl.match(/epicgames\.com/) && startUrl.indexOf('/id/login') < 0)) &&
      !isEpicLoggedIn
    ) {
      setShowLoginWarningFor(checkWarning('epic'))
    } else if (
      (store === 'gog' || (startUrl.match(/gog\.com/) && !startUrl.match(/auth\.gog\.com/))) &&
      !isGogLoggedIn
    ) {
      setShowLoginWarningFor(checkWarning('gog'))
    } else if (
      (store === 'amazon' || startUrl.match(/gaming\.amazon\.com/) || startUrl.match(/amazon/)) &&
      !isAmazonLoggedIn
    ) {
      setShowLoginWarningFor(checkWarning('amazon'))
    } else if (
      (store === 'zoom' || startUrl.match(/zoom-platform\.com/)) &&
      !isZoomLoggedIn
    ) {
      setShowLoginWarningFor(checkWarning('zoom'))
    } else {
      setShowLoginWarningFor(null)
    }
  }, [startUrl, store, epic.username, gog.username, amazon.username, amazon.user_id, zoom.username])

  const onLoginWarningClosed = () => {
    setShowLoginWarningFor(null)
  }

  // Register the webview as the gamepad input target while it's mounted so the
  // host's gamepad handler can forward processed inputs to the guest preload
  // (`src/webviewPreload/index.ts`) and trigger host-side actions: focus the
  // webview (arm forwarding), exit back to the sidebar, or focus the URL bar.
  // Arming is explicit (loadstop / first gamepad press); we only listen for
  // `blur` as a best-effort disarm when focus leaves the webview.
  useEffect(() => {
    if (!webview) return

    const onBlur = () => toggleWebviewFocus(false)
    webview.addEventListener('blur', onBlur)

    const focusUrlBar = () => {
      // Exit "webview drives gamepad" mode so the host handles input while
      // the user is in the URL bar.
      toggleWebviewFocus(false)
      const urlInput = document.querySelector<HTMLInputElement>(
        '.WebviewControls__urlInput'
      )
      urlInput?.focus()
      urlInput?.select()
    }

    setWebviewInputTarget({
      send: (cmd) => webview.send('heroic-webview', cmd),
      exit: () => {
        // B leaves the webview: disarm, clear the guest cursor, and drop the
        // user back on the sidebar "Stores" item so they can keep navigating
        // with the controller.
        toggleWebviewFocus(false)
        webview.send('heroic-webview', { type: 'exit' })
        const storesItem = document.querySelector<HTMLElement>(
          '[data-tour="sidebar-stores"]'
        )
        if (storesItem) storesItem.focus()
        else document.body.focus()
      },
      focusUrlBar
    })

    return () => {
      webview.removeEventListener('blur', onBlur)
      setWebviewInputTarget(null)
      toggleWebviewFocus(false)
    }
  }, [webview])

  // Handle back/forward mouse buttons to navigate inside webview
  useEffect(() => {
    if (!webview) return

    const handleMouseBackForward = (ev: MouseEvent) => {
      // 3 and 4 are the typical `button` value for mouse back/forward buttons on mouseup events
      switch (ev.button) {
        case 3:
          if (webview.canGoBack()) {
            ev.preventDefault()
            webview.goBack()
          }
          break
        case 4:
          if (webview.canGoForward()) {
            ev.preventDefault()
            webview.goForward()
          }
          break
      }
    }

    document.addEventListener('mouseup', handleMouseBackForward)

    return () => {
      document.removeEventListener('mouseup', handleMouseBackForward)
    }
  }, [webview])

  if (!webviewPreloadPath) {
    return <></>
  }

  return (
    <div className="WebView">
      {webview && (
        <WebviewControls
          key={`controls-${store}`}
          webview={webview}
          initURL={startUrl}
          openInBrowser={!startUrl.startsWith('login')}
        />
      )}
      {loading.refresh && <UpdateComponent message={loading.message} />}
      <webview
        key={store || pathname}
        ref={webviewRef}
        className="WebView__webview"
        partition={`persist:${
          store === 'epic' || startUrl === epicLoginUrl
            ? 'epicstore'
            : store === 'gog' || startUrl === gogLoginUrl
            ? 'gogstore'
            : store === 'amazon'
            ? 'amazonstore'
            : store === 'steam'
            ? 'steamstore'
            : store || 'store'
        }`}
        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        src={startUrl}
        allowpopups={trueAsStr}
        preload={webviewPreloadPath}
      />
      {showLoginWarningFor && (
        <LoginWarning
          warnLoginForStore={showLoginWarningFor}
          onClose={onLoginWarningClosed}
        />
      )}
      {showAdtractionWarning && (
        <Dialog
          showCloseButton={true}
          onClose={() => {
            setShowAdtractionWarning(false)
            if (dontShowAdtractionWarning)
              localStorage.setItem('adtraction-warning', 'true')
          }}
        >
          <DialogHeader
            onClose={() => {
              setShowAdtractionWarning(false)
              if (dontShowAdtractionWarning)
                localStorage.setItem('adtraction-warning', 'true')
            }}
          >
            {t('adtraction-locked.title', 'Adtraction is blocked')}
          </DialogHeader>
          <DialogContent>
            <p>
              {t(
                'adtraction-locked.description',
                'It seems the track.adtraction.com domain was unable to load or is blocked. With adtraction, any purchase you make in the GOG store supports Heroic financially. Consider removing the block if you wish to contribute.'
              )}
            </p>
            <ToggleSwitch
              htmlId="dont-show-adtraction-warning-checkbox"
              value={dontShowAdtractionWarning}
              handleChange={(e) =>
                setDontShowAdtractionWarning(e.target.checked)
              }
              title={t(
                'adtraction-locked.dont-show-again',
                "Don't show this warning again"
              )}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
