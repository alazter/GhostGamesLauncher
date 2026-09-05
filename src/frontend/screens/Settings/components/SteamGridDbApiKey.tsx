import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoBox, TextInputField } from 'frontend/components/UI'

export default function SteamGridDbApiKey() {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const url = 'www.steamgriddb.com/profile/preferences/api'
  const DUMMY_MASK = '••••••••••••••••'

  useEffect(() => {
    void window.api.steamgriddb.hasApiKey().then((exists) => {
      setHasKey(exists)
      if (exists) {
        setValue(DUMMY_MASK)
      }
    })
  }, [])

  const onChange = (newValue: string) => {
    setValue(newValue)
    if (newValue === '') {
      void window.api.steamgriddb.setApiKey('').then(() => {
        setHasKey(false)
      })
    } else if (newValue !== DUMMY_MASK) {
      void window.api.steamgriddb.setApiKey(newValue).then(() => {
        setHasKey(true)
      })
    }
  }

  const onFocus = () => {
    if (value === DUMMY_MASK) {
      setValue('')
    }
  }

  const onBlur = () => {
    if (value === '' && hasKey) {
      setValue(DUMMY_MASK)
    }
  }

  const [isSyncing, setIsSyncing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState('')
  const [backupInfo, setBackupInfo] = useState<{
    hasBackup: boolean
    date?: string
    totalOverrides?: number
    totalVerticalOverrides?: number
    totalHorizontalOverrides?: number
    timestamp?: number
  } | null>(null)

  const loadBackupInfo = async () => {
    try {
      const info = await (window.api.steamgriddb as any).getCoversBackupInfo()
      setBackupInfo(info)
    } catch {}
  }

  useEffect(() => {
    loadBackupInfo()
    const unsub = (window.api as any).onCoversSyncFinished?.(
      (data: { recoveredCount: number; success: boolean; isRestore?: boolean; date?: string }) => {
        setIsSyncing(false)
        setIsRestoring(false)
        loadBackupInfo()
        if (data?.isRestore) {
          setSyncStatusMsg(
            `✅ Capas restauradas com sucesso para o ponto de restauração anterior (${data.date || 'estado prévio'})!`
          )
        } else if (data?.success) {
          setSyncStatusMsg(
            `✅ Varredura concluída! ${data.recoveredCount} novas capas recuperadas. Um ponto de restauração foi salvo automaticamente. Se não gostar, você pode reverter a qualquer momento abaixo.`
          )
        } else {
          setSyncStatusMsg('A varredura de capas em segundo plano foi finalizada.')
        }
      }
    )
    return () => {
      unsub?.()
    }
  }, [])

  const handleSyncMissingCovers = async () => {
    setIsSyncing(true)
    setSyncStatusMsg(
      '⏳ Criando ponto de restauração de segurança e iniciando varredura em segundo plano... Você pode navegar e jogar livremente.'
    )
    try {
      await (window.api.steamgriddb as any).syncMissingCovers()
    } catch {
      setIsSyncing(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (!backupInfo?.hasBackup) return
    const confirmed = window.confirm(
      `Deseja reverter suas capas exatamente para o ponto de restauração de ${backupInfo.date || 'data anterior'}?`
    )
    if (!confirmed) return

    setIsRestoring(true)
    setSyncStatusMsg('⏳ Restaurando capas anteriores do backup...')
    try {
      const res = await (window.api.steamgriddb as any).restoreCoversBackup()
      if (res?.success) {
        setSyncStatusMsg(
          `✅ Sucesso! Todas as capas foram restauradas para o estado de ${res.date}.`
        )
      } else {
        setSyncStatusMsg(`❌ Falha ao restaurar backup: ${res?.message || 'Erro desconhecido'}`)
      }
    } catch (err) {
      setSyncStatusMsg(`❌ Erro ao restaurar: ${String(err)}`)
    } finally {
      setIsRestoring(false)
      loadBackupInfo()
    }
  }

  const placeholder = hasKey
    ? t(
        'settings.steamgriddb.apikey.placeholder_saved',
        'Key saved — type to replace, clear to remove'
      )
    : t(
        'settings.steamgriddb.apikey.placeholder',
        'Enter your SteamGridDB API Key here'
      )

  return (
    <TextInputField
      label={t('settings.steamgriddb.apikey.title', 'SteamGridDB API Key')}
      placeholder={placeholder}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      value={value}
      htmlId="steamgriddb-api-key"
      type="password"
      afterInput={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '10px'
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              className="button primary"
              disabled={isSyncing || isRestoring}
              style={{
                alignSelf: 'flex-start',
                background: isSyncing
                  ? 'rgba(108, 92, 231, 0.4)'
                  : '#6c5ce7',
                color: '#fff',
                border: '1px solid #a29bfe',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                cursor: isSyncing || isRestoring ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isSyncing
                  ? 'none'
                  : '0 4px 12px rgba(108, 92, 231, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!isSyncing && !isRestoring) e.currentTarget.style.background = '#5844e3'
              }}
              onMouseOut={(e) => {
                if (!isSyncing && !isRestoring) e.currentTarget.style.background = '#6c5ce7'
              }}
              onClick={handleSyncMissingCovers}
            >
              <span>{isSyncing ? '⏳' : '🔄'}</span>
              <span>
                {isSyncing
                  ? 'Varredura em segundo plano em andamento...'
                  : 'Sincronizar e Restaurar Capas Ausentes'}
              </span>
            </button>

            {hasKey && (
              <button
                type="button"
                className="button outline"
                style={{
                  alignSelf: 'flex-start',
                  borderColor: '#ff4444',
                  color: '#ff4444',
                  padding: '6px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 68, 68, 0.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
                onClick={() => {
                  setValue('')
                  void window.api.steamgriddb.setApiKey('').then(() => {
                    setHasKey(false)
                  })
                }}
              >
                {t('settings.steamgriddb.apikey.remove', 'Remover Chave')}
              </button>
            )}
          </div>

          {/* Card de Ponto de Restauração (Backup de Capas) */}
          {backupInfo?.hasBackup && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(30, 34, 42, 0.7)',
                border: '1px solid rgba(46, 204, 113, 0.3)',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px' }}>🟢</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#2ecc71',
                      letterSpacing: '0.3px'
                    }}
                  >
                    Ponto de Restauração de Capas Disponível
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#a0aec0' }}>
                  📅 Salvo em: <strong style={{ color: '#fff' }}>{backupInfo.date}</strong>{' '}
                  • {backupInfo.totalVerticalOverrides ?? backupInfo.totalOverrides} capas verticais, {backupInfo.totalHorizontalOverrides ?? 0} capas horizontais (heroes)
                </span>
              </div>

              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={isRestoring || isSyncing}
                style={{
                  background: isRestoring ? 'rgba(230, 126, 34, 0.4)' : '#e67e22',
                  color: '#fff',
                  border: '1px solid #f39c12',
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  cursor: isRestoring || isSyncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(230, 126, 34, 0.3)'
                }}
                onMouseOver={(e) => {
                  if (!isRestoring && !isSyncing) e.currentTarget.style.background = '#d35400'
                }}
                onMouseOut={(e) => {
                  if (!isRestoring && !isSyncing) e.currentTarget.style.background = '#e67e22'
                }}
              >
                <span>{isRestoring ? '⏳' : '⏪'}</span>
                <span>
                  {isRestoring
                    ? 'Restaurando...'
                    : 'Reverter para Capas Anteriores'}
                </span>
              </button>
            </div>
          )}

          {syncStatusMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(108, 92, 231, 0.12)',
                border: '1px solid rgba(162, 155, 254, 0.3)',
                color: '#e2e8f0',
                fontSize: '13px',
                lineHeight: '1.5',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{syncStatusMsg}</span>
            </div>
          )}

          <InfoBox text={t('settings.advanced.details', 'Details')}>
            <span style={{ userSelect: 'text' }}>
              {t(
                'settings.steamgriddb.help.description',
                'Provide your own SteamGridDB API key to enable game cover search. The key is stored encrypted when your system supports it. You can get one at {{url}}',
                { url }
              )}
            </span>
          </InfoBox>
        </div>
      }
    />
  )
}
