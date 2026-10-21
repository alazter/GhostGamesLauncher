import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join, isAbsolute } from 'path'

export interface ArchiveTool {
  kind: '7zip' | 'winrar'
  path: string
}

const cached = new Map<ArchiveTool['kind'], string>()

export function archiveToolCandidates(kind: ArchiveTool['kind']): string[] {
  const folder = kind === '7zip' ? '7-Zip' : 'WinRAR'
  const executables = kind === '7zip' ? ['7z.exe'] : ['UnRAR.exe', 'Rar.exe']
  const roots = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ]
  return [
    ...new Set([
      ...(kind === '7zip'
        ? ['7z', '7zz', '7z.exe']
        : ['unrar', 'UnRAR.exe', 'rar', 'Rar.exe']),
      ...roots
        .filter((root): root is string => Boolean(root))
        .flatMap((root) =>
          executables.map((executable) => join(root, folder, executable))
        ),
      ...(process.env.LOCALAPPDATA
        ? executables.map((executable) =>
            join(process.env.LOCALAPPDATA!, 'Programs', folder, executable)
          )
        : []),
      ...(process.env.USERPROFILE
        ? executables.map((executable) =>
            join(process.env.USERPROFILE!, 'scoop', 'shims', executable)
          )
        : [])
    ])
  ]
}

async function registryCandidates(
  kind: ArchiveTool['kind']
): Promise<string[]> {
  if (process.platform !== 'win32') return []
  const queries =
    kind === '7zip'
      ? [
          'HKCU\\Software\\7-Zip',
          'HKLM\\SOFTWARE\\7-Zip',
          'HKLM\\SOFTWARE\\WOW6432Node\\7-Zip'
        ]
      : [
          'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\WinRAR.exe',
          'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\WinRAR.exe',
          'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\WinRAR.exe'
        ]
  const results = await Promise.all(
    queries.map(
      (key) =>
        new Promise<string>((resolve) => {
          execFile(
            'reg.exe',
            ['query', key],
            { windowsHide: true, timeout: 5000, maxBuffer: 65536 },
            (error, stdout) => resolve(error ? '' : stdout)
          )
        })
    )
  )
  return results.flatMap((output) =>
    [...output.matchAll(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/g)].flatMap(
      (match) => {
        const value = match[1]
          .trim()
          .replace(/^"|"$/g, '')
          .replace(
            /%([^%]+)%/g,
            (original, name: string) => process.env[name] || original
          )
        if (!isAbsolute(value)) return []
        const directory = /\.exe$/i.test(value) ? dirname(value) : value
        return (kind === '7zip' ? ['7z.exe'] : ['UnRAR.exe', 'Rar.exe']).map(
          (executable) => join(directory, executable)
        )
      }
    )
  )
}

async function resolveTool(kind: ArchiveTool['kind']): Promise<string | null> {
  const previous = cached.get(kind)
  if (previous && (!isAbsolute(previous) || existsSync(previous)))
    return previous
  cached.delete(kind)
  for (const candidate of [
    ...archiveToolCandidates(kind),
    ...(await registryCandidates(kind))
  ]) {
    if (isAbsolute(candidate)) {
      if (existsSync(candidate)) {
        cached.set(kind, candidate)
        return candidate
      }
    } else {
      const works = await new Promise<boolean>((resolve) => {
        execFile(
          candidate,
          kind === '7zip' ? ['-h'] : ['-?'],
          { windowsHide: true, timeout: 5000, maxBuffer: 65536 },
          (error) => resolve(!error)
        )
      })
      if (works) {
        cached.set(kind, candidate)
        return candidate
      }
    }
  }
  // Do not cache absence: installing the tool must work without restarting Ghost.
  return null
}

export const resolve7zPath = () => resolveTool('7zip')
export const resolveUnrarPath = () => resolveTool('winrar')
