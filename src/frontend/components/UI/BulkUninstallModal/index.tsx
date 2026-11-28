import './index.css'
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { GameInfo, Runner } from 'common/types'
import {
  collectCandidateInstallDirectories,
  extractGameDriveLetter,
  resolveGameRootInstallDirectory,
  sanitizeInstallPathString
} from 'common/gameInstallDirectory'
import { CachedImage } from 'frontend/components/UI'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import ContextProvider from 'frontend/state/ContextProvider'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { useRemovingGamesStore } from 'frontend/state/removingGamesStore'
import {
  configStore,
  gameOverridesStore,
  sideloadLibrary
} from 'frontend/helpers/electronStores'
import {
  archiveGameData,
  removeArchivedGameData
} from 'frontend/helpers/archivedGameData'
import {
  clearAvailabilityCache,
  markGameAsUnavailable
} from 'frontend/hooks/constants'
import { notify } from 'frontend/helpers'

type BulkPreset = 'disk-only' | 'library-keep' | 'nuke-all' | 'custom'

interface BulkUninstallModalProps {
  games: GameInfo[]
  onClose: () => void
  onCompleted?: () => void
}

function formatBytesPT(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) {
    return `${gb.toFixed(1).replace('.', ',')} GB`
  }
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) {
    return `${Math.round(mb)} MB`
  }
  const kb = bytes / 1024
  return `${Math.max(1, Math.round(kb))} KB`
}

