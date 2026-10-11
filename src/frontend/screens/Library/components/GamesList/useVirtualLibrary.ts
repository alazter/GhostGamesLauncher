import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  LIBRARY_GO_TO_END_EVENT,
  LIBRARY_GO_TO_START_EVENT,
  navigateVirtualLibrary,
  registerLibraryNavigation
} from './libraryNavigation'

const BUFFER_ROWS = 3
interface Geometry {
  columns: number
  columnWidth: number
  columnGap: number
  rowHeight: number
  gap: number
  paddingLeft: number
  paddingTop: number
  contentTop: number
  headerHeight: number
  viewportHeight: number
}
const initialGeometry: Geometry = {
  columns: 1,
  columnWidth: 0,
  columnGap: 0,
  rowHeight: 0,
  gap: 0,
  paddingLeft: 0,
  paddingTop: 0,
  contentTop: 0,
  headerHeight: 0,
  viewportHeight: 0
}

/** Keep only visible rows and a small buffer mounted, with full native scroll height. */
export default function useVirtualLibrary(
  total: number,
  collectionKey: string,
  enabled: boolean,
  layout: string
) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLElement | null>(null)
  const geometryRef = useRef(initialGeometry)
  const totalRef = useRef(total)
  totalRef.current = total
  const pendingFocus = useRef<number | null>(null)
  const [geometry, setGeometry] = useState(initialGeometry)
  const [range, setRange] = useState({ start: 0, end: Math.min(1, total) })
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null)

  const updateRange = useCallback(() => {
    const root = scrollRef.current
    const { columns, rowHeight, gap, contentTop, viewportHeight } =
      geometryRef.current
    if (!root || !rowHeight) return
    const stride = rowHeight + gap
    const rows = Math.ceil(totalRef.current / columns)
    const firstRow = Math.min(
      rows,
      Math.max(
        0,
        Math.floor((root.scrollTop - contentTop) / stride) - BUFFER_ROWS
      )
    )
    const lastRow = Math.min(
      rows,
      Math.max(
        firstRow + 1,
        Math.ceil((root.scrollTop + viewportHeight - contentTop) / stride) +
          BUFFER_ROWS
      )
    )
    const start = firstRow * columns
    const end = Math.min(totalRef.current, lastRow * columns)
    setRange((current) =>
      current.start === start && current.end === end ? current : { start, end }
    )
  }, [])

  const focusIndex = useCallback(
    (index: number) => {
      const list = listRef.current
      const root = scrollRef.current
      if (!list || !root || !totalRef.current) return
      index = Math.max(0, Math.min(index, totalRef.current - 1))
      const { rowHeight, gap, columns, contentTop, viewportHeight } =
        geometryRef.current
      const top = contentTop + Math.floor(index / columns) * (rowHeight + gap)
      const card = list.querySelector<HTMLElement>(
        `[data-library-index="${index}"] .gameCard, [data-library-index="${index}"] .gameListItem`
      )
      // Jump directly for distant targets. Smoothly traversing every intermediate
      // row would make going to the end mount and fetch the entire collection.
      if (
        !card ||
        top < root.scrollTop - viewportHeight ||
        top > root.scrollTop + viewportHeight * 2
      ) {
        pendingFocus.current = index
        setPinnedIndex(index)
        root.scrollTo({ top: Math.max(0, top - 6), behavior: 'instant' })
        updateRange()
      } else {
        card.focus({ preventScroll: true })
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    [updateRange]
  )

  useLayoutEffect(() => {
    if (!enabled) {
      setRange({ start: 0, end: total })
      return
    }
    const list = listRef.current
    const root = list?.closest<HTMLElement>('#games-scroll-area')
    if (!list || !root) return
    scrollRef.current = root
    pendingFocus.current = null
    setPinnedIndex(null)
    // A new filter/order starts at the beginning; normal metadata changes do not.
    root.scrollTop = 0
    const measure = () => {
      const cell = list.querySelector<HTMLElement>(
        '[data-library-index]:not([data-library-pinned])'
      )
      if (!cell) {
        setRange({ start: 0, end: Math.min(1, totalRef.current) })
        return
      }
      const style = getComputedStyle(list)
      const widths =
        layout === 'grid'
          ? (style.gridTemplateColumns.match(/[\d.]+px/g) ?? [])
          : []
      const headerHeight =
        list.querySelector<HTMLElement>('.gameListHeader')?.offsetHeight ?? 0
      const next: Geometry = {
        columns: Math.max(1, widths.length),
        columnWidth:
          layout === 'grid'
            ? parseFloat(widths[0]) || cell.offsetWidth
            : cell.offsetWidth,
        columnGap: parseFloat(style.columnGap) || 0,
        rowHeight: cell.getBoundingClientRect().height,
        gap: parseFloat(style.rowGap) || 0,
        paddingLeft: parseFloat(style.paddingLeft) || 0,
        paddingTop: parseFloat(style.paddingTop) || 0,
        contentTop:
          list.getBoundingClientRect().top -
          root.getBoundingClientRect().top +
          root.scrollTop +
          (parseFloat(style.paddingTop) || 0) +
          headerHeight,
        headerHeight,
        viewportHeight: root.clientHeight
      }
      geometryRef.current = next
      setGeometry((current) =>
        (Object.keys(next) as Array<keyof Geometry>).every(
          (key) => current[key] === next[key]
        )
          ? current
          : next
      )
      updateRange()
    }
    let frame = 0
    const scheduleRange = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        updateRange()
      })
    }
    const pinInteraction = (event: Event) => {
      const cell = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-library-index]'
      )
      if (cell) setPinnedIndex(Number(cell.dataset.libraryIndex))
    }
    const goToEnd = (event: Event) => {
      event.preventDefault()
      focusIndex(totalRef.current - 1)
    }
    const goToStart = (event: Event) => {
      event.preventDefault()
      focusIndex(0)
    }
    const navigate = (event: KeyboardEvent) => {
      navigateVirtualLibrary(event)
    }
    measure()
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(root)
    observer?.observe(list)
    root.addEventListener('scroll', scheduleRange, { passive: true })
    list.addEventListener('focusin', pinInteraction)
    list.addEventListener('pointerdown', pinInteraction)
    list.addEventListener('keydown', navigate)
    root.addEventListener(LIBRARY_GO_TO_END_EVENT, goToEnd)
    root.addEventListener(LIBRARY_GO_TO_START_EVENT, goToStart)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
      root.removeEventListener('scroll', scheduleRange)
      list.removeEventListener('focusin', pinInteraction)
      list.removeEventListener('pointerdown', pinInteraction)
      list.removeEventListener('keydown', navigate)
      root.removeEventListener(LIBRARY_GO_TO_END_EVENT, goToEnd)
      root.removeEventListener(LIBRARY_GO_TO_START_EVENT, goToStart)
      window.removeEventListener('resize', measure)
      scrollRef.current = null
    }
  }, [enabled, collectionKey, layout, focusIndex, updateRange])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!enabled || !list) return
    return registerLibraryNavigation(list, {
      total,
      columns: geometry.columns,
      pageRows: Math.max(
        1,
        Math.floor(
          geometry.viewportHeight / Math.max(1, geometry.rowHeight + geometry.gap)
        )
      ),
      focus: focusIndex
    })
  }, [enabled, total, geometry, focusIndex])

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return
    const index = pendingFocus.current
    const card = listRef.current?.querySelector<HTMLElement>(
      `[data-library-index="${index}"] .gameCard, [data-library-index="${index}"] .gameListItem`
    )
    if (card) {
      pendingFocus.current = null
      card.focus({ preventScroll: true })
    }
  }, [range, pinnedIndex])

  const start = enabled ? Math.min(range.start, total) : 0
  const end = enabled ? Math.min(range.end, total) : total
  const stride = geometry.rowHeight + geometry.gap
  const firstRow = Math.floor(start / geometry.columns)
  const lastRow = Math.ceil(end / geometry.columns)
  const totalRows = Math.ceil(total / geometry.columns)
  return {
    listRef,
    start,
    end,
    topSpace: enabled ? Math.max(0, firstRow * stride - geometry.gap) : 0,
    bottomSpace: enabled
      ? Math.max(0, (totalRows - lastRow) * stride - geometry.gap)
      : 0,
    pinnedIndex:
      enabled &&
      pinnedIndex !== null &&
      pinnedIndex < total &&
      (pinnedIndex < start || pinnedIndex >= end)
        ? pinnedIndex
        : null,
    pinnedStyle: {
      position: 'absolute' as const,
      top:
        geometry.paddingTop +
        geometry.headerHeight +
        Math.floor((pinnedIndex ?? 0) / geometry.columns) * stride,
      left:
        geometry.paddingLeft +
        ((pinnedIndex ?? 0) % geometry.columns) *
          (geometry.columnWidth + geometry.columnGap),
      width: geometry.columnWidth,
      height: geometry.rowHeight
    }
  }
}
