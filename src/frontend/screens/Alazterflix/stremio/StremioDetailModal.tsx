import React, { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faCirclePlay,
  faEye,
  faFilm,
  faHardDrive,
  faPlus,
  faRotate,
  faStar,
  faTrashAlt,
  faTv,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import type {
  GhostMovie,
  StremioLibraryItem,
  StremioMetaPreview,
  StremioStreamItem
} from 'common/types/plugins'
import {
  findLocalFilesForEpisode,
  type LocalMediaIndex,
  matchStremioItemToLocal
} from './localMediaMatcher'

export interface StremioModalTarget {
  id: string
  type: string
  name: string
  poster?: string
  background?: string
  year?: string | number
  imdbRating?: string
  description?: string
  releaseInfo?: string
  genres?: string[]
  initialSeason?: number
  initialVideoId?: string
}

interface StremioDetailModalProps {
  target: StremioModalTarget
  libraryItem?: StremioLibraryItem
  localMediaIndex: LocalMediaIndex
  onClose: () => void
  onAddToLibrary: (meta: StremioMetaPreview) => Promise<void>
  onRemoveFromLibrary: (id: string) => Promise<void>
  onToggleWatched: (id: string, isWatched: boolean, videoId?: string) => Promise<void>
  onPlayStream: (
    stream: StremioStreamItem,
    meta: StremioMetaPreview,
    episodeInfo?: { videoId: string; season: number; episode: number; title: string }
  ) => Promise<void> | void
  onPlayLocalMovie: (movie: GhostMovie) => Promise<void> | void
}

interface NormalizedVideo {
  id: string
  season: number
  episode: number
  title: string
  released?: string
  dateKey?: string
  thumbnail?: string
  overview?: string
}

function parseDateKey(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return undefined
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function formatDateBr(dateKey?: string): string {
  if (!dateKey) return ''
  const [y, m, d] = dateKey.split('-')
  if (!y || !m || !d) return dateKey
  return `${d}/${m}/${y}`
}

export default function StremioDetailModal({
  target,
  libraryItem,
  localMediaIndex,
  onClose,
  onAddToLibrary,
  onRemoveFromLibrary,
  onToggleWatched,
  onPlayStream,
  onPlayLocalMovie
}: StremioDetailModalProps) {
  const [meta, setMeta] = useState<StremioMetaPreview | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState<number>(target.initialSeason ?? 1)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    target.initialVideoId || null
  )
  const [streams, setStreams] = useState<StremioStreamItem[]>([])
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [busyLib, setBusyLib] = useState(false)
  const [diskFallbackFile, setDiskFallbackFile] = useState<{
    filePath: string
    fileName: string
    fileSize?: string
    resolution?: string
  } | null>(null)

  const todayKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  const isEpisodic = useMemo(() => {
    const t = (meta?.type || target.type || '').toLowerCase()
    return (
      t === 'series' ||
      t === 'anime' ||
      t === 'tv' ||
      target.id.toLowerCase().startsWith('kitsu:') ||
      (Array.isArray(meta?.videos) && meta.videos.length > 0)
    )
  }, [meta, target])

  useEffect(() => {
    let cancelled = false
    setLoadingMeta(true)
    setMeta(null)
    setStreams([])

    window.api
      .cinemaStremioGetMeta('org.stremio.cinemeta', target.type || 'series', target.id)
      .then((res) => {
        if (cancelled) return
        if (res) {
          setMeta(res as StremioMetaPreview)
        } else {
          setMeta({
            id: target.id,
            type: target.type,
            name: target.name,
            poster: target.poster,
            background: target.background,
            year: target.year,
            imdbRating: target.imdbRating,
            description: target.description,
            releaseInfo: target.releaseInfo,
            genres: target.genres
          })
        }
      })
      .catch(() => {
        if (cancelled) return
        setMeta({
          id: target.id,
          type: target.type,
          name: target.name,
          poster: target.poster,
          background: target.background,
          year: target.year,
          imdbRating: target.imdbRating,
          description: target.description,
          releaseInfo: target.releaseInfo,
          genres: target.genres
        })
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })

    return () => {
      cancelled = true
    }
  }, [target.id, target.type])

  const normalizedVideos = useMemo<NormalizedVideo[]>(() => {
    const raw = Array.isArray(meta?.videos) ? meta.videos : []
    return raw
      .map((v) => {
        const season = Number.isFinite(Number(v.season)) ? Number(v.season) : 1
        const ep = Number.isFinite(Number(v.episode))
          ? Number(v.episode)
          : Number.isFinite(Number(v.number))
            ? Number(v.number)
            : 0
        const released = v.released
        return {
          id: v.id || `${target.id}:${season}:${ep}`,
          season,
          episode: ep,
          title: v.name || v.title || `Episódio ${ep || 1}`,
          released,
          dateKey: parseDateKey(released),
          thumbnail: v.thumbnail,
          overview: v.overview
        }
      })
      .sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season
        return a.episode - b.episode
      })
  }, [meta, target.id])

  const seasons = useMemo(() => {
    const set = new Set<number>()
    for (const v of normalizedVideos) set.add(v.season)
    return Array.from(set).sort((a, b) => {
      if (a === 0) return 1
      if (b === 0) return -1
      return a - b
    })
  }, [normalizedVideos])

  // Select appropriate initial season and video once metadata loads
  useEffect(() => {
    if (!isEpisodic || normalizedVideos.length === 0) return
    if (target.initialVideoId) {
      const found = normalizedVideos.find((v) => v.id === target.initialVideoId)
      if (found) {
        setSelectedSeason(found.season)
        setSelectedVideoId(found.id)
        return
      }
    }
    if (target.initialSeason !== undefined && seasons.includes(target.initialSeason)) {
      setSelectedSeason(target.initialSeason)
    } else if (seasons.length > 0 && !seasons.includes(selectedSeason)) {
      setSelectedSeason(seasons[0])
    }
  }, [normalizedVideos, seasons, isEpisodic, target.initialSeason, target.initialVideoId])

  const seasonEpisodes = useMemo(
    () => normalizedVideos.filter((v) => v.season === selectedSeason),
    [normalizedVideos, selectedSeason]
  )

  const activeEpisode = useMemo(
    () => normalizedVideos.find((v) => v.id === selectedVideoId) || null,
    [normalizedVideos, selectedVideoId]
  )

  // Fetch streams automatically for movies or when an episode is selected
  useEffect(() => {
    if (loadingMeta) return
    const streamTargetId = isEpisodic ? selectedVideoId : target.id
    if (!streamTargetId) {
      setStreams([])
      return
    }

    let cancelled = false
    setLoadingStreams(true)
    setStreams([])

    window.api
      .cinemaStremioGetStreams(meta?.type || target.type || 'movie', streamTargetId)
      .then((res) => {
        if (!cancelled) setStreams(Array.isArray(res) ? res : [])
      })
      .catch(() => {
        if (!cancelled) setStreams([])
      })
      .finally(() => {
        if (!cancelled) setLoadingStreams(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadingMeta, isEpisodic, selectedVideoId, target.id, target.type, meta?.type])

  const displayMeta: StremioMetaPreview = useMemo(
    () => ({
      id: target.id,
      type: meta?.type || target.type || 'movie',
      name: meta?.name || target.name,
      poster: meta?.poster || target.poster,
      background: meta?.background || target.background,
      logo: meta?.logo,
      year: meta?.year || target.year,
      imdbRating: meta?.imdbRating || target.imdbRating,
      releaseInfo: meta?.releaseInfo || target.releaseInfo,
      description: meta?.description || target.description,
      genres: meta?.genres || target.genres
    }),
    [meta, target]
  )

  const localShowMatch = useMemo(
    () =>
      matchStremioItemToLocal(localMediaIndex, {
        id: displayMeta.id,
        type: displayMeta.type,
        name: displayMeta.name,
        year: displayMeta.year,
        releaseInfo: displayMeta.releaseInfo,
        aliases: target.name !== displayMeta.name ? [target.name] : undefined
      }),
    [localMediaIndex, displayMeta, target.name]
  )

  const localFilesForActiveTarget = useMemo<GhostMovie[]>(() => {
    if (!localShowMatch) return []
    if (!isEpisodic) return localShowMatch.movies
    if (!activeEpisode) return []
    return findLocalFilesForEpisode(
      localShowMatch.movies,
      activeEpisode.season,
      activeEpisode.episode
    )
  }, [localShowMatch, isEpisodic, activeEpisode])

  // Fallback disk scan via cinemaFindLocalMedia if not already matched in indexed catalog
  useEffect(() => {
    setDiskFallbackFile(null)
    if (loadingMeta || localFilesForActiveTarget.length > 0) return
    if (isEpisodic && !activeEpisode) return

    let cancelled = false
    window.api
      .cinemaFindLocalMedia({
        title: displayMeta.name,
        season: isEpisodic ? activeEpisode?.season : undefined,
        episode: isEpisodic ? activeEpisode?.episode : undefined,
        year: displayMeta.year ? String(displayMeta.year) : undefined,
        type: isEpisodic
          ? displayMeta.type === 'anime'
            ? 'anime'
            : 'series'
          : 'movie'
      })
      .then((res) => {
        if (!cancelled && res?.exists && res.filePath) {
          setDiskFallbackFile({
            filePath: res.filePath,
            fileName: res.fileName || res.filePath.split(/[\\/]/).pop() || displayMeta.name,
            fileSize: res.fileSize,
            resolution: res.resolution
          })
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [
    loadingMeta,
    localFilesForActiveTarget.length,
    isEpisodic,
    activeEpisode,
    displayMeta.name,
    displayMeta.year,
    displayMeta.type
  ])

  const handlePlayDiskFallback = async () => {
    if (!diskFallbackFile) return
    const syntheticMovie: GhostMovie = {
      id: `local:${diskFallbackFile.filePath}`,
      title: activeEpisode
        ? `${displayMeta.name} - S${String(activeEpisode.season).padStart(2, '0')}E${String(activeEpisode.episode).padStart(2, '0')}`
        : displayMeta.name,
      cleanTitle: displayMeta.name,
      filePath: diskFallbackFile.filePath,
      fileName: diskFallbackFile.fileName,
      fileSize: diskFallbackFile.fileSize || '',
      fileSizeBytes: 0,
      resolution: diskFallbackFile.resolution || 'HD',
      coverUrl: displayMeta.poster,
      backdropUrl: displayMeta.background,
      imdbId: displayMeta.id,
      addedAt: new Date().toISOString(),
      source: 'local',
      isSeries: isEpisodic,
      season: activeEpisode?.season,
      episode: activeEpisode?.episode,
      showTitle: displayMeta.name
    }
    await onPlayLocalMovie(syntheticMovie)
    onClose()
  }

  const inLibrary = Boolean(libraryItem)
  const watchedVideosSet = useMemo(
    () => new Set(libraryItem?.watchedVideos || []),
    [libraryItem?.watchedVideos]
  )

  const handleToggleLibrary = async () => {
    try {
      setBusyLib(true)
      if (inLibrary) {
        await onRemoveFromLibrary(target.id)
      } else {
        await onAddToLibrary(displayMeta)
      }
    } finally {
      setBusyLib(false)
    }
  }

  return (
    <div className="stremio-detail-overlay" onClick={onClose}>
      <div
        className="stremio-detail-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={displayMeta.name}
      >
        <button
          type="button"
          className="stremio-detail-close"
          onClick={onClose}
          title="Fechar"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div
          className="stremio-detail-hero"
          style={
            displayMeta.background
              ? { backgroundImage: `url("${displayMeta.background}")` }
              : undefined
          }
        >
          <div className="stremio-detail-hero-inner">
            {displayMeta.poster ? (
              <img
                src={displayMeta.poster}
                alt={displayMeta.name}
                className="stremio-detail-poster"
              />
            ) : (
              <div
                className="stremio-detail-poster"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 34
                }}
              >
                <FontAwesomeIcon icon={isEpisodic ? faTv : faFilm} />
              </div>
            )}

            <div className="stremio-detail-meta">
              <h2>{displayMeta.name}</h2>
              <div className="meta-pills">
                <span>{isEpisodic ? 'Série / Anime' : 'Filme'}</span>
                {localShowMatch && (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(52, 211, 153, 0.5)',
                      color: '#6ee7b7',
                      fontWeight: 700
                    }}
                  >
                    <FontAwesomeIcon icon={faHardDrive} style={{ marginRight: 5 }} />
                    No PC ({localShowMatch.episodesCount}{' '}
                    {localShowMatch.episodesCount === 1 ? 'arquivo' : 'arquivos'})
                  </span>
                )}
                {(displayMeta.releaseInfo || displayMeta.year) && (
                  <span>{displayMeta.releaseInfo || displayMeta.year}</span>
                )}
                {displayMeta.imdbRating && (
                  <span>
                    <FontAwesomeIcon icon={faStar} style={{ color: '#fbbf24', marginRight: 4 }} />
                    {displayMeta.imdbRating}
                  </span>
                )}
                {displayMeta.genres?.slice(0, 3).map((g) => (
                  <span key={g}>{g}</span>
                ))}
              </div>
              {displayMeta.description && <p>{displayMeta.description}</p>}

              <div className="detail-actions">
                <button
                  type="button"
                  className={inLibrary ? 'stremio-secondary-btn' : 'stremio-primary-btn'}
                  onClick={handleToggleLibrary}
                  disabled={busyLib}
                >
                  <FontAwesomeIcon icon={inLibrary ? faTrashAlt : faPlus} />
                  <span>
                    {inLibrary ? 'Remover da Biblioteca' : 'Adicionar à Biblioteca'}
                  </span>
                </button>

                {inLibrary && (
                  <button
                    type="button"
                    className="stremio-secondary-btn"
                    onClick={() =>
                      onToggleWatched(target.id, !libraryItem?.isWatched)
                    }
                  >
                    <FontAwesomeIcon
                      icon={libraryItem?.isWatched ? faCheck : faEye}
                      style={libraryItem?.isWatched ? { color: '#eab308' } : undefined}
                    />
                    <span>
                      {libraryItem?.isWatched ? 'Assistido' : 'Marcar como Assistido'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`stremio-detail-content ${!isEpisodic ? 'single-col' : ''}`}>
          {isEpisodic && (
            <div className="stremio-episodes-panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <strong style={{ fontSize: 14, color: '#fff' }}>
                  Episódios {normalizedVideos.length > 0 ? `(${normalizedVideos.length})` : ''}
                </strong>
                {loadingMeta && (
                  <span style={{ fontSize: 12, color: 'var(--stremio-purple-soft)' }}>
                    <FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />
                    Carregando episódios...
                  </span>
                )}
              </div>

              {seasons.length > 0 && (
                <div className="stremio-season-chips">
                  {seasons.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`stremio-season-chip ${selectedSeason === s ? 'active' : ''}`}
                      onClick={() => setSelectedSeason(s)}
                    >
                      {s === 0 ? 'Especiais (S0)' : `Temporada ${s}`}
                    </button>
                  ))}
                </div>
              )}

              {!loadingMeta && seasonEpisodes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--stremio-muted)', padding: 12 }}>
                  Nenhum episódio listado pelos addons de metadados para esta série.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {seasonEpisodes.map((ep) => {
                    const isSelected = ep.id === selectedVideoId
                    const epWatched = watchedVideosSet.has(ep.id)
                    const isFuture = Boolean(ep.dateKey && ep.dateKey > todayKey)
                    const thumb = ep.thumbnail || displayMeta.background || displayMeta.poster
                    const epLocalFiles = localShowMatch
                      ? findLocalFilesForEpisode(localShowMatch.movies, ep.season, ep.episode)
                      : []
                    const hasLocalEp = epLocalFiles.length > 0

                    return (
                      <div
                        key={ep.id}
                        className={`stremio-ep-row ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedVideoId(ep.id)}
                      >
                        {thumb ? (
                          <img src={thumb} alt={ep.title} className="ep-thumb" loading="lazy" />
                        ) : (
                          <div
                            className="ep-thumb"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'rgba(255,255,255,0.28)'
                            }}
                          >
                            <FontAwesomeIcon icon={faTv} />
                          </div>
                        )}

                        <div className="ep-meta">
                          <div className="ep-top">
                            <span>
                              S{ep.season}E{ep.episode}
                            </span>
                            {hasLocalEp && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                  background: 'rgba(16, 185, 129, 0.22)',
                                  border: '1px solid rgba(52, 211, 153, 0.5)',
                                  color: '#6ee7b7',
                                  fontWeight: 800
                                }}
                                title={epLocalFiles[0].fileName}
                              >
                                <FontAwesomeIcon icon={faHardDrive} style={{ marginRight: 3 }} />
                                NO PC{epLocalFiles[0].resolution ? ` · ${epLocalFiles[0].resolution}` : ''}
                              </span>
                            )}
                            {isFuture && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                  background: 'rgba(56, 189, 248, 0.18)',
                                  color: '#7dd3fc'
                                }}
                              >
                                Em breve
                              </span>
                            )}
                          </div>
                          <div className="ep-name">{ep.title}</div>
                          {ep.dateKey && (
                            <div className="ep-date">{formatDateBr(ep.dateKey)}</div>
                          )}
                        </div>

                        {inLibrary && (
                          <button
                            type="button"
                            className="stremio-icon-action-btn"
                            style={
                              epWatched
                                ? {
                                    background: 'rgba(234, 179, 8, 0.2)',
                                    borderColor: '#eab308',
                                    color: '#eab308'
                                  }
                                : undefined
                            }
                            title={epWatched ? 'Desmarcar episódio assistido' : 'Marcar episódio como assistido'}
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleWatched(target.id, !epWatched, ep.id)
                            }}
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="stremio-streams-panel">
            <strong style={{ fontSize: 14, color: '#fff' }}>
              {isEpisodic
                ? activeEpisode
                  ? `Streams · S${activeEpisode.season}E${activeEpisode.episode} (${activeEpisode.title})`
                  : 'Selecione um episódio para ver streams'
                : 'Streams Disponíveis nos Addons'}
            </strong>

            {/* LOCAL PC FILES (INSTANT PLAYBACK DIRECTLY FROM DISK) */}
            {(localFilesForActiveTarget.length > 0 || diskFallbackFile) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: '#6ee7b7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <FontAwesomeIcon icon={faHardDrive} />
                  <span>Disponível Localmente no seu PC (Reprodução Instantânea)</span>
                </div>

                {localFilesForActiveTarget.map((localMovie) => (
                  <div
                    key={localMovie.id}
                    className="stremio-stream-row local-file"
                    onClick={async () => {
                      await onPlayLocalMovie(localMovie)
                      onClose()
                    }}
                    title={`Reproduzir arquivo local: ${localMovie.filePath}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '3px 7px',
                          borderRadius: 6,
                          background: 'rgba(16, 185, 129, 0.25)',
                          color: '#6ee7b7',
                          flexShrink: 0
                        }}
                      >
                        {localMovie.resolution || 'LOCAL'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#ecfdf5',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          Arquivo no PC {localMovie.fileSize ? `· ${localMovie.fileSize}` : ''}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: '#a7f3d0',
                            opacity: 0.85,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {localMovie.fileName}
                        </div>
                      </div>
                    </div>
                    <FontAwesomeIcon
                      icon={faCirclePlay}
                      style={{ color: '#34d399', fontSize: 22, flexShrink: 0 }}
                    />
                  </div>
                ))}

                {localFilesForActiveTarget.length === 0 && diskFallbackFile && (
                  <div
                    className="stremio-stream-row local-file"
                    onClick={handlePlayDiskFallback}
                    title={`Reproduzir arquivo local: ${diskFallbackFile.filePath}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '3px 7px',
                          borderRadius: 6,
                          background: 'rgba(16, 185, 129, 0.25)',
                          color: '#6ee7b7',
                          flexShrink: 0
                        }}
                      >
                        {diskFallbackFile.resolution || 'LOCAL'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#ecfdf5',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          Arquivo no PC {diskFallbackFile.fileSize ? `· ${diskFallbackFile.fileSize}` : ''}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: '#a7f3d0',
                            opacity: 0.85,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {diskFallbackFile.fileName}
                        </div>
                      </div>
                    </div>
                    <FontAwesomeIcon
                      icon={faCirclePlay}
                      style={{ color: '#34d399', fontSize: 22, flexShrink: 0 }}
                    />
                  </div>
                )}
              </div>
            )}

            {isEpisodic && !activeEpisode ? (
              <div style={{ fontSize: 12.5, color: 'var(--stremio-muted)', padding: '12px 0' }}>
                Clique em qualquer episódio à esquerda para consultar as fontes nos seus addons do Stremio.
              </div>
            ) : loadingStreams ? (
              <div style={{ fontSize: 13, color: 'var(--stremio-purple-soft)', padding: '14px 0' }}>
                <FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 8 }} />
                Resolvendo streams nos addons ativos...
              </div>
            ) : streams.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--stremio-muted)', padding: '12px 0', lineHeight: 1.5 }}>
                Nenhum stream localizado nos addons ativos para este item. Instale ou habilite addons de stream (ex: Torrentio, MediaFusion, Comet) em <strong>Configurações → Stremio &amp; Addons</strong>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {streams.map((stream, idx) => (
                  <div
                    key={idx}
                    className="stremio-stream-row"
                    onClick={() =>
                      onPlayStream(
                        stream,
                        displayMeta,
                        activeEpisode
                          ? {
                              videoId: activeEpisode.id,
                              season: activeEpisode.season,
                              episode: activeEpisode.episode,
                              title: activeEpisode.title
                            }
                          : undefined
                      )
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '3px 7px',
                          borderRadius: 6,
                          background: 'rgba(0, 229, 255, 0.18)',
                          color: '#bae6fd',
                          flexShrink: 0
                        }}
                      >
                        {stream.quality || 'HD'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {stream.addonName || stream.name || 'Addon Stream'}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--stremio-muted)',
                            whiteSpace: 'pre-line',
                            lineHeight: 1.35
                          }}
                        >
                          {stream.details || stream.title || stream.description || 'Stream online'}
                        </div>
                      </div>
                    </div>
                    <FontAwesomeIcon
                      icon={faCirclePlay}
                      style={{ color: 'var(--stremio-purple-soft)', fontSize: 22, flexShrink: 0 }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
