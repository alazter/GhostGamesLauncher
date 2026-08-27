import React, { useEffect, useState, useMemo } from 'react'
import classNames from 'classnames'

interface CachedImageProps {
  src: string
  fallback?: string | string[]
  hideOnError?: boolean
  className?: string
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
}

type Props = React.ImgHTMLAttributes<HTMLImageElement> & CachedImageProps

// Set of URLs that have already loaded once during this session.
// This prevents repeating the fade-in transition when re-rendering cards.
const loadedUrls = new Set<string>()

// Set of URLs that are known to have failed to load during this session.
// Prevents retrying broken URLs and eliminates any flickering.
const failedUrls = new Set<string>()

const shouldCache = (src?: string) => {
  if (!src) return false
  if (src.startsWith('data:')) return false
  if (src.startsWith('imagecache://')) return false
  if (src.startsWith('http://') || src.startsWith('https://')) return true
  if (/^[a-zA-Z]:[\\/]/.test(src)) return true
  if (src.startsWith('/') && !src.startsWith('/src/') && !src.startsWith('/assets/')) return true
  return false
}

const getTargetSrc = (sourceUrl: string | undefined) => {
  if (!sourceUrl) return ''
  const cacheEnabled = shouldCache(sourceUrl)
  return cacheEnabled ? `imagecache://localhost/${encodeURIComponent(sourceUrl)}` : sourceUrl
}

const CachedImage = (props: Props) => {
  const fallbackList = useMemo(() => {
    if (!props.fallback) return []
    const list = Array.isArray(props.fallback) ? props.fallback : [props.fallback]
    return list.filter((url): url is string => Boolean(url) && typeof url === 'string')
  }, [props.fallback])

  const targetSrc = getTargetSrc(props.src)

  // Find the first candidate that hasn't previously failed
  const initialCandidateIndex = useMemo(() => {
    if (targetSrc && !failedUrls.has(targetSrc)) return -1
    for (let i = 0; i < fallbackList.length; i++) {
      const candidate = getTargetSrc(fallbackList[i])
      if (!failedUrls.has(candidate)) return i
    }
    return fallbackList.length
  }, [targetSrc, fallbackList])

  const [fallbackIndex, setFallbackIndex] = useState<number>(initialCandidateIndex)
  const [failed, setFailed] = useState<boolean>(
    initialCandidateIndex >= fallbackList.length && targetSrc !== ''
  )

  // Reset candidate index ONLY when props.src or fallbackList changes
  useEffect(() => {
    const isPrimaryFailed = targetSrc ? failedUrls.has(targetSrc) : false
    if (!isPrimaryFailed && targetSrc) {
      setFallbackIndex(-1)
      setFailed(false)
    } else {
      let found = false
      for (let i = 0; i < fallbackList.length; i++) {
        const candidate = getTargetSrc(fallbackList[i])
        if (!failedUrls.has(candidate)) {
          setFallbackIndex(i)
          setFailed(false)
          found = true
          break
        }
      }
      if (!found) {
        setFallbackIndex(fallbackList.length)
        setFailed(true)
      }
    }
  }, [targetSrc, fallbackList])

  const displayCandidate =
    fallbackIndex === -1 ? targetSrc : fallbackList[fallbackIndex] || ''
  const displaySrc =
    fallbackIndex === -1 ? displayCandidate : getTargetSrc(displayCandidate)

  const isAlreadyLoaded = displaySrc ? loadedUrls.has(displaySrc) : false
  const [loaded, setLoaded] = useState<boolean>(isAlreadyLoaded)

  useEffect(() => {
    const nextLoaded = displaySrc ? loadedUrls.has(displaySrc) : false
    setLoaded(nextLoaded)
  }, [displaySrc])

  if (
    failed ||
    (!displaySrc && props.hideOnError) ||
    (fallbackIndex >= 0 && props.hideOnError)
  ) {
    return null
  }

  const {
    src: _src,
    fallback: _fallback,
    hideOnError: _hideOnError,
    onLoad: _onLoad,
    onError: _onError,
    loading = 'lazy',
    ...rest
  } = props

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
        if (displaySrc) {
          failedUrls.add(displaySrc)
        }

        if (props.hideOnError) {
          setFailed(true)
          props.onError?.(e)
          return
        }

        // Advance to next fallback
        const nextIndex = fallbackIndex + 1
        if (nextIndex < fallbackList.length) {
          setFallbackIndex(nextIndex)
        } else {
          setFailed(true)
          props.onError?.(e)
        }
      }}
      className={classNames(props.className, {
        loaded: loaded || isAlreadyLoaded,
        loading: !loaded && !isAlreadyLoaded && !failed
      })}
    />
  )
}

export default CachedImage
