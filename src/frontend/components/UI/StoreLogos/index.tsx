import { useState, useEffect } from 'react'
import { Runner } from 'common/types'
import EpicLogo from 'frontend/assets/epic-logo.svg?react'
import GOGLogo from 'frontend/assets/gog-logo.svg?react'
import SideLoad from 'frontend/assets/heroic-icon.svg?react'
import AmazonLogo from 'frontend/assets/amazon-logo.svg?react'
import ZoomLogo from 'frontend/assets/zoom-logo.svg?react'
import SteamLogo from 'frontend/assets/steam-logo.svg?react'

type Props = {
  runner: Runner
  appName?: string
  className?: string
}

export default function StoreLogos({
  runner,
  appName,
  className = 'store-icon'
}: Props) {
  const [imgFailed, setImgFailed] = useState(false)

  // Reseta o status de falha se o appName ou runner mudar
  useEffect(() => {
    setImgFailed(false)
  }, [appName, runner])

  // 1. Determina o ID da loja associada pelo usuário via localStorage
  const assignments = JSON.parse(
    localStorage.getItem('heroic_game_assignments') || '{}'
  )
  let storeId = appName ? assignments[appName] : null

  // 2. Se não houver associação direta, mapeia a partir do runner padrão ou usa o próprio runner
  if (!storeId && runner) {
    if (runner === 'legendary') {
      storeId = 'epic'
    } else if (runner === 'gog') {
      storeId = 'gog'
    } else if (runner === 'nile') {
      storeId = 'amazon'
    } else if (runner === 'zoom') {
      storeId = 'zoom'
    } else if (runner === 'sideload') {
      storeId = null // Sideloaded sem associação não tem loja padrão
    } else {
      // Caso o runner não seja um padrão, mas sim o ID de uma categoria (ex: vindo do GameCard)
      storeId = (runner as string).toLowerCase()
    }
  }

  // Se não foi possível mapear para nenhuma loja, exibe o logo padrão do Heroic
  if (!storeId) {
    return <SideLoad className={className} />
  }

  // 3. Busca os detalhes da loja no customStores salvo pelo usuário
  const customStores = JSON.parse(
    localStorage.getItem('heroic_custom_stores') || '[]'
  )
  const store = customStores.find((s: any) => s.id === storeId)

  // 4. Resolve a origem da imagem do ícone
  const hasCustomIcon = store && store.icon
  const imageSource = hasCustomIcon ? store.icon : `/images/${storeId}.png`

  // Se o carregamento da imagem falhar, exibe o logo padrão do Heroic
  if (imgFailed) {
    return <SideLoad className={className} />
  }

  // 5. Exibe os vetores embutidos (SVG) para lojas padrões caso não haja ícone customizado
  if (!hasCustomIcon) {
    const storeNameLower = (store?.name || '').toLowerCase()
    const idLower = (storeId || '').toLowerCase()

    if (idLower === 'epic' || idLower === 'legendary' || storeNameLower.includes('epic')) {
      return <EpicLogo className={className} />
    }
    if (idLower === 'gog' || storeNameLower.includes('gog')) {
      return <GOGLogo className={className} />
    }
    if (idLower === 'amazon' || idLower === 'nile' || storeNameLower.includes('amazon')) {
      return <AmazonLogo className={className} />
    }
    if (idLower === 'zoom' || storeNameLower.includes('zoom')) {
      return <ZoomLogo className={className} />
    }
    if (idLower === 'steam' || storeNameLower.includes('steam')) {
      return <SteamLogo className={className} />
    }
    if (idLower === 'xbox' || storeNameLower.includes('xbox') || idLower === 'indies' || storeNameLower.includes('indie') || storeNameLower.includes('ea')) {
      return (
        <svg
          viewBox="0 0 512 512"
          className={className}
          style={{ width: '100%', height: '100%', fill: 'currentColor' }}
        >
          <path d="M480 128H32C14.3 128 0 142.3 0 160v192c0 17.7 14.3 32 32 32h448c17.7 0 32-14.3 32-32V160c0-17.7-14.3-32-32-32zm-336 48h32v32h32v32h-32v32h-32v-32h-32v-32h32v-32zm208 112c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm80-48c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z" />
        </svg>
      )
    }
    if (idLower === 'piratas' || storeNameLower.includes('pirata')) {
      return (
        <svg
          viewBox="0 0 512 512"
          className={className}
          style={{ width: '100%', height: '100%', fill: 'currentColor' }}
        >
          <path d="M256 0C114.6 0 0 100.3 0 224c0 70.1 36.9 132.6 94.5 173.7 9.6 6.9 15.2 18.1 13.5 29.9l-9.4 66.2c-1.4 9.6 6 18.2 15.7 18.2H192v-48c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32v48h77.7c9.7 0 17.1-8.6 15.7-18.2l-9.4-66.2c-1.7-11.7 3.8-23 13.5-29.9C475.1 356.6 512 294.1 512 224 512 100.3 397.4 0 256 0zM176 256c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm160 0c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48z" />
        </svg>
      )
    }
  }

  // Caso contrário, exibe o ícone em imagem a partir da imagem customizada (Base64) ou caminho padrão /images/
  return (
    <img
      src={imageSource}
      className={className}
      alt={store ? store.name : storeId}
      onError={() => setImgFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  )
}
