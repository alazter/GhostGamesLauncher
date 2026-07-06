import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload, faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'

export const BackupRestoreSettings: React.FC = () => {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    try {
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

  return (
    <div className="settingRow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px', marginTop: '24px' }}>
      <div>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#fff' }}>
          Backup e Restauração de Dados
        </h4>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
          Exporte ou restaure todos os seus jogos adicionados, caminhos, capas personalizadas, lojas e preferências em um único arquivo.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', marginTop: '4px' }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || importing}
          className="button is-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px' }}
        >
          {exporting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faDownload} />}
          Exportar Backup
        </button>

        <button
          type="button"
          onClick={handleImport}
          disabled={exporting || importing}
          className="button is-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px' }}
        >
          {importing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
          Importar Backup
        </button>
      </div>

      {message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: message.type === 'success' ? '#00e5ff' : '#ff4444',
            marginTop: '4px'
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
