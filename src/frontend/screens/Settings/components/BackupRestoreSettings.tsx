import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDownload,
  faUpload,
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
  faCloud,
  faLink,
  faUnlink,
  faCloudUploadAlt,
  faCloudDownloadAlt
} from '@fortawesome/free-solid-svg-icons'
import useSetting from 'frontend/hooks/useSetting'
import { syncLocalStorageToBackend } from 'frontend/utils/localStorageBackup'
import { configStore } from 'frontend/helpers/electronStores'

export const BackupRestoreSettings: React.FC = () => {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  
  // Cloud related states
  const [cloudProvider, setCloudProvider] = useSetting('cloudBackupProvider', 'none')
  const [cloudBackupOnExit, setCloudBackupOnExit] = useSetting('cloudBackupOnExit', false)
  const [cloudStatus, setCloudStatus] = useState<{ connected: boolean; provider?: string; accountName?: string }>({ connected: false })
  const [connecting, setConnecting] = useState(false)
  const [uploadingCloud, setUploadingCloud] = useState(false)
  const [downloadingCloud, setDownloadingCloud] = useState(false)
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [showGoogleCreds, setShowGoogleCreds] = useState(false)
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch status on mount or when provider changes
  const fetchCloudStatus = async () => {
    try {
      const status = await window.api.getCloudProviderStatus()
      setCloudStatus(status)
    } catch (err) {
      console.error('Failed to get cloud provider status:', err)
    }
  }

  useEffect(() => {
    fetchCloudStatus()
    if (window.api.getGoogleCredentials) {
      window.api.getGoogleCredentials().then(creds => {
        setGoogleClientId(creds.clientId || '')
        setGoogleClientSecret(creds.clientSecret || '')
      })
    }
  }, [cloudProvider])

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    try {
      // Sync latest localStorage values to backend settings store
      syncLocalStorageToBackend()
      
      // Wait briefly for write to register in main thread
      await new Promise(r => setTimeout(r, 100))

      const res = await window.api.exportGhostBackup()
      if (res.success) {
        setMessage({ type: 'success', text: 'Backup exportado com sucesso!' })
      } else if (res.error && res.error !== 'Exportação cancelada.') {
        setMessage({ type: 'error', text: res.error })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setMessage(null)
    try {
      const res = await window.api.importGhostBackup()
      if (res.success) {
        // Restore returned localStorageData back to frontend localStorage
        if (res.localStorageData) {
          Object.entries(res.localStorageData).forEach(([key, val]) => {
            localStorage.setItem(key, val as string)
          })
          // Trigger a change event so UI updates immediately
          window.dispatchEvent(new Event('heroicSettingsChanged'))
          window.dispatchEvent(new Event('customBgChanged'))
        }
        setMessage({ type: 'success', text: 'Backup e biblioteca restaurados com sucesso!' })
      } else if (res.error && res.error !== 'Importação cancelada.') {
        setMessage({ type: 'error', text: res.error })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setImporting(false)
    }
  }

  const handleConnect = async () => {
    if (cloudProvider === 'none') return
    setConnecting(true)
    setMessage(null)
    try {
      const res = await window.api.connectCloudProvider(cloudProvider as any)
      if (res.success) {
        await fetchCloudStatus()
        setMessage({ type: 'success', text: `Conta conectada com sucesso no ${getProviderLabel(cloudProvider)}!` })
      } else {
        setMessage({ type: 'error', text: res.error || 'Erro ao conectar conta.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setMessage(null)
    try {
      await window.api.disconnectCloudProvider()
      await fetchCloudStatus()
      setMessage({ type: 'success', text: 'Conta de nuvem desconectada com sucesso.' })
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    }
  }

  const handleUploadCloud = async () => {
    setUploadingCloud(true)
    setMessage(null)
    window.dispatchEvent(new CustomEvent('backupStateChanged', { detail: { uploading: true } }))
    try {
      syncLocalStorageToBackend()
      await new Promise(r => setTimeout(r, 100))

      const res = await window.api.uploadBackupToCloud()
      if (res.success) {
        setMessage({ type: 'success', text: 'Backup enviado para a nuvem com sucesso!' })
      } else {
        setMessage({ type: 'error', text: res.error || 'Erro ao enviar backup.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setUploadingCloud(false)
      window.dispatchEvent(new CustomEvent('backupStateChanged', { detail: { uploading: false } }))
    }
  }

  const handleDownloadCloud = async () => {
    setDownloadingCloud(true)
    setMessage(null)
    try {
      const res = await window.api.downloadBackupFromCloud()
      if (res.success && res.data) {
        // Use the importGhostBackup backend logic with the downloaded data
        const restoreRes = await window.api.importGhostBackup(JSON.stringify(res.data))
        if (restoreRes.success) {
          if (restoreRes.localStorageData) {
            Object.entries(restoreRes.localStorageData).forEach(([key, val]) => {
              localStorage.setItem(key, val as string)
            })
            window.dispatchEvent(new Event('heroicSettingsChanged'))
            window.dispatchEvent(new Event('customBgChanged'))
          }
          ;(configStore as any).set('backup.lastSuccess', Date.now())
          ;(configStore as any).delete('backup.lastError')
          window.dispatchEvent(new Event('backupStateChanged'))
          setMessage({ type: 'success', text: 'Backup baixado e restaurado com sucesso!' })
        } else {
          setMessage({ type: 'error', text: restoreRes.error || 'Erro ao restaurar backup baixado.' })
        }
      } else {
        setMessage({ type: 'error', text: res.error || 'Erro ao baixar backup.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    } finally {
      setDownloadingCloud(false)
    }
  }

  const handleSaveGoogleCreds = async () => {
    try {
      if (window.api.setGoogleCredentials) {
        await window.api.setGoogleCredentials(googleClientId, googleClientSecret)
        setMessage({ type: 'success', text: 'Credenciais do Google Drive atualizadas com sucesso!' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: String(err) })
    }
  }

  const getProviderLabel = (prov: string) => {
    switch (prov) {
      case 'google': return 'Google Drive'
      case 'onedrive': return 'OneDrive'
      case 'dropbox': return 'Dropbox'
      default: return 'Nenhum'
    }
  }

  return (
    <div className="settingRow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '20px', marginTop: '24px', width: '100%' }}>
      {/* SECTION 1: LOCAL BACKUP */}
      <div style={{ width: '100%' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FontAwesomeIcon icon={faDownload} style={{ color: '#00e5ff' }} />
          Backup Local (Arquivo)
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
          Exporte ou restaure suas horas jogadas, personalizações, logos de lojas e caminhos locais usando um arquivo <code>.ghostbackup</code>.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || importing || connecting || uploadingCloud || downloadingCloud}
            className="button is-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px', borderRadius: '6px' }}
          >
            {exporting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faDownload} />}
            Exportar Backup Local
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={exporting || importing || connecting || uploadingCloud || downloadingCloud}
            className="button is-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px', borderRadius: '6px' }}
          >
            {importing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
            Importar Backup Local
          </button>
        </div>
      </div>

      <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* SECTION 2: CLOUD BACKUP */}
      <div style={{ width: '100%' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FontAwesomeIcon icon={faCloud} style={{ color: '#00e5ff' }} />
          Sincronização na Nuvem (Google Drive, OneDrive, Dropbox)
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
          Sincronize todo o seu progresso, customizações e horas jogadas automaticamente ou manualmente em contas de armazenamento em nuvem.
        </p>

        {/* Dropdown Provider Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px', marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 'bold' }}>Provedor de Backup:</label>
          <select
            value={cloudProvider || 'none'}
            onChange={(e) => setCloudProvider(e.target.value as any)}
            disabled={exporting || importing || connecting || uploadingCloud || downloadingCloud}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#1e1e24',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="none">Nenhum (Desativado)</option>
            <option value="google">Google Drive</option>
            <option value="onedrive">OneDrive (Microsoft)</option>
            <option value="dropbox">Dropbox</option>
          </select>
        </div>

        {cloudProvider !== 'none' && (
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Connection Status & Account Info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: cloudStatus.connected && cloudStatus.provider === cloudProvider ? '#00e5ff' : '#ff4444'
                }} />
                <span style={{ fontSize: '13px', color: '#fff' }}>
                  {cloudStatus.connected && cloudStatus.provider === cloudProvider
                    ? `Conectado como: ${cloudStatus.accountName}`
                    : 'Nenhuma conta conectada para este provedor'}
                </span>
              </div>

              {cloudStatus.connected && cloudStatus.provider === cloudProvider ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={connecting || uploadingCloud || downloadingCloud}
                  className="button is-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(255, 68, 68, 0.1)', borderColor: 'rgba(255, 68, 68, 0.3)', color: '#ff4444' }}
                >
                  <FontAwesomeIcon icon={faUnlink} />
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="button is-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}
                >
                  {connecting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                  Conectar Conta
                </button>
              )}
            </div>

            {cloudProvider === 'google' && (
              <div style={{ marginTop: '4px', padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowGoogleCreds(!showGoogleCreds)}>
                  <span style={{ fontSize: '12px', color: '#00e5ff', fontWeight: 'bold' }}>
                    {showGoogleCreds ? '▲ Ocultar Credenciais de API do Google' : '▼ Credenciais de API do Google OAuth'}
                  </span>
                </div>
                {showGoogleCreds && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>Client ID do Google:</label>
                      <input
                        type="text"
                        value={googleClientId}
                        onChange={(e) => setGoogleClientId(e.target.value)}
                        placeholder="ID do Cliente Google (.apps.googleusercontent.com)"
                        style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '4px', backgroundColor: '#141418', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>Chave Secreta do Cliente (Client Secret):</label>
                      <input
                        type="password"
                        value={googleClientSecret}
                        onChange={(e) => setGoogleClientSecret(e.target.value)}
                        placeholder="Chave secreta GOCSPX-..."
                        style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '4px', backgroundColor: '#141418', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveGoogleCreds}
                      className="button is-secondary"
                      style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      Salvar Credenciais
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cloud Sync Operations */}
            {cloudStatus.connected && cloudStatus.provider === cloudProvider && (
              <>
                <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />
                
                {/* Auto Backup Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>Fazer Backup Automático ao Sair</span>
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>Envia suas atualizações de progresso para a nuvem sempre que fechar o Ghost.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!cloudBackupOnExit}
                    onChange={(e) => setCloudBackupOnExit(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleUploadCloud}
                    disabled={uploadingCloud || downloadingCloud}
                    className="button is-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px', borderRadius: '6px' }}
                  >
                    {uploadingCloud ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudUploadAlt} />}
                    Enviar para a Nuvem Agora
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCloud}
                    disabled={uploadingCloud || downloadingCloud}
                    className="button is-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px', borderRadius: '6px' }}
                  >
                    {downloadingCloud ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudDownloadAlt} />}
                    Baixar e Restaurar da Nuvem
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages / Alerts */}
      {message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: message.type === 'success' ? '#00e5ff' : '#ff4444',
            marginTop: '8px',
            backgroundColor: message.type === 'success' ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255, 68, 68, 0.05)',
            padding: '8px 16px',
            borderRadius: '6px',
            border: `1px solid ${message.type === 'success' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 68, 68, 0.15)'}`,
            width: '100%'
          }}
        >
          <FontAwesomeIcon icon={message.type === 'success' ? faCheckCircle : faExclamationTriangle} />
          {message.text}
        </div>
      )}
    </div>
  )
}

export default BackupRestoreSettings
