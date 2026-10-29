import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTv,
  faTowerBroadcast,
  faPlus,
  faStar,
  faPlay,
  faRotate,
  faTrash,
  faFolderOpen,
  faGlobe,
  faShieldHalved,
  faSearch,
  faXmark,
  faListCheck,
  faSatelliteDish,
  faLink,
  faFileLines,
  faGear,
  faCalendarDays,
  faClock,
  faCircleDot
} from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'
import type {
  GhostTvChannel,
  GhostTvPlaylist,
  StremioAddonManifest,
  GhostEpgChannel,
  GhostEpgProgram
} from 'common/types/plugins'
import { parseM3u } from 'common/m3uParser'
import { matchChannelWithEpg, resolveChannelPrograms, calculateProgress } from 'common/epgParser'
import AlazterflixAssignEpgModal from './AlazterflixAssignEpgModal'
import AlazterflixChannelScheduleModal from './AlazterflixChannelScheduleModal'

interface AlazterflixTvHubProps {
  onPlayChannel: (channel: GhostTvChannel) => void | Promise<void>
  stremioAddons: StremioAddonManifest[]
  onOpenSettings?: () => void
}

const STORAGE_KEY_PLAYLISTS = 'ghost_alazterflix_tv_playlists'
const STORAGE_KEY_CHANNELS = 'ghost_alazterflix_tv_channels'
const STORAGE_KEY_FAVORITES = 'ghost_alazterflix_tv_favorites'
const STORAGE_KEY_EPG_DATA = 'ghost_alazterflix_tv_epg_data'
const STORAGE_KEY_EPG_ASSIGNMENTS = 'ghost_alazterflix_tv_epg_assignments'

