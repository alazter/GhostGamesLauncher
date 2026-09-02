import React, { ReactNode } from 'react'
import { DialogTitle } from '@mui/material'

interface DialogHeaderProps {
  onClose?: () => void
  children: ReactNode
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return (
    <DialogTitle
      sx={{
        fontSize: 'var(--text-xl)',
        fontWeight: 800,
        color: '#ffffff !important',
        paddingLeft: 0,
        letterSpacing: '0.3px'
      }}
    >
      {children}
    </DialogTitle>
  )
}
