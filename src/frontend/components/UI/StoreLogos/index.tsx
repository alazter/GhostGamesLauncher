import { useState, useEffect } from 'react'
import { Runner } from 'common/types'
import EpicLogo from 'frontend/assets/epic-logo.svg?react'
import GOGLogo from 'frontend/assets/gog-logo.svg?react'
import SideLoad from 'frontend/assets/heroic-icon.svg?react'
import AmazonLogo from 'frontend/assets/amazon-logo.svg?react'
import ZoomLogo from 'frontend/assets/zoom-logo.svg?react'

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
      return (
        <svg
          viewBox="0 0 496 512"
          className={className}
          style={{ width: '100%', height: '100%', fill: 'currentColor' }}
        >
          <path d="M496 256c0 137-111 248-248 248-25.6 0-50.2-3.9-73.4-11.1l-16.3-22.6c-4.4-6.1-13.4-6.8-18.7-1.4l-57.1 57.1c-6.1 6.1-15.8 4.7-19.9-2.9l-22.8-42.3c-2.3-4.2-7.5-6.1-12-4.4-44.5 16.5-93.5 17.3-138.8 2.2C1.7 465.1-4.8 447.4 3.7 427.6c27-63.1 79.1-112.5 142.1-136.2l35.8-66.4c2.8-5.2 8.7-8 14.7-7.4l60.2 6c5.7.6 10.9-2.8 12.8-8.2l12.7-36.6c-27.1-26.7-27.4-70.5-.8-97.5 27.2-27.6 71.8-27.6 99 0 27.3 27.5 27.3 71.9 0 99.5-23.7 23.9-60.5 27.2-87.7 9.8l-12.8 36.8c-1.3 3.8-4.7 6.4-8.7 6.8l-59 5.9c-4.1.4-8-1.5-10.2-4.9l-34.5-54.8c-24-38.1-18.7-88.6 13.5-120.8 33-33.4 87.2-33.4 120.2 0s33 87.2 0 120.6c-29.2 29.5-74.1 33.3-107.6 11.2l34.2 54.3c2 3.2 1.3 7.4-1.6 9.8l-56.1 46c-3.1 2.5-7.5 2.5-10.6.1l-22-16.5c-3.1-2.3-7.4-2.2-10.4.3-39.6 33.5-94.8 44.7-145 28.5C39.6 373.1 8 327.3 8 274.6c0-128.8 111.9-234.6 248-234.6S504 145.8 504 274.6c0 15.6-1.7 30.9-4.9 45.7l-41.4-56.5c-4.1-5.6-12.2-6.5-17.4-1.9l-61.1 53.6c-5.8 5.1-6.5 13.9-1.5 19.8l61.6 71.6c4.6 5.3 12.6 6.1 18.2 1.9l40-29.7c8.1-6 10.1-17.1 4.5-25.3l-16-23z" />
        </svg>
      )
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
