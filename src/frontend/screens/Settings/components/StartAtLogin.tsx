import { useContext } from 'react'
import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'

const StartAtLogin = () => {
  const { t } = useTranslation()
  const { platform } = useContext(ContextProvider)
  const [startAtLogin, setStartAtLogin] = useSetting(
    'startAtLogin',
    false
  )

  const isWin = platform === 'win32'
  const isMac = platform === 'darwin'

  if (!isWin && !isMac) {
    return null
  }

  const title = isWin
    ? t('setting.startWithWindows', 'Start Ghost with Windows')
    : t('setting.startAtLogin', 'Start Ghost at Login')

  return (
    <ToggleSwitch
      htmlId="startAtLogin"
      value={startAtLogin}
      handleChange={() => setStartAtLogin(!startAtLogin)}
      title={title}
    />
  )
}

export default StartAtLogin
