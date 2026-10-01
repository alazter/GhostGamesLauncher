import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faDownload,
  faCloud,
  faSpinner,
  faExchangeAlt,
  faFolder
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import {
  useChooseDownloadModal,
  closeChooseDownloadModal
} from 'frontend/state/ChooseDownloadModal'
import ExternalStoreLogo from 'frontend/screens/DownloadManager/components/ExternalStoreLogo'
import './index.css'

export function ChooseDownloadModalWrapper() {
  const modalState = useChooseDownloadModal()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!modalState.isOpen) {
      setNotice(null)
      setSubmitting(false)
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeChooseDownloadModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalState.isOpen])

  if (!modalState.isOpen || !modalState.game) {
    return null
  }

  const handleSelectSource = async (sourceId: string, isTorbox: boolean) => {
    if (!modalState.game) return
    if (isTorbox && !modalState.isTorboxConfigured) {
      setNotice(
        'O TorBox ainda não está configurado. Conecte sua conta em Configurações > Integrações de downloads ou escolha a opção de Download Direto.'
      )
      return
    }

    setSubmitting(true)
    setNotice(null)
    try {
      const res = await window.api.externalGamesInstall({
        game: modalState.game,
        sourceId,
        replaceInstallationId: modalState.replaceInstallationId,
        targetDirectory: modalState.targetDirectory,
        confirmed: true
      })

      if (res.success) {
        closeChooseDownloadModal()
        navigate('/download-manager')
        if (window.location.hash !== '#/download-manager') {
          window.location.hash = '#/download-manager'
        }
      } else {
        setNotice(res.error || 'Não foi possível iniciar o download. Verifique as configurações.')
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const {
    title,
    version,
    providerName,
    providerIcon,
    targetDirectory,
    sources,
    loadingSources,
    isTorboxConfigured
  } = modalState

  const torboxSource = sources.find((s) => s.type === 'torbox')
  const directSources = sources.filter((s) => s.type === 'external' || s.type === 'direct')
  const hasDirect = directSources.length > 0
  const hasTorbox = Boolean(torboxSource)

  const renderDirectOption = () => {
    if (hasDirect) {
      return directSources.map((source) => (
        <button
          key={source.id}
          type="button"
          className="cdmChoiceBtn"
          disabled={submitting}
          onClick={() => void handleSelectSource(source.id, false)}
        >
          <div className="cdmBtnLeft">
            <FontAwesomeIcon icon={faDownload} className="cdmBtnIcon" />
            <div className="cdmBtnTexts">
              <span className="cdmBtnLabel">
                {source.type === 'external'
                  ? 'Download direto — Confirmar no site'
                  : source.name || 'Download Direto'}
              </span>
              <span className="cdmBtnSize">
                Download direto em alta velocidade via navegador assistido (Buzzheavier, MegaDB, etc.)
              </span>
            </div>
          </div>
          {!hasTorbox && <span className="cdmActiveBadge">Disponível</span>}
        </button>
      ))
    }

    return (
      <button
        type="button"
        className="cdmChoiceBtn"
        style={{ opacity: 0.72 }}
        disabled={submitting}
        onClick={() => {
          setNotice(
            `A loja ${providerName || 'atual'} disponibiliza este jogo exclusivamente através de Torrent. Utilize a opção TorBox abaixo para baixar.`
          )
        }}
      >
        <div className="cdmBtnLeft">
          <FontAwesomeIcon icon={faDownload} className="cdmBtnIcon" style={{ color: '#64748b' }} />
          <div className="cdmBtnTexts">
            <span className="cdmBtnLabel">Download direto</span>
            <span className="cdmBtnSize">Não aplicável nesta loja (distribuição exclusiva via Torrent)</span>
          </div>
        </div>
        <span className="cdmInfoBadge">Exclusivo TorBox</span>
      </button>
    )
  }

  const renderTorboxOption = () => {
    if (hasTorbox) {
      const torboxMissing = !isTorboxConfigured
      return (
        <button
          key={torboxSource!.id}
          type="button"
          className="cdmChoiceBtn"
          disabled={submitting}
          onClick={() => void handleSelectSource(torboxSource!.id, true)}
        >
          <div className="cdmBtnLeft">
            <FontAwesomeIcon icon={faCloud} className="cdmBtnIcon" />
            <div className="cdmBtnTexts">
              <span className="cdmBtnLabel">TorBox — Torrent</span>
              <span className="cdmBtnSize">
                Download em nuvem de alta velocidade com tráfego criptografado
              </span>
            </div>
          </div>
          {torboxMissing ? (
            <span className="cdmMissingBadge">Não configurado</span>
          ) : (
            <span className="cdmActiveBadge">Disponível</span>
          )}
        </button>
      )
    }

    return (
      <button
        type="button"
        className="cdmChoiceBtn"
        style={{ opacity: 0.72 }}
        disabled={submitting}
        onClick={() => {
          setNotice(
            `A loja ${providerName || 'selecionada'} disponibiliza este jogo exclusivamente através de Download Direto de alta velocidade (servidores dedicados como Buzzheavier e MegaDB), sem necessidade de P2P ou Torrent. Escolha a opção "Download direto" acima para baixar com máxima velocidade.`
          )
        }}
      >
        <div className="cdmBtnLeft">
          <FontAwesomeIcon icon={faCloud} className="cdmBtnIcon" style={{ color: '#64748b' }} />
          <div className="cdmBtnTexts">
            <span className="cdmBtnLabel">TorBox — Torrent</span>
            <span className="cdmBtnSize">
              Disponível em lojas com rede Torrent (AnkerGames / Online-Fix)
            </span>
          </div>
        </div>
        <span className="cdmInfoBadge">Exclusivo p/ fontes Torrent</span>
      </button>
    )
  }

  return (
    <div className="cdmModalOverlay" onClick={closeChooseDownloadModal}>
      <div
        className="cdmModalCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdmModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cdmModalHeader">
          <div className="cdmModalTitle">
            <FontAwesomeIcon icon={faExchangeAlt} style={{ color: '#00ffff' }} />
            <span id="cdmModalTitle">Escolha como baixar</span>
          </div>
          <button
            type="button"
            className="cdmModalCloseBtn"
            aria-label="Fechar"
            onClick={closeChooseDownloadModal}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="cdmModalBody">
          <div className="cdmGameHeaderRow">
            <div className="cdmGameTitleCol">
              <strong className="cdmGameTitleText">{title}</strong>
              {version && <span className="cdmVersionBadge">v{version.replace(/^v/i, '')}</span>}
            </div>
            {providerName && (
              <div className="cdmStoreBadgePill" title={`Loja de Origem: ${providerName}`}>
                <ExternalStoreLogo
                  icon={providerIcon || (modalState.game as any)?.providerIcon}
                  name={providerName}
                  size={20}
                />
                <span className="cdmStoreName">{providerName}</span>
              </div>
            )}
          </div>

          {targetDirectory && (
            <div className="cdmPathNotice" title={targetDirectory}>
              <FontAwesomeIcon icon={faFolder} className="cdmPathIcon" />
              <span className="cdmPathText">Pasta: {targetDirectory}</span>
            </div>
          )}

          {notice && <div className="cdmNoticeBox">{notice}</div>}

          {loadingSources ? (
            <div className="cdmLoadingRow">
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                style={{ color: '#00ffff', marginRight: '8px' }}
              />
              <span>Buscando opções de download disponíveis...</span>
            </div>
          ) : (
            <div className="cdmChoices">
              {hasTorbox && !hasDirect ? (
                <>
                  {renderTorboxOption()}
                  {renderDirectOption()}
                </>
              ) : (
                <>
                  {renderDirectOption()}
                  {renderTorboxOption()}
                </>
              )}
            </div>
          )}
        </div>

        <div className="cdmModalFooter">
          <button
            type="button"
            className="cdmBtnCancel"
            onClick={closeChooseDownloadModal}
            disabled={submitting}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
export default ChooseDownloadModalWrapper
