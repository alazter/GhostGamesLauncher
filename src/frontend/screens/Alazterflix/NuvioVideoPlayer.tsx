import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import './nuvioPlayer.scss'
import { sanitizeSubtitleHtml } from 'common/subtitleEngine'
import {
  formatNuvioClock,
  hexToRgba,
  loadNuvioPlayerPreferences,
  loadNuvioSkipSegments,
  NuvioPlayerPreferences,
  NuvioResizeMode,
  NuvioSkipSegment,
  parseTimeInputToSeconds,
  saveNuvioPlayerPreferences,
  saveNuvioSkipSegment,
  setPreferredVideoPlayer
} from './nuvioPlayerConfig'

export interface NuvioSubtitleTrack {
  id?: string
  url: string
  lang: string
  label: string
  format?: string
  addonName?: string
}

export interface NuvioAudioTrack {
  index: number
  codec: string
  language: string
  title: string
  channels?: number
}

export interface NuvioVideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>
  movie: any
  videoSrc: string
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  isBuffering: boolean
  setIsBuffering: (buffering: boolean) => void
  onClose: () => void
  onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void
  onEnded: () => void
  onError: () => void
  isTranscoding: boolean
  streamStartTime: number
  trueDuration: number
  onSeekTranscode: (targetSeconds: number) => void
  audioTracks: NuvioAudioTrack[]
  selectedAudioTrack: number
  onSelectAudioTrack: (trackIndex: number) => void
  subtitlesList: {
    local: NuvioSubtitleTrack[]
    remote: NuvioSubtitleTrack[]
  }
  activeSubtitleUrl: string | null
  onSelectSubtitle: (url: string | null) => void
  onUploadCustomSubtitle: () => void
  activeCueText: string
  subtitleDelay: number
  setSubtitleDelay: React.Dispatch<React.SetStateAction<number>>
  onAdjustSubtitleDelay?: (deltaSeconds: number) => void
  onResetSubtitleDelay?: () => void
  onSyncSubtitles?: (currentTime: number) => void
  onAutoSyncWithCurrentTime?: (currentTime: number) => void
  onApplyFramerateCorrection?: (direction: 'to25' | 'to23976') => void
  currentPlayingShow?: any | null
  nextEpisode?: any | null
  onPlayNextEpisode?: () => void
  onSelectLocalEpisode?: (episodeMovie: any) => void
  onEditEpisode?: (episodeMovie: any) => void
  /* Stremio Session Context */
  stremioItem?: any | null
  stremioMeta?: any | null
  selectedStremioEpisode?: any | null
  availableStreams?: any[]
  isLoadingStreams?: boolean
  onSelectStremioStream?: (stream: any) => void
  onReloadStremioStreams?: () => void
  onSelectStremioEpisode?: (videoEpisode: any) => void
  onSaveMedia?: () => Promise<{ success: boolean; message: string } | void> | void
  isSavingMedia?: boolean
  /* Engine Switch */
  onSwitchToAlazterflixPlayer: () => void
}

const RESIZE_MODES: { id: NuvioResizeMode; label: string }[] = [
  { id: 'fit', label: 'Ajustar (Fit)' },
  { id: 'zoom', label: 'Preencher (Zoom)' },
  { id: 'stretch', label: 'Esticar (Stretch)' },
  { id: 'fill', label: 'Cinema (Fill)' }
]

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const TEXT_COLOR_SWATCHES = [
  '#ffffff',
  '#f5c518',
  '#00e5ff',
  '#4ade80',
  '#fb7185'
]

const OUTLINE_COLOR_SWATCHES = ['#000000', '#1e293b', '#3b0764', '#0f172a']

const BACKGROUND_COLOR_SWATCHES = [
  '#080a10',
  '#000000',
  '#1e293b',
  '#0f172a',
  '#3b0764',
  '#450a0a'
]

const BACKGROUND_OPACITY_PRESETS = [
  { label: '100% Transparente', value: 0 },
  { label: 'Padrão (42%)', value: 42 },
  { label: 'Mais Forte (85%)', value: 85 },
  { label: 'Sólido (100%)', value: 100 }
]

/**
 * Port of Nuvio Desktop's Canvas Bezier Loading Indicator (loading-indicator.js)
 */
const NuvioLoadingCanvas: React.FC<{ size?: number }> = ({ size = 84 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    const start = performance.now()

    const render = (now: number) => {
      const elapsed = (now - start) / 1000
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
        canvas.width = size * dpr
        canvas.height = size * dpr
      }
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, size, size)

      const cx = size / 2
      const cy = size / 2
      const baseRadius = size * 0.31
      const lobes = 6 + Math.floor((elapsed * 0.8) % 3)
      const rot = elapsed * 2.1

      ctx.beginPath()
      const steps = 72
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2
        const wave =
          Math.sin(theta * lobes + elapsed * 4.5) * (size * 0.038) +
          Math.cos(theta * (lobes - 2) - elapsed * 3.2) * (size * 0.022)
        const r = baseRadius + wave
        const x = cx + Math.cos(theta + rot) * r
        const y = cy + Math.sin(theta + rot) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.fill()
      ctx.restore()

      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [size])

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />
}

