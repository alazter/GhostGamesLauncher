/** Resolve one byte range without limiting continuous playback to fixed chunks. */
export function mediaByteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || size <= 0 || (!match[1] && !match[2])) return null
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start >= size ||
    requestedEnd < start
  )
    return null
  return { start, end: Math.min(requestedEnd, size - 1) }
}
