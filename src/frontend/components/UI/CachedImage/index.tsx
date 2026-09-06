import React, { useEffect, useState, useMemo, useRef } from 'react'
import classNames from 'classnames'
import { observeImageVisibility } from 'frontend/helpers/imageVisibilityObserver'

const PLACEHOLDER_SRC = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="173" height="275"></svg>'

interface CachedImageProps {
  src: string
  fallback?: string | string[]
  hideOnError?: boolean
  className?: string
  priority?: boolean
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
  const [reconnectCount, setReconnectCount] = useState<number>(0)

  // Reset candidate index when props.src changes
  useEffect(() => {
    setFallbackIndex(-1)
    setErrorHidden(false)
    setReconnectCount(0)
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

  const isEager = props.loading === 'eager' || Boolean(props.priority) || isAlreadyLoaded
  const [isInView, setIsInView] = useState<boolean>(() => Boolean(isEager))
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (isEager) {
      setIsInView(true)
      return
    }

    if (isInView) return

    const el = imgRef.current
    if (!el) return

    return observeImageVisibility(el, () => {
      setIsInView(true)
    })
  }, [isEager, isInView])

  // Ouvinte do comando global de Reconectar Capas Pendentes
  useEffect(() => {
    const handleReconnect = () => {
      // Reconecta EXCLUSIVAMENTE capas que ainda NÃO carregaram
      if (!loaded && !isAlreadyLoaded) {
        setFallbackIndex(-1)
        setErrorHidden(false)
        setIsInView(true)
        setReconnectCount((c) => c + 1)
      }
    }

    window.addEventListener('heroicReconnectPendingCovers', handleReconnect)
    return () =>
      window.removeEventListener('heroicReconnectPendingCovers', handleReconnect)
  }, [loaded, isAlreadyLoaded])

  if (errorHidden || (!displaySrc && props.hideOnError)) {
    return null
  }

  const {
    src: _src,
    fallback: _fallback,
    hideOnError: _hideOnError,
    onLoad: _onLoad,
    onError: _onError,
    loading: _loading,
    decoding = 'async',
    priority: _priority,
    ...rest
  } = props

  const finalSrc = isInView
    ? reconnectCount > 0 && displaySrc
      ? `${displaySrc}${displaySrc.includes('?') ? '&' : '?'}reconnect=${reconnectCount}`
      : displaySrc
    : PLACEHOLDER_SRC

  return (
    <img
      ref={imgRef}
      loading={props.loading || (isEager ? 'eager' : 'lazy')}
      decoding={decoding}
      {...rest}
      src={finalSrc}
      onLoad={(e) => {
        if (isInView && displaySrc) {
          loadedUrls.add(displaySrc)
          setLoaded(true)
        }
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
