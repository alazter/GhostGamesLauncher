import './index.css'

import React, { useEffect, useState } from 'react'

import { NavLink, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft'

import ContextMenu from '../Library/components/ContextMenu'
import SettingsContext from './SettingsContext'
import LogSettings from './sections/LogSettings'
import FooterInfo from './sections/FooterInfo'
import {
  GeneralSettings,
  GamesSettings,
  SyncSaves,
  AdvancedSettings,
  SystemInfo
} from './sections'
import { AppSettings, WineInstallation } from 'common/types'
import { UpdateComponent } from 'frontend/components/UI'
import { SettingsContextType } from 'frontend/types'
import useSettingsContext from 'frontend/hooks/useSettingsContext'
import { hasHelp } from 'frontend/hooks/hasHelp'
import { ContentCopy, FileOpen } from '@mui/icons-material'

export const defaultWineVersion: WineInstallation = {
  bin: '/usr/bin/wine',
  name: 'Wine Default',
  type: 'wine'
}

function Settings() {
  const { t } = useTranslation()

  const [currentConfig, setCurrentConfig] =
    useState<Partial<AppSettings> | null>(null)

  const { type = 'general' } = useParams()
  const appName = 'default'

  // TODO: Adding this comment translation here for now to not lose the
  // translation. This should be removed from here when the help is added
  // to the SettingsModal component
  // t('help.content.settingsGame', 'Show all settings for a game.')

  const helpContent = t(
    'help.content.settingsDefault',
    'Shows all settings of Heroic and defaults for games.'
  )

  hasHelp(
    'settings',
    t('help.title.settings', 'Settings'),
    <p>{helpContent}</p>
  )

  // Load Heroic's or game's config, only if not loaded already
  useEffect(() => {
    const getSettings = async () => {
      const config = await window.api.requestAppSettings()
      setCurrentConfig(config)
    }
    getSettings()
  }, [])

  // Scroll to section dynamically when path type parameter changes
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (type) {
      timer = setTimeout(() => {
        const element = document.getElementById(type)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [type])

  // create setting context functions
  const contextValues: SettingsContextType | null = useSettingsContext({
    appName
  })

  // render `loading` while we fetch the settings
  if (!currentConfig || !contextValues) {
    return <UpdateComponent />
  }

  const title = t('globalSettings', 'Global Settings')

  return (
    <ContextMenu
      items={[
        {
          label: t(
            'settings.copyToClipboard',
            'Copy All Settings to Clipboard'
          ),
          onclick: async () =>
            window.api.clipboardWriteText(
              JSON.stringify({ appName, title, ...currentConfig })
            ),
          show: true,
          icon: <ContentCopy />
        },
        {
          label: t('settings.open-config-file', 'Open Config File'),
          onclick: () => window.api.showConfigFileInFolder(appName),
          show: true,
          icon: <FileOpen />
        }
      ]}
    >
      <SettingsContext.Provider value={contextValues}>
        <div className={`Settings ${type}`}>
          <div role="list" className="settingsWrapper" style={{ maxWidth: '800px', width: '100%', scrollBehavior: 'smooth' }}>
            <NavLink to="/library" role="link" className="backButton">
              <ArrowCircleLeftIcon />
            </NavLink>
            <h1 className="headerTitle" data-testid="headerTitle">
              {title}
            </h1>

            <div id="general" style={{ width: '100%', marginBottom: '40px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '30px' }}><GeneralSettings /></div>
            <div id="games_settings" style={{ width: '100%', marginBottom: '40px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '30px' }}><GamesSettings /></div>
            <div id="sync" style={{ width: '100%', marginBottom: '40px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '30px' }}><SyncSaves /></div>
            <div id="advanced" style={{ width: '100%', marginBottom: '40px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '30px' }}><AdvancedSettings /></div>
            <div id="log" style={{ width: '100%', marginBottom: '40px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '30px' }}><LogSettings /></div>
            <div id="systeminfo" style={{ width: '100%', marginBottom: '40px', paddingBottom: '30px' }}><SystemInfo /></div>
            <FooterInfo />
          </div>
        </div>
      </SettingsContext.Provider>
    </ContextMenu>
  )
}

export default React.memo(Settings)
