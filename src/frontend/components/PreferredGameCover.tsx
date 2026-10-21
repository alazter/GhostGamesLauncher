import { useEffect, useId, useState, type ComponentProps } from 'react'
import type { GhostSearchResult } from 'common/types/plugins'
import { useExternalGameCover } from 'frontend/hooks/useExternalGameCover'
import CachedImage from './UI/CachedImage'

type Props = Omit<ComponentProps<typeof CachedImage>, 'src' | 'fallback'> & {
  game: GhostSearchResult
  sources?: GhostSearchResult[]
  placeholder: string
}

/** Preserve the original img element and its geometry; resolve only nearby covers. */
export default function PreferredGameCover({
  game,
  sources,
  placeholder,
  onError,
  ...props
}: Props) {
  const id = useId()
  const [visible, setVisible] = useState(props.loading === 'eager')
  const { cover, rejectCover } = useExternalGameCover(game, sources, visible)
  useEffect(() => {
    if (visible) return
    const image = document.querySelector(`[data-external-cover-id="${id}"]`)
    if (!image) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '150px' }
    )
    observer.observe(image)
    return () => observer.disconnect()
  }, [id, visible, cover])
  return (
    <CachedImage
      key={cover || placeholder}
      {...props}
      data-external-cover-id={id}
      src={cover || placeholder}
      hideOnError={false}
      onError={(event) => {
        if (cover) rejectCover()
        onError?.(event)
      }}
    />
  )
}
