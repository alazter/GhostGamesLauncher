import { useState } from 'react'
import type { GhostMovie } from 'common/types/plugins'
import { mediaPoster } from 'common/mediaCatalog'
import { getMediaImageUrl } from './imageUrl'

/** Fill the banner with backdrops, preserving portrait posters as a fallback. */
export default function FeaturedArtwork({ movie }: { movie: GhostMovie }) {
  const [failed, setFailed] = useState<string[]>([])
  const [landscapeSource, setLandscapeSource] = useState<string>()
  const sources = [
    movie.backdropUrl,
    movie.localBackdropPath
      ? `imagecache://localhost/${encodeURIComponent(movie.localBackdropPath)}`
      : undefined,
    mediaPoster(movie)
  ]
    .map(getMediaImageUrl)
    .filter((source): source is string => !!source)
  const source = sources.find((candidate) => !failed.includes(candidate))

  return (
    <div
      className={`hero-artwork${source && landscapeSource === source ? ' hero-artwork-landscape' : ''}`}
    >
      {source && (
        <>
          <div
            className="hero-artwork-ambient"
            style={{ backgroundImage: `url("${source}")` }}
          />
          <img
            key={source}
            className="hero-artwork-image"
            src={source}
            alt=""
            onLoad={({ currentTarget }) =>
              setLandscapeSource(
                currentTarget.naturalWidth > currentTarget.naturalHeight
                  ? source
                  : undefined
              )
            }
            onError={() => setFailed((previous) => [...previous, source])}
          />
        </>
      )}
    </div>
  )
}