export default function AlazterflixTvHub({
  onPlayChannel,
  stremioAddons,
  onOpenSettings
}: AlazterflixTvHubProps) {
  // Estado de Listas e Canais M3U
  const [playlists, setPlaylists] = useState<GhostTvPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [channels, setChannels] = useState<GhostTvChannel[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHANNELS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FAVORITES)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Canais Stremio TV
  const [stremioTvChannels, setStremioTvChannels] = useState<GhostTvChannel[]>([])
  const [loadingStremioTv, setLoadingStremioTv] = useState(false)

  // Filtros e Navegação
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'playlists' | 'stremio'>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modais
  const [showImportModal, setShowImportModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [importMode, setImportMode] = useState<'url' | 'file' | 'paste'>('url')
  const [importUrl, setImportUrl] = useState('')
  const [importPasteText, setImportPasteText] = useState('')
  const [importPlaylistName, setImportPlaylistName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importFeedback, setImportFeedback] = useState<string | null>(null)

  // Estado de EPG (Guia XMLTV) e Atribuições Manuais
  const [epgChannels, setEpgChannels] = useState<GhostEpgChannel[]>([])
  const [epgPrograms, setEpgPrograms] = useState<GhostEpgProgram[]>([])
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({})
  const [currentTime, setCurrentTime] = useState<number>(Date.now())
  const [assignModalChannel, setAssignModalChannel] = useState<GhostTvChannel | null>(null)
  const [scheduleModalChannel, setScheduleModalChannel] = useState<GhostTvChannel | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(100)

  // Sincronização e Persistência
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists))
      if (window.api?.cinemaTvSavePlaylists) {
        window.api.cinemaTvSavePlaylists(playlists).catch(() => {})
      }
    } catch (e) {
      console.error('[Alazterflix TV] Erro ao salvar playlists:', e)
    }
  }, [playlists])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(channels))
      if (window.api?.cinemaTvSaveChannels) {
        window.api.cinemaTvSaveChannels(channels).catch(() => {})
      }
    } catch (e) {
      console.error('[Alazterflix TV] Erro ao salvar canais:', e)
    }
  }, [channels])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites))
    } catch (e) {
      console.error('[Alazterflix TV] Erro ao salvar favoritos:', e)
    }
  }, [favorites])

  // Carrega do backend no boot (se disponível) e sincroniza quando alterado nas configurações
  useEffect(() => {
    const initFromBackend = async () => {
      try {
        let loadedPlaylists: GhostTvPlaylist[] = []
        let loadedChannels: GhostTvChannel[] = []

        if (window.api?.cinemaTvGetPlaylists) {
          const backendPlaylists = await window.api.cinemaTvGetPlaylists()
          if (Array.isArray(backendPlaylists) && backendPlaylists.length > 0) {
            loadedPlaylists = backendPlaylists
          }
        }
        if (loadedPlaylists.length === 0) {
          try {
            const raw = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
            if (raw) loadedPlaylists = JSON.parse(raw)
          } catch {}
        }
        if (loadedPlaylists.length > 0) setPlaylists(loadedPlaylists)

        if (window.api?.cinemaTvGetChannels) {
          const backendChannels = await window.api.cinemaTvGetChannels()
          if (Array.isArray(backendChannels) && backendChannels.length > 0) {
            loadedChannels = backendChannels
          }
        }
        if (loadedChannels.length === 0) {
          try {
            const raw = localStorage.getItem(STORAGE_KEY_CHANNELS)
            if (raw) loadedChannels = JSON.parse(raw)
          } catch {}
        }
        if (loadedChannels.length > 0) setChannels(loadedChannels)
      } catch (e) {
        console.error('[Alazterflix TV] Erro ao carregar dados do backend:', e)
      }
    }
    initFromBackend()

    const handlePlaylistsChanged = () => {
      initFromBackend()
    }
    window.addEventListener('ghostTvPlaylistsChanged', handlePlaylistsChanged)
    return () => window.removeEventListener('ghostTvPlaylistsChanged', handlePlaylistsChanged)
  }, [])

  // Carrega canais de addons de TV do Stremio instalados
  const loadStremioTvChannels = useCallback(async () => {
    setLoadingStremioTv(true)
    const tvAddons = (stremioAddons || []).filter((a) => {
      if (a.isEnabled === false) return false
      const hasTvCatalog = a.catalogs?.some((c: { type?: string }) => c.type === 'tv' || c.type === 'channel')
      const declaresTvType = Array.isArray(a.types) && (a.types.includes('tv') || a.types.includes('channel'))
      return hasTvCatalog || declaresTvType
    })

    if (tvAddons.length === 0) {
      setStremioTvChannels([])
      setLoadingStremioTv(false)
      return
    }

    const seenIds = new Set<string>()
    const aggregated: GhostTvChannel[] = []
    await Promise.allSettled(
      tvAddons.map(async (addon) => {
        try {
          const catalogs = (addon.catalogs || []).filter(
            (c: { type?: string }) => c.type === 'tv' || c.type === 'channel'
          )
          const targetCatalogId = catalogs[0]?.id || 'top'
          const catalogType = catalogs[0]?.type || 'tv'
          const res = await window.api.cinemaStremioGetCatalog(
            addon.id,
            catalogType,
            targetCatalogId,
            0
          )
          const metas = res?.metas || []
          for (const m of metas) {
            if (!m || !m.id) continue
            const chId = `stremio-tv-${addon.id}-${m.id}`
            if (seenIds.has(chId)) continue
            seenIds.add(chId)
            aggregated.push({
              id: chId,
              name: m.name || 'Canal TV',
              logo: m.poster || addon.icon,
              url: m.id, // ID a ser resolvido para stream
              stremioMetaId: m.id,
              stremioType: m.type || catalogType || 'tv',
              group: m.genres?.[0] || addon.name || 'Stremio TV',
              sourceType: 'stremio',
              addonId: addon.id
            })
          }
        } catch (err) {
          console.warn(`[Alazterflix TV] Falha ao carregar catálogo TV do addon ${addon.name}:`, err)
        }
      })
    )

    setStremioTvChannels(aggregated)
    setLoadingStremioTv(false)
  }, [stremioAddons])

  useEffect(() => {
    loadStremioTvChannels()
  }, [loadStremioTvChannels])

  // Ações de Favoritar
  const toggleFavorite = (channelId: string, ev: React.MouseEvent) => {
    ev.stopPropagation()
    setFavorites((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
  }

  // Ações de Importação de Lista M3U / M3U8
  const handleImportByUrl = async () => {
    const rawUrl = importUrl.trim()
    if (!rawUrl) {
      setImportFeedback('Digite ou cole a URL da lista M3U ou M3U8.')
      return
    }

    setImportLoading(true)
    setImportFeedback(null)
    try {
      let result: any
      if (window.api?.cinemaTvFetchM3u) {
        result = await window.api.cinemaTvFetchM3u(rawUrl)
      } else {
        // Fallback fetch no frontend
        const res = await fetch(rawUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        const parsed = parseM3u(text, { playlistId: `remote-${Date.now()}` })
        result = {
          success: true,
          playlistName: importPlaylistName.trim() || new URL(rawUrl).hostname,
          url: rawUrl,
          channels: parsed.channels,
          groups: parsed.groups,
          totalCount: parsed.totalCount
        }
      }

      if (!result?.channels || result.channels.length === 0) {
        setImportFeedback('Nenhum canal válido foi encontrado na lista fornecida.')
        setImportLoading(false)
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
        autoSync: true
      }

      const taggedChannels: GhostTvChannel[] = result.channels.map((ch: GhostTvChannel) => ({
        ...ch,
        playlistId
      }))

      // Merge sem duplicatas por ID de canal
      setPlaylists((prev) => [newPlaylist, ...prev.filter((p) => p.url !== rawUrl)])
      setChannels((prev) => {
        const existingIds = new Set(taggedChannels.map((c: GhostTvChannel) => c.id))
        return [...taggedChannels, ...prev.filter((c) => !existingIds.has(c.id))]
      })

      setImportFeedback(`🎉 ${result.totalCount} canais importados com sucesso em ${result.groups.length} categorias!`)
      setTimeout(() => {
        setShowImportModal(false)
        setImportUrl('')
        setImportPlaylistName('')
        setImportFeedback(null)
      }, 1500)
    } catch (err: any) {
      setImportFeedback(`Erro ao importar lista: ${err?.message || 'Falha de conexão'}`)
    } finally {
      setImportLoading(false)
    }
  }

  const handlePickLocalM3uFile = async () => {
    setImportLoading(true)
    setImportFeedback(null)
    try {
      let filePath: string | null = null
      if (window.api?.cinemaTvPickM3uFile) {
        filePath = await window.api.cinemaTvPickM3uFile()
      }

      if (!filePath) {
        setImportLoading(false)
        return
      }

      const result = await window.api.cinemaTvReadM3uFile(filePath)
      if (!result?.channels || result.channels.length === 0) {
        setImportFeedback('Nenhum canal válido foi encontrado no arquivo selecionado.')
        setImportLoading(false)
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

      setPlaylists((prev) => [newPlaylist, ...prev.filter((p) => p.filePath !== filePath)])
      setChannels((prev) => {
        const existingIds = new Set(taggedChannels.map((c: GhostTvChannel) => c.id))
        return [...taggedChannels, ...prev.filter((c) => !existingIds.has(c.id))]
      })

      setImportFeedback(`🎉 ${result.totalCount} canais importados do arquivo local com sucesso!`)
      setTimeout(() => {
        setShowImportModal(false)
        setImportFeedback(null)
      }, 1500)
    } catch (err: any) {
      setImportFeedback(`Erro ao ler arquivo: ${err?.message || 'Arquivo inválido'}`)
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportByPaste = () => {
    const rawText = importPasteText.trim()
    if (!rawText) {
      setImportFeedback('Cole o conteúdo da lista M3U no campo abaixo.')
      return
    }

    setImportLoading(true)
    try {
      const playlistId = `paste-playlist-${Date.now()}`
      const result = parseM3u(rawText, {
        playlistId,
        defaultGroup: 'Geral'
      })

      if (!result.channels.length) {
        setImportFeedback('Nenhum canal válido reconhecido no texto colado.')
        setImportLoading(false)
        return
      }

      const newPlaylist: GhostTvPlaylist = {
        id: playlistId,
        name: importPlaylistName.trim() || `Lista Colada (${result.totalCount} canais)`,
        channelCount: result.totalCount,
        addedAt: new Date().toISOString()
      }

      setPlaylists((prev) => [newPlaylist, ...prev])
      setChannels((prev) => {
        const existingIds = new Set(result.channels.map((c) => c.id))
        return [...result.channels, ...prev.filter((c) => !existingIds.has(c.id))]
      })

      setImportFeedback(`🎉 ${result.totalCount} canais colados importados com sucesso!`)
      setTimeout(() => {
        setShowImportModal(false)
        setImportPasteText('')
        setImportPlaylistName('')
        setImportFeedback(null)
      }, 1500)
    } catch (err: any) {
      setImportFeedback(`Erro ao processar texto: ${err?.message || 'Formato inválido'}`)
    } finally {
      setImportLoading(false)
    }
  }

  // Deletar playlist
  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId))
    setChannels((prev) => prev.filter((c) => c.playlistId !== playlistId))
  }

  // Recarregar playlist remota
  const handleRefreshPlaylist = async (playlist: GhostTvPlaylist) => {
    if (!playlist.url) return
    try {
      const res = await window.api.cinemaTvFetchM3u(playlist.url)
      if (res?.channels?.length) {
        const tagged: GhostTvChannel[] = res.channels.map((ch: GhostTvChannel) => ({
          ...ch,
          playlistId: playlist.id
        }))
        setChannels((prev) => [
          ...tagged,
          ...prev.filter((c) => c.playlistId !== playlist.id)
        ])
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id
              ? {
                  ...p,
                  channelCount: res.totalCount,
                  lastSyncAt: new Date().toISOString()
                }
              : p
          )
        )
      }
    } catch (err) {
      console.error('[Alazterflix TV] Erro ao recarregar playlist:', err)
    }
  }


  // Timer de atualização de progresso do EPG a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // Carrega fontes de dados e atribuições do EPG
  const loadEpgData = useCallback(async () => {
    try {
      let channelsList: GhostEpgChannel[] = []
      let programsList: GhostEpgProgram[] = []

      if (window.api?.cinemaTvGetEpgData) {
        const epgData = await window.api.cinemaTvGetEpgData()
        if (epgData?.channels && Array.isArray(epgData.channels)) {
          channelsList = epgData.channels
        }
        if (epgData?.programs && Array.isArray(epgData.programs)) {
          programsList = epgData.programs
        }
      }

      if (channelsList.length === 0 || programsList.length === 0) {
        try {
          const localEpg = localStorage.getItem(STORAGE_KEY_EPG_DATA)
          if (localEpg) {
            const parsed = JSON.parse(localEpg)
            if (parsed.channels) channelsList = parsed.channels
            if (parsed.programs) programsList = parsed.programs
          }
        } catch {}
      }

      setEpgChannels(channelsList)
      setEpgPrograms(programsList)

      let assignments: Record<string, string> = {}
      if (window.api?.cinemaTvGetEpgAssignments) {
        const fromBackend = await window.api.cinemaTvGetEpgAssignments()
        if (fromBackend && typeof fromBackend === 'object') {
          assignments = fromBackend
        }
      }

      if (Object.keys(assignments).length === 0) {
        try {
          const localAssignments = localStorage.getItem(STORAGE_KEY_EPG_ASSIGNMENTS)
          if (localAssignments) assignments = JSON.parse(localAssignments)
        } catch {}
      }

      setManualAssignments(assignments)
    } catch (e) {
      console.error('[Alazterflix TV] Erro ao carregar dados de EPG:', e)
    }
  }, [])

  useEffect(() => {
    loadEpgData()
    const handleEpgChanged = () => loadEpgData()
    window.addEventListener('ghostTvEpgChanged', handleEpgChanged)
    return () => window.removeEventListener('ghostTvEpgChanged', handleEpgChanged)
  }, [loadEpgData])

  // Salvar Atribuição Manual de EPG para um canal (padrão TiviMate)
  const handleSaveManualAssignment = async (channelId: string, assignedEpgId: string | null) => {
    const next = { ...manualAssignments }
    if (assignedEpgId) {
      next[channelId] = assignedEpgId
    } else {
      delete next[channelId]
    }
    setManualAssignments(next)

    try {
      localStorage.setItem(STORAGE_KEY_EPG_ASSIGNMENTS, JSON.stringify(next))
      if (window.api?.cinemaTvSaveEpgAssignments) {
        await window.api.cinemaTvSaveEpgAssignments(next)
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('ghostTvEpgChanged'))
  }

  // 1. Deduplicação absoluta dos canais combinados
  const uniqueBaseChannels = useMemo(() => {
    const combined = [...channels, ...stremioTvChannels]
    const seen = new Set<string>()
    const res: GhostTvChannel[] = []
    for (const ch of combined) {
      if (!ch || !ch.id) continue
      if (seen.has(ch.id)) continue
      seen.add(ch.id)
      res.push(ch)
    }
    return res
  }, [channels, stremioTvChannels])

  // 2. Indexação O(1) dos programas de EPG por channelId (evita filtrar 50.000 itens repetidamente)
  const programsByChannel = useMemo(() => {
    const map = new Map<string, GhostEpgProgram[]>()
    for (const p of epgPrograms) {
      if (!p || !p.channelId) continue
      const list = map.get(p.channelId)
      if (list) {
        list.push(p)
      } else {
        map.set(p.channelId, [p])
      }
    }
    return map
  }, [epgPrograms])

  // 3. Correspondência estável de canais com o EPG (NÃO roda a cada 30 segundos, apenas quando canais ou EPG mudam)
  const channelsWithMatchedEpg = useMemo(() => {
    if (epgChannels.length === 0) {
      return uniqueBaseChannels.map((c) => ({
        channel: c,
        matchedEpgId: manualAssignments[c.id] || c.assignedEpgId || undefined
      }))
    }
    return uniqueBaseChannels.map((c) => {
      const matched = matchChannelWithEpg(c, epgChannels, manualAssignments)
      return {
        channel: c,
        matchedEpgId: manualAssignments[c.id] || c.assignedEpgId || matched?.id
      }
    })
  }, [uniqueBaseChannels, epgChannels, manualAssignments])

  // 4. Canais unificados e enriquecidos com metadados de EPG em tempo real (instantâneo via Map em O(1))
  const allAvailableChannels = useMemo(() => {
    if (programsByChannel.size === 0) {
      return channelsWithMatchedEpg.map((entry) => ({
        ...entry.channel,
        assignedEpgId: entry.matchedEpgId
      }))
    }

    return channelsWithMatchedEpg.map((entry) => {
      const { channel, matchedEpgId } = entry
      if (!matchedEpgId) {
        return channel
      }

      const channelPrograms = programsByChannel.get(matchedEpgId)
      if (!channelPrograms || channelPrograms.length === 0) {
        return {
          ...channel,
          assignedEpgId: matchedEpgId
        }
      }

      let currentProgram: GhostEpgProgram | undefined
      let nextProgram: GhostEpgProgram | undefined

      for (let i = 0; i < channelPrograms.length; i++) {
        const p = channelPrograms[i]
        if (p.start <= currentTime && p.stop > currentTime) {
          currentProgram = {
            ...p,
            progressPercent: calculateProgress(p.start, p.stop, currentTime)
          }
          nextProgram = channelPrograms[i + 1]
          break
        } else if (p.start > currentTime && !nextProgram) {
          nextProgram = p
        }
      }

      return {
        ...channel,
        assignedEpgId: matchedEpgId,
        currentProgram,
        nextProgram
      }
    })
  }, [channelsWithMatchedEpg, programsByChannel, currentTime])

  // Grupos únicos disponíveis
  const availableGroups = useMemo(() => {
    const set = new Set<string>()
    for (const ch of allAvailableChannels) {
      if (ch.group) set.add(ch.group)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allAvailableChannels])

  // Filtragem de canais
  const filteredChannels = useMemo(() => {
    let list = allAvailableChannels

    if (activeTab === 'favorites') {
      list = list.filter((c) => favorites.includes(c.id))
    } else if (activeTab === 'stremio') {
      list = list.filter((c) => c.sourceType === 'stremio')
    } else if (activeTab === 'playlists') {
      list = list.filter((c) => c.sourceType !== 'stremio')
    }

    if (selectedGroup !== 'all') {
      list = list.filter((c) => c.group === selectedGroup)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.group && c.group.toLowerCase().includes(q))
      )
    }

    return list
  }, [allAvailableChannels, activeTab, favorites, selectedGroup, searchQuery])

  // Reseta limite de canais visíveis ao mudar filtros ou abas
  useEffect(() => {
    setVisibleCount(100)
  }, [activeTab, selectedGroup, searchQuery])

  // Canais paginados a renderizar (evita sobrecarga no Fiber tree e vazamento de RAM)
  const displayedChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount)
  }, [filteredChannels, visibleCount])

  return (
    <div className="alazter-tv-hub-container">
      {/* HEADER DA SEÇÃO TV AO VIVO */}
      <div className="tv-hub-hero-header">
        <div className="tv-hero-title-box">
          <div className="tv-title-line">
            <span className="tv-neon-icon">
              <FontAwesomeIcon icon={faTowerBroadcast} />
            </span>
            <h2>TV & Canais Ao Vivo</h2>
            <span className="badge-live-pulse">
              <span className="live-dot" /> AO VIVO
            </span>
          </div>
          <p className="tv-hero-subtitle">
            Transmissões em tempo real, Listas IPTV (M3U e M3U8) e Canais de Addons Stremio TV.
          </p>
        </div>

        <div className="tv-hero-actions">
          <div className="ghostshield-safe-badge" title="Ambiente de streaming protegido pelo GhostShield VM Sandbox com validação estrita de URLs">
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>GhostShield Sandbox Ativo</span>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              className="btn-tv-settings"
              onClick={onOpenSettings}
              title="Abrir página de configuração de Listas M3U / M3U8 do Alazterflix"
            >
              <FontAwesomeIcon icon={faGear} />
              <span>Configurar Listas M3U</span>
            </button>
          )}

          <button
            type="button"
            className="btn-tv-primary"
            onClick={() => {
              setImportFeedback(null)
              setShowImportModal(true)
            }}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Importar Lista M3U / M3U8</span>
          </button>

          <button
            type="button"
            className="btn-tv-secondary"
            onClick={() => setShowManageModal(true)}
            title="Gerenciar listas importadas"
          >
            <FontAwesomeIcon icon={faListCheck} />
            <span>Listas ({playlists.length})</span>
          </button>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO INTERNA E BUSCA */}
      <div className="tv-hub-toolbar">
        <div className="tv-hub-tab-pills">
          <button
            type="button"
            className={`tv-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <FontAwesomeIcon icon={faTv} />
            <span>Todos os Canais</span>
            <span className="pill-count">({allAvailableChannels.length})</span>
          </button>

          <button
            type="button"
            className={`tv-tab-pill ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <FontAwesomeIcon icon={faStar} />
            <span>Favoritos</span>
            <span className="pill-count">({favorites.length})</span>
          </button>

          <button
            type="button"
            className={`tv-tab-pill ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => setActiveTab('playlists')}
          >
            <FontAwesomeIcon icon={faSatelliteDish} />
            <span>IPTV M3U / M3U8</span>
            <span className="pill-count">({channels.length})</span>
          </button>

          <button
            type="button"
            className={`tv-tab-pill ${activeTab === 'stremio' ? 'active' : ''}`}
            onClick={() => setActiveTab('stremio')}
          >
            <FontAwesomeIcon icon={faGlobe} />
            <span>Addons Stremio TV</span>
            <span className="pill-count">({stremioTvChannels.length})</span>
          </button>
        </div>

        {/* INPUT DE BUSCA DE CANAIS */}
        <div className="tv-search-box">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Pesquisar canal ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
      </div>

      {/* TRILHO DE FILTROS POR GRUPO / GÊNERO */}
      {availableGroups.length > 0 && (
        <div className="tv-groups-scroll-row">
          <button
            type="button"
            className={`group-chip ${selectedGroup === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedGroup('all')}
          >
            Todos os Grupos
          </button>
          {availableGroups.map((group) => (
            <button
              type="button"
              key={group}
              className={`group-chip ${selectedGroup === group ? 'active' : ''}`}
              onClick={() => setSelectedGroup(group)}
            >
              {group}
            </button>
          ))}
        </div>
      )}

      {/* GRADE DE CANAIS */}
      {filteredChannels.length === 0 ? (
        <div className="tv-empty-state">
          <FontAwesomeIcon icon={faTowerBroadcast} className="empty-icon" />
          {allAvailableChannels.length === 0 ? (
            <>
              <h3>Nenhum canal ou lista adicionada ainda</h3>
              <p>
                Adicione suas listas M3U ou M3U8 de canais abertos ou conecte addons de TV do Stremio para assistir transmissões em tempo real.
              </p>
              <div className="empty-actions">
                {onOpenSettings && (
                  <button
                    type="button"
                    className="btn-tv-settings"
                    onClick={onOpenSettings}
                    title="Ir para a página de configurações para inserir listas M3U ou M3U8"
                  >
                    <FontAwesomeIcon icon={faGear} />
                    <span>Configurações de Listas M3U</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-tv-primary"
                  onClick={() => setShowImportModal(true)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Adicionar Lista M3U / M3U8</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Nenhum canal encontrado para os filtros atuais</h3>
              <p>Tente buscar com outro nome ou selecione outro grupo de canais.</p>
              <button
                type="button"
                className="btn-clear-filters"
                onClick={() => {
                  setSelectedGroup('all')
                  setSearchQuery('')
                }}
              >
                Limpar Filtros
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="tv-channels-grid">
          {displayedChannels.map((channel, idx) => {
            const isFav = favorites.includes(channel.id)
            return (
              <div
                key={`${channel.id}-${idx}`}
                className="tv-channel-card"
                onClick={() => onPlayChannel(channel)}
                title={`${channel.name} (${channel.group})`}
              >
                <div className="channel-logo-box">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="channel-logo-img"
                      loading="lazy"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="channel-fallback-logo">
                      <FontAwesomeIcon icon={faTv} />
                    </div>
                  )}

                  <div className="channel-badges-top">
                    <span className="badge-source-type">
                      {channel.sourceType.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className={`btn-fav-star ${isFav ? 'is-fav' : ''}`}
                      onClick={(e) => toggleFavorite(channel.id, e)}
                      title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <FontAwesomeIcon icon={isFav ? faStar : faStarRegular} />
                    </button>
                  </div>

                  <div className="channel-hover-play">
                    <div className="channel-play-btn">
                      <FontAwesomeIcon icon={faPlay} />
                    </div>
                  </div>
                </div>

                <div className="channel-info-box">
                  <div className="channel-name-row">
                    <span className="channel-status-dot" />
                    <h4 title={channel.name}>{channel.name}</h4>
                    <span className="channel-group-tag">{channel.group}</span>
                  </div>

                  {/* Informações de EPG (Guia de Programação ao Vivo) */}
                  {channel.currentProgram ? (
                    <div className="channel-epg-live-box">
                      <div className="epg-title-row">
                        <span className="epg-live-dot" />
                        <span
                          className="epg-show-title"
                          title={channel.currentProgram.title}
                        >
                          {channel.currentProgram.title}
                        </span>
                        <span className="epg-show-time">
                          {channel.currentProgram.startFormatted} - {channel.currentProgram.stopFormatted}
                        </span>
                      </div>

                      {typeof channel.currentProgram.progressPercent === 'number' && (
                        <div className="channel-epg-progress-track">
                          <div
                            className="channel-epg-progress-bar"
                            style={{
                              width: `${channel.currentProgram.progressPercent}%`
                            }}
                          />
                        </div>
                      )}

                      {channel.nextProgram && (
                        <div className="channel-epg-next-row">
                          <span className="epg-next-label">A seguir:</span>
                          <span className="epg-next-title" title={channel.nextProgram.title}>
                            {channel.nextProgram.title} ({channel.nextProgram.startFormatted})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="channel-epg-empty-row">
                      <span className="no-epg-text">(Sem guia de programação)</span>
                      <button
                        type="button"
                        className="btn-card-assign-epg"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAssignModalChannel(channel)
                        }}
                        title="Vincular um canal do XMLTV a este canal"
                      >
                        <FontAwesomeIcon icon={faListCheck} />
                        <span>Atribuir EPG</span>
                      </button>
                    </div>
                  )}

                  {/* Ações de EPG no card */}
                  <div className="channel-epg-actions-row">
                    <button
                      type="button"
                      className="btn-card-action-epg"
                      onClick={(e) => {
                        e.stopPropagation()
                        setScheduleModalChannel(channel)
                      }}
                      title="Ver programação completa do canal"
                    >
                      <FontAwesomeIcon icon={faCalendarDays} />
                      <span>Guia</span>
                    </button>
                    <button
                      type="button"
                      className="btn-card-action-epg"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAssignModalChannel(channel)
                      }}
                      title="Atribuir ou alterar canal do EPG (padrão TiviMate)"
                    >
                      <FontAwesomeIcon icon={faListCheck} />
                      <span>Atribuir</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* BOTÃO DE CARREGAR MAIS CANAIS */}
      {filteredChannels.length > visibleCount && (
        <div className="tv-load-more-row" style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>
          <button
            type="button"
            className="btn-tv-load-more"
            onClick={() => setVisibleCount((prev) => prev + 100)}
            style={{
              padding: '12px 28px',
              borderRadius: 8,
              border: '1px solid rgba(0, 229, 255, 0.45)',
              background: 'rgba(0, 229, 255, 0.1)',
              color: 'var(--alazter-cyan, #00e5ff)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 0 16px rgba(0, 229, 255, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>
              Carregar Mais (+100 Canais) — Exibindo {displayedChannels.length} de {filteredChannels.length}
            </span>
          </button>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE LISTA M3U / M3U8 */}
      {showImportModal && (
        <div className="tv-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="tv-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tv-modal-header">
              <div className="modal-title-box">
                <FontAwesomeIcon icon={faTowerBroadcast} className="modal-icon" />
                <h3>Importar Lista IPTV (M3U / M3U8)</h3>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowImportModal(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="tv-modal-tabs">
              <button
                type="button"
                className={`modal-tab ${importMode === 'url' ? 'active' : ''}`}
                onClick={() => setImportMode('url')}
              >
                <FontAwesomeIcon icon={faLink} />
                <span>Link da Web (URL)</span>
              </button>
              <button
                type="button"
                className={`modal-tab ${importMode === 'file' ? 'active' : ''}`}
                onClick={() => setImportMode('file')}
              >
                <FontAwesomeIcon icon={faFolderOpen} />
                <span>Arquivo do PC (.m3u / .m3u8)</span>
              </button>
              <button
                type="button"
                className={`modal-tab ${importMode === 'paste' ? 'active' : ''}`}
                onClick={() => setImportMode('paste')}
              >
                <FontAwesomeIcon icon={faFileLines} />
                <span>Colar Texto</span>
              </button>
            </div>

            <div className="tv-modal-body">
              <div className="form-group">
                <label>Nome da Lista (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ex: Minha Lista IPTV, Canais Abertos..."
                  value={importPlaylistName}
                  onChange={(e) => setImportPlaylistName(e.target.value)}
                />
              </div>

              {importMode === 'url' && (
                <div className="form-group">
                  <label>URL da Lista M3U ou M3U8:</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/playlist.m3u8 ou .m3u"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                  <span className="field-hint">
                    O GhostShield protege sua conexão validando links seguros e rejeitando executáveis maliciosos.
                  </span>
                </div>
              )}

              {importMode === 'file' && (
                <div className="form-group file-pick-group">
                  <label>Arquivo Local do Computador:</label>
                  <button
                    type="button"
                    className="btn-pick-file-tv"
                    onClick={handlePickLocalM3uFile}
                    disabled={importLoading}
                  >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    <span>Selecionar arquivo .m3u ou .m3u8...</span>
                  </button>
                </div>
              )}

              {importMode === 'paste' && (
                <div className="form-group">
                  <label>Cole o código M3U (#EXTM3U):</label>
                  <textarea
                    rows={8}
                    placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-name=&quot;Canal 1&quot;,Canal 1&#10;http://stream.example.com/live.m3u8"
                    value={importPasteText}
                    onChange={(e) => setImportPasteText(e.target.value)}
                  />
                </div>
              )}

              {importFeedback && (
                <div
                  className={`import-feedback-box ${
                    importFeedback.startsWith('🎉') ? 'success' : 'error'
                  }`}
                >
                  {importFeedback}
                </div>
              )}
            </div>

            <div className="tv-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowImportModal(false)}
              >
                Cancelar
              </button>

              {importMode === 'url' && (
                <button
                  type="button"
                  className="btn-confirm-import"
                  onClick={handleImportByUrl}
                  disabled={importLoading}
                >
                  {importLoading ? (
                    <>
                      <FontAwesomeIcon icon={faRotate} spin />
                      <span>Baixando & Validando...</span>
                    </>
                  ) : (
                    <span>Carregar Lista</span>
                  )}
                </button>
              )}

              {importMode === 'paste' && (
                <button
                  type="button"
                  className="btn-confirm-import"
                  onClick={handleImportByPaste}
                  disabled={importLoading}
                >
                  <span>Processar Texto</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO DE LISTAS */}
      {showManageModal && (
        <div className="tv-modal-overlay" onClick={() => setShowManageModal(false)}>
          <div className="tv-modal-content modal-manage" onClick={(e) => e.stopPropagation()}>
            <div className="tv-modal-header">
              <div className="modal-title-box">
                <FontAwesomeIcon icon={faListCheck} className="modal-icon" />
                <h3>Listas IPTV Importadas ({playlists.length})</h3>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowManageModal(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="tv-modal-body">
              {playlists.length === 0 ? (
                <p className="no-playlists-msg">
                  Nenhuma lista cadastrada no momento. Clique em "Importar Lista" para adicionar.
                </p>
              ) : (
                <div className="playlists-scroll-list">
                  {playlists.map((playlist) => (
                    <div key={playlist.id} className="playlist-item-card">
                      <div className="playlist-item-info">
                        <h4>{playlist.name}</h4>
                        <span className="playlist-meta">
                          {playlist.channelCount} canais · {playlist.url || playlist.filePath || 'Texto Colado'}
                        </span>
                      </div>
                      <div className="playlist-item-actions">
                        {playlist.url && (
                          <button
                            type="button"
                            className="btn-refresh-pl"
                            onClick={() => handleRefreshPlaylist(playlist)}
                            title="Recarregar canais da web"
                          >
                            <FontAwesomeIcon icon={faRotate} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-delete-pl"
                          onClick={() => handleDeletePlaylist(playlist.id)}
                          title="Excluir lista e seus canais"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="tv-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowManageModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ATRIBUIÇÃO MANUAL DE EPG (PADRÃO TIVIMATE) */}
      {assignModalChannel && (
        <AlazterflixAssignEpgModal
          channel={assignModalChannel}
          epgChannels={epgChannels}
          currentAssignedId={manualAssignments[assignModalChannel.id]}
          onClose={() => setAssignModalChannel(null)}
          onSaveAssignment={handleSaveManualAssignment}
        />
      )}

      {/* MODAL DE GUIA DE PROGRAMAÇÃO COMPLETO DO CANAL */}
      {scheduleModalChannel && (
        <AlazterflixChannelScheduleModal
          channel={scheduleModalChannel}
          schedule={
            epgPrograms.filter(
              (p) =>
                p.channelId ===
                (scheduleModalChannel.assignedEpgId ||
                  scheduleModalChannel.tvgId ||
                  scheduleModalChannel.id)
            )
          }
          currentProgram={scheduleModalChannel.currentProgram}
          onClose={() => setScheduleModalChannel(null)}
          onOpenAssignModal={() => {
            const ch = scheduleModalChannel
            setScheduleModalChannel(null)
            setAssignModalChannel(ch)
          }}
          onPlay={() => onPlayChannel(scheduleModalChannel)}
        />
      )}

    </div>
  )
}
