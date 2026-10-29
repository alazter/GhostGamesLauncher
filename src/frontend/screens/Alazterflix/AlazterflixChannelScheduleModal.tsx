import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faXmark,
  faPlay,
  faTv,
  faClock,
  faGear,
  faCircleDot
} from '@fortawesome/free-solid-svg-icons'
import type { GhostTvChannel, GhostEpgProgram } from 'common/types/plugins'

interface AlazterflixChannelScheduleModalProps {
  channel: GhostTvChannel
  schedule: GhostEpgProgram[]
  currentProgram?: GhostEpgProgram
  onClose: () => void
  onOpenAssignModal: () => void
  onPlay: () => void
}

export default function AlazterflixChannelScheduleModal({
  channel,
  schedule,
  currentProgram,
  onClose,
  onOpenAssignModal,
  onPlay
}: AlazterflixChannelScheduleModalProps) {
  const now = Date.now()

  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div
        className="tv-modal-content alazter-channel-schedule-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tv-modal-header">
          <div className="modal-title-box">
            <FontAwesomeIcon icon={faCalendarDays} className="modal-icon" />
            <div>
              <h3>Guia de Programação (EPG)</h3>
              <p className="modal-subtitle">{channel.name}</p>
            </div>
          </div>
          <div className="schedule-header-actions">
            <button
              type="button"
              className="btn-reassign-epg"
              onClick={onOpenAssignModal}
              title="Atribuir outro canal do Guia XMLTV"
            >
              <FontAwesomeIcon icon={faGear} />
              <span>Atribuir EPG</span>
            </button>
            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        {/* Hero do Canal */}
        <div className="schedule-channel-hero">
          <div className="channel-hero-logo">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <FontAwesomeIcon icon={faTv} />
            )}
          </div>
          <div className="channel-hero-info">
            <div className="hero-title-row">
              <h4>{channel.name}</h4>
              <span className="channel-group-tag">{channel.group}</span>
            </div>
            {currentProgram ? (
              <div className="hero-current-show">
                <div className="live-now-badge">
                  <FontAwesomeIcon icon={faCircleDot} className="pulse-icon" />
                  <span>NO AR AGORA</span>
                </div>
                <div className="current-show-name">
                  {currentProgram.title} ({currentProgram.startFormatted} - {currentProgram.stopFormatted})
                </div>
                {currentProgram.description && (
                  <p className="current-show-desc">
                    {currentProgram.description}
                  </p>
                )}
                {typeof currentProgram.progressPercent === 'number' && (
                  <div className="schedule-progress-bar-wrap">
                    <div
                      className="schedule-progress-bar-fill"
                      style={{ width: `${currentProgram.progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="hero-no-epg-hint">
                <span>Nenhum programa no ar no momento ou dados de EPG ausentes.</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-hero-watch-live"
            onClick={() => {
              onPlay()
              onClose()
            }}
          >
            <FontAwesomeIcon icon={faPlay} />
            <span>Assistir Canal</span>
          </button>
        </div>

        {/* Grade de Programas */}
        <div className="schedule-timeline-container">
          <div className="timeline-header-label">
            <FontAwesomeIcon icon={faClock} />
            <span>Programação Completa</span>
          </div>

          {schedule.length === 0 ? (
            <div className="schedule-empty-state">
              <p>Nenhuma programação encontrada para este canal.</p>
              <button
                type="button"
                className="btn-assign-hint"
                onClick={onOpenAssignModal}
              >
                Clique aqui para atribuir um canal do XMLTV manualmente
              </button>
            </div>
          ) : (
            <div className="schedule-items-list">
              {schedule.map((prog, idx) => {
                const isPast = prog.stop <= now
                const isCurrent = prog.start <= now && prog.stop > now
                const isFuture = prog.start > now

                return (
                  <div
                    key={`${prog.channelId}-${prog.start}-${idx}`}
                    className={`schedule-item-card ${isCurrent ? 'is-live' : isPast ? 'is-past' : 'is-future'}`}
                  >
                    <div className="item-time-col">
                      <span className="item-start-time">
                        {prog.startFormatted}
                      </span>
                      <span className="item-stop-time">{prog.stopFormatted}</span>
                      {isCurrent && (
                        <span className="badge-item-live">NO AR</span>
                      )}
                    </div>

                    <div className="item-content-col">
                      <div className="item-title-row">
                        <h5>{prog.title}</h5>
                        {prog.category && (
                          <span className="item-category-tag">
                            {prog.category}
                          </span>
                        )}
                      </div>
                      {prog.description && (
                        <p className="item-desc">{prog.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
