import './index.css'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DMQueueElement, DownloadManagerState, GameInfo } from 'common/types'
import { UpdateComponent } from 'frontend/components/UI'
import ProgressHeader from './components/ProgressHeader'
import { downloadManagerStore } from 'frontend/helpers/electronStores'
import { DMQueue } from 'frontend/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTrash,
  faSyncAlt,
  faChevronDown,
  faChevronRight,
  faChevronLeft,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons'
import DownloadManagerItem from './components/DownloadManagerItem'
import DownloadManagerSteamGridDB from './components/DownloadManagerSteamGridDB'
import ExternalActiveCard from './components/ExternalActiveCard'
import ExternalFinishedCard from './components/ExternalFinishedCard'
import ExternalQueueCard from './components/ExternalQueueCard'
import { useExternalGames } from 'frontend/screens/ExternalGames/shared'
import type { ExternalDownloadJob } from 'common/types/plugins'
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

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState<boolean>(
    () => {
      return localStorage.getItem('ghost_dm_completed_collapsed') === 'true'
    }
  )
  const [isOverflowQueueCollapsed, setIsOverflowQueueCollapsed] = useState<
    boolean
  >(() => {
    return localStorage.getItem('ghost_dm_overflow_queue_collapsed') === 'true'
  })

  const toggleCompletedCollapse = () => {
    setIsCompletedCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('ghost_dm_completed_collapsed', String(next))
      return next
    })
  }

  const toggleOverflowQueueCollapse = () => {
    setIsOverflowQueueCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('ghost_dm_overflow_queue_collapsed', String(next))
      return next
    })
  }

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
          if (state === 'idle') {
            setCurrentElement(undefined)
            setPlannendElements(elements)
          } else {
            setCurrentElement(elements[0] || undefined)
            setPlannendElements([...elements.slice(1)])
          }
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
          if (state === 'idle') {
            setCurrentElement(undefined)
            setPlannendElements(elements)
          } else {
            setCurrentElement(elements[0] || undefined)
            setPlannendElements([...elements.slice(1)])
          }
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

  const { state: externalState, refresh: refreshExternal } = useExternalGames()

  const activeExternalJob = React.useMemo(() => {
    const jobs = externalState.jobs
    if (!jobs.length) return undefined

    // 1. Actively downloading
    const downloading = jobs.find((j) => j.status === 'downloading')
    if (downloading) return downloading

    // 2. Extracting or Installing
    const working = jobs.find(
      (j) => j.status === 'extracting' || j.status === 'installing'
    )
    if (working) return working

    // 3. Ready (waiting for executable selection)
    const ready = jobs.find((j) => j.status === 'ready')
    if (ready) return ready

    // 4. Awaiting manual file import
    const awaiting = jobs.find((j) => j.status === 'awaiting-file')
    if (awaiting) return awaiting

    // 5. Paused
    const paused = jobs.find((j) => j.status === 'paused')
    if (paused) return paused

    // 6. Error requiring attention / retry (if no official download is running)
    const errJob = jobs.find((j) => j.status === 'error')
    if (errJob && !currentElement) return errJob

    return undefined
  }, [externalState.jobs, currentElement])

  const queuedExternalJobs = React.useMemo(() => {
    return externalState.jobs.filter(
      (j) => j.status === 'queued' && j.id !== activeExternalJob?.id
    )
  }, [externalState.jobs, activeExternalJob?.id])

  const completedExternalJobs = React.useMemo(() => {
    return externalState.jobs.filter((j) => j.status === 'completed')
  }, [externalState.jobs])

  const externalSpeedMB = activeExternalJob?.speed
    ? Math.round((activeExternalJob.speed / (1024 * 1024)) * 100) / 100
    : undefined

  const externalDiskSpeedMB = activeExternalJob
    ? activeExternalJob.status === 'extracting' || activeExternalJob.status === 'installing'
      ? 85
      : externalSpeedMB !== undefined
      ? Math.round(externalSpeedMB * 1.25 * 100) / 100
      : undefined
    : undefined

  const doneElements =
    (finishedElem?.length &&
      [...finishedElem].sort((a, b) => {
        // Sort by endTime
        return (b.endTime || 0) - (a.endTime || 0)
      })) ||
    []

  type UnifiedQueueItem =
    | { type: 'official'; id: string; el: DMQueueElement }
    | { type: 'external'; id: string; job: ExternalDownloadJob }

  type UnifiedFinishedItem =
    | { type: 'official'; id: string; el: DMQueueElement; timestamp: number }
    | { type: 'external'; id: string; job: ExternalDownloadJob; timestamp: number }

  const unifiedQueueItems: UnifiedQueueItem[] = React.useMemo(() => {
    const items: UnifiedQueueItem[] = []
    for (const el of queueCards) {
      items.push({
        type: 'official',
        id: `official-${el.params.appName}`,
        el
      })
    }
    for (const job of queuedExternalJobs) {
      items.push({
        type: 'external',
        id: `external-${job.id}`,
        job
      })
    }
    return items
  }, [queueCards, queuedExternalJobs])

  const isAdaptive4Quad = unifiedQueueItems.length > 3
  const topQueueItems = unifiedQueueItems.slice(0, 3)
  const overflowQueueItems = unifiedQueueItems.slice(3)

  const unifiedFinishedItems: UnifiedFinishedItem[] = React.useMemo(() => {
    const items: UnifiedFinishedItem[] = []
    for (const el of doneElements) {
      items.push({
        type: 'official',
        id: `official-${el.params.appName}`,
        el,
        timestamp: el.endTime || 0
      })
    }
    for (const job of completedExternalJobs) {
      items.push({
        type: 'external',
        id: `external-${job.id}`,
        job,
        timestamp: new Date(job.createdAt).getTime() || 0
      })
    }
    return items.sort((a, b) => b.timestamp - a.timestamp)
  }, [doneElements, completedExternalJobs])

  const finishedTitle =
    unifiedFinishedItems.length === 1
      ? t('queue.label.finished_single', 'CONCLUÍDO')
      : t('queue.label.finished_plural', 'CONCLUÍDOS')

  const hasActiveDownload = Boolean(activeExternalJob || currentElement)

  const handleClearAllFinished = async () => {
    handleClearList()
    for (const job of completedExternalJobs) {
      await window.api.externalGamesAction({ type: 'dismiss', jobId: job.id })
    }
    await refreshExternal()
  }

  const handleDismissExternalFinished = async (jobId: string) => {
    await window.api.externalGamesAction({ type: 'dismiss', jobId })
    await refreshExternal()
  }

  const handleCancelExternalQueue = async (jobId: string) => {
    await window.api.externalGamesAction({ type: 'cancel', jobId })
    await refreshExternal()
  }

  const renderActiveCard = () => {
    if (activeExternalJob) {
      return (
        <ExternalActiveCard
          job={activeExternalJob}
          onRefresh={refreshExternal}
        />
      )
    }
    if (currentElement) {
      return (
        <DownloadManagerItem
          element={currentElement}
          current={true}
          state={state}
          onOpenCoverPicker={(game) => setSgdbGame(game)}
        />
      )
    }
    return <DownloadManagerItem current={true} />
  }

  const renderQueueItem = (item: UnifiedQueueItem) => {
    if (item.type === 'official') {
      return (
        <DownloadManagerItem
          key={item.id}
          element={item.el}
          current={false}
          onOpenCoverPicker={(game) => setSgdbGame(game)}
        />
      )
    }
    return (
      <ExternalQueueCard
        key={item.id}
        job={item.job}
        onCancel={handleCancelExternalQueue}
      />
    )
  }

  const renderFinishedItem = (item: UnifiedFinishedItem) => {
    if (item.type === 'official') {
      return (
        <DownloadManagerItem
          key={item.id}
          element={item.el}
          current={false}
          handleClearItem={handleClearItem}
          onOpenCoverPicker={(game) => setSgdbGame(game)}
        />
      )
    }
    return (
      <ExternalFinishedCard
        key={item.id}
        job={item.job}
        installations={externalState.installations}
        onDismiss={handleDismissExternalFinished}
      />
    )
  }

  if (refreshing) {
    return <UpdateComponent />
  }

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
        state={
          activeExternalJob
            ? activeExternalJob.status === 'paused'
              ? 'paused'
              : 'running'
            : state
        }
        appName={
          activeExternalJob
            ? activeExternalJob.game.title
            : currentElement?.params?.appName ?? ''
        }
        runner={
          activeExternalJob
            ? 'sideload'
            : currentElement?.params?.runner ?? 'legendary'
        }
        overrideDownloadSpeed={externalSpeedMB}
        overrideDiskSpeed={externalDiskSpeedMB}
      />

      {isAdaptive4Quad ? (
        <div className="downloadManagerAdaptiveContainer">
          {/* Top Row: Fixo e Intocável */}
          <div className="downloadManagerSplitGrid dmTopFixedGrid">
            {/* Topo Esquerdo: Baixando Agora */}
            <div className="downloadManagerColumn">
              <div className="downloadManagerSectionHeader">
                <h5 className="downloadManagerSectionTitle">
                  {t('queue.label.downloading_now', 'BAIXANDO AGORA')} ({hasActiveDownload ? 1 : 0})
                </h5>
              </div>
              <div className="downloadManagerActiveWrapper">
                {renderActiveCard()}
              </div>
            </div>

            {/* Topo Direito: Primeiros 3 Jogos da Fila */}
            <div className="downloadManagerColumn">
              <div className="downloadManagerSectionHeader">
                <h5 className="downloadManagerSectionTitle">
                  {t('queue.label.queued', 'NA FILA')} (3/{unifiedQueueItems.length})
                </h5>
              </div>
              <div className="downloadManagerQueueList dmQueueTop3List">
                {topQueueItems.map(renderQueueItem)}
              </div>
            </div>
          </div>

          {/* Linha Inferior: Concluídos e Restante da Fila com Recolhimento e Troca de Área */}
          <div
            className={`downloadManagerBottomAdaptiveRow ${
              isCompletedCollapsed && isOverflowQueueCollapsed
                ? 'dmBothCollapsed'
                : isCompletedCollapsed
                ? 'dmCompletedCollapsed'
                : isOverflowQueueCollapsed
                ? 'dmOverflowCollapsed'
                : 'dmBothOpen'
            }`}
          >
            {/* Bloco Inferior Esquerdo: Concluídos */}
            <div className="dmBottomSection dmBottomCompletedCol">
              {isCompletedCollapsed ? (
                <button
                  type="button"
                  className="dmCollapsedTab"
                  onClick={toggleCompletedCollapse}
                  title={t('queue.label.expand_completed', 'Expandir Concluídos')}
                >
                  <FontAwesomeIcon icon={faChevronRight} className="dmTabIcon" />
                  <span className="dmTabLabel">{finishedTitle} ({unifiedFinishedItems.length})</span>
                  <span className="dmTabHint">{t('queue.label.click_to_expand', 'Clique para expandir')}</span>
                </button>
              ) : (
                <div className="dmBottomCardContainer">
                  <div className="downloadManagerSectionHeader">
                    <h5 className="downloadManagerSectionTitle">
                      {finishedTitle} ({unifiedFinishedItems.length})
                    </h5>
                    <div className="dmHeaderActions">
                      {!!unifiedFinishedItems.length && (
                        <button
                          type="button"
                          className="downloadManagerClearButton dmSmallClearBtn"
                          onClick={() => void handleClearAllFinished()}
                          title={t('queue.label.clear', 'Limpar Histórico')}
                        >
                          <span>{t('queue.label.clear', 'Limpar')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="dmCollapseHeaderBtn"
                        onClick={toggleCompletedCollapse}
                        title={t('queue.label.collapse', 'Recolher')}
                      >
                        <FontAwesomeIcon icon={faChevronDown} />
                        <span>Recolher</span>
                      </button>
                    </div>
                  </div>

                  {unifiedFinishedItems.length > 0 ? (
                    <div
                      className={`downloadManagerFinishedGrid ${
                        isOverflowQueueCollapsed ? 'dmGridFullWidth' : 'dmGridHalfWidth'
                      }`}
                    >
                      {unifiedFinishedItems.map(renderFinishedItem)}
                    </div>
                  ) : (
                    <div className="dmEmptyCompletedCard">
                      <div className="dmEmptyCompletedIcon">
                        <FontAwesomeIcon icon={faCheckCircle} />
                      </div>
                      <div className="dmEmptyCompletedText">
                        <span className="dmEmptyCompletedTitle">
                          {t('queue.empty.finished_title', 'Nenhum download concluído ainda')}
                        </span>
                        <span className="dmEmptyCompletedSub">
                          {t(
                            'queue.empty.finished_sub',
                            'Os jogos finalizados aparecerão aqui com acesso rápido para jogar.'
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bloco Inferior Direito: Restante da Fila (>3 cards) */}
            <div className="dmBottomSection dmBottomOverflowCol">
              {isOverflowQueueCollapsed ? (
                <button
                  type="button"
                  className="dmCollapsedTab"
                  onClick={toggleOverflowQueueCollapse}
                  title={t('queue.label.expand_queue', 'Expandir Restante da Fila')}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="dmTabIcon" />
                  <span className="dmTabLabel">
                    {t('queue.label.remaining_queue', 'RESTANTE DA FILA')} ({overflowQueueItems.length})
                  </span>
                  <span className="dmTabHint">{t('queue.label.click_to_expand', 'Clique para expandir')}</span>
                </button>
              ) : (
                <div className="downloadManagerColumn dmBottomCardContainer">
                  <div className="downloadManagerSectionHeader">
                    <h5 className="downloadManagerSectionTitle">
                      {t('queue.label.remaining_queue', 'RESTANTE DA FILA')} ({overflowQueueItems.length})
                    </h5>
                    <button
                      type="button"
                      className="dmCollapseHeaderBtn"
                      onClick={toggleOverflowQueueCollapse}
                      title={t('queue.label.collapse', 'Recolher')}
                    >
                      <FontAwesomeIcon icon={faChevronDown} />
                      <span>Recolher</span>
                    </button>
                  </div>
                  <div
                    className={`downloadManagerQueueList dmOverflowQueueList ${
                      isCompletedCollapsed ? 'dmGridFullWidth' : 'dmGridHalfWidth'
                    }`}
                  >
                    {overflowQueueItems.map(renderQueueItem)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Layout Clássico quando Fila <= 3 */
        <>
          <div className="downloadManagerSplitGrid">
            {/* Coluna Esquerda: Baixando Agora */}
            <div className="downloadManagerColumn">
              <div className="downloadManagerSectionHeader">
                <h5 className="downloadManagerSectionTitle">
                  {t('queue.label.downloading_now', 'BAIXANDO AGORA')} ({hasActiveDownload ? 1 : 0})
                </h5>
              </div>
              <div className="downloadManagerActiveWrapper">
                {renderActiveCard()}
              </div>
            </div>

            {/* Coluna Direita: Na Fila */}
            <div className="downloadManagerColumn">
              <div className="downloadManagerSectionHeader">
                <h5 className="downloadManagerSectionTitle">
                  {t('queue.label.queued', 'NA FILA')} ({unifiedQueueItems.length})
                </h5>
              </div>
              <div className="downloadManagerQueueList">
                {unifiedQueueItems.length > 0 ? (
                  unifiedQueueItems.map(renderQueueItem)
                ) : (
                  <DownloadManagerItem current={false} />
                )}
              </div>
            </div>
          </div>

          {!!unifiedFinishedItems?.length && (
            <div className="downloadManagerFinishedSection">
              <div className="downloadManagerSectionHeader">
                <h5 className="downloadManagerSectionTitle">
                  {finishedTitle} ({unifiedFinishedItems.length})
                </h5>
                <button
                  type="button"
                  className="downloadManagerClearButton"
                  onClick={() => void handleClearAllFinished()}
                  title={t('queue.label.clear', 'Limpar Histórico')}
                >
                  <span>{t('queue.label.clear', 'Limpar Histórico')}</span>
                </button>
              </div>
              <div className="downloadManagerFinishedGrid">
                {unifiedFinishedItems.map(renderFinishedItem)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
})

