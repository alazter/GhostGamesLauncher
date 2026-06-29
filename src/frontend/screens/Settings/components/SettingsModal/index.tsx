import { useMemo, useCallback, useEffect } from 'react'
import { GameInfo } from 'common/types'
import {
  Dialog,
  DialogContent,
  DialogHeader
} from 'frontend/components/UI/Dialog'
import { GamesSettings } from '../../sections'
import SettingsContext from '../../SettingsContext'
import useSettingsContext from 'frontend/hooks/useSettingsContext'
import LogSettings from '../../sections/LogSettings'
import './index.scss'
import { useTranslation } from 'react-i18next'
import { SettingsContextType } from 'frontend/types'
import CategorySettings from '../../sections/CategorySettings'
import useGlobalState from 'frontend/state/GlobalStateV2'

export type GameSettingsModalType = 'settings' | 'log' | 'category'

type Props = {
  gameInfo: GameInfo
  type: GameSettingsModalType
}

function SettingsModal({ gameInfo, type }: Props) {
  const { t } = useTranslation()
  const {
    closeSettingsModal,
    openGameSettingsModal,
    openGameLogsModal,
    openGameCategoriesModal
  } = useGlobalState.keys(
    'closeSettingsModal',
    'openGameSettingsModal',
    'openGameLogsModal',
    'openGameCategoriesModal'
  )

  const { app_name: appName, runner, title } = gameInfo

  // create setting context functions
  const contextValues: SettingsContextType | null = useSettingsContext({
    appName,
    gameInfo,
    runner
  })

  const gameList = useMemo(() => {
    return (window as any).heroicActiveLibrary || []
  }, [gameInfo])

  const currentIndex = useMemo(() => {
    if (!gameList.length) return -1
    return gameList.findIndex(
      (g: GameInfo) => g.app_name === appName && g.runner === runner
    )
  }, [gameList, appName, runner])

  const showNavArrows = gameList.length > 1 && currentIndex !== -1

  const handlePrevGame = useCallback(() => {
    if (!showNavArrows) return
    const prevIndex = (currentIndex - 1 + gameList.length) % gameList.length
    const targetGame = gameList[prevIndex]
    if (type === 'settings') {
      openGameSettingsModal(targetGame)
    } else if (type === 'log') {
      openGameLogsModal(targetGame)
    } else if (type === 'category') {
      openGameCategoriesModal(targetGame)
    }
  }, [showNavArrows, currentIndex, gameList, type, openGameSettingsModal, openGameLogsModal, openGameCategoriesModal])

  const handleNextGame = useCallback(() => {
    if (!showNavArrows) return
    const nextIndex = (currentIndex + 1) % gameList.length
    const targetGame = gameList[nextIndex]
    if (type === 'settings') {
      openGameSettingsModal(targetGame)
    } else if (type === 'log') {
      openGameLogsModal(targetGame)
    } else if (type === 'category') {
      openGameCategoriesModal(targetGame)
    }
  }, [showNavArrows, currentIndex, gameList, type, openGameSettingsModal, openGameLogsModal, openGameCategoriesModal])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return
      }

      if (e.key === 'ArrowLeft') {
        handlePrevGame()
      } else if (e.key === 'ArrowRight') {
        handleNextGame()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevGame, handleNextGame])

  const titleType = useMemo(() => {
    const titleTypeLiterals = {
      settings: t('Settings', 'Settings'),
      log: t('settings.navbar.log', 'Log'),
      category: 'Categories'
    }

    return titleTypeLiterals[type]
  }, [type])

  if (!contextValues) {
    return null
  }

  return (
    <Dialog
      onClose={() => closeSettingsModal()}
      showCloseButton
      className={'InstallModal__dialog'}
    >
      <DialogHeader onClose={() => closeSettingsModal()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>{`${title} (${titleType})`}</span>
          {showNavArrows && (
            <div className="settings-nav-arrows" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginRight: '40px' }}>
              <button
                onClick={handlePrevGame}
                title="Jogo Anterior"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                &lt;
              </button>
              <button
                onClick={handleNextGame}
                title="Próximo Jogo"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </DialogHeader>
      <DialogContent className="settingsDialogContent">
        <SettingsContext.Provider value={contextValues}>
          {type === 'settings' && <GamesSettings />}
          {type === 'log' && <LogSettings />}
          {type === 'category' && <CategorySettings />}
        </SettingsContext.Provider>
      </DialogContent>
    </Dialog>
  )
}

export function SettingsModalWrapper() {
  const { settingsModalProps } = useGlobalState.keys('settingsModalProps')

  if (!settingsModalProps.isOpen) {
    return <></>
  }

  return <SettingsModal {...settingsModalProps} />
}
