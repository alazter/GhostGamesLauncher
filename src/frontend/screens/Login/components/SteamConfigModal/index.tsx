import React, { useState, useEffect } from 'react'
import './index.css'
import SteamLogo from 'frontend/assets/steam-logo.svg?react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faKey,
  faGlobe,
  faHardDrive,
  faSync,
  faTimes,
  faCheckCircle,
  faExternalLinkAlt,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSync: () => Promise<void>
  username?: string
  isLoggedIn: boolean
}

export default function SteamConfigModal({
  isOpen,
  onClose,
  onSync,
  username,
  isLoggedIn
}: Props) {
  const [importUninstalled, setImportUninstalled] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [hasSession, setHasSession] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      window.api.steamGetConfig().then((cfg) => {
        setImportUninstalled(cfg.syncMode !== 'installedOnly')
        setApiKey(cfg.apiKey || '')
        setHasSession(Boolean(cfg.hasSession))
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSaveConfig = async () => {
    setSaving(true)
    const syncMode = importUninstalled ? (apiKey ? 'apiKey' : (hasSession ? 'webView' : 'all')) : 'installedOnly'
    await window.api.steamSaveConfig({
      syncMode,
      apiKey
    })
    setSaving(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  const handleConnectWebView = async () => {
    const success = await window.api.steamLoginWebView()
    if (success) {
      setHasSession(true)
      await handleSyncNow()
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    await handleSaveConfig()
    await onSync()
    setSyncing(false)
    onClose()
  }

  return (
    <div className="steamConfigModal__backdrop" onClick={onClose}>
      <div
        className="steamConfigModal__dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="steamConfigModal__header">
          <div className="steamConfigModal__headerTitle">
            <SteamLogo className="steamConfigModal__logo" />
            <div>
              <h3>Integração Steam</h3>
              <p>Configure a sincronização automática e permanente da sua biblioteca Steam</p>
            </div>
          </div>
          <button className="steamConfigModal__closeBtn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="steamConfigModal__body">
          {/* Status Geral */}
          <div className="steamConfigModal__statusCard">
            <div className="steamConfigModal__statusInfo">
              <span className="statusLabel">Conta Local Detectada:</span>
              <span className="statusValue">
                <FontAwesomeIcon icon={faCheckCircle} className="iconActive" />{' '}
                <strong>{username || 'Conta Local Steam (Alazter)'}</strong>
              </span>
            </div>
          </div>

          {/* Via A: Autenticação Segura WebView */}
          <div className="steamConfigCard">
            <div className="cardHeader">
              <div className="cardTitle">
                <FontAwesomeIcon icon={faGlobe} className="cardIcon" />
                <div>
                  <strong>Via A: Login pela Janela Segura da Steam (Sessão Web)</strong>
                  <span>Conecta com Steam Guard para autorizar a leitura oficial da sua conta</span>
                </div>
              </div>
              <button
                type="button"
                className={`btnConnect ${hasSession ? 'connected' : ''}`}
                onClick={handleConnectWebView}
              >
                {hasSession ? '✓ Sessão Conectada (Reconectar)' : 'Conectar Conta Steam'}
              </button>
            </div>
          </div>

          {/* Via B: Chave Steam Web API Permanente */}
          <div className="steamConfigCard">
            <div className="cardHeader">
              <div className="cardTitle">
                <FontAwesomeIcon icon={faKey} className="cardIcon" />
                <div>
                  <strong>Via B: Chave Steam Web API (Sincronização Permanente)</strong>
                  <span>Garante sincronização perpétua e instantânea sem nunca expirar</span>
                </div>
              </div>
              <a
                href="https://steamcommunity.com/dev/apikey"
                target="_blank"
                rel="noreferrer"
                className="linkApiKey"
                onClick={(e) => {
                  e.stopPropagation()
                  window.api.openExternalUrl('https://steamcommunity.com/dev/apikey')
                }}
              >
                Obter Chave na Valve <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            </div>
            <div className="apiKeyInputGroup">
              <input
                type="password"
                placeholder="Cole sua Chave Steam Web API aqui (opcional - permanente)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="apiKeyInput"
              />
            </div>
          </div>

          {/* Via C: Modo de Importação / Apenas Instalados */}
          <div className="steamConfigCard">
            <div className="cardHeader">
              <div className="cardTitle">
                <FontAwesomeIcon icon={faHardDrive} className="cardIcon" />
                <div>
                  <strong>Escopo da Biblioteca (Instalados vs Catálogo Completo)</strong>
                  <span>Importar o catálogo completo da conta (549 jogos) ou apenas instalados no PC</span>
                </div>
              </div>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={importUninstalled}
                  onChange={(e) => setImportUninstalled(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="toggleSubtext">
              {importUninstalled
                ? '✓ Catálogo Completo Ativado (Mostra jogos instalados + jogos não instalados da sua conta)'
                : '💾 Modo Offline Ativado (Mostra apenas jogos que estão baixados e instalados no PC)'}
            </div>
          </div>
        </div>

        <div className="steamConfigModal__footer">
          {savedSuccess && <span className="savedSuccess">✓ Configurações Salvas com Sucesso!</span>}
          <div className="footerButtons">
            <button className="btnSecondary" onClick={onClose}>
              Fechar
            </button>
            <button
              className="btnPrimary"
              onClick={handleSyncNow}
              disabled={syncing || saving}
            >
              <FontAwesomeIcon icon={faSync} spin={syncing} />{' '}
              {syncing ? 'Sincronizando...' : 'Salvar e Sincronizar Biblioteca'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
