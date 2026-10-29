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
  faClosedCaptioning,
  faDownload,
  faRotateLeft,
  faTowerBroadcast,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import type { CinemaLibraryState } from 'common/types/plugins'
import './index.scss'
import MetadataSettings from './MetadataSettings'
import SubtitleStyleSettings from './SubtitleStyleSettings'
import { describeMediaError } from './errors'
import CatalogCardSettings from './CatalogCardSettings'
import IptvPlaylistsSettings from './IptvPlaylistsSettings'
import {
  RECOMMENDED_STREMIO_ADDONS,
  normalizeStremioAddonUrl,
  generateStremioShareLinks
} from 'common/stremioAddonUtils'
import type { NuvioAddonUpdateState } from 'common/types/nuvioUpdate'
import {
  AlazterflixVideoPlayerId,
  getPreferredVideoPlayer,
  loadNuvioPlayerPreferences,
  NuvioPlayerPreferences,
  saveNuvioPlayerPreferences,
  setPreferredVideoPlayer
} from './nuvioPlayerConfig'

interface Props {
  close: () => void
  initialSubTab?:
    | 'folders'
    | 'addons'
    | 'playback'
    | 'artwork'
    | 'subtitles'
    | 'appearance'
    | 'iptv'
}

export default function AlazterflixSettingsDialog({
  close,
  initialSubTab = 'folders'
}: Props) {
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
  const [isFullScanning, setIsFullScanning] = useState(false)
  const [isStremioRevalidating, setIsStremioRevalidating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<
    'folders' | 'addons' | 'playback' | 'artwork' | 'subtitles' | 'appearance' | 'iptv'
  >(initialSubTab)

  const [preferredPlayer, setPreferredPlayerState] =
    useState<AlazterflixVideoPlayerId>(() => getPreferredVideoPlayer())
  const [nuvioPrefs, setNuvioPrefs] = useState<NuvioPlayerPreferences>(() =>
    loadNuvioPlayerPreferences()
  )

  const [nuvioUpdate, setNuvioUpdate] = useState<NuvioAddonUpdateState>()
  const [checkingNuvio, setCheckingNuvio] = useState(false)
  const [downloadDirs, setDownloadDirs] = useState<{
    moviesDir?: string
    seriesDir?: string
    animesDir?: string
  }>({})

  useEffect(() => {
    if (window.api?.pluginsNuvioAddonState) {
      window.api.pluginsNuvioAddonState().then(setNuvioUpdate).catch(() => {})
    }
    if (window.api?.cinemaGetDownloadDirectories) {
      window.api.cinemaGetDownloadDirectories().then(setDownloadDirs).catch(() => {})
    }
  }, [])

  const handlePickDownloadDir = async (type: 'movies' | 'series' | 'animes') => {
    if (!window.api?.cinemaPickFolder) return
    try {
      const picked = await window.api.cinemaPickFolder()
      if (picked) {
        const patch = { [type === 'movies' ? 'moviesDir' : type === 'series' ? 'seriesDir' : 'animesDir']: picked }
        const updated = await window.api.cinemaSetDownloadDirectories(patch)
        setDownloadDirs(updated)
        if (window.api?.cinemaAddFolder) {
          const newState = await window.api.cinemaAddFolder(picked)
          setState(newState)
        }
        setFeedback(`Pasta de ${type} salva e adicionada à biblioteca monitorada!`)
        setTimeout(() => setFeedback(null), 3000)
      }
    } catch {
      setFeedback('Erro ao selecionar pasta no HD.')
    }
  }

  const handleCheckNuvioUpdates = async () => {
    if (!window.api?.pluginsNuvioAddonAction) return
    setCheckingNuvio(true)
    try {
      const res = await window.api.pluginsNuvioAddonAction({ type: 'check' })
      if (res.state) setNuvioUpdate(res.state)
      setFeedback(res.state?.message || 'Consulta ao GitHub oficial concluída.')
    } catch {
      setFeedback('Erro ao consultar atualizações no GitHub oficial.')
    } finally {
      setCheckingNuvio(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  const handleInstallNuvioUpdate = async () => {
    if (!window.api?.pluginsNuvioAddonAction) return
    setCheckingNuvio(true)
    try {
      const res = await window.api.pluginsNuvioAddonAction({ type: 'install' })
      if (res.state) setNuvioUpdate(res.state)
      setFeedback(res.state?.message || 'Nuvio Addon atualizado com sucesso!')
    } catch {
      setFeedback('Erro ao instalar atualização do Nuvio Addon.')
    } finally {
      setCheckingNuvio(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  const handleRestoreNuvioUpdate = async () => {
    if (!window.api?.pluginsNuvioAddonAction) return
    setCheckingNuvio(true)
    try {
      const res = await window.api.pluginsNuvioAddonAction({ type: 'restore' })
      if (res.state) setNuvioUpdate(res.state)
      setFeedback(res.state?.message || 'Versão anterior restaurada!')
    } catch {
      setFeedback('Erro ao restaurar versão anterior do Nuvio Addon.')
    } finally {
      setCheckingNuvio(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  const handleSelectVideoPlayer = (player: AlazterflixVideoPlayerId) => {
    setPreferredPlayerState(player)
    setPreferredVideoPlayer(player)
    setNuvioPrefs(loadNuvioPlayerPreferences())
    setFeedback(
      player === 'nuvio'
        ? 'Player de vídeo alterado para: Nuvio Media Player (Mídias Locais & Stremio)!'
        : 'Player de vídeo alterado para: Alazterflix Cyber-Neon Player!'
    )
    setTimeout(() => setFeedback(null), 3200)
  }

  const handleToggleNuvioPref = (patch: Partial<NuvioPlayerPreferences>) => {
    const updated = saveNuvioPlayerPreferences(patch)
    setNuvioPrefs(updated)
  }

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
      setFeedback('Revalidando caminhos locais e arquivos movidos no HD...')
      const movies = await window.api.cinemaScanFolders(undefined, {
        skipMetadata: true
      })
      setState((prev) => ({ ...prev, movies }))
      setFeedback(
        `✓ Revalidação concluída: ${movies.length} item(ns) sincronizados!`
      )
    } catch (err) {
      setFeedback(`Erro ao revalidar: ${describeMediaError(err)}`)
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  const handleFullScan = async () => {
    try {
      setLoading(true)
      setIsFullScanning(true)
      setFeedback('Iniciando Scan Completo: revalidando pastas e buscando capas...')
      const movies = await window.api.cinemaAutoCatalog()
      setState((prev) => ({ ...prev, movies }))
      setFeedback(
        `✓ Scan Completo concluído com sucesso: ${movies.length} item(ns) sincronizados e capas verificadas!`
      )
    } catch (err) {
      setFeedback(`Erro no Scan Completo: ${describeMediaError(err)}`)
    } finally {
      setLoading(false)
      setIsFullScanning(false)
      setTimeout(() => setFeedback(null), 4500)
    }
  }

  const handleRevalidateWithStremio = async () => {
    try {
      setLoading(true)
      setIsStremioRevalidating(true)
      setFeedback('Iniciando revalidação Stremio: buscando títulos oficiais e capas via Cinemeta...')
      const res = await window.api.cinemaRevalidateWithStremio()
      if (res && Array.isArray(res.movies)) {
        setState((prev) => ({ ...prev, movies: res.movies }))
        setFeedback(
          `✓ Revalidação Stremio concluída com sucesso: ${res.updatedCount} obra(s) atualizada(s)!`
        )
      } else {
        setFeedback('✓ Revalidação Stremio concluída!')
      }
    } catch (err) {
      setFeedback(`Erro ao revalidar com Stremio: ${describeMediaError(err)}`)
    } finally {
      setLoading(false)
      setIsStremioRevalidating(false)
      setTimeout(() => setFeedback(null), 4500)
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
              className={`ghostCinemaScreen__tabBtn ${activeSubTab === 'iptv' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('iptv')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <FontAwesomeIcon icon={faTowerBroadcast} />
              <span>Listas IPTV (M3U / M3U8)</span>
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
          {activeSubTab === 'iptv' && <IptvPlaylistsSettings />}
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
                    O Alazterflix escaneia arquivos de mídia e organiza sua biblioteca ao estilo Jellyfin. Use "Re-escanear" para revalidar caminhos de arquivos movidos ou novas pastas (rápido, sem baixar capas), ou "Scan Completo" para buscar capas e metadados na internet.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="button is-primary is-small"
                    onClick={handleAddFolder}
                    title="Adicionar nova pasta monitorada"
                  >
                    <FontAwesomeIcon icon={faFolderPlus} />
                    <span>Adicionar Pasta</span>
                  </button>
                  <button
                    className="button is-secondary is-small"
                    onClick={handleRescan}
                    disabled={loading}
                    title="Revalidação rápida de caminhos e arquivos movidos no disco (rápido, sem download de capas)"
                  >
                    <FontAwesomeIcon icon={faRotate} spin={loading && !isFullScanning} />
                    <span>Re-escanear</span>
                  </button>
                  <button
                    className="button is-warning is-small"
                    onClick={handleFullScan}
                    disabled={loading}
                    title="Scan Completo: Revalida arquivos locais, novas pastas e busca capas/metadados na internet"
                  >
                    <FontAwesomeIcon icon={faLayerGroup} spin={loading && isFullScanning} />
                    <span>Scan Completo</span>
                  </button>
                  <button
                    className="button is-small"
                    onClick={handleRevalidateWithStremio}
                    disabled={loading}
                    title="Revalidar títulos oficiais, capas e metadados das mídias locais através do Stremio / Cinemeta"
                    style={{
                      background: 'rgba(142, 68, 173, 0.25)',
                      borderColor: '#a855f7',
                      color: '#e9d5ff'
                    }}
                  >
                    <FontAwesomeIcon icon={faWandMagicSparkles} spin={loading && isStremioRevalidating} />
                    <span>Revalidar com Stremio</span>
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

              {/* SEÇÃO: DESTINO DE SALVAMENTO NO HD (DOWNLOADS DO STREMIO) */}
              <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '15px' }}>
                      📁 Destino de Salvamento no HD (Download de Mídias Stremio)
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                      Configure as pastas do HD onde suas mídias do Stremio serão salvas. O Ghost organiza em pastas por título e temporada e adiciona tudo à sua Biblioteca local automaticamente.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Destino Filmes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--alazter-cyan, #00ffff)', fontWeight: 600 }}>
                      Pasta Padrão para Filmes (HD):
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={downloadDirs.moviesDir || (state.folders[0] ? `${state.folders[0]}` : '')}
                        placeholder="Nenhuma pasta configurada para Filmes..."
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <button
                        className="button is-small is-primary"
                        onClick={() => handlePickDownloadDir('movies')}
                        type="button"
                      >
                        <FontAwesomeIcon icon={faFolderPlus} />
                        <span>Configurar Pasta</span>
                      </button>
                    </div>
                  </div>

                  {/* Destino Séries */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--alazter-cyan, #00ffff)', fontWeight: 600 }}>
                      Pasta Padrão para Séries (HD):
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={downloadDirs.seriesDir || downloadDirs.moviesDir || (state.folders[0] ? `${state.folders[0]}` : '')}
                        placeholder="Nenhuma pasta configurada para Séries..."
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <button
                        className="button is-small is-primary"
                        onClick={() => handlePickDownloadDir('series')}
                        type="button"
                      >
                        <FontAwesomeIcon icon={faFolderPlus} />
                        <span>Configurar Pasta</span>
                      </button>
                    </div>
                  </div>

                  {/* Destino Animes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--alazter-cyan, #00ffff)', fontWeight: 600 }}>
                      Pasta Padrão para Animes (HD):
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={downloadDirs.animesDir || downloadDirs.seriesDir || downloadDirs.moviesDir || (state.folders[0] ? `${state.folders[0]}` : '')}
                        placeholder="Nenhuma pasta configurada para Animes..."
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <button
                        className="button is-small is-primary"
                        onClick={() => handlePickDownloadDir('animes')}
                        type="button"
                      >
                        <FontAwesomeIcon icon={faFolderPlus} />
                        <span>Configurar Pasta</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ADDONS DO STREMIO */}
          {activeSubTab === 'addons' && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Cole URL manifest.json, link Share Addon (web.stremio.com/#/addons?addon=...) ou stremio://..."
                    value={newAddonUrl}
                    onChange={(e) => setNewAddonUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleInstallAddon()
                      }
                    }}
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
                {newAddonUrl.trim() && (
                  <div style={{ fontSize: '11px', color: '#00ffff' }}>
                    Manifesto resolvido:{' '}
                    <code>{normalizeStremioAddonUrl(newAddonUrl)}</code>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Atalhos rápidos de 1-Clique (Oficiais e Comunidade):
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginTop: '6px'
                  }}
                >
                  {RECOMMENDED_STREMIO_ADDONS.map((rec) => (
                    <button
                      key={rec.id}
                      className="ghostCinemaScreen__presetPill"
                      onClick={() => handleInstallAddon(rec.manifestUrl)}
                      title={rec.description}
                    >
                      🧩 {rec.name}
                    </button>
                  ))}
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
                      padding: '10px 14px',
                      gap: '10px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {addon.description || addon.manifestUrl}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="button is-small"
                        onClick={() => {
                          const share = generateStremioShareLinks(
                            addon.manifestUrl
                          ).webShareUrl
                          navigator.clipboard?.writeText(share).catch(() => {})
                          setFeedback(
                            `Link Share Addon copiado para "${addon.name}"!`
                          )
                          setTimeout(() => setFeedback(null), 3500)
                        }}
                        title="Copiar Link Share Addon"
                      >
                        Share
                      </button>
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
              {/* Seletor Principal de Player de Vídeo do Alazterflix */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(245, 197, 24, 0.35)'
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color: '#fff',
                    fontSize: '14px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FontAwesomeIcon
                    icon={faFilm}
                    style={{ color: '#f5c518' }}
                  />
                  <span>
                    Escolher Player de Vídeo do Alazterflix (Mídias Locais &
                    Sessão Stremio)
                  </span>
                </div>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    marginBottom: '12px',
                    lineHeight: 1.5
                  }}
                >
                  Selecione qual motor e interface de player de vídeo deseja
                  utilizar em todo o Alazterflix (tanto para filmes/séries do
                  seu computador quanto para streams de addons do Stremio):
                </div>

                <div
                  className="season-layout-options-grid"
                  style={{ gridTemplateColumns: '1fr 1fr' }}
                >
                  <div
                    className={`season-layout-option-card ${
                      preferredPlayer === 'nuvio' ? 'active' : ''
                    }`}
                    onClick={() => handleSelectVideoPlayer('nuvio')}
                    style={
                      preferredPlayer === 'nuvio'
                        ? {
                            borderColor: '#f5c518',
                            background: 'rgba(245, 197, 24, 0.12)'
                          }
                        : undefined
                    }
                  >
                    <div
                      className="layout-card-badge"
                      style={{
                        background: 'rgba(245, 197, 24, 0.25)',
                        borderColor: '#f5c518',
                        color: '#fde68a'
                      }}
                    >
                      Nuvio Addon
                    </div>
                    <div className="layout-card-title">
                      <FontAwesomeIcon
                        icon={faFilm}
                        style={{ color: '#f5c518' }}
                      />
                      <span>Nuvio Media Player (Nuvio Desktop)</span>
                    </div>
                    <div className="layout-card-desc">
                      Player oficial do Nuvio Desktop com legenda 3-Rail, Audio
                      Boost 200%, Hold-to-Speed 2.0x, Pular Abertura/Créditos,
                      Fontes Stremio ao vivo e Pause Metadata Overlay.
                    </div>
                  </div>

                  <div
                    className={`season-layout-option-card ${
                      preferredPlayer === 'alazterflix' ? 'active' : ''
                    }`}
                    onClick={() => handleSelectVideoPlayer('alazterflix')}
                  >
                    <div
                      className="layout-card-badge"
                      style={{
                        background: 'rgba(0, 229, 255, 0.22)',
                        borderColor: '#00e5ff',
                        color: '#00e5ff'
                      }}
                    >
                      Clássico
                    </div>
                    <div className="layout-card-title">
                      <FontAwesomeIcon
                        icon={faSlidersH}
                        style={{ color: '#00e5ff' }}
                      />
                      <span>Alazterflix Cyber-Neon Player</span>
                    </div>
                    <div className="layout-card-desc">
                      Player clássico do Alazterflix com estética Cyber-Neon,
                      gaveta lateral direita de temporadas e controles
                      tradicionais.
                    </div>
                  </div>
                </div>

                {preferredPlayer === 'nuvio' && (
                  <div
                    style={{
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px'
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        color: '#e2e8f0',
                        fontSize: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={nuvioPrefs.pauseOverlayEnabled}
                        onChange={(e) =>
                          handleToggleNuvioPref({
                            pauseOverlayEnabled: e.target.checked
                          })
                        }
                      />
                      <span>Overlay de Metadados na Pausa</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        color: '#e2e8f0',
                        fontSize: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={nuvioPrefs.openingOverlayEnabled}
                        onChange={(e) =>
                          handleToggleNuvioPref({
                            openingOverlayEnabled: e.target.checked
                          })
                        }
                      />
                      <span>Overlay Cinematográfico de Abertura</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        color: '#e2e8f0',
                        fontSize: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={nuvioPrefs.holdToSpeedEnabled}
                        onChange={(e) =>
                          handleToggleNuvioPref({
                            holdToSpeedEnabled: e.target.checked
                          })
                        }
                      />
                      <span>Segurar Espaço/Clique para Velocidade 2.0x</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        color: '#e2e8f0',
                        fontSize: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={nuvioPrefs.blurUnwatchedEpisodes}
                        onChange={(e) =>
                          handleToggleNuvioPref({
                            blurUnwatchedEpisodes: e.target.checked
                          })
                        }
                      />
                      <span>Desfocar Spoilers de Episódios Não Assistidos</span>
                    </label>
                  </div>
                )}

                {/* Sincronização e Atualizações com o GitHub Oficial NuvioMedia/NuvioDesktop */}
                {preferredPlayer === 'nuvio' && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '14px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.28)',
                      border: '1px solid rgba(245, 197, 24, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: 700,
                        color: '#fff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FontAwesomeIcon icon={faRotate} style={{ color: '#f5c518' }} />
                        <span>Sincronização com o GitHub Oficial NuvioMedia/NuvioDesktop</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: 'rgba(245, 197, 24, 0.18)',
                          color: '#fde68a',
                          fontWeight: 700
                        }}
                      >
                        v{nuvioUpdate?.installed || '0.1.32-alpha'}
                      </span>
                    </div>

                    <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
                      O Nuvio Addon está atrelado ao repositório oficial{' '}
                      <a
                        href="https://github.com/NuvioMedia/NuvioDesktop"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#f5c518', textDecoration: 'underline' }}
                      >
                        NuvioMedia/NuvioDesktop
                      </a>
                      . O sistema de atualização funciona de forma similar aos motores de navegação, consultando releases e permitindo atualização ou restauração em 1 clique.
                    </div>

                    {nuvioUpdate?.upstream && (
                      <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                        Versão mais recente no GitHub: <b>v{nuvioUpdate.upstream}</b>
                        {nuvioUpdate.updateAvailable && (
                          <span
                            style={{
                              marginLeft: '8px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(245, 197, 24, 0.22)',
                              color: '#fde68a',
                              fontWeight: 700
                            }}
                          >
                            Nova versão disponível!
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="btn-action"
                        onClick={handleCheckNuvioUpdates}
                        disabled={checkingNuvio}
                      >
                        <FontAwesomeIcon icon={faRotate} spin={checkingNuvio} />
                        <span>{checkingNuvio ? 'Consultando GitHub…' : 'Verificar Atualizações no GitHub'}</span>
                      </button>

                      {nuvioUpdate?.updateAvailable && (
                        <button
                          type="button"
                          className="btn-action primary"
                          onClick={handleInstallNuvioUpdate}
                          disabled={checkingNuvio}
                          style={{
                            background: '#f5c518',
                            color: '#090b10',
                            fontWeight: 800,
                            borderColor: '#f5c518'
                          }}
                        >
                          <FontAwesomeIcon icon={faDownload} />
                          <span>Instalar Atualização v{nuvioUpdate.upstream}</span>
                        </button>
                      )}

                      {nuvioUpdate?.previous && (
                        <button
                          type="button"
                          className="btn-action"
                          onClick={handleRestoreNuvioUpdate}
                          disabled={checkingNuvio}
                        >
                          <FontAwesomeIcon icon={faRotateLeft} />
                          <span>Restaurar v{nuvioUpdate.previous}</span>
                        </button>
                      )}

                      <a
                        href={nuvioUpdate?.upstreamUrl || 'https://github.com/NuvioMedia/NuvioDesktop/releases'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-action"
                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>Abrir Releases no GitHub</span>
                      </a>
                    </div>
                  </div>
                )}
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
