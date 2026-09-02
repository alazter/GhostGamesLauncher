import React, {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import {
  Dialog as MuiDialog,
  DialogContent,
  IconButton,
  Paper,
  styled
} from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

import ContextProvider from 'frontend/state/ContextProvider'
import '../index.css'

interface DialogProps {
  className?: string
  children: ReactNode
  showCloseButton: boolean
  onClose: () => void
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
}

const StyledPaper = styled(Paper)(() => ({
  backgroundColor: 'rgba(20, 24, 30, 0.85) !important',
  backdropFilter: 'blur(16px) !important',
  WebkitBackdropFilter: 'blur(16px) !important',
  border: '1px solid rgba(255, 255, 255, 0.1) !important',
  borderRadius: '16px !important',
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5) !important',
  backgroundImage: 'none !important',
  color: '#ffffff !important',
  maxWidth: '100%',
  '&:has(.settingsDialogContent):not(:has(.logs-wrapper))': {
    height: '80%'
  },
  '&:has(.logs-wrapper)': {
    maxHeight: '80%'
  }
}))

export const Dialog: React.FC<DialogProps> = ({
  children,
  className,
  showCloseButton = false,
  onClose,
  maxWidth = 'md'
}) => {
  const [open, setOpen] = useState(true)
  const [isCloseHovered, setIsCloseHovered] = useState(false)
  const { disableDialogBackdropClose } = useContext(ContextProvider)

  useEffect(() => {
    // HACK: Focussing the dialog using JS does not seem to work
    //       Instead, simulate one or two tab presses
    // One tab to focus the dialog
    window.api.gamepadAction({ action: 'tab' })
    // Second tab to skip the close button if it's shown
    if (showCloseButton) window.api.gamepadAction({ action: 'tab' })
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    onClose()
  }, [onClose])

  return (
    <MuiDialog
      open={open}
      onClose={(e, reason) => {
        if (disableDialogBackdropClose && reason === 'backdropClick') return
        close()
      }}
      scroll="paper"
      maxWidth={maxWidth}
      PaperComponent={StyledPaper}
      PaperProps={{
        className
      }}
      sx={{
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.6) !important',
          backdropFilter: 'blur(4px) !important',
          WebkitBackdropFilter: 'blur(4px) !important'
        },
        '& .Dialog__element': {
          maxWidth: 'min(700px, 85vw)',
          paddingTop: 'var(--dialog-margin-vertical)'
        }
      }}
    >
      <>
        <button
          type="button"
          aria-label="close"
          className="Dialog__CloseButton dialog-close-button"
          onClick={close}
          tabIndex={-1}
          onMouseEnter={() => setIsCloseHovered(true)}
          onMouseLeave={() => setIsCloseHovered(false)}
          style={{
            position: 'absolute',
            right: 14,
            top: 14,
            display: showCloseButton ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            margin: 0,
            width: '28px',
            height: '28px',
            background: 'transparent',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <FontAwesomeIcon
            icon={faTimes}
            style={{
              fontSize: '20px',
              color: isCloseHovered ? '#00ffff' : 'rgba(255, 255, 255, 0.65)',
              filter: isCloseHovered
                ? 'drop-shadow(0 0 3px #00ffff) drop-shadow(0 0 8px rgba(0, 255, 255, 0.95))'
                : 'none',
              transform: isCloseHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.2s ease',
              pointerEvents: 'none'
            }}
          />
        </button>
        <DialogContent>{children}</DialogContent>
      </>
    </MuiDialog>
  )
}
