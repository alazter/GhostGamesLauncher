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

  const [fallbackIndex, setFallbackIndex] = useState<number>(-1)
  const [errorHidden, setErrorHidden] = useState<boolean>(false)

  // Reset candidate index when props.src changes
  useEffect(() => {
    setFallbackIndex(-1)
    setErrorHidden(false)
  }, [props.src, targetSrc])

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

  if (errorHidden || (!displaySrc && props.hideOnError)) {
    return null
  }

  const {
    src: _src,
    fallback: _fallback,
    hideOnError: _hideOnError,
    onLoad: _onLoad,
    onError: _onError,
    loading = 'eager',
    decoding = 'async',
    ...rest
  } = props

  return (
    <img
      loading={loading}
      decoding={decoding}
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
        if (props.hideOnError) {
          setErrorHidden(true)
          props.onError?.(e)
          return
        }

        const nextIndex = fallbackIndex + 1
        if (nextIndex < fallbackList.length) {
          setFallbackIndex(nextIndex)
        } else {
          props.onError?.(e)
        }
      }}
      className={classNames(props.className, {
        loaded: loaded || isAlreadyLoaded,
        loading: !loaded && !isAlreadyLoaded
      })}
    />
  )
}

export default CachedImage
