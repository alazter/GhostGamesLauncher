import { MouseEventHandler } from 'react'
import classNames from 'classnames'
import { NavLink } from 'react-router-dom'
import {
  FontAwesomeIcon,
  type FontAwesomeIconProps
} from '@fortawesome/react-fontawesome'
import './index.css'

interface SidebarItemProps {
  label: string
  url?: string
  state?: any
  icon?: FontAwesomeIconProps['icon']
  isActiveFallback?: boolean
  onClick?: MouseEventHandler
  onMouseEnter?: React.MouseEventHandler
  onMouseLeave?: React.MouseEventHandler
  className?: string
  elementType?: 'a' | 'button'
  dataTour?: string
  draggable?: boolean
  onDragStart?: React.DragEventHandler
  onDragOver?: React.DragEventHandler
  onDragEnd?: React.DragEventHandler
  style?: React.CSSProperties
  badgeCount?: number
  badgeText?: string
  badgeVariant?: 'default' | 'percent'
  children?: React.ReactNode
}

export default function SidebarItem({
  icon,
  label,
  url = '',
  state,
  isActiveFallback = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  elementType,
  dataTour,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  style,
  badgeCount,
  badgeText,
  badgeVariant,
  children
}: SidebarItemProps) {
  const itemContent = (
    <>
      {icon && (
        <div className="Sidebar__itemIcon">
          <FontAwesomeIcon icon={icon} title={label} />
          {badgeText !== undefined ? (
            <span
              className={classNames('Sidebar__badge', {
                'Sidebar__badge--percent': badgeVariant === 'percent'
              })}
            >
              {badgeText}
            </span>
          ) : typeof badgeCount === 'number' && badgeCount > 0 ? (
            <span className="Sidebar__badge">{badgeCount}</span>
          ) : null}
        </div>
      )}
      <span>{label}</span>
      {children}
    </>
  )

  switch (elementType) {
    case 'button':
      return (
        <button
          className="Sidebar__item"
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          data-tour={dataTour}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          style={style}
        >
          {itemContent}
        </button>
      )
    default:
      return (
        <NavLink
          className={({ isActive }) =>
            classNames('Sidebar__item', className, {
              active: isActive || isActiveFallback
            })
          }
          to={url}
          state={state}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          data-tour={dataTour}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          style={style}
        >
          {itemContent}
        </NavLink>
      )
  }
}
