import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

export const STREMIO_STREAMING_URL = 'http://127.0.0.1:11470'

export async function isStremioServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${STREMIO_STREAMING_URL}/stats.json`, {
      signal: AbortSignal.timeout(1200)
    })
    return res.ok
  } catch {
    return false
  }
}

export function findStremioExecutable(): { runtime?: string; serverJs?: string } {
  const localAppData = process.env.LOCALAPPDATA || ''
  const candidates = [
    {
      runtime: join(localAppData, 'Programs', 'Stremio', 'stremio-runtime.exe'),
      serverJs: join(localAppData, 'Programs', 'Stremio', 'server.js')
    },
    {
      runtime: join(localAppData, 'Programs', 'LNV', 'Stremio-4', 'stremio-runtime.exe'),
      serverJs: join(localAppData, 'Programs', 'LNV', 'Stremio-4', 'server.js')
    },
    {
      runtime: 'C:\\Users\\alazt\\AppData\\Local\\Programs\\Stremio\\stremio-runtime.exe',
      serverJs: 'C:\\Users\\alazt\\AppData\\Local\\Programs\\Stremio\\server.js'
    }
  ]

  for (const c of candidates) {
    if (existsSync(c.runtime) && existsSync(c.serverJs)) {
      return c
    }
  }
  return {}
}

export async function ensureStremioServer(): Promise<{
  online: boolean
  url: string
  message?: string
}> {
  if (await isStremioServerRunning()) {
    return { online: true, url: STREMIO_STREAMING_URL }
  }

  const { runtime, serverJs } = findStremioExecutable()
  if (runtime && serverJs) {
    try {
      const child = spawn(runtime, [serverJs], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.unref()

      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 350))
        if (await isStremioServerRunning()) {
          return {
            online: true,
            url: STREMIO_STREAMING_URL,
            message: 'Motor de streaming Stremio iniciado com sucesso.'
          }
        }
      }
    } catch {}
  }

  const runningNow = await isStremioServerRunning()
  return {
    online: runningNow,
    url: STREMIO_STREAMING_URL,
    message: runningNow
      ? undefined
      : 'Motor de streaming Stremio não pôde ser iniciado automaticamente.'
  }
}
