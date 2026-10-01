/** Keep disk checkpoints and UI work out of the per-chunk transfer path. */
export function downloadProgress(
  initialBytes: number,
  report: (speed: number) => void,
  checkpoint: () => void
) {
  let reportedAt = Date.now()
  let savedAt = reportedAt
  let reportedBytes = initialBytes
  return (bytes: number, force = false) => {
    const now = Date.now()
    const elapsed = now - reportedAt
    if (!force && elapsed < 500) return
    const speed =
      elapsed > 0 ? Math.max(0, ((bytes - reportedBytes) * 1000) / elapsed) : 0
    reportedAt = now
    reportedBytes = bytes
    report(speed)
    if (force || now - savedAt >= 10000) {
      savedAt = now
      checkpoint()
    }
  }
}
