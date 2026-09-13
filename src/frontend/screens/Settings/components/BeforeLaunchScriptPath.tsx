import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'
import { PathSelectionBox, ToggleSwitch } from 'frontend/components/UI'

const BeforeLaunchScriptPath = () => {
  const { t } = useTranslation()
  const { gameInfo } = useContext(SettingsContext)

  const [scriptPath, setScriptPath] = useSetting('beforeLaunchScriptPath', '')
  const [waitBeforeLaunchScript, setWaitBeforeLaunchScript] = useSetting(
    'waitBeforeLaunchScript',
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
          'setting.before-launch-script-path',
          'Selecione um software (.exe) ou script (.bat, .cmd, .ps1) para executar antes de iniciar o jogo'
        )}
        htmlId="before-launch-script-path"
      />
      {Boolean(scriptPath) && (
        <div style={{ marginTop: '2px', paddingLeft: '2px' }}>
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
        </div>
      )}
    </div>
  )
}

export default BeforeLaunchScriptPath
