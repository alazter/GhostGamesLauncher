import { readFileSync, statSync } from 'fs'

/** A partial file may contain holes from parallel writes. Only a checkpoint
 * committed after fsync proves how much of its contiguous prefix is reusable. */
export function rangedResumeOffset(
  destination: string,
  total: number,
  etag: string
): number {
  try {
    const marker = `${destination}.resume.json`
    if (statSync(marker).size > 1024) return 0
    const data = JSON.parse(readFileSync(marker, 'utf8')) as {
      revision: number
      total: number
      etag: string
      offset: number
    }
    const file = statSync(destination)
    return data.revision === 1 &&
      data.total === total &&
      data.etag === etag &&
      /^"[^\r\n]+"$/.test(etag) &&
      Number.isSafeInteger(data.offset) &&
      data.offset >= 0 &&
      data.offset <= total &&
      file.isFile() &&
      file.size >= data.offset &&
      file.size <= total
      ? data.offset
      : 0
  } catch {
    return 0
  }
}
