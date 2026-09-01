import './index.scss'
import React, { useContext, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader
} from 'frontend/components/UI/Dialog'
import { useTranslation } from 'react-i18next'
import { Runner } from 'common/types'
import ToggleSwitch from '../ToggleSwitch'
import { useNavigate, useLocation } from 'react-router-dom'
import ContextProvider from 'frontend/state/ContextProvider'

interface UninstallModalProps {
  appName: string
  runner: Runner
  onClose: () => void
  isDlc: boolean
}

const UninstallModal: React.FC<UninstallModalProps> = function ({
  appName,
  runner,
  onClose,
  isDlc
}) {
  const [isNative, setIsNative] = useState(true)
  const [isInstalled, setIsInstalled] = useState(true)
  const [winePrefix, setWinePrefix] = useState('')
  const [deletePrefixChecked, setDeletePrefixChecked] = useState(false)
  const [deleteSettingsChecked, setDeleteSettingsChecked] = useState(false)
  const [hideAfterUninstall, setHideAfterUninstall] = useState(false)
  const [disableDeleteWine, setDisableDeleteWine] = useState(false)
  const { t } = useTranslation('gamepage')
  const [showUninstallModal, setShowUninstallModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { installingEpicGame, libraryStatus, hiddenGames } = useContext(ContextProvider)
  const [gameTitle, setGameTitle] = useState('')

  const isGameRunning = libraryStatus.find(
    (st) =>
      st.appName === appName && st.runner === runner && st.status === 'playing'
  )

  const checkIfIsNative = async () => {
    setShowUninstallModal(true)

    const gameInfo = await window.api.getGameInfo(appName, runner)

    const isNative = await window.api.isNative({
      runner,
      appName
    })
    setIsNative(isNative)

    if (isDlc) {
      return
    }

    if (!gameInfo) {
      return
    }

    setGameTitle(gameInfo.overrides?.title || gameInfo.title)
    setIsInstalled(Boolean(gameInfo.is_installed))

    const { install } = gameInfo
    if (install?.platform?.toLowerCase() !== 'windows') {
      return
    }

    const gameSettings = await window.api.getGameSettings(appName, runner)
    if (!gameSettings) {
      return
    }

    const defaultSettings = await window.api.requestGameSettings('default')

    setWinePrefix(gameSettings.winePrefix)
    setDisableDeleteWine(gameSettings.winePrefix === defaultSettings.winePrefix)
  }

  useEffect(() => {
    checkIfIsNative()
  }, [])

  const storage: Storage = window.localStorage
  const uninstallGame = async () => {
    onClose()

    if (runner !== 'sideload') {
      // For any store game (Steam, Epic, GOG, Nile, Zoom), removing it hides it from the Ghost library
      hiddenGames.add(appName, gameTitle || appName)
      if (isInstalled) {
        await window.api.uninstall(
          appName,
          runner,
          deletePrefixChecked,
          deleteSettingsChecked
        )
      }
    } else {
      // Sideload / Manual game: removes from sideload database and deletes files if checked
      await window.api.uninstall(
        appName,
        runner,
        deletePrefixChecked,
        deleteSettingsChecked
      )
      if (location.pathname.match(/gamepage/)) {
        navigate('/#library')
      }
    }

    window.dispatchEvent(
      new CustomEvent('heroicSelectGameInline', { detail: { gameInfo: null } })
    )
    storage.removeItem(appName)
  }

  const showWineCheckbox = !isNative && !isDlc && isInstalled

  // disallow uninstalling epic games if an epic game is being installed
  if (installingEpicGame && runner === 'legendary') {
    return (
      <>
        {showUninstallModal && (
          <Dialog onClose={onClose} showCloseButton className="uninstall-modal">
            <DialogHeader onClose={onClose}>
              {t('button.remove_from_library', 'Remover da Biblioteca')}
            </DialogHeader>
            <DialogContent>
              {t(
                'gamepage:box.uninstall.cannotUninstallEpic',
                'Epic games cannot be uninstalled while another Epic game is being installed.'
              )}
            </DialogContent>
            <DialogFooter>
              <button onClick={onClose} className={`button outline`}>
                {t('box.close', 'Close')}
              </button>
            </DialogFooter>
          </Dialog>
        )}
      </>
    )
  }

  if (isGameRunning) {
    return (
      <>
        {showUninstallModal && (
          <Dialog onClose={onClose} showCloseButton className="uninstall-modal">
            <DialogHeader onClose={onClose}>
              {t('button.remove_from_library', 'Remover da Biblioteca')}
            </DialogHeader>
            <DialogContent>
              {t('gamepage:box.uninstall.gameIsRunning', {
                defaultValue:
                  '{{title}} is running. Close the game to uninstall it.',
                title: gameTitle
              })}
            </DialogContent>
            <DialogFooter>
              <button onClick={onClose} className={`button outline`}>
                {t('box.close', 'Close')}
              </button>
            </DialogFooter>
          </Dialog>
        )}
      </>
    )
  }

  return (
    <>
      {showUninstallModal && (
        <Dialog onClose={onClose} showCloseButton className="uninstall-modal">
          <DialogHeader onClose={onClose}>
            {t('button.remove_from_library', 'Remover da Biblioteca')}
          </DialogHeader>
          <DialogContent>
            <div className="uninstallModalMessage">
              {isDlc
                ? t('gamepage:box.uninstall.dlc', {
                    defaultValue: 'Do you want to uninstall "{{title}}" (DLC)?',
                    title: gameTitle
                  })
                : !isInstalled
                ? t('gamepage:box.remove.not_installed_message', {
                    defaultValue: 'Deseja remover "{{title}}" da sua biblioteca?',
                    title: gameTitle
                  })
                : runner === 'sideload'
                ? t('gamepage:box.remove.sideload_message', {
                    defaultValue: 'Deseja remover "{{title}}" da sua biblioteca?',
                    title: gameTitle
                  })
                : t('gamepage:box.uninstall.message_with_remove', {
                    defaultValue: 'Deseja remover "{{title}}" da biblioteca e desinstalar os arquivos locais?',
                    title: gameTitle
                  })}
            </div>
            {runner !== 'sideload' && (
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                {t(
                  'gamepage:box.remove.not_installed_hint',
                  'O jogo será removido da biblioteca. Você poderá restaurá-lo a qualquer momento ativando "Mostrar Jogos Ocultos" nos Filtros.'
                )}
              </p>
            )}
            {showWineCheckbox && (
              <ToggleSwitch
                htmlId="uninstallCheckbox"
                value={deletePrefixChecked}
                title={t('gamepage:box.uninstall.checkbox', {
                  defaultValue:
                    "Remove prefix: {{prefix}}{{newLine}}Note: This can't be undone and will also remove not backed up save files.",
                  prefix: winePrefix,
                  newLine: '\n'
                })}
                disabled={disableDeleteWine}
                handleChange={() => {
                  setDeletePrefixChecked(!deletePrefixChecked)
                }}
              />
            )}
            {disableDeleteWine && (
              <p className="default-wine-warning">
                {t(
                  'gamepage:box.uninstall.prefix_warning',
                  'The Wine prefix for this game is the default prefix. If you really want to delete it, you have to do it manually.'
                )}
              </p>
            )}
            {!isDlc && isInstalled && (
              <ToggleSwitch
                htmlId="uninstallsettingCheckbox"
                value={deleteSettingsChecked}
                title={t('gamepage:box.uninstall.settingcheckbox', {
                  defaultValue:
                    "Erase settings and remove log{{newLine}}Note: This can't be undone. Any modified settings will be forgotten and log will be deleted.",
                  newLine: '\n'
                })}
                handleChange={() => {
                  setDeleteSettingsChecked(!deleteSettingsChecked)
                }}
              />
            )}
          </DialogContent>
          <DialogFooter>
            <button
              onClick={uninstallGame}
              className={`button is-secondary outline`}
            >
              {t('button.remove', 'Remover')}
            </button>
            <button onClick={onClose} className={`button is-secondary outline`}>
              {t('box.cancel', 'Cancelar')}
            </button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  )
}

export default UninstallModal
