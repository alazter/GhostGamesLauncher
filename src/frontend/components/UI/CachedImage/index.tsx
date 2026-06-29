import React, { useEffect, useState, useRef } from 'react'
import classNames from 'classnames'

interface CachedImageProps {
  src: string
  fallback?: string
  className?: string
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
}

type Props = React.ImgHTMLAttributes<HTMLImageElement> & CachedImageProps

const shouldCache = (src?: string) => {
  if (!src) return false
  if (src.startsWith('data:')) return false
  if (src.startsWith('imagecache://')) return false
  if (src.startsWith('http://') || src.startsWith('https://')) return true
  if (/^[a-zA-Z]:[\\/]/.test(src)) return true
  if (src.startsWith('/') && !src.startsWith('/src/') && !src.startsWith('/assets/')) return true
  return false
}

const CachedImage = (props: Props) => {
  const [loaded, setLoaded] = useState(false)
  const [displaySrc, setDisplaySrc] = useState<string | undefined>(undefined)
  const activeLoadRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    
    const getTargetSrc = (sourceUrl: string | undefined, fallbackUrl: string | undefined) => {
      if (!sourceUrl) return fallbackUrl || ''
      const cacheEnabled = shouldCache(sourceUrl)
      return cacheEnabled ? `imagecache://localhost/${encodeURIComponent(sourceUrl)}` : sourceUrl
    }

    const primaryTarget = getTargetSrc(props.src, props.fallback)
    activeLoadRef.current = primaryTarget

    // If we don't have a displaySrc yet (initial mount), set it immediately to avoid blank space
    if (!displaySrc) {
      setDisplaySrc(primaryTarget || props.fallback)
    }

    if (primaryTarget) {
      setLoaded(false)
      const img = new Image()
      img.src = primaryTarget
      img.onload = () => {
        if (!active || activeLoadRef.current !== primaryTarget) return
        setDisplaySrc(primaryTarget)
        setLoaded(true)
      }
      img.onerror = () => {
        if (!active || activeLoadRef.current !== primaryTarget) return
        // Try fallback
        if (props.fallback && primaryTarget !== props.fallback) {
          const fallbackTarget = getTargetSrc(props.fallback, undefined)
          const fallbackImg = new Image()
          fallbackImg.src = fallbackTarget
          fallbackImg.onload = () => {
            if (!active || activeLoadRef.current !== primaryTarget) return
            setDisplaySrc(fallbackTarget)
            setLoaded(true)
          }
          fallbackImg.onerror = () => {
            if (!active || activeLoadRef.current !== primaryTarget) return
            setDisplaySrc(props.fallback)
            setLoaded(true)
          }
        } else {
          setDisplaySrc(props.fallback)
          setLoaded(true)
        }
      }
    } else {
      setDisplaySrc(props.fallback)
      setLoaded(true)
    }

    return () => {
      active = false
    }
  }, [props.src, props.fallback])

  // Omit src, onLoad, onError, loading from rest props to avoid conflicts
  const { src: _src, onLoad: _onLoad, onError: _onError, loading: _loading, ...rest } = props

  return (
    <img
      loading="eager"
      {...rest}
      src={displaySrc}
      className={classNames(props.className, {
        loaded,
        loading: !loaded
      })}
    />
  )
}

export default CachedImage
