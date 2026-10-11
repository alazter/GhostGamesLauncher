import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'

export const LIBRARY_GO_TO_END_EVENT = 'heroicLibraryGoToEnd'
export const LIBRARY_CANCEL_GO_TO_END_EVENT = 'heroicLibraryCancelGoToEnd'
export const LIBRARY_BATCH_SIZE = 60

/** Previous cumulative loader, retained only to reproduce the performance baseline. */
export default function useProgressiveLibrary(
  total: number,
  collectionKey: string,
  enabled: boolean
) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [batch, setBatch] = useState({
    key: collectionKey,
    limit: LIBRARY_BATCH_SIZE,
    goToEnd: false
  })

  // Reset even when a different filter/sort produces the same number of games.
  // Metadata-only updates keep the current batch and the user's scroll position.
  if (batch.key !== collectionKey) {
    setBatch({ key: collectionKey, limit: LIBRARY_BATCH_SIZE, goToEnd: false })
  }
  const visibleCount = enabled ? Math.min(batch.limit, total) : total
  const hasMore = visibleCount < total
  const loadNext = useCallback(() => {
    setBatch((current) => ({
      ...current,
      limit: Math.min(current.limit + LIBRARY_BATCH_SIZE, total)
    }))
  }, [total])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!enabled || batch.goToEnd || !hasMore || !sentinel) return
    if (typeof IntersectionObserver === 'undefined') return

    let active = true
    const observer = new IntersectionObserver(
      (entries) => {
        if (active && entries.some((entry) => entry.isIntersecting)) {
          // One batch per observation, including when the sentinel stays visible
          // on a tall window. Re-observe after the new cards have been committed.
          observer.disconnect()
          active = false
          loadNext()
        }
      },
      {
        root: listRef.current?.closest('#games-scroll-area') ?? null,
        rootMargin: '1200px 0px',
        threshold: 0
      }
    )
    observer.observe(sentinel)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [enabled, batch.goToEnd, hasMore, loadNext, visibleCount, collectionKey])

  useEffect(() => {
    if (!enabled) return
    const scrollArea = listRef.current?.closest('#games-scroll-area')
    if (!scrollArea) return
    const goToEnd = (event: Event) => {
      event.preventDefault()
      setBatch((current) => ({ ...current, goToEnd: true }))
    }
    const cancelGoToEnd = () => {
      setBatch((current) => ({ ...current, goToEnd: false }))
    }
    scrollArea.addEventListener(LIBRARY_GO_TO_END_EVENT, goToEnd)
    scrollArea.addEventListener(LIBRARY_CANCEL_GO_TO_END_EVENT, cancelGoToEnd)
    return () => {
      scrollArea.removeEventListener(LIBRARY_GO_TO_END_EVENT, goToEnd)
      scrollArea.removeEventListener(
        LIBRARY_CANCEL_GO_TO_END_EVENT,
        cancelGoToEnd
      )
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !batch.goToEnd || !hasMore) return
    const frame = requestAnimationFrame(loadNext)
    return () => cancelAnimationFrame(frame)
  }, [enabled, batch.goToEnd, hasMore, loadNext, visibleCount, collectionKey])

  useLayoutEffect(() => {
    if (!enabled || !batch.goToEnd || hasMore) return
    const scrollArea = listRef.current?.closest('#games-scroll-area')
    if (scrollArea) {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' })
      const cards = scrollArea.querySelectorAll<HTMLElement>(
        '.gameCard, .gameListItem'
      )
      cards[cards.length - 1]?.focus({ preventScroll: true })
    }
    setBatch((current) => ({ ...current, goToEnd: false }))
  }, [enabled, batch.goToEnd, hasMore])

  return { listRef, sentinelRef, visibleCount, hasMore, loadNext }
}
