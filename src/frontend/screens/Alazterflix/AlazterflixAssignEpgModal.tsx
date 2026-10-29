import React, { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faListCheck,
  faXmark,
  faSearch,
  faCheck,
  faTv,
  faRotateLeft,
  faTowerBroadcast
} from '@fortawesome/free-solid-svg-icons'
import type { GhostTvChannel, GhostEpgChannel } from 'common/types/plugins'

interface AlazterflixAssignEpgModalProps {
  channel: GhostTvChannel
  epgChannels: GhostEpgChannel[]
  currentAssignedId?: string
  onClose: () => void
  onSaveAssignment: (channelId: string, assignedEpgId: string | null) => void
}

export default function AlazterflixAssignEpgModal({
  channel,
  epgChannels,
  currentAssignedId,
  onClose,
  onSaveAssignment
}: AlazterflixAssignEpgModalProps) {
  const [search, setSearch] = useState('')
  const [selectedEpgId, setSelectedEpgId] = useState<string | null>(
    currentAssignedId || channel.assignedEpgId || null
  )

  const currentlyAssignedChannel = useMemo(() => {
    if (!selectedEpgId) return null
    return epgChannels.find((c) => c.id === selectedEpgId) || null
  }, [selectedEpgId, epgChannels])

  const filteredEpgChannels = useMemo(() => {
    if (!search.trim()) {
      return epgChannels.slice(0, 100)
    }
    const q = search.trim().toLowerCase()
    return epgChannels
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      )
      .slice(0, 100)
  }, [search, epgChannels])

  const handleSave = () => {
    onSaveAssignment(channel.id, selectedEpgId)
    onClose()
  }

  const handleClear = () => {
    setSelectedEpgId(null)
    onSaveAssignment(channel.id, null)
    onClose()
  }

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div
        className="tv-modal-content alazter-assign-epg-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tv-modal-header">
          <div className="modal-title-box">
            <FontAwesomeIcon icon={faListCheck} className="modal-icon" />
            <div>
              <h3>Atribuir EPG ao Canal</h3>
              <p className="modal-subtitle">
                Vincule um canal do Guia XMLTV a este canal da lista M3U
              </p>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Informações do Canal M3U */}
        <div className="assign-channel-target-card">
          <div className="target-channel-logo">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <FontAwesomeIcon icon={faTv} />
            )}
          </div>
          <div className="target-channel-info">
            <div className="target-name-row">
              <h4>{channel.name}</h4>
              <span className="channel-group-tag">{channel.group}</span>
            </div>
            <div className="target-meta-tags">
              {channel.tvgId && (
                <span className="tag-meta">tvg-id: {channel.tvgId}</span>
              )}
              {channel.tvgName && (
                <span className="tag-meta">tvg-name: {channel.tvgName}</span>
              )}
            </div>
            <div className="current-assignment-status">
              {currentlyAssignedChannel ? (
                <div className="assigned-badge-active">
                  <span>
                    Vinculado a: <strong>{currentlyAssignedChannel.displayName}</strong> ({currentlyAssignedChannel.id})
                  </span>
                  <button
                    type="button"
                    className="btn-unassign"
                    onClick={handleClear}
                    title="Remover atribuição manual e restaurar automático"
                  >
                    <FontAwesomeIcon icon={faRotateLeft} /> Desvincular
                  </button>
                </div>
              ) : (
                <span className="assigned-badge-none">
                  Nenhum EPG atribuído manualmente (modo automático ativo)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Busca no XMLTV */}
        <div className="assign-search-box">
          <div className="search-input-wrapper">
            <FontAwesomeIcon icon={faSearch} className="search-icon" />
            <input
              type="text"
              placeholder="Pesquisar canal no Guia XMLTV por nome ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
          <span className="search-stats-text">
            {epgChannels.length === 0 ? (
              <span className="text-warning">
                ⚠️ Nenhuma fonte XMLTV carregada. Adicione uma fonte EPG nas configurações.
              </span>
            ) : (
              `Mostrando ${filteredEpgChannels.length} de ${epgChannels.length} canais XMLTV disponíveis`
            )}
          </span>
        </div>

        {/* Lista de Canais do Guia XMLTV */}
        <div className="assign-epg-channels-list">
          {epgChannels.length === 0 ? (
            <div className="epg-empty-state">
              <FontAwesomeIcon icon={faTowerBroadcast} />
              <p>Nenhuma fonte EPG disponível.</p>
              <span>
                Adicione uma URL ou arquivo XMLTV na aba de configurações para mapear os canais.
              </span>
            </div>
          ) : filteredEpgChannels.length === 0 ? (
            <div className="epg-empty-state">
              <FontAwesomeIcon icon={faSearch} />
              <p>Nenhum canal do XMLTV encontrado para &quot;{search}&quot;.</p>
            </div>
          ) : (
            filteredEpgChannels.map((epgCh) => {
              const isSelected = selectedEpgId === epgCh.id
              return (
                <div
                  key={epgCh.id}
                  className={`epg-item-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedEpgId(epgCh.id)}
                >
                  <div className="epg-item-logo">
                    {epgCh.icon ? (
                      <img
                        src={epgCh.icon}
                        alt={epgCh.displayName}
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <FontAwesomeIcon icon={faTv} />
                    )}
                  </div>
                  <div className="epg-item-details">
                    <span className="epg-item-name">{epgCh.displayName}</span>
                    <span className="epg-item-id">ID: {epgCh.id}</span>
                  </div>
                  <div className="epg-item-action">
                    {isSelected ? (
                      <span className="badge-selected-check">
                        <FontAwesomeIcon icon={faCheck} /> Selecionado
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-select-epg"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEpgId(epgCh.id)
                        }}
                      >
                        Selecionar
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="tv-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-confirm-assign"
            onClick={handleSave}
            disabled={!selectedEpgId || selectedEpgId === channel.assignedEpgId}
          >
            <FontAwesomeIcon icon={faCheck} />
            <span>Salvar Atribuição de EPG</span>
          </button>
        </div>
      </div>
    </div>
  )
}
