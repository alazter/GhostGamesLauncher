import { statfs } from 'fs/promises'
import { parse, join } from 'path'
import type { ExternalSpacePlan } from 'common/types/plugins'

export function sizeBytes(value?: string): number {
  const match = value
    ?.trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/i)
  if (!match) return 0
  const power = ['b', 'k', 'm', 'g', 't'].indexOf(match[2][0].toLowerCase())
  const result = Number(match[1].replace(',', '.')) * 1024 ** power
  return Number.isSafeInteger(Math.ceil(result)) ? Math.ceil(result) : 0
}

export const spaceReserve = 512 * 1024 ** 2

export async function planInstallSpace(
  destination: string,
  id: string,
  packageBytes: number,
  installedBytes: number,
  estimated: boolean,
  roots = process.platform === 'win32'
    ? Array.from({ length: 24 }, (_, i) => `${String.fromCharCode(67 + i)}:\\`)
    : [parse(destination).root]
): Promise<ExternalSpacePlan> {
  const disk = await statfs(destination)
  const available = disk.bavail * disk.bsize
  const requiredOriginal = packageBytes + installedBytes + spaceReserve
  const plan: ExternalSpacePlan = {
    destination,
    packageBytes,
    installedBytes,
    requiredOriginal,
    estimated,
    missingOriginal: Math.max(0, requiredOriginal - available),
    missingDestination: Math.max(0, installedBytes + spaceReserve - available)
  }
  if (plan.missingOriginal && !plan.missingDestination) {
    for (const root of roots) {
      if (
        parse(root).root.toLowerCase() === parse(destination).root.toLowerCase()
      )
        continue
      try {
        const candidate = await statfs(root)
        if (candidate.bavail * candidate.bsize >= packageBytes + spaceReserve) {
          plan.temporaryDirectory = join(root, `.ghost-download-${id}`)
          break
        }
      } catch {
        /* Offline or inaccessible drives cannot store the package. */
      }
    }
  }
  return plan
}
