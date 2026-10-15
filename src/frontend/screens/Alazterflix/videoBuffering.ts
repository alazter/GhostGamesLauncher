export const BUFFERING_DELAY_MS = 400

/** Show loading for a sustained playback stall, not every transient wait event. */
export function observeVideoBuffering(
  video: HTMLVideoElement,
  onChange: (buffering: boolean) => void
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let previousTime = video.currentTime
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const clear = () => {
    cancel()
    onChange(false)
  }
  const needsData = () =>
    !video.paused && !video.ended && !video.error && video.readyState < 3
  const wait = () => {
    if (timer !== undefined || !needsData()) return
    const waitingAt = video.currentTime
    timer = setTimeout(() => {
      timer = undefined
      if (!needsData()) return
      if (video.currentTime === waitingAt) onChange(true)
      else wait()
    }, BUFFERING_DELAY_MS)
  }
  const progress = () => {
    if (!video.seeking && video.currentTime !== previousTime) {
      clear()
      wait()
    }
    previousTime = video.currentTime
  }
  const loading = () => {
    previousTime = video.currentTime
    clear()
    wait()
  }
  const seeked = () => {
    if (needsData()) wait()
    else clear()
  }
  const listeners: Array<[string, () => void]> = [
    ['waiting', wait],
    ['stalled', wait],
    ['seeking', wait],
    ['loadstart', loading],
    ['seeked', seeked],
    ['timeupdate', progress],
    ['playing', clear],
    ['canplay', clear],
    ['pause', clear],
    ['ended', clear],
    ['error', clear]
  ]
  for (const [event, listener] of listeners)
    video.addEventListener(event, listener)
  loading()
  return () => {
    for (const [event, listener] of listeners)
      video.removeEventListener(event, listener)
    clear()
  }
}
