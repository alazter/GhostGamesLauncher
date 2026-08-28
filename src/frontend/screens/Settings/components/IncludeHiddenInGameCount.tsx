import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import { useTranslation } from 'react-i18next'

const IncludeHiddenInGameCount = () => {
  const { t } = useTranslation()
  const [includeHiddenInGameCount, setIncludeHiddenInGameCount] = useSetting(
    'includeHiddenInGameCount',
    false
  )

  return (
    <ToggleSwitch
      htmlId="includeHiddenInGameCount"
      value={includeHiddenInGameCount}
      handleChange={() => setIncludeHiddenInGameCount(!includeHiddenInGameCount)}
      title={t(
        'setting.include_hidden_in_game_count',
        'Incluir jogos ocultos na contagem total da biblioteca'
      )}
    />
  )
}

export default IncludeHiddenInGameCount
