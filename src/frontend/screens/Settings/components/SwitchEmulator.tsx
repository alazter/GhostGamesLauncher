import { PathSelectionBox } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'

export default function SwitchEmulator() {
  const [path, setPath] = useSetting('switchEmulatorPath', '')
  const [args, setArgs] = useSetting('switchEmulatorArgs', '{rom}')
  return (
    <section>
      <PathSelectionBox
        type="file"
        htmlId="switchEmulatorPath"
        path={path}
        onPathChange={setPath}
        pathDialogTitle="Selecione o executável do emulador"
        label="Emulador de Nintendo Switch"
      />
      <p>
        Escolha Eden, Ryujinx, Citron, Nextendo ou outro emulador instalado. Ao
        clicar em Jogar na capa, o Ghost abre a ROM nele.
      </p>
      <label htmlFor="switchEmulatorArgs">Argumentos do emulador</label>
      <input
        id="switchEmulatorArgs"
        value={args}
        onChange={(event) => setArgs(event.target.value)}
        placeholder="{rom}"
      />
      <p>
        Use {'{rom}'} onde deve entrar o caminho do jogo. Padrão: {'{rom}'}.
        Ajuste conforme o emulador escolhido. O emulador precisa estar
        configurado e aceitar o formato da ROM.
      </p>
    </section>
  )
}
