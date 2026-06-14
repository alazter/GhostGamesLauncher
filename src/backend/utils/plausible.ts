import { backendEvents } from 'backend/backend_events'
import {
  isFlatpak,
  isAppImage,
  isSnap,
  isSteamDeckGameMode,
  isSteamDeck
} from 'backend/constants/environment'
import { logInfo, logWarning, LogPrefix } from 'backend/logger'
import { GOGUser } from 'backend/storeManagers/gog/user'
import { LegendaryUser } from 'backend/storeManagers/legendary/user'
import { NileUser } from 'backend/storeManagers/nile/user'
import { libraryStore } from 'backend/storeManagers/sideload/electronStores'
import { getOsInfo } from 'backend/utils/systeminfo/osInfo'
import { app } from 'electron'
import https from 'https'

const PLAUSIBLE_DOMAIN = 'heroic-games-client.com'
const PLAUSIBLE_API = 'https://plausible.io/api/event'

interface PlausibleEventProps {
  [key: string]: string | number | boolean
}

function sendPlausible(payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload)
    const req = https.request(
      PLAUSIBLE_API,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HeroicGamesLauncher/1.0'
        }
      },
      (res) => {
        res.on('data', () => {})
        res.on('end', resolve)
      }
    )
    req.setTimeout(5000, () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function Plausible() {
  return {
    enableAutoPageviews() {
      // For desktop apps, send a single "pageview" event on app load
      sendPlausible({
        name: 'pageview',
        url: 'app://main',
        domain: PLAUSIBLE_DOMAIN
      }).catch(() => {})
    },
    trackEvent(eventName: string, opts?: { props?: PlausibleEventProps }) {
      sendPlausible({
        name: eventName,
        url: 'app://main',
        domain: PLAUSIBLE_DOMAIN,
        props: opts?.props
      }).catch(() => {})
    }
  }
}

export async function startPlausible() {
  logInfo('Plausible Analytics is disabled', LogPrefix.Backend)
  return
}

backendEvents.on('settingChanged', ({ key, newValue }) => {
  if (key === 'analyticsOptIn') {
    if (newValue) {
      logInfo('Starting Plausible Analytics', LogPrefix.Backend)
      startPlausible()
    } else {
      logInfo('Stopping Plausible Analytics', LogPrefix.Backend)
    }
  }
})
