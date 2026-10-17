import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'
import { ToggleSwitch } from 'frontend/components/UI'
import SoftwareStorePathBox from './SoftwareStorePathBox'

const BeforeLaunchScriptPath = () => {
  const { t } = useTranslation()
  const { gameInfo } = useContext(SettingsContext)

  const [scriptPath, setScriptPath] = useSetting('beforeLaunchScriptPath', '')
  const [waitBeforeLaunchScript, setWaitBeforeLaunchScript] = useSetting(
    'waitBeforeLaunchScript',
    false
  )
  const [closeBeforeLaunchScriptOnExit, setCloseBeforeLaunchScriptOnExit] =
    useSetting('closeBeforeLaunchScriptOnExit', false)

  return (
    <SoftwareStorePathBox
      onPathChange={setScriptPath}
      path={scriptPath}
      pathDialogTitle={t(
        'box.select.script',
        'Selecionar software (.exe) ou script (.bat, .cmd, .ps1)...'
      )}
      pathDialogDefaultPath={gameInfo?.install.install_path}
      placeholder={t(
        'box.select.script.store',
        'Selecionar software (.exe) da Loja Softwares ou procurar no PC...'
      )}
      label={t(
        'setting.before-launch-script-path',
        'Selecione um software (.exe) ou script (.bat, .cmd, .ps1) para executar antes de iniciar o jogo'
      )}
      htmlId="before-launch-script-path"
      excludeAppName={gameInfo?.app_name}
    >
      <ToggleSwitch
        htmlId="waitBeforeLaunchScript"
        value={waitBeforeLaunchScript}
        handleChange={() => setWaitBeforeLaunchScript(!waitBeforeLaunchScript)}
        title={t(
          'setting.wait-before-launch-script',
          'Aguardar o software/script fechar antes de iniciar o jogo (desmarque para programas em segundo plano)'
        )}
        description={t(
          'setting.wait-before-launch-script-desc',
          'Quando desmarcado, o software/script é iniciado e o jogo abre imediatamente sem travar.'
        )}
      />
      <ToggleSwitch
        htmlId="closeBeforeLaunchScriptOnExit"
        value={closeBeforeLaunchScriptOnExit}
        handleChange={() =>
          setCloseBeforeLaunchScriptOnExit(!closeBeforeLaunchScriptOnExit)
        }
        title={t(
          'setting.close-before-launch-script-on-exit',
          'Encerrar o software automaticamente assim que o jogo for fechado'
        )}
        description={t(
          'setting.close-before-launch-script-on-exit-desc',
          'Quando marcado, o Ghost fecha automaticamente este software/script em segundo plano assim que você sair do jogo.'
        )}
      />
    </SoftwareStorePathBox>
  )
}

export default BeforeLaunchScriptPath
