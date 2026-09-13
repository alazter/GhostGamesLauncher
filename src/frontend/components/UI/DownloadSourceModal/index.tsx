import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDownload,
  faTimes,
  faBolt,
  faRocket,
  faMagnet,
  faServer,
  faCheckCircle,
  faSpinner
} from '@fortawesome/free-solid-svg-icons'
import type { GhostDownloadSource } from 'common/types/plugins'
import './index.scss'

interface DownloadSourceModalProps {
  isOpen: boolean
  onClose: () => void
  gameTitle: string
  coverUrl?: string
  providerId: string
  gameId: string
}

export default function DownloadSourceModal({
  isOpen,
  onClose,
  gameTitle,
  coverUrl,
  providerId,
  gameId
}: DownloadSourceModalProps) {
  const [sources, setSources] = useState<GhostDownloadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !providerId || !gameId) {
      setSources([])
      setLoading(true)
      setDownloadingId(null)
      setDownloadSuccess(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    window.api
      .pluginsGetDownloadSources(providerId, gameId)
      .then((res) => {
        setSources(res || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Falha ao buscar fontes de download.')
        setLoading(false)
      })
  }, [isOpen, providerId, gameId])

  if (!isOpen) return null

  const handleStartDownload = async (source: GhostDownloadSource) => {
    setDownloadingId(source.id)
    setError(null)

    try {
      const res = await window.api.pluginsStartDownload(source, gameTitle, coverUrl)
      if (res.success) {
        setDownloadSuccess(source.id)
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(res.error || 'Erro ao iniciar download.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao iniciar download.')
    } finally {
      setDownloadingId(null)
    }
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'torbox':
        return faRocket
      case 'magnet':
      case 'torrent':
        return faMagnet
      case 'direct':
        return faBolt
      default:
        return faServer
    }
  }

  return (
    <div className="ghost-download-modal-overlay" onClick={onClose}>
      <div
        className="ghost-download-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ghost-download-close-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="ghost-download-header">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={gameTitle}
              className="ghost-download-cover-thumb"
            />
          )}
          <div className="ghost-download-info">
            <span className="ghost-download-badge">👻 Ghost Community Source</span>
            <h2 className="ghost-download-title">{gameTitle}</h2>
            <p className="ghost-download-subtitle">
              Selecione o melhor servidor ou protocolo para iniciar seu download com segurança.
            </p>
          </div>
        </div>

        {error && <div className="ghost-download-error-msg">{error}</div>}

        <div className="ghost-download-sources-list">
          {loading ? (
            <div className="ghost-download-loading">
              <FontAwesomeIcon icon={faSpinner} spin className="ghost-download-spin-icon" />
              <span>Buscando fontes disponíveis nos plugins ativos...</span>
            </div>
          ) : sources.length === 0 ? (
            <div className="ghost-download-empty">
              Nenhuma fonte de download encontrada para este jogo no provedor atual.
            </div>
          ) : (
            sources.map((source) => {
              const isStarting = downloadingId === source.id
              const isSuccess = downloadSuccess === source.id

              return (
                <div key={source.id} className="ghost-download-source-item">
                  <div className="ghost-download-source-icon-wrap">
                    <FontAwesomeIcon icon={getSourceIcon(source.type)} />
                  </div>

                  <div className="ghost-download-source-details">
                    <div className="ghost-download-source-name">
                      {source.name}
                      <span className={`ghost-download-type-tag type-${source.type}`}>
                        {source.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="ghost-download-source-meta">
                      {source.size && <span>💾 {source.size}</span>}
                      {source.seeders !== undefined && <span>🌱 {source.seeders} seeders</span>}
                      {source.speed && <span>⚡ {source.speed}</span>}
                    </div>
                  </div>

                  <button
                    className={`ghost-download-action-btn ${isSuccess ? 'success' : ''}`}
                    onClick={() => handleStartDownload(source)}
                    disabled={isStarting || isSuccess}
                  >
                    {isSuccess ? (
                      <>
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Iniciado!</span>
                      </>
                    ) : isStarting ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faDownload} />
                        <span>Baixar</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="ghost-download-footer">
          <span className="ghost-shield-tag">
            🛡️ Protegido por GhostShield Sandbox • Zero acesso a contas ou arquivos do sistema
          </span>
        </div>
      </div>
    </div>
  )
}
