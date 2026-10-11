import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFolderPlus,
  faFolder,
  faRotate,
  faXmark,
  faPlus,
  faTrashAlt,
  faSlidersH,
  faFilm,
  faPuzzlePiece,
  faListUl,
  faLayerGroup,
  faTags,
  faBarsStaggered,
  faArrowsLeftRight,
  faClosedCaptioning
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import type { CinemaLibraryState } from 'common/types/plugins'
import './index.scss'
import MetadataSettings from './MetadataSettings'
import SubtitleStyleSettings from './SubtitleStyleSettings'
import { describeMediaError } from './errors'
import CatalogCardSettings from './CatalogCardSettings'

interface Props {
  close: () => void
}

export default function AlazterflixSettingsDialog({ close }: Props) {
  const navigate = useNavigate()
  const [state, setState] = useState<CinemaLibraryState>({
    isPluginActive: false,
    folders: [],
    movies: [],
    addons: [],
    playbackHistory: {}
  })
  const [loading, setLoading] = useState(true)
  const [newAddonUrl, setNewAddonUrl] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<
    'folders' | 'addons' | 'playback' | 'artwork' | 'subtitles' | 'appearance'
  >('folders')

  const [seasonDrawerLayout, setSeasonDrawerLayout] = useState<
    'dropdown' | 'pills' | 'accordion' | 'stepper'
  >(() => {
    return (
      (localStorage.getItem(
        'ghost_alazterflix_season_drawer_layout'
      ) as 'dropdown' | 'pills' | 'accordion' | 'stepper') || 'stepper'
    )
  })

  const handleUpdateSeasonDrawerLayout = (
    layout: 'dropdown' | 'pills' | 'accordion' | 'stepper'
  ) => {
    setSeasonDrawerLayout(layout)
    localStorage.setItem('ghost_alazterflix_season_drawer_layout', layout)
    window.dispatchEvent(new Event('storage'))
  }

  const loadState = async () => {
    try {
      setLoading(true)
      const data = await window.api.cinemaGetState()
      setState(
        data || {
          isPluginActive: false,
          folders: [],
          movies: [],
          addons: [],
          playbackHistory: {}
        }
      )
    } catch (err) {
      console.error('[AlazterflixSettings] Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadState()
  }, [])

  const handleAddFolder = async () => {
    try {
      const selectedPath = await window.api.cinemaPickFolder()
      if (selectedPath) {
        setLoading(true)
        const updated = await window.api.cinemaAddFolder(selectedPath)
        setState(updated)
        setFeedback('Pasta adicionada e escaneada com sucesso!')
      }
    } catch (err) {
      setFeedback(`Erro: ${describeMediaError(err)}`)
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  const handleRemoveFolder = async (folderPath: string) => {
    try {
      setLoading(true)
      const updated = await window.api.cinemaRemoveFolder(folderPath)
      setState(updated)
      setFeedback('Pasta removida da biblioteca.')
    } catch (err) {
      setFeedback(`Erro: ${describeMediaError(err)}`)
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  const handleRescan = async () => {
    try {
      setLoading(true)
      const movies = await window.api.cinemaScanFolders()
      setState((prev) => ({ ...prev, movies }))
      setFeedback(
        `Re-escaneamento concluído: ${movies.length} filme(s) encontrados!`
      )
    } catch (err) {
      setFeedback(`Erro: ${describeMediaError(err)}`)
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  const handleInstallAddon = async (urlToInstall?: string) => {
    const url = (urlToInstall || newAddonUrl).trim()
    if (!url) return
    try {
      setFeedback('Instalando addon...')
      const res = await window.api.cinemaStremioAddAddon(url)
      if (res.success && res.addon) {
        setFeedback(`Addon "${res.addon.name}" instalado com sucesso!`)
        setNewAddonUrl('')
        loadState()
      } else {
        setFeedback(`Erro: ${res.error || 'Falha ao instalar addon.'}`)
      }
    } catch (err) {
      setFeedback(`Erro: ${describeMediaError(err)}`)
    }
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleRemoveAddon = async (addonId: string) => {
    try {
      await window.api.cinemaStremioRemoveAddon(addonId)
      loadState()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div
      className="alazter-modal-overlay alazter-plugin-settings-overlay"
      onClick={close}
    >
      <div
        className="modal-container alazter-plugin-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do Alazterflix"
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          aria-label="Fechar configurações"
          onClick={close}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {/* Modal Header */}
        <div
          style={{
            padding: '24px 28px 16px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #e50914, #00ffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '18px',
                boxShadow: '0 0 12px rgba(229, 9, 20, 0.5)'
              }}
            >
              <FontAwesomeIcon icon={faFilm} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  color: '#ffffff',
                  fontWeight: 800
                }}
              >
                Configurações do Alazterflix
              </h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Gerencie pastas Jellyfin, Addons do Stremio e opções de
                streaming do plugin
              </span>
            </div>
          </div>

          {/* Subtabs */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '16px',
              flexWrap: 'wrap'
            }}
          >
            <button type="button" className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveSubTab('appearance')} style={{ padding: '6px 14px', fontSize: '12px' }}>Aparência dos cards</button>
            <button
              className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'artwork' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('artwork')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              Capas e metadados
            </button>
            <button
              className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'folders' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('folders')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <FontAwesomeIcon icon={faFolder} />
              <span>Pastas ({state.folders.length})</span>
            </button>
            <button
              className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'addons' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('addons')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <FontAwesomeIcon icon={faPuzzlePiece} />
              <span>Addons Stremio ({state.addons.length})</span>
            </button>
            <button
              className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'playback' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('playback')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <FontAwesomeIcon icon={faSlidersH} />
              <span>Reprodução & Player</span>
            </button>
            <button
              className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'subtitles' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('subtitles')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <FontAwesomeIcon icon={faClosedCaptioning} />
              <span>Legendas</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            style={{
              background: 'rgba(0, 255, 255, 0.1)',
              borderBottom: '1px solid #00ffff',
              color: '#00ffff',
              padding: '8px 28px',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            {feedback}
          </div>
        )}

        {/* Modal Body */}
        <div
          style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}
        >
          {activeSubTab === 'appearance' && <CatalogCardSettings movie={state.movies.find((movie) => movie.coverUrl || movie.localCoverPath) || state.movies[0]} />}
          {activeSubTab === 'artwork' && (
            <MetadataSettings
              settings={state.metadataSettings}
              onSaved={(metadataSettings) =>
                setState((previous) => ({ ...previous, metadataSettings }))
              }
            />
          )}
          {/* TAB: PASTAS LOCAIS */}
          {activeSubTab === 'folders' && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: '0 0 4px 0',
                      color: '#fff',
                      fontSize: '15px'
                    }}
                  >
                    Pastas de Filmes Monitoradas
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                    O Alazterflix escaneia arquivos .mp4, .mkv, .avi e extrai
                    capas e metadados ao estilo Jellyfin.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="button is-primary is-small"
                    onClick={handleAddFolder}
                  >
                    <FontAwesomeIcon icon={faFolderPlus} />
                    <span>Adicionar Pasta</span>
                  </button>
                  <button
                    className="button is-secondary is-small"
                    onClick={handleRescan}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faRotate} spin={loading} />
                    <span>Re-escanear</span>
                  </button>
                </div>
              </div>

              {state.folders.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {state.folders.map((f) => (
                    <div
                      key={f}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '10px 14px'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          overflow: 'hidden'
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faFolder}
                          style={{ color: '#00ffff' }}
                        />
                        <span
                          style={{
                            fontSize: '13px',
                            color: '#e2e8f0',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {f}
                        </span>
                      </div>
                      <button
                        className="button is-danger is-small"
                        onClick={() => handleRemoveFolder(f)}
                        title="Remover pasta"
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                >
                  <FontAwesomeIcon
                    icon={faFolder}
                    style={{
                      fontSize: '32px',
                      marginBottom: '8px',
                      color: 'rgba(255,255,255,0.2)'
                    }}
                  />
                  <div>Nenhuma pasta de filmes configurada.</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Adicione uma pasta para indexar seus filmes locais.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ADDONS DO STREMIO */}
          {activeSubTab === 'addons' && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="URL do Addon Stremio (ex: https://.../manifest.json)"
                  value={newAddonUrl}
                  onChange={(e) => setNewAddonUrl(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button
                  className="button is-primary is-small"
                  onClick={() => handleInstallAddon()}
                  disabled={!newAddonUrl.trim()}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Instalar</span>
                </button>
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Atalhos rápidos de 1-Clique:
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    className="ghostCinemaScreen__presetPill"
                    onClick={() =>
                      handleInstallAddon(
                        'https://v3-cinemeta.strem.io/manifest.json'
                      )
                    }
                  >
                    🎬 Cinemeta (Oficial)
                  </button>
                  <button
                    className="ghostCinemaScreen__presetPill"
                    onClick={() =>
                      handleInstallAddon(
                        'https://opensubtitles-v3.strem.io/manifest.json'
                      )
                    }
                  >
                    💬 OpenSubtitles v3
                  </button>
                </div>
              </div>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {state.addons.map((addon) => (
                  <div
                    key={addon.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '10px 14px'
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#fff'
                        }}
                      >
                        {addon.name}{' '}
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          v{addon.version}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {addon.description || addon.manifestUrl}
                      </div>
                    </div>
                    {addon.id !== 'org.stremio.cinemeta' && (
                      <button
                        className="button is-danger is-small"
                        onClick={() => handleRemoveAddon(addon.id)}
                        title="Remover addon"
                      >
                        <FontAwesomeIcon icon={faTrashAlt} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: REPRODUÇÃO & PLAYER */}
          {activeSubTab === 'playback' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                fontSize: '13px'
              }}
            >
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: '6px'
                  }}
                >
                  ⚡ Servidor Local HTTP 206 (Range Streaming)
                </div>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    lineHeight: 1.5
                  }}
                >
                  O Alazterflix utiliza um servidor local dedicado com suporte
                  nativo a cabeçalhos <code>HTTP 206 Partial Content</code>,
                  permitindo seek instantâneo sem congelamentos e reprodução
                  suave acelerada por hardware de vídeos 4K e 1080p.
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    color: '#00ffff',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                >
                  ✓ Status: Servidor Operacional & Pronto
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: '6px'
                  }}
                >
                  💾 Histórico & Salvar Progresso Automático
                </div>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    lineHeight: 1.5
                  }}
                >
                  O progresso dos filmes é persistido a cada 5 segundos no
                  armazenamento isolado do plugin (
                  <code>plugins_data/com.ghost.alazterflix.json</code>),
                  alimentando o trilho &quot;Continuar Assistindo&quot; com
                  tempo restante em minutos e porcentagem.
                </div>
              </div>

              {/* Layout das Temporadas na Gaveta de Episódios */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FontAwesomeIcon
                    icon={faListUl}
                    style={{ color: 'var(--alazter-cyan)' }}
                  />
                  <span>Layout das Temporadas na Gaveta do Player</span>
                </div>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    marginBottom: '10px'
                  }}
                >
                  Escolha o estilo de exibição dos botões de temporada na gaveta lateral de episódios do player:
                </div>
                <div className="season-layout-options-grid">
                  <div
                    className={`season-layout-option-card ${
                      seasonDrawerLayout === 'stepper' ? 'active' : ''
                    }`}
                    onClick={() => handleUpdateSeasonDrawerLayout('stepper')}
                  >
                    <div className="layout-card-badge" style={{ background: 'rgba(0, 229, 255, 0.25)', borderColor: '#00e5ff', color: '#00e5ff' }}>Padrão</div>
                    <div className="layout-card-title">
                      <FontAwesomeIcon icon={faArrowsLeftRight} />
                      <span>Stepper (&lt; 3ª TEMPORADA &gt;)</span>
                    </div>
                    <div className="layout-card-desc">
                      Navegação linear por setas (&lt; e &gt;) com temporada no centro. O botão apaga e fica não-clicável no início ou fim.
                    </div>
                  </div>

                  <div
                    className={`season-layout-option-card ${
                      seasonDrawerLayout === 'dropdown' ? 'active' : ''
                    }`}
                    onClick={() => handleUpdateSeasonDrawerLayout('dropdown')}
                  >
                    <div className="layout-card-title">
                      <FontAwesomeIcon icon={faLayerGroup} />
                      <span>Dropdown Stremio</span>
                    </div>
                    <div className="layout-card-desc">
                      Menu suspenso elegante no topo (Apple TV style). Ocupa mínimo espaço e desafoga a lista de episódios.
                    </div>
                  </div>

                  <div
                    className={`season-layout-option-card ${
                      seasonDrawerLayout === 'pills' ? 'active' : ''
                    }`}
                    onClick={() => handleUpdateSeasonDrawerLayout('pills')}
                  >
                    <div className="layout-card-title">
                      <FontAwesomeIcon icon={faTags} />
                      <span>Pílulas Netflix</span>
                    </div>
                    <div className="layout-card-desc">
                      Chips horizontais flexíveis lado a lado. Salto direto para qualquer temporada em 1 clique.
                    </div>
                  </div>

                  <div
                    className={`season-layout-option-card ${
                      seasonDrawerLayout === 'accordion' ? 'active' : ''
                    }`}
                    onClick={() => handleUpdateSeasonDrawerLayout('accordion')}
                  >
                    <div className="layout-card-title">
                      <FontAwesomeIcon icon={faBarsStaggered} />
                      <span>Sanfona Jellyfin</span>
                    </div>
                    <div className="layout-card-desc">
                      Seções colapsáveis na própria lista de episódios. Ideal para visualização contínua de episódios.
                    </div>
                  </div>
                </div>
              </div>

              {/* Estilo Padrão de Legendas */}
              <div style={{ marginTop: '16px' }}>
                <SubtitleStyleSettings />
              </div>
            </div>
          )}

          {/* TAB: LEGENDAS */}
          {activeSubTab === 'subtitles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SubtitleStyleSettings />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            className="button is-primary"
            onClick={() => {
              close()
              navigate('/alazterflix')
            }}
          >
            <FontAwesomeIcon icon={faFilm} />
            <span>Abrir Alazterflix</span>
          </button>

          <button className="button is-secondary" onClick={close}>
            <span>Fechar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
