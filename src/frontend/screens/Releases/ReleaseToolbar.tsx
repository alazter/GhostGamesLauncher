import { useEffect, useRef } from 'react'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown,
  faBars,
  faBell,
  faCalendarDays,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faCompress,
  faExpand,
  faFire,
  faRotate,
  faShieldHalved,
  faStop,
  faTableCellsLarge
} from '@fortawesome/free-solid-svg-icons'
import type { ReleaseQuery } from 'common/types/releases'
import { localReleaseDay } from 'frontend/helpers/releaseTracking'
import './toolbar.css'

export type ReleaseLayout = 'cards' | 'items' | 'rows'
export type ReleaseView = 'calendar' | 'hot' | 'tracking'
type Interval = NonNullable<ReleaseQuery['interval']>

export function shortCalendarDate(date?: string, fallback = 'A confirmar') {
  if (!date) return fallback
  return new Date(`${date}T12:00:00`)
    .toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      ...(date.slice(0, 4) !== localReleaseDay().slice(0, 4)
        ? { year: 'numeric' }
        : {})
    })
    .replace(/ de /g, ' ')
}

export function relativeCalendarDate(date?: string) {
  if (!date) return ''
  const today = localReleaseDay()
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  if (days === -1) return 'Ontem'
  if (Math.abs(days) >= 90) {
    const months = Math.abs(
      (Number(date.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
        Number(date.slice(5, 7)) -
        Number(today.slice(5, 7))
    )
    return days > 0 ? `Em ${months} meses` : `Há ${months} meses`
  }
  return days > 0 ? `Em ${days} dias` : `Há ${-days} dias`
}

interface Props {
  view: ReleaseView
  layout: ReleaseLayout
  interval: Interval
  anchorDate: string
  visibleDay: { date?: string; label: string }
  context: string
  searching: boolean
  expanded: boolean
  onView: (view: ReleaseView) => void
  onLayout: (layout: ReleaseLayout) => void
  onInterval: (interval: Interval) => void
  onDate: (date: string) => void
  onToday: () => void
  onExpand: () => void
  drmCheck?: {
    count: number
    hizRequired?: boolean
    hizVerifying?: boolean
    onUnlockHiz?: () => void
    busy: boolean
    completed: number
    total: number
    onClick: () => void
  }
}

export default function ReleaseToolbar(props: Props) {
  const datePicker = useRef<HTMLDetailsElement>(null)
  const hotPicker = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      for (const picker of [datePicker.current, hotPicker.current])
        if (picker?.open && !picker.contains(event.target as Node))
          picker.open = false
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (datePicker.current) datePicker.current.open = false
        if (hotPicker.current) hotPicker.current.open = false
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [])
  const past =
    !!props.visibleDay.date && props.visibleDay.date < localReleaseDay()
  const changeMonth = (direction: number) => {
    const value = new Date(
      `${props.visibleDay.date || props.anchorDate}T12:00:00`
    )
    value.setDate(1)
    value.setMonth(value.getMonth() + direction)
    props.onDate(localReleaseDay(value))
    if (datePicker.current) datePicker.current.open = false
  }
  return (
    <div className="nr-toolbar">
      <div className="nr-toolbar-date">
        {props.view === 'calendar' && !props.searching && (
          <>
            <details className="nr-date-picker" ref={datePicker}>
              <summary
                className={past ? 'nr-current-day is-past' : 'nr-current-day'}
                aria-label="Escolher data do calendário"
              >
                <Icon icon={past ? faCircleCheck : faCalendarDays} />
                <span>
                  {shortCalendarDate(
                    props.visibleDay.date,
                    props.visibleDay.label
                  )}
                </span>
                <small>{relativeCalendarDate(props.visibleDay.date)}</small>
                <Icon icon={faChevronDown} />
              </summary>
              <div className="nr-toolbar-popup">
                <div className="nr-month-navigation">
                  <button
                    aria-label="Mês anterior"
                    onClick={() => changeMonth(-1)}
                  >
                    <Icon icon={faChevronLeft} />
                  </button>
                  <strong>Ir para uma data</strong>
                  <button
                    aria-label="Próximo mês"
                    onClick={() => changeMonth(1)}
                  >
                    <Icon icon={faChevronRight} />
                  </button>
                </div>
                <form
                  key={props.anchorDate}
                  onSubmit={(event) => {
                    event.preventDefault()
                    const value = String(
                      new FormData(event.currentTarget).get('date') || ''
                    )
                    if (value) props.onDate(value)
                    if (datePicker.current) datePicker.current.open = false
                  }}
                >
                  <label>
                    Dia, mês e ano
                    <input
                      type="date"
                      name="date"
                      aria-label="Data do calendário"
                      defaultValue={props.visibleDay.date || props.anchorDate}
                      required
                    />
                  </label>
                  <button type="submit" className="nr-primary">
                    Ver lançamentos
                  </button>
                </form>
                <button
                  className="nr-popup-today"
                  onClick={() => {
                    props.onToday()
                    if (datePicker.current) datePicker.current.open = false
                  }}
                >
                  Voltar para hoje
                </button>
              </div>
            </details>
            <button
              className="nr-today-button"
              title="Ir para hoje"
              aria-label="Ir para hoje"
              onClick={props.onToday}
            >
              <Icon icon={faArrowDown} />
              <span />
            </button>
          </>
        )}
      </div>
      <div className="nr-toolbar-modes">
        <div className="nr-tabs" aria-label="Visualização">
          <button
            aria-pressed={props.view === 'calendar'}
            onClick={() => props.onView('calendar')}
          >
            <Icon icon={faCalendarDays} /> Calendário
          </button>
          <div className="nr-hot-control">
            <button
              aria-pressed={props.view === 'hot'}
              onClick={() => props.onView('hot')}
            >
              <Icon icon={faFire} /> Populares
            </button>
            <details ref={hotPicker} className="nr-hot-picker">
              <summary aria-label="Período dos populares">
                <Icon icon={faChevronDown} />
              </summary>
              <div className="nr-toolbar-popup">
                {(
                  [
                    ['week', 'Esta semana'],
                    ['month', 'Este mês'],
                    ['year', 'Este ano'],
                    ['all', 'Todo o período']
                  ] as const
                ).map(([interval, label]) => (
                  <button
                    key={interval}
                    aria-pressed={props.interval === interval}
                    onClick={() => {
                      props.onInterval(interval)
                      props.onView('hot')
                      if (hotPicker.current) hotPicker.current.open = false
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
          </div>
          {props.view === 'tracking' && (
            <button aria-pressed="true">
              <Icon icon={faBell} /> Monitorados
            </button>
          )}
        </div>
        <div className="nr-layout" aria-label="Formato dos lançamentos">
          <button
            title="Capas"
            aria-label="Exibir cartões"
            aria-pressed={props.layout === 'cards'}
            onClick={() => props.onLayout('cards')}
          >
            <span className="nr-layout-cover" />
          </button>
          <button
            title="Cartões compactos"
            aria-label="Exibir cartões compactos"
            aria-pressed={props.layout === 'items'}
            onClick={() => props.onLayout('items')}
          >
            <Icon icon={faTableCellsLarge} />
          </button>
          <button
            title="Lista"
            aria-label="Exibir lista"
            aria-pressed={props.layout === 'rows'}
            onClick={() => props.onLayout('rows')}
          >
            <Icon icon={faBars} />
          </button>
        </div>
      </div>
      <div className="nr-toolbar-context">
        <h1 className="nr-context-title" title={props.context}>
          {props.view === 'tracking' ? 'Seus monitorados' : props.context}
        </h1>
        {props.drmCheck?.hizRequired && (
          <button
            className="nr-drm-unlock"
            title="Confirmar a verificação no HizSearch e repetir somente a consulta dessa fonte"
            disabled={props.drmCheck.hizVerifying}
            onClick={props.drmCheck.onUnlockHiz}
          >
            {props.drmCheck.hizVerifying
              ? 'Aguardando confirmação…'
              : 'Liberar acesso ao HizSearch'}
          </button>
        )}
        {props.drmCheck && (
          <button
            className="nr-drm-check"
            title={
              props.drmCheck.busy
                ? 'Parar a verificação após as consultas em andamento'
                : `Consultar novamente o DRM da versão PC de todos os ${props.drmCheck.count} jogos carregados e monitorados`
            }
            aria-label={
              props.drmCheck.busy
                ? 'Parar verificação de DRM'
                : 'Verificar DRM de todos os jogos carregados e monitorados'
            }
            disabled={!props.drmCheck.busy && !props.drmCheck.count}
            onClick={props.drmCheck.onClick}
          >
            <Icon
              icon={props.drmCheck.busy ? faRotate : faShieldHalved}
              spin={props.drmCheck.busy}
            />
            <span role="status" aria-live="polite">
              {props.drmCheck.busy
                ? `${props.drmCheck.completed}/${props.drmCheck.total}`
                : 'Verificar DRM'}
            </span>
            {props.drmCheck.busy && <Icon icon={faStop} />}
          </button>
        )}
        <button
          title={props.expanded ? 'Recolher calendário' : 'Expandir calendário'}
          aria-label={
            props.expanded ? 'Recolher calendário' : 'Expandir calendário'
          }
          onClick={props.onExpand}
        >
          <Icon icon={props.expanded ? faCompress : faExpand} />
        </button>
      </div>
    </div>
  )
}
