import { useState } from 'react'
import './index.scss'
import {
  Dialog,
  DialogContent,
  DialogHeader
} from 'frontend/components/UI/Dialog'
import { ToggleSwitch } from 'frontend/components/UI'
import { useTranslation } from 'react-i18next'
import {
  amazonLoginPath,
  epicLoginPath,
  gogLoginPath,
  zoomLoginPath
} from '../..'
import { NavLink } from 'react-router-dom'

interface LoginWarningProps {
  warnLoginForStore: null | 'epic' | 'gog' | 'amazon' | 'zoom'
  onClose: () => void
}

const LoginWarning = function ({
  warnLoginForStore,
  onClose
}: LoginWarningProps) {
  const { t } = useTranslation('gamepage')
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!warnLoginForStore) {
    return null
  }

  const handleClose = () => {
    if (dontShowAgain && warnLoginForStore) {
      localStorage.setItem(`ghost_dont_show_login_warning_${warnLoginForStore}`, 'true')
    }
    onClose()
  }

  let textContent = ''
  let loginPath = ''
  if (warnLoginForStore === 'epic') {
    textContent = t(
      'not_logged_in.epic',
      "You are not logged in with an Epic account in Heroic. Don't use the store page to login, click the following button instead:"
    )
    loginPath = epicLoginPath
  } else if (warnLoginForStore === 'gog') {
    textContent = t(
      'not_logged_in.gog',
      "You are not logged in with a GOG account in Heroic. Don't use the store page to login, click the following button instead:"
    )
    loginPath = gogLoginPath
  } else if (warnLoginForStore === 'amazon') {
    textContent = t(
      'not_logged_in.amazon',
      "You are not logged in with an Amazon account in Heroic. Don't use the store page to login, click the following button instead:"
    )
    loginPath = amazonLoginPath
  } else if (warnLoginForStore === 'zoom') {
    textContent = t(
      'not_logged_in.zoom',
      "You are not logged in with a Zoom account in Heroic. Don't use the store page to login, click the following button instead:"
    )
    loginPath = zoomLoginPath
  }

  return (
    <Dialog onClose={handleClose} className="notLoggedIn GhostDialog" showCloseButton={true}>
      <DialogHeader onClose={handleClose}>
        {t('not_logged_in.title', 'Você NÃO está logado')}
      </DialogHeader>
      <DialogContent>
        <p>{textContent}</p>
        <div className="LoginWarning__dontShowAgain">
          <ToggleSwitch
            htmlId="dont-show-login-warning-checkbox"
            value={dontShowAgain}
            handleChange={(e) => {
              const val = e.target.checked
              setDontShowAgain(val)
              if (val && warnLoginForStore) {
                localStorage.setItem(`ghost_dont_show_login_warning_${warnLoginForStore}`, 'true')
              }
            }}
            title={t('not_logged_in.dont_show_again', 'Não mostrar este aviso novamente')}
          />
        </div>
        <NavLink className="button GhostButton" to={loginPath} onClick={handleClose}>
          <span>{t('not_logged_in.login', 'Fazer Login')}</span>
        </NavLink>
      </DialogContent>
    </Dialog>
  )
}

export default LoginWarning
