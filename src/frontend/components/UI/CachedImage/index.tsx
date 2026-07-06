import React, { useEffect, useState } from 'react'
import classNames from 'classnames'

interface CachedImageProps {
  src: string
  fallback?: string
  className?: string
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
}

type Props = React.ImgHTMLAttributes<HTMLImageElement> & CachedImageProps

// Set of URLs that have already loaded once during this session.
// This prevents repeating the 500ms fade-in transition when switching screens or re-rendering cards.
const loadedUrls = new Set<string>()

const shouldCache = (src?: string) => {
  if (!src) return false
  if (src.startsWith('data:')) return false
  if (src.startsWith('imagecache://')) return false
  if (src.startsWith('http://') || src.startsWith('https://')) return true
  if (/^[a-zA-Z]:[\\/]/.test(src)) return true
  if (src.startsWith('/') && !src.startsWith('/src/') && !src.startsWith('/assets/')) return true
  return false
}

const getTargetSrc = (sourceUrl: string | undefined, fallbackUrl: string | undefined) => {
  if (!sourceUrl) return fallbackUrl || ''
  const cacheEnabled = shouldCache(sourceUrl)
  return cacheEnabled ? `imagecache://localhost/${encodeURIComponent(sourceUrl)}` : sourceUrl
}

const CachedImage = (props: Props) => {
  const [error, setError] = useState(false)

  const displaySrc = error ? (props.fallback || '') : getTargetSrc(props.src, props.fallback)
  const isAlreadyLoaded = displaySrc ? loadedUrls.has(displaySrc) : false

  const [loaded, setLoaded] = useState(isAlreadyLoaded)

  // Reset state when source changes
  useEffect(() => {
    const nextLoaded = displaySrc ? loadedUrls.has(displaySrc) : false
    if (loaded !== nextLoaded) {
      setLoaded(nextLoaded)
    }
    if (error) {
      setError(false)
    }
  }, [props.src, displaySrc, loaded, error])

  const { src: _src, onLoad: _onLoad, onError: _onError, loading = 'lazy', ...rest } = props

  return (
    <img
      loading={loading}
      {...rest}
      src={displaySrc}
      onLoad={(e) => {
        if (displaySrc) {
          loadedUrls.add(displaySrc)
        }
        setLoaded(true)
        props.onLoad?.(e)
      }}
      onError={(e) => {
        if (!error && props.fallback) {
          setError(true)
        } else {
          props.onError?.(e)
        }
      }}
      className={classNames(props.className, {
        loaded: loaded || isAlreadyLoaded,
        loading: !loaded && !isAlreadyLoaded && !error
      })}
    />
  )
}

export default CachedImage
