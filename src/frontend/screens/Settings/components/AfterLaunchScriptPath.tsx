import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'
import { PathSelectionBox, ToggleSwitch } from 'frontend/components/UI'

const AfterLaunchScriptPath = () => {
  const { t } = useTranslation()
  const { gameInfo } = useContext(SettingsContext)

  const [scriptPath, setScriptPath] = useSetting('afterLaunchScriptPath', '')
  const [waitAfterLaunchScript, setWaitAfterLaunchScript] = useSetting(
    'waitAfterLaunchScript',
    false
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <PathSelectionBox
        type="file"
        onPathChange={setScriptPath}
        path={scriptPath}
        pathDialogTitle={t(
          'box.select.script',
          'Selecionar software (.exe) ou script (.bat, .cmd, .ps1)...'
        )}
        pathDialogDefaultPath={gameInfo?.install.install_path}
        placeholder={
          scriptPath ||
          t(
            'box.select.script',
            'Selecionar software (.exe) ou script (.bat, .cmd, .ps1)...'
          )
        }
        label={t(
          'setting.after-launch-script-path',
          'Selecione um software (.exe) ou script (.bat, .cmd, .ps1) para executar após o jogo ser fechado'
        )}
        htmlId="after-launch-script-path"
      />
      {Boolean(scriptPath) && (
        <div style={{ marginTop: '2px', paddingLeft: '2px' }}>
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
        </div>
      )}
    </div>
  )
}

export default AfterLaunchScriptPath