const BulkUninstallModal: React.FC<BulkUninstallModalProps> = ({
  games,
  onClose,
  onCompleted
}) => {
  const { hiddenGames, refreshLibrary } = useContext(ContextProvider)
  const { gameOverrides } = useGlobalState.keys('gameOverrides')

  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(games.map((g) => g.app_name))
  )
  const [preset, setPreset] = useState<BulkPreset>('disk-only')
  const [deleteFiles, setDeleteFiles] = useState(true)
  const [removeFromLibrary, setRemoveFromLibrary] = useState(false)
  const [keepSavesAndData, setKeepSavesAndData] = useState(true)
  const [deleteSettingsAndPrefixes, setDeleteSettingsAndPrefixes] =
    useState(false)

  const [sizesMap, setSizesMap] = useState<Record<string, number | null>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    label: string
  } | null>(null)

  const enrichedGames = useMemo(() => {
    return games.map((game) => {
      const override = gameOverrides?.[game.app_name]
      const displayTitle =
        override?.title || game.overrides?.title || game.title || game.app_name
      const candidates = collectCandidateInstallDirectories(
        [game.install?.install_path, game.folder_name],
        [game.install?.executable],
        displayTitle
      )
      const rootDir =
        candidates[0] ||
        resolveGameRootInstallDirectory(
          game.install?.install_path || game.folder_name || '',
          displayTitle
        ) ||
        sanitizeInstallPathString(
          game.install?.install_path || game.folder_name
        )
      const driveLetter = extractGameDriveLetter(game)
      const coverSrc =
        override?.art_cover ||
        game.overrides?.art_cover ||
        game.art_cover ||
        override?.art_square ||
        game.overrides?.art_square ||
        game.art_square ||
        fallbackImage

      return {
        game,
        appName: game.app_name,
        displayTitle,
        rootDir,
        driveLetter,
        coverSrc
      }
    })
  }, [games, gameOverrides])

  // Calcula tamanho real das pastas em segundo plano com concorrência controlada
  useEffect(() => {
    let cancelled = false
    const queue = enrichedGames.filter((item) => Boolean(item.rootDir))
    let index = 0

    const worker = async () => {
      while (!cancelled && index < queue.length) {
        const item = queue[index++]
        try {
          if (window.api?.getGameFolderSize) {
            const bytes = await window.api.getGameFolderSize(item.rootDir)
            if (!cancelled) {
              setSizesMap((prev) => ({ ...prev, [item.appName]: bytes || 0 }))
            }
          }
        } catch {
          if (!cancelled) {
            setSizesMap((prev) => ({ ...prev, [item.appName]: 0 }))
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(4, queue.length) }, () =>
      worker()
    )
    void Promise.all(workers)

    return () => {
      cancelled = true
    }
  }, [enrichedGames])

  // Fechar com Escape quando não está processando
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isProcessing, onClose])

  const selectedItems = useMemo(
    () => enrichedGames.filter((item) => checkedIds.has(item.appName)),
    [enrichedGames, checkedIds]
  )

  const totalSelectedBytes = useMemo(() => {
    return selectedItems.reduce(
      (sum, item) => sum + (sizesMap[item.appName] || 0),
      0
    )
  }, [selectedItems, sizesMap])

  const sizesStillLoading = useMemo(
    () =>
      selectedItems.some(
        (item) => Boolean(item.rootDir) && sizesMap[item.appName] === undefined
      ),
    [selectedItems, sizesMap]
  )

  const allChecked =
    enrichedGames.length > 0 && checkedIds.size === enrichedGames.length

  const toggleGame = (appName: string) => {
    if (isProcessing) return
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(appName)) next.delete(appName)
      else next.add(appName)
      return next
    })
  }

  const toggleAllGames = () => {
    if (isProcessing) return
    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(enrichedGames.map((item) => item.appName)))
    }
  }

  const applyPreset = (nextPreset: Exclude<BulkPreset, 'custom'>) => {
    if (isProcessing) return
    setPreset(nextPreset)
    if (nextPreset === 'disk-only') {
      setDeleteFiles(true)
      setRemoveFromLibrary(false)
      setKeepSavesAndData(true)
      setDeleteSettingsAndPrefixes(false)
    } else if (nextPreset === 'library-keep') {
      setDeleteFiles(false)
      setRemoveFromLibrary(true)
      setKeepSavesAndData(true)
      setDeleteSettingsAndPrefixes(false)
    } else if (nextPreset === 'nuke-all') {
      setDeleteFiles(true)
      setRemoveFromLibrary(true)
      setKeepSavesAndData(false)
      setDeleteSettingsAndPrefixes(true)
    }
  }

  const syncPresetFromCheckboxes = (
    nextFiles: boolean,
    nextLib: boolean,
    nextSaves: boolean,
    nextSettings: boolean
  ) => {
    if (nextFiles && !nextLib && nextSaves && !nextSettings) {
      setPreset('disk-only')
    } else if (!nextFiles && nextLib && nextSaves && !nextSettings) {
      setPreset('library-keep')
    } else if (nextFiles && nextLib && !nextSaves && nextSettings) {
      setPreset('nuke-all')
    } else {
      setPreset('custom')
    }
  }

  const handleToggleDeleteFiles = (checked: boolean) => {
    if (isProcessing) return
    setDeleteFiles(checked)
    syncPresetFromCheckboxes(
      checked,
      removeFromLibrary,
      keepSavesAndData,
      deleteSettingsAndPrefixes
    )
  }

  const handleToggleRemoveLibrary = (checked: boolean) => {
    if (isProcessing) return
    setRemoveFromLibrary(checked)
    syncPresetFromCheckboxes(
      deleteFiles,
      checked,
      keepSavesAndData,
      deleteSettingsAndPrefixes
    )
  }

  const handleToggleKeepSaves = (checked: boolean) => {
    if (isProcessing) return
    setKeepSavesAndData(checked)
    syncPresetFromCheckboxes(
      deleteFiles,
      removeFromLibrary,
      checked,
      deleteSettingsAndPrefixes
    )
  }

  const handleToggleDeleteSettings = (checked: boolean) => {
    if (isProcessing) return
    setDeleteSettingsAndPrefixes(checked)
    syncPresetFromCheckboxes(
      deleteFiles,
      removeFromLibrary,
      keepSavesAndData,
      checked
    )
  }

  const nothingActionable =
    selectedItems.length === 0 ||
    (!deleteFiles && !removeFromLibrary && !deleteSettingsAndPrefixes)

  const isDangerMode = !keepSavesAndData && (deleteFiles || removeFromLibrary)

  const confirmButtonText = useMemo(() => {
    const count = selectedItems.length
    if (nothingActionable) return 'Selecione uma ação'
    if (deleteFiles && removeFromLibrary && !keepSavesAndData) {
      return `Apagar Tudo (${count})`
    }
    if (deleteFiles && !removeFromLibrary) {
      return `Deletar ${count} ${count === 1 ? 'Jogo' : 'Jogos'} do PC`
    }
    if (!deleteFiles && removeFromLibrary) {
      return `Remover ${count} ${count === 1 ? 'Jogo' : 'Jogos'} da Biblioteca`
    }
    return `Confirmar Exclusão (${count})`
  }, [
    selectedItems.length,
    nothingActionable,
    deleteFiles,
    removeFromLibrary,
    keepSavesAndData
  ])

  const handleConfirm = async () => {
    if (nothingActionable || isProcessing) return
    setIsProcessing(true)

    const items = [...selectedItems]
    const affectedRunners = new Set<Runner>()
    const errors: string[] = []
    const storeGamesToHide: Array<{
      appName: string
      title: string
      runner: Runner
      art_cover?: string
      art_square?: string
    }> = []

    const removalMode =
      deleteFiles && !removeFromLibrary ? 'deleting' : 'removing'
    items.forEach(({ appName }) => {
      useRemovingGamesStore.getState().startRemoval(appName, removalMode)
    })

    let assignmentsChanged = false
    let assignmentsObj: Record<string, string> | null = null
    try {
      const rawAssign = window.localStorage.getItem('heroic_game_assignments')
      if (rawAssign) {
        assignmentsObj = JSON.parse(rawAssign)
      }
    } catch {}

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const { game, appName, displayTitle, rootDir } = item
        affectedRunners.add(game.runner)

        setProgress({
          current: i + 1,
          total: items.length,
          label: `Processando "${displayTitle}" (${i + 1}/${items.length})...`
        })

        try {
          if (game.runner === 'sideload') {
            // 1. Se for manter ou apagar dados arquivados/overrides
            if (removeFromLibrary) {
              if (keepSavesAndData) {
                const curOverrides =
                  gameOverridesStore.get('overrides', {})[appName]
                archiveGameData(
                  game,
                  curOverrides,
                  rootDir || game.install?.install_path || game.folder_name
                )
              } else {
                removeArchivedGameData(appName, displayTitle)
                const overrides = gameOverridesStore.get('overrides', {})
                if (overrides[appName]) {
                  delete overrides[appName]
                  gameOverridesStore.set('overrides', overrides)
                }
                if (assignmentsObj && appName in assignmentsObj) {
                  delete assignmentsObj[appName]
                  assignmentsChanged = true
                }
              }
            } else if (!keepSavesAndData) {
              removeArchivedGameData(appName, displayTitle)
            }

            // 2. Excluir arquivos físicos do HD (usa o fluxo seguro de pasta raiz + proteção de containers + limpeza de updates pendentes)
            if (deleteFiles) {
              const delRes = await window.api.externalGamesDeleteGame(
                appName,
                true
              )
              if (!delRes.success) {
                errors.push(`${displayTitle}: ${delRes.error || 'Falha ao deletar arquivos'}`)
              }
            }

            // 3. Remover da Biblioteca OU manter como "Arquivos indisponíveis"
            if (removeFromLibrary) {
              await window.api.uninstall(
                appName,
                'sideload',
                deleteSettingsAndPrefixes,
                deleteSettingsAndPrefixes || !keepSavesAndData
              )
              const latestGames = sideloadLibrary.get('games', [])
              sideloadLibrary.set(
                'games',
                latestGames.filter((g) => g.app_name !== appName)
              )
              clearAvailabilityCache(appName, 'sideload')
              window.localStorage.removeItem(appName)
            } else {
              if (deleteFiles) {
                markGameAsUnavailable(appName, 'sideload')
                const latestGames = sideloadLibrary.get('games', [])
                const updatedGames = latestGames.map((g) => {
                  if (g.app_name !== appName) return g
                  const cleanDir =
                    rootDir ||
                    sanitizeInstallPathString(g.install?.install_path) ||
                    sanitizeInstallPathString(g.folder_name)
                  return {
                    ...g,
                    is_installed: true,
                    folder_name: cleanDir || g.folder_name,
                    install: {
                      ...(g.install || {}),
                      install_path: cleanDir || g.install?.install_path,
                      executable: ''
                    }
                  }
                })
                sideloadLibrary.set('games', updatedGames)
              }
              if (deleteSettingsAndPrefixes && window.api.cleanupGameSettings) {
                await window.api.cleanupGameSettings(
                  appName,
                  'sideload',
                  true,
                  true
                )
              }
            }
          } else {
            // Jogos de lojas oficiais (Steam, Epic, GOG, Amazon, Zoom)
            if (deleteFiles && game.is_installed) {
              await window.api.uninstall(
                appName,
                game.runner,
                deleteSettingsAndPrefixes,
                deleteSettingsAndPrefixes
              )
              clearAvailabilityCache(appName, game.runner)
            } else if (
              deleteSettingsAndPrefixes &&
              window.api.cleanupGameSettings
            ) {
              await window.api.cleanupGameSettings(
                appName,
                game.runner,
                true,
                true
              )
            }

            if (removeFromLibrary) {
              const override = gameOverrides?.[appName]
              storeGamesToHide.push({
                appName,
                title: displayTitle,
                runner: game.runner,
                art_cover:
                  override?.art_cover !== undefined
                    ? override.art_cover
                    : game.overrides?.art_cover ?? game.art_cover,
                art_square:
                  override?.art_square !== undefined
                    ? override.art_square
                    : game.overrides?.art_square ?? game.art_square
              })
              clearAvailabilityCache(appName, game.runner)
              window.localStorage.removeItem(appName)
            }
          }
        } catch (err: any) {
          errors.push(
            `${displayTitle}: ${err?.message || 'Erro inesperado durante a exclusão'}`
          )
        }
      }

      if (assignmentsChanged && assignmentsObj) {
        window.localStorage.setItem(
          'heroic_game_assignments',
          JSON.stringify(assignmentsObj)
        )
        window.dispatchEvent(new Event('gameAssignmentsChanged'))
      }

      if (storeGamesToHide.length > 0) {
        hiddenGames.addMultiple(storeGamesToHide)
      }

      ;(configStore as any).set('backup.lastModified', Date.now())
      window.dispatchEvent(new Event('backupStateChanged'))
      window.dispatchEvent(new Event('refreshLibrary'))
      window.dispatchEvent(
        new CustomEvent('heroicToggleMassEdit', { detail: { active: false } })
      )
      window.dispatchEvent(
        new CustomEvent('heroicSelectGameInline', { detail: { gameInfo: null } })
      )

      if (refreshLibrary) {
        for (const runner of affectedRunners) {
          await refreshLibrary({ library: runner, runInBackground: false })
        }
      }

      if (errors.length > 0) {
        notify({
          title: 'Exclusão em Massa Concluída com Avisos',
          body: `${items.length - errors.length}/${items.length} jogo(s) processado(s). Falha em: ${errors[0]}`
        })
      } else {
        const title =
          deleteFiles && !removeFromLibrary
            ? 'Arquivos Deletados do Computador'
            : removeFromLibrary && keepSavesAndData
            ? 'Jogos Removidos (Dados Salvos)'
            : 'Exclusão em Massa Concluída'
        const body =
          deleteFiles && !removeFromLibrary
            ? `${items.length} jogo(s) deletado(s) do disco. As capas permanecem como "Arquivos indisponíveis" com saves protegidos.`
            : `${items.length} jogo(s) processado(s) com sucesso.`
        notify({ title, body })
      }

      onCompleted?.()
      onClose()
    } finally {
      setIsProcessing(false)
      setProgress(null)
      setTimeout(() => {
        items.forEach(({ appName }) => {
          useRemovingGamesStore.getState().finishRemoval(appName)
        })
      }, 500)
    }
  }

  const summaryContent = useMemo(() => {
    if (nothingActionable) {
      return {
        variant: 'warning' as const,
        icon: '⚠️',
        node: (
          <div>
            Marque ao menos <strong>1 jogo</strong> e <strong>1 ação</strong>{' '}
            para continuar.
          </div>
        )
      }
    }

    const parts: string[] = []
    if (deleteFiles) {
      parts.push(
        totalSelectedBytes > 0
          ? `apagar ${formatBytesPT(totalSelectedBytes)} do HD`
          : `excluir os arquivos físicos do HD`
      )
    }
    if (removeFromLibrary) {
      parts.push(`remover ${selectedItems.length} card(s) da Biblioteca`)
    }
    if (deleteSettingsAndPrefixes) {
      parts.push('limpar configs, logs e prefixos')
    }

    if (!keepSavesAndData) {
      return {
        variant: 'danger' as const,
        icon: '🚨',
        node: (
          <div>
            Vai <strong>{parts.join(' + ')}</strong> e{' '}
            <strong>apagar dados e capas arquivadas permanentemente</strong>.
          </div>
        )
      }
    }

    return {
      variant: 'safe' as const,
      icon: '🛡️',
      node: (
        <div>
          Vai <strong>{parts.join(' + ')}</strong>.{' '}
          <strong style={{ color: '#6ee7b7' }}>
            Saves e capas preservados no GhostShield.
          </strong>
        </div>
      )
    }
  }, [
    nothingActionable,
    deleteFiles,
    removeFromLibrary,
    deleteSettingsAndPrefixes,
    keepSavesAndData,
    totalSelectedBytes,
    selectedItems.length
  ])

  const progressPct = progress
    ? Math.round((progress.current / Math.max(1, progress.total)) * 100)
    : 0

  return createPortal(
    <div
      className="bulkUninstallOverlay"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        className={`bulkUninstallCard ${
          isDangerMode ? 'bulkUninstallCard--danger' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bulkUninstallHeader">
          <div className="bulkUninstallHeader__left">
            <div className="bulkUninstallHeader__icon">
              <FontAwesomeIcon icon={faTrashAlt} />
            </div>
            <div className="bulkUninstallHeader__titles">
              <h2>Exclusão em Massa</h2>
              <span className="bulkUninstallHeader__meta">
                <strong className="cyan">
                  {selectedItems.length}{' '}
                  {selectedItems.length === 1 ? 'selecionado' : 'selecionados'}
                </strong>
                <span> • </span>
                <strong className="emerald">
                  {sizesStillLoading
                    ? `${formatBytesPT(totalSelectedBytes)}...`
                    : formatBytesPT(totalSelectedBytes)}
                </strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="bulkUninstallHeader__close"
            onClick={onClose}
            disabled={isProcessing}
            title="Fechar (Esc)"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Corpo */}
        <div className="bulkUninstallBody">
          {/* Linha 1: 3 Modos Rápidos */}
          <div className="bulkUninstallPresets">
            <label
              className={`bulkPresetCard ${
                preset === 'disk-only' ? 'bulkPresetCard--cyan' : ''
              }`}
              onClick={() => applyPreset('disk-only')}
            >
              <input
                type="radio"
                name="bulkUninstallPreset"
                checked={preset === 'disk-only'}
                onChange={() => applyPreset('disk-only')}
                disabled={isProcessing}
              />
              <div>
                <div className="bulkPresetCard__title">💿 Deletar do PC</div>
                <div className="bulkPresetCard__desc">
                  Apaga arquivos do HD. Mantém capas e saves.
                </div>
              </div>
            </label>

            <label
              className={`bulkPresetCard ${
                preset === 'library-keep' ? 'bulkPresetCard--emerald' : ''
              }`}
              onClick={() => applyPreset('library-keep')}
            >
              <input
                type="radio"
                name="bulkUninstallPreset"
                checked={preset === 'library-keep'}
                onChange={() => applyPreset('library-keep')}
                disabled={isProcessing}
              />
              <div>
                <div className="bulkPresetCard__title">
                  🛡️ Remover (Salvar Dados)
                </div>
                <div className="bulkPresetCard__desc">
                  Tira da biblioteca. Arquiva saves e capas.
                </div>
              </div>
            </label>

            <label
              className={`bulkPresetCard ${
                preset === 'nuke-all' ? 'bulkPresetCard--red' : ''
              }`}
              onClick={() => applyPreset('nuke-all')}
            >
              <input
                type="radio"
                name="bulkUninstallPreset"
                checked={preset === 'nuke-all'}
                onChange={() => applyPreset('nuke-all')}
                disabled={isProcessing}
              />
              <div>
                <div className="bulkPresetCard__title">🔥 Apagar Tudo</div>
                <div className="bulkPresetCard__desc">
                  Deleta HD, cards, dados e logs (irreversível).
                </div>
              </div>
            </label>
          </div>

          {/* Linha 2: Lista de Jogos (7fr) + Opções e Resumo (5fr) */}
          <div className="bulkUninstallMainGrid">
            <div className="bulkGamesPanel">
              <div className="bulkPanelHeader">
                <span className="bulkPanelHeader__label">
                  🎮 Jogos Selecionados (
                  <strong>{selectedItems.length}</strong>/{enrichedGames.length})
                </span>
                <button
                  type="button"
                  className="bulkPanelHeader__action"
                  onClick={toggleAllGames}
                  disabled={isProcessing}
                >
                  {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <div className="bulkGamesList">
                {enrichedGames.map((item) => {
                  const isChecked = checkedIds.has(item.appName)
                  const bytes = sizesMap[item.appName]
                  const sizeLabel = !item.rootDir
                    ? '—'
                    : bytes === undefined
                    ? '...'
                    : typeof bytes === 'number' && bytes > 0
                    ? formatBytesPT(bytes)
                    : '—'
                  return (
                    <label
                      key={item.appName}
                      title={item.rootDir || item.displayTitle}
                      className={`bulkGameRow ${
                        !isChecked ? 'bulkGameRow--unchecked' : ''
                      }`}
                    >
                      <div className="bulkGameRow__left">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleGame(item.appName)}
                          disabled={isProcessing}
                        />
                        <CachedImage
                          src={item.coverSrc}
                          alt={item.displayTitle}
                          className="bulkUninstall__cover"
                        />
                        <div className="bulkGameRow__info">
                          <div className="bulkGameRow__title">
                            {item.displayTitle}
                          </div>
                          <div className="bulkGameRow__path">
                            {item.rootDir || 'Sem pasta local mapeada'}
                          </div>
                        </div>
                      </div>
                      <div className="bulkGameRow__right">
                        {item.driveLetter && (
                          <span className="bulkGameRow__drive">
                            {item.driveLetter}
                          </span>
                        )}
                        <span className="bulkGameRow__size">{sizeLabel}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="bulkRightCol">
              <div className="bulkOptionsCard">
                <div className="bulkPanelHeader">
                  <span className="bulkPanelHeader__label">
                    ⚙️ Opções de Exclusão
                  </span>
                  {preset === 'custom' && (
                    <span className="bulkPanelHeader__tag">Personalizado</span>
                  )}
                </div>
                <div className="bulkOptionsList">
                  <label
                    className="bulkOptionRow bulkOptionRow--danger"
                    title="Deleta a pasta raiz de cada jogo no HD (protegendo pastas-mãe como Alazter Games e Jogos)"
                  >
                    <input
                      type="checkbox"
                      checked={deleteFiles}
                      onChange={(e) =>
                        handleToggleDeleteFiles(e.target.checked)
                      }
                      disabled={isProcessing}
                    />
                    <span>Excluir arquivos físicos do HD</span>
                  </label>

                  <label
                    className="bulkOptionRow bulkOptionRow--danger"
                    title="Retira os cards da grade do Ghost e remove atalhos da Área de Trabalho, Menu Iniciar e Steam"
                  >
                    <input
                      type="checkbox"
                      checked={removeFromLibrary}
                      onChange={(e) =>
                        handleToggleRemoveLibrary(e.target.checked)
                      }
                      disabled={isProcessing}
                    />
                    <span>Remover cards da Biblioteca</span>
                  </label>

                  <label
                    className="bulkOptionRow bulkOptionRow--emerald"
                    title="Preserva backups de saves no GhostShield, capas personalizadas e metadados para restauração futura"
                  >
                    <input
                      type="checkbox"
                      checked={keepSavesAndData}
                      onChange={(e) => handleToggleKeepSaves(e.target.checked)}
                      disabled={isProcessing}
                    />
                    <span>Manter Saves e Dados (GhostShield)</span>
                  </label>

                  <label
                    className="bulkOptionRow bulkOptionRow--danger"
                    title="Apaga arquivos de configuração (GamesConfig), logs e prefixos Wine/Proton"
                  >
                    <input
                      type="checkbox"
                      checked={deleteSettingsAndPrefixes}
                      onChange={(e) =>
                        handleToggleDeleteSettings(e.target.checked)
                      }
                      disabled={isProcessing}
                    />
                    <span>Apagar configurações, logs e prefixos</span>
                  </label>
                </div>
              </div>

              <div
                className={`bulkSummaryBanner ${
                  summaryContent.variant === 'danger'
                    ? 'bulkSummaryBanner--danger'
                    : summaryContent.variant === 'warning'
                    ? 'bulkSummaryBanner--warning'
                    : ''
                }`}
              >
                <span style={{ fontSize: '16px', lineHeight: 1.2 }}>
                  {summaryContent.icon}
                </span>
                {summaryContent.node}
              </div>
            </div>
          </div>

          {/* Barra de Progresso ao Vivo */}
          {progress && (
            <div className="bulkProgressBox">
              <div className="bulkProgressBox__top">
                <span>{progress.label}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="bulkProgressBox__track">
                <div
                  className="bulkProgressBox__fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="bulkUninstallFooter">
          <div className="bulkUninstallFooter__hint">
            <span>🛡️</span>
            <span>Pastas-mãe (ex.: Alazter Games, Jogos) sempre protegidas</span>
          </div>
          <div className="bulkUninstallFooter__actions">
            <button
              type="button"
              className="bulkBtnCancel"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="bulkBtnConfirm"
              onClick={handleConfirm}
              disabled={nothingActionable || isProcessing}
            >
              <FontAwesomeIcon icon={faTrashAlt} />
              <span>
                {isProcessing ? 'Processando...' : confirmButtonText}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BulkUninstallModal
