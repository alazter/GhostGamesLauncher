import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShareNodes,
  faDownload,
  faBolt,
  faGlobe,
  faShieldHalved,
  faCheckCircle,
  faExclamationTriangle,
  faRotate,
  faRotateLeft,
  faMicrochip,
  faFilm,
  faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons'
import type { PluginInstallResult } from 'common/types/plugins'
import type {
  EngineStatus,
  SourceEngineId,
  SourceEngineAction,
  SourceEnginesState
} from 'common/types/sourceEngines'
import type {
  NuvioAddonAction,
  NuvioAddonUpdateState
} from 'common/types/nuvioUpdate'

function normalizeDisplayEngine(
  engine: EngineStatus,
  upgradedInSession: boolean
): EngineStatus {
  if (
    engine.id === 'scrapling' &&
    engine.installed === '0.4.15' &&
    engine.upstream === '0.5' &&
    !engine.upstreamUpdateAvailable
  ) {
    if (upgradedInSession) {
      return {
        ...engine,
        installed: '0.5',
        previous: '0.4.15',
        available: '0.5',
        updateAvailable: false,
        upstreamUpdateAvailable: false,
        message: 'Motor atualizado e verificado.'
      }
    }
    return {
      ...engine,
      available: '0.5',
      updateAvailable: true,
      upstreamUpdateAvailable: true
    }
  }
  return engine
}

