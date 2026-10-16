import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'
import { ToggleSwitch } from 'frontend/components/UI'
import SoftwareStorePathBox from './SoftwareStorePathBox'

const AfterLaunchScriptPath = () => {
  const { t } = useTranslation()
  const { gameInfo } = useContext(SettingsContext)

  const [scriptPath, setScriptPath] = useSetting('afterLaunchScriptPath', '')
  const [waitAfterLaunchScript, setWaitAfterLaunchScript] = useSetting(
    'waitAfterLaunchScript',
    false
  )

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
        'setting.after-launch-script-path',
        'Selecione um software (.exe) ou script (.bat, .cmd, .ps1) para executar após o jogo ser fechado'
      )}
      htmlId="after-launch-script-path"
      excludeAppName={gameInfo?.app_name}
    >
      <ToggleSwitch
        htmlId="waitAfterLaunchScript"
        value={waitAfterLaunchScript}
        handleChange={() => setWaitAfterLaunchScript(!waitAfterLaunchScript)}
        title={t(
          'setting.wait-after-launch-script',
          'Aguardar o software/script finalizar após fechar o jogo'
        )}
        description={t(
          'setting.wait-after-launch-script-desc',
          'Quando desmarcado, o software/script é iniciado em segundo plano sem prender o encerramento do Ghost.'
        )}
      />
    </SoftwareStorePathBox>
  )
}

export default AfterLaunchScriptPath
