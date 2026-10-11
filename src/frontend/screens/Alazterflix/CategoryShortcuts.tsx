import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFilm,
  faGlobe,
  faPalette,
  faTv,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons'
import type { GhostMediaCategory } from 'common/types/plugins'
import animeArtwork from 'frontend/assets/alazterflix/categories/animes.jpg'
import seriesArtwork from 'frontend/assets/alazterflix/categories/series.jpg'
import movieArtwork from 'frontend/assets/alazterflix/categories/filmes.jpg'
import documentaryArtwork from 'frontend/assets/alazterflix/categories/documentarios.jpg'
import cartoonArtwork from 'frontend/assets/alazterflix/categories/desenhos.jpg'

const categories = [
  {
    id: 'anime',
    label: 'Animes',
    icon: faWandMagicSparkles,
    artwork: animeArtwork
  },
  { id: 'series', label: 'Séries', icon: faTv, artwork: seriesArtwork },
  { id: 'movie', label: 'Filmes', icon: faFilm, artwork: movieArtwork },
  {
    id: 'documentary',
    label: 'Documentários',
    icon: faGlobe,
    artwork: documentaryArtwork
  },
  { id: 'cartoon', label: 'Desenhos', icon: faPalette, artwork: cartoonArtwork }
] satisfies {
  id: GhostMediaCategory
  label: string
  icon: typeof faFilm
  artwork: string
}[]

interface CategoryShortcutsProps {
  onSelect: (category: GhostMediaCategory) => void
}

export default function CategoryShortcuts({
  onSelect
}: CategoryShortcutsProps) {
  return (
    <nav className="category-shortcuts-row" aria-label="Explorar categorias">
      {categories.map(({ id, label, icon, artwork }) => (
        <button
          key={id}
          type="button"
          className="category-shortcut"
          onClick={() => onSelect(id)}
        >
          <img
            className="category-shortcut-artwork"
            src={artwork}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span className="category-shortcut-shade" aria-hidden="true" />
          <FontAwesomeIcon icon={icon} aria-hidden="true" />
          <span className="category-shortcut-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
