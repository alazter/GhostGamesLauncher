import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { GameInfo } from 'common/types'
import type { ExternalInstallation } from 'common/types/plugins'
import { SourceBadge } from './shared'
import './index.css'

export default function ExternalGameLink({ game }: { game: GameInfo }) {
  const [installation, setInstallation] = useState<ExternalInstallation>()
  useEffect(() => {
    let active = true
    setInstallation(undefined)
    if (game.runner === 'sideload')
      void window.api
        .externalGamesState()
        .then((state) => {
          if (active)
            setInstallation(
              state.installations.find((item) => item.appName === game.app_name)
            )
        })
        .catch(() => {})
    return () => {
      active = false
    }
  }, [game.app_name, game.runner])
  if (!installation) return null
  return (
    <div className="externalActions">
      <SourceBadge
        name={installation.game.providerName}
        icon={installation.game.providerIcon}
      />
      <Link to={`/external-games?installation=${installation.id}`}>
        Fonte, atualizações e saves
      </Link>
    </div>
  )
}
