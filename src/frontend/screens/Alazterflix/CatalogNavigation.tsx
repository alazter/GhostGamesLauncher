import type { GhostMediaCategory } from 'common/types/plugins'

export type CatalogCategory = 'all' | 'forYou' | GhostMediaCategory

const categories: { id: CatalogCategory; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'forYou', label: 'Para você' },
  { id: 'anime', label: 'Animes' },
  { id: 'series', label: 'Séries' },
  { id: 'movie', label: 'Filmes' },
  { id: 'documentary', label: 'Documentários' },
  { id: 'cartoon', label: 'Desenhos' }
]

interface Props {
  selectedCategory: CatalogCategory
  counts: Record<CatalogCategory, number>
  onSelect: (category: CatalogCategory) => void
}

export default function CatalogNavigation({
  selectedCategory,
  counts,
  onSelect
}: Props) {
  return (
    <nav
      className="catalog-navigation category-chips-row"
      aria-label="Categorias do catálogo"
    >
      {categories.map(({ id, label }) => (
        <button
          type="button"
          key={id}
          className={`cat-chip cat-${id} ${selectedCategory === id ? 'active' : ''}`}
          aria-pressed={selectedCategory === id}
          aria-label={`${label} (${counts[id]})`}
          onClick={() => onSelect(id)}
        >
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
