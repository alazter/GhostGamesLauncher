import React, { useState, useEffect, useContext } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faImages,
  faKey,
  faCheck,
  faSpinner,
  faExternalLinkAlt,
  faRocket
} from '@fortawesome/free-solid-svg-icons'
import ContextProvider from 'frontend/state/ContextProvider'
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogFooter
} from '../Dialog'
import CachedImage from '../CachedImage'
import './index.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  activeStoreFilter?: string | null
}

export default function SteamGridBatchModal({
  isOpen,
  onClose,
  activeStoreFilter
}: Props) {
  const { refreshLibrary } = useContext(ContextProvider)
  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [apiKeyInput, setApiKeyInput] = useState<string>('')
  const [checkingKey, setCheckingKey] = useState<boolean>(true)
  const [savingKey, setSavingKey] = useState<boolean>(false)
  const [scope, setScope] = useState<'steam_only' | 'all' | 'missing_only'>('steam_only')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    title: string
    success: boolean
    coverUrl?: string
    updated: number
  } | null>(null)
  const [finishedResult, setFinishedResult] = useState<{
    total: number
    updated: number
    failed: number
  } | null>(null)

  useEffect(() => {
    if (!isOpen) return

    setCheckingKey(true)
    window.api.steamgriddb
      .hasApiKey()
      .then((has) => {
        setHasApiKey(has)
      })
      .finally(() => {
        setCheckingKey(false)
      })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const unsub = window.api.onSteamGridBatchProgress(
      (
        _e: any,
        data: {
          current: number
          total: number
          title: string
          success: boolean
          coverUrl?: string
          updated: number
        }
      ) => {
        setProgress(data)
      }
    )

    return () => {
      unsub()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return
    setSavingKey(true)
    try {
      await window.api.steamgriddb.setApiKey(apiKeyInput.trim())
      setHasApiKey(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingKey(false)
    }
  }

  const handleStartBatch = async () => {
    setIsProcessing(true)
    setProgress(null)
    setFinishedResult(null)

    try {
      const runner = scope === 'steam_only' ? 'steam' : undefined
      const res = await window.api.steamgriddb.batchReplaceAllCovers({
        runner,
        scope
      })
      setFinishedResult(res)
    } catch (err: any) {
      if (err.message === 'API_KEY_REQUIRED') {
        setHasApiKey(false)
      } else {
        alert(`Erro durante a sincronização: ${err.message}`)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinish = () => {
    refreshLibrary({ checkForUpdates: false })
    window.dispatchEvent(new Event('heroicDuplicatesChanged'))
    onClose()
  }

  return (
    <Dialog
      onClose={isProcessing ? () => {} : onClose}
      showCloseButton={!isProcessing}
      className="steamgrid-batch-modal"
    >
      <DialogHeader onClose={isProcessing ? undefined : onClose}>
        <div className="steamgrid-batch-header-title">
          <FontAwesomeIcon icon={faImages} className="steamgrid-batch-icon" />
          <span>Sincronizar Capas no SteamGridDB</span>
        </div>
      </DialogHeader>

      <DialogContent>
        {checkingKey ? (
          <div className="steamgrid-batch-loading">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p>Verificando credenciais...</p>
          </div>
        ) : !hasApiKey ? (
          <div className="steamgrid-batch-api-setup">
            <div className="steamgrid-batch-banner">
              <FontAwesomeIcon icon={faKey} size="2x" />
              <div>
                <h4>Chave de API do SteamGridDB Necessária</h4>
                <p>
                  Para baixar capas personalizadas da comunidade em alta definição,
                  é necessário informar sua chave gratuita do SteamGridDB.
                </p>
              </div>
            </div>

            <div className="steamgrid-batch-steps">
              <p>
                <strong>1.</strong> Acesse sua conta no site oficial:{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    window.api.openExternalUrl(
                      'https://www.steamgriddb.com/profile/preferences/api'
                    )
                  }}
                  className="steamgrid-batch-link"
                >
                  steamgriddb.com/profile/preferences/api <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              </p>
              <p>
                <strong>2.</strong> Clique em <em>"Create API Key"</em> e cole sua chave abaixo:
              </p>
            </div>

            <div className="steamgrid-batch-input-row">
              <input
                type="password"
                placeholder="Cole sua API Key do SteamGridDB aqui..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="steamgrid-batch-input"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim() || savingKey}
                className="button is-primary"
              >
                {savingKey ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheck} /> Salvar Chave
                  </>
                )}
              </button>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="steamgrid-batch-processing">
            <div className="steamgrid-batch-spinner-container">
              <FontAwesomeIcon icon={faSpinner} spin size="3x" className="steamgrid-batch-spin" />
            </div>

            <h3>Buscando e Atualizando Capas em Alta Resolução...</h3>

            {progress && (
              <>
                <div className="steamgrid-batch-progress-bar-container">
                  <div
                    className="steamgrid-batch-progress-bar-fill"
                    style={{
                      width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%`
                    }}
                  />
                </div>
                <div className="steamgrid-batch-progress-stats">
                  <span>{progress.title || 'Processando...'}</span>
                  <span>
                    {progress.current} / {progress.total} (
                    {Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%)
                  </span>
                </div>
                {progress.coverUrl && (
                  <div className="steamgrid-batch-preview-box">
                    <CachedImage
                      src={progress.coverUrl}
                      className="steamgrid-batch-preview-img"
                      alt="Capa aplicada"
                    />
                  </div>
                )}
              </>
            )}
            <p className="steamgrid-batch-hint">
              As capas são baixadas e aplicadas instantaneamente na sua biblioteca.
            </p>
          </div>
        ) : finishedResult ? (
          <div className="steamgrid-batch-finished">
            <div className="steamgrid-batch-success-icon">
              <FontAwesomeIcon icon={faCheck} size="3x" />
            </div>
            <h3>Sincronização Concluída com Sucesso!</h3>
            <div className="steamgrid-batch-result-boxes">
              <div className="steamgrid-batch-result-box highlight">
                <strong>{finishedResult.updated}</strong>
                <span>Capas Atualizadas</span>
              </div>
              <div className="steamgrid-batch-result-box">
                <strong>{finishedResult.total}</strong>
                <span>Jogos Verificados</span>
              </div>
            </div>
            <p>
              As novas artes do SteamGridDB já foram aplicadas e salvas no seu Ghost!
            </p>
          </div>
        ) : (
          <div className="steamgrid-batch-options">
            <p className="steamgrid-batch-desc">
              Substitua as capas padrão da Valve por artes de alta resolução (600x900)
              criadas e avaliadas pela comunidade do SteamGridDB.
            </p>

            <div className="steamgrid-batch-radio-group">
              <label
                className={`steamgrid-batch-radio-card ${scope === 'steam_only' ? 'selected' : ''}`}
                onClick={() => setScope('steam_only')}
              >
                <input
                  type="radio"
                  name="batch-scope"
                  checked={scope === 'steam_only'}
                  onChange={() => setScope('steam_only')}
                />
                <div>
                  <strong>Jogos da Conta Steam (Recomendado)</strong>
                  <span>
                    Busca e substitui as capas oficiais de todos os seus jogos Steam pelas melhores do SteamGridDB.
                  </span>
                </div>
              </label>

              <label
                className={`steamgrid-batch-radio-card ${scope === 'all' ? 'selected' : ''}`}
                onClick={() => setScope('all')}
              >
                <input
                  type="radio"
                  name="batch-scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                />
                <div>
                  <strong>Toda a Biblioteca de Jogos</strong>
                  <span>
                    Atualiza capas de todas as lojas conectadas (Steam, Epic, GOG, Amazon, Jogos Locais/Piratas).
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        {finishedResult ? (
          <button onClick={handleFinish} className="button is-primary">
            Concluir e Atualizar Biblioteca
          </button>
        ) : hasApiKey && !isProcessing ? (
          <>
            <button onClick={onClose} className="button outline">
              Cancelar
            </button>
            <button onClick={handleStartBatch} className="button is-primary">
              <FontAwesomeIcon icon={faRocket} style={{ marginRight: '6px' }} />
              Iniciar Sincronização em Lote
            </button>
          </>
        ) : (
          <button onClick={onClose} disabled={isProcessing} className="button outline">
            Fechar
          </button>
        )}
      </DialogFooter>
    </Dialog>
  )
}
