import { useContext, useEffect, useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faDownload,
  faCloud,
  faSpinner,
  faFolder,
  faGamepad,
  faCheck,
  faArrowRight,
  faPaintBrush,
  faCalendarAlt,
  faTag,
  faHardDrive,
  faList
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import {
  useChooseDownloadModal,
  closeChooseDownloadModal,
  switchChooseDownloadStore,
  submitChooseDownloadSource
} from 'frontend/state/ChooseDownloadModal'
import { useDownloadDialogLayout } from 'frontend/state/downloadDialogAppearance'
import {
  formatSourceReleaseDate,
  installedReleaseCandidate
} from 'common/externalReleaseInfo'
import type { GhostDownloadSource } from 'common/types/plugins'
import ContextProvider from 'frontend/state/ContextProvider'
import CachedImage from 'frontend/components/UI/CachedImage'
import ghostLogo from 'frontend/assets/ghost-logo.png'
import DownloadAppearanceSettings from './DownloadAppearanceSettings'
import SourcePicker from './SourcePicker'
import { useExternalGameCover } from 'frontend/hooks/useExternalGameCover'
import './index.css'

export function ChooseDownloadModalWrapper() {
  const modalState = useChooseDownloadModal()
  const layout = useDownloadDialogLayout()
  const navigate = useNavigate()
  const { showDialogModal } = useContext(ContextProvider)
  const appearanceId = useId()
  const [notice, setNotice] = useState<string | null>(null)
  const [showStoreSelector, setShowStoreSelector] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
  const { cover: coverImage, rejectCover } = useExternalGameCover(
    modalState.game,
    modalState.availableSources,
    modalState.isOpen
  )

  useEffect(() => {
    if (!modalState.isOpen) {
      setNotice(null)
      setShowStoreSelector(false)
      setShowAppearance(false)
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (showAppearance) setShowAppearance(false)
      else if (showStoreSelector) setShowStoreSelector(false)
      else closeChooseDownloadModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalState.isOpen, showAppearance, showStoreSelector])

  if (!modalState.isOpen || !modalState.game) return null
  const {
    game,
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
  const directSources = sources.filter(
    (source) => source.type === 'external' || source.type === 'direct'
  )
  const torboxSource = sources.find((source) => source.type === 'torbox')
  const releaseDate = formatSourceReleaseDate(
    installedReleaseCandidate(game).sourceDate
  )
  const size = game.size?.trim()

  const handleSelectSource = async (sourceId: string, isTorbox: boolean) => {
    if (isTorbox && !isTorboxConfigured) {
      setNotice(
        'O TorBox ainda não está configurado. Conecte sua conta em Configurações > Integrações de downloads ou escolha Download direto.'
      )
      return
    }
    setNotice(null)
    const result = await submitChooseDownloadSource(sourceId, () => {
      navigate('/download-manager')
      if (window.location.hash !== '#/download-manager')
        window.location.hash = '#/download-manager'
    })
    if (result?.error)
      showDialogModal({
        type: 'ERROR',
        title: `Não foi possível iniciar o download de ${title}`,
        message: result.error
      })
  }
  const changeDirectory = async () => {
    const current = useChooseDownloadModal.getState().game
    try {
      const directory = await window.api.openDialog({
        title: 'Escolha a pasta de instalação',
        buttonLabel: 'Selecionar pasta',
        properties: ['openDirectory']
      })
      const state = useChooseDownloadModal.getState()
      if (
        typeof directory === 'string' &&
        directory.trim() &&
        state.isOpen &&
        state.game === current
      )
        useChooseDownloadModal.setState({ targetDirectory: directory.trim() })
    } catch {
      setNotice(
        'Não foi possível escolher a pasta de instalação. Tente novamente.'
      )
    }
  }
  const renderMethod = (source: GhostDownloadSource, torbox = false) => {
    const automatic = [
      'anker-browser-direct',
      'steamrip-browser-direct',
      'rom-browser-direct',
      'online-fix-hosters-direct'
    ].includes(source.id)
    const label = torbox
      ? 'TorBox'
      : source.type === 'direct'
        ? source.name || 'Download direto'
        : 'Download direto'
    const badge = torbox
      ? 'Torrent'
      : automatic
        ? 'Automático'
        : source.type === 'external'
          ? 'Confirmar no site'
          : 'Direto'
    return (
      <button
        key={source.id}
        type="button"
        className="cdmChoiceBtn"
        onClick={() => void handleSelectSource(source.id, torbox)}
      >
        <FontAwesomeIcon
          icon={torbox ? faCloud : faDownload}
          className="cdmMethodIcon"
        />
        <span className="cdmMethodCopy">
          <span className="cdmMethodTop">
            <span className="cdmMethodTitle">{label}</span>
            <span className="cdmMethodBadge">{badge}</span>
          </span>
          <span className="cdmMethodDescription">
            {torbox
              ? 'Processe o torrent na sua conta em nuvem.'
              : source.id === 'online-fix-hosters-direct'
                ? 'Baixe o jogo e o fix pelo Ghost.'
                : automatic
                  ? 'Baixe os arquivos diretamente pelo Ghost.'
                  : source.type === 'external'
                    ? 'Confirme o download na página da fonte.'
                    : 'Baixe o arquivo disponibilizado pela fonte.'}
          </span>
          <span className="cdmMethodMeta">
            {torbox ? (
              <>
                <FontAwesomeIcon
                  icon={isTorboxConfigured ? faCheck : faCloud}
                />
                {isTorboxConfigured
                  ? 'Conta TorBox conectada'
                  : 'Conecte sua conta TorBox'}
              </>
            ) : automatic ? (
              'Preparação e acompanhamento em Downloads'
            ) : (
              source.size || 'Acompanhamento em Downloads'
            )}
          </span>
        </span>
        <FontAwesomeIcon icon={faArrowRight} className="cdmMethodArrow" />
      </button>
    )
  }
  const unavailable = (torbox: boolean) => (
    <div className="cdmChoiceBtn cdmChoiceUnavailable" aria-disabled="true">
      <FontAwesomeIcon
        icon={torbox ? faCloud : faDownload}
        className="cdmMethodIcon"
      />
      <span className="cdmMethodCopy">
        <span className="cdmMethodTitle">
          {torbox ? 'TorBox — Torrent' : 'Download direto'}
        </span>
        <span className="cdmMethodDescription">
          Não disponível nesta fonte.
        </span>
      </span>
    </div>
  )
  return (
    <div className="cdmModalOverlay" onClick={closeChooseDownloadModal}>
      <div
        className={`cdmModalCard cdmModalCard--${layout}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdmModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        {coverImage && (
          <CachedImage
            key={`backdrop-${coverImage}`}
            src={coverImage}
            alt=""
            aria-hidden="true"
            className="cdmBackdropArt"
            loading="eager"
            hideOnError={false}
          />
        )}
        <div className="cdmBackdropShade" aria-hidden="true" />
        <header className="cdmModalHeader">
          <div>
            <div className="cdmBrandLine">
              <span className="cdmBrand">
                <img src={ghostLogo} alt="Logo do Ghost" />
                Ghost
              </span>
              <span className="cdmBrandDivider" />
              <span className="cdmDownloadsLabel">DOWNLOADS</span>
              <button
                type="button"
                className="cdmIconAction cdmAppearanceButton"
                aria-label="Personalizar janela de download"
                title="Personalizar janela de download"
                aria-expanded={showAppearance}
                aria-controls={appearanceId}
                onClick={() => setShowAppearance((value) => !value)}
              >
                <FontAwesomeIcon icon={faPaintBrush} />
              </button>
            </div>
            <h2 id="cdmModalTitle">Escolha como baixar</h2>
          </div>
          <button
            type="button"
            className="cdmIconAction"
            aria-label="Fechar"
            onClick={closeChooseDownloadModal}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </header>
        <div className="cdmScrollContent">
          {showAppearance && (
            <div id={appearanceId} className="cdmAppearancePanel">
              <DownloadAppearanceSettings />
            </div>
          )}
          <div className="cdmModalBody">
            <section
              className="cdmGameShowcase"
              aria-label="Jogo e fonte selecionada"
            >
              <div className="cdmGameCoverWrap">
                {coverImage ? (
                  <CachedImage
                    key={coverImage}
                    src={coverImage}
                    alt={`Capa de ${title}`}
                    className="cdmGameCover"
                    width={600}
                    height={900}
                    loading="eager"
                    hideOnError={false}
                    onError={rejectCover}
                  />
                ) : (
                  <div className="cdmGameCoverFallback">
                    <FontAwesomeIcon icon={faGamepad} />
                  </div>
                )}
              </div>
              <div className="cdmGameInfo">
                <h3>{title}</h3>
                <span className="cdmVersion">
                  <FontAwesomeIcon icon={faTag} />
                  {version
                    ? `v${version.replace(/^v/i, '')}`
                    : 'Versão não informada'}
                </span>
                <span className="cdmReleaseDate">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <span>
                    LAST UPDATE <strong>{releaseDate}</strong>
                  </span>
                </span>
                <span className="cdmGameSize">
                  <FontAwesomeIcon icon={faHardDrive} />
                  <span>{size || 'Tamanho não informado'}</span>
                </span>
              </div>
              <SourcePicker
                name={providerName}
                icon={providerIcon}
                providerId={providerId}
                stores={availableSources}
                searching={searchingOtherStores}
                open={showStoreSelector}
                onOpenChange={setShowStoreSelector}
                onSelect={(store) => {
                  setNotice(null)
                  void switchChooseDownloadStore(store)
                }}
              />
            </section>
            <div className="cdmDownloadDetails">
              <div className="cdmPathRow">
                <FontAwesomeIcon icon={faFolder} />
                <div>
                  <span className="cdmFieldLabel">Instalar em</span>
                  <span className="cdmPathValue">
                    {targetDirectory || 'Pasta padrão do Ghost'}
                  </span>
                </div>
                <button
                  type="button"
                  className="cdmTextAction"
                  onClick={() => void changeDirectory()}
                >
                  Alterar
                </button>
              </div>
              {notice && (
                <p className="cdmNoticeBox" role="status">
                  {notice}
                </p>
              )}
              <h4 className="cdmSectionLabel">Método de download</h4>
              {loadingSources ? (
                <div className="cdmLoadingRow" role="status">
                  <FontAwesomeIcon icon={faSpinner} spin /> Buscando opções de
                  download disponíveis...
                </div>
              ) : (
                <div className="cdmChoices">
                  {torboxSource && !directSources.length ? (
                    <>
                      {renderMethod(torboxSource, true)}
                      {unavailable(false)}
                    </>
                  ) : (
                    <>
                      {directSources.length
                        ? directSources.map((source) => renderMethod(source))
                        : unavailable(false)}
                      {torboxSource
                        ? renderMethod(torboxSource, true)
                        : unavailable(true)}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <footer className="cdmModalFooter">
          <span>
            <FontAwesomeIcon icon={faList} /> Acompanhe o progresso em
            Downloads.
          </span>
          <button
            type="button"
            className="cdmBtnCancel"
            onClick={closeChooseDownloadModal}
          >
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  )
}
export default ChooseDownloadModalWrapper
