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
  const [syncStatusMsg, setSyncStatusMsg] = useState('')

  useEffect(() => {
    const unsub = (window.api as any).onCoversSyncFinished?.(
      (data: { recoveredCount: number; success: boolean }) => {
        setIsSyncing(false)
        if (data?.success) {
          setSyncStatusMsg(
            `✅ Varredura concluída com sucesso! ${data.recoveredCount} novas capas recuperadas. Jogos com capas válidas permaneceram 100% intactos.`
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
      '⏳ Varredura em segundo plano iniciada! O Ghost está verificando capas no seu disco e na rede. Você pode navegar, jogar e usar o sistema livremente sem precisar esperar.'
    )
    try {
      await (window.api.steamgriddb as any).syncMissingCovers()
    } catch {
      setIsSyncing(false)
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
              disabled={isSyncing}
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
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isSyncing
                  ? 'none'
                  : '0 4px 12px rgba(108, 92, 231, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!isSyncing) e.currentTarget.style.background = '#5844e3'
              }}
              onMouseOut={(e) => {
                if (!isSyncing) e.currentTarget.style.background = '#6c5ce7'
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
