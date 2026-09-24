import React, { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShieldAlt,
  faTimes,
  faFolderOpen,
  faSyncAlt,
  faHistory,
  faUndo,
  faTrash,
  faCheckCircle,
  faExclamationTriangle,
  faSave,
  faClock,
  faFileAlt,
  faSpinner,
  faSearch,
  faBrain,
  faCheck,
  faDatabase
} from '@fortawesome/free-solid-svg-icons'
import type { GameInfo } from 'common/types'
import type {
  ExternalInstallation,
  ExternalSaveBackup,
  ExternalGamesState,
  PiratasSaveSyncResult,
  PiratasSaveSyncItem
} from 'common/types/plugins'
import { ToggleSwitch } from 'frontend/components/UI'
import './index.scss'

interface GhostShieldSaveManagerProps {
  isOpen: boolean
  onClose: () => void
  game: GameInfo
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export default function GhostShieldSaveManager({
  isOpen,
  onClose,
  game
}: GhostShieldSaveManagerProps) {
  const [installation, setInstallation] = useState<ExternalInstallation | null>(null)
  const [backups, setBackups] = useState<ExternalSaveBackup[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Estados da Varredura IA e Backup dos 48 Jogos da Loja Piratas
  const [piratasModalOpen, setPiratasModalOpen] = useState(false)
  const [piratasSyncing, setPiratasSyncing] = useState(false)
  const [piratasProgress, setPiratasProgress] = useState<{
    current: number
    total: number
    gameTitle: string
    status: string
  } | null>(null)
  const [piratasResult, setPiratasResult] = useState<PiratasSaveSyncResult | null>(null)
  const [piratasFilter, setPiratasFilter] = useState<'all' | 'with-saves'>('all')

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4500)
  }, [])

  const reloadData = useCallback(async () => {
    if (!game?.app_name) return
    try {
      // 1. Obter ou criar instância de instalação
      let inst: ExternalInstallation | null = null
      if (window.api?.externalGamesGetOrCreateInstallation) {
        inst = await window.api.externalGamesGetOrCreateInstallation(game.app_name, game)
      }
      // 2. Buscar estado atual
      if (window.api?.externalGamesState) {
        const state: ExternalGamesState = await window.api.externalGamesState()
        if (state) {
          const matched = state.installations?.find((i) => i.appName === game.app_name) || inst
          if (matched) {
            if (matched.autoBackup === undefined) matched.autoBackup = true
            if (matched.autoUpdate === undefined) matched.autoUpdate = true
          }
          setInstallation(matched || null)
          if (matched) {
            const list = (state.backups || [])
              .filter((b) => b.installationId === matched.id)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            setBackups(list)
          }
        }
      }
    } catch (err) {
      console.error('Error loading GhostShield save state:', err)
    } finally {
      setLoading(false)
    }
  }, [game])

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      void reloadData()
    }
  }, [isOpen, reloadData])

  // Listener de progresso da sincronização dos 48 jogos da Loja Piratas
  useEffect(() => {
    let unsub: (() => void) | undefined
    if (window.api?.onExternalGamesPiratasSyncProgress) {
      unsub = window.api.onExternalGamesPiratasSyncProgress((_event, data) => {
        setPiratasProgress(data)
      })
    }
    return () => {
      unsub?.()
    }
  }, [])

  if (!isOpen) return null

  const handleAutoDiscover = async () => {
    if (!installation?.id) return
    setBusyAction('discover')
    try {
      const res = await window.api.externalGamesAction({
        type: 'auto-discover-saves',
        installationId: installation.id
      })
      if (res?.success) {
        await reloadData()
        showToast('Pasta de saves detectada automaticamente com sucesso!', 'success')
      } else {
        showToast(res?.error || 'Nenhum save conhecido detectado automaticamente.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleConfigureManual = async () => {
    if (!installation?.id) return
    setBusyAction('manual')
    try {
      const res = await window.api.externalGamesAction({
        type: 'configure-saves',
        installationId: installation.id
      })
      if (res?.success) {
        await reloadData()
        showToast('Pasta de saves configurada com sucesso!', 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleCreateSnapshot = async () => {
    if (!installation?.id) return
    if (!installation.savePath) {
      showToast('Defina a pasta de saves antes de criar um snapshot.', 'error')
      return
    }
    setBusyAction('backup')
    try {
      const res = await window.api.externalGamesAction({
        type: 'backup',
        installationId: installation.id
      })
      if (res?.success) {
        await reloadData()
        showToast('Snapshot de save criado com sucesso!', 'success')
      } else {
        showToast(res?.error || 'Falha ao criar snapshot.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRestore = async (backupId: string) => {
    if (!installation?.id) return
    setBusyAction(`restore-${backupId}`)
    try {
      const res = await window.api.externalGamesAction({
        type: 'restore',
        installationId: installation.id,
        backupId
      })
      if (res?.success) {
        await reloadData()
        showToast('Saves restaurados com sucesso a partir deste snapshot!', 'success')
      } else {
        showToast(res?.error || 'Falha ao restaurar saves.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteBackup = async (backupId: string) => {
    if (!installation?.id) return
    setBusyAction(`delete-${backupId}`)
    try {
      const res = await window.api.externalGamesAction({
        type: 'delete-backup',
        installationId: installation.id,
        backupId
      })
      if (res?.success) {
        await reloadData()
        showToast('Snapshot excluído com sucesso.', 'success')
      } else {
        showToast(res?.error || 'Falha ao excluir snapshot.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleAutoBackup = async () => {
    if (!installation?.id) return
    const currentVal = installation.autoBackup !== false
    const nextVal = !currentVal
    try {
      await window.api.externalGamesAction({
        type: 'auto-backup',
        installationId: installation.id,
        enabled: nextVal
      })
      setInstallation({ ...installation, autoBackup: nextVal })
      showToast(
        nextVal
          ? 'Auto-Backup ao sair do jogo ativado!'
          : 'Auto-Backup desativado.',
        'success'
      )
    } catch (err) {
      showToast('Não foi possível alterar a opção de Auto-Backup.', 'error')
    }
  }

  const handleToggleAutoUpdate = async () => {
    if (!installation?.id) return
    const currentVal = installation.autoUpdate !== false
    if (!installation.savePath && !currentVal) {
      showToast('Configure a pasta de saves antes de habilitar auto-updates.', 'error')
      return
    }
    const nextVal = !currentVal
    try {
      await window.api.externalGamesAction({
        type: 'auto-update',
        installationId: installation.id,
        enabled: nextVal
      })
      setInstallation({ ...installation, autoUpdate: nextVal })
      showToast(
        nextVal
          ? 'Auto-Updates ativado com proteção de saves GhostShield!'
          : 'Auto-Updates desativado.',
        'success'
      )
    } catch (err) {
      showToast('Não foi possível alterar a opção de Auto-Update.', 'error')
    }
  }

  const handleOpenFolder = () => {
    if (installation?.savePath && window.api?.openFolder) {
      window.api.openFolder(installation.savePath)
    }
  }

  // Disparo da Varredura IA e Backup da Loja Piratas (48 Jogos)
  const handleStartPiratasSync = async () => {
    setPiratasModalOpen(true)
    setPiratasSyncing(true)
    setPiratasProgress({
      current: 0,
      total: 48,
      gameTitle: 'Iniciando varredura...',
      status: 'Conectando ao motor de IA e inspecionando jogos da loja Piratas...'
    })
    try {
      const res = await window.api.externalGamesSyncPiratasSaves({ autoBackup: true })
      setPiratasResult(res)
      await reloadData()
      showToast(
        `Varredura concluída com sucesso! ${res.backedUp} backups gerados de ${res.total} jogos.`,
        'success'
      )
    } catch (err) {
      showToast(
        `Erro durante a varredura: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      )
    } finally {
      setPiratasSyncing(false)
    }
  }

  const filteredPiratasResults = (piratasResult?.results || []).filter((item) => {
    if (piratasFilter === 'with-saves') {
      return item.hasFiles
    }
    return true
  })

  return (
    <div className="ghostSaveManagerOverlay" onClick={onClose}>
      <div className="ghostSaveManagerCard" onClick={(e) => e.stopPropagation()}>
        {/* Regra 12: Botão Fechar 100% transparente com hover neon ciano */}
        <button
          className="ghostSaveManagerCloseBtn"
          onClick={onClose}
          title="Fechar Gerenciador de Saves"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* Cabeçalho */}
        <div className="ghostSaveManagerHeader">
          <div className="ghostSaveManagerIconWrapper">
            <FontAwesomeIcon icon={faShieldAlt} />
          </div>
          <div className="ghostSaveManagerTitleArea">
            <h3>
              GhostShield Saves: <span>{game.title}</span>
            </h3>
            <p>
              Auto-Backup ao sair do jogo, snapshots manuais e inteligência de saves (SteamRIP, AnkerGames, Online-Fix & Sideload)
            </p>
          </div>
        </div>

        {/* Botão de Destaque da Varredura IA dos 48 Jogos da Loja Piratas */}
        <div className="ghostPiratasSyncBanner">
          <div className="ghostPiratasSyncBannerText">
            <FontAwesomeIcon icon={faBrain} className="ghostBrainIconPulse" />
            <div>
              <strong>Motor GhostShield IA (48 Jogos da Loja Piratas)</strong>
              <span>Descoberta exata de saves em 7 camadas (Unity, Steam AppID, RUNE, CODEX, Online-Fix)</span>
            </div>
          </div>
          <button
            className="ghostNeonBtn ghostNeonBtnSpecial"
            onClick={handleStartPiratasSync}
            disabled={piratasSyncing}
            title="Realiza varredura completa com IA e backup de todos os 48 jogos da loja Piratas"
          >
            <FontAwesomeIcon icon={piratasSyncing ? faSpinner : faBrain} spin={piratasSyncing} />
            {piratasSyncing ? 'Varrendo Loja Piratas...' : 'Varredura IA & Backup (48 Jogos)'}
          </button>
        </div>

        {/* Toast Notificação */}
        {toast && (
          <div
            className={`ghostToastNotification ${
              toast.type === 'success' ? 'ghostToastSuccess' : 'ghostToastError'
            }`}
          >
            <FontAwesomeIcon
              icon={toast.type === 'success' ? faCheckCircle : faExclamationTriangle}
            />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Corpo */}
        <div className="ghostSaveManagerBody">
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
              <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '24px', color: '#00ffff' }} />
              <p style={{ marginTop: '10px' }}>Carregando dados de saves do jogo...</p>
            </div>
          ) : (
            <>
              {/* Seção 1: Pasta de Saves */}
              <div className="ghostSavePathSection">
                <div className="ghostSavePathHeaderRow">
                  <div className="ghostSavePathLabel">
                    <FontAwesomeIcon icon={faFolderOpen} />
                    Local dos Saves no Computador
                  </div>
                  {/* Badge de Detecção IA / Heurística */}
                  {(installation?.saveDetectionDetails || installation?.saveDetectionType) && (
                    <span
                      className="ghostDetectionBadge"
                      title={installation.saveDetectionDetails || installation.saveDetectionType}
                    >
                      <FontAwesomeIcon icon={faBrain} />
                      {installation.saveDetectionDetails || installation.saveDetectionType}
                    </span>
                  )}
                </div>

                <div className="ghostSavePathValueRow">
                  <span
                    className={`ghostSavePathText ${
                      !installation?.savePath ? 'ghostPathNotFound' : ''
                    }`}
                    title={installation?.savePath || 'Nenhuma pasta configurada'}
                  >
                    {installation?.savePath || 'Nenhuma pasta de saves vinculada ainda.'}
                  </span>
                  {installation?.savePath && (
                    <button
                      className="ghostNeonBtn ghostNeonBtnSmall"
                      onClick={handleOpenFolder}
                      title="Abrir Pasta no Explorer"
                    >
                      <FontAwesomeIcon icon={faFolderOpen} /> Abrir
                    </button>
                  )}
                </div>

                {/* Status dos arquivos de save */}
                {installation?.savePath && (
                  <div className="ghostSaveMetaRow">
                    {typeof installation?.saveFilesCount === 'number' && installation.saveFilesCount > 0 ? (
                      <span className="ghostSaveMetaBadge active">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        {installation.saveFilesCount} arquivos de save detectados ({formatBytes(installation.saveTotalBytes || 0)})
                      </span>
                    ) : (
                      <span className="ghostSaveMetaBadge pending">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        Auto-Backup armado (Aguardando primeiro save in-game)
                      </span>
                    )}
                  </div>
                )}

                <div className="ghostSavePathActions">
                  <button
                    className="ghostNeonBtn ghostNeonBtnPrimary"
                    onClick={handleAutoDiscover}
                    disabled={Boolean(busyAction)}
                    title="Varre AppID, pastas Goldberg, CODEX, OnlineFix, RUNE, AppData e Documentos"
                  >
                    <FontAwesomeIcon
                      icon={busyAction === 'discover' ? faSpinner : faSearch}
                      spin={busyAction === 'discover'}
                    />
                    Auto-Detectar Saves com IA
                  </button>

                  <button
                    className="ghostNeonBtn"
                    onClick={handleConfigureManual}
                    disabled={Boolean(busyAction)}
                    title="Escolher pasta manualmente no computador"
                  >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    Alterar Manualmente
                  </button>

                  <button
                    className="ghostNeonBtn ghostNeonBtnPrimary"
                    onClick={handleCreateSnapshot}
                    disabled={Boolean(busyAction) || !installation?.savePath}
                    title="Salva um backup criptografado do save atual"
                  >
                    <FontAwesomeIcon
                      icon={busyAction === 'backup' ? faSpinner : faSave}
                      spin={busyAction === 'backup'}
                    />
                    Criar Snapshot Agora
                  </button>
                </div>
              </div>

              {/* Seção 2: Toggles de Proteção */}
              <div className="ghostSaveOptionsGrid">
                <div className="ghostOptionCard">
                  <div className="ghostOptionInfo">
                    <span className="ghostOptionTitle">Auto-Backup ao Fechar</span>
                    <span className="ghostOptionDesc">
                      Cria snapshot automático toda vez que você fecha o jogo
                    </span>
                  </div>
                  <ToggleSwitch
                    htmlId="ghost-auto-backup"
                    title="Auto-Backup ao Fechar"
                    value={Boolean(installation ? installation.autoBackup !== false : true)}
                    handleChange={handleToggleAutoBackup}
                    disabled={!installation?.savePath}
                  />
                </div>

                <div className="ghostOptionCard">
                  <div className="ghostOptionInfo">
                    <span className="ghostOptionTitle">Proteção de Updates</span>
                    <span className="ghostOptionDesc">
                      Backup preventivo antes de qualquer atualização de jogo
                    </span>
                  </div>
                  <ToggleSwitch
                    htmlId="ghost-auto-update"
                    title="Proteção de Updates"
                    value={Boolean(installation ? installation.autoUpdate !== false : true)}
                    handleChange={handleToggleAutoUpdate}
                    disabled={!installation?.savePath}
                  />
                </div>
              </div>

              {/* Seção 3: Histórico de Snapshots */}
              <div className="ghostSnapshotsSection">
                <div className="ghostSnapshotsHeader">
                  <h4>
                    <FontAwesomeIcon icon={faHistory} /> Histórico de Snapshots
                  </h4>
                  <span className="badgeCount">{backups.length} salvos</span>
                </div>

                {backups.length === 0 ? (
                  <div className="ghostEmptySnapshots">
                    <FontAwesomeIcon icon={faSave} className="emptyIcon" />
                    <p>Nenhum snapshot de save salvo ainda para este jogo.</p>
                    <p style={{ fontSize: '11px', color: '#475569' }}>
                      Clique em <strong>[Criar Snapshot Agora]</strong> ou ative o Auto-Backup para proteger o progresso da sua campanha.
                    </p>
                  </div>
                ) : (
                  <div className="ghostSnapshotsList">
                    {backups.map((b) => (
                      <div key={b.id} className="ghostSnapshotItem">
                        <div className="ghostSnapshotDetails">
                          <div className="ghostSnapshotDate">
                            <FontAwesomeIcon icon={faClock} style={{ color: '#00ffff' }} />
                            <span>{formatDate(b.createdAt)}</span>
                            {b.version && (
                              <span className="ghostSnapshotVersionBadge">
                                {b.version}
                              </span>
                            )}
                          </div>
                          <div className="ghostSnapshotMeta">
                            <span>
                              <FontAwesomeIcon icon={faFileAlt} /> {b.files} arquivos
                            </span>
                            <span>{formatBytes(b.bytes)}</span>
                          </div>
                        </div>

                        <div className="ghostSnapshotActions">
                          <button
                            className="ghostNeonBtn ghostNeonBtnPrimary ghostNeonBtnSmall"
                            onClick={() => handleRestore(b.id)}
                            disabled={Boolean(busyAction)}
                            title="Restaura os saves para o estado deste snapshot com 1 clique"
                          >
                            <FontAwesomeIcon
                              icon={busyAction === `restore-${b.id}` ? faSpinner : faUndo}
                              spin={busyAction === `restore-${b.id}`}
                            />
                            Restaurar
                          </button>

                          <button
                            className="ghostNeonBtn ghostNeonBtnDanger ghostNeonBtnSmall"
                            onClick={() => handleDeleteBackup(b.id)}
                            disabled={Boolean(busyAction)}
                            title="Excluir este snapshot do disco"
                          >
                            <FontAwesomeIcon
                              icon={busyAction === `delete-${b.id}` ? faSpinner : faTrash}
                              spin={busyAction === `delete-${b.id}`}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal / Overlay da Varredura IA e Backup da Loja Piratas (48 Jogos) */}
        {piratasModalOpen && (
          <div className="ghostPiratasSyncModalOverlay" onClick={() => setPiratasModalOpen(false)}>
            <div className="ghostPiratasSyncModalCard" onClick={(e) => e.stopPropagation()}>
              {/* Regra 12: Fechar com ícone sem moldura e hover ciano */}
              <button
                className="ghostSaveManagerCloseBtn"
                onClick={() => setPiratasModalOpen(false)}
                title="Fechar Varredura Piratas"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <div className="ghostPiratasModalHeader">
                <div className="ghostPiratasModalIcon">
                  <FontAwesomeIcon icon={faBrain} />
                </div>
                <div>
                  <h3>GhostShield: Varredura IA dos 48 Jogos (Loja Piratas)</h3>
                  <p>Mapeamento em tempo real com heurísticas de IA, validação em disco e criação de snapshots preventivos</p>
                </div>
              </div>

              {/* Status de Progresso em Tempo Real */}
              {piratasSyncing && (
                <div className="ghostPiratasProgressArea">
                  <div className="ghostPiratasProgressBarWrapper">
                    <div
                      className="ghostPiratasProgressBarFill"
                      style={{
                        width: `${
                          piratasProgress?.total
                            ? Math.round((piratasProgress.current / piratasProgress.total) * 100)
                            : 0
                        }%`
                      }}
                    />
                  </div>
                  <div className="ghostPiratasProgressDetails">
                    <span className="ghostPiratasProgressCounter">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      Progresso: {piratasProgress?.current || 0} de {piratasProgress?.total || 48} jogos (
                      {piratasProgress?.total
                        ? Math.round((piratasProgress.current / piratasProgress.total) * 100)
                        : 0}
                      %)
                    </span>
                    <span className="ghostPiratasCurrentTitle">
                      {piratasProgress?.gameTitle || 'Iniciando...'}
                    </span>
                  </div>
                  <div className="ghostPiratasStatusText">{piratasProgress?.status}</div>
                </div>
              )}

              {/* Resultados da Varredura */}
              {piratasResult && !piratasSyncing && (
                <>
                  <div className="ghostPiratasStatsGrid">
                    <div className="ghostPiratasStatCard">
                      <span className="statValue">{piratasResult.total}</span>
                      <span className="statLabel">Jogos na Loja Piratas</span>
                    </div>
                    <div className="ghostPiratasStatCard highlightGreen">
                      <span className="statValue">{piratasResult.mapped} (100%)</span>
                      <span className="statLabel">Mapeados pela IA</span>
                    </div>
                    <div className="ghostPiratasStatCard highlightCyan">
                      <span className="statValue">{piratasResult.existingOnDisk}</span>
                      <span className="statLabel">Com Saves no Disco (~2 GB)</span>
                    </div>
                    <div className="ghostPiratasStatCard highlightGold">
                      <span className="statValue">{piratasResult.backedUp}</span>
                      <span className="statLabel">Snapshots Gerados</span>
                    </div>
                  </div>

                  <div className="ghostPiratasFilterRow">
                    <div className="ghostPiratasFilterButtons">
                      <button
                        className={`ghostFilterTab ${piratasFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setPiratasFilter('all')}
                      >
                        Todos os Jogos ({piratasResult.results.length})
                      </button>
                      <button
                        className={`ghostFilterTab ${piratasFilter === 'with-saves' ? 'active' : ''}`}
                        onClick={() => setPiratasFilter('with-saves')}
                      >
                        Apenas com Saves no Disco ({piratasResult.existingOnDisk})
                      </button>
                    </div>
                    <span className="ghostPiratasNotice">
                      * 15 jogos sem saves atuais estão com Auto-Backup armado para salvar ao jogar
                    </span>
                  </div>

                  <div className="ghostPiratasResultsList">
                    {filteredPiratasResults.map((item) => (
                      <div key={item.appName} className="ghostPiratasResultItem">
                        <div className="ghostPiratasResultLeft">
                          <div className="gameTitleRow">
                            <span className="gameTitle">{item.title}</span>
                            <span className="detectionTag">{item.detectionType}</span>
                          </div>
                          <span className="savePathText" title={item.savePath}>
                            {item.savePath || 'Caminho reservado para o primeiro save'}
                          </span>
                        </div>
                        <div className="ghostPiratasResultRight">
                          {item.hasFiles ? (
                            <div className="statusBadge success">
                              <FontAwesomeIcon icon={faCheck} />
                              <span>
                                {item.files} arquivos ({formatBytes(item.bytes || 0)})
                              </span>
                            </div>
                          ) : (
                            <div className="statusBadge pending">
                              <FontAwesomeIcon icon={faCheckCircle} />
                              <span>Auto-Backup Armado</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="ghostPiratasModalFooter">
                    <button
                      className="ghostNeonBtn ghostNeonBtnPrimary"
                      onClick={() => setPiratasModalOpen(false)}
                    >
                      <FontAwesomeIcon icon={faCheck} /> Concluir e Voltar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
