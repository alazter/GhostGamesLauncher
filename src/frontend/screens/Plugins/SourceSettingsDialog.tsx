import React, { useEffect, useRef, useState } from 'react'
import type { SourceSettings } from 'common/types/plugins'

export default function SourceSettingsDialog({
  id,
  name,
  close
}: {
  id: string
  name: string
  close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [config, setConfig] = useState<SourceSettings>()
  const [address, setAddress] = useState('')
  const [message, setMessage] = useState('')
  const [tests, setTests] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
    void window.api
      .pluginsSourceSettings(id)
      .then(setConfig)
      .catch(() => setMessage('Não foi possível carregar os endereços.'))
  }, [id])
  async function test(url: string) {
    setBusy(true)
    try {
      const result = await window.api.pluginsTestSourceAddress(id, url)
      setTests((previous) => ({ ...previous, [url]: result.message }))
    } catch {
      setMessage('Não foi possível testar o endereço.')
    } finally {
      setBusy(false)
    }
  }
  function add() {
    try {
      const url = new URL(address)
      if (
        url.protocol !== 'https:' ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.username ||
        url.password ||
        url.port
      )
        throw new Error()
      if (
        !config ||
        [config.original, ...config.additional].includes(url.origin)
      )
        return
      if (config.additional.length >= 8) {
        setMessage('Adicione no máximo oito endereços.')
        return
      }
      setConfig({ ...config, additional: [...config.additional, url.origin] })
      setAddress('')
      setMessage('Endereço adicionado à lista. Clique em Salvar para aplicar.')
    } catch {
      setMessage(
        'Informe o endereço HTTPS do site, sem caminho. Exemplo: https://site.com'
      )
    }
  }
  async function save() {
    if (!config) return
    setBusy(true)
    try {
      await window.api.pluginsSourceSettings(id, config)
      close()
    } catch {
      setMessage(
        'Não foi possível salvar. Confira se os endereços são HTTPS públicos, sem caminho, porta ou credenciais.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="ghost-source-dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === dialog.current) close()
      }}
      aria-labelledby="source-config-title"
    >
      <div>
        <button className="source-close" aria-label="Fechar" onClick={close}>
          ×
        </button>
        <h2 id="source-config-title">Configurar {name}</h2>
        <p>
          O endereço original e os adicionais continuam disponíveis. O Ghost
          tenta uma alternativa quando o preferido não responde.
        </p>
        {config && (
          <>
            {[config.original, ...config.additional].map((url) => (
              <section key={url} className="source-address-row">
                <label>
                  <input
                    type="radio"
                    name="preferred-source"
                    checked={config.preferred === url}
                    onChange={() => setConfig({ ...config, preferred: url })}
                  />{' '}
                  {url} {url === config.original && <small>(original)</small>}
                </label>
                <div className="source-actions">
                  <button disabled={busy} onClick={() => void test(url)}>
                    Testar
                  </button>
                  {url !== config.original && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        setConfig({
                          ...config,
                          additional: config.additional.filter(
                            (item) => item !== url
                          ),
                          preferred:
                            config.preferred === url
                              ? config.original
                              : config.preferred
                        })
                      }
                    >
                      Remover
                    </button>
                  )}
                </div>
                <small role="status">{tests[url] || 'Ainda não testado'}</small>
              </section>
            ))}
            <label htmlFor="source-address">
              Adicionar endereço alternativo
            </label>
            <div className="source-actions">
              <input
                id="source-address"
                type="url"
                value={address}
                placeholder="https://site.com"
                onChange={(event) => setAddress(event.target.value)}
              />
              <button disabled={busy || !address.trim()} onClick={add}>
                Adicionar
              </button>
            </div>
            <p>
              Selecione o endereço preferido acima. Use somente endereços
              anunciados pelo site. Um novo domínio poderá solicitar login
              novamente.
            </p>
            <div className="source-actions">
              <button
                disabled={busy}
                onClick={() =>
                  setConfig({ ...config, preferred: config.original })
                }
              >
                Preferir original
              </button>
              <button disabled={busy} onClick={() => void save()}>
                Salvar
              </button>
              <button onClick={close}>Cancelar</button>
            </div>
          </>
        )}
        <p role="status">{busy ? 'Aguarde…' : message}</p>
      </div>
    </dialog>
  )
}
