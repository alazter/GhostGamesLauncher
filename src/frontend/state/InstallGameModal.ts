import { GameInfo, Runner } from 'common/types'
import { create } from 'zustand'

interface InstallGameModalState {
  isOpen: boolean
  appName?: string
  runner?: Runner
  gameInfo: GameInfo | null
  action?: 'install' | 'import'
  initialSgdbTarget?: 'cover' | 'square' | null
}

export const useInstallGameModal = create<InstallGameModalState>()(() => ({
  isOpen: false,
  gameInfo: null,
  action: 'install',
  initialSgdbTarget: null
}))

interface OpenInstallGameModalParams {
  appName: string
  runner: Runner
  gameInfo: GameInfo | null
  action?: 'install' | 'import'
  initialSgdbTarget?: 'cover' | 'square' | null
}
export const openInstallGameModal = ({
  appName,
  runner,
  gameInfo,
  action = 'install',
  initialSgdbTarget = null
}: OpenInstallGameModalParams) => {
  useInstallGameModal.setState({
    isOpen: true,
    appName,
    runner,
    gameInfo,
    action,
    initialSgdbTarget
  })
}

export const closeInstallGameModal = () => {
  useInstallGameModal.setState({
    isOpen: false
  })
}
