import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShoppingBag,
  faStore
} from '@fortawesome/free-solid-svg-icons'
import { faSteam } from '@fortawesome/free-brands-svg-icons'
import './index.css'

interface StoreHoverMenuProps {
  onClose?: () => void
  anchorRect?: DOMRect | null
}

export interface StoreOption {
  key: string
  name: string
  url: string
  icon: any
}

export const STORES_LIST: StoreOption[] = [
  { key: 'epic', name: 'Epic Games', url: '/store/epic', icon: faShoppingBag },
  { key: 'amazon', name: 'Amazon Games', url: '/store/amazon', icon: faStore },
  { key: 'gog', name: 'GOG', url: '/store/gog', icon: faShoppingBag },
  { key: 'steam', name: 'Steam', url: '/store/steam', icon: faSteam }
]

export default function StoreHoverMenu({ onClose, anchorRect }: StoreHoverMenuProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const currentStore = location.pathname.startsWith('/store/')
    ? location.pathname.replace('/store/', '')
    : localStorage.getItem('ghost_last_selected_store') || 'epic'

  const handleSelectStore = (storeKey: string, storeUrl: string) => {
    localStorage.setItem('ghost_last_selected_store', storeKey)
    navigate(storeUrl)
    if (onClose) onClose()
  }

  const fixedStyle: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        left: `${anchorRect.right + 10}px`,
        top: `${anchorRect.top + anchorRect.height / 2}px`,
        transform: 'translateY(-50%)',
        zIndex: 99999
      }
    : {
        position: 'fixed',
        left: '288px',
        top: '180px',
        zIndex: 99999
      }

  return (
    <div
      className="StoreHoverMenu"
      style={fixedStyle}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {STORES_LIST.map((store) => {
        const isActive = currentStore === store.key
        return (
          <button
            key={store.key}
            className={`StoreHoverMenu__item ${isActive ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              handleSelectStore(store.key, store.url)
            }}
          >
            <span className="StoreHoverMenu__icon">
              <FontAwesomeIcon icon={store.icon} />
            </span>
            <span>{store.name}</span>
          </button>
        )
      })}
    </div>
  )
}
