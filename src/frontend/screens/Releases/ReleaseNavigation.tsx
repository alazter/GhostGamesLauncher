import { useState } from 'react'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faBoxOpen,
  faCalendarDays,
  faChevronDown,
  faChevronUp,
  faFilm,
  faFilter,
  faGamepad,
  faGlobe,
  faMoon,
  faSearch,
  faSun,
  faTv,
  faCheck,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import type { ReleaseCategory, ReleaseRegion } from 'common/types/releases'
import type { TrackedRelease } from 'frontend/helpers/releaseTracking'
import './navigation.css'

const genres = {
  games: [
    ['Action', 'Ação'],
    ['Adventure', 'Aventura'],
    ['Single-player', 'Um jogador'],
    ['Indie', 'Indie'],
    ['RPG', 'RPG'],
    ['Strategy', 'Estratégia'],
    ['Simulation', 'Simulação'],
    ['Multiplayer', 'Multijogador'],
    ['Shooter', 'Tiro'],
    ['Fantasy', 'Fantasia']
  ],
  movies: [
    ['Drama', 'Drama'],
    ['Thriller', 'Suspense'],
    ['Comedy', 'Comédia'],
    ['Horror', 'Terror'],
    ['Action', 'Ação'],
    ['Documentary', 'Documentário'],
    ['Adventure', 'Aventura'],
    ['Mystery', 'Mistério'],
    ['Crime', 'Crime']
  ],
  'tv-series': [
    ['Drama', 'Drama'],
    ['Reality', 'Reality'],
    ['Comedy', 'Comédia'],
    ['Documentary', 'Documentário'],
    ['Action', 'Ação'],
    ['Animation', 'Animação'],
    ['Crime', 'Crime'],
    ['Adventure', 'Aventura'],
    ['Thriller', 'Suspense'],
    ['Mystery', 'Mistério']
  ]
} as Record<string, string[][]>

const iconFor = (category: string) =>
  category === 'games'
    ? faGamepad
    : category === 'movies'
      ? faFilm
      : category === 'tv-series' || category === 'movies_tv-series'
        ? faTv
        : faBoxOpen

interface Props {
  categories: ReleaseCategory[]
  category: string
  platforms: string[]
  region: ReleaseRegion
  theme: 'dark' | 'light'
  tracking: boolean
  tracked: TrackedRelease[]
  tag: string
  onCategory: (category: string) => void
  onPlatforms: (platforms: string[]) => void
  onRegion: (region: ReleaseRegion) => void
  onTheme: () => void
  onCalendar: () => void
  onSearch: () => void
  onTracking: (category?: string, platform?: string) => void
  onTag: (tag: string) => void
}

