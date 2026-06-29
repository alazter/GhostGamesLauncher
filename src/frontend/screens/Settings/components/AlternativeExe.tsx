import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'
import { PathSelectionBox } from 'frontend/components/UI'

const AlternativeExe = () => {
  const { t, i18n } = useTranslation()
  const { isDefault, runner, gameInfo } = useContext(SettingsContext)

  const [targetExe, setTargetExe] = useSetting('targetExe', '')

  if (isDefault) {
    return <></>
  }

  const label =
    runner === 'sideload'
      ? (i18n.language?.startsWith('pt')
        ? 'Selecione o executável do jogo para monitorar (caso ele inicie através de outro launcher/Steam)'
        : 'Select the game executable to monitor (if it starts via another launcher/Steam)')
      : t('setting.change-target-exe', 'Select an alternative EXE to run')

  return (
    <PathSelectionBox
      type="file"
      onPathChange={setTargetExe}
      path={targetExe}
      pathDialogTitle={t('box.select.exe', 'Select EXE')}
      pathDialogDefaultPath={gameInfo?.install.install_path}
      placeholder={targetExe || t('box.select.exe', 'Select EXE...')}
      label={label}
      htmlId="setinstallpath"
    />
  )
}

export default AlternativeExe

