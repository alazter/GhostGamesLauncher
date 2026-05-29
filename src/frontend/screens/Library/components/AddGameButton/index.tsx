import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import LibraryContext from '../../LibraryContext'

interface AddGameButtonProps {
  'data-tour'?: string
}

function AddGameButton({ 'data-tour': dataTour }: AddGameButtonProps = {}) {
  const { t } = useTranslation()
  const { handleAddGameButtonClick } = useContext(LibraryContext)

  return (
    <button
      className="sideloadGameButton"
      onClick={handleAddGameButtonClick}
      data-tour={dataTour || 'library-add-game'}
    >
      <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
      {t('add_game', 'Add Game')}
    </button>
  )
}

export default AddGameButton