export const NuvioVideoPlayer: React.FC<NuvioVideoPlayerProps> = ({
  videoRef,
  movie,
  videoSrc,
  isPlaying,
  setIsPlaying,
  isBuffering,
  setIsBuffering,
  onClose,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onError,
  isTranscoding,
  streamStartTime,
  trueDuration,
  onSeekTranscode,
  audioTracks,
  selectedAudioTrack,
  onSelectAudioTrack,
  subtitlesList,
  activeSubtitleUrl,
  onSelectSubtitle,
  onUploadCustomSubtitle,
  activeCueText,
  subtitleDelay,
  setSubtitleDelay,
  onAdjustSubtitleDelay,
  onResetSubtitleDelay,
  onSyncSubtitles,
  onAutoSyncWithCurrentTime,
  onApplyFramerateCorrection,
  currentPlayingShow,
  nextEpisode,
  onPlayNextEpisode,
  onSelectLocalEpisode,
  stremioItem,
  stremioMeta,
  selectedStremioEpisode,
  availableStreams = [],
  isLoadingStreams = false,
  onSelectStremioStream,
  onReloadStremioStreams,
  onSelectStremioEpisode,
  onSaveMedia,
  isSavingMedia = false,
  onSwitchToAlazterflixPlayer
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [prefs, setPrefs] = useState<NuvioPlayerPreferences>(() =>
    loadNuvioPlayerPreferences()
  )
  const [resizeMode, setResizeMode] = useState<NuvioResizeMode>(
    () => loadNuvioPlayerPreferences().defaultResizeMode || 'fit'
  )
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferPercent, setBufferPercent] = useState(0)
  const [volumePercent, setVolumePercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ghost_nuvio_player_volume')
      return saved !== null ? Math.max(0, Math.min(200, Number(saved))) : 100
    } catch {
      return 100
    }
  })
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isHoldSpeedActive, setIsHoldSpeedActive] = useState(false)
  const preHoldSpeedRef = useRef(1)
  const holdTimerRef = useRef<number | null>(null)

  /* Modals: null | 'subtitles' | 'audio' | 'speed' | 'sources' | 'episodes' | 'submitIntro' | 'engineSettings' */
  const [activeModal, setActiveModal] = useState<
    | null
    | 'subtitles'
    | 'audio'
    | 'speed'
    | 'sources'
    | 'episodes'
    | 'submitIntro'
    | 'engineSettings'
  >(null)

  /* Pause & Opening Overlays */
  const [showPauseOverlay, setShowPauseOverlay] = useState(false)
  const [showOpeningOverlay, setShowOpeningOverlay] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const hideControlsTimerRef = useRef<number | null>(null)

  /* Subtitle 3-Rail State */
  const [selectedSubLang, setSelectedSubLang] = useState<string>('all')

  /* Initial Progress Instant Seek Engine */
  const initialSeekDoneRef = useRef(false)
  useEffect(() => {
    initialSeekDoneRef.current = false
  }, [videoSrc])

  const applyInitialSeek = useCallback(
    (video: HTMLVideoElement) => {
      if (movie?.isLiveStream || movie?.mediaCategory === 'tv') {
        return
      }
      if (
        !initialSeekDoneRef.current &&
        !isTranscoding &&
        movie?.initialProgress &&
        movie.initialProgress > 0
      ) {
        initialSeekDoneRef.current = true
        try {
          video.currentTime = movie.initialProgress
          setCurrentTime(movie.initialProgress)
        } catch (err) {
          console.warn('[NuvioVideoPlayer] Erro ao aplicar initialProgress:', err)
        }
      }
    },
    [isTranscoding, movie?.initialProgress]
  )

  useEffect(() => {
    const video = videoRef.current
    if (video && video.readyState >= 1) {
      applyInitialSeek(video)
    }
  }, [videoSrc, movie?.initialProgress, applyInitialSeek])

  /* Ticker Soberano de Legendas em Alta Precisão (60-120 FPS direto no elemento de vídeo) */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let animId: number | null = null
    let active = true

    const tick = () => {
      if (!active) return
      if (!video.paused && !video.ended && onSyncSubtitles) {
        const curTime = isTranscoding
          ? streamStartTime + video.currentTime
          : video.currentTime
        onSyncSubtitles(curTime)
      }
      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)

    const syncImmediate = () => {
      if (onSyncSubtitles) {
        const curTime = isTranscoding
          ? streamStartTime + video.currentTime
          : video.currentTime
        onSyncSubtitles(curTime)
      }
    }

    video.addEventListener('timeupdate', syncImmediate)
    video.addEventListener('seeked', syncImmediate)
    video.addEventListener('seeking', syncImmediate)
    video.addEventListener('play', syncImmediate)
    video.addEventListener('pause', syncImmediate)
    video.addEventListener('ratechange', syncImmediate)

    return () => {
      active = false
      if (animId) cancelAnimationFrame(animId)
      video.removeEventListener('timeupdate', syncImmediate)
      video.removeEventListener('seeked', syncImmediate)
      video.removeEventListener('seeking', syncImmediate)
      video.removeEventListener('play', syncImmediate)
      video.removeEventListener('pause', syncImmediate)
      video.removeEventListener('ratechange', syncImmediate)
    }
  }, [videoRef, isTranscoding, streamStartTime, onSyncSubtitles])

  /* Sources Filter State */
  const [selectedSourceAddon, setSelectedSourceAddon] = useState<string>('all')

  /* Episodes Season Filter State */
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(
    Number(movie?.season || selectedStremioEpisode?.season || 1)
  )

  /* Skip Intro / Recap / Outro Segments */
  const mediaSegmentKey = useMemo(() => {
    if (movie?.stremioId) {
      const epTag =
        selectedStremioEpisode?.season && selectedStremioEpisode?.episode
          ? `:S${selectedStremioEpisode.season}E${selectedStremioEpisode.episode}`
          : ''
      return `${movie.stremioId}${epTag}`
    }
    return String(movie?.id || movie?.filePath || movie?.title || 'default')
  }, [movie, selectedStremioEpisode])

  const [skipSegments, setSkipSegments] = useState<NuvioSkipSegment[]>(() =>
    loadNuvioSkipSegments(mediaSegmentKey)
  )
  const [submitSegType, setSubmitSegType] = useState<
    'intro' | 'recap' | 'outro'
  >('intro')
  const [submitStartInput, setSubmitStartInput] = useState('00:00')
  const [submitEndInput, setSubmitEndInput] = useState('01:25')

  /* Suporte a HLS / M3U8 Live Streaming no Nuvio Video Player */
  const isHlsStream = useMemo(() => {
    if (!videoSrc) return false
    return (
      videoSrc.includes('.m3u8') ||
      movie?.isLiveStream === true ||
      movie?.mediaCategory === 'tv'
    )
  }, [videoSrc, movie?.isLiveStream, movie?.mediaCategory])

  const hlsInstanceRef = useRef<Hls | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) {
      return () => {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy()
          hlsInstanceRef.current = null
        }
      }
    }

    if (isHlsStream && Hls.isSupported()) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy()
        hlsInstanceRef.current = null
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        startLevel: -1,
        autoStartLoad: true
      })

      hls.loadSource(videoSrc)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false)
        if (!movie?.isLiveStream && movie?.mediaCategory !== 'tv') {
          applyInitialSeek(video)
        }
        video.play().catch((playErr) => {
          if (playErr?.name === 'NotAllowedError') {
            video.muted = true
            video.play().catch(() => {})
          }
        })
      })

      let nuvioNetworkRetries = 0
      let nuvioCdnFailoverDone = false
      hls.on(Hls.Events.ERROR, (_event, data) => {
        const errorSummary = `type=${data.type}, details=${data.details}, fatal=${Boolean(data.fatal)}, status=${data.response?.code || (data.response as any)?.status || 'N/A'}, url=${data.context?.url || 'N/A'}`
        console.warn(`[NuvioVideoPlayer] HLS event error: ${errorSummary}`)

        // Failover resiliente de CDN para mirrors conhecidos (ex: cdn10embed <-> cdn13embed)
        if (
          !nuvioCdnFailoverDone &&
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          (videoSrc.includes('cdn10embed.xyz') || videoSrc.includes('cdn13embed.xyz'))
        ) {
          nuvioCdnFailoverDone = true
          const altSrc = videoSrc.includes('cdn10embed.xyz')
            ? videoSrc.replace('cdn10embed.xyz', 'cdn13embed.xyz')
            : videoSrc.replace('cdn13embed.xyz', 'cdn10embed.xyz')
          console.log(`[NuvioVideoPlayer] Alternando para CDN mirror resiliente: ${altSrc}`)
          hls.loadSource(altSrc)
          hls.startLoad()
          return
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              nuvioNetworkRetries++
              if (nuvioNetworkRetries <= 3) {
                hls.startLoad()
              } else {
                console.warn('[NuvioVideoPlayer] Falha fatal HLS persistente. Destruindo e aplicando fallback nativo...')
                hls.destroy()
                hlsInstanceRef.current = null
                video.src = videoSrc
                video.play().catch((err) => {
                  if (err?.name === 'NotAllowedError') {
                    video.muted = true
                    video.play().catch(() => {})
                  }
                })
              }
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              console.warn(`[NuvioVideoPlayer] Erro fatal irrecuperável HLS: ${errorSummary}. Destruindo e aplicando fallback nativo...`)
              hls.destroy()
              hlsInstanceRef.current = null
              video.src = videoSrc
              video.play().catch((err) => {
                if (err?.name === 'NotAllowedError') {
                  video.muted = true
                  video.play().catch(() => {})
                }
              })
              break
          }
        }
      })

      hlsInstanceRef.current = hls
    } else {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy()
        hlsInstanceRef.current = null
      }
      video.src = videoSrc
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy()
        hlsInstanceRef.current = null
      }
    }
  }, [videoSrc, isHlsStream])



  const triggerToast = useCallback((msg: string, durationMs = 2000) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    if (durationMs > 0) {
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage(null)
      }, durationMs)
    }
  }, [])

  const handleSaveStream = useCallback(async () => {
    if (!onSaveMedia) return
    triggerToast('📥 Iniciando salvamento no HD configurado...', 2500)
    try {
      const res = await onSaveMedia()
      if (res && res.message) {
        triggerToast(res.message, 3500)
      } else {
        triggerToast('✅ Download iniciado com sucesso!', 3000)
      }
    } catch (err: any) {
      triggerToast(`❌ Erro ao salvar: ${err?.message || err}`, 3500)
    }
  }, [onSaveMedia, triggerToast])

  const updatePref = useCallback(
    (patch: Partial<NuvioPlayerPreferences>) => {
      const updated = saveNuvioPlayerPreferences(patch)
      setPrefs(updated)
      return updated
    },
    []
  )

  useEffect(() => {
    setSkipSegments(loadNuvioSkipSegments(mediaSegmentKey))
  }, [mediaSegmentKey])

  /* Opening Overlay lifecycle */
  useEffect(() => {
    if (!prefs.openingOverlayEnabled || movie?.isLiveStream || movie?.mediaCategory === 'tv') {
      setShowOpeningOverlay(false)
      return
    }
    setShowOpeningOverlay(true)
    const timer = window.setTimeout(() => {
      setShowOpeningOverlay(false)
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [videoSrc, prefs.openingOverlayEnabled])

  useEffect(() => {
    if (currentTime > 1.2 && !isBuffering) {
      setShowOpeningOverlay(false)
    }
  }, [currentTime, isBuffering])

  /* Pause Metadata Overlay lifecycle (shows after 3.2s paused with no open modal) */
  useEffect(() => {
    if (
      !prefs.pauseOverlayEnabled ||
      isPlaying ||
      isBuffering ||
      activeModal !== null ||
      showOpeningOverlay
    ) {
      setShowPauseOverlay(false)
      return
    }
    const timer = window.setTimeout(() => {
      setShowPauseOverlay(true)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [
    prefs.pauseOverlayEnabled,
    isPlaying,
    isBuffering,
    activeModal,
    showOpeningOverlay
  ])

  /* Controls auto-hide on mouse inactivity */
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current)
    }
    setControlsVisible(true)
    if (!isPlaying || activeModal !== null) return
    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, 3200)
  }, [isPlaying, activeModal])

  useEffect(() => {
    scheduleHideControls()
    return () => {
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current)
      }
    }
  }, [isPlaying, activeModal, scheduleHideControls])

  /* Web Audio GainNode Support for 0% - 200% Volume Boost without Silencing */
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const connectedVideoRef = useRef<HTMLMediaElement | null>(null)

  const setupWebAudio = useCallback((video: HTMLMediaElement) => {
    if (!video) return
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass =
          window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtxClass) {
          const ctx = new AudioCtxClass()
          const gain = ctx.createGain()
          gain.connect(ctx.destination)
          audioCtxRef.current = ctx
          gainNodeRef.current = gain
        }
      }

      if (
        audioCtxRef.current &&
        gainNodeRef.current &&
        connectedVideoRef.current !== video
      ) {
        try {
          const source = audioCtxRef.current.createMediaElementSource(video)
          source.connect(gainNodeRef.current)
          connectedVideoRef.current = video
        } catch (e) {
          console.warn('[NuvioPlayer] MediaElementSource connect:', e)
        }
      }

      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
    } catch (err) {
      console.warn('[NuvioPlayer] setupWebAudio error:', err)
    }
  }, [])

  /* Apply Volume (0% - 200% with Boost) cleanly without CORS silencing */
  const applyVolume = useCallback(
    (nextPercent: number, explicitMute?: boolean) => {
      const parsed = Number(nextPercent)
      const clamped = Math.max(
        0,
        Math.min(200, Math.round(isNaN(parsed) ? 100 : parsed))
      )
      const shouldMute =
        explicitMute !== undefined ? explicitMute : clamped === 0

      setVolumePercent(clamped)
      setIsMuted(shouldMute)

      try {
        localStorage.setItem('ghost_nuvio_player_volume', String(clamped))
      } catch {}

      const video = videoRef.current
      if (!video) return

      if (!shouldMute && clamped > 0) {
        setupWebAudio(video)
      }

      video.muted = shouldMute

      if (shouldMute) {
        video.volume = 0
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = 0
        }
      } else if (clamped <= 100) {
        video.volume = Math.max(0.01, clamped / 100)
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = 1.0
        }
      } else {
        video.volume = 1.0
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = clamped / 100
        }
      }
    },
    [videoRef, setupWebAudio]
  )

  /* Ensure video volume is synced upon initial media load */
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      const activeVolume = volumePercent > 0 ? volumePercent : 100
      video.muted = isMuted
      if (isMuted) {
        video.volume = 0
        if (gainNodeRef.current) gainNodeRef.current.gain.value = 0
      } else if (activeVolume <= 100) {
        video.volume = Math.max(0.01, activeVolume / 100)
        if (gainNodeRef.current) gainNodeRef.current.gain.value = 1.0
      } else {
        video.volume = 1.0
        if (gainNodeRef.current) gainNodeRef.current.gain.value = activeVolume / 100
      }
    }
  }, [videoRef, videoSrc, isMuted, volumePercent])

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [videoRef, setIsPlaying])

  const effectiveDuration = useMemo(() => {
    if (trueDuration > 0) return trueDuration
    if (duration > 0 && Number.isFinite(duration)) return duration
    return 0
  }, [trueDuration, duration])

  const seekToSeconds = useCallback(
    (targetSec: number) => {
      const maxDur = effectiveDuration > 0 ? effectiveDuration : 7200
      const clamped = Math.max(0, Math.min(maxDur, targetSec))
      setCurrentTime(clamped)
      if (isTranscoding) {
        onSeekTranscode(clamped)
      } else if (videoRef.current) {
        videoRef.current.currentTime = clamped
      }
    },
    [effectiveDuration, isTranscoding, onSeekTranscode, videoRef]
  )

  const seekRelative = useCallback(
    (deltaSec: number) => {
      seekToSeconds(currentTime + deltaSec)
      triggerToast(
        deltaSec > 0 ? `⏩ +${deltaSec}s` : `⏪ ${deltaSec}s`,
        1100
      )
    },
    [currentTime, seekToSeconds, triggerToast]
  )

  const toggleFullscreen = useCallback(() => {
    const root = containerRef.current
    if (!root) return
    if (!document.fullscreenElement) {
      root.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  const togglePiP = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if ((video as any).requestPictureInPicture) {
        await (video as any).requestPictureInPicture()
      }
    } catch {
      triggerToast('Picture-in-Picture indisponível neste stream')
    }
  }, [videoRef, triggerToast])

  const cycleResizeMode = useCallback(() => {
    const idx = RESIZE_MODES.findIndex((m) => m.id === resizeMode)
    const next = RESIZE_MODES[(idx + 1) % RESIZE_MODES.length]
    setResizeMode(next.id)
    updatePref({ defaultResizeMode: next.id })
    triggerToast(`Modo de Tela: ${next.label}`, 1500)
  }, [resizeMode, updatePref, triggerToast])

  const applyPlaybackSpeed = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed)
      if (videoRef.current) {
        videoRef.current.playbackRate = speed
      }
      triggerToast(`Velocidade: ${speed}x`, 1400)
    },
    [videoRef, triggerToast]
  )

  /* Hold-to-Speed 2x (Spacebar or Pointer hold on video) */
  const startHoldSpeed = useCallback(() => {
    if (!prefs.holdToSpeedEnabled || isHoldSpeedActive || !isPlaying) return
    preHoldSpeedRef.current = playbackSpeed
    const targetBoost = prefs.holdToSpeedValue || 2.0
    setIsHoldSpeedActive(true)
    if (videoRef.current) {
      videoRef.current.playbackRate = targetBoost
    }
    setToastMessage(`⏩ Velocidade ${targetBoost.toFixed(1)}x (Segurando)`)
  }, [
    prefs.holdToSpeedEnabled,
    prefs.holdToSpeedValue,
    isHoldSpeedActive,
    isPlaying,
    playbackSpeed,
    videoRef
  ])

  const stopHoldSpeed = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (!isHoldSpeedActive) return
    setIsHoldSpeedActive(false)
    if (videoRef.current) {
      videoRef.current.playbackRate = preHoldSpeedRef.current
    }
    setToastMessage(null)
  }, [isHoldSpeedActive, videoRef])

  /* Keyboard shortcuts (Space, Arrows, M, F, L, C, Escape) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        if (activeModal) {
          setActiveModal(null)
        } else {
          onClose()
        }
        return
      }

      if (isLocked) {
        if (e.key.toLowerCase() === 'l') {
          setIsLocked(false)
          triggerToast('Controles Desbloqueados')
        }
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        if (e.repeat) {
          startHoldSpeed()
        } else {
          togglePlayPause()
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        seekRelative(10)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seekRelative(-10)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const current = isMuted ? 0 : volumePercent
        const next = Math.min(200, current + 5)
        applyVolume(next, false)
        triggerToast(
          next > 100 ? `Volume Boost: ${next}% 🚀` : `Volume: ${next}%`,
          800
        )
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.max(0, volumePercent - 5)
        applyVolume(next, next === 0)
        triggerToast(
          next > 100 ? `Volume Boost: ${next}% 🚀` : `Volume: ${next}%`,
          800
        )
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        const nextMute = !isMuted
        applyVolume(volumePercent > 0 ? volumePercent : 50, nextMute)
        triggerToast(nextMute ? 'Áudio Silenciado' : 'Áudio Ativado', 1200)
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        cycleResizeMode()
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault()
        const step = e.shiftKey ? -2.0 : -0.2
        if (onAdjustSubtitleDelay) onAdjustSubtitleDelay(step)
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault()
        const step = e.shiftKey ? 2.0 : 0.2
        if (onAdjustSubtitleDelay) onAdjustSubtitleDelay(step)
      } else if (e.key === 's' || e.key === 'S') {
        if (e.shiftKey) {
          e.preventDefault()
          if (onAutoSyncWithCurrentTime) {
            onAutoSyncWithCurrentTime(currentTime)
            triggerToast('⚡ AutoSync Nuvio Reshaped acionado!')
          }
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.shiftKey) {
          e.preventDefault()
          if (onResetSubtitleDelay) {
            onResetSubtitleDelay()
            triggerToast('Sincronia resetada (0.0s)')
          } else {
            setSubtitleDelay(0)
            triggerToast('Sincronia resetada (0.0s)')
          }
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isHoldSpeedActive) {
        stopHoldSpeed()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    activeModal,
    isLocked,
    isHoldSpeedActive,
    volumePercent,
    isMuted,
    onClose,
    togglePlayPause,
    seekRelative,
    applyVolume,
    toggleFullscreen,
    cycleResizeMode,
    startHoldSpeed,
    stopHoldSpeed,
    triggerToast
  ])

  /* All Combined Subtitles & Languages */
  const allSubtitles = useMemo(() => {
    const localItems = (subtitlesList.local || []).map((s, idx) => ({
      ...s,
      id: s.id || `local-${idx}`,
      addonName: s.addonName || 'Embutida / Local'
    }))
    const remoteItems = (subtitlesList.remote || []).map((s, idx) => ({
      ...s,
      id: s.id || `remote-${idx}`,
      addonName: s.addonName || 'Stremio Addon'
    }))
    return [...localItems, ...remoteItems]
  }, [subtitlesList])

  const subtitleLanguages = useMemo(() => {
    const map = new Map<string, number>()
    for (const sub of allSubtitles) {
      const lang = (sub.lang || 'und').toLowerCase()
      map.set(lang, (map.get(lang) || 0) + 1)
    }
    return Array.from(map.entries()).map(([code, count]) => ({
      code,
      label:
        code === 'pt' || code === 'pob' || code === 'por' || code === 'pt-br'
          ? 'Português (Brasil)'
          : code === 'en' || code === 'eng'
            ? 'Inglês (English)'
            : code === 'es' || code === 'spa'
              ? 'Espanhol (Español)'
              : code.toUpperCase(),
      count
    }))
  }, [allSubtitles])

  const filteredSubtitles = useMemo(() => {
    if (selectedSubLang === 'all') return allSubtitles
    return allSubtitles.filter(
      (s) => (s.lang || 'und').toLowerCase() === selectedSubLang
    )
  }, [allSubtitles, selectedSubLang])

  /* Active Skip Segment Detection */
  const activeSkipSegment = useMemo(() => {
    return skipSegments.find(
      (seg) => currentTime >= seg.startSec && currentTime < seg.endSec - 0.5
    )
  }, [skipSegments, currentTime])

  /* Unified Episodes List (supports Local Series & Stremio Series) */
  const unifiedSeasons = useMemo(() => {
    if (currentPlayingShow?.seasons?.length) {
      return currentPlayingShow.seasons.map((s: any) => ({
        seasonNumber: Number(s.seasonNumber || 1),
        episodes: (s.episodes || []).map((ep: any) => ({
          id: ep.id,
          season: Number(ep.season || s.seasonNumber || 1),
          episode: Number(ep.episode || 1),
          title: ep.customTitle || ep.title || `Episódio ${ep.episode || 1}`,
          overview: ep.overview || currentPlayingShow.overview || '',
          thumbnail:
            ep.backdropUrl ||
            ep.coverUrl ||
            currentPlayingShow.backdropUrl ||
            currentPlayingShow.coverUrl ||
            '',
          watched: Boolean(ep.watched),
          rawLocalMovie: ep,
          isStremio: false
        }))
      }))
    }

    if (Array.isArray(stremioMeta?.videos) && stremioMeta.videos.length > 0) {
      const bySeason = new Map<number, any[]>()
      for (const v of stremioMeta.videos) {
        const sNum = Number(v.season ?? 1)
        if (!bySeason.has(sNum)) bySeason.set(sNum, [])
        bySeason.get(sNum)!.push({
          id: v.id,
          season: sNum,
          episode: Number(v.episode ?? v.number ?? 1),
          title: v.title || v.name || `Episódio ${v.episode ?? 1}`,
          overview: v.overview || v.description || stremioMeta.description || '',
          thumbnail:
            v.thumbnail || stremioMeta.background || stremioMeta.poster || '',
          watched: false,
          rawStremioVideo: v,
          isStremio: true
        })
      }
      return Array.from(bySeason.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([seasonNumber, episodes]) => ({
          seasonNumber,
          episodes: episodes.sort((a, b) => a.episode - b.episode)
        }))
    }

    return []
  }, [currentPlayingShow, stremioMeta])

  const activeSeasonEpisodes = useMemo(() => {
    const found = unifiedSeasons.find(
      (s: { seasonNumber: number; episodes: any[] }) =>
        s.seasonNumber === selectedSeasonNum
    )
    return found ? found.episodes : unifiedSeasons[0]?.episodes || []
  }, [unifiedSeasons, selectedSeasonNum])

  /* Stremio Sources Addon Filter */
  const sourceAddons = useMemo(() => {
    const names = new Set<string>()
    for (const s of availableStreams) {
      if (s.addonName) names.add(s.addonName)
    }
    return Array.from(names)
  }, [availableStreams])

  const filteredStreams = useMemo(() => {
    if (selectedSourceAddon === 'all') return availableStreams
    return availableStreams.filter((s) => s.addonName === selectedSourceAddon)
  }, [availableStreams, selectedSourceAddon])

  /* Progress & Time Label */
  const progressPercent = useMemo(() => {
    if (effectiveDuration <= 0) return 0
    return Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100))
  }, [currentTime, effectiveDuration])

  const formattedTimeLabel = useMemo(() => {
    if (prefs.showRemainingTime && effectiveDuration > 0) {
      const rem = Math.max(0, effectiveDuration - currentTime)
      return `-${formatNuvioClock(rem)} / ${formatNuvioClock(effectiveDuration)}`
    }
    return `${formatNuvioClock(currentTime)} / ${formatNuvioClock(effectiveDuration)}`
  }, [prefs.showRemainingTime, currentTime, effectiveDuration])

  /* Subtitle CSS Style */
  const subtitleInlineStyle = useMemo<React.CSSProperties>(() => {
    if (!prefs.customSubtitleStylingEnabled) {
      return {
        fontSize: '28px',
        color: '#ffffff',
        background: 'rgba(0, 0, 0, 0.55)',
        textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)'
      }
    }
    const hex = prefs.subtitleTextColor || '#ffffff'
    const alpha = Math.max(0.2, Math.min(1, (prefs.subtitleTextOpacity || 100) / 100))
    const outline = prefs.subtitleOutlineEnabled
      ? `0 2px 6px ${prefs.subtitleOutlineColor || '#000000'}, 0 0 3px ${prefs.subtitleOutlineColor || '#000000'}`
      : 'none'
    const bgOpacity =
      typeof prefs.subtitleBackgroundOpacity === 'number'
        ? Math.max(0, Math.min(100, prefs.subtitleBackgroundOpacity))
        : 42
    const bgHex = prefs.subtitleBackgroundColor || '#080a10'
    const bg = bgOpacity === 0 ? 'transparent' : hexToRgba(bgHex, bgOpacity / 100)

    return {
      fontSize: `${prefs.subtitleFontSize || 28}px`,
      fontWeight: prefs.subtitleBold ? 800 : 600,
      color: hex,
      opacity: alpha,
      textShadow: outline,
      background: bg
    }
  }, [prefs])

  /* Show Next Episode floating card when in last 45s of episode */
  const showNextEpFloating = useMemo(() => {
    if (!nextEpisode || !prefs.autoPlayNextEpisode) return false
    if (effectiveDuration <= 60) return false
    const remaining = effectiveDuration - currentTime
    return remaining > 2 && remaining <= 45
  }, [nextEpisode, prefs.autoPlayNextEpisode, effectiveDuration, currentTime])

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    onTimeUpdate(e)
    const video = e.currentTarget
    const actualTime = isTranscoding
      ? streamStartTime + video.currentTime
      : video.currentTime
    setCurrentTime(actualTime)

    if (video.buffered && video.buffered.length > 0 && effectiveDuration > 0) {
      const bufEnd = video.buffered.end(video.buffered.length - 1)
      const absBuf = isTranscoding ? streamStartTime + bufEnd : bufEnd
      setBufferPercent(
        Math.max(0, Math.min(100, (absBuf / effectiveDuration) * 100))
      )
    }
  }

  const handleVideoLoadedMetadata = (
    e: React.SyntheticEvent<HTMLVideoElement>
  ) => {
    onLoadedMetadata(e)
    const video = e.currentTarget
    if (!isTranscoding && video.duration && Number.isFinite(video.duration)) {
      setDuration(video.duration)
    }
    applyInitialSeek(video)
    try {
      const activeVolume = volumePercent > 0 ? volumePercent : 100
      video.muted = isMuted
      video.volume = isMuted ? 0 : Math.max(0.01, activeVolume / 100)
    } catch {}
  }

  const handleSaveSegment = () => {
    const startSec = parseTimeInputToSeconds(submitStartInput)
    const endSec = parseTimeInputToSeconds(submitEndInput)
    if (startSec === null || endSec === null || endSec <= startSec) {
      triggerToast('Informe tempos válidos (Fim maior que Início)')
      return
    }
    const updated = saveNuvioSkipSegment(mediaSegmentKey, {
      segmentType: submitSegType,
      startSec,
      endSec
    })
    setSkipSegments(updated)
    setActiveModal(null)
    triggerToast('Segmento salvo no Nuvio Player!')
  }

  const displayTitle =
    movie?.showTitle ||
    currentPlayingShow?.title ||
    stremioMeta?.name ||
    movie?.customTitle ||
    movie?.title ||
    'Reproduzindo no Nuvio Player'

  const displayEpisodeTag = useMemo(() => {
    if (selectedStremioEpisode?.season && selectedStremioEpisode?.episode) {
      const s = String(selectedStremioEpisode.season).padStart(2, '0')
      const e = String(selectedStremioEpisode.episode).padStart(2, '0')
      return `S${s}E${e} • ${selectedStremioEpisode.title || selectedStremioEpisode.name || ''}`
    }
    if (movie?.isSeries || movie?.season || movie?.episode) {
      const s = String(movie.season || 1).padStart(2, '0')
      const e = String(movie.episode || 1).padStart(2, '0')
      const epName = movie.customTitle || movie.title || ''
      return `S${s}E${e}${epName ? ` • ${epName}` : ''}`
    }
    return ''
  }, [movie, selectedStremioEpisode])

  const handleContainerWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (activeModal || isLocked) return
      e.stopPropagation()
      const step = e.deltaY < 0 ? 5 : -5
      const current = isMuted ? 0 : volumePercent
      const next = Math.max(0, Math.min(200, current + step))
      applyVolume(next, next === 0)
      triggerToast(
        next > 100 ? `Volume Boost: ${next}% 🚀` : `Volume: ${next}%`,
        600
      )
    },
    [activeModal, isLocked, isMuted, volumePercent, applyVolume, triggerToast]
  )

  return (
    <div
      ref={containerRef}
      className={`nuvio-player-root ${!controlsVisible && isPlaying ? 'cursor-hidden' : ''}`}
      onMouseMove={scheduleHideControls}
      onWheel={handleContainerWheel}
    >
      {/* Video Surface */}
      <div
        className={`nuvio-video-viewport resize-${resizeMode}`}
        onClick={() => {
          if (isLocked) return
          if (activeModal) {
            setActiveModal(null)
            return
          }
          togglePlayPause()
        }}
        onDoubleClick={() => {
          if (!isLocked) toggleFullscreen()
        }}
        onMouseDown={() => {
          if (isLocked || activeModal) return
          holdTimerRef.current = window.setTimeout(() => {
            startHoldSpeed()
          }, 420)
        }}
        onMouseUp={stopHoldSpeed}
        onMouseLeave={stopHoldSpeed}
      >
        <video
          ref={videoRef}
          src={isHlsStream && Hls.isSupported() ? undefined : videoSrc}
          autoPlay
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false)
            setShowOpeningOverlay(false)
          }}
          onCanPlay={(e) => {
            setIsBuffering(false)
            applyInitialSeek(e.currentTarget)
          }}
          onTimeUpdate={handleVideoTimeUpdate}
          onLoadedMetadata={handleVideoLoadedMetadata}
          onEnded={onEnded}
          onError={onError}
        />
      </div>

      {/* Custom Subtitle Renderer */}
      {activeCueText && (
        <div
          className="nuvio-subtitle-layer"
          style={{
            bottom: `${(prefs.subtitleBottomOffset || 42) + (controlsVisible ? 56 : 0)}px`
          }}
        >
          <div
            className="nuvio-subtitle-cue"
            style={subtitleInlineStyle}
            dangerouslySetInnerHTML={{
              __html: sanitizeSubtitleHtml(activeCueText)
            }}
          />
        </div>
      )}

      {/* Nuvio Pause Metadata Overlay */}
      {showPauseOverlay && !isLocked && (
        <div className="nuvio-pause-overlay">
          <div className="nuvio-pause-card">
            <div className="nuvio-pause-eyebrow">
              {movie?.mediaCategory === 'tv'
                ? '🔴 Transmissão de TV ao Vivo'
                : 'Você está assistindo no Nuvio Player'}
            </div>
            <div className="nuvio-pause-title">{displayTitle}</div>
            {displayEpisodeTag && (
              <div className="nuvio-pause-episode">{displayEpisodeTag}</div>
            )}
            {(movie?.overview || stremioMeta?.description) && (
              <div className="nuvio-pause-description">
                {movie?.overview || stremioMeta?.description}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nuvio Opening Overlay */}
      {showOpeningOverlay && (
        <div className="nuvio-opening-overlay">
          {(movie?.backdropUrl ||
            movie?.coverUrl ||
            stremioMeta?.background) && (
            <div
              className="nuvio-opening-backdrop"
              style={{
                backgroundImage: `url("${movie?.backdropUrl || stremioMeta?.background || movie?.coverUrl}")`
              }}
            />
          )}
          <div className="nuvio-opening-scrim" />
          <div className="nuvio-opening-center">
            <div className="nuvio-opening-title">{displayTitle}</div>
            <NuvioLoadingCanvas size={88} />
            <div className="nuvio-opening-meta">
              <div className="nuvio-opening-status">
                {movie?.isStremioStream
                  ? 'Sincronizando Stream Stremio no Nuvio Engine...'
                  : 'Preparando reprodução de alta fidelidade...'}
              </div>
              <div className="nuvio-opening-progress-bar">
                <div className="nuvio-opening-progress-fill" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip Intro / Recap / Outro Floating Button */}
      {activeSkipSegment && !isLocked && (
        <button
          type="button"
          className="nuvio-skip-prompt"
          onClick={(e) => {
            e.stopPropagation()
            seekToSeconds(activeSkipSegment.endSec)
            triggerToast(
              `Pulando ${
                activeSkipSegment.segmentType === 'intro'
                  ? 'Abertura'
                  : activeSkipSegment.segmentType === 'recap'
                    ? 'Recap'
                    : 'Créditos'
              }`
            )
          }}
        >
          <span>
            {activeSkipSegment.segmentType === 'intro'
              ? '⏭ Pular Abertura'
              : activeSkipSegment.segmentType === 'recap'
                ? '⏭ Pular Recap'
                : '⏭ Pular Créditos'}
          </span>
        </button>
      )}

      {/* Next Episode Floating Card */}
      {showNextEpFloating && nextEpisode && onPlayNextEpisode && !isLocked && (
        <div
          className="nuvio-next-ep-card"
          onClick={(e) => {
            e.stopPropagation()
            onPlayNextEpisode()
          }}
        >
          {(nextEpisode.backdropUrl || nextEpisode.coverUrl) && (
            <img
              className="nuvio-next-ep-thumb"
              src={nextEpisode.backdropUrl || nextEpisode.coverUrl}
              alt={nextEpisode.title}
            />
          )}
          <div className="nuvio-next-ep-body">
            <div className="nuvio-next-ep-eyebrow">Próximo Episódio</div>
            <div className="nuvio-next-ep-title">
              {nextEpisode.customTitle || nextEpisode.title}
            </div>
            <div className="nuvio-next-ep-meta">
              S{String(nextEpisode.season || 1).padStart(2, '0')}E
              {String(nextEpisode.episode || 1).padStart(2, '0')} • Clique para
              iniciar agora
            </div>
          </div>
        </div>
      )}

      {/* Locked Controls Overlay */}
      {isLocked && (
        <div className="nuvio-lock-overlay">
          <button
            type="button"
            className="nuvio-btn nuvio-unlock-btn"
            onClick={() => {
              setIsLocked(false)
              triggerToast('Controles Desbloqueados')
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
            </svg>
            <span>Desbloquear</span>
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="nuvio-player-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Controls Scrim */}
      {!isLocked && (
        <div
          className={`nuvio-controls-scrim ${!controlsVisible && isPlaying && !activeModal ? 'controls-hidden' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              togglePlayPause()
            }
          }}
        >
          {/* Top Bar */}
          <div className="nuvio-top-controls">
            <div className="nuvio-top-left-brand">
              <span className="nuvio-brand-dot" />
              <span className="nuvio-brand-text">Nuvio Media Player</span>
              <span className="nuvio-brand-sub">
                {movie?.mediaCategory === 'tv'
                  ? movie?.tvCurrentProgram
                    ? `🔴 ${movie.title} • ${movie.tvCurrentProgram.title} (${movie.tvCurrentProgram.startFormatted} - ${movie.tvCurrentProgram.stopFormatted})`
                    : `🔴 ${movie.title} • TV AO VIVO`
                  : movie?.isStremioStream
                    ? 'Sessão Stremio'
                    : 'Mídia Local'}
              </span>
            </div>

            <div className="nuvio-top-right-actions">
              {/* Save Stremio Media to Library Button */}
              {movie?.isStremioStream && onSaveMedia && (
                <button
                  type="button"
                  className={`nuvio-btn nuvio-save-stream-pill ${isSavingMedia ? 'saving' : ''}`}
                  title="Salvar este conteúdo do Stremio no HD configurado e catalogar na Biblioteca"
                  disabled={isSavingMedia}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSaveStream()
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="currentColor"
                  >
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                  </svg>
                  <span>{isSavingMedia ? 'Salvando...' : 'Salvar no PC'}</span>
                </button>
              )}

              {/* Switch Player Engine Button */}
              <button
                type="button"
                className="nuvio-btn nuvio-switch-engine-pill"
                title="Escolher Player ou Preferências do Nuvio"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveModal(
                    activeModal === 'engineSettings' ? null : 'engineSettings'
                  )
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
                <span>Player / Opções</span>
              </button>

              {/* Submit Intro / Segment Timestamp Button */}
              <button
                type="button"
                className="nuvio-btn"
                title="Marcar Abertura / Recap / Créditos"
                onClick={(e) => {
                  e.stopPropagation()
                  setSubmitStartInput(formatNuvioClock(currentTime))
                  setSubmitEndInput(formatNuvioClock(currentTime + 85))
                  setActiveModal('submitIntro')
                }}
              >
                <svg viewBox="0 -960 960 960">
                  <path d="M200-120v-680h360l16 80h224v400H520l-16-80H280v280h-80Z" />
                </svg>
              </button>

              {/* Lock Controls */}
              <button
                type="button"
                className="nuvio-btn"
                title="Bloquear Controles (L)"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsLocked(true)
                  triggerToast('Controles Bloqueados')
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                </svg>
              </button>

              {/* Picture-in-Picture */}
              <button
                type="button"
                className="nuvio-btn"
                title="Picture-in-Picture"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePiP()
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" />
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                className="nuvio-btn"
                title="Tela Cheia (F)"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFullscreen()
                }}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>

              {/* Close Player */}
              <button
                type="button"
                className="nuvio-btn"
                title="Fechar Player (Esc)"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Center Controls */}
          <div className="nuvio-center-controls">
            {isBuffering && (
              <div className="nuvio-loading-indicator">
                <NuvioLoadingCanvas size={84} />
              </div>
            )}

            <button
              type="button"
              className="nuvio-btn nuvio-center-btn"
              title="Voltar 10s (Seta Esquerda)"
              onClick={(e) => {
                e.stopPropagation()
                seekRelative(-10)
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </button>

            <button
              type="button"
              className="nuvio-btn nuvio-center-btn play-main"
              title="Reproduzir / Pausar (Espaço)"
              onClick={(e) => {
                e.stopPropagation()
                togglePlayPause()
              }}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="nuvio-btn nuvio-center-btn"
              title="Avançar 10s (Seta Direita)"
              onClick={(e) => {
                e.stopPropagation()
                seekRelative(10)
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
              </svg>
            </button>
          </div>

          {/* Bottom Bar */}
          <div
            className="nuvio-bottom-bar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Metadata & Dynamic Badges */}
            <div className="nuvio-metadata-block">
              <div className="nuvio-meta-title">{displayTitle}</div>
              {displayEpisodeTag && (
                <div className="nuvio-meta-episode">{displayEpisodeTag}</div>
              )}
              {movie?.streamTitle && (
                <div className="nuvio-meta-stream">{movie.streamTitle}</div>
              )}
              {movie?.addonName && (
                <div className="nuvio-meta-provider">
                  Fonte: {movie.addonName}
                </div>
              )}

              <div className="nuvio-player-badges">
                <span className="nuvio-badge badge-accent">Nuvio Engine</span>
                {movie?.isLiveStream || movie?.mediaCategory === 'tv' ? (
                  <span
                    className="nuvio-badge badge-live-stream"
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      border: '1px solid #ef4444',
                      fontWeight: 800
                    }}
                  >
                    🔴 AO VIVO
                  </span>
                ) : (
                  <span className="nuvio-badge">
                    {movie?.isStremioStream
                      ? 'Stremio Addon Stream'
                      : isTranscoding
                        ? 'FFmpeg Live Audio Remux'
                        : 'Direct HTTP 206'}
                  </span>
                )}
                <span className="nuvio-badge">
                  Tela: {resizeMode.toUpperCase()}
                </span>
                {playbackSpeed !== 1 && (
                  <span className="nuvio-badge badge-accent">
                    {playbackSpeed}x
                  </span>
                )}

              </div>
            </div>

            {/* Scrubber */}
            <div className="nuvio-scrub-wrapper">
              <input
                type="range"
                className="nuvio-scrub"
                min={0}
                max={effectiveDuration > 0 ? effectiveDuration : 100}
                step={0.1}
                value={currentTime}
                style={
                  {
                    '--progress': `${progressPercent}%`,
                    '--bufferProgress': `${Math.max(progressPercent, bufferPercent)}%`
                  } as React.CSSProperties
                }
                onChange={(e) => seekToSeconds(Number(e.target.value))}
              />
            </div>

            {/* Bottom Controls Row */}
            <div className="nuvio-controls-row">
              {/* Action Pill */}
              <div className="nuvio-action-pill">
                {/* Play/Pause */}
                <button
                  type="button"
                  className="nuvio-btn"
                  title="Play / Pause"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Next Episode */}
                {nextEpisode && onPlayNextEpisode && (
                  <button
                    type="button"
                    className="nuvio-btn"
                    title={`Próximo Episódio: ${nextEpisode.customTitle || nextEpisode.title}`}
                    onClick={onPlayNextEpisode}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                    </svg>
                  </button>
                )}

                {/* Aspect Ratio / Resize Mode */}
                <button
                  type="button"
                  className="nuvio-btn"
                  title="Modo de Preenchimento de Tela (C)"
                  onClick={cycleResizeMode}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z" />
                  </svg>
                </button>

                {/* Playback Speed */}
                <button
                  type="button"
                  className={`nuvio-btn ${activeModal === 'speed' ? 'active-pill' : ''}`}
                  title="Velocidade de Reprodução"
                  onClick={() =>
                    setActiveModal(activeModal === 'speed' ? null : 'speed')
                  }
                >
                  <svg viewBox="0 -960 960 960">
                    <path d="M418-340q24 24 62 23.5t56-27.5l224-336-336 224q-27 18-28.5 55t22.5 61Zm62-460q59 0 113.5 16.5T696-734l-76 48q-33-17-68.5-25.5T480-720q-133 0-226.5 93.5T160-400q0 42 11.5 83t32.5 77h552q23-38 33.5-79t10.5-85q0-36-8.5-70T766-540l48-76q30 47 47.5 100T880-406q1 57-13 109t-41 99q-11 18-30 28t-42 10H206q-23 0-42-10t-30-28q-26-45-40-95.5T80-400q0-83 31.5-155.5t86-127Q252-737 325-768.5T480-800Zm0 313Z" />
                  </svg>
                </button>

                {/* Subtitles (3-Rail Modal) */}
                <button
                  type="button"
                  className={`nuvio-btn ${activeModal === 'subtitles' || activeSubtitleUrl ? 'active-pill' : ''}`}
                  title="Legendas, Sincronia e Estilo (Nuvio 3-Rail)"
                  onClick={() =>
                    setActiveModal(
                      activeModal === 'subtitles' ? null : 'subtitles'
                    )
                  }
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
                  </svg>
                </button>

                {/* Audio Tracks */}
                <button
                  type="button"
                  className={`nuvio-btn ${activeModal === 'audio' ? 'active-pill' : ''}`}
                  title="Faixas de Áudio"
                  onClick={() =>
                    setActiveModal(activeModal === 'audio' ? null : 'audio')
                  }
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                  </svg>
                </button>

                {/* Sources Side Panel */}
                <button
                  type="button"
                  className={`nuvio-btn ${activeModal === 'sources' ? 'active-pill' : ''}`}
                  title="Fontes de Vídeo / Streams Stremio"
                  onClick={() =>
                    setActiveModal(activeModal === 'sources' ? null : 'sources')
                  }
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                  </svg>
                </button>

                {/* Save Stremio Media Button */}
                {movie?.isStremioStream && onSaveMedia && (
                  <button
                    type="button"
                    className={`nuvio-btn ${isSavingMedia ? 'active-pill' : ''}`}
                    title={
                      isSavingMedia
                        ? 'Salvando mídia no HD...'
                        : 'Salvar no PC (Download / Biblioteca)'
                    }
                    disabled={isSavingMedia}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSaveStream()
                    }}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                    </svg>
                  </button>
                )}

                {/* Episodes Side Panel (shown when series episodes exist) */}
                {unifiedSeasons.length > 0 && (
                  <button
                    type="button"
                    className={`nuvio-btn ${activeModal === 'episodes' ? 'active-pill' : ''}`}
                    title="Temporadas e Episódios"
                    onClick={() =>
                      setActiveModal(
                        activeModal === 'episodes' ? null : 'episodes'
                      )
                    }
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Volume (0-200%) & Time Status Pill */}
              <div className="nuvio-playback-status">
                <div className="nuvio-volume-group">
                  <button
                    type="button"
                    className="nuvio-btn"
                    title="Silenciar / Ativar Som (M)"
                    onClick={() => {
                      const nextMute = !isMuted
                      applyVolume(
                        volumePercent > 0 ? volumePercent : 50,
                        nextMute
                      )
                    }}
                  >
                    {isMuted || volumePercent === 0 ? (
                      <svg viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>

                  <input
                    type="range"
                    className="nuvio-volume-slider"
                    min={0}
                    max={200}
                    step={1}
                    value={isMuted ? 0 : volumePercent}
                    style={
                      {
                        '--volProgress': `${(isMuted ? 0 : volumePercent) / 2}%`
                      } as React.CSSProperties
                    }
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      applyVolume(val, val === 0)
                    }}
                  />
                  <span
                    className={`nuvio-vol-boost-badge ${volumePercent > 100 ? 'boosted' : ''}`}
                    title={
                      volumePercent > 100
                        ? 'Audio Boost ativo (amplificação até 200%)'
                        : 'Volume normal'
                    }
                  >
                    {isMuted
                      ? '0%'
                      : volumePercent > 100
                        ? `🔥 ${volumePercent}%`
                        : `${volumePercent}%`}
                  </span>
                </div>

                <div
                  className="nuvio-time-label"
                  title="Clique para alternar entre tempo decorrido e tempo restante"
                  onClick={() =>
                    updatePref({
                      showRemainingTime: !prefs.showRemainingTime
                    })
                  }
                >
                  {formattedTimeLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALS & SIDE PANELS ==================== */}

      {/* 1. 3-RAIL SUBTITLES MODAL */}
      {activeModal === 'subtitles' && (
        <div
          className="nuvio-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-rail-dialog nuvio-subtitles-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-rail-shell nuvio-subtitles-shell">
              {/* Rail 1: Languages */}
              <section className="nuvio-rail-column">
                <div className="nuvio-rail-header">
                  <div>
                    <div className="nuvio-rail-title">Idiomas</div>
                    <div className="nuvio-rail-subtitle">
                      Filtre legendas locais e Stremio
                    </div>
                  </div>
                </div>

                <div className="nuvio-rail-list">
                  <button
                    type="button"
                    className={`nuvio-rail-option ${!activeSubtitleUrl ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectSubtitle(null)
                      triggerToast('Legendas Desativadas')
                    }}
                  >
                    <div className="nuvio-opt-copy">
                      <div className="nuvio-opt-title">Desativado (Off)</div>
                      <div className="nuvio-opt-subtitle">
                        Ocultar legendas na reprodução
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nuvio-rail-option ${selectedSubLang === 'all' ? 'selected' : ''}`}
                    onClick={() => setSelectedSubLang('all')}
                  >
                    <div className="nuvio-opt-copy">
                      <div className="nuvio-opt-title">Todos os Idiomas</div>
                      <div className="nuvio-opt-subtitle">
                        Exibir todas as faixas disponíveis
                      </div>
                    </div>
                    <span className="nuvio-opt-badge">
                      {allSubtitles.length}
                    </span>
                  </button>

                  {subtitleLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`nuvio-rail-option ${selectedSubLang === lang.code ? 'selected' : ''}`}
                      onClick={() => setSelectedSubLang(lang.code)}
                    >
                      <div className="nuvio-opt-copy">
                        <div className="nuvio-opt-title">{lang.label}</div>
                        <div className="nuvio-opt-subtitle">
                          Código: {lang.code.toUpperCase()}
                        </div>
                      </div>
                      <span className="nuvio-opt-badge">{lang.count}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="nuvio-pill-btn primary"
                  onClick={onUploadCustomSubtitle}
                >
                  + Carregar Legenda do PC (.SRT / .VTT)
                </button>
              </section>

              {/* Rail 2: Subtitle Tracks */}
              <section className="nuvio-rail-column">
                <div className="nuvio-rail-header">
                  <div>
                    <div className="nuvio-rail-title">Legendas</div>
                    <div className="nuvio-rail-subtitle">
                      Embutidas, locais e addons Stremio
                    </div>
                  </div>
                </div>

                <div className="nuvio-rail-list">
                  {filteredSubtitles.length === 0 ? (
                    <div className="nuvio-style-card">
                      <div className="nuvio-opt-title">
                        Nenhuma legenda encontrada
                      </div>
                      <div className="nuvio-opt-subtitle">
                        Use o botão ao lado para carregar um arquivo .SRT/.VTT
                        do seu computador ou instale addons de legenda no
                        Stremio.
                      </div>
                    </div>
                  ) : (
                    filteredSubtitles.map((sub, i) => {
                      const isSel = activeSubtitleUrl === sub.url
                      return (
                        <button
                          key={sub.id || `${sub.url}-${i}`}
                          type="button"
                          className={`nuvio-rail-option ${isSel ? 'selected' : ''}`}
                          title={sub.label || `Legenda #${i + 1}`}
                          onClick={() => {
                            onSelectSubtitle(sub.url)
                            triggerToast(`Legenda ativada: ${sub.label}`)
                          }}
                        >
                          <div className="nuvio-opt-copy">
                            <div
                              className="nuvio-opt-title"
                              title={sub.label || `Legenda #${i + 1}`}
                            >
                              {sub.label || `Legenda #${i + 1}`}
                            </div>
                            <div className="nuvio-opt-subtitle">
                              {sub.addonName || 'Local / Stremio'} •{' '}
                              {(sub.lang || 'PT').toUpperCase()}
                            </div>
                          </div>
                          {isSel && (
                            <span className="nuvio-opt-badge">Ativa</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </section>

              {/* Rail 3: Style & Delay Synchronization */}
              <section className="nuvio-rail-column">
                <div className="nuvio-rail-header">
                  <div>
                    <div className="nuvio-rail-title">Estilo & Sincronia</div>
                    <div className="nuvio-rail-subtitle">
                      Ajustes em tempo real do Nuvio
                    </div>
                  </div>
                  <button
                    type="button"
                    className="nuvio-btn"
                    onClick={() => setActiveModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="nuvio-style-controls">
                  {/* AutoSync Inteligente (Nuvio Reshaped Style) & Sincronia de Legenda */}
                  <div className="nuvio-style-card nuvio-autosync-card">
                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚡ AutoSync Inteligente</span>
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(0, 229, 255, 0.15)',
                            color: '#00e5ff',
                            border: '1px solid rgba(0, 229, 255, 0.3)',
                            fontWeight: 700,
                            letterSpacing: '0.5px'
                          }}
                        >
                          Nuvio Reshaped
                        </span>
                      </span>
                      <span className="nuvio-style-val">
                        {subtitleDelay >= 0
                          ? `+${subtitleDelay.toFixed(1)}s`
                          : `${subtitleDelay.toFixed(1)}s`}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: '4px 0 8px',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        color: 'rgba(255, 255, 255, 0.6)'
                      }}
                    >
                      Sincroniza automaticamente legendas do SubMaker ou OpenSubtitles com a fala exata do vídeo sem drift (ideal para conteúdo dublado e original).
                    </p>

                    <div className="nuvio-mini-actions" style={{ gap: '6px' }}>
                      <button
                        type="button"
                        className="nuvio-pill-btn primary"
                        style={{ flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}
                        onClick={() => {
                          if (onAutoSyncWithCurrentTime) {
                            onAutoSyncWithCurrentTime(currentTime)
                            triggerToast('⚡ AutoSync acionado!')
                          }
                        }}
                        title="Alinhar fala da legenda com o frame atual (Atalho: Shift + S)"
                      >
                        ⚡ Auto-Alinhar com Fala (Shift+S)
                      </button>
                      <button
                        type="button"
                        className="nuvio-pill-btn"
                        style={{ padding: '7px 10px', fontSize: '11px' }}
                        onClick={() => {
                          if (onResetSubtitleDelay) {
                            onResetSubtitleDelay()
                          } else {
                            setSubtitleDelay(0)
                          }
                          triggerToast('Sincronia redefinida para 0.0s')
                        }}
                        title="Resetar atraso da legenda (Atalho: Shift + R)"
                      >
                        Resetar (0.0s)
                      </button>
                    </div>

                    {/* Saltos Rápidos de Sincronia */}
                    <div className="nuvio-mini-actions" style={{ marginTop: '6px', gap: '4px' }}>
                      <button
                        type="button"
                        className="nuvio-pill-btn"
                        onClick={() => {
                          if (onAdjustSubtitleDelay) onAdjustSubtitleDelay(-0.5)
                          else setSubtitleDelay((d) => Number((d - 0.5).toFixed(1)))
                        }}
                        title="Adiantar legenda em 0.5s"
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        className="nuvio-pill-btn"
                        onClick={() => {
                          if (onAdjustSubtitleDelay) onAdjustSubtitleDelay(-0.2)
                          else setSubtitleDelay((d) => Number((d - 0.2).toFixed(1)))
                        }}
                        title="Adiantar legenda em 0.2s"
                      >
                        -0.2s
                      </button>
                      <button
                        type="button"
                        className="nuvio-pill-btn"
                        onClick={() => {
                          if (onAdjustSubtitleDelay) onAdjustSubtitleDelay(0.2)
                          else setSubtitleDelay((d) => Number((d + 0.2).toFixed(1)))
                        }}
                        title="Atrasar legenda em 0.2s"
                      >
                        +0.2s
                      </button>
                      <button
                        type="button"
                        className="nuvio-pill-btn"
                        onClick={() => {
                          if (onAdjustSubtitleDelay) onAdjustSubtitleDelay(0.5)
                          else setSubtitleDelay((d) => Number((d + 0.5).toFixed(1)))
                        }}
                        title="Atrasar legenda em 0.5s"
                      >
                        +0.5s
                      </button>
                    </div>

                    {onApplyFramerateCorrection && (
                      <div className="nuvio-mini-actions" style={{ marginTop: '6px', gap: '4px' }}>
                        <button
                          type="button"
                          className="nuvio-pill-btn"
                          style={{ flex: 1, fontSize: '10px', padding: '5px' }}
                          onClick={() => {
                            onApplyFramerateCorrection('to25')
                            triggerToast('Compensação 23.98 → 25 fps aplicada')
                          }}
                          title="Ajusta taxa de quadros de 23.976 fps para 25 fps"
                        >
                          23.98 → 25 fps
                        </button>
                        <button
                          type="button"
                          className="nuvio-pill-btn"
                          style={{ flex: 1, fontSize: '10px', padding: '5px' }}
                          onClick={() => {
                            onApplyFramerateCorrection('to23976')
                            triggerToast('Compensação 25 → 23.98 fps aplicada')
                          }}
                          title="Ajusta taxa de quadros de 25 fps para 23.976 fps"
                        >
                          25 → 23.98 fps
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Custom Styling Toggle */}
                  <div className="nuvio-style-card">
                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label">
                        Estilo Customizado Nuvio
                      </span>
                      <button
                        type="button"
                        className={`nuvio-pill-btn ${prefs.customSubtitleStylingEnabled ? 'primary' : ''}`}
                        onClick={() =>
                          updatePref({
                            customSubtitleStylingEnabled:
                              !prefs.customSubtitleStylingEnabled
                          })
                        }
                      >
                        {prefs.customSubtitleStylingEnabled
                          ? 'Ativado'
                          : 'Desativado'}
                      </button>
                    </div>
                  </div>

                  {/* Font Size & Bottom Position */}
                  <div className="nuvio-style-card">
                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label">
                        Tamanho da Fonte
                      </span>
                      <span className="nuvio-style-val">
                        {prefs.subtitleFontSize}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={48}
                      step={1}
                      value={prefs.subtitleFontSize}
                      onChange={(e) =>
                        updatePref({
                          subtitleFontSize: Number(e.target.value)
                        })
                      }
                    />

                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label">
                        Posição Vertical
                      </span>
                      <span className="nuvio-style-val">
                        {prefs.subtitleBottomOffset}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={140}
                      step={2}
                      value={prefs.subtitleBottomOffset}
                      onChange={(e) =>
                        updatePref({
                          subtitleBottomOffset: Number(e.target.value)
                        })
                      }
                    />
                  </div>

                  {/* Colors & Outline */}
                  <div className="nuvio-style-card">
                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label">Cor do Texto</span>
                      <button
                        type="button"
                        className={`nuvio-pill-btn ${prefs.subtitleBold ? 'primary' : ''}`}
                        onClick={() =>
                          updatePref({ subtitleBold: !prefs.subtitleBold })
                        }
                      >
                        Negrito
                      </button>
                    </div>
                    <div className="nuvio-swatch-row">
                      {TEXT_COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`nuvio-swatch ${prefs.subtitleTextColor === color ? 'active' : ''}`}
                          style={{ background: color }}
                          onClick={() =>
                            updatePref({ subtitleTextColor: color })
                          }
                        />
                      ))}
                    </div>

                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label">
                        Contorno (Outline)
                      </span>
                      <button
                        type="button"
                        className={`nuvio-pill-btn ${prefs.subtitleOutlineEnabled ? 'primary' : ''}`}
                        onClick={() =>
                          updatePref({
                            subtitleOutlineEnabled:
                              !prefs.subtitleOutlineEnabled
                          })
                        }
                      >
                        {prefs.subtitleOutlineEnabled ? 'Ativo' : 'Sem Contorno'}
                      </button>
                    </div>
                    <div className="nuvio-swatch-row">
                      {OUTLINE_COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`nuvio-swatch ${prefs.subtitleOutlineColor === color ? 'active' : ''}`}
                          style={{ background: color }}
                          onClick={() =>
                            updatePref({ subtitleOutlineColor: color })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Fundo da Legenda & Transparência (Background & Opacity) */}
                  <div className="nuvio-style-card">
                    <div className="nuvio-style-row">
                      <span className="nuvio-style-label">
                        Transparência do Fundo
                      </span>
                      <span className="nuvio-style-val">
                        {(prefs.subtitleBackgroundOpacity ?? 42) === 0
                          ? '100% Transparente'
                          : (prefs.subtitleBackgroundOpacity ?? 42) === 42
                            ? '42% (Padrão)'
                            : (prefs.subtitleBackgroundOpacity ?? 42) === 85
                              ? '85% (Forte)'
                              : (prefs.subtitleBackgroundOpacity ?? 42) === 100
                                ? '100% (Sólido)'
                                : `${prefs.subtitleBackgroundOpacity ?? 42}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={prefs.subtitleBackgroundOpacity ?? 42}
                      onChange={(e) =>
                        updatePref({
                          subtitleBackgroundOpacity: Number(e.target.value)
                        })
                      }
                    />

                    {/* Presets: 100% Transparente, Padrão 42%, Mais Forte 85%, Sólido 100% */}
                    <div className="nuvio-mini-actions nuvio-opacity-presets">
                      {BACKGROUND_OPACITY_PRESETS.map((preset) => {
                        const currentVal =
                          prefs.subtitleBackgroundOpacity ?? 42
                        const isPresetActive = currentVal === preset.value
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            className={`nuvio-pill-btn ${isPresetActive ? 'primary' : ''}`}
                            onClick={() =>
                              updatePref({
                                subtitleBackgroundOpacity: preset.value
                              })
                            }
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>

                    <div
                      className="nuvio-style-row"
                      style={{ marginTop: '4px' }}
                    >
                      <span className="nuvio-style-label">Cor do Fundo</span>
                      <span
                        className="nuvio-style-val"
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '11px'
                        }}
                      >
                        {prefs.subtitleBackgroundColor || '#080a10'}
                      </span>
                    </div>
                    <div className="nuvio-swatch-row">
                      {BACKGROUND_COLOR_SWATCHES.map((color) => {
                        const isSel =
                          (prefs.subtitleBackgroundColor || '#080a10') === color
                        return (
                          <button
                            key={color}
                            type="button"
                            className={`nuvio-swatch ${isSel ? 'active' : ''}`}
                            style={{ background: color }}
                            title={color}
                            onClick={() => {
                              const curOp =
                                prefs.subtitleBackgroundOpacity ?? 42
                              updatePref({
                                subtitleBackgroundColor: color,
                                subtitleBackgroundOpacity:
                                  curOp === 0 ? 42 : curOp
                              })
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Live Subtitle Preview */}
                  <div className="nuvio-live-preview-box">
                    <div className="nuvio-live-preview-header">
                      <span className="nuvio-live-preview-title">
                        Pré-visualização em Tempo Real
                      </span>
                      <span className="nuvio-live-preview-tag">
                        {(prefs.subtitleBackgroundOpacity ?? 42) === 0
                          ? '100% Transparente'
                          : `Opacidade: ${prefs.subtitleBackgroundOpacity ?? 42}%`}
                      </span>
                    </div>
                    <div className="nuvio-live-preview-stage">
                      <div
                        className="nuvio-subtitle-cue"
                        style={subtitleInlineStyle}
                      >
                        Demon Slayer: Kimetsu no Yaiba
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* 2. AUDIO TRACKS MODAL */}
      {activeModal === 'audio' && (
        <div
          className="nuvio-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-rail-dialog single-rail-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-rail-shell single-column">
              <section className="nuvio-rail-column">
                <div className="nuvio-rail-header">
                  <div>
                    <div className="nuvio-rail-title">Faixas de Áudio</div>
                    <div className="nuvio-rail-subtitle">
                      Selecione o idioma ou canal de áudio
                    </div>
                  </div>
                  <button
                    type="button"
                    className="nuvio-btn"
                    onClick={() => setActiveModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="nuvio-rail-list">
                  {audioTracks.length === 0 ? (
                    <div className="nuvio-rail-option selected">
                      <div className="nuvio-opt-copy">
                        <div className="nuvio-opt-title">
                          Faixa de Áudio Padrão (Principal)
                        </div>
                        <div className="nuvio-opt-subtitle">
                          Reprodução ativa em estéreo / multicanal
                        </div>
                      </div>
                      <span className="nuvio-opt-badge">Ativo</span>
                    </div>
                  ) : (
                    audioTracks.map((track) => {
                      const isSel = selectedAudioTrack === track.index
                      return (
                        <button
                          key={track.index}
                          type="button"
                          className={`nuvio-rail-option ${isSel ? 'selected' : ''}`}
                          onClick={() => {
                            onSelectAudioTrack(track.index)
                            setActiveModal(null)
                            triggerToast(
                              `Áudio alterado: ${track.title || track.language || `Faixa #${track.index + 1}`}`
                            )
                          }}
                        >
                          <div className="nuvio-opt-copy">
                            <div className="nuvio-opt-title">
                              {track.title ||
                                `Faixa de Áudio #${track.index + 1}`}
                            </div>
                            <div className="nuvio-opt-subtitle">
                              Idioma: {(track.language || 'UND').toUpperCase()}{' '}
                              • Codec: {(track.codec || 'AAC').toUpperCase()}
                            </div>
                          </div>
                          {isSel && (
                            <span className="nuvio-opt-badge">Ativo</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* 3. PLAYBACK SPEED MODAL */}
      {activeModal === 'speed' && (
        <div
          className="nuvio-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-rail-dialog single-rail-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-rail-shell single-column">
              <section className="nuvio-rail-column">
                <div className="nuvio-rail-header">
                  <div>
                    <div className="nuvio-rail-title">Velocidade</div>
                    <div className="nuvio-rail-subtitle">
                      Dica: Segure Espaço ou o clique para 2.0x instantâneo
                    </div>
                  </div>
                  <button
                    type="button"
                    className="nuvio-btn"
                    onClick={() => setActiveModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="nuvio-rail-list">
                  {PLAYBACK_SPEEDS.map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      className={`nuvio-rail-option ${playbackSpeed === spd ? 'selected' : ''}`}
                      onClick={() => {
                        applyPlaybackSpeed(spd)
                        setActiveModal(null)
                      }}
                    >
                      <div className="nuvio-opt-copy">
                        <div className="nuvio-opt-title">
                          {spd === 1 ? '1.0x (Normal)' : `${spd}x`}
                        </div>
                      </div>
                      {playbackSpeed === spd && (
                        <span className="nuvio-opt-badge">Ativo</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* 4. SOURCES SIDE PANEL (STREMIO STREAMS & LOCAL FILE INFO) */}
      {activeModal === 'sources' && (
        <div
          className="nuvio-modal-backdrop side-drawer-mode"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-side-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-panel-header">
              <div>
                <div className="nuvio-panel-title">Fontes de Reprodução</div>
                <div className="nuvio-panel-subtitle">
                  {movie?.isStremioStream
                    ? 'Alterne entre streams dos addons Stremio em tempo real'
                    : 'Detalhes da fonte local e motor de decodificação'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {movie?.isStremioStream && onReloadStremioStreams && (
                  <button
                    type="button"
                    className="nuvio-pill-btn"
                    onClick={onReloadStremioStreams}
                  >
                    {isLoadingStreams ? 'Buscando...' : '↻ Recarregar'}
                  </button>
                )}
                <button
                  type="button"
                  className="nuvio-btn"
                  onClick={() => setActiveModal(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {sourceAddons.length > 0 && (
              <div className="nuvio-chip-row">
                <button
                  type="button"
                  className={`nuvio-chip ${selectedSourceAddon === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedSourceAddon('all')}
                >
                  Todos ({availableStreams.length})
                </button>
                {sourceAddons.map((addon) => (
                  <button
                    key={addon}
                    type="button"
                    className={`nuvio-chip ${selectedSourceAddon === addon ? 'active' : ''}`}
                    onClick={() => setSelectedSourceAddon(addon)}
                  >
                    {addon}
                  </button>
                ))}
              </div>
            )}

            <div className="nuvio-panel-scroll">
              {movie?.filePath && (
                <div className="nuvio-source-card selected">
                  <div className="nuvio-source-main">
                    <div className="nuvio-source-title">
                      Arquivo Físico Local •{' '}
                      {isTranscoding
                        ? 'FFmpeg Live Audio Remux'
                        : 'Direct Stream HTTP 206'}
                    </div>
                    <div className="nuvio-source-sub">{movie.filePath}</div>
                  </div>
                  <button
                    type="button"
                    className="nuvio-pill-btn"
                    onClick={() => {
                      ;(window as any).api?.showItemInFolder?.(movie.filePath)
                    }}
                  >
                    Abrir Pasta
                  </button>
                </div>
              )}

              {filteredStreams.map((stream, idx) => {
                const isCurrent =
                  movie?.filePath === stream.url ||
                  movie?.streamUrl === stream.url
                return (
                  <button
                    key={`${stream.addonId || 's'}-${idx}`}
                    type="button"
                    className={`nuvio-source-card ${isCurrent ? 'selected' : ''}`}
                    onClick={() => {
                      if (onSelectStremioStream) {
                        onSelectStremioStream(stream)
                        setActiveModal(null)
                        triggerToast(
                          `Alternando para fonte: ${stream.addonName || stream.name || 'Stream'}`
                        )
                      }
                    }}
                  >
                    <div className="nuvio-source-main">
                      <div className="nuvio-source-title">
                        {stream.name || stream.title || `Stream #${idx + 1}`}
                      </div>
                      <div className="nuvio-source-sub">
                        {stream.description ||
                          stream.title ||
                          stream.addonName ||
                          'Stremio Addon'}
                      </div>
                    </div>
                    <span className="nuvio-opt-badge">
                      {stream.addonName || 'Reproduzir'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. EPISODES SIDE PANEL (LOCAL & STREMIO SERIES) */}
      {activeModal === 'episodes' && (
        <div
          className="nuvio-modal-backdrop side-drawer-mode"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-side-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-panel-header">
              <div>
                <div className="nuvio-panel-title">Episódios</div>
                <div className="nuvio-panel-subtitle">{displayTitle}</div>
              </div>
              <button
                type="button"
                className="nuvio-btn"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="nuvio-chip-row">
              {unifiedSeasons.map((s: { seasonNumber: number }) => (
                <button
                  key={s.seasonNumber}
                  type="button"
                  className={`nuvio-chip ${selectedSeasonNum === s.seasonNumber ? 'active' : ''}`}
                  onClick={() => setSelectedSeasonNum(s.seasonNumber)}
                >
                  {s.seasonNumber === 0
                    ? 'Especiais'
                    : `Temporada ${s.seasonNumber}`}
                </button>
              ))}
            </div>

            <div className="nuvio-panel-scroll">
              {activeSeasonEpisodes.map((ep: any) => {
                const isCurrent =
                  (ep.rawLocalMovie && ep.rawLocalMovie.id === movie?.id) ||
                  (ep.rawStremioVideo &&
                    selectedStremioEpisode?.id === ep.rawStremioVideo.id)
                const shouldBlur =
                  prefs.blurUnwatchedEpisodes && !ep.watched && !isCurrent
                return (
                  <button
                    key={ep.id || `${ep.season}-${ep.episode}`}
                    type="button"
                    className={`nuvio-episode-card ${isCurrent ? 'selected' : ''}`}
                    onClick={() => {
                      if (ep.isStremio && onSelectStremioEpisode) {
                        onSelectStremioEpisode(ep.rawStremioVideo)
                        setActiveModal('sources')
                        triggerToast(
                          `Episódio S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')} selecionado — escolha a fonte`
                        )
                      } else if (!ep.isStremio && onSelectLocalEpisode) {
                        onSelectLocalEpisode(ep.rawLocalMovie)
                        setActiveModal(null)
                      }
                    }}
                  >
                    <div
                      className={`nuvio-ep-thumb-wrap ${shouldBlur ? 'blurred' : ''}`}
                    >
                      {ep.thumbnail ? (
                        <img src={ep.thumbnail} alt={ep.title} />
                      ) : null}
                      <span className="nuvio-ep-badge">
                        S{String(ep.season).padStart(2, '0')}E
                        {String(ep.episode).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="nuvio-ep-body">
                      <div className="nuvio-ep-title">
                        {ep.title}{' '}
                        {isCurrent ? ' • (Reproduzindo Agora)' : ''}
                      </div>
                      {ep.overview && (
                        <div className="nuvio-ep-desc">{ep.overview}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. SUBMIT INTRO / SEGMENT TIMESTAMPS MODAL */}
      {activeModal === 'submitIntro' && (
        <div
          className="nuvio-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-submit-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-panel-header">
              <div>
                <div className="nuvio-panel-title">
                  Marcar Abertura / Créditos
                </div>
                <div className="nuvio-panel-subtitle">
                  O Nuvio Player exibirá o botão de pular automaticamente neste
                  intervalo
                </div>
              </div>
              <button
                type="button"
                className="nuvio-btn"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="nuvio-chip-row">
              {(['intro', 'recap', 'outro'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`nuvio-chip ${submitSegType === type ? 'active' : ''}`}
                  onClick={() => setSubmitSegType(type)}
                >
                  {type === 'intro'
                    ? 'Abertura (Intro)'
                    : type === 'recap'
                      ? 'Resumo (Recap)'
                      : 'Créditos (Outro)'}
                </button>
              ))}
            </div>

            <div className="nuvio-time-grid">
              <div className="nuvio-field-card">
                <label>Início (MM:SS)</label>
                <input
                  type="text"
                  value={submitStartInput}
                  onChange={(e) => setSubmitStartInput(e.target.value)}
                />
                <button
                  type="button"
                  className="nuvio-pill-btn"
                  onClick={() =>
                    setSubmitStartInput(formatNuvioClock(currentTime))
                  }
                >
                  Capturar Tempo Atual ({formatNuvioClock(currentTime)})
                </button>
              </div>

              <div className="nuvio-field-card">
                <label>Fim (MM:SS)</label>
                <input
                  type="text"
                  value={submitEndInput}
                  onChange={(e) => setSubmitEndInput(e.target.value)}
                />
                <button
                  type="button"
                  className="nuvio-pill-btn"
                  onClick={() =>
                    setSubmitEndInput(formatNuvioClock(currentTime))
                  }
                >
                  Capturar Tempo Atual ({formatNuvioClock(currentTime)})
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                type="button"
                className="nuvio-pill-btn"
                onClick={() => setActiveModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="nuvio-pill-btn primary"
                onClick={handleSaveSegment}
              >
                Salvar Segmento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. ENGINE SETTINGS & QUICK PLAYER SWITCHER MODAL */}
      {activeModal === 'engineSettings' && (
        <div
          className="nuvio-modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="nuvio-submit-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuvio-panel-header">
              <div>
                <div className="nuvio-panel-title">
                  Motor de Player & Preferências Nuvio
                </div>
                <div className="nuvio-panel-subtitle">
                  Escolha qual player usar ou ajuste os recursos do Nuvio
                  Desktop
                </div>
              </div>
              <button
                type="button"
                className="nuvio-btn"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="nuvio-style-card">
              <div className="nuvio-style-row">
                <div>
                  <div className="nuvio-opt-title">
                    Alternar para Alazterflix Cyber-Neon Player
                  </div>
                  <div className="nuvio-opt-subtitle">
                    Você pode trocar o player padrão a qualquer momento aqui ou
                    nas Configurações do Plugin
                  </div>
                </div>
                <button
                  type="button"
                  className="nuvio-pill-btn primary"
                  onClick={() => {
                    setPreferredVideoPlayer('alazterflix')
                    onSwitchToAlazterflixPlayer()
                  }}
                >
                  Usar Player Alazterflix
                </button>
              </div>
            </div>

            <div className="nuvio-style-card">
              <div className="nuvio-style-row">
                <span className="nuvio-opt-title">
                  Overlay de Metadados na Pausa
                </span>
                <button
                  type="button"
                  className={`nuvio-pill-btn ${prefs.pauseOverlayEnabled ? 'primary' : ''}`}
                  onClick={() =>
                    updatePref({
                      pauseOverlayEnabled: !prefs.pauseOverlayEnabled
                    })
                  }
                >
                  {prefs.pauseOverlayEnabled ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <div className="nuvio-style-row">
                <span className="nuvio-opt-title">
                  Overlay Cinematográfico de Abertura
                </span>
                <button
                  type="button"
                  className={`nuvio-pill-btn ${prefs.openingOverlayEnabled ? 'primary' : ''}`}
                  onClick={() =>
                    updatePref({
                      openingOverlayEnabled: !prefs.openingOverlayEnabled
                    })
                  }
                >
                  {prefs.openingOverlayEnabled ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <div className="nuvio-style-row">
                <span className="nuvio-opt-title">
                  Segurar Espaço / Clique para Velocidade 2.0x
                </span>
                <button
                  type="button"
                  className={`nuvio-pill-btn ${prefs.holdToSpeedEnabled ? 'primary' : ''}`}
                  onClick={() =>
                    updatePref({
                      holdToSpeedEnabled: !prefs.holdToSpeedEnabled
                    })
                  }
                >
                  {prefs.holdToSpeedEnabled ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <div className="nuvio-style-row">
                <span className="nuvio-opt-title">
                  Desfocar Miniaturas de Episódios Não Assistidos
                </span>
                <button
                  type="button"
                  className={`nuvio-pill-btn ${prefs.blurUnwatchedEpisodes ? 'primary' : ''}`}
                  onClick={() =>
                    updatePref({
                      blurUnwatchedEpisodes: !prefs.blurUnwatchedEpisodes
                    })
                  }
                >
                  {prefs.blurUnwatchedEpisodes ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default NuvioVideoPlayer
