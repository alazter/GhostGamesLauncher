import React, { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faChevronDown,
  faCloudArrowDown,
  faCompass,
  faEye,
  faFilm,
  faFolderOpen,
  faHardDrive,
  faPlay,
  faTrashAlt,
  faTv
} from '@fortawesome/free-solid-svg-icons'
import type { StremioLibraryItem } from 'common/types/plugins'
import {
  type LocalMediaIndex,
  matchStremioItemToLocal
} from './localMediaMatcher'

export type StremioLibrarySort =
  | 'lastWatched'
  | 'az'
  | 'za'
  | 'mostWatched'
  | 'watched'
  | 'notWatched'
  | 'localPc'

interface StremioLibraryViewProps {
  items: StremioLibraryItem[]
  localMediaIndex: LocalMediaIndex
  searchQuery: string
  onOpenItem: (item: StremioLibraryItem) => void
  onToggleWatched: (item: StremioLibraryItem) => void
  onRemoveItem: (item: StremioLibraryItem) => void
  onGoDiscover: () => void
  onOpenAccountSync: () => void
  onImportLocalToLibrary?: () => void
  localImportableCount?: number
}

const SORT_OPTIONS: Array<{ id: StremioLibrarySort; label: string }> = [
  { id: 'lastWatched', label: 'Últimos Assistidos' },
  { id: 'az', label: 'A-Z' },
  { id: 'za', label: 'Z-A' },
  { id: 'mostWatched', label: 'Mais Assistidos' },
  { id: 'watched', label: 'Assistidos' },
  { id: 'notWatched', label: 'Não Assistidos' },
  { id: 'localPc', label: 'No PC' }
]

const TYPE_LABELS: Record<string, string> = {
  all: 'Todos',
  movie: 'Filmes',
  series: 'Séries',
  anime: 'Animes',
  channel: 'Canais',
  tv: 'TV',
  other: 'Outros'
}

