import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'

export default function LocalPackageInstall() {
  const [enabled, setEnabled] = useSetting('enableLocalPackageInstall', false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [queued, setQueued] = useState(false)

  async function install() {
    setBusy(true)
    setMessage('')
    setQueued(false)
    try {
      const result = await window.api.externalGamesInstallLocal()
      if (result.success) {
        setQueued(true)
        setMessage('Pacote adicionado à fila. Acompanhe a instalação em Downloads.')
      } else if (result.error) setMessage(result.error)
    } catch {
      setMessage('Não foi possível iniciar a instalação do pacote.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <ToggleSwitch
        htmlId="enableLocalPackageInstall"
        value={enabled}
        handleChange={() => setEnabled(!enabled)}
        title="Instalar por arquivo local"
        description="Permite instalar jogos Windows de pacotes ZIP, RAR, 7Z ou TAR, sem depender dos sites de download. O arquivo original é preservado."
      />
      {enabled && (
        <button className="button is-primary" disabled={busy} onClick={() => void install()}>
          {busy ? 'Abrindo pacote…' : 'Selecionar pacote e instalar'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {queued && <Link to="/download-manager">Ver Downloads</Link>}
    </div>
  )
}
