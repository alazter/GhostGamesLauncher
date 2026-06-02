import { useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoBox, TextInputField } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import SettingsContext from '../SettingsContext'

const LauncherArgs = () => {
  const { t } = useTranslation()
  const { isDefault } = useContext(SettingsContext)
  const [launcherArgs, setLauncherArgs] = useSetting('launcherArgs', '')
  const [error, setError] = useState('')

  const handleLauncherArgs = (newValue: string) => setLauncherArgs(newValue)

  useEffect(() => {
    if (launcherArgs.match(/%command/)) {
      setError(
        t(
          'options.gameargs.error.command',
          'The %command% syntax from Steam is not valid as game arguments.'
        )
      )
    } else if (launcherArgs.match(/[A-Z_]+=\S/)) {
      setError(
        t(
          'options.gameargs.error.env',
          'Environment variables must be configured in the table below.'
        )
      )
    } else {
      setError('')
    }
  }, [launcherArgs])

  if (isDefault) {
    return <></>
  }

  const launcherArgsInfo = (
    <InfoBox text="infobox.help" align="right">
      <span>
        {t('help.other.part4')}
        <strong>{t('help.other.part5')}</strong>
        {t('help.other.part6')}
        <strong>{` -nolauncher `}</strong>
        {t('help.other.part7')}
      </span>
    </InfoBox>
  )

  let errorDiv = <></>
  if (error) {
    errorDiv = <p className="error">{error}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label htmlFor="launcherArgs" style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-default)' }}>
          {t('options.gameargs.title')}
        </label>
        {launcherArgsInfo}
      </div>
      <TextInputField
        htmlId="launcherArgs"
        placeholder={t('options.gameargs.placeholder')}
        value={launcherArgs}
        onChange={handleLauncherArgs}
        afterInput={errorDiv}
      />
    </div>
  )
}

export default LauncherArgs
