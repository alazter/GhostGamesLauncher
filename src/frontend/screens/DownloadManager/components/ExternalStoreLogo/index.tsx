import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStore } from '@fortawesome/free-solid-svg-icons'
import ankerLogo from 'frontend/assets/ankergames-logo.png'
import steamripLogo from 'frontend/assets/steamrip-logo.png'
import onlineFixLogo from 'frontend/assets/onlinefix-logo.png'
import './index.css'

interface ExternalStoreLogoProps {
  icon?: string
  name: string
  size?: number
}

// Fallback favicon mapping for common external game sources
const KNOWN_STORE_ICONS: Record<string, string> = {
  anker: ankerLogo,
  steamrip: steamripLogo,
  'online-fix': onlineFixLogo,
  onlinefix: onlineFixLogo
}

function resolveStoreIcon(icon?: string, name?: string): string | undefined {
  if (icon === onlineFixLogo || icon === ankerLogo || icon === steamripLogo) {
    return icon
  }
  const lowerName = name?.toLowerCase() || ''
  const lowerIcon = icon?.toLowerCase() || ''

  // Always prioritize HD bundled logos for official sources
  if (lowerName.includes('anker') || lowerIcon.includes('anker')) {
    return ankerLogo
  }
  if (lowerName.includes('steamrip') || lowerIcon.includes('steamrip')) {
    return steamripLogo
  }
  if (
    lowerName.includes('online-fix') ||
    lowerName.includes('onlinefix') ||
    (lowerName.includes('online') && lowerName.includes('fix')) ||
    lowerIcon.includes('online-fix') ||
    lowerIcon.includes('onlinefix') ||
    (lowerIcon.includes('online') && lowerIcon.includes('fix'))
  ) {
    return onlineFixLogo
  }

  if (
    icon &&
    (icon.startsWith('https://') ||
      icon.startsWith('http://') ||
      icon.startsWith('data:') ||
      icon.startsWith('blob:') ||
      icon.startsWith('/'))
  ) {
    return icon
  }
  for (const [key, url] of Object.entries(KNOWN_STORE_ICONS)) {
    if (lowerName.includes(key)) return url
  }
  return undefined
}

export default function ExternalStoreLogo({
  icon,
  name,
  size = 36
}: ExternalStoreLogoProps) {
  const [failed, setFailed] = useState(false)
  const effectiveIcon = resolveStoreIcon(icon, name)

  useEffect(() => {
    setFailed(false)
  }, [icon, name])

  return (
    <div
      className="dmStoreLogoFloating dmExternalStoreLogo"
      title={name}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {effectiveIcon && !failed ? (
        <img
          src={effectiveIcon}
          alt={name}
          onError={() => setFailed(true)}
          className="dmExternalStoreLogoImg"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            maxWidth: `${size}px`,
            maxHeight: `${size}px`
          }}
        />
      ) : (
        <FontAwesomeIcon
          icon={faStore}
          className="dmExternalStoreLogoFallback"
          style={{ fontSize: `${Math.round(size * 0.72)}px` }}
        />
      )}
    </div>
  )
}
