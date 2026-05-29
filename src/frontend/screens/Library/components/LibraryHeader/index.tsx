import { memo, useContext, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GameInfo } from 'common/types'
import LibraryContext from '../../LibraryContext'
import AlphabetFilter from '../AlphabetFilter'
import './index.css'

type Props = {
  list: GameInfo[]
}

export default memo(function LibraryHeader({ list }: Props) {
  const { t } = useTranslation()
  const { showFavourites, showAlphabetFilter } = useContext(LibraryContext)

  const [alignment, setAlignment] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_alignment') || 'center'
  })

  useEffect(() => {
    const handleSettingsChange = () => {
      setAlignment(localStorage.getItem('heroic_alphabet_alignment') || 'center')
    }
    window.addEventListener('heroicSettingsChanged', handleSettingsChange)
    return () => window.removeEventListener('heroicSettingsChanged', handleSettingsChange)
  }, [])

  const numberOfGames = useMemo(() => {
    if (!list) return 0
    const dlcCount = list.filter(
      (lib) => lib.runner !== 'sideload' && lib.install.is_dlc
    ).length
    const total = list.length - dlcCount
    return total > 0 ? `${total}` : 0
  }, [list])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        paddingBottom: '10px',
        paddingLeft: '35px' /* <--- ADICIONEI ESTE RECUO AQUI */,
        gap: '20px'
      }}
    >
      {/* 1. TÍTULO (Esquerda) */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <h5
          className="libraryHeader"
          data-tour="library-header"
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span
            className="libraryTitle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: 1
            }}
          >
            {showFavourites
              ? t('favourites', 'Favourites')
              : t('title.allGames', 'All Games')}
            <span
              className="numberOfgames"
              style={{ margin: 0, lineHeight: 1 }}
            >
              {numberOfGames}
            </span>
          </span>
        </h5>
      </div>

      {/* 2. ALFABETO (Agora esticado por todo o resto do espaço) */}
      <div
        className="custom-alphabet-wrapper"
        style={{
          flexGrow: 1,
          paddingTop: '0px',
          paddingBottom: '0px',
          paddingLeft: alignment === 'left' ? '0px' : '10px',
          paddingRight: '10px',
          '--alphabet-alignment': alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : alignment === 'fill' ? 'space-between' : 'center',
          '--alphabet-padding-left': alignment === 'left' ? '0px' : '12px'
        } as React.CSSProperties}
      >
        {showAlphabetFilter && <AlphabetFilter />}
      </div>
    </div>
  )
})
