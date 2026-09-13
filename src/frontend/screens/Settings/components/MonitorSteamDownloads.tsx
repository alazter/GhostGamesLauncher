import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import { useTranslation } from 'react-i18next'

const MonitorSteamDownloads = () => {
  const { t } = useTranslation()
  const [monitorSteamDownloads, setMonitorSteamDownloads] = useSetting(
    'monitorSteamDownloads',
    true
  )

  return (
    <ToggleSwitch
      htmlId="monitorSteamDownloads"
      value={monitorSteamDownloads}
      handleChange={() => setMonitorSteamDownloads(!monitorSteamDownloads)}
      title={t(
        'setting.monitorSteamDownloads',
        'Monitorar downloads e atualizações da Steam em segundo plano'
      )}
      description={t(
        'setting.monitorSteamDownloads.description',
        'Exibe o progresso em tempo real no Gerenciador de Downloads do Ghost quando jogos estiverem baixando na Steam.'
      )}
    />
  )
}

export default MonitorSteamDownloads
