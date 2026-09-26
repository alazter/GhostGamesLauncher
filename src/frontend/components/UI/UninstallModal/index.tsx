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
import { useRemovingGamesStore } from 'frontend/state/removingGamesStore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShieldAlt, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { archiveGameData, removeArchivedGameData } from 'frontend/helpers/archivedGameData'
import { gameOverridesStore, sideloadLibrary, configStore } from 'frontend/helpers/electronStores'
import { notify } from 'frontend/helpers'

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
  const [keepDataSelected, setKeepDataSelected] = useState(true)
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

  const handleRemoveSideload = async (keepData: boolean) => {
    onClose()
    useRemovingGamesStore.getState().startRemoval(appName, 'removing')
    try {
      const gameInfo = await window.api.getGameInfo(appName, 'sideload')
      if (keepData && gameInfo) {
        const curOverrides = gameOverridesStore.get('overrides', {})[appName]
        archiveGameData(gameInfo, curOverrides, gameInfo.install?.install_path)
      } else {
        removeArchivedGameData(appName, gameTitle)
        const overrides = gameOverridesStore.get('overrides', {})
        delete overrides[appName]
        gameOverridesStore.set('overrides', overrides)
      }

      // Remove the game from sideloadLibrary
      const current = sideloadLibrary.get('games', [])
      const filtered = current.filter((g) => g.app_name !== appName)
      sideloadLibrary.set('games', filtered)

      // Sync backend
      await window.api.uninstall(appName, 'sideload', false, !keepData)

      if (location.pathname.match(/gamepage/)) {
        navigate('/#library')
      }

      ;(configStore as any).set('backup.lastModified', Date.now())
      window.dispatchEvent(new Event('backupStateChanged'))
      window.dispatchEvent(new Event('refreshLibrary'))
      window.dispatchEvent(
        new CustomEvent('heroicSelectGameInline', { detail: { gameInfo: null } })
      )
      storage.removeItem(appName)

      notify({
        title: keepData ? 'Jogo Removido (Dados Salvos)' : 'Jogo Removido',
        body: keepData
          ? 'O card foi removido da biblioteca. Suas capas e dados foram salvos para restauração automática.'
          : 'O jogo e todos os seus dados foram removidos da biblioteca.'
      })
    } catch (err: any) {
      notify({
        title: 'Erro ao Remover',
        body: err?.message || 'Falha ao remover o jogo da biblioteca.'
      })
    } finally {
      setTimeout(() => {
        useRemovingGamesStore.getState().finishRemoval(appName)
      }, 500)
    }
  }

  const storage: Storage = window.localStorage
  const uninstallGame = async () => {
    if (runner === 'sideload') {
      await handleRemoveSideload(keepDataSelected)
      return
    }
    onClose()
    useRemovingGamesStore.getState().startRemoval(appName, 'removing')

    try {
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

      window.dispatchEvent(
        new CustomEvent('heroicSelectGameInline', { detail: { gameInfo: null } })
      )
      storage.removeItem(appName)
    } finally {
      setTimeout(() => {
        useRemovingGamesStore.getState().finishRemoval(appName)
      }, 500)
    }
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
            {runner === 'sideload' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="uninstallModalMessage" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                  Deseja remover <strong>{gameTitle}</strong> da sua biblioteca?
                </div>

                {/* Opção 1: Manter Saves e Dados (Recomendado) */}
                <div
                  onClick={() => setKeepDataSelected(true)}
                  style={{
                    background: keepDataSelected ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: keepDataSelected ? '1px solid #00ffff' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    boxShadow: keepDataSelected ? '0 0 15px rgba(0, 255, 255, 0.2)' : 'none'
                  }}
                >
                  <input
                    type="radio"
                    name="removeSideloadOption"
                    checked={keepDataSelected}
                    onChange={() => setKeepDataSelected(true)}
                    style={{ marginTop: '3px', accentColor: '#00ffff' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#00ffff' }} />
                      <strong style={{ color: '#fff', fontSize: '13px' }}>Manter Saves e Dados (Recomendado)</strong>
                      <span style={{ fontSize: '10px', background: 'rgba(0, 255, 255, 0.2)', color: '#00ffff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>Recomendado</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                      Remove apenas a capa da biblioteca. Suas capas personalizadas, capa original, títulos e saves serão guardados em segurança. Ao adicionar o jogo novamente, todos os dados serão restaurados automaticamente!
                    </p>
                  </div>
                </div>

                {/* Opção 2: Apagar Todos os Dados */}
                <div
                  onClick={() => setKeepDataSelected(false)}
                  style={{
                    background: !keepDataSelected ? 'rgba(255, 82, 82, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: !keepDataSelected ? '1px solid #ff5252' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    boxShadow: !keepDataSelected ? '0 0 15px rgba(255, 82, 82, 0.2)' : 'none'
                  }}
                >
                  <input
                    type="radio"
                    name="removeSideloadOption"
                    checked={!keepDataSelected}
                    onChange={() => setKeepDataSelected(false)}
                    style={{ marginTop: '3px', accentColor: '#ff5252' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FontAwesomeIcon icon={faTrashAlt} style={{ color: '#ff5252' }} />
                      <strong style={{ color: '#fff', fontSize: '13px' }}>Remover e Apagar Todos os Dados</strong>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                      Remove a capa e exclui definitivamente todas as personalizações, capas e dados vinculados ao jogo no Ghost.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
                    : t('gamepage:box.uninstall.message_with_remove', {
                        defaultValue: 'Deseja remover "{{title}}" da biblioteca e desinstalar os arquivos locais?',
                        title: gameTitle
                      })}
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                  {t(
                    'gamepage:box.remove.not_installed_hint',
                    'O jogo será removido da biblioteca. Você poderá restaurá-lo a qualquer momento ativando "Mostrar Jogos Ocultos" nos Filtros.'
                  )}
                </p>
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
              </>
            )}
          </DialogContent>
          <DialogFooter>
            {runner === 'sideload' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {keepDataSelected ? (
                  <button
                    onClick={() => handleRemoveSideload(true)}
                    style={{
                      background: 'rgba(0, 255, 255, 0.15)',
                      border: '1px solid #00ffff',
                      color: '#fff',
                      padding: '9px 18px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 0 14px rgba(0, 255, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px'
                    }}
                  >
                    <FontAwesomeIcon icon={faShieldAlt} />
                    <span>Remover e Manter Dados</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRemoveSideload(false)}
                    style={{
                      background: '#ff5252',
                      border: '1px solid #ff7373',
                      color: '#fff',
                      padding: '9px 18px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 0 14px rgba(255, 82, 82, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px'
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashAlt} />
                    <span>Remover e Apagar Tudo</span>
                  </button>
                )}
                <button onClick={onClose} className={`button is-secondary outline`}>
                  {t('box.cancel', 'Cancelar')}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={uninstallGame}
                  className={`button is-secondary outline`}
                >
                  {t('button.remove', 'Remover')}
                </button>
                <button onClick={onClose} className={`button is-secondary outline`}>
                  {t('box.cancel', 'Cancelar')}
                </button>
              </>
            )}
          </DialogFooter>
        </Dialog>
      )}
    </>
  )
}

export default UninstallModal
