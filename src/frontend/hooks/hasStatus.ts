import React from 'react'
import ContextProvider from 'frontend/state/ContextProvider'
import { GameInfo, GameStatus, InstallProgress, Status } from 'common/types'
import { hasProgress } from './hasProgress'
import { useTranslation } from 'react-i18next'
import { getStatusLabel, handleNonAvailableGames } from './constants'

export function hasStatus(gameInfo: GameInfo, gameSize?: string, customProgress?: InstallProgress) {
  const appName = gameInfo.app_name
  const { libraryStatus } = React.useContext(ContextProvider)
  const [availabilityTrigger, setAvailabilityTrigger] = React.useState(0)
  const { t } = useTranslation('gamepage')

  const [gameStatus, setGameStatus] = React.useState<{
    status?: Status
    statusContext?: string
    folder?: string
    label: string
  }>({ label: '' })

  const {
    thirdPartyManagedApp = undefined,
    is_installed,
    runner = 'sideload',
    isEAManaged,
    isUbisoftManaged
  } = gameInfo

  React.useEffect(() => {
    let isMounted = true
    const checkGameStatus = async () => {
      const {
        status,
        folder,
        context: statusContext
      } = libraryStatus.find((game: GameStatus) => game.appName === appName) ||
      {}

      if (status && status !== 'done') {
        const label = getStatusLabel({
          status,
          t,
          runner,
          size: gameSize,
          statusContext,
          percent: customProgress?.percent
        })
        if (isMounted) setGameStatus({ status, folder, label, statusContext })
        return
      }

      if (thirdPartyManagedApp && !isEAManaged && !isUbisoftManaged) {
        const label = getStatusLabel({
          status: 'notSupportedGame',
          t,
          runner
        })
        if (isMounted) setGameStatus({
          status: 'notSupportedGame',
          label,
          statusContext
        })
        return
      }

      if (is_installed && !thirdPartyManagedApp) {
        const gameAvailable = await handleNonAvailableGames(appName, runner)
        if (!isMounted) return
        if (!gameAvailable) {
          const label = getStatusLabel({
            status: 'notAvailable',
            t,
            runner
          })
          return setGameStatus({ status: 'notAvailable', label, statusContext })
        }
        const label = getStatusLabel({
          status: 'installed',
          t,
          runner,
          size: gameSize
        })
        return setGameStatus({ status: 'installed', label, statusContext })
      }

      const label = getStatusLabel({
        status: 'notInstalled',
        t,
        runner
      })
      if (isMounted) setGameStatus({ status: 'notInstalled', label, statusContext })
    }
    checkGameStatus()
    return () => {
      isMounted = false
    }
  }, [
    libraryStatus,
    appName,
    runner,
    gameSize,
    t,
    customProgress?.percent,
    is_installed,
    thirdPartyManagedApp,
    isEAManaged,
    isUbisoftManaged,
    availabilityTrigger
  ])

  return gameStatus
}
