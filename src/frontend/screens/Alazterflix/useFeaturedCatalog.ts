import { useEffect, useMemo, useRef, useState } from 'react'
import type { GhostShow } from 'common/types/plugins'
import {
  emptyFeaturedSelection,
  FEATURED_INTERVAL_MS,
  nextFeaturedSelection
} from './featuredCatalog'

export default function useFeaturedCatalog(
  shows: GhostShow[],
  active: boolean,
  blocked: boolean
) {
  const [selection, setSelection] = useState(emptyFeaturedSelection)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(() => !document.hidden)
  const availableIds = shows.map((show) => show.id).sort()
  const catalogKey = JSON.stringify(availableIds)
  const availableRef = useRef(availableIds)
  availableRef.current = availableIds

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    setHovered(false)
    setFocused(false)
    if (!active) return
    const ids = JSON.parse(catalogKey) as string[]
    setSelection((previous) => nextFeaturedSelection(ids, previous))
  }, [active, catalogKey])

  useEffect(() => {
    if (
      !active ||
      blocked ||
      paused ||
      hovered ||
      focused ||
      !visible ||
      selection.ids.length < 2
    )
      return
    const timer = window.setTimeout(() => {
      setSelection((previous) =>
        previous.index < previous.ids.length - 1
          ? { ...previous, index: previous.index + 1 }
          : nextFeaturedSelection(availableRef.current, previous)
      )
    }, FEATURED_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [active, blocked, paused, hovered, focused, visible, selection])

  const movies = useMemo(() => {
    const byId = new Map(shows.map((show) => [show.id, show.sampleMovie]))
    return selection.ids.map((id) => byId.get(id)).filter((movie) => !!movie)
  }, [shows, selection.ids])

  return {
    movies,
    movie: movies[selection.index] || null,
    index: selection.index,
    paused,
    togglePaused: () => setPaused((previous) => !previous),
    surprise: () => {
      setSelection((previous) =>
        nextFeaturedSelection(availableRef.current, previous)
      )
    },
    select: (index: number) => {
      if (index >= 0 && index < selection.ids.length)
        setSelection((previous) => ({ ...previous, index }))
    },
    setHovered,
    setFocused
  }
}