export default function StremioLibraryView({
  items,
  localMediaIndex,
  searchQuery,
  onOpenItem,
  onToggleWatched,
  onRemoveItem,
  onGoDiscover,
  onOpenAccountSync,
  onImportLocalToLibrary,
  localImportableCount = 0
}: StremioLibraryViewProps) {
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<StremioLibrarySort>('lastWatched')
  const [brokenPosters, setBrokenPosters] = useState<Record<string, boolean>>({})

  const localMatchesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof matchStremioItemToLocal>>()
    for (const item of items) {
      map.set(item.id, matchStremioItemToLocal(localMediaIndex, item))
    }
    return map
  }, [items, localMediaIndex])

  const availableTypes = useMemo(() => {
    const types = new Set<string>(['movie', 'series'])
    for (const item of items) {
      if (item.type) types.add(item.type.toLowerCase())
    }
    return ['all', ...Array.from(types)]
  }, [items])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = items.filter((item) => {
      if (selectedType !== 'all' && (item.type || '').toLowerCase() !== selectedType) {
        return false
      }
      if (q && !(item.name || '').toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) {
        return false
      }
      if (sortBy === 'watched' && !item.isWatched) return false
      if (sortBy === 'notWatched' && item.isWatched) return false
      if (sortBy === 'localPc' && !localMatchesById.get(item.id)) return false
      return true
    })

    list = [...list]
    if (sortBy === 'az') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
    } else if (sortBy === 'za') {
      list.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'pt-BR'))
    } else if (sortBy === 'mostWatched') {
      list.sort((a, b) => {
        if ((b.timesWatched || 0) !== (a.timesWatched || 0)) {
          return (b.timesWatched || 0) - (a.timesWatched || 0)
        }
        return (b.lastWatchedAt || b.addedAt || '').localeCompare(
          a.lastWatchedAt || a.addedAt || ''
        )
      })
    } else {
      // lastWatched, watched, notWatched -> order by most recent activity / addedAt
      list.sort((a, b) =>
        (b.lastWatchedAt || b.addedAt || '').localeCompare(
          a.lastWatchedAt || a.addedAt || ''
        )
      )
    }
    return list
  }, [items, selectedType, sortBy, searchQuery])

  return (
    <>
      <div className="stremio-library-filters">
        <div className="stremio-type-select-wrap">
          <select
            aria-label="Filtrar biblioteca por tipo"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {availableTypes.map((typeKey) => (
              <option key={typeKey} value={typeKey}>
                {TYPE_LABELS[typeKey] || typeKey.charAt(0).toUpperCase() + typeKey.slice(1)}
              </option>
            ))}
          </select>
          <FontAwesomeIcon icon={faChevronDown} className="select-chevron" />
        </div>

        <div className="stremio-sort-pills" role="tablist" aria-label="Ordenação da Biblioteca">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={sortBy === opt.id}
              className={`stremio-sort-pill ${sortBy === opt.id ? 'active' : ''}`}
              onClick={() => setSortBy(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {onImportLocalToLibrary && localImportableCount > 0 && (
            <button
              type="button"
              className="stremio-cal-tool-btn"
              onClick={onImportLocalToLibrary}
              title="Importar filmes e séries do seu PC (com ID IMDb/Stremio) para a Biblioteca e Calendário"
            >
              <FontAwesomeIcon icon={faHardDrive} style={{ color: '#34d399' }} />
              <span>Importar do PC ({localImportableCount})</span>
            </button>
          )}
          <span className="stremio-library-count" style={{ marginLeft: 0 }}>
            {filteredItems.length} {filteredItems.length === 1 ? 'título' : 'títulos'}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="stremio-empty-box">
          <FontAwesomeIcon icon={faFolderOpen} className="empty-ico" />
          <h4>Sua Biblioteca Stremio está vazia</h4>
          <p>
            Adicione filmes, séries e animes pelo catálogo <strong>Explorar</strong>, importe obras já presentes no seu <strong>PC</strong> ou conecte sua conta oficial do Stremio para acompanhar os lançamentos no <strong>Calendário</strong>.
          </p>
          <div className="empty-actions">
            <button type="button" className="stremio-primary-btn" onClick={onGoDiscover}>
              <FontAwesomeIcon icon={faCompass} />
              <span>Explorar Catálogo Stremio</span>
            </button>
            {onImportLocalToLibrary && localImportableCount > 0 && (
              <button type="button" className="stremio-secondary-btn" onClick={onImportLocalToLibrary}>
                <FontAwesomeIcon icon={faHardDrive} style={{ color: '#34d399' }} />
                <span>Importar do PC ({localImportableCount})</span>
              </button>
            )}
            <button type="button" className="stremio-secondary-btn" onClick={onOpenAccountSync}>
              <FontAwesomeIcon icon={faCloudArrowDown} />
              <span>Sincronizar Conta Stremio</span>
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="stremio-empty-box">
          <FontAwesomeIcon icon={faFolderOpen} className="empty-ico" />
          <h4>Nenhum título encontrado com estes filtros</h4>
          <p>
            Tente alterar o filtro de categoria ou pesquisar diretamente no catálogo global do Stremio.
          </p>
          <div className="empty-actions">
            <button
              type="button"
              className="stremio-secondary-btn"
              onClick={() => {
                setSelectedType('all')
                setSortBy('lastWatched')
              }}
            >
              Limpar filtros
            </button>
            <button type="button" className="stremio-primary-btn" onClick={onGoDiscover}>
              <FontAwesomeIcon icon={faCompass} />
              <span>Buscar no Catálogo Global</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="stremio-poster-grid">
          {filteredItems.map((item) => {
            const pct =
              item.durationSeconds > 0 && item.progressSeconds > 0
                ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
                : 0
            const hasProgress = pct > 0 && pct < 98
            const isSeries =
              item.type === 'series' ||
              item.type === 'anime' ||
              item.id.startsWith('kitsu:')
            const showPoster = Boolean(item.poster && !brokenPosters[item.id])
            const localMatch = localMatchesById.get(item.id)

            return (
              <div
                key={item.id}
                className="stremio-library-card"
                onClick={() => onOpenItem(item)}
                title={
                  localMatch
                    ? `${item.name} · Disponível localmente no PC (${localMatch.episodesCount} arquivo(s))`
                    : item.name
                }
              >
                <div className="stremio-card-poster-box">
                  {showPoster ? (
                    <img
                      src={item.poster}
                      alt={item.name}
                      loading="lazy"
                      onError={() =>
                        setBrokenPosters((prev) => ({ ...prev, [item.id]: true }))
                      }
                    />
                  ) : (
                    <div className="stremio-card-fallback">
                      <FontAwesomeIcon icon={isSeries ? faTv : faFilm} />
                    </div>
                  )}

                  {item.isWatched && (
                    <div className="stremio-watched-badge" title="Assistido">
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                  )}

                  {typeof item.newEpisodesCount === 'number' && item.newEpisodesCount > 0 && (
                    <div
                      className="stremio-new-eps-badge"
                      title={`${item.newEpisodesCount} novo(s) episódio(s) disponível(is)`}
                    >
                      +{item.newEpisodesCount}
                    </div>
                  )}

                  {localMatch && (
                    <div
                      className={`stremio-local-pc-badge ${hasProgress ? '' : 'no-progress'}`}
                      title={`Disponível no seu PC (${localMatch.episodesCount} arquivo${localMatch.episodesCount > 1 ? 's' : ''}${localMatch.bestResolution ? ` · ${localMatch.bestResolution}` : ''})`}
                    >
                      <FontAwesomeIcon icon={faHardDrive} />
                      <span>
                        NO PC{localMatch.isSeries && localMatch.episodesCount > 1 ? ` · ${localMatch.episodesCount}` : ''}
                      </span>
                    </div>
                  )}

                  <div
                    className={`stremio-card-play-circle ${hasProgress ? 'always-visible' : ''}`}
                    aria-hidden="true"
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </div>

                  <div
                    className="stremio-card-hover-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title={item.isWatched ? 'Desmarcar assistido' : 'Marcar como assistido'}
                      onClick={() => onToggleWatched(item)}
                    >
                      <FontAwesomeIcon icon={item.isWatched ? faCheck : faEye} />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      title="Remover da Biblioteca"
                      onClick={() => onRemoveItem(item)}
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                  </div>

                  {hasProgress && (
                    <div
                      className="stremio-card-progress-track"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="stremio-card-progress-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="stremio-card-title">{item.name}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
