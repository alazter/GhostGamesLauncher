import { useEffect, useState } from 'react'
import type {
  DownloadIntegrationAction,
  DownloadIntegrationsState
} from 'common/types/plugins'

export default function DownloadIntegrations() {
  const [state, setState] = useState<DownloadIntegrationsState>()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    window.api
      .downloadIntegrationsState()
      .then(setState)
      .catch(() => setMessage('Não foi possível consultar as integrações.'))
  }, [])
  async function act(action: DownloadIntegrationAction) {
    setBusy(true)
    setMessage(
      action.type === 'connect-anker'
        ? 'Entre na conta pela janela oficial do AnkerGames.'
        : ''
    )
    try {
      const result = await window.api.downloadIntegrationsAction(action)
      if (result.success) {
        setKey('')
        setMessage('Integração atualizada.')
      } else setMessage(result.error || 'Operação cancelada.')
      setState(await window.api.downloadIntegrationsState())
    } catch {
      setMessage('Não foi possível concluir a conexão.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      id="download-integrations"
      aria-label="Integrações de downloads"
      style={{
        padding: '24px',
        marginBottom: '40px',
        background: '#131a20',
        border: '1px solid #00cccc',
        borderRadius: '12px'
      }}
    >
      <h2>Integrações de downloads</h2>
      <h3>AnkerGames</h3>
      <p>
        {state?.ankerConnected
          ? 'Conta conectada nesta sessão.'
          : 'Conecte ou verifique sua conta para obter o torrent oficial.'}
      </p>
      <p>
        Entre pela página oficial. O Ghost mantém uma sessão separada das lojas.
      </p>
      <button
        disabled={busy}
        onClick={() => void act({ type: 'connect-anker' })}
      >
        Conectar AnkerGames
      </button>{' '}
      <button
        disabled={busy}
        onClick={() => void act({ type: 'disconnect-anker' })}
      >
        Desconectar AnkerGames
      </button>
      <h3>TorBox</h3>
      <p>
        {state?.torboxConfigured
          ? 'Chave salva com proteção do sistema.'
          : 'Informe a chave da API da sua conta TorBox.'}
      </p>
      <label htmlFor="torbox-api-key">Chave da API</label>
      <input
        id="torbox-api-key"
        type="password"
        autoComplete="off"
        value={key}
        disabled={busy}
        onChange={(event) => setKey(event.target.value)}
        style={{ display: 'block', width: '100%', margin: '10px 0' }}
      />
      <button
        disabled={busy || !key.trim()}
        onClick={() => void act({ type: 'save-torbox', apiKey: key })}
      >
        Salvar e testar
      </button>{' '}
      <button
        disabled={busy || !state?.torboxConfigured}
        onClick={() => void act({ type: 'test-torbox' })}
      >
        Testar conexão
      </button>{' '}
      <button
        disabled={busy || !state?.torboxConfigured}
        onClick={() => void act({ type: 'disconnect-torbox' })}
      >
        Desconectar TorBox
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
