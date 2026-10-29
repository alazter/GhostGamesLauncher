import React, { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTowerBroadcast,
  faPlus,
  faRotate,
  faTrash,
  faFolderOpen,
  faShieldHalved,
  faLink,
  faFileLines,
  faCheck,
  faTv,
  faClock,
  faCalendarDays,
  faBolt,
  faListCheck
} from '@fortawesome/free-solid-svg-icons'
import type {
  GhostTvChannel,
  GhostTvPlaylist,
  GhostEpgSource,
  GhostEpgChannel,
  GhostEpgProgram
} from 'common/types/plugins'
import { parseM3u } from 'common/m3uParser'
import { parseXmltv } from 'common/epgParser'

const STORAGE_KEY_PLAYLISTS = 'ghost_alazterflix_tv_playlists'
const STORAGE_KEY_CHANNELS = 'ghost_alazterflix_tv_channels'
const STORAGE_KEY_EPG_SOURCES = 'ghost_alazterflix_tv_epg_sources'
const STORAGE_KEY_EPG_DATA = 'ghost_alazterflix_tv_epg_data'

export default function IptvPlaylistsSettings() {
  const [playlists, setPlaylists] = useState<GhostTvPlaylist[]>([])
  const [channels, setChannels] = useState<GhostTvChannel[]>([])
  const [importMode, setImportMode] = useState<'url' | 'file' | 'paste'>('url')
  const [importUrl, setImportUrl] = useState('')
  const [importPlaylistName, setImportPlaylistName] = useState('')
  const [importPasteText, setImportPasteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  // Estado de EPG (XMLTV)
  const [epgSources, setEpgSources] = useState<GhostEpgSource[]>([])
  const [epgImportMode, setEpgImportMode] = useState<'url' | 'file'>('url')
  const [epgImportUrl, setEpgImportUrl] = useState('')
  const [epgSourceName, setEpgSourceName] = useState('')
  const [syncingEpgId, setSyncingEpgId] = useState<string | null>(null)
  const [epgLoading, setEpgLoading] = useState(false)


  // Carrega listas do backend ou localStorage
  const loadPlaylistsAndChannels = useCallback(async () => {
    let loadedPlaylists: GhostTvPlaylist[] = []
    let loadedChannels: GhostTvChannel[] = []

    try {
      if (window.api?.cinemaTvGetPlaylists) {
        const fromBackend = await window.api.cinemaTvGetPlaylists()
        if (Array.isArray(fromBackend) && fromBackend.length > 0) {
          loadedPlaylists = fromBackend
        }
      }
    } catch {}

    if (loadedPlaylists.length === 0) {
      try {
        const local = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
        if (local) loadedPlaylists = JSON.parse(local)
      } catch {}
    }

    try {
      if (window.api?.cinemaTvGetChannels) {
        const fromBackend = await window.api.cinemaTvGetChannels()
        if (Array.isArray(fromBackend) && fromBackend.length > 0) {
          loadedChannels = fromBackend
        }
      }
    } catch {}

    if (loadedChannels.length === 0) {
      try {
        const local = localStorage.getItem(STORAGE_KEY_CHANNELS)
        if (local) loadedChannels = JSON.parse(local)
      } catch {}
    }

    setPlaylists(loadedPlaylists)
    setChannels(loadedChannels)
    // Carrega fontes de EPG
    let loadedEpgSources: GhostEpgSource[] = []
    try {
      if (window.api?.cinemaTvGetEpgSources) {
        const fromBackend = await window.api.cinemaTvGetEpgSources()
        if (Array.isArray(fromBackend) && fromBackend.length > 0) {
          loadedEpgSources = fromBackend
        }
      }
    } catch {}

    if (loadedEpgSources.length === 0) {
      try {
        const local = localStorage.getItem(STORAGE_KEY_EPG_SOURCES)
        if (local) loadedEpgSources = JSON.parse(local)
      } catch {}
    }
    setEpgSources(loadedEpgSources)
  }, [])

  useEffect(() => {
    loadPlaylistsAndChannels()
    const handleChanged = () => loadPlaylistsAndChannels()
    window.addEventListener('ghostTvPlaylistsChanged', handleChanged)
    window.addEventListener('ghostTvEpgChanged', handleChanged)
    return () => {
      window.removeEventListener('ghostTvPlaylistsChanged', handleChanged)
      window.removeEventListener('ghostTvEpgChanged', handleChanged)
    }
  }, [loadPlaylistsAndChannels])

  // Persiste dados no backend e localStorage
  const saveState = useCallback(
    async (nextPlaylists: GhostTvPlaylist[], nextChannels: GhostTvChannel[]) => {
      setPlaylists(nextPlaylists)
      setChannels(nextChannels)

      try {
        localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(nextPlaylists))
        localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(nextChannels))
      } catch {}

      try {
        if (window.api?.cinemaTvSavePlaylists) {
          await window.api.cinemaTvSavePlaylists(nextPlaylists)
        }
        if (window.api?.cinemaTvSaveChannels) {
          await window.api.cinemaTvSaveChannels(nextChannels)
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('ghostTvPlaylistsChanged'))
    },
    []
  )

  // Importar por Link / URL
  const handleImportByUrl = async () => {
    const rawUrl = importUrl.trim()
    if (!rawUrl) {
      setFeedback({ type: 'error', message: 'Digite a URL da lista M3U ou M3U8.' })
      return
    }

    setLoading(true)
    setFeedback(null)

    try {
      let result: any = null
      if (window.api?.cinemaTvFetchM3u) {
        result = await window.api.cinemaTvFetchM3u(rawUrl)
      } else {
        const res = await fetch(rawUrl)
        if (!res.ok) throw new Error(`Falha HTTP ${res.status}`)
        const text = await res.text()
        const parsed = parseM3u(text, { defaultGroup: 'Geral' })
        result = {
          success: true,
          playlistName: 'Lista IPTV',
          channels: parsed.channels,
          groups: parsed.groups,
          totalCount: parsed.totalCount
        }
      }

      if (!result?.channels || result.channels.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Nenhum canal válido ou seguro foi encontrado na URL informada.'
        })
        setLoading(false)
        return
      }

      const playlistId = `playlist-${Date.now()}`
      const newPlaylist: GhostTvPlaylist = {
        id: playlistId,
        name: importPlaylistName.trim() || result.playlistName || 'Lista IPTV',
        url: rawUrl,
        channelCount: result.totalCount,
        addedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        autoSync: true,
        epgUrl: result.epgUrl
      }

      const taggedChannels: GhostTvChannel[] = result.channels.map((ch: GhostTvChannel) => ({
        ...ch,
        playlistId
      }))

      const nextPlaylists = [newPlaylist, ...playlists.filter((p) => p.url !== rawUrl)]
      const existingIds = new Set(taggedChannels.map((c: GhostTvChannel) => c.id))
      const nextChannels = [...taggedChannels, ...channels.filter((c) => !existingIds.has(c.id))]

      await saveState(nextPlaylists, nextChannels)
      setFeedback({
        type: 'success',
        message: `🎉 Lista "${newPlaylist.name}" inserida com sucesso! ${result.totalCount} canais em ${result.groups.length} categorias.`
      })
      setImportUrl('')
      setImportPlaylistName('')
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao importar lista: ${err?.message || 'Falha de conexão ou link inválido.'}`
      })
    } finally {
      setLoading(false)
    }
  }

  // Importar por Arquivo Local (.m3u / .m3u8)
  const handlePickLocalM3uFile = async () => {
    setLoading(true)
    setFeedback(null)

    try {
      let filePath: string | null = null
      if (window.api?.cinemaTvPickM3uFile) {
        filePath = await window.api.cinemaTvPickM3uFile()
      }

      if (!filePath) {
        setLoading(false)
        return
      }

      const result = await window.api.cinemaTvReadM3uFile(filePath)
      if (!result?.channels || result.channels.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Nenhum canal válido foi encontrado no arquivo selecionado.'
        })
        setLoading(false)
        return
      }

      const playlistId = `local-playlist-${Date.now()}`
      const newPlaylist: GhostTvPlaylist = {
        id: playlistId,
        name: importPlaylistName.trim() || result.playlistName || 'Lista Local',
        filePath,
        channelCount: result.totalCount,
        addedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      }

      const taggedChannels: GhostTvChannel[] = result.channels.map((ch: GhostTvChannel) => ({
        ...ch,
        playlistId
      }))

      const nextPlaylists = [newPlaylist, ...playlists.filter((p) => p.filePath !== filePath)]
      const existingIds = new Set(taggedChannels.map((c: GhostTvChannel) => c.id))
      const nextChannels = [...taggedChannels, ...channels.filter((c) => !existingIds.has(c.id))]

      await saveState(nextPlaylists, nextChannels)
      setFeedback({
        type: 'success',
        message: `🎉 Arquivo local "${newPlaylist.name}" inserido com sucesso! ${result.totalCount} canais importados.`
      })
      setImportPlaylistName('')
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao ler arquivo: ${err?.message || 'Arquivo inválido.'}`
      })
    } finally {
      setLoading(false)
    }
  }

  // Importar por Texto Colado
  const handleImportByPaste = async () => {
    const rawText = importPasteText.trim()
    if (!rawText) {
      setFeedback({ type: 'error', message: 'Cole o conteúdo da lista M3U no campo abaixo.' })
      return
    }

    setLoading(true)
    setFeedback(null)

    try {
      const playlistId = `paste-${Date.now()}`
      const result = parseM3u(rawText, {
        playlistId,
        defaultGroup: 'Geral'
      })

      if (!result.channels || result.channels.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Nenhum canal válido foi encontrado no texto colado.'
        })
        setLoading(false)
        return
      }

      const newPlaylist: GhostTvPlaylist = {
        id: playlistId,
        name: importPlaylistName.trim() || `Lista Colada (${new Date().toLocaleDateString()})`,
        channelCount: result.totalCount,
        addedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      }

      const nextPlaylists = [newPlaylist, ...playlists]
      const existingIds = new Set(result.channels.map((c: GhostTvChannel) => c.id))
      const nextChannels = [...result.channels, ...channels.filter((c) => !existingIds.has(c.id))]

      await saveState(nextPlaylists, nextChannels)
      setFeedback({
        type: 'success',
        message: `🎉 ${result.totalCount} canais processados e adicionados com sucesso!`
      })
      setImportPasteText('')
      setImportPlaylistName('')
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao processar código: ${err?.message || 'Formato M3U inválido.'}`
      })
    } finally {
      setLoading(false)
    }
  }

  // Sincronizar lista existente
  const handleResyncPlaylist = async (playlist: GhostTvPlaylist) => {
    setSyncingId(playlist.id)
    setFeedback(null)

    try {
      let result: any = null
      if (playlist.url && window.api?.cinemaTvFetchM3u) {
        result = await window.api.cinemaTvFetchM3u(playlist.url)
      } else if (playlist.filePath && window.api?.cinemaTvReadM3uFile) {
        result = await window.api.cinemaTvReadM3uFile(playlist.filePath)
      }

      if (result?.channels && result.channels.length > 0) {
        const taggedChannels = result.channels.map((ch: GhostTvChannel) => ({
          ...ch,
          playlistId: playlist.id
        }))

        const nextChannels = [
          ...taggedChannels,
          ...channels.filter((c) => c.playlistId !== playlist.id)
        ]

        const nextPlaylists = playlists.map((p) =>
          p.id === playlist.id
            ? {
                ...p,
                channelCount: result.totalCount,
                lastSyncAt: new Date().toISOString()
              }
            : p
        )

        await saveState(nextPlaylists, nextChannels)
        setFeedback({
          type: 'success',
          message: `Lista "${playlist.name}" atualizada: ${result.totalCount} canais sincronizados.`
        })
      } else {
        setFeedback({
          type: 'error',
          message: `Não foi possível sincronizar a lista "${playlist.name}".`
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro na sincronização: ${err?.message || 'Falha ao atualizar.'}`
      })
    } finally {
      setSyncingId(null)
    }
  }


  // Salvar fontes EPG e dados
  const saveEpgState = useCallback(
    async (
      nextSources: GhostEpgSource[],
      epgData?: { channels: GhostEpgChannel[]; programs: GhostEpgProgram[] }
    ) => {
      setEpgSources(nextSources)
      try {
        localStorage.setItem(STORAGE_KEY_EPG_SOURCES, JSON.stringify(nextSources))
      } catch {}

      try {
        if (window.api?.cinemaTvSaveEpgSources) {
          await window.api.cinemaTvSaveEpgSources(nextSources)
        }
        if (epgData && window.api?.cinemaTvSaveEpgData) {
          await window.api.cinemaTvSaveEpgData({
            ...epgData,
            updatedAt: new Date().toISOString()
          })
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('ghostTvEpgChanged'))
    },
    []
  )

  // Inserir EPG via URL Web
  const handleImportEpgByUrl = async (urlToUse?: string, defaultName?: string) => {
    const rawUrl = (urlToUse || epgImportUrl).trim()
    if (!rawUrl) {
      setFeedback({ type: 'error', message: 'Digite a URL do arquivo de EPG (XMLTV).' })
      return
    }

    setEpgLoading(true)
    setFeedback(null)

    try {
      let result: any = null
      if (window.api?.cinemaTvFetchEpg) {
        result = await window.api.cinemaTvFetchEpg(rawUrl)
      } else {
        const res = await fetch(rawUrl)
        if (!res.ok) throw new Error(`Falha HTTP ${res.status}`)
        const text = await res.text()
        const parsed = parseXmltv(text)
        result = {
          success: true,
          sourceName: 'Guia XMLTV',
          channels: parsed.channels,
          programs: parsed.programs,
          totalChannels: parsed.totalChannels,
          totalPrograms: parsed.totalPrograms
        }
      }

      if (!result?.channels || result.channels.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Nenhum canal ou programa válido foi encontrado no arquivo XMLTV da URL informada.'
        })
        setEpgLoading(false)
        return
      }

      const sourceId = `epg-${Date.now()}`
      const newSource: GhostEpgSource = {
        id: sourceId,
        name: (defaultName || epgSourceName).trim() || result.sourceName || 'Guia XMLTV',
        url: rawUrl,
        channelCount: result.totalChannels || result.channels.length,
        programCount: result.totalPrograms || result.programs.length,
        addedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        autoSync: true
      }

      const nextSources = [newSource, ...epgSources.filter((s) => s.url !== rawUrl)]
      await saveEpgState(nextSources, {
        channels: result.channels,
        programs: result.programs
      })

      setEpgImportUrl('')
      setEpgSourceName('')
      setFeedback({
        type: 'success',
        message: `Fonte EPG "${newSource.name}" adicionada com sucesso! ${result.totalChannels} canais e ${result.totalPrograms} programas mapeados.`
      })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha ao importar fonte EPG: ${err?.message || 'Erro desconhecido'}`
      })
    } finally {
      setEpgLoading(false)
    }
  }

  // Inserir EPG via Arquivo Local do PC
  const handleImportEpgByFile = async () => {
    setEpgLoading(true)
    setFeedback(null)

    try {
      if (!window.api?.cinemaTvPickEpgFile || !window.api?.cinemaTvReadEpgFile) {
        setFeedback({
          type: 'error',
          message: 'Seletor nativo de EPG não disponível neste ambiente.'
        })
        setEpgLoading(false)
        return
      }

      const pickedPath = await window.api.cinemaTvPickEpgFile()
      if (!pickedPath) {
        setEpgLoading(false)
        return
      }

      const result = await window.api.cinemaTvReadEpgFile(pickedPath)
      if (!result?.channels || result.channels.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Nenhum canal foi encontrado no arquivo XMLTV selecionado.'
        })
        setEpgLoading(false)
        return
      }

      const sourceId = `epg-${Date.now()}`
      const newSource: GhostEpgSource = {
        id: sourceId,
        name: epgSourceName.trim() || result.sourceName || 'Guia XMLTV Local',
        filePath: pickedPath,
        channelCount: result.totalChannels || result.channels.length,
        programCount: result.totalPrograms || result.programs.length,
        addedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        autoSync: false
      }

      const nextSources = [newSource, ...epgSources.filter((s) => s.filePath !== pickedPath)]
      await saveEpgState(nextSources, {
        channels: result.channels,
        programs: result.programs
      })

      setEpgSourceName('')
      setFeedback({
        type: 'success',
        message: `Fonte EPG local "${newSource.name}" vinculada com sucesso! ${result.totalChannels} canais e ${result.totalPrograms} programas carregados.`
      })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha ao carregar arquivo EPG local: ${err?.message || 'Erro desconhecido'}`
      })
    } finally {
      setEpgLoading(false)
    }
  }

  // Re-sincronizar Fonte EPG
  const handleResyncEpgSource = async (source: GhostEpgSource) => {
    setSyncingEpgId(source.id)
    setFeedback(null)

    try {
      let result: any = null
      if (source.url && window.api?.cinemaTvFetchEpg) {
        result = await window.api.cinemaTvFetchEpg(source.url)
      } else if (source.filePath && window.api?.cinemaTvReadEpgFile) {
        result = await window.api.cinemaTvReadEpgFile(source.filePath)
      }

      if (!result?.channels || result.channels.length === 0) {
        throw new Error('Nenhum canal retornado na atualização do EPG.')
      }

      const nextSources = epgSources.map((s) => {
        if (s.id === source.id) {
          return {
            ...s,
            channelCount: result.totalChannels || result.channels.length,
            programCount: result.totalPrograms || result.programs.length,
            lastSyncAt: new Date().toISOString()
          }
        }
        return s
      })

      await saveEpgState(nextSources, {
        channels: result.channels,
        programs: result.programs
      })

      setFeedback({
        type: 'success',
        message: `Fonte EPG "${source.name}" sincronizada! ${result.totalChannels} canais e ${result.totalPrograms} programas atualizados.`
      })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao sincronizar fonte EPG: ${err?.message || 'Falha de comunicação'}`
      })
    } finally {
      setSyncingEpgId(null)
    }
  }

  // Excluir Fonte EPG
  const handleDeleteEpgSource = async (sourceId: string) => {
    const target = epgSources.find((s) => s.id === sourceId)
    const nextSources = epgSources.filter((s) => s.id !== sourceId)
    await saveEpgState(nextSources)
    setFeedback({
      type: 'success',
      message: `Fonte EPG "${target?.name || 'Guia XMLTV'}" foi removida.`
    })
  }

  // Excluir lista
  const handleDeletePlaylist = async (playlistId: string) => {
    const target = playlists.find((p) => p.id === playlistId)
    const nextPlaylists = playlists.filter((p) => p.id !== playlistId)
    const nextChannels = channels.filter((c) => c.playlistId !== playlistId)

    await saveState(nextPlaylists, nextChannels)
    setFeedback({
      type: 'success',
      message: `Lista "${target?.name || 'IPTV'}" e seus canais foram removidos.`
    })
  }

  return (
    <div className="alazter-iptv-settings-card settings-card">
      {/* CABEÇALHO DA SEÇÃO DE CONFIGURAÇÃO DE LISTAS */}
      <div className="iptv-settings-header">
        <div className="iptv-header-title-row">
          <div className="iptv-icon-badge">
            <FontAwesomeIcon icon={faTowerBroadcast} />
          </div>
          <div>
            <h3>Listas IPTV (M3U / M3U8) &amp; TV ao Vivo</h3>
            <span className="iptv-header-subtitle">
              Configure suas listas de transmissão ao vivo (IPTV M3U e M3U8). Os canais ficarão disponíveis na categoria <strong>TV</strong> do Alazterflix.
            </span>
          </div>
        </div>

        <div className="iptv-security-badge" title="Todas as conexões passam pelo GhostShield Sandbox com validação estrita">
          <FontAwesomeIcon icon={faShieldHalved} />
          <span>GhostShield Sandbox Ativo</span>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {feedback && (
        <div className={`iptv-feedback-alert ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button
            type="button"
            className="btn-dismiss-feedback"
            onClick={() => setFeedback(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* PAINEL DE INSERÇÃO DE NOVA LISTA */}
      <div className="iptv-insert-box">
        <div className="iptv-insert-header">
          <h4>
            <FontAwesomeIcon icon={faPlus} />
            <span>Inserir Nova Lista M3U ou M3U8</span>
          </h4>

          {/* ABAS DE MODO DE INSERÇÃO */}
          <div className="iptv-tabs-row">
            <button
              type="button"
              className={`iptv-tab-btn ${importMode === 'url' ? 'active' : ''}`}
              onClick={() => setImportMode('url')}
            >
              <FontAwesomeIcon icon={faLink} />
              <span>Link da Web (URL)</span>
            </button>
            <button
              type="button"
              className={`iptv-tab-btn ${importMode === 'file' ? 'active' : ''}`}
              onClick={() => setImportMode('file')}
            >
              <FontAwesomeIcon icon={faFolderOpen} />
              <span>Arquivo do PC</span>
            </button>
            <button
              type="button"
              className={`iptv-tab-btn ${importMode === 'paste' ? 'active' : ''}`}
              onClick={() => setImportMode('paste')}
            >
              <FontAwesomeIcon icon={faFileLines} />
              <span>Colar Código</span>
            </button>
          </div>
        </div>

        <div className="iptv-insert-form">
          <div className="iptv-field-group">
            <label>Nome amigável da lista (opcional):</label>
            <input
              type="text"
              placeholder="Ex: Canais Abertos Brasil, Esportes Ao Vivo, Notícias..."
              value={importPlaylistName}
              onChange={(e) => setImportPlaylistName(e.target.value)}
            />
          </div>

          {importMode === 'url' && (
            <div className="iptv-field-group">
              <label>URL / Link da Lista M3U ou M3U8:</label>
              <div className="iptv-input-action-row">
                <input
                  type="url"
                  placeholder="https://exemplo.com/lista.m3u8 ou .m3u"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-iptv-submit"
                  onClick={handleImportByUrl}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faRotate} spin />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPlus} />
                      <span>Inserir Lista</span>
                    </>
                  )}
                </button>
              </div>
              <span className="iptv-hint">
                O GhostShield valida links seguros e descarta preventivamente executáveis maliciosos.
              </span>
            </div>
          )}

          {importMode === 'file' && (
            <div className="iptv-field-group">
              <label>Selecionar arquivo salvo no disco rígido:</label>
              <button
                type="button"
                className="btn-iptv-pick-file"
                onClick={handlePickLocalM3uFile}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faFolderOpen} />
                <span>
                  {loading ? 'Lendo e processando arquivo...' : 'Escolher Arquivo .m3u ou .m3u8 no Computador'}
                </span>
              </button>
            </div>
          )}

          {importMode === 'paste' && (
            <div className="iptv-field-group">
              <label>Conteúdo da lista M3U (#EXTM3U):</label>
              <textarea
                rows={5}
                placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-name=&quot;Canal 1&quot; tvg-logo=&quot;http://...&quot;,Canal 1&#10;http://stream.exemplo.com/live.m3u8"
                value={importPasteText}
                onChange={(e) => setImportPasteText(e.target.value)}
              />
              <button
                type="button"
                className="btn-iptv-submit btn-paste-submit"
                onClick={handleImportByPaste}
                disabled={loading}
              >
                {loading ? 'Processando...' : 'Processar e Inserir Lista'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE PLAYLISTS M3U CADASTRADAS */}
      <div className="iptv-configured-section">
        <div className="configured-header-row">
          <h4>
            <FontAwesomeIcon icon={faTv} />
            <span>Listas Inseridas no Sistema ({playlists.length})</span>
          </h4>
          <span className="channels-aggregate-badge">
            {channels.length} canais ativos no Hub de TV
          </span>
        </div>

        {playlists.length === 0 ? (
          <div className="iptv-empty-box">
            <FontAwesomeIcon icon={faTowerBroadcast} className="empty-tower-icon" />
            <p>Nenhuma lista M3U ou M3U8 inserida ainda.</p>
            <span className="empty-sub">
              Insira uma URL ou selecione um arquivo local acima para assistir transmissões ao vivo com segurança na categoria <strong>TV</strong> do Alazterflix.
            </span>
          </div>
        ) : (
          <div className="iptv-playlists-grid">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="iptv-playlist-card">
                <div className="card-info-col">
                  <div className="card-title-row">
                    <span className="card-type-tag">
                      {playlist.url ? 'URL WEB' : playlist.filePath ? 'ARQUIVO LOCAL' : 'TEXTO'}
                    </span>
                    <h5>{playlist.name}</h5>
                  </div>

                  <div className="card-meta-row">
                    <span className="meta-count">
                      <FontAwesomeIcon icon={faTv} />
                      <strong>{playlist.channelCount} canais</strong>
                    </span>

                    {playlist.lastSyncAt && (
                      <span className="meta-date" title={playlist.lastSyncAt}>
                        <FontAwesomeIcon icon={faClock} />
                        Sincronizado: {new Date(playlist.lastSyncAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {(playlist.url || playlist.filePath) && (
                    <span className="card-source-path" title={playlist.url || playlist.filePath}>
                      {playlist.url || playlist.filePath}
                    </span>
                  )}
                </div>

                <div className="card-actions-col">
                  {(playlist.url || playlist.filePath) && (
                    <button
                      type="button"
                      className="btn-card-action btn-sync"
                      onClick={() => handleResyncPlaylist(playlist)}
                      disabled={syncingId === playlist.id}
                      title="Atualizar canais desta lista"
                    >
                      <FontAwesomeIcon
                        icon={faRotate}
                        spin={syncingId === playlist.id}
                      />
                      <span>Atualizar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-card-action btn-delete"
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    title="Remover lista e seus canais"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEÇÃO DE DETECÇÃO AUTOMÁTICA DE EPG EM PLAYLISTS CARREGADAS */}
      {playlists.some((p) => p.epgUrl && !epgSources.some((s) => s.url === p.epgUrl)) && (
        <div className="iptv-detected-epg-banner">
          <div className="banner-icon-col">
            <FontAwesomeIcon icon={faBolt} />
          </div>
          <div className="banner-text-col">
            <h5>Guia EPG Detectado na sua Playlist!</h5>
            <p>
              A sua lista IPTV contém um link oficial de Guia XMLTV anexado pelo provedor:
            </p>
            {playlists
              .filter((p) => p.epgUrl && !epgSources.some((s) => s.url === p.epgUrl))
              .map((p) => (
                <div key={p.id} className="detected-epg-item">
                  <span className="playlist-name-tag">{p.name}:</span>
                  <span className="detected-url">{p.epgUrl}</span>
                  <button
                    type="button"
                    className="btn-sync-detected-epg"
                    disabled={epgLoading}
                    onClick={() => handleImportEpgByUrl(p.epgUrl, `EPG ${p.name}`)}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                    <span>Sincronizar EPG Desta Lista</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SEÇÃO DE FONTES DE GUIA EPG (XMLTV) */}
      <div className="iptv-epg-settings-section">
        <div className="iptv-insert-header">
          <div className="epg-title-wrap">
            <div className="epg-icon-badge">
              <FontAwesomeIcon icon={faCalendarDays} />
            </div>
            <div>
              <h4>Fontes de Guia EPG (XMLTV / Guia de Programação)</h4>
              <span className="iptv-header-subtitle">
                Adicione arquivos XML ou URLs XMLTV para exibir o que está passando em cada canal, horários e sinopses.
              </span>
            </div>
          </div>

          {/* Abas de Modo de Inserção de EPG */}
          <div className="iptv-tabs-row">
            <button
              type="button"
              className={`iptv-tab-btn ${epgImportMode === 'url' ? 'active' : ''}`}
              onClick={() => setEpgImportMode('url')}
            >
              <FontAwesomeIcon icon={faLink} />
              <span>Link XMLTV (URL)</span>
            </button>
            <button
              type="button"
              className={`iptv-tab-btn ${epgImportMode === 'file' ? 'active' : ''}`}
              onClick={() => setEpgImportMode('file')}
            >
              <FontAwesomeIcon icon={faFolderOpen} />
              <span>Arquivo XML / GZ do PC</span>
            </button>
          </div>
        </div>

        {/* Formulário de Inserção de EPG */}
        <div className="iptv-insert-form">
          <div className="iptv-field-group">
            <label>Nome da fonte EPG (opcional):</label>
            <input
              type="text"
              placeholder="Ex: EPG Brasil, Guia Claro, XMLTV Oficial..."
              value={epgSourceName}
              onChange={(e) => setEpgSourceName(e.target.value)}
            />
          </div>

          {epgImportMode === 'url' ? (
            <div className="iptv-field-group">
              <label>URL do arquivo XMLTV (.xml ou .xml.gz):</label>
              <div className="iptv-input-with-action">
                <input
                  type="url"
                  placeholder="https://exemplo.com/epg.xml ou https://exemplo.com/epg.xml.gz"
                  value={epgImportUrl}
                  onChange={(e) => setEpgImportUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-iptv-submit"
                  disabled={epgLoading || !epgImportUrl.trim()}
                  onClick={() => handleImportEpgByUrl()}
                >
                  <FontAwesomeIcon icon={epgLoading ? faRotate : faPlus} spin={epgLoading} />
                  <span>{epgLoading ? 'Processando XML...' : 'Adicionar EPG'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="iptv-field-group">
              <label>Selecione o arquivo .xml ou .xml.gz no seu computador:</label>
              <div className="iptv-file-picker-row">
                <button
                  type="button"
                  className="btn-iptv-pick-file"
                  disabled={epgLoading}
                  onClick={handleImportEpgByFile}
                >
                  <FontAwesomeIcon icon={faFolderOpen} />
                  <span>Procurar Arquivo XMLTV (.xml, .xml.gz, .gz)...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Fontes EPG Configuradas */}
        <div className="iptv-configured-section epg-sources-list-wrap">
          <div className="configured-section-header">
            <h4>
              <FontAwesomeIcon icon={faListCheck} />
              <span>Fontes de Guia EPG Ativas ({epgSources.length})</span>
            </h4>
          </div>

          {epgSources.length === 0 ? (
            <div className="iptv-empty-playlists epg-empty">
              <FontAwesomeIcon icon={faCalendarDays} className="empty-icon" />
              <h5>Nenhuma fonte de EPG configurada</h5>
              <p>
                Adicione uma URL ou arquivo XMLTV acima para preencher o guia de programação dos seus canais de TV ao vivo.
              </p>
            </div>
          ) : (
            <div className="iptv-playlists-grid">
              {epgSources.map((source) => (
                <div key={source.id} className="iptv-playlist-card epg-card">
                  <div className="card-info-col">
                    <div className="card-title-row">
                      <span className="card-type-tag epg-tag">
                        {source.url ? 'XMLTV WEB' : 'XMLTV LOCAL'}
                      </span>
                      <h5>{source.name}</h5>
                    </div>

                    <div className="card-meta-row">
                      <span className="meta-count">
                        <FontAwesomeIcon icon={faTv} />
                        <strong>{source.channelCount} canais</strong>
                      </span>
                      <span className="meta-count">
                        <FontAwesomeIcon icon={faCalendarDays} />
                        <strong>{source.programCount} programas</strong>
                      </span>
                      {source.lastSyncAt && (
                        <span className="meta-date">
                          <FontAwesomeIcon icon={faClock} />
                          {new Date(source.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {(source.url || source.filePath) && (
                      <span className="card-source-path" title={source.url || source.filePath}>
                        {source.url || source.filePath}
                      </span>
                    )}
                  </div>

                  <div className="card-actions-col">
                    <button
                      type="button"
                      className="btn-card-action btn-sync"
                      onClick={() => handleResyncEpgSource(source)}
                      disabled={syncingEpgId === source.id}
                      title="Sincronizar dados deste EPG"
                    >
                      <FontAwesomeIcon icon={faRotate} spin={syncingEpgId === source.id} />
                      <span>Atualizar</span>
                    </button>
                    <button
                      type="button"
                      className="btn-card-action btn-delete"
                      onClick={() => handleDeleteEpgSource(source.id)}
                      title="Remover fonte de EPG"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
