import https from 'https'
import { logInfo, logError, LogPrefix } from 'backend/logger'

export interface SteamApiGame {
  appId: string
  title: string
  playtimeForever?: number
  imgIconUrl?: string
}

export class SteamWebApi {
  /**
   * Via B: Fetches owned games via official Valve Steam Web API Key
   */
  public static async fetchGamesByApiKey(
    apiKey: string,
    steamId64: string
  ): Promise<SteamApiGame[]> {
    const cleanKey = apiKey.trim()
    const cleanId = steamId64.trim()
    if (!cleanKey || !cleanId) return []

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(
      cleanKey
    )}&steamid=${encodeURIComponent(
      cleanId
    )}&include_appinfo=1&include_played_free_games=1&include_free_sub=1&skip_unvetted_apps=0&format=json`

    logInfo(`Fetching owned games via Steam Web API for ${cleanId}`, LogPrefix.Steam)

    return new Promise((resolve) => {
      https
        .get(url, { headers: { 'User-Agent': 'GhostLauncher/1.0' } }, (res) => {
          let rawData = ''
          res.on('data', (chunk) => (rawData += chunk))
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData)
              const games = parsed?.response?.games
              if (Array.isArray(games)) {
                const results: SteamApiGame[] = games.map((g: any) => ({
                  appId: g.appid.toString(),
                  title: (g.name || `Steam App ${g.appid}`).trim(),
                  playtimeForever: g.playtime_forever,
                  imgIconUrl: g.img_icon_url
                }))
                logInfo(
                  `Successfully fetched ${results.length} games via Steam Web API`,
                  LogPrefix.Steam
                )
                resolve(results)
                return
              }
              resolve([])
            } catch (err) {
              logError(['Failed to parse Steam Web API response', err], LogPrefix.Steam)
              resolve([])
            }
          })
        })
        .on('error', (err) => {
          logError(['Steam Web API network request failed', err], LogPrefix.Steam)
          resolve([])
        })
    })
  }

  /**
   * Via A: Fetches owned games via authenticated Steam Community Web Session
   */
  public static async fetchGamesByWebSession(
    sessionCookie: string,
    steamId64?: string
  ): Promise<SteamApiGame[]> {
    const cleanCookie = sessionCookie.trim()
    if (!cleanCookie) return []

    const targetUrl = steamId64
      ? `https://steamcommunity.com/profiles/${encodeURIComponent(steamId64)}/games?xml=1`
      : 'https://steamcommunity.com/my/games/?xml=1'

    logInfo(`Fetching owned games via Steam Community Web Session`, LogPrefix.Steam)

    return new Promise((resolve) => {
      const cookieHeader = cleanCookie.includes('=')
        ? cleanCookie
        : `steamLoginSecure=${cleanCookie}`

      https
        .get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Cookie: cookieHeader
            }
          },
          (res) => {
            let rawData = ''
            res.on('data', (chunk) => (rawData += chunk))
            res.on('end', () => {
              try {
                const appMatches = [
                  ...rawData.matchAll(
                    /<appID>(\d+)<\/appID>\s*<name><!\[CDATA\[(.*?)\]\]><\/name>/g
                  )
                ]

                if (appMatches.length > 0) {
                  const results: SteamApiGame[] = appMatches.map((m) => ({
                    appId: m[1],
                    title: m[2].trim()
                  }))
                  logInfo(
                    `Successfully fetched ${results.length} games via Steam Community XML`,
                    LogPrefix.Steam
                  )
                  resolve(results)
                  return
                }

                resolve([])
              } catch (err) {
                logError(
                  ['Failed to parse Steam Community response', err],
                  LogPrefix.Steam
                )
                resolve([])
              }
            })
          }
        )
        .on('error', (err) => {
          logError(['Steam Community session request failed', err], LogPrefix.Steam)
          resolve([])
        })
    })
  }
}
