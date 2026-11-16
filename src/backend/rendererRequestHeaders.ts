import type { OnBeforeSendHeadersListenerDetails, Session } from 'electron'

// Matches the installed application ID in electron-builder.yml and main.ts.
export const YOUTUBE_APP_REFERER = 'https://com.ghostgameslauncher.ghost/'

const youtubeEmbeds = [
  'https://www.youtube.com/embed/*',
  'https://youtube.com/embed/*',
  'https://www.youtube-nocookie.com/embed/*'
]

export type CustomBeforeSendHeadersHandler = (
  details: OnBeforeSendHeadersListenerDetails,
  headers: Record<string, string>
) => Record<string, string>

export function isYouTubeOrVideoEmbedDomain(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl)
    return (
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com') ||
      hostname === 'youtu.be' ||
      hostname === 'googlevideo.com' ||
      hostname.endsWith('.googlevideo.com') ||
      hostname === 'ytimg.com' ||
      hostname.endsWith('.ytimg.com') ||
      hostname === 'ggpht.com' ||
      hostname.endsWith('.ggpht.com') ||
      hostname === 'vimeo.com' ||
      hostname.endsWith('.vimeo.com') ||
      hostname === 'vimeocdn.com' ||
      hostname.endsWith('.vimeocdn.com')
    )
  } catch {
    return false
  }
}

/** Electron supports one onBeforeSendHeaders listener per session. */
export function installRendererRequestHeaders(
  session: Session,
  mainWindowId: () => number | undefined,
  spoofWindows = false,
  customHandler?: CustomBeforeSendHeadersHandler
): void {
  session.webRequest.onBeforeSendHeaders(
    { urls: spoofWindows || customHandler ? ['*://*/*'] : youtubeEmbeds },
    (details, callback) => {
      let headers = { ...details.requestHeaders }
      if (customHandler && !isYouTubeOrVideoEmbedDomain(details.url)) {
        headers = customHandler(details, headers)
      }
      if (spoofWindows) headers['sec-ch-ua-platform'] = 'Windows'

      if (
        details.resourceType === 'subFrame' &&
        details.webContentsId !== undefined &&
        details.webContentsId === mainWindowId()
      ) {
        const url = new URL(details.url)
        if (
          url.protocol === 'https:' &&
          [
            'www.youtube.com',
            'youtube.com',
            'www.youtube-nocookie.com'
          ].includes(url.hostname) &&
          /^\/embed\/[\w-]{11}\/?$/.test(url.pathname)
        ) {
          const refererKey = Object.keys(headers).find(
            (key) => key.toLowerCase() === 'referer'
          )
          const referer = refererKey ? headers[refererKey] : ''
          // Local file:// pages have no HTTP identity; keep real web origins intact.
          if (!/^https?:\/\//i.test(referer)) {
            if (refererKey) delete headers[refererKey]
            headers.Referer = YOUTUBE_APP_REFERER
          }
        }
      }
      callback({ cancel: false, requestHeaders: headers })
    }
  )
}
