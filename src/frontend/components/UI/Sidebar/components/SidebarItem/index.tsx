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
  icon?: FontAwesomeIconProps['icon']
  isActiveFallback?: boolean
  onClick?: MouseEventHandler
  className?: string
  elementType?: 'a' | 'button'
  dataTour?: string
  draggable?: boolean
  onDragStart?: React.DragEventHandler
  onDragOver?: React.DragEventHandler
  onDragEnd?: React.DragEventHandler
  style?: React.CSSProperties
}

export default function SidebarItem({
  icon,
  label,
  url = '',
  isActiveFallback = false,
  onClick,
  className,
  elementType,
  dataTour,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  style
}: SidebarItemProps) {
  const itemContent = (
    <>
      {icon && (
        <div className="Sidebar__itemIcon">
          <FontAwesomeIcon icon={icon} title={label} />
        </div>
      )}
      <span>{label}</span>
    </>
  )

  switch (elementType) {
    case 'button':
      return (
        <button
          className="Sidebar__item"
          onClick={onClick}
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
          onClick={onClick}
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
