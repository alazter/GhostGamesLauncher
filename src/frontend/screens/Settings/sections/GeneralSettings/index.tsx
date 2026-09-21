import { useTranslation } from 'react-i18next'
import LanguageSelector from 'frontend/components/UI/LanguageSelector'
import { ThemeSelector } from 'frontend/components/UI/ThemeSelector'
import LocalPackageInstall from '../../components/LocalPackageInstall'
import SwitchEmulator from '../../components/SwitchEmulator'
import {
  AutoUpdateGames,
  CheckUpdatesOnStartup,
  DefaultInstallPath,
  DefaultSteamPath,
  DisableController,
  DiscordRPC,
  EgsSettings,
  HideChangelogOnStartup,
  LibraryTopSection,
  MaxRecentGames,
  MaxWorkers,
  MinimizeOnGameLaunch,
  MonitorSteamDownloads,
  CheckPirataUpdatesDaily,
  Shortcuts,
  StartInConsoleMode,
  StartAtLogin,
  TraySettings,
  UseDarkTrayIcon,
  UseFramelessWindow,
  WinePrefixesBasePath,
  PlaytimeSync,
  AnalyticsOptIn,
  SteamGridDbApiKey,
  SteamGridDbNsfw,
  SteamGridDbDownload,
  BackupRestoreSettings,
  IncludeHiddenInGameCount
} from '../../components'

export default function GeneralSettings() {
  const { t } = useTranslation()

  return (
    <div>
      <h3 className="settingSubheader">{t('settings.navbar.general')}</h3>

      <LanguageSelector />

      <ThemeSelector />

      <SteamGridDbApiKey />

      <SteamGridDbNsfw />

      <SteamGridDbDownload />

      <DefaultInstallPath />

      <WinePrefixesBasePath />

      <DefaultSteamPath />

      <MonitorSteamDownloads />

      <CheckPirataUpdatesDaily />
      <LocalPackageInstall />
      <SwitchEmulator />

      <EgsSettings />

      <CheckUpdatesOnStartup />

      <AutoUpdateGames />

      <HideChangelogOnStartup />

      <StartInConsoleMode />

      <TraySettings />

      <StartAtLogin />

      <MinimizeOnGameLaunch />

      <UseDarkTrayIcon />

      <UseFramelessWindow />

      <Shortcuts />

      <PlaytimeSync />

      <DiscordRPC />

      <DisableController />

      <AnalyticsOptIn />

      <LibraryTopSection />

      <IncludeHiddenInGameCount />

      <MaxRecentGames />

      <MaxWorkers />

      <BackupRestoreSettings />
    </div>
  )
}
