import React, { useEffect, useRef, useState } from 'react'
import './index.scss'

interface PopoverComponentProps {
  item: React.ReactElement
  children: React.ReactElement | React.ReactNode | React.ReactNode[]
  align?: 'left' | 'right'
}

const PopoverComponent: React.FC<PopoverComponentProps> = ({
  item,
  children,
  align
}) => {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    setOpen(!open)
  }

  useEffect(() => {
    if (open) {
      // add a click listener to close the popover when clicking outside
      const callback = (event: MouseEvent) => {
        if (!wrapper.current!.contains(event.target as HTMLElement)) {
          setOpen(false)
        }
      }

      document.addEventListener('click', callback)

      return () => {
        // remove the listener when the popover is closed
        document.removeEventListener('click', callback)
      }
    } else {
      return () => ''
    }
  }, [open])

  return (
    <div className="popover-wrapper" ref={wrapper}>
      {React.cloneElement(item, {
        onClick: handleClick,
        style: { cursor: 'pointer' }
      })}
      {open && (
        <div
          id={item.props.id}
          className="popover"
          style={{
            background: 'rgba(20, 26, 32, 0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
            padding: '16px',
            width: '320px',
            maxWidth: '320px',
            color: '#fff',
            fontSize: '13px',
            lineHeight: '1.5',
            whiteSpace: 'normal',
            zIndex: 100,
            ...(align === 'right' ? {
              right: 'calc(100% + 12px)',
              top: '50%',
              transform: 'translateY(-50%)'
            } : {
              left: 0,
              top: 'calc(100% + 8px)'
            })
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default PopoverComponent
