import { useEffect, useState } from 'react'
import type {
  SourceEngineAction,
  SourceEnginesState
} from 'common/types/sourceEngines'

export default function SourceEnginesPanel() {
  const [state, setState] = useState<SourceEnginesState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    const refresh = () =>
      void window.api
        .pluginsSourceEnginesState()
        .then((value) => {
          if (mounted) setState(value)
        })
        .catch(() => {
          if (mounted) setError('Não foi possível consultar os motores.')
        })
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])
  async function action(value: SourceEngineAction) {
    setBusy(true)
    setError('')
    try {
      const result = await window.api.pluginsSourceEngineAction(value)
      setState(result.state)
      if (!result.success)
        setError(result.error || 'Não foi possível concluir a operação.')
    } catch {
      setError('Não foi possível concluir a operação.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="ghost-engine-panel">
      <summary>Motores de navegação e leitura</summary>
      <p>
        O Scrapling auxilia a leitura dos catálogos das fontes. O Obscura é
        experimental para páginas públicas. Login e downloads assistidos
        continuam no navegador do Ghost.
      </p>
      {state && (
        <>
          <label>
            <input
              type="checkbox"
              checked={state.automatic}
              disabled={busy}
              onChange={(event) =>
                void action({
                  type: 'automatic',
                  enabled: event.target.checked
                })
              }
            />{' '}
            Atualizar automaticamente versões compatíveis
          </label>
          <button
            disabled={busy}
            onClick={() => void action({ type: 'check' })}
          >
            {busy ? 'Aguarde…' : 'Verificar atualizações'}
          </button>
          {state.checkedAt && (
            <small>
              Última consulta: {new Date(state.checkedAt).toLocaleString()}
            </small>
          )}
          {state.catalogError && <p role="status">{state.catalogError}</p>}
          {state.engines.map((engine) => (
            <section key={engine.id}>
              <h3>
                {engine.id === 'scrapling'
                  ? 'Scrapling'
                  : 'Obscura · Experimental'}
              </h3>
              <p>
                Instalada: {engine.installed || 'Não instalado'} · Compatível:{' '}
                {engine.available || 'Aguardando pacote aprovado'}
                {engine.upstream && (
                  <> · Publicada pelo projeto: {engine.upstream}</>
                )}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={engine.enabled}
                  disabled={busy || engine.busy}
                  onChange={(event) =>
                    void action({
                      type: 'enable',
                      id: engine.id,
                      enabled: event.target.checked
                    })
                  }
                />{' '}
                Ativar{' '}
                {engine.id === 'scrapling'
                  ? 'leitura adaptativa'
                  : 'navegação experimental'}
              </label>
              {(!engine.installed ||
                engine.updateAvailable ||
                engine.upstreamUpdateAvailable) && (
                <button
                  className="ghost-btn-primary"
                  disabled={
                    busy ||
                    engine.busy ||
                    !engine.available ||
                    Boolean(engine.installed && !engine.updateAvailable)
                  }
                  onClick={() =>
                    void action({ type: 'install', id: engine.id })
                  }
                >
                  {engine.installed
                    ? `Instalar atualização ${engine.updateAvailable ? engine.available : engine.upstream}`
                    : `Instalar${engine.available ? ` ${engine.available}` : ''}`}
                </button>
              )}
              {engine.installed && (
                <button
                  disabled={busy || engine.busy}
                  onClick={() => void action({ type: 'verify', id: engine.id })}
                >
                  Verificar instalação
                </button>
              )}
              {engine.upstreamUpdateAvailable && !engine.updateAvailable && (
                <p role="status">
                  A versão {engine.upstream} foi publicada, mas seu pacote
                  compatível com o Ghost ainda não está disponível. Use
                  Verificar atualizações para consultar novamente.
                </p>
              )}
              <button
                disabled={busy || engine.busy || !engine.previous}
                onClick={() => void action({ type: 'restore', id: engine.id })}
              >
                Restaurar versão anterior
              </button>
              <p role="status">
                {engine.busy ? 'Motor em uso. Aguarde…' : engine.message}
              </p>
            </section>
          ))}
        </>
      )}
      <p role="alert">{error}</p>
    </details>
  )
}
