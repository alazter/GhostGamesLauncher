import React, { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faChevronLeft,
  faChevronRight,
  faClock,
  faCloudArrowDown,
  faCompass,
  faHardDrive,
  faRotate,
  faTv
} from '@fortawesome/free-solid-svg-icons'
import type {
  StremioCalendarEpisode,
  StremioCalendarResult
} from 'common/types/plugins'
import {
  findLocalFilesForEpisode,
  type LocalMediaIndex,
  matchStremioItemToLocal
} from './localMediaMatcher'

interface StremioCalendarViewProps {
  calendar: StremioCalendarResult | null
  localMediaIndex: LocalMediaIndex
  loading: boolean
  seriesCount: number
  searchQuery: string
  onRefresh: () => void
  onOpenEpisode: (episode: StremioCalendarEpisode) => void
  onGoDiscover: () => void
  onOpenAccountSync: () => void
}

const WEEKDAYS_PT = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo'
]

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

const MONTHS_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez'
]

function formatDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function getTodayKey(): string {
  const now = new Date()
  return formatDateKey(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatLongDatePt(dateKey: string): string {
  const parts = dateKey.split('-').map(Number)
  if (parts.length !== 3) return dateKey
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  try {
    return dt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  } catch {
    return `${parts[2]} de ${MONTHS_PT[parts[1] - 1] || ''}`
  }
}

function formatCountdown(dateKey: string, todayKey: string): string {
  const [ty, tm, td] = todayKey.split('-').map(Number)
  const [ey, em, ed] = dateKey.split('-').map(Number)
  const todayMs = new Date(ty, tm - 1, td).getTime()
  const epMs = new Date(ey, em - 1, ed).getTime()
  const diffDays = Math.round((epMs - todayMs) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Amanhã'
  if (diffDays > 1 && diffDays <= 30) return `Em ${diffDays}d`
  return `${String(ed).padStart(2, '0')}/${String(em).padStart(2, '0')}`
}

export default function StremioCalendarView({
  calendar,
  localMediaIndex,
  loading,
  seriesCount,
  searchQuery,
  onRefresh,
  onOpenEpisode,
  onGoDiscover,
  onOpenAccountSync
}: StremioCalendarViewProps) {
  const todayKey = useMemo(() => getTodayKey(), [])
  const now = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState<number>(now.getFullYear())
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth())
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey)

  const filteredEpisodes = useMemo(() => {
    const all = calendar?.episodes || []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (ep) =>
        ep.seriesName.toLowerCase().includes(q) ||
        ep.episodeTitle.toLowerCase().includes(q)
    )
  }, [calendar, searchQuery])

  // Index episodes by YYYY-MM-DD
  const episodesByDay = useMemo(() => {
    const map = new Map<string, StremioCalendarEpisode[]>()
    for (const ep of filteredEpisodes) {
      const list = map.get(ep.dateKey) || []
      list.push(ep)
      map.set(ep.dateKey, list)
    }
    return map
  }, [filteredEpisodes])

  // Upcoming episodes (today or future) across all series in the library
  const upcomingEpisodes = useMemo(() => {
    return filteredEpisodes
      .filter((ep) => ep.dateKey >= todayKey)
      .slice(0, 15)
  }, [filteredEpisodes, todayKey])

  // If the currently viewed month has episodes and today has none, auto-select the closest episode day in the month on first load
  useEffect(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`
    if (selectedDateKey.startsWith(monthPrefix) && episodesByDay.has(selectedDateKey)) {
      return
    }
    const monthDays = Array.from(episodesByDay.keys())
      .filter((k) => k.startsWith(monthPrefix))
      .sort()
    if (monthDays.length > 0 && !episodesByDay.has(selectedDateKey)) {
      const nextOrToday = monthDays.find((k) => k >= todayKey)
      setSelectedDateKey(nextOrToday || monthDays[monthDays.length - 1])
    }
  }, [viewYear, viewMonth, episodesByDay, todayKey])

  const prevMonthInfo = useMemo(() => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTHS_SHORT_PT[d.getMonth()]
    }
  }, [viewYear, viewMonth])

  const nextMonthInfo = useMemo(() => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTHS_SHORT_PT[d.getMonth()]
    }
  }, [viewYear, viewMonth])

  const daysInMonth = useMemo(
    () => new Date(viewYear, viewMonth + 1, 0).getDate(),
    [viewYear, viewMonth]
  )

  // Monday = 0, Tuesday = 1, ..., Sunday = 6 (exact match to Screenshot 2)
  const leadingEmptyDays = useMemo(() => {
    const jsDay = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sun, 1 = Mon...
    return (jsDay + 6) % 7
  }, [viewYear, viewMonth])

  const selectedDayEpisodes = episodesByDay.get(selectedDateKey) || []

  const jumpToDateKey = (dateKey: string) => {
    const [y, m] = dateKey.split('-').map(Number)
    if (y && m) {
      setViewYear(y)
      setViewMonth(m - 1)
      setSelectedDateKey(dateKey)
    }
  }

  const handleJumpToday = () => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setSelectedDateKey(getTodayKey())
  }

  const updatedLabel = useMemo(() => {
    if (!calendar?.updatedAt) return ''
    try {
      const dt = new Date(calendar.updatedAt)
      return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [calendar?.updatedAt])

  if (seriesCount === 0 && !loading) {
    return (
      <div className="stremio-empty-box">
        <FontAwesomeIcon icon={faCalendarDays} className="empty-ico" />
        <h4>Nenhuma série ou anime na sua Biblioteca Stremio</h4>
        <p>
          O Calendário acompanha automaticamente as datas de lançamento de novos episódios de todas as séries e animes adicionados à sua <strong>Biblioteca Stremio</strong>. Adicione suas séries em <strong>Explorar</strong> ou sincronize sua conta Stremio.
        </p>
        <div className="empty-actions">
          <button type="button" className="stremio-primary-btn" onClick={onGoDiscover}>
            <FontAwesomeIcon icon={faCompass} />
            <span>Adicionar Séries no Explorar</span>
          </button>
          <button type="button" className="stremio-secondary-btn" onClick={onOpenAccountSync}>
            <FontAwesomeIcon icon={faCloudArrowDown} />
            <span>Sincronizar Conta Stremio</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="stremio-calendar-header">
        <div style={{ fontSize: 12, color: 'var(--stremio-muted)' }}>
          {seriesCount} {seriesCount === 1 ? 'série monitorada' : 'séries monitoradas'}
          {updatedLabel && ` · Atualizado às ${updatedLabel}`}
        </div>

        <div className="stremio-calendar-month-nav">
          <button
            type="button"
            className="stremio-month-step-btn"
            onClick={() => {
              setViewYear(prevMonthInfo.year)
              setViewMonth(prevMonthInfo.month)
            }}
            title={`Ir para ${MONTHS_PT[prevMonthInfo.month]} ${prevMonthInfo.year}`}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
            <span>{prevMonthInfo.label}</span>
          </button>

          <div className="stremio-month-current">
            <div className="year-label">{viewYear}</div>
            <div className="month-label">{MONTHS_PT[viewMonth]}</div>
          </div>

          <button
            type="button"
            className="stremio-month-step-btn"
            onClick={() => {
              setViewYear(nextMonthInfo.year)
              setViewMonth(nextMonthInfo.month)
            }}
            title={`Ir para ${MONTHS_PT[nextMonthInfo.month]} ${nextMonthInfo.year}`}
          >
            <span>{nextMonthInfo.label}</span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        <div className="stremio-calendar-tools">
          <button
            type="button"
            className="stremio-cal-tool-btn"
            onClick={handleJumpToday}
            title="Voltar para o dia de hoje"
          >
            Hoje
          </button>
          <button
            type="button"
            className="stremio-cal-tool-btn"
            onClick={onRefresh}
            disabled={loading}
            title="Buscar novos episódios e atualizar datas no Cinemeta/Addons"
          >
            <FontAwesomeIcon icon={faRotate} spin={loading} />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      <div className="stremio-calendar-body">
        <div>
          <div className="stremio-calendar-weekdays">
            {WEEKDAYS_PT.map((dayName) => (
              <span key={dayName}>{dayName}</span>
            ))}
          </div>

          <div className="stremio-calendar-grid">
            {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
              <div key={`empty-${idx}`} className="stremio-calendar-cell-empty" />
            ))}

            {Array.from({ length: daysInMonth }, (_, idx) => {
              const day = idx + 1
              const dateKey = formatDateKey(viewYear, viewMonth, day)
              const dayEpisodes = episodesByDay.get(dateKey) || []
              const isToday = dateKey === todayKey
              const isSelected = dateKey === selectedDateKey

              // Deduplicate posters by seriesId so if 2 episodes of the same series drop on the same day, we show 1 clean poster + badge
              const uniqueSeries: StremioCalendarEpisode[] = []
              const seenSeries = new Set<string>()
              for (const ep of dayEpisodes) {
                if (!seenSeries.has(ep.seriesId)) {
                  seenSeries.add(ep.seriesId)
                  uniqueSeries.push(ep)
                }
              }

              return (
                <div
                  key={dateKey}
                  className={`stremio-calendar-cell ${isSelected ? 'selected' : ''} ${dayEpisodes.length > 0 ? 'has-episodes' : ''}`}
                  onClick={() => setSelectedDateKey(dateKey)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedDateKey(dateKey)
                    }
                  }}
                >
                  <div className="stremio-calendar-day-top">
                    <span className={`stremio-day-num ${isToday ? 'is-today' : ''}`}>
                      {day}
                    </span>
                    {dayEpisodes.length > 1 && (
                      <span
                        className="stremio-day-extra-count"
                        title={`${dayEpisodes.length} episódios neste dia`}
                      >
                        {dayEpisodes.length} eps
                      </span>
                    )}
                  </div>

                  {uniqueSeries.length > 0 && (
                    <div className="stremio-day-posters">
                      {uniqueSeries.slice(0, 2).map((ep) => (
                        <div
                          key={ep.seriesId}
                          className="stremio-day-poster-thumb"
                          title={`${ep.seriesName} · S${ep.season}E${ep.episode} — ${ep.episodeTitle}`}
                        >
                          {ep.seriesPoster ? (
                            <img
                              src={ep.seriesPoster}
                              alt={ep.seriesName}
                              loading="lazy"
                            />
                          ) : (
                            <div className="mini-fallback">
                              {ep.seriesName.slice(0, 12)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <aside className="stremio-calendar-sidebar">
          {/* Selected Day Details Box (exact match to Screenshot 2 right panel) */}
          <div className="stremio-day-details-card">
            <div className="stremio-day-details-header">
              <h4>{formatLongDatePt(selectedDateKey)}</h4>
              <span>
                {selectedDayEpisodes.length}{' '}
                {selectedDayEpisodes.length === 1 ? 'episódio' : 'episódios'}
              </span>
            </div>

            {selectedDayEpisodes.length === 0 ? (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--stremio-muted)',
                  padding: '12px 2px',
                  lineHeight: 1.45
                }}
              >
                Nenhum episódio agendado para este dia nas séries da sua biblioteca.
              </div>
            ) : (
              <div className="stremio-day-episodes-list">
                {selectedDayEpisodes.map((ep) => {
                  const thumb = ep.thumbnail || ep.seriesBackground || ep.seriesPoster
                  const isTodayEp = ep.dateKey === todayKey
                  const localSeriesMatch = matchStremioItemToLocal(localMediaIndex, {
                    id: ep.seriesId,
                    type: ep.seriesType,
                    name: ep.seriesName
                  })
                  const localEpFiles = localSeriesMatch
                    ? findLocalFilesForEpisode(localSeriesMatch.movies, ep.season, ep.episode)
                    : []
                  const hasLocalFile = localEpFiles.length > 0
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      className="stremio-cal-ep-card"
                      onClick={() => onOpenEpisode(ep)}
                      title={`Abrir ${ep.seriesName} S${ep.season}E${ep.episode}${hasLocalFile ? ' (Disponível no PC)' : ''}`}
                    >
                      <div className="stremio-cal-ep-thumb">
                        {thumb ? (
                          <img src={thumb} alt={ep.episodeTitle} loading="lazy" />
                        ) : (
                          <div className="thumb-fallback">
                            <FontAwesomeIcon icon={faTv} />
                          </div>
                        )}
                      </div>
                      <div className="stremio-cal-ep-info">
                        <div className="ep-code-row">
                          <span>
                            S{ep.season}E{ep.episode}
                          </span>
                          {hasLocalFile && (
                            <span className="ep-status-pill local-pc">
                              <FontAwesomeIcon icon={faHardDrive} style={{ marginRight: 3 }} />
                              NO PC
                            </span>
                          )}
                          {ep.isUpcoming && (
                            <span className="ep-status-pill upcoming">Em breve</span>
                          )}
                          {isTodayEp && (
                            <span className="ep-status-pill today">Hoje</span>
                          )}
                          {ep.isWatched && (
                            <span className="ep-status-pill watched">✓ Assistido</span>
                          )}
                        </div>
                        <div className="ep-series-name">{ep.seriesName}</div>
                        <div className="ep-title">{ep.episodeTitle}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming Episodes Tracker */}
          <div className="stremio-day-details-card">
            <div className="stremio-day-details-header">
              <h4>
                <FontAwesomeIcon
                  icon={faClock}
                  style={{ color: 'var(--stremio-purple-soft)', marginRight: 7 }}
                />
                Próximos Episódios
              </h4>
              <span>{upcomingEpisodes.length}</span>
            </div>

            {upcomingEpisodes.length === 0 ? (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--stremio-muted)',
                  padding: '6px 2px',
                  lineHeight: 1.45
                }}
              >
                {loading
                  ? 'Consultando próximos lançamentos das suas séries...'
                  : 'Nenhum episódio futuro anunciado ainda para as séries da biblioteca.'}
              </div>
            ) : (
              <div className="stremio-day-episodes-list" style={{ maxHeight: 320 }}>
                {upcomingEpisodes.map((ep) => (
                  <div
                    key={`up-${ep.id}`}
                    className="stremio-upcoming-item"
                    onClick={() => {
                      jumpToDateKey(ep.dateKey)
                      onOpenEpisode(ep)
                    }}
                    title={`${ep.seriesName} · S${ep.season}E${ep.episode} (${ep.dateKey})`}
                  >
                    {ep.seriesPoster ? (
                      <img
                        src={ep.seriesPoster}
                        alt={ep.seriesName}
                        className="up-poster"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="up-poster"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,0.35)'
                        }}
                      >
                        <FontAwesomeIcon icon={faTv} />
                      </div>
                    )}
                    <div className="up-info">
                      <strong>{ep.seriesName}</strong>
                      <span>
                        S{ep.season}E{ep.episode} · {ep.episodeTitle}
                      </span>
                    </div>
                    <span className="up-countdown">
                      {formatCountdown(ep.dateKey, todayKey)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
