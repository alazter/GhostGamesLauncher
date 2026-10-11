import { useState } from 'react'
import type { GhostMovie } from 'common/types/plugins'
import CatalogPoster from './CatalogPoster'
import useCinemaCardPreferences from './useCinemaCardPreferences'
import { CatalogCardStyle } from './cardPreferences'

const styles: { style: CatalogCardStyle; label: string }[] = [
  { style: 'classic', label: 'Estilo atual' },
  { style: 'caption', label: 'Informações abaixo' },
  { style: 'clean', label: 'Capa limpa' }
]

export default function CatalogCardSettings({ movie }: { movie?: GhostMovie }) {
  const { cardPreferences, changeCardPreferences, saveError } =
    useCinemaCardPreferences()
  const [favorite, setFavorite] = useState(false)
  const [watched, setWatched] = useState(false)
  const [previewRating, setPreviewRating] = useState<number | null>(
    movie?.userRating ?? null
  )
  return (
    <section className="catalog-card-settings" aria-label="Aparência dos cards">
      <h3>Aparência dos cards</h3>
      <p>
        Escolha o estilo do catálogo. Passe o mouse ou toque nas capas para ver
        o overlay.
      </p>
      <div className="catalog-card-previews">
        {styles.map(({ style, label }) => (
          <div className="catalog-card-option" key={style}>
            {movie ? (
              <CatalogPoster
                movie={{ ...movie, userRating: previewRating ?? undefined }}
                preferences={{ ...cardPreferences, style }}
                isFavorite={favorite}
                isWatched={watched}
                onToggleFavorite={() => setFavorite(!favorite)}
                onToggleWatched={() => setWatched(!watched)}
                onRate={setPreviewRating}
                onPlay={() => {}}
                onSelect={() => {}}
              />
            ) : (
              <p>Adicione uma mídia para visualizar este estilo.</p>
            )}
            <button
              type="button"
              className="catalog-style-choice"
              aria-pressed={cardPreferences.style === style}
              onClick={() => changeCardPreferences({ style })}
            >
              {label}
              {cardPreferences.style === style ? ' · Selecionado' : ''}
            </button>
          </div>
        ))}
      </div>
      <div className="catalog-card-customization">
        <label>
          <input
            type="checkbox"
            checked={cardPreferences.showTitle}
            onChange={(event) =>
              changeCardPreferences({ showTitle: event.target.checked })
            }
          />{' '}
          Mostrar nome abaixo da capa limpa
        </label>
        <label>
          Alinhamento do nome{' '}
          <select
            aria-label="Alinhamento do nome"
            value={cardPreferences.titleAlignment}
            disabled={!cardPreferences.showTitle}
            onChange={(event) =>
              changeCardPreferences({
                titleAlignment: event.target.value as
                  | 'left'
                  | 'center'
                  | 'right'
              })
            }
          >
            <option value="left">À esquerda</option>
            <option value="center">Centralizado</option>
            <option value="right">À direita</option>
          </select>
        </label>
      </div>
      {saveError && <p role="alert">{saveError}</p>}
    </section>
  )
}
