import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import './index.scss'
import updateGhost from 'frontend/assets/update-ghost.png'
import { Release } from 'common/types'

interface Props {
  release: Release
  onClose: () => void
}

type ScreenMode = 'prompt' | 'changelog' | 'downloading'

export default function UpdatePopupModal({ release, onClose }: Props) {
  const navigate = useNavigate()
  const [screenMode, setScreenMode] = useState<ScreenMode>('prompt')
  const [downloadProgress, setDownloadProgress] = useState<{
    bytes: number
    speed: number
    percentage: number
    writingSpeed: number
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (screenMode === 'downloading') {
      const removeListener = window.api.handleDownloadLauncherUpdateProgress((event, progress) => {
        setDownloadProgress(progress)
      })

      return () => {
        removeListener()
      }
    }
    return undefined
  }, [screenMode])

  const handleDownload = () => {
    if (!release.assets || release.assets.length === 0) {
      setErrorMsg('Nenhum arquivo executável encontrado nesta versão.')
      return
    }

    setScreenMode('downloading')
    setErrorMsg(null)

    window.api.downloadLauncherUpdate(release.assets).then((res) => {
      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao realizar o download.')
        setScreenMode('prompt')
      }
    }).catch((err) => {
      setErrorMsg(String(err))
      setScreenMode('prompt')
    })
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderContent = () => {
    if (screenMode === 'changelog') {
      return (
        <div className="UpdatePopupModal__changelog-container">
          <div className="UpdatePopupModal__changelog-header">
            <button
              className="UpdatePopupModal__back-btn"
              onClick={() => setScreenMode('prompt')}
              title="Voltar"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <h3 className="UpdatePopupModal__changelog-title">
              Notas da Versão {release.tag_name}
            </h3>
          </div>
          <div className="UpdatePopupModal__changelog-body">
            {release.body ? (
              <ReactMarkdown
                className="changelogMarkdown"
                linkTarget={'_blank'}
                rehypePlugins={[rehypeRaw]}
              >
                {release.body}
              </ReactMarkdown>
            ) : (
              <p>Nenhuma nota de versão disponível.</p>
            )}
          </div>
        </div>
      )
    }

    if (screenMode === 'downloading') {
      const percent = downloadProgress ? Math.round(downloadProgress.percentage) : 0
      const speed = downloadProgress ? formatBytes(downloadProgress.speed) : '0 KB'
      const progressText = downloadProgress 
        ? `${formatBytes(downloadProgress.bytes)} / (${percent}%)`
        : 'Iniciando download...'

      return (
        <div className="UpdatePopupModal__downloading-container">
          <h2 className="UpdatePopupModal__title">Baixando Atualização</h2>
          <div className="UpdatePopupModal__progress-wrapper">
            <div className="UpdatePopupModal__progress-bar">
              <div 
                className="UpdatePopupModal__progress-fill" 
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="UpdatePopupModal__progress-info">
              <span>{progressText}</span>
              {downloadProgress && <span>{speed}/s</span>}
            </div>
          </div>
          <p className="UpdatePopupModal__status-text">
            O Ghost será fechado e o instalador será iniciado automaticamente após a conclusão.
          </p>
        </div>
      )
    }

    return (
      <>
        <button
          className="UpdatePopupModal__github-btn"
          onClick={() => {
            navigate(`/store-page?store-url=${encodeURIComponent(release.html_url)}`)
            onClose()
          }}
          title="Ver no GitHub"
        >
          <FontAwesomeIcon icon={faGithub} />
        </button>

        <button
          className="UpdatePopupModal__close-btn"
          onClick={onClose}
          title="Fechar"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="UpdatePopupModal__content">
          <img
            src={updateGhost}
            alt="Nova Versão Disponível"
            className="UpdatePopupModal__ghost-img"
          />
          <h2 className="UpdatePopupModal__title">
            Nova Versão Disponível!
          </h2>
          <p className="UpdatePopupModal__message">
            Uma nova versão do Ghost Games Launcher está disponível ({release.tag_name}). Deseja fazer o download agora?
          </p>
          {errorMsg && <p className="UpdatePopupModal__error">{errorMsg}</p>}
        </div>

        <div className="UpdatePopupModal__footer">
          <button
            className="UpdatePopupModal__btn-changelog"
            onClick={() => setScreenMode('changelog')}
          >
            Changelog
          </button>
          <div className="UpdatePopupModal__right-buttons">
            <button
              className="UpdatePopupModal__btn-later"
              onClick={onClose}
            >
              Depois
            </button>
            <button
              className="UpdatePopupModal__btn-download"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>
      </>
    )
  }

  return createPortal(
    <div className="UpdatePopupModal__overlay">
      <div className={`UpdatePopupModal__container ${screenMode === 'changelog' ? 'changelog-wide' : ''}`}>
        {renderContent()}
      </div>
    </div>,
    document.body
  )
}
