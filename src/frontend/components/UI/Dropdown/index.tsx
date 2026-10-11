import { ReactNode, useState, useRef, useEffect, useId } from 'react'
import './index.scss'

type Props = {
  title?: ReactNode | string
  children: ReactNode
  className?: string
  buttonClass?: string
  popUpOnHover?: boolean
  closeDelay?: number
  [key: string]: any
}

export default function Dropdown({
  title,
  children,
  className,
  buttonClass,
  popUpOnHover = false,
  closeDelay = 500,
  ...rest
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownId = useId()

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  // Limpeza de timers ao desmontar o componente
  useEffect(() => {
    return () => {
      clearCloseTimer()
    }
  }, [])

  // Exclusão mútua: ao abrir outro dropdown no cabeçalho, fecha este imediatamente
  useEffect(() => {
    const handleOtherOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>
      if (customEvent.detail && customEvent.detail.id !== dropdownId) {
        clearCloseTimer()
        setIsExpanded(false)
      }
    }

    window.addEventListener('heroic-dropdown-opened', handleOtherOpened)
    return () => {
      window.removeEventListener('heroic-dropdown-opened', handleOtherOpened)
    }
  }, [dropdownId])

  // Fecha ao clicar fora do container ou ao pressionar a tecla Escape
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        clearCloseTimer()
        setIsExpanded(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearCloseTimer()
        setIsExpanded(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExpanded])

  const handleMouseEnter = () => {
    if (!popUpOnHover) return
    clearCloseTimer()
    setIsExpanded(true)
    window.dispatchEvent(
      new CustomEvent('heroic-dropdown-opened', { detail: { id: dropdownId } })
    )
  }

  const handleMouseLeave = () => {
    if (!popUpOnHover) return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setIsExpanded(false)
      closeTimerRef.current = null
    }, closeDelay)
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Se o foco mudou para outro elemento filho dentro do dropdown, mantém aberto
    if (e.currentTarget.contains(e.relatedTarget as Node)) return

    // Se popUpOnHover estiver ativo, o mouseleave com closeDelay ou clique externo gerenciam o fechamento
    if (popUpOnHover) return

    setIsExpanded(false)
  }

  const handleClick = () => {
    clearCloseTimer()
    if (!isExpanded) {
      window.api.gamepadAction({ action: 'tab' })
    }
    setIsExpanded(true)
    window.dispatchEvent(
      new CustomEvent('heroic-dropdown-opened', { detail: { id: dropdownId } })
    )
  }

  return (
    <div
      ref={containerRef}
      className={`dropdownContainer ${className || ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...rest}
    >
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`dropdownButton ${buttonClass ? buttonClass : ''}`}
        onClick={handleClick}
      >
        {title}
      </button>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onBlur={handleBlur}
        onFocus={() => {
          clearCloseTimer()
          setIsExpanded(true)
        }}
        className={`dropdown ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        {children}
      </div>
    </div>
  )
}
