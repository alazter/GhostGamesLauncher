import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faDownload,
  faCloud,
  faSpinner,
  faFolder,
  faBolt,
  faGamepad,
  faStore,
  faCheck,
  faChevronDown,
  faExchangeAlt
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import {
  useChooseDownloadModal,
  closeChooseDownloadModal,
  switchChooseDownloadStore
} from 'frontend/state/ChooseDownloadModal'
import ExternalStoreLogo from 'frontend/screens/DownloadManager/components/ExternalStoreLogo'
import './index.css'

export function ChooseDownloadModalWrapper() {
  const modalState = useChooseDownloadModal()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const [showStoreSelector, setShowStoreSelector] = useState(false)

  useEffect(() => {
    if (!modalState.isOpen) {
      setNotice(null)
      setSubmitting(false)
      setImgFailed(false)
      setShowStoreSelector(false)
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
    providerId,
    targetDirectory,
    sources,
    loadingSources,
    isTorboxConfigured,
    availableSources,
    searchingOtherStores
  } = modalState

  const coverImage = !imgFailed
    ? modalState.cover ||
      modalState.game?.coverUrl ||
      (modalState.game as any)?.cover ||
      (modalState.game as any)?.art_cover
    : null

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
              <span className="cdmBtnSub">
                Download direto em alta velocidade (Buzzheavier, MegaDB)
              </span>
            </div>
          </div>
          <span className="cdmSpeedBadge">
            <FontAwesomeIcon icon={faBolt} /> Alta Velocidade
          </span>
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
            <span className="cdmBtnSub">Não aplicável nesta loja (distribuição exclusiva via Torrent)</span>
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
              <span className="cdmBtnSub">
                Download em nuvem rápida com descompactação e IP protegido
              </span>
            </div>
          </div>
          {torboxMissing ? (
            <span className="cdmMissingBadge">Não configurado</span>
          ) : (
            <span className="cdmDebridBadge">
              <FontAwesomeIcon icon={faCloud} /> Nuvem Debrid
            </span>
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
            <span className="cdmBtnSub">
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
        {/* Header Cyber Neon */}
        <div className="cdmModalHeader">
          <div className="cdmModalTitle">
            <FontAwesomeIcon icon={faDownload} className="cdmModalTitleIcon" />
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
          {/* Showcase do Jogo */}
          <div className="cdmGameCardShowcase">
            <div className="cdmGameCoverWrap">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={title}
                  className="cdmGameCover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="cdmGameCoverFallback">
                  <FontAwesomeIcon icon={faGamepad} />
                </div>
              )}
            </div>

            <div className="cdmGameInfoCol">
              <strong className="cdmGameTitleText" title={title}>
                {title}
              </strong>

              <div className="cdmGameMetaRow">
                {version && (
                  <span className="cdmVersionBadge">
                    <FontAwesomeIcon icon={faBolt} style={{ fontSize: '10px' }} />
                    <span>v{version.replace(/^v/i, '')}</span>
                  </span>
                )}
                {availableSources.length > 1 && (
                  <button
                    type="button"
                    className="cdmSwitchStoreInlineBtn"
                    title="Clique para trocar a loja deste jogo"
                    onClick={() => setShowStoreSelector((prev) => !prev)}
                  >
                    <FontAwesomeIcon icon={faExchangeAlt} />
                    <span>Trocar loja ({availableSources.length})</span>
                  </button>
                )}
              </div>

              {targetDirectory && (
                <div className="cdmPathNotice" title={targetDirectory}>
                  <FontAwesomeIcon icon={faFolder} className="cdmPathIcon" />
                  <span className="cdmPathText">{targetDirectory}</span>
                </div>
              )}
            </div>

            {providerName && (
              <div className="cdmStoreBadgeCol">
                <button
                  type="button"
                  className={`cdmStoreBadgePill cdmStoreBadgeClickable ${showStoreSelector ? 'active' : ''}`}
                  title="Clique para trocar de loja"
                  onClick={() => setShowStoreSelector((prev) => !prev)}
                >
                  <ExternalStoreLogo
                    icon={providerIcon || (modalState.game as any)?.providerIcon}
                    name={providerName}
                    size={22}
                  />
                  <span className="cdmStoreName">{providerName}</span>
                  <span className="cdmStoreChangeTag">
                    <FontAwesomeIcon icon={faExchangeAlt} />
                    <span>Trocar</span>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      style={{
                        fontSize: '9px',
                        transform: showStoreSelector ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* GAVETA DE TROCA DE LOJA CYBER NEON */}
          {showStoreSelector && (
            <div className="cdmStoreSelectorDrawer">
              <div className="cdmStoreSelectorHeader">
                <div className="cdmStoreSelectorTitle">
                  <FontAwesomeIcon icon={faStore} style={{ color: '#00ffff' }} />
                  <span>Escolha a loja de onde deseja baixar:</span>
                </div>
                {searchingOtherStores && (
                  <span className="cdmSearchingStoresHint">
                    <FontAwesomeIcon icon={faSpinner} spin /> Buscando outras lojas...
                  </span>
                )}
              </div>

              <div className="cdmStoreGrid">
                {availableSources.map((store) => {
                  const isCurrent = store.providerId === providerId
                  return (
                    <button
                      key={`${store.providerId}-${store.id}`}
                      type="button"
                      className={`cdmStoreCardBtn ${isCurrent ? 'active' : ''}`}
                      onClick={() => {
                        void switchChooseDownloadStore(store)
                        setShowStoreSelector(false)
                      }}
                    >
                      <div className="cdmStoreCardLeft">
                        <ExternalStoreLogo
                          icon={store.providerIcon}
                          name={store.providerName}
                          size={24}
                        />
                        <div className="cdmStoreCardInfo">
                          <strong className="cdmStoreCardName">{store.providerName}</strong>
                          <span className="cdmStoreCardVer">
                            {store.version ? `v${store.version.replace(/^v/i, '')}` : 'Mais recente'}
                          </span>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="cdmStoreActiveBadge">
                          <FontAwesomeIcon icon={faCheck} /> Ativa
                        </span>
                      ) : (
                        <span className="cdmStoreSelectActionBadge">
                          Selecionar
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
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
