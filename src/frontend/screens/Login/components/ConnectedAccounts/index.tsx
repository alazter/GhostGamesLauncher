import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  accountProviders,
  accountProviderNames,
  type AccountProvider,
  type ConnectedAccountStatus
} from 'common/types/connectedAccounts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXbox, faBattleNet } from '@fortawesome/free-brands-svg-icons'
import eaLogo from 'frontend/assets/ea.svg'
import ubisoftLogo from 'frontend/assets/ubisoft.svg'
import { ensureConnectedAccountCustomStore } from 'frontend/helpers/connectedAccountStores'
import '../Runner/index.css'
import './index.css'

export default function ConnectedAccounts() {
  const { t, i18n } = useTranslation()
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
          for (const acc of statuses) {
            if (acc.connected) {
              ensureConnectedAccountCustomStore(acc.provider)
            }
          }
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
    action: 'connect' | 'disconnect' | 'sync'
  ) {
    setBusy(provider)
    setError('')
    try {
      const result = await {
        connect: window.api.connectAccount,
        disconnect: window.api.disconnectAccount,
        sync: window.api.syncAccount
      }[action](provider)
      if (!result.success && !result.cancelled)
        setError(`${accountProviderNames[provider]}: ${result.error}`)
      if (result.success && (action === 'connect' || action === 'sync')) {
        ensureConnectedAccountCustomStore(provider)
      }
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

  const ubisoftAccount = accounts.find((entry) => entry.provider === 'ubisoft')
  const hasLocalUbisoftLibrary =
    ubisoftAccount?.connected && ubisoftAccount.connectionMethod === 'local'
  const ubisoftSourceDate = ubisoftAccount?.sourceUpdatedAt
    ? new Date(ubisoftAccount.sourceUpdatedAt).toLocaleString(
        i18n.language.replace(/_/g, '-'),
        {
          dateStyle: 'short',
          timeStyle: 'short'
        }
      )
    : undefined

  return (
    <section
      className="connectedAccounts"
      aria-label={t('accounts.title', 'Contas Xbox, EA, Ubisoft e Battle.net')}
    >
      {accountProviders.map((provider) => {
        const account = accounts.find((entry) => entry.provider === provider)
        const accountName =
          account?.connected &&
          account.username &&
          !/^EA · \d+$/.test(account.username)
            ? account.username
            : accountProviderNames[provider]
        return (
          <div
            className="runnerWrapper connectedAccount"
            key={provider}
            aria-label={accountProviderNames[provider]}
            aria-busy={busy === provider}
          >
            <div className="runnerIcon connectedAccountLogo" aria-hidden="true">
              {provider === 'xbox' || provider === 'battlenet' ? (
                <FontAwesomeIcon
                  icon={provider === 'xbox' ? faXbox : faBattleNet}
                />
              ) : (
                <img src={provider === 'ea' ? eaLogo : ubisoftLogo} alt="" />
              )}
            </div>
            <div className="userData connectedAccountIdentity">
              <strong>
                {provider === 'ubisoft' && hasLocalUbisoftLibrary
                  ? t(
                      'accounts.ubisoftLocalLibrary',
                      'Biblioteca local · Ubisoft Connect'
                    )
                  : accountName}
              </strong>
            </div>
            <div className="runnerButtons connectedAccountActions">
              {busy === provider ? (
                <span className="connectedAccountWorking" role="status">
                  {t('accounts.working', 'Aguarde…')}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className={`runnerLogin connectedAccountPrimary${account?.connected ? ' connectedAccountDisconnect' : provider === 'ubisoft' ? ' connectedAccountUbisoftImport' : ''}`}
                    disabled={!ready || busy !== null || saving}
                    onClick={() =>
                      void operate(
                        provider,
                        account?.connected ? 'disconnect' : 'connect'
                      )
                    }
                  >
                    {account?.connected
                      ? t('accounts.disconnect', 'Desconectar')
                      : provider === 'ubisoft'
                        ? t(
                            'accounts.ubisoftImport',
                            'Importar do Ubisoft Connect'
                          )
                        : t('accounts.connect', 'Conectar conta')}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
      <div className="connectedAccountNotice connectedAccountUbisoftNotice">
        <p>
          {t(
            'accounts.ubisoftLocalNotice',
            'O Ghost importa os jogos da biblioteca local do Ubisoft Connect. Para atualizar a lista, abra o cliente oficial e entre na sua conta; depois volte ao Ghost para importar ou atualizar a biblioteca.'
          )}
        </p>
        {hasLocalUbisoftLibrary && (
          <>
            <p>
              {t(
                'accounts.ubisoftLocalCount',
                'Jogos importados da biblioteca local: {{count}}.',
                { count: ubisoftAccount.gameCount }
              )}
              {ubisoftSourceDate && (
                <>
                  {' '}
                  {t(
                    'accounts.ubisoftCacheUpdated',
                    'Cache local atualizado em {{date}}.',
                    { date: ubisoftSourceDate }
                  )}
                </>
              )}
            </p>
            <button
              type="button"
              disabled={!ready || busy !== null || saving}
              onClick={() => void operate('ubisoft', 'sync')}
            >
              {busy === 'ubisoft'
                ? t('accounts.working', 'Aguarde…')
                : t('accounts.ubisoftSync', 'Atualizar biblioteca')}
            </button>
          </>
        )}
      </div>
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
