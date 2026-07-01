import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import { useTranslation } from 'react-i18next'

const SteamGridDbNsfw = () => {
  const { t } = useTranslation()
  const [steamGridDbNsfw, setSteamGridDbNsfw] = useSetting(
    'steamGridDbNsfw',
    false
  )

  return (
    <ToggleSwitch
      htmlId="steamGridDbNsfw"
      value={steamGridDbNsfw}
      handleChange={() => setSteamGridDbNsfw(!steamGridDbNsfw)}
      title={t('setting.steamGridDbNsfw', 'Habilitar capas adultas (NSFW)')}
      description={t(
        'setting.steamGridDbNsfw.description',
        'Permitir que capas adultas/NSFW sejam exibidas no seletor de capas do SteamGridDB'
      )}
    />
  )
}

export default SteamGridDbNsfw
