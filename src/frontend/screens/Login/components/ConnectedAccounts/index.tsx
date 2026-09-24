import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  accountProviders,
  accountProviderNames,
  type AccountProvider,
  type ConnectedAccountStatus
} from 'common/types/connectedAccounts'
import './index.css'

export default function ConnectedAccounts() {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<ConnectedAccountStatus[]>([])
  const [busy, setBusy] = useState<AccountProvider | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [clientId, setClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([
      window.api.getConnectedAccounts(),
      window.api.getXboxClientId()
    ])
      .then(([statuses, id]) => {
        if (active) {
          setAccounts(statuses)
          setClientId(id)
          setReady(true)
        }
      })
      .catch(() => {
        if (active)
          setError(
            t(
              'accounts.loadError',
              'Não foi possível carregar as contas. Reabra esta tela para tentar novamente.'
            )
          )
      })
    return () => {
      active = false
    }
  }, [t])

  async function operate(
    provider: AccountProvider,
    action: 'connect' | 'sync' | 'disconnect'
  ) {
    setBusy(provider)
    setError('')
    try {
      const result = await {
        connect: window.api.connectAccount,
        sync: window.api.syncAccount,
        disconnect: window.api.disconnectAccount
      }[action](provider)
      if (!result.success && !result.cancelled)
        setError(`${accountProviderNames[provider]}: ${result.error}`)
      setAccounts(await window.api.getConnectedAccounts())
    } catch {
      setError(
        t(
          'accounts.operationError',
          'Não foi possível concluir a operação. Tente novamente.'
        )
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      className="connectedAccounts"
      aria-label={t('accounts.title', 'Contas Xbox, EA, Ubisoft e Battle.net')}
    >
      {accountProviders.map((provider) => {
        const account = accounts.find((entry) => entry.provider === provider)
        return (
          <div className="connectedAccount" key={provider}>
            <div className="connectedAccountIdentity">
              <strong>{accountProviderNames[provider]}</strong>
              {account?.connected && (
                <small>
                  {account.username} ·{' '}
                  {t('accounts.gameCount', '{{count}} jogos importados', {
                    count: account.gameCount
                  })}
                </small>
              )}
              {account?.lastSync && (
                <small>
                  {t('accounts.lastSync', 'Sincronizado em {{date}}', {
                    date: new Date(account.lastSync).toLocaleString()
                  })}
                </small>
              )}
              {account?.error && <small role="status">{account.error}</small>}
            </div>
            <div className="connectedAccountActions">
              {busy === provider ? (
                <span role="status">{t('accounts.working', 'Aguarde…')}</span>
              ) : (
                <>
                  <button
                    disabled={!ready || busy !== null || saving}
                    onClick={() =>
                      void operate(
                        provider,
                        account?.connected ? 'sync' : 'connect'
                      )
                    }
                  >
                    {account?.connected
                      ? t('accounts.sync', 'Sincronizar')
                      : t('accounts.connect', 'Conectar conta')}
                  </button>
                  {account?.connected && (
                    <>
                      <button
                        disabled={busy !== null || saving}
                        onClick={() => void operate(provider, 'connect')}
                      >
                        {t('accounts.reconnect', 'Reconectar')}
                      </button>
                      <button
                        disabled={busy !== null || saving}
                        onClick={() => void operate(provider, 'disconnect')}
                      >
                        {t('accounts.disconnect', 'Desconectar')}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      <p className="connectedAccountNotice">
        {t(
          'accounts.xboxNotice',
          'Xbox importa o histórico de jogos, inclusive desinstalados. Compras nunca iniciadas podem não aparecer; o histórico não garante acesso atual ou compatibilidade com PC.'
        )}
      </p>
      <p className="connectedAccountNotice">
        {t(
          'accounts.launchNotice',
          'Os jogos importados abrem a página oficial da plataforma. A instalação e a execução continuam nos clientes oficiais.'
        )}
      </p>
      <details>
        <summary>
          {t('accounts.xboxSetup', 'Configurar login Microsoft do Ghost')}
        </summary>
        <p className="connectedAccountNotice">
          {t(
            'accounts.xboxSetupHelp',
            'O Xbox requer um aplicativo Microsoft registrado para o Ghost, com contas pessoais e redirecionamento para https://login.live.com/oauth20_desktop.srf. Informe somente o ID público do aplicativo, nunca uma senha ou segredo.'
          )}
        </p>
        <label htmlFor="ghost-xbox-client-id">
          {t('accounts.clientId', 'ID do aplicativo Microsoft')}
        </label>
        <input
          id="ghost-xbox-client-id"
          value={clientId}
          autoComplete="off"
          spellCheck={false}
          disabled={
            busy !== null ||
            saving ||
            accounts.some(
              (account) => account.provider === 'xbox' && account.connected
            )
          }
          onChange={(event) => {
            setClientId(event.target.value)
            setSaved(false)
          }}
        />
        <button
          disabled={
            !ready ||
            busy !== null ||
            saving ||
            !clientId.trim() ||
            accounts.some(
              (account) => account.provider === 'xbox' && account.connected
            )
          }
          onClick={async () => {
            setSaving(true)
            setError('')
            setSaved(false)
            try {
              await window.api.setXboxClientId(clientId)
              setSaved(true)
            } catch {
              setError(
                t(
                  'accounts.clientIdError',
                  'Não foi possível salvar. Informe um ID Microsoft válido e desconecte o Xbox antes de alterá-lo.'
                )
              )
            } finally {
              setSaving(false)
            }
          }}
        >
          {t('button.save', 'Salvar')}
        </button>
        {saved && (
          <span role="status">
            {t('accounts.saved', 'Configuração salva.')}
          </span>
        )}
      </details>
      {error && (
        <p role="alert" className="connectedAccountError">
          {error}
        </p>
      )}
    </section>
  )
}
