import './index.css'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DMQueueElement, DownloadManagerState, GameInfo } from 'common/types'
import { UpdateComponent } from 'frontend/components/UI'
import ProgressHeader from './components/ProgressHeader'
import { downloadManagerStore } from 'frontend/helpers/electronStores'
import { DMQueue } from 'frontend/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faSyncAlt } from '@fortawesome/free-solid-svg-icons'
import DownloadManagerItem from './components/DownloadManagerItem'
import DownloadManagerSteamGridDB from './components/DownloadManagerSteamGridDB'
import { hasHelp } from 'frontend/hooks/hasHelp'

export default React.memo(function DownloadManager(): JSX.Element | null {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)
  const [state, setState] = useState<DownloadManagerState>('idle')
  const [plannendElements, setPlannendElements] = useState<DMQueueElement[]>([])
  const [currentElement, setCurrentElement] = useState<DMQueueElement>()
  const [finishedElem, setFinishedElem] = useState<DMQueueElement[]>()
  const [autoUpdateGames, setAutoUpdateGames] = useState<boolean>(false)
  const [sgdbGame, setSgdbGame] = useState<GameInfo | null>(null)

  useEffect(() => {
    window.api.requestAppSettings().then((settings) => {
      if (settings?.autoUpdateGames !== undefined) {
        setAutoUpdateGames(Boolean(settings.autoUpdateGames))
      }
    })
  }, [])

  const handleToggleAutoUpdate = async () => {
    const nextVal = !autoUpdateGames
    setAutoUpdateGames(nextVal)
    window.api.setSetting({
      appName: 'default',
      key: 'autoUpdateGames',
      value: nextVal
    })
    if (nextVal) {
      try {
        await window.api.checkGameUpdates()
      } catch (err) {
        console.error('Error checking updates on auto-update toggle:', err)
      }
    } else {
      window.api.clearAutoUpdates()
    }
  }

  hasHelp(
    'downloadManager',
    t('help.title.downloadManager', 'Download Manager'),
    <p>
      {t('help.content.downloadManager', 'Shows current and past downloads.')}
    </p>
  )

  useEffect(() => {
    setRefreshing(true)
    const updateQueue = () => {
      window.api.getDMQueueInformation().then(({ elements, state, finished }: DMQueue) => {
        if (elements) {
          setCurrentElement(elements[0])
          setPlannendElements([...elements.slice(1)])
          setState(state)
        }
        if (finished) {
          setFinishedElem(finished)
        }
        setRefreshing(false)
      })
    }

    updateQueue()

    const removeHandleDMQueueInformation = window.api.handleDMQueueInformation(
      (
        e: Electron.IpcRendererEvent,
        elements: DMQueueElement[],
        state: DownloadManagerState,
        finished?: DMQueueElement[]
      ) => {
        if (elements) {
          setCurrentElement(elements[0])
          setPlannendElements([...elements.slice(1)])
          setState(state)
        }
        if (finished) {
          setFinishedElem(finished)
        }
      }
    )

    const pollTimer = setInterval(updateQueue, 2000)

    return () => {
      removeHandleDMQueueInformation()
      clearInterval(pollTimer)
    }
  }, [])

  const queueCards = React.useMemo(() => {
    const seen = new Set<string>()
    if (currentElement?.params.appName) {
      seen.add(currentElement.params.appName)
    }
    return plannendElements.filter((el) => {
      const id = el?.params?.appName
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [plannendElements, currentElement?.params.appName])

  useEffect(() => {
    window.api.getDMQueueInformation().then(({ finished }: DMQueue) => {
      setFinishedElem(finished)
    })
  }, [queueCards.length, currentElement?.params.appName])

  if (refreshing) {
    return <UpdateComponent />
  }

  const handleClearList = () => {
    setFinishedElem([])
    downloadManagerStore.set('finished', [])
  }

  const handleClearItem = (appName: string) => {
    const filteredFinishedElem = finishedElem?.filter(
      (e) => e.params.appName !== appName
    )
    setFinishedElem(filteredFinishedElem)
    downloadManagerStore.set(
      'finished',
      filteredFinishedElem ? filteredFinishedElem : []
    )
  }

  const doneElements =
    (finishedElem?.length &&
      [...finishedElem].sort((a, b) => {
        // Sort by endTime
        return (b.endTime || 0) - (a.endTime || 0)
      })) ||
    []

  const finishedTitle =
    doneElements.length === 1
      ? t('queue.label.finished_single', 'CONCLUÍDO')
      : t('queue.label.finished_plural', 'CONCLUÍDOS')

  if (sgdbGame) {
    return (
      <DownloadManagerSteamGridDB
        game={sgdbGame}
        onBack={() => setSgdbGame(null)}
      />
    )
  }

  return (
    <div className="downloadManagerPage">
      <div className="downloadManagerTopBar">
        <h4 className="downloadManagerTitle">
          {t('download-manager.title', 'Downloads')}
        </h4>
        <div className="downloadManagerAutoUpdateWrapper">
          <span className="downloadManagerAutoUpdateText">
            {t(
              'download-manager.auto-update',
              'Atualizações automáticas'
            )}
          </span>
          <label
            className="premium-switch"
            title={t('setting.autoUpdateGames', 'Automatically update games')}
          >
            <input
              id="autoUpdateGamesToggle"
              type="checkbox"
              checked={autoUpdateGames}
              onChange={handleToggleAutoUpdate}
            />
            <span className="premium-slider" />
          </label>
        </div>
      </div>

      <ProgressHeader
        state={state}
        appName={currentElement?.params?.appName ?? ''}
        runner={currentElement?.params?.runner ?? 'legendary'}
      />

      <div className="downloadManagerSplitGrid">
        {/* Coluna Esquerda: Baixando Agora */}
        <div className="downloadManagerColumn">
          <div className="downloadManagerSectionHeader">
            <h5 className="downloadManagerSectionTitle">
              {t('queue.label.downloading_now', 'BAIXANDO AGORA')} ({currentElement ? 1 : 0})
            </h5>
          </div>
          <div className="downloadManagerActiveWrapper">
            {currentElement ? (
              <DownloadManagerItem
                element={currentElement}
                current={true}
                state={state}
                onOpenCoverPicker={(game) => setSgdbGame(game)}
              />
            ) : (
              <DownloadManagerItem current={true} />
            )}
          </div>
        </div>

        {/* Coluna Direita: Na Fila */}
        <div className="downloadManagerColumn">
          <div className="downloadManagerSectionHeader">
            <h5 className="downloadManagerSectionTitle">
              {t('queue.label.queued', 'NA FILA')} ({queueCards.length})
            </h5>
          </div>
          <div className="downloadManagerQueueList">
            {queueCards.length > 0 ? (
              queueCards.map((el) => (
                <DownloadManagerItem
                  key={el.params.appName}
                  element={el}
                  current={false}
                  onOpenCoverPicker={(game) => setSgdbGame(game)}
                />
              ))
            ) : (
              <DownloadManagerItem current={false} />
            )}
          </div>
        </div>
      </div>

      {!!doneElements?.length && (
        <div className="downloadManagerFinishedSection">
          <div className="downloadManagerSectionHeader">
            <h5 className="downloadManagerSectionTitle">
              {finishedTitle} ({doneElements.length})
            </h5>
            <button
              type="button"
              className="downloadManagerClearButton"
              onClick={() => handleClearList()}
              title={t('queue.label.clear', 'Limpar Histórico')}
            >
              <span>{t('queue.label.clear', 'Limpar Histórico')}</span>
            </button>
          </div>
          <div className="downloadManagerFinishedGrid">
            {doneElements.map((el, key) => (
              <DownloadManagerItem
                key={`${el.params.appName}-${key}`}
                element={el}
                current={false}
                handleClearItem={handleClearItem}
                onOpenCoverPicker={(game) => setSgdbGame(game)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
