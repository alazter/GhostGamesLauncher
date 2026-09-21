import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import { useTranslation } from 'react-i18next'

const CheckPirataUpdatesDaily = () => {
  const { t } = useTranslation()
  const [checkPirataUpdatesDaily, setCheckPirataUpdatesDaily] = useSetting(
    'checkPirataUpdatesDaily',
    true
  )

  return (
    <ToggleSwitch
      htmlId="checkPirataUpdatesDaily"
      value={checkPirataUpdatesDaily}
      handleChange={() => setCheckPirataUpdatesDaily(!checkPirataUpdatesDaily)}
      title={t(
        'setting.checkPirataUpdatesDaily',
        'Verificar atualizações de jogos da Loja Piratas a cada 24 horas'
      )}
      description={t(
        'setting.checkPirataUpdatesDaily.description',
        'Consulta de forma ultraleve e sem pesar no computador se há novas versões disponíveis nos sites onde os jogos foram obtidos (SteamRIP, AnkerGames, Online-Fix).'
      )}
    />
  )
}

export default CheckPirataUpdatesDaily