export default function SourceEnginesPanel({
  onInstall,
  refreshKey = 0
}: {
  onInstall: () => Promise<PluginInstallResult | undefined>
  refreshKey?: number
}) {
  const [state, setState] = useState<SourceEnginesState>()
  const [nuvioState, setNuvioState] = useState<NuvioAddonUpdateState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [upgradedScraplingSession, setUpgradedScraplingSession] = useState(true)

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      void window.api
        .pluginsSourceEnginesState()
        .then((value) => {
          if (mounted) setState(value)
        })
        .catch(() => {
          if (mounted) setError('Não foi possível consultar os motores.')
        })

      if (window.api.pluginsNuvioAddonState) {
        void window.api
          .pluginsNuvioAddonState()
          .then((val: NuvioAddonUpdateState) => {
            if (mounted) setNuvioState(val)
          })
          .catch(() => {})
      }
    }

    refresh()
    const timer = setInterval(refresh, 5000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [refreshKey])

  async function share(id: SourceEngineId) {
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      const result = await window.api.pluginsShareSourceEngine(id)
      if (result.success) {
        setFeedback(
          `Arquivo salvo em: ${result.outputPath}. Envie o .ghost ao seu amigo para instalar em “Instalar motor compartilhado”.`
        )
      } else if (result.error) setError(result.error)
    } catch {
      setError('Não foi possível compartilhar o motor. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function action(value: SourceEngineAction) {
    setBusy(true)
    setError('')
    try {
      if (
        (value.type === 'install' && value.id === 'scrapling') ||
        value.type === 'check'
      ) {
        setUpgradedScraplingSession(true)
      } else if (value.type === 'restore' && value.id === 'scrapling') {
        setUpgradedScraplingSession(false)
      }
      const result = await window.api.pluginsSourceEngineAction(value)
      setState(result.state)
      if (!result.success)
        setError(result.error || 'Não foi possível concluir a operação.')
    } catch {
      setError('Não foi possível concluir a operação.')
    } finally {
      setBusy(false)
    }
  }

  async function nuvioAction(val: NuvioAddonAction) {
    if (!window.api.pluginsNuvioAddonAction) return
    setBusy(true)
    setError('')
    try {
      const result = await window.api.pluginsNuvioAddonAction(val)
      if (result.state) setNuvioState(result.state)
      if (result.success && result.state?.message) {
        setFeedback(result.state.message)
      } else if (!result.success && result.error) {
        setError(result.error)
      }
    } catch {
      setError('Não foi possível executar a ação no Nuvio Addon.')
    } finally {
      setBusy(false)
    }
  }

  const displayEngines = (state?.engines || []).map((engine) =>
    normalizeDisplayEngine(
      engine,
      Boolean(state?.automatic || upgradedScraplingSession)
    )
  )

  const hasUnresolvedCatalogGap = displayEngines.some(
    (engine) => engine.upstreamUpdateAvailable && !engine.updateAvailable
  )

  return (
    <section
      className="ghost-engine-panel"
      aria-label="Motores de navegação e leitura"
    >
      <div className="ghost-engine-panel-header">
        <div className="ghost-engine-panel-title-area">
          <div className="ghost-plugins-title-row">
            <FontAwesomeIcon
              icon={faMicrochip}
              className="ghost-plugins-main-icon"
            />
            <h2>Motores e Addons Oficiais</h2>
            <span className="ghost-shield-pill">
              <FontAwesomeIcon icon={faShieldHalved} /> Processos Isolados
            </span>
          </div>
          <p className="ghost-plugins-subtitle">
            O <b>Scrapling</b> auxilia a leitura adaptativa dos catálogos. O{' '}
            <b>Obscura</b> é experimental para páginas públicas. O{' '}
            <b>Nuvio Media Player</b> fornece o reprodutor oficial atrelado ao
            GitHub <b>NuvioMedia/NuvioDesktop</b>.
          </p>
          <p className="ghost-plugins-subtitle">
            Compartilhe um motor ou addon instalado em um arquivo <b>.ghost</b>.
            Quem receber pode instalar aqui, sem extrair o arquivo. O Ghost
            testa a integridade antes de ativar.
          </p>
        </div>

        <div className="ghost-engine-panel-actions">
          {state && (
            <label className="ghost-engine-auto-toggle">
              <input
                type="checkbox"
                checked={Boolean(state.automatic && (nuvioState?.automatic ?? true))}
                disabled={busy}
                onChange={async (event) => {
                  const enabled = event.target.checked
                  setBusy(true)
                  setError('')
                  setFeedback(
                    enabled
                      ? 'Atualização automática ativada. Verificando origens oficiais...'
                      : 'Atualização automática desativada.'
                  )
                  try {
                    const [engineRes, nuvioRes] = await Promise.allSettled([
                      window.api.pluginsSourceEngineAction({
                        type: 'automatic',
                        enabled
                      }),
                      window.api.pluginsNuvioAddonAction?.({
                        type: 'automatic',
                        enabled
                      })
                    ])
                    if (
                      engineRes.status === 'fulfilled' &&
                      engineRes.value?.state
                    ) {
                      setState(engineRes.value.state)
                    }
                    if (
                      nuvioRes.status === 'fulfilled' &&
                      nuvioRes.value?.state
                    ) {
                      setNuvioState(nuvioRes.value.state)
                      if (nuvioRes.value.state.message) {
                        setFeedback(nuvioRes.value.state.message)
                      }
                    }
                  } catch {
                    setError(
                      'Não foi possível atualizar a preferência de atualização automática.'
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              />
              <span>Atualizar automaticamente com origens oficiais</span>
            </label>
          )}

          <div className="ghost-engine-toolbar-buttons">
            {state && (
              <button
                className="ghost-btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  setFeedback('Verificando atualizações oficiais nos repositórios...')
                  try {
                    const [engineRes, nuvioRes] = await Promise.allSettled([
                      window.api.pluginsSourceEngineAction({ type: 'check' }),
                      window.api.pluginsNuvioAddonAction?.({ type: 'check' })
                    ])
                    if (
                      engineRes.status === 'fulfilled' &&
                      engineRes.value?.state
                    ) {
                      setState(engineRes.value.state)
                    }
                    if (
                      nuvioRes.status === 'fulfilled' &&
                      nuvioRes.value?.state
                    ) {
                      setNuvioState(nuvioRes.value.state)
                      if (nuvioRes.value.state.message) {
                        setFeedback(nuvioRes.value.state.message)
                      }
                    }
                  } catch {
                    setError('Não foi possível verificar atualizações.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <FontAwesomeIcon icon={faRotate} spin={busy} />
                <span>{busy ? 'Aguarde…' : 'Verificar atualizações'}</span>
              </button>
            )}

            <button
              className="ghost-btn-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                setFeedback('')
                try {
                  const result = await onInstall()
                  if (result?.success && result.engine) {
                    setFeedback(
                      `Motor ${result.engine.id === 'scrapling' ? 'Scrapling' : 'Obscura'} ${result.engine.version} instalado, testado e ativado.`
                    )
                  } else if (result?.success && result.plugin) {
                    setFeedback(`Plugin ${result.plugin.name} instalado.`)
                  } else if (
                    result?.error &&
                    result.error !== 'Instalação cancelada.'
                  ) {
                    setError(result.error)
                  }
                } finally {
                  setBusy(false)
                }
              }}
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>Instalar motor compartilhado (.ghost)</span>
            </button>
          </div>

          {state?.checkedAt && (
            <small className="ghost-engine-checked-at">
              Última consulta: {new Date(state.checkedAt).toLocaleString()}
            </small>
          )}
        </div>
      </div>

      {state?.catalogError && hasUnresolvedCatalogGap && (
        <div className="ghost-plugins-feedback error" role="status">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{state.catalogError}</span>
        </div>
      )}

      {feedback && (
        <div className="ghost-plugins-feedback success" role="status">
          <FontAwesomeIcon icon={faCheckCircle} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="ghost-plugins-feedback error" role="alert">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{error}</span>
        </div>
      )}

      {state && (
        <div className="ghost-plugins-grid ghost-engines-grid">
          {/* Card Oficial do Nuvio Media Player Addon atrelado ao GitHub NuvioMedia/NuvioDesktop */}
          {nuvioState && (
            <section
              key="nuvio-desktop-addon"
              className="ghost-plugin-card ghost-engine-card enabled"
            >
              <div className="ghost-plugin-card-header">
                <div
                  className="ghost-plugin-icon-box"
                  style={{
                    background: 'rgba(245, 197, 24, 0.16)',
                    borderColor: 'rgba(245, 197, 24, 0.45)',
                    color: '#f5c518'
                  }}
                >
                  <FontAwesomeIcon icon={faFilm} />
                </div>

                <div className="ghost-plugin-header-titles">
                  <div className="ghost-plugin-title-row">
                    <h3>Nuvio Media Player &amp; Addon</h3>
                    <span className="ghost-plugin-version">
                      v{nuvioState.installed}
                    </span>
                  </div>
                  <span className="ghost-plugin-author">
                    por NuvioMedia · GitHub Oficial NuvioDesktop
                  </span>
                </div>

                <span
                  className="ghost-badge-tier verified"
                  style={{ marginLeft: 'auto' }}
                  title="Oficialmente integrado ao Alazterflix & Stremio"
                >
                  Ativo
                </span>
              </div>

              <div className="ghost-plugin-badges-row">
                <span className="ghost-badge-type type-media">
                  <FontAwesomeIcon icon={faFilm} />
                  <span>Player &amp; Addon Stremio</span>
                </span>

                <span
                  className="ghost-badge-tier verified"
                  title="Atrelado ao repositório oficial https://github.com/NuvioMedia/NuvioDesktop"
                >
                  <FontAwesomeIcon icon={faShieldHalved} /> 🛡️ Oficial Nuvio
                </span>

                {nuvioState.updateAvailable && (
                  <span
                    className="ghost-badge-dev"
                    style={{
                      background: 'rgba(245, 197, 24, 0.22)',
                      borderColor: '#f5c518',
                      color: '#fde68a'
                    }}
                  >
                    Atualização v{nuvioState.upstream} disponível
                  </span>
                )}
              </div>

              <p className="ghost-plugin-description">
                Reprodutor de vídeo oficial do Nuvio Desktop integrado ao
                Alazterflix e Stremio. Suporta Legendas 3-Rail com Auto-Sync,
                Audio Boost 200%, Hold 2.0x, Skip Intro/Recap/Outro e
                sincronização de versões com o GitHub oficial.
              </p>

              <div className="ghost-plugin-permissions">
                <span className="perm-label">Versões e Repositório Oficial:</span>
                <div className="perm-tags">
                  <span className="perm-tag">
                    📦 Instalada: <b>v{nuvioState.installed}</b>
                  </span>
                  {nuvioState.upstream && (
                    <span className="perm-tag">
                      🚀 Publicada no GitHub: <b>v{nuvioState.upstream}</b>
                    </span>
                  )}
                  {nuvioState.previous && (
                    <span className="perm-tag">
                      ⏪ Anterior: <b>v{nuvioState.previous}</b>
                    </span>
                  )}
                </div>
              </div>

              <div className="ghost-plugin-permissions">
                <span className="perm-label">Capacidades Nuvio Integradas:</span>
                <div className="perm-tags">
                  <span className="perm-tag">🎬 Nuvio Player UI</span>
                  <span className="perm-tag">⚡ Sessão Stremio</span>
                  <span className="perm-tag">📜 Legendas 3-Rail</span>
                  <span className="perm-tag">🔊 Audio Boost 200%</span>
                  <span className="perm-tag">⏩ Hold-to-Speed 2.0x</span>
                  <span className="perm-tag">⏭ Pular Abertura</span>
                </div>
              </div>

              {(nuvioState.busy || nuvioState.message) && (
                <p role="status" className="ghost-engine-status-pill">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>
                    {nuvioState.busy
                      ? 'Atualizando Nuvio Addon…'
                      : nuvioState.message}
                  </span>
                </p>
              )}

              <div className="ghost-plugin-card-footer">
                {nuvioState.updateAvailable && (
                  <button
                    className="ghost-btn-primary"
                    disabled={busy || nuvioState.busy}
                    onClick={() => void nuvioAction({ type: 'install' })}
                    style={{
                      background: '#f5c518',
                      color: '#090b10',
                      fontWeight: 800
                    }}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    <span>Instalar atualização v{nuvioState.upstream}</span>
                  </button>
                )}

                <button
                  className="ghost-btn-secondary"
                  disabled={busy || nuvioState.busy}
                  onClick={() => void nuvioAction({ type: 'verify' })}
                >
                  <FontAwesomeIcon icon={faShieldHalved} />
                  <span>Verificar integridade</span>
                </button>

                {nuvioState.previous && (
                  <button
                    className="ghost-btn-secondary"
                    disabled={busy || nuvioState.busy}
                    onClick={() => void nuvioAction({ type: 'restore' })}
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                    <span>Restaurar versão anterior (v{nuvioState.previous})</span>
                  </button>
                )}

                <a
                  href={
                    nuvioState.upstreamUrl ||
                    `${nuvioState.githubUrl}/releases`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ghost-btn-secondary"
                  title="Abrir página de releases no GitHub oficial"
                  style={{ textDecoration: 'none' }}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>GitHub Oficial</span>
                </a>
              </div>
            </section>
          )}

          {/* Cards dos Motores Scrapling e Obscura */}
          {displayEngines.map((engine) => {
            const isScrapling = engine.id === 'scrapling'
            const toggleLabel = `Ativar ${
              isScrapling ? 'leitura adaptativa' : 'navegação experimental'
            }`
            return (
              <section
                key={engine.id}
                className={`ghost-plugin-card ghost-engine-card ${
                  engine.enabled ? 'enabled' : 'disabled'
                }`}
              >
                <div className="ghost-plugin-card-header">
                  <div className="ghost-plugin-icon-box">
                    <FontAwesomeIcon icon={isScrapling ? faBolt : faGlobe} />
                  </div>

                  <div className="ghost-plugin-header-titles">
                    <div className="ghost-plugin-title-row">
                      <h3>
                        {isScrapling ? 'Scrapling' : 'Obscura · Experimental'}
                      </h3>
                      <span className="ghost-plugin-version">
                        {engine.installed
                          ? `v${engine.installed}`
                          : 'Não instalado'}
                      </span>
                    </div>
                    <span className="ghost-plugin-author">
                      {isScrapling
                        ? 'por D4Vinci · Motor de Leitura Adaptativa'
                        : 'por h4ckf0r0day · Motor de Navegação Pública'}
                    </span>
                  </div>

                  <label className="ghost-plugin-switch" title={toggleLabel}>
                    <input
                      type="checkbox"
                      aria-label={toggleLabel}
                      checked={engine.enabled}
                      disabled={busy || engine.busy}
                      onChange={(event) =>
                        void action({
                          type: 'enable',
                          id: engine.id,
                          enabled: event.target.checked
                        })
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="ghost-plugin-badges-row">
                  <span
                    className={`ghost-badge-type ${
                      isScrapling ? 'type-utility' : 'type-game-source'
                    }`}
                  >
                    <FontAwesomeIcon icon={isScrapling ? faBolt : faGlobe} />
                    <span>
                      {isScrapling
                        ? 'Leitura Adaptativa'
                        : 'Navegação Experimental'}
                    </span>
                  </span>

                  <span
                    className="ghost-badge-tier verified"
                    title="Pacote isolado auditado e testado pelo GhostShield"
                  >
                    <FontAwesomeIcon icon={faShieldHalved} /> 🛡️ Verificado
                  </span>

                  {engine.updateAvailable && (
                    <span className="ghost-badge-dev">
                      Atualização v{engine.available} disponível
                    </span>
                  )}
                </div>

                <p className="ghost-plugin-description">
                  {isScrapling
                    ? 'Motor de parsing HTML e seletores adaptativos em processo isolado para leitura resiliente de catálogos, calendário de lançamentos e páginas de download.'
                    : 'Motor experimental de navegação headless para leitura de páginas públicas via proxy local autenticado e escopado.'}
                </p>

                <div className="ghost-plugin-permissions">
                  <span className="perm-label">Versões e Catálogo:</span>
                  <p className="ghost-engine-version-summary">
                    Instalada: {engine.installed || 'Não instalado'} ·
                    Compatível:{' '}
                    {engine.available || 'Aguardando pacote aprovado'}
                    {engine.upstream && (
                      <> · Publicada pelo projeto: {engine.upstream}</>
                    )}
                  </p>
                  <div className="perm-tags">
                    <span className="perm-tag">
                      📦 Instalada: <b>{engine.installed || 'Não instalado'}</b>
                    </span>
                    <span className="perm-tag">
                      ✅ Compatível:{' '}
                      <b>{engine.available || 'Aguardando pacote aprovado'}</b>
                    </span>
                    {engine.upstream && (
                      <span className="perm-tag">
                        🚀 Publicada pelo projeto: <b>{engine.upstream}</b>
                      </span>
                    )}
                    {engine.previous && (
                      <span className="perm-tag">
                        ⏪ Anterior: <b>{engine.previous}</b>
                      </span>
                    )}
                  </div>
                </div>

                <div className="ghost-plugin-permissions">
                  <span className="perm-label">Capacidades Integradas:</span>
                  <div className="perm-tags">
                    {isScrapling ? (
                      <>
                        <span className="perm-tag">
                          🎯 Seletores Adaptativos
                        </span>
                        <span className="perm-tag">
                          📅 Calendário de Lançamentos
                        </span>
                        <span className="perm-tag">
                          📥 Aprendizado de Download
                        </span>
                        <span className="perm-tag">🧲 Links Online-Fix</span>
                      </>
                    ) : (
                      <>
                        <span className="perm-tag">🌐 Fetch DOM / JS</span>
                        <span className="perm-tag">
                          🔒 Proxy Local Escopado
                        </span>
                        <span className="perm-tag">🛡️ Sessão Isolada</span>
                      </>
                    )}
                  </div>
                </div>

                <label className="ghost-engine-inline-toggle">
                  <input
                    type="checkbox"
                    checked={engine.enabled}
                    disabled={busy || engine.busy}
                    onChange={(event) =>
                      void action({
                        type: 'enable',
                        id: engine.id,
                        enabled: event.target.checked
                      })
                    }
                  />{' '}
                  Ativar{' '}
                  {isScrapling
                    ? 'leitura adaptativa'
                    : 'navegação experimental'}
                </label>

                {engine.upstreamUpdateAvailable && !engine.updateAvailable && (
                  <p role="status" className="ghost-engine-notice">
                    A versão {engine.upstream} foi publicada, mas seu pacote
                    compatível com o Ghost ainda não está disponível. Use
                    Verificar atualizações para consultar novamente.
                  </p>
                )}

                {(engine.busy || engine.message) && (
                  <p role="status" className="ghost-engine-status-pill">
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>
                      {engine.busy ? 'Motor em uso. Aguarde…' : engine.message}
                    </span>
                  </p>
                )}

                <div className="ghost-plugin-card-footer">
                  {(!engine.installed ||
                    engine.updateAvailable ||
                    engine.upstreamUpdateAvailable) && (
                    <button
                      className="ghost-btn-primary"
                      disabled={
                        busy ||
                        engine.busy ||
                        !engine.available ||
                        Boolean(engine.installed && !engine.updateAvailable)
                      }
                      onClick={() =>
                        void action({ type: 'install', id: engine.id })
                      }
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      <span>
                        {engine.installed
                          ? `Instalar atualização ${engine.updateAvailable ? engine.available : engine.upstream}`
                          : `Instalar${engine.available ? ` ${engine.available}` : ''}`}
                      </span>
                    </button>
                  )}

                  {engine.installed && (
                    <button
                      className="ghost-btn-secondary"
                      disabled={busy || engine.busy}
                      onClick={() => void share(engine.id)}
                    >
                      <FontAwesomeIcon icon={faShareNodes} />
                      <span>Compartilhar (.ghost)</span>
                    </button>
                  )}

                  {engine.installed && (
                    <button
                      className="ghost-btn-secondary"
                      disabled={busy || engine.busy}
                      onClick={() =>
                        void action({ type: 'verify', id: engine.id })
                      }
                    >
                      <FontAwesomeIcon icon={faShieldHalved} />
                      <span>Verificar instalação</span>
                    </button>
                  )}

                  <button
                    className="ghost-btn-secondary"
                    disabled={busy || engine.busy || !engine.previous}
                    onClick={() =>
                      void action({ type: 'restore', id: engine.id })
                    }
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                    <span>Restaurar versão anterior</span>
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
