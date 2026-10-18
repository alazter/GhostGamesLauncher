import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faSpinner } from '@fortawesome/free-solid-svg-icons'
import type { GhostSearchResult } from 'common/types/plugins'
import ExternalStoreLogo from 'frontend/screens/DownloadManager/components/ExternalStoreLogo'

interface Props {
  name?: string
  icon?: string
  providerId?: string
  stores: GhostSearchResult[]
  searching: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (game: GhostSearchResult) => void
}

export default function SourcePicker({
  name,
  icon,
  providerId,
  stores,
  searching,
  open,
  onOpenChange,
  onSelect
}: Props) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  }>()
  const positioned = Boolean(position)

  useLayoutEffect(() => {
    if (!open || !positioned) return
    const selected = menu.current?.querySelector<HTMLButtonElement>(
      '[aria-checked="true"]'
    )
    const first = menu.current?.querySelector<HTMLButtonElement>('button')
    ;(selected || first)?.focus({ preventScroll: true })
  }, [open, positioned])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(undefined)
      return
    }
    function place() {
      if (!trigger.current || !menu.current) return
      const rect = trigger.current.getBoundingClientRect()
      const dialog = trigger.current
        .closest('.cdmModalCard')
        ?.getBoundingClientRect()
      const margin = 12,
        gap = 6
      const width = Math.min(
        Math.max(180, rect.width),
        window.innerWidth - margin * 2
      )
      const upperBound = Math.max(margin, (dialog?.top || 0) + margin)
      const lowerBound = Math.min(
        window.innerHeight - margin,
        (dialog?.bottom || window.innerHeight) - margin
      )
      const below = Math.max(0, lowerBound - rect.bottom - gap)
      const above = Math.max(0, rect.top - gap - upperBound)
      const desired = Math.min(menu.current.scrollHeight, 280)
      const down = below >= desired || below >= above
      const maxHeight = Math.min(280, down ? below : above)
      setPosition({
        width,
        maxHeight,
        left: Math.max(
          margin,
          Math.min(rect.right - width, window.innerWidth - width - margin)
        ),
        top: down
          ? rect.bottom + gap
          : Math.max(upperBound, rect.top - gap - Math.min(desired, maxHeight))
      })
    }
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      )
        onOpenChange(false)
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('pointerdown', outside)
    }
  }, [open, stores.length, searching, onOpenChange])

  return (
    <div className="cdmSourceField">
      <span className="cdmFieldLabel">Fonte do jogo</span>
      <button
        ref={trigger}
        type="button"
        className="cdmSourceButton"
        aria-label="Trocar fonte do jogo"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={stores.length <= 1 && !searching}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            onOpenChange(true)
          }
        }}
      >
        <ExternalStoreLogo icon={icon} name={name || 'Fonte'} size={30} />
        <span>{name || 'Fonte selecionada'}</span>
        <FontAwesomeIcon icon={faChevronDown} />
      </button>
      <span className="cdmSourceHint">
        {searching
          ? 'Buscando outras lojas...'
          : stores.length > 1
            ? `Trocar entre ${stores.length} lojas`
            : 'Fonte selecionada'}
      </span>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label="Fontes disponíveis"
            className="cdmSourceMenu"
            style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Tab') {
                event.preventDefault()
                event.stopPropagation()
                onOpenChange(false)
                trigger.current?.focus()
                return
              }
              const buttons = Array.from(
                menu.current?.querySelectorAll<HTMLButtonElement>('button') ||
                  []
              )
              const current = buttons.indexOf(
                document.activeElement as HTMLButtonElement
              )
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : event.key === 'ArrowDown'
                      ? (current + 1) % buttons.length
                      : event.key === 'ArrowUp'
                        ? (current - 1 + buttons.length) % buttons.length
                        : -1
              if (next >= 0) {
                event.preventDefault()
                buttons[next]?.focus()
              }
            }}
          >
            {stores.map((store) => (
              <button
                key={`${store.providerId}-${store.id}`}
                type="button"
                role="menuitemradio"
                aria-label={store.providerName}
                aria-checked={store.providerId === providerId}
                className="cdmSourceMenuOption"
                onClick={() => {
                  onSelect(store)
                  onOpenChange(false)
                  trigger.current?.focus()
                }}
              >
                <ExternalStoreLogo
                  icon={store.providerIcon}
                  name={store.providerName}
                  size={24}
                />
                <span>{store.providerName}</span>
              </button>
            ))}
            {searching && (
              <div className="cdmSourceMenuLoading" role="status">
                <FontAwesomeIcon icon={faSpinner} spin /> Buscando outras
                lojas...
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
