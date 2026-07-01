import { ToggleSwitch, InfoBox } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import { useTranslation } from 'react-i18next'

const SteamGridDbDownload = () => {
  const { t } = useTranslation()
  const [steamGridDbDownloadCovers, setSteamGridDbDownloadCovers] = useSetting(
    'steamGridDbDownloadCovers',
    true
  )

  return (
    <div className="toggleRow" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <div style={{ width: 'fit-content' }}>
        <ToggleSwitch
          htmlId="steamGridDbDownloadCovers"
          value={steamGridDbDownloadCovers}
          handleChange={() => setSteamGridDbDownloadCovers(!steamGridDbDownloadCovers)}
          title={t('setting.steamGridDbDownloadCovers', 'Baixar capas localmente')}
          description={t(
            'setting.steamGridDbDownloadCovers.description',
            'Salvar capas do SteamGridDB permanentemente no computador para carregamento instantâneo e offline'
          )}
        />
      </div>
      <InfoBox text={t('settings.advanced.details', 'Details')}>
        <div style={{ fontSize: '13px', lineHeight: '1.5', maxWidth: '320px', userSelect: 'text' }}>
          {t(
            'setting.steamGridDbDownloadCovers.info',
            'Quando ativo, o launcher fará o download e guardará a capa no seu computador de forma permanente. Isso evita que mídias animadas pesadas quebrem devido a bloqueios ou oscilações de rede e acelera a inicialização da biblioteca.'
          )}
        </div>
      </InfoBox>
    </div>
  )
}

export default SteamGridDbDownload
