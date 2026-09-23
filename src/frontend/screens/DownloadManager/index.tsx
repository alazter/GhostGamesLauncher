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

  const activeExternalJobs = React.useMemo(() => {
    return externalState.jobs.filter((j) => {
      if (
        [
          'downloading',
          'extracting',
          'installing',
          'ready',
          'awaiting-file',
          'paused',
          'error'
        ].includes(j.status)
      ) {
        return true
      }
      if (j.status === 'cancelled' && j.oldRemoved) {
        return true
      }
      return false
    })
  }, [externalState.jobs])

  const activeExternalJobIds = React.useMemo(() => {
    return new Set(activeExternalJobs.map((j) => j.id))
  }, [activeExternalJobs])

  const queuedExternalJobs = React.useMemo(() => {
    return externalState.jobs.filter(
      (j) => j.status === 'queued' && !activeExternalJobIds.has(j.id)
    )
  }, [externalState.jobs, activeExternalJobIds])

  const completedExternalJobs = React.useMemo(() => {
    return externalState.jobs.filter((j) => j.status === 'completed')
  }, [externalState.jobs])

  const primaryActiveExternal =
    activeExternalJobs.find((j) => j.status === 'downloading') ||
    activeExternalJobs.find(
      (j) => j.status === 'extracting' || j.status === 'installing'
    ) ||
    activeExternalJobs[0]

  const totalExternalSpeed = activeExternalJobs.reduce(
    (acc, j) => acc + (j.speed || 0),
    0
  )
  const externalSpeedMB =
    totalExternalSpeed > 0
      ? Math.round((totalExternalSpeed / (1024 * 1024)) * 100) / 100
      : activeExternalJobs.some((j) => j.status === 'downloading')
      ? 0.01
      : undefined

  const hasExtractingOrInstalling = activeExternalJobs.some(
    (j) => j.status === 'extracting' || j.status === 'installing'
  )

  const externalDiskSpeedMB = hasExtractingOrInstalling
    ? 85
    : externalSpeedMB !== undefined
    ? Math.round(externalSpeedMB * 1.25 * 100) / 100
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

  type UnifiedActiveItem =
    | { type: 'official'; id: string; el: DMQueueElement }
    | { type: 'external'; id: string; job: ExternalDownloadJob }

  const unifiedActiveItems: UnifiedActiveItem[] = React.useMemo(() => {
    const items: UnifiedActiveItem[] = []

    if (currentElement) {
      items.push({
        type: 'official',
        id: `official-${currentElement.params.appName}`,
        el: currentElement
      })
    }

    const statusPriority: Record<string, number> = {
      downloading: 1,
      extracting: 2,
      installing: 2,
      ready: 3,
      'awaiting-file': 4,
      paused: 5,
      error: 6,
      cancelled: 7
    }

    const sortedJobs = [...activeExternalJobs].sort((a, b) => {
      const pA = statusPriority[a.status] || 99
      const pB = statusPriority[b.status] || 99
      if (pA !== pB) return pA - pB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    for (const job of sortedJobs) {
      items.push({
        type: 'external',
        id: `external-${job.id}`,
        job
      })
    }

    return items
  }, [currentElement, activeExternalJobs])

  const isMultiActiveLayout = unifiedActiveItems.length > 2

  const headerAppName = React.useMemo(() => {
    if (unifiedActiveItems.length === 0) return ''
    if (unifiedActiveItems.length === 1) {
      const it = unifiedActiveItems[0]
      return it.type === 'official' ? it.el.params.appName : it.job.game.title
    }
    const first = unifiedActiveItems[0]
    const firstTitle =
      first.type === 'official' ? first.el.params.appName : first.job.game.title
    return `${firstTitle} (+${unifiedActiveItems.length - 1})`
  }, [unifiedActiveItems])

  const hasActiveRunning =
    activeExternalJobs.some((j) =>
      ['downloading', 'extracting', 'installing', 'ready'].includes(j.status)
    ) ||
    Boolean(currentElement && state !== 'paused' && state !== 'idle')

  const hasActivePaused =
    activeExternalJobs.length > 0 &&
    activeExternalJobs.every((j) => j.status === 'paused') &&
    (!currentElement || state === 'paused')

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

  const renderActiveCards = () => {
    if (unifiedActiveItems.length === 0) {
      return <DownloadManagerItem current={true} />
    }
    return unifiedActiveItems.map((item) => {
      if (item.type === 'official') {
        return (
          <DownloadManagerItem
            key={item.id}
            element={item.el}
            current={true}
            state={state}
            onOpenCoverPicker={(game) => setSgdbGame(game)}
          />
        )
      }
      return (
        <ExternalActiveCard
          key={item.id}
          job={item.job}
          onRefresh={refreshExternal}
        />
      )
    })
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
          hasActiveRunning ? 'running' : hasActivePaused ? 'paused' : state
        }
        appName={headerAppName}
        runner={
          primaryActiveExternal
            ? 'sideload'
            : currentElement?.params?.runner ?? 'legendary'
        }
        overrideDownloadSpeed={externalSpeedMB}
        overrideDiskSpeed={externalDiskSpeedMB}
      />

      {isMultiActiveLayout ? (
        /* MODO MULTI-ATIVO: Mais de 2 processos ativos em Baixando Agora */
        <div className="downloadManagerAdaptiveContainer">
          {/* Topo em Largura Total: Baixando Agora (> 2 ativos em grid de 2 colunas) */}
          <div className="dmMultiActiveTopSection">
            <div className="downloadManagerSectionHeader">
              <h5 className="downloadManagerSectionTitle">
                {t('queue.label.downloading_now', 'BAIXANDO AGORA')} ({unifiedActiveItems.length})
              </h5>
            </div>
            <div className="dmActiveCardsGrid">
              {renderActiveCards()}
            </div>
          </div>

          {/* Linha Inferior: Concluídos na Esquerda em paralelo com Na Fila + Restante da Fila na Direita */}
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

            {/* Bloco Inferior Direito: Na Fila + Restante da Fila abaixo */}
            <div className="dmBottomSection dmBottomOverflowCol">
              {isOverflowQueueCollapsed ? (
                <button
                  type="button"
                  className="dmCollapsedTab"
                  onClick={toggleOverflowQueueCollapse}
                  title={t('queue.label.expand_queue', 'Expandir Fila')}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="dmTabIcon" />
                  <span className="dmTabLabel">
                    {t('queue.label.queued', 'NA FILA')} ({unifiedQueueItems.length})
                  </span>
                  <span className="dmTabHint">{t('queue.label.click_to_expand', 'Clique para expandir')}</span>
                </button>
              ) : (
                <div className="dmBottomCardContainer dmQueueRightStack">
                  {/* Sub-bloco 1: Na Fila */}
                  <div className="downloadManagerColumn" style={{ width: '100%' }}>
                    <div className="downloadManagerSectionHeader">
                      <h5 className="downloadManagerSectionTitle">
                        {t('queue.label.queued', 'NA FILA')} ({isAdaptive4Quad ? `3/${unifiedQueueItems.length}` : unifiedQueueItems.length})
                      </h5>
                    </div>
                    <div className="downloadManagerQueueList dmQueueTop3List">
                      {(isAdaptive4Quad ? topQueueItems : unifiedQueueItems).length > 0 ? (
                        (isAdaptive4Quad ? topQueueItems : unifiedQueueItems).map(renderQueueItem)
                      ) : (
                        <DownloadManagerItem current={false} />
                      )}
                    </div>
                  </div>

                  {/* Sub-bloco 2: Restante da Fila posicionado logo abaixo de Na Fila */}
                  {isAdaptive4Quad && overflowQueueItems.length > 0 && (
                    <div className="downloadManagerColumn" style={{ width: '100%', marginTop: '14px' }}>
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
              )}
            </div>
          </div>
        </div>
      ) : isAdaptive4Quad ? (
        <div className="downloadManagerAdaptiveContainer">
          {/* Top Row: Fixo e Intocável */}
          <div className="downloadManagerSplitGrid dmTopFixedGrid">
            {/* Topo Esquerdo: Baixando Agora */}
            <div className="downloadManagerColumn">
              <div className="downloadManagerSectionHeader">
                <h5 className="downloadManagerSectionTitle">
                  {t('queue.label.downloading_now', 'BAIXANDO AGORA')} ({unifiedActiveItems.length})
                </h5>
              </div>
              <div className="downloadManagerActiveWrapper">
                {renderActiveCards()}
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
                  {t('queue.label.downloading_now', 'BAIXANDO AGORA')} ({unifiedActiveItems.length})
                </h5>
              </div>
              <div className="downloadManagerActiveWrapper">
                {renderActiveCards()}
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