export default function ReleaseNavigation(props: Props) {
  const [allCategories, setAllCategories] = useState(false)
  const [allPlatforms, setAllPlatforms] = useState(false)
  const [collapsed, setCollapsed] = useState<string | null>(null)
  const categoryGenres =
    genres[props.category] ||
    (props.category === 'movies_tv-series' ? genres.movies : [])
  const follows = props.tracked.filter((entry) => entry.region === props.region)
  const count = (category?: string, platform?: string) =>
    new Set(
      follows
        .filter(
          (entry) =>
            (!category ||
              category === 'all' ||
              category.split('_').includes(entry.product.category)) &&
            (!platform ||
              (entry.platform
                ? entry.platform === platform
                : entry.product.platforms.includes(platform)))
        )
        .map((entry) => entry.product.id)
    ).size

  return (
    <aside className="nr-navigation" aria-label="Categorias de lançamentos">
      <div className="nr-brand">
        <svg viewBox="0 0 30 32" aria-hidden="true">
          <rect x="0" y="3" width="27" height="6" rx="3" fill="#b859ed" />
          <rect x="8" y="13" width="19" height="6" rx="3" fill="#9845e5" />
          <rect x="15" y="23" width="12" height="6" rx="3" fill="#7632d6" />
        </svg>
        <div>
          Lançamentos<small>GHOST</small>
        </div>
      </div>
      <nav
        className="nr-nav-scroll"
        aria-label="Navegação e filtros de lançamentos"
      >
        <button className="nr-nav-button" onClick={props.onCalendar}>
          <Icon icon={faCalendarDays} /> Calendário
        </button>
        <button className="nr-nav-button" onClick={props.onSearch}>
          <Icon icon={faSearch} /> Buscar
        </button>
        <button
          className={`nr-nav-button ${props.tracking ? 'active' : ''}`}
          onClick={() => props.onTracking()}
        >
          <Icon icon={faBell} /> Monitorados{' '}
          <span className="nr-count">{count()}</span>
        </button>
        <div className="nr-nav-separator" />
        {props.categories
          .filter(
            (category, index) =>
              allCategories || index < 5 || category.id === props.category
          )
          .map((category) => {
            const active = category.id === props.category
            const expanded = active && collapsed !== category.id
            return (
              <div
                className={`nr-category ${active ? 'nr-category--active' : ''}`}
                key={category.id}
              >
                <button
                  className="nr-nav-button"
                  aria-expanded={
                    category.platforms.length ? expanded : undefined
                  }
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    if (active && category.platforms.length)
                      setCollapsed(expanded ? category.id : null)
                    else {
                      props.onCategory(category.id)
                      setCollapsed(null)
                      setAllPlatforms(false)
                    }
                  }}
                >
                  <Icon icon={iconFor(category.id)} /> {category.label}
                  {category.platforms.length > 0 && (
                    <Icon
                      className="nr-nav-chevron"
                      icon={expanded ? faChevronUp : faChevronDown}
                    />
                  )}
                </button>
                {expanded && category.platforms.length > 0 && (
                  <div className="nr-platforms">
                    <button
                      aria-pressed={!props.platforms.length}
                      onClick={() => props.onPlatforms([])}
                    >
                      Todas as plataformas
                    </button>
                    <button
                      className="nr-category-follows"
                      onClick={() => props.onTracking(category.id)}
                    >
                      <Icon icon={faBell} /> Monitorados{' '}
                      <span>{count(category.id)}</span>
                    </button>
                    {category.platforms
                      .filter(
                        (platform, index) =>
                          allPlatforms ||
                          index < 7 ||
                          props.platforms.includes(platform.id)
                      )
                      .map((platform) => (
                        <div className="nr-platform-row" key={platform.id}>
                          <button
                            role="checkbox"
                            aria-checked={props.platforms.includes(platform.id)}
                            onClick={() =>
                              props.onPlatforms(
                                props.platforms.includes(platform.id)
                                  ? props.platforms.filter(
                                      (id) => id !== platform.id
                                    )
                                  : [...props.platforms, platform.id]
                              )
                            }
                          >
                            <span
                              className="nr-filter-check"
                              aria-hidden="true"
                            >
                              {props.platforms.includes(platform.id) && (
                                <Icon icon={faCheck} />
                              )}
                            </span>
                            {platform.label}
                          </button>
                          <button
                            className="nr-platform-follows"
                            aria-label={`Ver monitorados de ${platform.label}`}
                            title={`Monitorados de ${platform.label}`}
                            onClick={() =>
                              props.onTracking(category.id, platform.id)
                            }
                          >
                            <Icon icon={faBell} />
                            {count(category.id, platform.label) > 0 && (
                              <span>{count(category.id, platform.label)}</span>
                            )}
                          </button>
                        </div>
                      ))}
                    {category.platforms.length > 7 && (
                      <button
                        className="nr-nav-more"
                        aria-expanded={allPlatforms}
                        onClick={() => setAllPlatforms(!allPlatforms)}
                      >
                        {allPlatforms
                          ? '− Menos plataformas'
                          : '+ Mais plataformas'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        <button
          className="nr-nav-button nr-nav-more"
          aria-expanded={allCategories}
          onClick={() => setAllCategories(!allCategories)}
        >
          {allCategories ? '− Menos categorias' : '+ Todas as categorias'}
        </button>
        {!props.tracking && (
          <details className="nr-nav-filters" open>
            <summary>
              <Icon icon={faFilter} /> Filtros <Icon icon={faChevronDown} />
            </summary>
            <label className="nr-genre-search">
              Gênero / tag
              <input
                aria-label="Filtrar por gênero"
                placeholder="Buscar gênero…"
                value={props.tag}
                onChange={(event) => props.onTag(event.target.value)}
              />
            </label>
            <div className="nr-genre-options">
              {categoryGenres.map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={props.tag === value}
                  title={value}
                  onClick={() => props.onTag(props.tag === value ? '' : value)}
                >
                  <span className="nr-filter-check" aria-hidden="true">
                    {props.tag === value && <Icon icon={faCheck} />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
            {(props.platforms.length > 0 || props.tag) && (
              <button
                className="nr-clear-filters"
                onClick={() => {
                  props.onPlatforms([])
                  props.onTag('')
                }}
              >
                <Icon icon={faXmark} /> Limpar filtros
              </button>
            )}
          </details>
        )}
      </nav>
      <div className="nr-nav-footer">
        <label className="nr-region">
          <Icon icon={faGlobe} />
          <select
            aria-label="Região de lançamento"
            value={props.region}
            onChange={(event) =>
              props.onRegion(event.target.value as ReleaseRegion)
            }
          >
            <option value="us">Estados Unidos</option>
            <option value="uk">Reino Unido</option>
          </select>
        </label>
        <div className="nr-theme-controls">
          <button
            onClick={props.onTheme}
            title={props.theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            <Icon icon={props.theme === 'dark' ? faSun : faMoon} /> Tema{' '}
            {props.theme === 'dark' ? 'claro' : 'escuro'}
          </button>
          <small>Releases.com</small>
        </div>
      </div>
    </aside>
  )
}
